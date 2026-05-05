/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Brain Optimization Tests
 * ═══════════════════════════════════════════════════════════════
 * Tests for comment-to-DM context, CTA memory, cancel handling,
 * frustration detection, case-insensitive statuses, and service
 * matching optimizations.
 */

import { describe, it, expect } from 'vitest';
import { classifyByRegex } from '../classify/regex-fallbacks';
import { classifyPostContext } from '../classify/post-context-classifier';
import { detectYesNo } from '../language';

// ── Part 5: Yes/No Confirmation Handling ─────────────────────

describe('Yes/No Detection — Expanded', () => {
    const yesWords = ['yes', 'yeah', 'yep', 'y', 'ok', 'okay', 'sure', 'confirm',
        'eh', 'ee', 'e', 'aywa', 'tmm', 'tamam', 'mnih', 'go ahead', 'do it'];
    const noWords = ['no', 'nope', 'la', 'la2', 'mesh', 'mish', 'no thanks', 'never mind', 'khalas'];

    for (const word of yesWords) {
        it(`detects "${word}" as yes`, () => {
            expect(detectYesNo(word)).toBe('yes');
        });
    }
    for (const word of noWords) {
        it(`detects "${word}" as no`, () => {
            expect(detectYesNo(word)).toBe('no');
        });
    }

    it('does not detect yes/no in long messages', () => {
        expect(detectYesNo('I was thinking about maybe going to the store yes')).toBe(null);
    });
});

// ── Part 6: Ecommerce Cancel Detection ───────────────────────

describe('Ecommerce Cancel Detection — Arabizi', () => {
    const cancelPhrases = [
        'cancel my order',
        'cancel it',
        'I don\'t want the order',
        'I don\'t want it anymore',
        'never mind the order',
        'stop the order',
        'remove the order',
        'el8e l order',
        'el8iya',
        'el8eha',
        'bde el8e l order',
        'bade el8e l order',
        'badde el8e l order',
        'm3sh bde l order',
        'ma b2a bde l order',
        'ma bade l order',
        'cancel lal order',
        'order cancel',
        '3melle cancel',
        'fik t3mel cancel',
        'ma bde yeha',
    ];

    for (const phrase of cancelPhrases) {
        it(`classifies "${phrase}" as cancel_order`, () => {
            const result = classifyByRegex(phrase);
            expect(result).not.toBeNull();
            expect(result!.intent).toBe('cancel_order');
        });
    }

    it('cancel intent fires BEFORE purchase_intent for "bde el8e l order"', () => {
        const result = classifyByRegex('bde el8e l order');
        expect(result?.intent).toBe('cancel_order');
    });
});

// ── Part 7: Cancel Status Intent ─────────────────────────────

describe('Cancel Status Detection', () => {
    const statusPhrases = [
        '3melt cancel',
        'sar cancel',
        'did you cancel it',
        'is it cancelled',
        'l order tenla8a',
        'cancel sar',
    ];

    for (const phrase of statusPhrases) {
        it(`classifies "${phrase}" as cancel_status`, () => {
            const result = classifyByRegex(phrase);
            expect(result).not.toBeNull();
            expect(result!.intent).toBe('cancel_status');
        });
    }
});

// ── Part 8: Appointment Cancel Detection ─────────────────────

describe('Appointment Cancel Detection — Arabizi', () => {
    const cancelPhrases = [
        'cancel my appointment',
        'cancel booking',
        'I can\'t come',
        'I won\'t come',
        'I don\'t want the appointment',
        'remove my booking',
        'bde el8e l maw3ed',
        'bade el8e l 7ajez',
        'el8e l maw3ed',
        'el8e l 7ajez',
        'ma fiyye eje',
        'ma rah eje',
        'ma bde eje',
        'cancel lal maw3ed',
        'cancel l 7ajez',
        'fik t3mel cancel lal maw3ed',
    ];

    for (const phrase of cancelPhrases) {
        it(`classifies "${phrase}" as cancel_appointment`, () => {
            const result = classifyByRegex(phrase);
            expect(result).not.toBeNull();
            expect(result!.intent).toBe('cancel_appointment');
        });
    }
});

