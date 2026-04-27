/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Appointments Availability
 * ═══════════════════════════════════════════════════════════════
 * Checks if a specific time slot is available for booking.
 * Considers business hours and existing appointments.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessHoursRecord } from '../types';
import { getHoursForDay, isWithinHours } from './hours';
import { v2log } from '../logger';

export interface AvailabilityResult {
    available: boolean;
    reason?: 'closed' | 'outside_hours' | 'overlap' | 'error';
    suggestedTime?: string;
}

export async function checkAvailability(args: {
    supabase: SupabaseClient;
    workspaceId: string;
    date: string;       // YYYY-MM-DD
    startTime: string;  // HH:mm
    durationMinutes: number;
    businessHours: BusinessHoursRecord[];
}): Promise<AvailabilityResult> {
    const { supabase, workspaceId, date, startTime, durationMinutes, businessHours } = args;

    // 1. Check business hours
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const dayHours = getHoursForDay(businessHours, dayOfWeek);

    if (!dayHours || !dayHours.isOpen) {
        return { available: false, reason: 'closed' };
    }

    const startMin = timeToMinutes(startTime);
    const endMin = startMin + durationMinutes;
    const endTime = minutesToTime(endMin);

    if (!isWithinHours(startTime, dayHours) || !isWithinHours(endTime, dayHours)) {
        return { available: false, reason: 'outside_hours' };
    }

    // 2. Check for overlapping appointments
    try {
        const { data: overlaps, error } = await supabase
            .from('appointments')
            .select('id, start_time, end_time')
            .eq('workspace_id', workspaceId)
            .eq('appointment_date', date)
            .neq('status', 'cancelled');

        if (error) throw error;

        const hasOverlap = (overlaps || []).some(apt => {
            const aptStart = timeToMinutes(apt.start_time);
            const aptEnd = timeToMinutes(apt.end_time || apt.start_time); // Fallback if end_time missing
            return startMin < aptEnd && endMin > aptStart;
        });

        if (hasOverlap) {
            return { available: false, reason: 'overlap' };
        }

        return { available: true };

    } catch (err) {
        v2log.error('V2_APPOINTMENTS_AVAILABILITY', 'Failed to check overlaps', { err, workspaceId, date });
        return { available: false, reason: 'error' };
    }
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
