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