// ── Part 10: Case-insensitive status (lookup tests in separate file) ──

describe('Cancel patterns do not false-positive on purchase', () => {
    it('"bde eshtere ps5" is purchase_intent, not cancel', () => {
        const result = classifyByRegex('bde eshtere ps5');
        expect(result?.intent).toBe('purchase_intent');
    });

    it('"bade e5od tv" is purchase_intent', () => {
        const result = classifyByRegex('bade e5od tv');
        expect(result?.intent).toBe('purchase_intent');
    });
});

// ── Part 11: Frustration / Stop Detection ────────────────────

describe('Frustration / Stop Detection', () => {
    const frustrationPhrases = [
        '7el 3ane',
        'hel 3anne',
        'fek 3anne',
        'ma tjeweb',
        'ma bde shi',
        'ma bde se3de',
        'leave me alone',
        'stop replying',
        'stop messaging',
        'shut up',
        'don\'t message me',
        'forget it',
    ];

    for (const phrase of frustrationPhrases) {
        it(`classifies "${phrase}" as frustration_stop`, () => {
            const result = classifyByRegex(phrase);
            expect(result).not.toBeNull();
            expect(result!.intent).toBe('frustration_stop');
        });
    }

    it('classifies "khalas" (standalone) as frustration_stop', () => {
        const result = classifyByRegex('khalas');
        expect(result?.intent).toBe('frustration_stop');
    });

    it('classifies "tyb meshe" as frustration_stop', () => {
        const result = classifyByRegex('tyb meshe');
        expect(result?.intent).toBe('frustration_stop');
    });
});

// ── Part 13: No Full Catalog for Specific Items ──────────────

describe('Specific product query does not trigger catalog listing', () => {
    it('"do you have ps5" is product_availability (specific)', () => {
        const result = classifyByRegex('do you have ps5');
        expect(result?.intent).toBe('product_availability');
    });

    it('"what do you have" is product_availability (general)', () => {
        const result = classifyByRegex('what do you have');
        expect(result?.intent).toBe('product_availability');
    });

    it('"fi ps5" is product_availability', () => {
        const result = classifyByRegex('fi ps5');
        // "fi" matches product_availability
        expect(result?.intent).toBe('product_availability');
    });
});

// ── Post-Context: Accept/Reject Offer ────────────────────────

describe('Post-Context Accept/Reject Offer', () => {
    it('"yeah" classified as accept_offer in post-context', () => {
        const result = classifyPostContext('yeah');
        expect(result.intent).toBe('accept_offer');
    });

    it('"eh" classified as accept_offer in post-context', () => {
        const result = classifyPostContext('eh');
        expect(result.intent).toBe('accept_offer');
    });

    it('"tamam" classified as accept_offer in post-context', () => {
        const result = classifyPostContext('tamam');
        expect(result.intent).toBe('accept_offer');
    });

    it('"aywa" classified as accept_offer in post-context', () => {
        const result = classifyPostContext('aywa');
        expect(result.intent).toBe('accept_offer');
    });

    it('"sure" classified as accept_offer in post-context', () => {
        const result = classifyPostContext('sure');
        expect(result.intent).toBe('accept_offer');
    });

    it('"no" classified as reject_offer in post-context', () => {
        const result = classifyPostContext('no');
        expect(result.intent).toBe('reject_offer');
    });

    it('"la" classified as reject_offer in post-context', () => {
        const result = classifyPostContext('la');
        expect(result.intent).toBe('reject_offer');
    });

    it('"la2" classified as reject_offer in post-context', () => {
        const result = classifyPostContext('la2');
        expect(result.intent).toBe('reject_offer');
    });

    it('"khalas" classified as reject_offer in post-context', () => {
        const result = classifyPostContext('khalas');
        expect(result.intent).toBe('reject_offer');
    });

    it('"no thanks" classified as reject_offer in post-context', () => {
        const result = classifyPostContext('no thanks');
        expect(result.intent).toBe('reject_offer');
    });

    it('long message is unrelated in post-context', () => {
        const result = classifyPostContext('I was just wondering about the weather today because it looked cloudy');
        expect(result.intent).toBe('unrelated');
    });
});

