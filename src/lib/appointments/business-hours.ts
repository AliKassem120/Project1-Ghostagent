import { SupabaseClient } from '@supabase/supabase-js';

export type BusinessHoursRow = {
    day_of_week: number;
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
};

/**
 * Fetches all business hours rows for a given workspace.
 */
export async function getWorkspaceBusinessHours(supabase: SupabaseClient, workspaceId: string): Promise<BusinessHoursRow[]> {
    const { data, error } = await supabase
        .from('business_hours')
        .select('day_of_week, is_open, open_time, close_time')
        .eq('workspace_id', workspaceId)
        .order('day_of_week', { ascending: true });

    if (error) {
        console.error('[BusinessHours] Error fetching workspace hours:', error);
        return [];
    }

    return (data || []) as BusinessHoursRow[];
}

/**
 * Fetches business hours for a specific day of the week (0-6).
 */
export async function getBusinessHoursForDay(supabase: SupabaseClient, workspaceId: string, dayOfWeek: number): Promise<BusinessHoursRow | null> {
    const { data, error } = await supabase
        .from('business_hours')
        .select('day_of_week, is_open, open_time, close_time')
        .eq('workspace_id', workspaceId)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

    if (error) {
        console.error(`[BusinessHours] Error fetching hours for day ${dayOfWeek}:`, error);
        return null;
    }

    return data as BusinessHoursRow | null;
}

/**
 * Generates a human-readable summary of business hours.
 */
export async function getBusinessHoursSummary(supabase: SupabaseClient, workspaceId: string): Promise<string> {
    const hours = await getWorkspaceBusinessHours(supabase, workspaceId);
    if (hours.length === 0) return "not configured";

    const openDays = hours.filter(h => h.is_open);
    if (openDays.length === 0) return "closed all week";

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Group days by same hours
    const groups: { days: number[], open: string, close: string }[] = [];
    openDays.forEach(h => {
        const existing = groups.find(g => g.open === h.open_time && g.close === h.close_time);
        if (existing) {
            existing.days.push(h.day_of_week);
        } else {
            groups.push({ days: [h.day_of_week], open: h.open_time!, close: h.close_time! });
        }
    });

    return groups.map(g => {
        const daysLabel = g.days.length === 7 ? "Every day" : 
                         (g.days.length === 5 && !g.days.includes(0) && !g.days.includes(6)) ? "Monday to Friday" :
                         g.days.map(d => dayNames[d]).join(', ');
        return `${daysLabel}, ${g.open.slice(0, 5)} to ${g.close.slice(0, 5)}`;
    }).join('; ');
}

/**
 * Fetches the configured slot duration for the workspace.
 */
export async function getAppointmentSlotDuration(supabase: SupabaseClient, workspaceId: string): Promise<number> {
    const { data, error } = await supabase
        .from('ai_settings')
        .select('slot_duration_minutes')
        .eq('id', workspaceId)
        .maybeSingle();

    if (error) {
        console.error('[BusinessHours] Error fetching slot duration:', error);
        return 60; // Fallback
    }

    return data?.slot_duration_minutes || 60;
}

/**
 * Fetches the workspace timezone.
 */
export async function getWorkspaceTimezone(supabase: SupabaseClient, workspaceId: string): Promise<string> {
    const { data, error } = await supabase
        .from('ai_settings')
        .select('timezone')
        .eq('id', workspaceId)
        .maybeSingle();

    if (error) {
        console.error('[BusinessHours] Error fetching timezone:', error);
        return 'Asia/Beirut'; // Fallback
    }

    return data?.timezone || 'Asia/Beirut';
}
