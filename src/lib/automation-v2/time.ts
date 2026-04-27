/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Time Context
 * ═══════════════════════════════════════════════════════════════
 * All date/time resolution uses this module. Never the LLM.
 * Resolves "today", "tomorrow", day names, and relative dates
 * using the workspace timezone.
 */

import type { TimeContext } from './types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Build Time Context ───────────────────────────────────────

export function buildTimeContext(timezone: string): TimeContext {
    const now = new Date();

    // Get the date parts in the workspace timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
    });

    const isoDate = formatter.format(now); // YYYY-MM-DD
    const isoTime = timeFormatter.format(now); // HH:mm
    const dayName = dayFormatter.format(now);
    const dayOfWeek = DAY_NAMES.indexOf(dayName);

    // Tomorrow
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowDate = formatter.format(tomorrow);
    const tomorrowDayName = dayFormatter.format(tomorrow);
    const tomorrowDayOfWeek = DAY_NAMES.indexOf(tomorrowDayName);

    return {
        now,
        timezone,
        isoDate,
        isoTime,
        dayOfWeek,
        dayName,
        tomorrowDate,
        tomorrowDayOfWeek,
    };
}

// ── Day Name Resolution ──────────────────────────────────────

const DAY_ALIASES: Record<string, number> = {
    // English
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2,
    wednesday: 3, wed: 3, thursday: 4, thu: 4, friday: 5, fri: 5,
    saturday: 6, sat: 6,
    // Arabic
    'الأحد': 0, 'الاحد': 0, 'الإثنين': 1, 'الاثنين': 1, 'الثلاثاء': 2,
    'الأربعاء': 3, 'الاربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'السبت': 6,
    // Arabizi
    a7ad: 0, ahad: 0, tnen: 1, itnen: 1, tanen: 1, tleta: 2, taleta: 2,
    arba3a: 3, arb3a: 3, khamis: 4, '5amis': 4, jom3a: 5, jum3a: 5, jem3a: 5,
    sabet: 6, sebt: 6, sabt: 6,
    // French
    dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
    // Spanish
    domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

const TODAY_WORDS = ['today', 'lyom', 'elyoum', 'اليوم', "aujourd'hui", 'hoy'];
const TOMORROW_WORDS = ['tomorrow', 'bukra', 'bokra', 'بكرا', 'غدا', 'demain', 'manana', 'mañana'];

/**
 * Resolves a day reference from a message into an ISO date string (YYYY-MM-DD).
 * Returns null if no date reference is found.
 */
export function resolveDateFromMessage(message: string, timeCtx: TimeContext): string | null {
    const normalized = message.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

    // Today
    if (TODAY_WORDS.some(w => normalized.includes(w))) {
        return timeCtx.isoDate;
    }

    // Tomorrow
    if (TOMORROW_WORDS.some(w => normalized.includes(w))) {
        return timeCtx.tomorrowDate;
    }

    // Named day
    const sortedAliases = Object.keys(DAY_ALIASES).sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
        if (normalized.includes(alias)) {
            const targetDow = DAY_ALIASES[alias];
            return getNextDateForDayOfWeek(targetDow, timeCtx);
        }
    }

    return null;
}

/**
 * Resolves a time reference from a message into HH:mm format.
 * Returns null if no time reference is found.
 */
export function resolveTimeFromMessage(message: string): string | null {
    const normalized = message.toLowerCase().replace(/[^\p{L}\p{N}\s:]/gu, ' ').replace(/\s+/g, ' ').trim();

    // "4pm" / "10am" / "4 pm" / "10 am"
    const ampm = normalized.match(/\b(\d{1,2})\s*(am|pm)\b/);
    if (ampm) {
        const h = parseInt(ampm[1], 10);
        const isPM = ampm[2] === 'pm';
        const hour = isPM && h < 12 ? h + 12 : !isPM && h === 12 ? 0 : h;
        return `${String(hour).padStart(2, '0')}:00`;
    }

    // "se3a 4" / "sa3a 4" / "3al 4"
    const seaa = normalized.match(/(?:se3a|sa3a|3al|aal|al)\s+(\d{1,2})(?::(\d{2}))?/);
    if (seaa) {
        const h = parseInt(seaa[1], 10);
        const m = seaa[2] || '00';
        return `${String(h).padStart(2, '0')}:${m}`;
    }

    // "à 11h" / "a 11h" / "a las 11"
    const frenchTime = normalized.match(/(?:a|à)\s+(\d{1,2})\s*h/);
    if (frenchTime) {
        return `${String(parseInt(frenchTime[1], 10)).padStart(2, '0')}:00`;
    }

    const spanishTime = normalized.match(/a\s+las?\s+(\d{1,2})/);
    if (spanishTime) {
        return `${String(parseInt(spanishTime[1], 10)).padStart(2, '0')}:00`;
    }

    // "الساعة ١١" / "الساعة 11"
    const arabicTime = normalized.match(/(?:الساعة|ساعة)\s*(\d{1,2})/);
    if (arabicTime) {
        return `${String(parseInt(arabicTime[1], 10)).padStart(2, '0')}:00`;
    }

    // HH:MM
    const hhmm = normalized.match(/\b(\d{1,2}):(\d{2})\b/);
    if (hhmm) return `${String(parseInt(hhmm[1], 10)).padStart(2, '0')}:${hhmm[2]}`;

    // Bare number in context of time (e.g., "at 4", "se3a" already handled)
    // Only match if message is very short and just a number
    const bareNumber = normalized.match(/^(\d{1,2})$/);
    if (bareNumber) {
        const h = parseInt(bareNumber[1], 10);
        if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:00`;
    }

    return null;
}

// ── Helpers ──────────────────────────────────────────────────

function getNextDateForDayOfWeek(targetDow: number, timeCtx: TimeContext): string {
    const currentDow = timeCtx.dayOfWeek;
    let daysAhead = targetDow - currentDow;
    if (daysAhead <= 0) daysAhead += 7; // Next week if same or past

    const target = new Date(timeCtx.now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeCtx.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(target);
}

export function timeToMinutes(time: string): number {
    const parts = time.split(':');
    return parseInt(parts[0], 10) * 60 + (parts[1] ? parseInt(parts[1], 10) : 0);
}

export function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatDateLabel(isoDate: string, timeCtx: TimeContext): string {
    if (isoDate === timeCtx.isoDate) return 'Today';
    if (isoDate === timeCtx.tomorrowDate) return 'Tomorrow';

    const d = new Date(`${isoDate}T12:00:00`);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
