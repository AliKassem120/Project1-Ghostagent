/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Appointments Business Hours
 * ═══════════════════════════════════════════════════════════════
 * Loads and checks business hours for a workspace.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessHoursRecord } from '../types';
import { v2log } from '../logger';

export async function loadBusinessHours(
    supabase: SupabaseClient,
    workspaceId: string
): Promise<BusinessHoursRecord[]> {
    const { data, error } = await supabase
        .from('business_hours')
        .select('day_of_week, is_open, open_time, close_time')
        .eq('workspace_id', workspaceId);

    if (error) {
        v2log.error('V2_APPOINTMENTS_HOURS', 'Failed to load business hours', { error, workspaceId });
        return [];
    }

    return (data || []).map(h => ({
        dayOfWeek: h.day_of_week,
        isOpen: h.is_open,
        openTime: h.open_time,
        closeTime: h.close_time,
    }));
}

export function getHoursForDay(
    hours: BusinessHoursRecord[],
    dayOfWeek: number
): BusinessHoursRecord | null {
    return hours.find(h => h.dayOfWeek === dayOfWeek) || null;
}

export function isWithinHours(
    time: string, // HH:mm
    hours: BusinessHoursRecord
): boolean {
    if (!hours.isOpen) return false;

    const timeMin = timeToMinutes(time);
    const openMin = timeToMinutes(hours.openTime);
    const closeMin = timeToMinutes(hours.closeTime);

    return timeMin >= openMin && timeMin < closeMin;
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
}
