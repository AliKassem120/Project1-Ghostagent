/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Post-Generation Reply Verifier
 * ═══════════════════════════════════════════════════════════════
 * Catches LLM hallucinations AFTER generation but BEFORE sending
 * the reply to the customer. Three checks:
 *
 * 1. Booking claim without tool success
 * 2. Price mismatch against service catalog
 * 3. Availability claim without slot check
 *
 * Pure synchronous function — no DB calls, no async.
 * All data is passed in as arguments.
 */

import { v2log } from '../logger';

// ── Types ────────────────────────────────────────────────────

export interface VerifyResult {
    verified: boolean;
    correctedReply: string;   // original reply if verified, corrected if not
    violations: string[];     // list of what was wrong
}

export interface ServiceInfo {
    name: string;
    price: number;
    durationMinutes: number;
}

export interface ProductInfo {
    name: string;
    price: number;
    stockLevel: number;
}

// ── Pattern Constants ────────────────────────────────────────

const BOOKING_CLAIM_PATTERNS = [
    /\bbooked\b/i,
    /\bconfirmed\b/i,
    /\bscheduled\b/i,
    /\bsee you at\b/i,
    /\byour appointment is\b/i,
    /\ball set\b/i,
];

const ORDER_CLAIM_PATTERNS = [
    /\border placed\b/i,
    /\border confirmed\b/i,
    /\border has been placed\b/i,
    /\byour order is\b/i,
    /\bplaced your order\b/i,
    /\bcompleted your order\b/i,
    /\bthank you for your order\b/i,
];

const AVAILABILITY_DENY_PATTERNS = [
    /\bfully booked\b/i,
    /\bno availability\b/i,
    /\ball booked\b/i,
    /\bno openings?\b/i,
];

const STOCK_DENY_PATTERNS = [
    /\bout of stock\b/i,
    /\bno stock\b/i,
    /\bunavailable\b/i,
    /\bsold out\b/i,
];

/**
 * Matches prices in the reply:
 *  - $50  /  $50.00
 *  - 50 dollars  /  50.5 dollars
 *  - 50 LBP  /  50,000 LBP
 *  - 50 L.L.
 */
const PRICE_PATTERN = /\$(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:dollars?|lbp|l\.l\.)/gi;

// ── Helpers ──────────────────────────────────────────────────

/** Parse a matched price string into a number, stripping commas */
function parsePrice(raw: string): number {
    const cleaned = raw.replace(/[$,]/g, '').replace(/\s*(dollars?|lbp|l\.l\.)\s*/i, '').trim();
    return parseFloat(cleaned);
}

/**
 * Try to find which item (service or product) a price refers to by looking at the
 * surrounding text for a name mention.
 */
function findItemForPrice(
    reply: string,
    matchIndex: number,
    items: (ServiceInfo | ProductInfo)[]
): (ServiceInfo | ProductInfo) | undefined {
    // Search in a generous window around the price match
    const windowStart = Math.max(0, matchIndex - 120);
    const windowEnd = Math.min(reply.length, matchIndex + 80);
    const window = reply.substring(windowStart, windowEnd).toLowerCase();

    for (const item of items) {
        if (window.includes(item.name.toLowerCase())) {
            return item;
        }
    }

    // If only one item exists, it's unambiguous
    if (items.length === 1) return items[0];

    return undefined;
}

// ── Main Verifier ────────────────────────────────────────────

const LOCALIZED_FALLBACKS: Record<string, {
    booking_claim: string;
    availability_deny: string;
    order_claim: string;
    stock_deny: string;
}> = {
    english: {
        booking_claim: "Almost there! Just confirm the date, time, and service 📅",
        availability_deny: "What date and time works for you?",
        order_claim: "Just need your name, phone, and address to lock it in 📦",
        stock_deny: "Which product? I'll check stock right now."
    },
    arabizi: {
        booking_claim: "Khaline n2akid l date w l wa2et w ayya service 📅",
        availability_deny: "Ayya nhar w se3a baddak?",
        order_claim: "Bas bado isem, ra2em w address 📦",
        stock_deny: "Ayya product? Khaline shef stock."
    },
    franco: {
        booking_claim: "Khaline n2akid l date w l wa2et w ayya service 📅",
        availability_deny: "Ayya nhar w se3a baddak?",
        order_claim: "Bas bado isem, ra2em w address 📦",
        stock_deny: "Ayya product? Khaline shef stock."
    },
    mixed: {
        booking_claim: "Khaline n2akid l date w l wa2et w ayya service 📅",
        availability_deny: "Ayya nhar w se3a baddak?",
        order_claim: "Bas bado isem, ra2em w address 📦",
        stock_deny: "Ayya product? Khaline shef stock."
    },
    spanish: {
        booking_claim: "¡Casi listo! Confirma fecha, hora y servicio 📅",
        availability_deny: "¿Qué fecha y hora prefieres?",
        order_claim: "Solo necesito nombre, teléfono y dirección 📦",
        stock_deny: "¿Qué producto? Reviso stock ahora."
    },
    french: {
        booking_claim: "Presque fini ! Confirmez la date, l'heure et le service 📅",
        availability_deny: "Quelle date et heure vous conviennent ?",
        order_claim: "Juste le nom, téléphone et adresse 📦",
        stock_deny: "Quel produit ? Je vérifie le stock."
    },
    arabic: {
        booking_claim: "كمل بس التاريخ والوقت والخدمة 📅",
        availability_deny: "أي تاريخ ووقت تفضل؟",
        order_claim: "بس بدي اسمك ورقمك وعنوانك 📦",
        stock_deny: "أي منتج؟ بشوف التوفر الحين."
    }
};

