import { toDate, formatInTimeZone } from 'date-fns-tz';
import { 
    getWorkspaceBusinessHours, 
    getBusinessHoursForDay, 
    getAppointmentSlotDuration,
    getWorkspaceTimezone,
    BusinessHoursRow
} from '@/lib/appointments/business-hours';

export type { BusinessHoursRow };

export type AppointmentService = {
    id?: string;
    name: string;
    price?: number | string | null;
    duration_minutes?: number | null;
    description?: string | null;
    aliases?: string[];
    category?: string | null;
    buffer_before?: number;
    buffer_after?: number;
    is_active?: boolean;
};

export type AppointmentSlot = {
    date: string;
    time: string;
    end_time: string;
};

export type AppointmentValidation = {
    ok: boolean;
    code: 'ok' | 'closed' | 'outside_business_hours' | 'conflict' | 'missing_fields' | 'database_error' | 'workspace_missing';
    message: string;
};

const DAY_ALIASES: Record<string, number> = {
    sunday: 0, sun: 0, ahad: 0, a7ad: 0, l7ad: 0, 'الأحد': 0, 'الاحد': 0,
    monday: 1, mon: 1, tnen: 1, itnen: 1, tanen: 1, ltnen: 1, 'l tnen': 1, 'الإثنين': 1, 'الاثنين': 1,
    tuesday: 2, tue: 2, tleta: 2, taleta: 2, 'الثلاثاء': 2,
    wednesday: 3, wed: 3, arba3a: 3, arb3a: 3, 'الأربعاء': 3, 'الاربعاء': 3,
    thursday: 4, thu: 4, khamis: 4, '5amis': 4, 'الخميس': 4,
    friday: 5, fri: 5, jom3a: 5, jum3a: 5, jem3a: 5, 'الجمعة': 5,
    saturday: 6, sat: 6, sabt: 6, sebt: 6, 'السبت': 6,
};

export function clean(value: string | null | undefined): string | null {
    const v = value?.trim();
    return v ? v : null;
}


function normalizeDay(input: string): string {
    return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Resolves a day string into a day_of_week (0-6) based on workspace timezone.
 */
export function resolveDayOfWeek(input: string | null | undefined, timezone: string): number | null {
    if (!input) return null;
    const now = toDate(new Date(), { timeZone: timezone });
    const normalized = normalizeDay(input);
    
    if (normalized === 'today' || normalized === 'lyom' || normalized === 'اليوم') return now.getDay();
    if (normalized === 'tomorrow' || normalized === 'bokra' || normalized === 'بكرا' || normalized === 'غدا') return (now.getDay() + 1) % 7;
    if (DAY_ALIASES[normalized] !== undefined) return DAY_ALIASES[normalized];
    return null;
}

export function dateToDayOfWeek(date: string): number {
    // date is YYYY-MM-DD
    const d = new Date(`${date}T12:00:00`);
    return d.getDay();
}

export function timeToMinutes(time: string): number {
    const parts = time.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    return h * 60 + (isNaN(m) ? 0 : m);
}

export function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && bStart < aEnd;
}

/**
 * Main function to fetch business hours.
 */
export async function getBusinessHours(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    day?: string | number | null;
}): Promise<{ hours: BusinessHoursRow[]; timezone: string; closed?: boolean; error?: string }> {
    const { supabase, workspaceId, day } = args;
    
    if (!workspaceId) {
        return { hours: [], timezone: 'Asia/Beirut', error: 'workspace_missing' };
    }

    const timezone = await getWorkspaceTimezone(supabase, workspaceId);
    const dayOfWeek = typeof day === 'number' ? day : resolveDayOfWeek(day || null, timezone);

    let finalHours: BusinessHoursRow[] = [];
    if (dayOfWeek !== null) {
        const row = await getBusinessHoursForDay(supabase, workspaceId, dayOfWeek);
        finalHours = row ? [row] : [];
    } else {
        finalHours = await getWorkspaceBusinessHours(supabase, workspaceId);
    }

    console.log("[APPOINTMENT_BOT_HOURS]", {
        workspaceId,
        timezone,
        resolvedDayOfWeek: dayOfWeek,
        businessHoursRows: finalHours,
    });
    const isClosed = dayOfWeek !== null ? (finalHours.length === 0 || !finalHours[0]?.is_open) : false;

    return { hours: finalHours, timezone, closed: isClosed };
}


