/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Appointments Date/Time
 * ═══════════════════════════════════════════════════════════════
 * Resolves date and time references specifically for appointments.
 * Wraps the base time resolution with appointment-specific logic.
 */

import { resolveDateFromMessage, resolveTimeFromMessage, buildTimeContext } from '../time';
import type { TimeContext } from '../types';

export interface ResolvedDateTime {
    date: string | null;
    time: string | null;
}

/**
 * Extracts both date and time from a message.
 * Priority given to explicit references, then context.
 */
export function resolveDateTime(
    message: string,
    timezone: string,
    existingDate?: string | null,
    existingTime?: string | null
): ResolvedDateTime {
    const timeCtx = buildTimeContext(timezone);
    
    const date = resolveDateFromMessage(message, timeCtx) || existingDate || null;
    const time = resolveTimeFromMessage(message) || existingTime || null;

    return { date, time };
}
