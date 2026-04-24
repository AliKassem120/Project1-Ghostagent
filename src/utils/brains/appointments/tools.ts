import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const getAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );
};

/**
 * Resolves a human-readable date string into a proper YYYY-MM-DD date.
 * Handles "today", "tomorrow", day names, and ISO dates.
 */
function resolveDate(input: string): string {
    const lower = input.toLowerCase().trim();
    const now = new Date();

    if (lower === 'today' || lower === 'lyom' || lower === 'lyawm') {
        return formatDate(now);
    }
    if (lower === 'tomorrow' || lower === 'bokra' || lower === 'bukra') {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        return formatDate(d);
    }

    // Day names (English + Franco)
    const dayMap: Record<string, number> = {
        sunday: 0, sun: 0, l7ad: 0, ahad: 0,
        monday: 1, mon: 1, tnen: 1, itnen: 1,
        tuesday: 2, tue: 2, tleta: 2, taleta: 2,
        wednesday: 3, wed: 3, arba3a: 3, arb3a: 3,
        thursday: 4, thu: 4, khamis: 4, '5amis': 4,
        friday: 5, fri: 5, jom3a: 5, jum3a: 5,
        saturday: 6, sat: 6, sabt: 6, sebt: 6,
    };

    if (dayMap[lower] !== undefined) {
        const target = dayMap[lower];
        const current = now.getDay();
        let diff = target - current;
        if (diff <= 0) diff += 7;
        const d = new Date(now);
        d.setDate(d.getDate() + diff);
        return formatDate(d);
    }

    // Try parsing as ISO date
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

    // Fallback: return tomorrow
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return formatDate(d);
}

function formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime12(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Tool that checks REAL availability by reading business_hours and
 * cross-referencing with existing appointments.
 */
export const checkCalendarAvailabilityTool = (workspaceId: string) => ({
    description: 'Check REAL-TIME availability for a specific date. Returns open time slots after checking business hours and existing bookings.',
    parameters: z.object({
        date: z.string().describe("The date to check (e.g. 'tomorrow', 'bokra', '2026-04-15', 'Monday')."),
        service_name: z.string().optional().describe('The service they want to book, if mentioned.'),
    }),
    execute: async ({ date, service_name }: any) => {
        const supabase = getAdminClient();
        const resolvedDate = resolveDate(date);
        const dayOfWeek = new Date(resolvedDate + 'T00:00:00').getDay();

        console.log(`[Calendar Tool] Checking: ${date} → ${resolvedDate} (day ${dayOfWeek}) | ws: ${workspaceId}`);

        // 1. Get business hours for this day
        const { data: hoursData } = await supabase
            .from('business_hours')
            .select('is_open, open_time, close_time')
            .eq('workspace_id', workspaceId)
            .eq('day_of_week', dayOfWeek)
            .maybeSingle();

        if (!hoursData || !hoursData.is_open) {
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
            return `CLOSED on ${dayName} (${resolvedDate}). Suggest an alternative day when the business is open.`;
        }

        const openTime = hoursData.open_time?.slice(0, 5) || '09:00';
        const closeTime = hoursData.close_time?.slice(0, 5) || '17:00';

        // 2. Get slot duration from ai_settings
        const { data: settingsData } = await supabase
            .from('ai_settings')
            .select('slot_duration_minutes')
            .eq('id', workspaceId)
            .maybeSingle();

        const slotMinutes = settingsData?.slot_duration_minutes || 60;

        // 3. Get existing appointments for this date
        const { data: existingAppts } = await supabase
            .from('appointments')
            .select('start_time, duration_minutes')
            .eq('workspace_id', workspaceId)
            .eq('appointment_date', resolvedDate)
            .neq('status', 'cancelled');

        const bookedSlots = new Set<string>();
        (existingAppts || []).forEach((a: any) => {
            // Mark every minute of the booking as occupied
            const [ah, am] = a.start_time.split(':').map(Number);
            const startMin = ah * 60 + am;
            for (let m = startMin; m < startMin + (a.duration_minutes || slotMinutes); m++) {
                bookedSlots.add(String(m));
            }
        });

        // 4. Generate available slots
        const [oh, om] = openTime.split(':').map(Number);
        const [ch, cm] = closeTime.split(':').map(Number);
        const openMin = oh * 60 + om;
        const closeMin = ch * 60 + cm;

        const availableSlots: string[] = [];
        for (let slotStart = openMin; slotStart + slotMinutes <= closeMin; slotStart += slotMinutes) {
            // Check if any minute in this slot is occupied
            let conflict = false;
            for (let m = slotStart; m < slotStart + slotMinutes; m++) {
                if (bookedSlots.has(String(m))) {
                    conflict = true;
                    break;
                }
            }
            if (!conflict) {
                const hour = Math.floor(slotStart / 60);
                const minute = slotStart % 60;
                const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                availableSlots.push(formatTime12(timeStr));
            }
        }

        // 5. Also get matching services if specified
        let serviceInfo = '';
        if (service_name) {
            const { data: services } = await supabase
                .from('services')
                .select('name, price, duration_minutes')
                .eq('workspace_id', workspaceId)
                .ilike('name', `%${service_name}%`)
                .limit(3);

            if (services && services.length > 0) {
                serviceInfo = '\nMatching services: ' + services.map((s: any) => `${s.name} ($${s.price}, ${s.duration_minutes}m)`).join(', ');
            }
        }

        if (availableSlots.length === 0) {
            return `FULLY BOOKED on ${resolvedDate}. No available slots. Suggest another day.${serviceInfo}`;
        }

        return `Available slots on ${resolvedDate}: ${availableSlots.join(', ')} (${slotMinutes}-min sessions).${serviceInfo}\nOffer these times to the customer and let them pick one.`;
    },
});
