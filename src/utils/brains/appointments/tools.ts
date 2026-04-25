export type BusinessHoursRow = {
    day_of_week: number; // 0 Sunday, 1 Monday, ... 6 Saturday
    is_open: boolean;
    open_time: string | null; // HH:mm or HH:mm:ss
    close_time: string | null;
};

export type AppointmentService = {
    id?: string;
    name: string;
    price?: number | string | null;
    duration_minutes?: number | null;
    description?: string | null;
};

export type AppointmentSlot = {
    date: string;
    time: string;
    end_time: string;
};

export type AppointmentValidation = {
    ok: boolean;
    code: 'ok' | 'closed' | 'outside_business_hours' | 'conflict' | 'missing_fields' | 'database_error';
    message: string;
};

const DAY_ALIASES: Record<string, number> = {
    sunday: 0,
    sun: 0,
    ahad: 0,
    a7ad: 0,
    l7ad: 0,
    'الأحد': 0,
    'الاحد': 0,

    monday: 1,
    mon: 1,
    tnen: 1,
    itnen: 1,
    tanen: 1,
    ltnen: 1,
    'l tnen': 1,
    'الإثنين': 1,
    'الاثنين': 1,

    tuesday: 2,
    tue: 2,
    tleta: 2,
    taleta: 2,
    'الثلاثاء': 2,

    wednesday: 3,
    wed: 3,
    arba3a: 3,
    arb3a: 3,
    'الأربعاء': 3,
    'الاربعاء': 3,

    thursday: 4,
    thu: 4,
    khamis: 4,
    '5amis': 4,
    'الخميس': 4,

    friday: 5,
    fri: 5,
    jom3a: 5,
    jum3a: 5,
    jem3a: 5,
    'الجمعة': 5,

    saturday: 6,
    sat: 6,
    sabt: 6,
    sebt: 6,
    'السبت': 6,
};

function clean(value: string | null | undefined): string | null {
    const v = value?.trim();
    return v ? v : null;
}

function normalizeDay(input: string): string {
    return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function resolveDayOfWeek(input?: string | null, now = new Date()): number | null {
    if (!input) return null;
    const normalized = normalizeDay(input);
    if (normalized === 'today' || normalized === 'lyom' || normalized === 'اليوم') return now.getDay();
    if (normalized === 'tomorrow' || normalized === 'bokra' || normalized === 'بكرا' || normalized === 'غدا') return (now.getDay() + 1) % 7;
    if (DAY_ALIASES[normalized] !== undefined) return DAY_ALIASES[normalized];
    return null;
}

export function dateToDayOfWeek(date: string): number {
    const d = new Date(`${date}T12:00:00`);
    return d.getDay();
}

export function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map((part) => Number(part));
    return h * 60 + (Number.isFinite(m) ? m : 0);
}

export function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && bStart < aEnd;
}

function scopeWorkspace(query: any, userId: string, workspaceId?: string) {
    if (workspaceId) return query.eq('workspace_id', workspaceId);
    return query.eq('user_id', userId).is('workspace_id', null);
}

export async function getBusinessHours(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    day?: string | number | null;
}): Promise<{ hours: BusinessHoursRow[]; error?: string }> {
    const { supabase, userId, workspaceId, day } = args;
    const dayOfWeek = typeof day === 'number' ? day : resolveDayOfWeek(day || null);

    let query = supabase
        .from('business_hours')
        .select('day_of_week, is_open, open_time, close_time')
        .order('day_of_week', { ascending: true });

    query = scopeWorkspace(query, userId, workspaceId);
    if (dayOfWeek !== null) query = query.eq('day_of_week', dayOfWeek);

    const { data, error } = await query;
    if (error) {
        console.error('[AppointmentTools] Business hours error:', error);
        return { hours: [], error: error.message || 'business_hours_failed' };
    }

    return { hours: (data || []) as BusinessHoursRow[] };
}

export async function getBusinessHoursForDate(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    date: string;
}) {
    const dayOfWeek = dateToDayOfWeek(args.date);
    const result = await getBusinessHours({ ...args, day: dayOfWeek });
    return { hours: result.hours[0] || null, error: result.error };
}

