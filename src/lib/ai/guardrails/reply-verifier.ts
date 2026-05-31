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
        booking_claim: "I'd love to get that booked for you! Could you please confirm the date, time, and service so I can finalize your appointment?",
        availability_deny: "Let me check our availability for you! What date and time were you thinking?",
        order_claim: "I'd love to place that order for you! Could you please confirm your name, phone number, and address so we can finalize the order?",
        stock_deny: "Let me check the stock levels for you! Which product were you looking for?"
    },
    arabizi: {
        booking_claim: "Yalla 7abeb e7jizlak! Fik t2akid l date, l wa2et w ayya service baddak ta2aman l maw3ed?",
        availability_deny: "Khaline shouf l maw3id l fadye! Ayya nhar w se3a baddak?",
        order_claim: "Yalla baddi a3mil l order! Fik t2akid l isem, ra2em l tilefon w l address ta nkhalles l order?",
        stock_deny: "Khaline shouf iza fi stock! Ayya product baddak?"
    },
    'lebanese franco': {
        booking_claim: "Yalla 7abeb e7jizlak! Fik t2akid l date, l wa2et w ayya service baddak ta2aman l maw3ed?",
        availability_deny: "Khaline shouf l maw3id l fadye! Ayya nhar w se3a baddak?",
        order_claim: "Yalla baddi a3mil l order! Fik t2akid l isem, ra2em l tilefon w l address ta nkhalles l order?",
        stock_deny: "Khaline shouf iza fi stock! Ayya product baddak?"
    },
    mixed: {
        booking_claim: "Yalla 7abeb e7jizlak! Fik t2akid l date, l wa2et w ayya service baddak ta2aman l maw3ed?",
        availability_deny: "Khaline shouf l maw3id l fadye! Ayya nhar w se3a baddak?",
        order_claim: "Yalla baddi a3mil l order! Fik t2akid l isem, ra2em l tilefon w l address ta nkhalles l order?",
        stock_deny: "Khaline shouf iza fi stock! Ayya product baddak?"
    },
    spanish: {
        booking_claim: "¡Me encantaría reservarlo para ti! ¿Podrías confirmar la fecha, la hora y el servicio para finalizar tu cita?",
        availability_deny: "¡Déjame verificar nuestra disponibilidad! ¿En qué fecha y hora estabas pensando?",
        order_claim: "¡Me encantaría hacer ese pedido por ti! ¿Podrías confirmar tu nombre, número de teléfono y dirección para finalizar el pedido?",
        stock_deny: "¿Déjame verificar el stock! ¿Qué producto estabas buscando?"
    },
    french: {
        booking_claim: "Je serais ravi de réserver cela pour vous ! Pourriez-vous confirmer la date, l'heure et le service afin que je puisse finaliser votre rendez-vous ?",
        availability_deny: "Laissez-moi vérifier nos disponibilités ! À quelle date et heure pensiez-vous ?",
        order_claim: "Je serais ravi de passer cette commande pour vous ! Pourriez-vous confirmer votre nom, numéro de téléphone et adresse afin de finaliser la commande ?",
        stock_deny: "Laissez-moi vérifier les niveaux de stock ! Quel produit recherchiez-vous ?"
    },
    arabic: {
        booking_claim: "يسعدني أن أحجز ذلك لك! هل يمكنك تأكيد التاريخ والوقت والخدمة لتأكيد موعدك؟",
        availability_deny: "دعني أتحقق من التوفر لدينا! ما هو التاريخ والوقت الذي تفضله؟",
        order_claim: "يسعدني إتمام طلبك! هل يمكنك تأكيد اسمك ورقم هاتفك وعنوانك لتأكيد الطلب؟",
        stock_deny: "دعني أتحقق من توفر المنتج! ما هو المنتج الذي تبحث عنه؟"
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
                corrected = corrected.replace(pm.full, correctPrice);
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
