/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Intent Chaining & Proactive Suggestions
 * ═══════════════════════════════════════════════════════════════
 * Instead of passively waiting for the customer to specify
 * everything, the agent proactively suggests the next logical
 * step based on available data — like a human employee would.
 */

import { v2log } from './logger';
import type { ServiceRecord, WorkspaceConfig } from './types';

// ── Types ───────────────────────────────────────────────────

interface TimeSlot {
    date: string;   // e.g. "Monday 2026-05-23"
    time: string;   // e.g. "10:00 AM"
}

interface ProactiveSuggestionsInput {
    config: WorkspaceConfig;
    sessionState: string;
    services?: ServiceRecord[];
    products?: any[];
    recentSummaries?: string[];
    availableSlots?: TimeSlot[];
    timeContext?: { dayName: string; isoDate: string; isoTime: string };
}

// ── Main Builder ────────────────────────────────────────────

/**
 * Build a proactive suggestions block for prompt injection.
 * Returns an empty string if there's nothing useful to suggest.
 */
export function buildProactiveSuggestions(input: ProactiveSuggestionsInput): string {
    const parts: string[] = [];

    if (input.config.businessType === 'appointments') {
        parts.push(...buildAppointmentSuggestions(input));
    } else {
        parts.push(...buildEcommerceSuggestions(input));
    }

    // Cross-workspace: check for unfinished business from last session
    const resumeSuggestion = buildResumeSuggestion(input.recentSummaries, input.config.businessType);
    if (resumeSuggestion) parts.push(resumeSuggestion);

    if (parts.length === 0) return '';

    const block = `\nPROACTIVE CONTEXT (use these to be helpful, but don't force them):\n${parts.join('\n')}\n`;

    v2log.info('INTENT_CHAIN', `Built ${parts.length} proactive suggestions`, {
        state: input.sessionState,
        count: parts.length,
    });

    return block;
}

// ── Appointment Suggestions ─────────────────────────────────

function buildAppointmentSuggestions(input: ProactiveSuggestionsInput): string[] {
    const suggestions: string[] = [];
    const { sessionState, services, availableSlots, timeContext } = input;

    // When collecting service info, remind the agent of popular services
    if ((sessionState === 'idle' || sessionState === 'awaiting_service') && services && services.length > 0) {
        const topServices = services
            .slice(0, 4)
            .map(s => `${s.name} ($${s.price}, ${s.durationMinutes}min)`)
            .join(', ');
        suggestions.push(`- Most popular services: ${topServices}. Mention these if the customer seems undecided.`);
    }

    // When waiting for date/time, suggest available slots
    if (sessionState === 'awaiting_date_time' && availableSlots && availableSlots.length > 0) {
        const slotList = availableSlots
            .slice(0, 3)
            .map(s => `${s.date} at ${s.time}`)
            .join(', ');
        suggestions.push(`- Available slots coming up: ${slotList}. Proactively suggest one of these if the customer hasn't picked a time.`);
    }

    // Cross-sell: if customer is confirming a booking, mention related services
    if (sessionState === 'awaiting_booking_confirmation' && services && services.length > 1) {
        suggestions.push(`- After confirming the booking, you could casually mention other available services if it feels natural.`);
    }

    return suggestions;
}

// ── E-Commerce Suggestions ──────────────────────────────────

function buildEcommerceSuggestions(input: ProactiveSuggestionsInput): string[] {
    const suggestions: string[] = [];
    const { sessionState, products } = input;

    // When browsing products, highlight popular/in-stock items
    if ((sessionState === 'idle' || sessionState === 'awaiting_product') && products && products.length > 0) {
        const inStock = products.filter((p: any) => p.stockLevel > 0);
        const topProducts = inStock
            .slice(0, 3)
            .map((p: any) => `${p.itemName} ($${p.price})`)
            .join(', ');
        if (topProducts) {
            suggestions.push(`- Popular items in stock: ${topProducts}. Mention these if the customer is browsing.`);
        }
    }

    // When waiting for variant, suggest the most common choice
    if (sessionState === 'awaiting_variant') {
        suggestions.push(`- If the customer can't decide on a variant, suggest the most popular size/color or ask what they usually wear.`);
    }

    // Cross-sell: after order confirmation
    if (sessionState === 'awaiting_checkout_confirmation' && products && products.length > 1) {
        suggestions.push(`- After confirming the order, you could casually mention a complementary product if it feels natural.`);
    }

    return suggestions;
}