export function verifyAgentReply(
    reply: string,
    actions: string[],
    items: (ServiceInfo | ProductInfo)[],
    businessType: 'appointments' | 'ecommerce' = 'appointments',
    hasActiveBooking = false,
    hasActiveOrder = false,
    language = 'english'
): VerifyResult {
    const violations: string[] = [];
    let corrected = reply;

    const langKey = language ? language.toLowerCase() : 'english';
    const templates = LOCALIZED_FALLBACKS[langKey] || LOCALIZED_FALLBACKS['english'];

    if (businessType === 'appointments') {
        // ── 1. Booking claim verification ────────────────────────
        const hasBookingClaim = BOOKING_CLAIM_PATTERNS.some(p => p.test(reply));
        const hasBookingSuccess = actions.includes('book_appointment_success') || hasActiveBooking;

        if (hasBookingClaim && !hasBookingSuccess) {
            violations.push(
                'booking_claim_without_tool: Reply claims booking was confirmed but book_appointment never succeeded'
            );
            v2log.warn('REPLY_VERIFIER', 'Booking claim without tool success detected', {
                replySnippet: reply.slice(0, 120),
                actions,
                hasActiveBooking,
            });

            // Rewrite: strip the false confirmation and ask to confirm details
            corrected = templates.booking_claim;
        }

        // ── 2. Availability claim verification ───────────────────
        const hasAvailabilityDenial = AVAILABILITY_DENY_PATTERNS.some(p => p.test(reply));
        const hasSlotCheck = actions.includes('tool_check_slot');

        if (hasAvailabilityDenial && !hasSlotCheck) {
            violations.push(
                'availability_claim_without_check: Reply claims no availability but check_slot was never called'
            );
            v2log.warn('REPLY_VERIFIER', 'Availability denial without slot check detected', {
                replySnippet: reply.slice(0, 120),
                actions,
            });

            // Rewrite: offer to actually check availability
            corrected = templates.availability_deny;
        }
    } else {
        // ── E-Commerce specific checks ──────────────────────────
        
        // ── 1. Order claim verification ──────────────────────────
        const hasOrderClaim = ORDER_CLAIM_PATTERNS.some(p => p.test(reply));
        const hasOrderSuccess = actions.includes('place_order_success') || hasActiveOrder;

        if (hasOrderClaim && !hasOrderSuccess) {
            violations.push(
                'order_claim_without_tool: Reply claims order was placed but place_order never succeeded'
            );
            v2log.warn('REPLY_VERIFIER', 'Order claim without tool success detected', {
                replySnippet: reply.slice(0, 120),
                actions,
                hasActiveOrder,
            });

            corrected = templates.order_claim;
        }

        // ── 2. Stock denial verification ─────────────────────────
        const hasStockDenial = STOCK_DENY_PATTERNS.some(p => p.test(reply));
        const hasStockCheck = actions.includes('tool_search_products');

        if (hasStockDenial && !hasStockCheck) {
            violations.push(
                'stock_claim_without_check: Reply claims item is out of stock but search_products was never called'
            );
            v2log.warn('REPLY_VERIFIER', 'Stock denial without product search detected', {
                replySnippet: reply.slice(0, 120),
                actions,
            });

            corrected = templates.stock_deny;
        }
    }

    // ── Price claim verification (Shared across both types) ──
    if (items.length > 0) {
        // Collect all price matches with their positions
        const priceMatches: { full: string; value: number; index: number }[] = [];
        let match: RegExpExecArray | null;

        // Reset lastIndex for global regex
        PRICE_PATTERN.lastIndex = 0;
        while ((match = PRICE_PATTERN.exec(reply)) !== null) {
            const raw = match[0];
            const value = parsePrice(raw);
            if (!isNaN(value) && value > 0) {
                priceMatches.push({ full: raw, value, index: match.index });
            }
        }

        for (const pm of priceMatches) {
            const item = findItemForPrice(reply, pm.index, items);
            if (!item) continue; // can't determine which item — skip

            if (pm.value !== item.price) {
                violations.push(
                    `price_mismatch: Reply says "${pm.full}" for "${item.name}" but actual price is $${item.price}`
                );
                v2log.warn('REPLY_VERIFIER', 'Price mismatch detected', {
                    claimed: pm.value,
                    actual: item.price,
                    name: item.name,
                });

                // Replace just the wrong price with the correct one
                const correctPrice = `$${item.price}`;
                corrected = corrected.replace(pm.full, () => correctPrice);
            }
        }
    }

    // ── Result ───────────────────────────────────────────────
    const verified = violations.length === 0;

    if (!verified) {
        v2log.info('REPLY_VERIFIER', `Verification failed with ${violations.length} violation(s)`, {
            violations,
        });
    }

    return {
        verified,
        correctedReply: verified ? reply : corrected,
        violations,
    };
}