export async function getServices(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    serviceName?: string | null;
    limit?: number;
}): Promise<{ services: AppointmentService[]; error?: string }> {
    const { supabase, userId, workspaceId, serviceName, limit = 10 } = args;

    let query = supabase
        .from('services')
        .select('id, name, price, duration_minutes, description')
        .limit(limit);

    query = scopeWorkspace(query, userId, workspaceId);
    if (clean(serviceName)) query = query.ilike('name', `%${clean(serviceName)}%`);

    const { data, error } = await query;
    if (error) {
        console.error('[AppointmentTools] Services error:', error);
        return { services: [], error: error.message || 'services_failed' };
    }

    return { services: (data || []) as AppointmentService[] };
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
    const { supabase, userId, workspaceId, date, durationMinutes = 60 } = args;
    const hoursResult = await getBusinessHoursForDate({ supabase, userId, workspaceId, date });
    const hours = hoursResult.hours;

    if (hoursResult.error) return { slots: [], hours: null, closed: false, error: hoursResult.error };
    if (!hours || !hours.is_open || !hours.open_time || !hours.close_time) {
        return { slots: [], hours, closed: true };
    }

    let appointmentsQuery = supabase
        .from('appointments')
        .select('appointment_date, start_time, duration_minutes, status')
        .eq('appointment_date', date)
        .neq('status', 'Cancelled');

    appointmentsQuery = scopeWorkspace(appointmentsQuery, userId, workspaceId);

    const { data: appointments, error } = await appointmentsQuery;
    if (error) {
        console.error('[AppointmentTools] Appointment lookup error:', error);
        return { slots: [], hours, closed: false, error: error.message || 'appointment_lookup_failed' };
    }

    const busyRanges = (appointments || []).map((apt: any) => {
        const start = timeToMinutes(apt.start_time);
        const end = start + Number(apt.duration_minutes || durationMinutes);
        return { start, end };
    });

    const open = timeToMinutes(hours.open_time);
    const close = timeToMinutes(hours.close_time);
    const slots: AppointmentSlot[] = [];

    for (let start = open; start + durationMinutes <= close; start += durationMinutes) {
        const end = start + durationMinutes;
        const hasConflict = busyRanges.some((busy: { start: number, end: number }) => rangesOverlap(start, end, busy.start, busy.end));
        if (!hasConflict) {
            slots.push({ date, time: minutesToTime(start), end_time: minutesToTime(end) });
        }
    }

    return { slots, hours, closed: false };
}

export async function validateAppointmentSlot(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    date: string;
    time: string;
    durationMinutes: number;
}): Promise<AppointmentValidation> {
    const { supabase, userId, workspaceId, date, time, durationMinutes } = args;
    const hoursResult = await getBusinessHoursForDate({ supabase, userId, workspaceId, date });
    const hoursValidation = validateSlotInsideBusinessHours({ hours: hoursResult.hours, time, durationMinutes });
    if (!hoursValidation.ok) return hoursValidation;

    const availability = await checkAppointmentAvailability({ supabase, userId, workspaceId, date, durationMinutes });
    if (availability.error) return { ok: false, code: 'database_error', message: availability.error };

    const requestedStart = timeToMinutes(time);
    const requestedEnd = requestedStart + durationMinutes;
    const available = availability.slots.some((slot) => {
        const slotStart = timeToMinutes(slot.time);
        const slotEnd = timeToMinutes(slot.end_time);
        return requestedStart >= slotStart && requestedEnd <= slotEnd;
    });

    if (!available) return { ok: false, code: 'conflict', message: 'Requested appointment time conflicts with another booking.' };
    return { ok: true, code: 'ok', message: 'Appointment slot is valid.' };
}

export async function finalizeAppointmentBooking(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    chatId?: string;
    customerName?: string | null;
    customerPhone?: string | null;
    serviceName?: string | null;
    date?: string | null;
    time?: string | null;
    durationMinutes?: number;
}) {
    const { supabase, userId, workspaceId, chatId } = args;
    const missing: string[] = [];
    if (!clean(args.customerName)) missing.push('name');
    if (!clean(args.customerPhone)) missing.push('phone');
    if (!clean(args.serviceName)) missing.push('service');
    if (!clean(args.date)) missing.push('date');
    if (!clean(args.time)) missing.push('time');

    if (missing.length) {
        return { ok: false, code: 'missing_fields', missing, message: `Missing booking fields: ${missing.join(', ')}` };
    }

    const durationMinutes = args.durationMinutes || 60;
    const validation = await validateAppointmentSlot({
        supabase,
        userId,
        workspaceId,
        date: args.date!,
        time: args.time!,
        durationMinutes,
    });

    if (!validation.ok) return { ok: false, code: validation.code, message: validation.message };

    // Get instagram handle
    let handle = 'Customer';
    if (chatId) {
        const { data: lastMsg } = await supabase
            .from('activity_log').select('metadata')
            .eq('user_id', userId)
            .filter('metadata->>chat_id', 'eq', chatId)
            .order('timestamp', { ascending: false })
            .limit(1).maybeSingle();
        if (lastMsg?.metadata?.username) handle = lastMsg.metadata.username;
    }

    const { error } = await supabase.from('appointments').insert({
        user_id: userId,
        workspace_id: workspaceId || null,
        instagram_user_id: chatId || null,
        instagram_handle: handle,
        customer_name: clean(args.customerName),
        customer_phone: clean(args.customerPhone),
        service: clean(args.serviceName),
        appointment_date: args.date,
        start_time: args.time,
        duration_minutes: durationMinutes,
        status: 'confirmed',
        created_at: new Date().toISOString(),
    });

    if (error) {
        console.error('[AppointmentTools] Booking insert error:', error);
        return { ok: false, code: 'database_error', message: error.message || 'Failed to save booking.' };
    }

    // Also save to orders table (for orders page)
    await supabase.from('orders').insert({
        user_id: userId,
        workspace_id: workspaceId || null,
        instagram_user_id: chatId || null,
        instagram_handle: handle,
        status: 'Pending',
        created_at: new Date().toISOString(),
        customer_name: clean(args.customerName),
        customer_phone: clean(args.customerPhone),
        item_requested: clean(args.serviceName),
        raw_message: JSON.stringify({ preferred_date: args.date, preferred_time: args.time }),
    }).then(({ error: orderError }: any) => {
        if (orderError) console.warn('⚠️ [APPOINTMENTS] orders mirror insert error:', orderError.message);
    });

    return { ok: true, code: 'appointment_saved', message: 'Appointment saved successfully.' };
}