// ── Resume Suggestion ───────────────────────────────────────

/**
 * Check recent session summaries for incomplete transactions
 * from the previous session and suggest resuming.
 */
function buildResumeSuggestion(
    recentSummaries: string[] | undefined,
    businessType: string
): string | null {
    if (!recentSummaries || recentSummaries.length === 0) return null;

    const summary = recentSummaries[recentSummaries.length - 1];
    const lastSummary = summary.toLowerCase();

    // Look for indicators of incomplete transactions
    const incompleteBookingPatterns = [
        'interested in', 'asked about', 'wanted to book', 'didn\'t finish',
        'was looking at', 'considering', 'inquired about', 'didn\'t complete',
        'left without booking', 'was asking about',
    ];

    const incompleteOrderPatterns = [
        'was looking at', 'interested in', 'asked about', 'didn\'t order',
        'wanted to buy', 'considering', 'didn\'t finish', 'didn\'t complete',
        'left without ordering', 'was browsing',
    ];

    const patterns = businessType === 'appointments'
        ? incompleteBookingPatterns
        : incompleteOrderPatterns;

    for (const pattern of patterns) {
        if (lastSummary.includes(pattern)) {
            // Clean up prefix to avoid grammatical stuttering
            let cleanSummary = summary.trim();
            if (cleanSummary.endsWith('.')) {
                cleanSummary = cleanSummary.slice(0, -1);
            }
            if (cleanSummary.toLowerCase().startsWith('customer ')) {
                cleanSummary = cleanSummary.slice(9);
            } else if (cleanSummary.toLowerCase().startsWith('the customer ')) {
                cleanSummary = cleanSummary.slice(13);
            }
            
            // Ensure correct capitalization
            if (cleanSummary && cleanSummary[0] !== cleanSummary[0].toUpperCase()) {
                // Keep it lowercase
            } else if (cleanSummary && !cleanSummary.startsWith('I ')) {
                cleanSummary = cleanSummary[0].toLowerCase() + cleanSummary.slice(1);
            }

            return `- Last time this customer ${cleanSummary.slice(0, 100)}. You could gently ask if they'd still like to proceed.`;
        }
    }

    return null;
}

// ── Available Slots Helper ──────────────────────────────────

/**
 * Get the next N available appointment slots. This is a lightweight
 * helper that generates plausible upcoming time slots based on the
 * workspace's business hours config (injected via systemInstructions).
 *
 * For a production system, this would query the actual calendar DB.
 * Currently it generates suggestion-quality slots from the time context.
 */
export function getNextAvailableSlotSuggestions(
    timeContext: { dayName: string; isoDate: string; isoTime: string },
    config: WorkspaceConfig,
    count: number = 3
): TimeSlot[] {
    // Parse the current time
    const now = new Date(`${timeContext.isoDate}T${timeContext.isoTime}`);
    const slots: TimeSlot[] = [];

    // Generate slots for the next few business hours
    const businessHours = [
        { hour: 10, label: '10:00 AM' },
        { hour: 12, label: '12:00 PM' },
        { hour: 14, label: '2:00 PM' },
        { hour: 16, label: '4:00 PM' },
    ];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Start from current time, look ahead up to 3 days
    for (let dayOffset = 0; dayOffset < 3 && slots.length < count; dayOffset++) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + dayOffset);
        const dayName = dayNames[targetDate.getDay()];

        // Skip Sundays (common closed day — the system prompt usually specifies this)
        if (targetDate.getDay() === 0) continue;

        for (const slot of businessHours) {
            if (slots.length >= count) break;

            // Skip past times for today
            if (dayOffset === 0 && slot.hour <= now.getHours()) continue;

            const dateStr = `${dayName} ${targetDate.toISOString().slice(0, 10)}`;
            slots.push({ date: dateStr, time: slot.label });
        }
    }

    return slots;
}