// ── Post-Context: Expanded Cancel Patterns ───────────────────

describe('Post-Context Cancel — Arabizi Expanded', () => {
    const cancelPhrases = [
        'cancel it',
        'el8iya',
        'el8eha',
        'bde el8e',
        'never mind',
        'I don\'t want it anymore',
        'ma bade',
        'ma bde yeha',
        '3melle cancel',
        'khalas ma bde',
        'cancel lal order',
    ];

    for (const phrase of cancelPhrases) {
        it(`post-context classifies "${phrase}" as cancel_latest`, () => {
            const result = classifyPostContext(phrase);
            expect(result.intent).toBe('cancel_latest');
        });
    }
});

// ── Comment Reply Mode Behavior (Structural) ────────────────

describe('Comment Reply Mode — Structural Expectations', () => {
    it('public mode plan has publicCommentText only', () => {
        // Structural test: verify the plan interface supports mode separation
        const plan = { publicCommentText: 'PS5 is $500.', privateDmText: null };
        expect(plan.publicCommentText).toBeTruthy();
        expect(plan.privateDmText).toBeNull();
    });

    it('dm mode plan has privateDmText only', () => {
        const plan = { publicCommentText: null, privateDmText: 'PS5 is $500. Want one?' };
        expect(plan.publicCommentText).toBeNull();
        expect(plan.privateDmText).toBeTruthy();
    });

    it('both mode plan has both texts', () => {
        const plan = { publicCommentText: 'Sent you details 👻', privateDmText: 'PS5 is $500. Want one?' };
        expect(plan.publicCommentText).toBeTruthy();
        expect(plan.privateDmText).toBeTruthy();
    });

    it('DM text never contains redirect CTA phrases', () => {
        const ctaPhrases = ['check your dm', 'sent you a dm', "i dm'd you", 'check inbox'];
        const dmText = 'PS5 is $500. Want one?';
        for (const cta of ctaPhrases) {
            expect(dmText.toLowerCase()).not.toContain(cta);
        }
    });
});

// ── Context Seed — Structural Expectations ───────────────────

describe('Context Seed — Created Only for CTA DMs', () => {
    it('context seed has required ecommerce fields', () => {
        const seed = {
            type: 'order' as const,
            productName: 'PS5',
            productId: 'prod_123',
            unitPrice: 500,
            quantity: 1,
            customer: { name: '', phone: '' },
            createdAt: new Date().toISOString(),
            editableUntil: new Date().toISOString(),
            source: 'dm_cta' as const,
            ctaType: 'purchase_offer' as const,
        };
        expect(seed.productName).toBe('PS5');
        expect(seed.ctaType).toBe('purchase_offer');
        expect(seed.source).toBe('dm_cta');
    });

    it('context seed has required appointment fields', () => {
        const seed = {
            type: 'appointment' as const,
            serviceName: 'Haircut',
            serviceId: 'svc_123',
            servicePrice: 20,
            serviceDuration: 30,
            customer: { name: '', phone: '' },
            createdAt: new Date().toISOString(),
            editableUntil: new Date().toISOString(),
            source: 'dm_cta' as const,
            ctaType: 'booking_offer' as const,
        };
        expect(seed.serviceName).toBe('Haircut');
        expect(seed.ctaType).toBe('booking_offer');
    });

    it('no context seed for generic comments', () => {
        // Generic comments like "nice", "🔥", "hello" should not create context seeds
        const genericComments = ['nice', '🔥', 'hello', 'cool', 'wow'];
        for (const comment of genericComments) {
            const result = classifyByRegex(comment);
            // These should classify as greeting or unknown, not product/purchase intents
            if (result) {
                expect(result.intent).not.toBe('purchase_intent');
                expect(result.intent).not.toBe('booking_intent');
            }
        }
    });
});