export function validateSlotInsideBusinessHours(args: {
    hours: BusinessHoursRow | null;
    time: string;
    durationMinutes: number;
}): AppointmentValidation {
    const { hours, time, durationMinutes } = args;

    if (!hours || !hours.is_open || !hours.open_time || !hours.close_time) {
        return { ok: false, code: 'closed', message: 'Business is closed on this day.' };
    }

    const start = timeToMinutes(time);
    const end = start + durationMinutes;
    const open = timeToMinutes(hours.open_time);
    const close = timeToMinutes(hours.close_time);

    if (start < open || end > close) {
        return {
            ok: false,
            code: 'outside_business_hours',
            message: `Requested time is outside business hours (${hours.open_time}-${hours.close_time}).`,
        };
    }

    return { ok: true, code: 'ok', message: 'Slot is inside business hours.' };
}

export async function checkAppointmentAvailability(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    date: string;
    durationMinutes?: number;
}): Promise<{ slots: AppointmentSlot[]; hours: BusinessHoursRow | null; closed: boolean; error?: string }> {
    const { supabase, userId, workspaceId, date } = args;

    if (!workspaceId) return { slots: [], hours: null, closed: false, error: 'workspace_missing' };

    const timezone = await getWorkspaceTimezone(supabase, workspaceId);
    const slotDuration = args.durationMinutes || await getAppointmentSlotDuration(supabase, workspaceId);
    const dayOfWeek = dateToDayOfWeek(date);
    
    const hours = await getBusinessHoursForDay(supabase, workspaceId, dayOfWeek);

    console.log("[APPOINTMENT_BOT_HOURS]", {
        workspaceId,
        timezone,
        resolvedDate: date,
        resolvedDayOfWeek: dayOfWeek,
        businessHoursRows: hours ? [hours] : [],
        slotDurationMinutes: slotDuration,
    });

    if (!hours || !hours.is_open || !hours.open_time || !hours.close_time) {
        return { slots: [], hours, closed: true };
    }

    const { data: appointments, error } = await supabase
        .from('appointments')
        .select('start_time, duration_minutes, status')
        .eq('workspace_id', workspaceId)
        .eq('appointment_date', date)
        .neq('status', 'cancelled');

    if (error) {
        console.error('[AppointmentTools] Appointment lookup error:', error);
        return { slots: [], hours, closed: false, error: error.message };
    }

    const busyRanges = (appointments || []).map((apt: any) => {
        const start = timeToMinutes(apt.start_time);
        const end = start + Number(apt.duration_minutes || slotDuration);
        return { start, end };
    });

    const open = timeToMinutes(hours.open_time);
    const close = timeToMinutes(hours.close_time);
    const slots: AppointmentSlot[] = [];

    for (let start = open; start + slotDuration <= close; start += slotDuration) {
        const end = start + slotDuration;
        const hasConflict = busyRanges.some((busy: { start: number, end: number }) => rangesOverlap(start, end, busy.start, busy.end));
        if (!hasConflict) {
            slots.push({ date, time: minutesToTime(start), end_time: minutesToTime(end) });
        }
    }

    return { slots, hours, closed: false };
}



export async function getServices(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    serviceName?: string | null;
    limit?: number;
}): Promise<{ services: AppointmentService[]; error?: string }> {
    const { supabase, workspaceId, serviceName, limit = 10 } = args;

    if (!workspaceId) return { services: [] };

    let query = supabase
        .from('services')
        .select('id, name, price, duration_minutes, description, aliases, category, buffer_before, buffer_after, is_active')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)          // ← only active services can be booked
        .limit(limit);

    if (clean(serviceName)) query = query.ilike('name', `%${clean(serviceName)}%`);

    const { data, error } = await query;
    if (error) return { services: [], error: error.message };
    return { services: (data || []) as AppointmentService[] };
}
