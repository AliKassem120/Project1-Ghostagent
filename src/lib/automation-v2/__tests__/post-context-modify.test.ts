/**
 * Regression test: Post-context order modification misclassification.
 *
 * Verifies:
 * A. New order intent beats post-context modify_order
 * B. Customer info reuse with "same name/number"
 * C. Pure modify still works when no new order intent
 * D. Language detection: "size" does not trigger Spanish
 * E. Address extraction: "change the adres to X" → address = "X"
 * F. detectReuseSignals works correctly
 */

import { describe, expect, it } from 'vitest';
import { classifyPostContext } from '../classify/post-context-classifier';
import { detectLanguage, extractAddress, extractAddressFromChange, detectReuseSignals } from '../language';

// ══════════════════════════════════════════════════════════════
// A. New order intent beats post-context modify_order
// ══════════════════════════════════════════════════════════════

describe('New order beats post-context modify', () => {
    it('classifies "I want to order a crewneck black, size L, same name and number, change the adres" as unrelated', () => {
        const r = classifyPostContext(
            'I want to order a crewneck black, size L, same name and number, change the adres'
        );
        expect(r.intent).not.toBe('modify_order');
        // Should be unrelated so purchase_intent takes over
        expect(r.intent).toBe('unrelated');
    });

    it('classifies "bde hoodie black L, same number" as unrelated (new order)', () => {
        const r = classifyPostContext('bde hoodie black L, same number');
        expect(r.intent).not.toBe('modify_order');
    });

    it('classifies "I need another ps5, same address" as unrelated (new order)', () => {
        const r = classifyPostContext('I need another ps5, same address');
        expect(r.intent).toBe('unrelated');
    });

    it('classifies "order one more crewneck but change address to Zeleya" as unrelated (new order)', () => {
        const r = classifyPostContext('order one more crewneck but change address to Zeleya');
        expect(r.intent).not.toBe('modify_order');
    });

    it('classifies "bde we7de tene, same name, new address Zeleya" as unrelated (new order)', () => {
        const r = classifyPostContext('bde we7de tene, same name, new address Zeleya');
        expect(r.intent).not.toBe('modify_order');
    });
});

// ══════════════════════════════════════════════════════════════
// B. Customer info reuse signals
// ══════════════════════════════════════════════════════════════

describe('detectReuseSignals', () => {
    it('detects "same name and number"', () => {
        const r = detectReuseSignals('I want to order a crewneck black, size L, same name and number');
        expect(r.reuseName).toBe(true);
        expect(r.reusePhone).toBe(true);
        expect(r.reuseAddress).toBe(false);
    });

    it('detects "same address"', () => {
        const r = detectReuseSignals('I need another ps5, same address');
        expect(r.reuseAddress).toBe(true);
    });

    it('detects "same name" alone', () => {
        const r = detectReuseSignals('same name, change address to Zeleya');
        expect(r.reuseName).toBe(true);
        expect(r.reuseAddress).toBe(false);
    });

    it('detects nothing when no reuse signals', () => {
        const r = detectReuseSignals('I want a hoodie');
        expect(r.reuseName).toBe(false);
        expect(r.reusePhone).toBe(false);
        expect(r.reuseAddress).toBe(false);
    });
});

// ══════════════════════════════════════════════════════════════
// C. Pure modify still works when no new order intent
// ══════════════════════════════════════════════════════════════

describe('Pure modify_order still classified correctly', () => {
    it('classifies "change my address to Beirut" as modify_order', () => {
        const r = classifyPostContext('change my address to Beirut');
        expect(r.intent).toBe('modify_order');
    });

    it('classifies "update the address" as modify_order', () => {
        const r = classifyPostContext('update the address to Tripoli');
        expect(r.intent).toBe('modify_order');
    });

    it('classifies "make it size L" as modify_order', () => {
        const r = classifyPostContext('change it to size L');
        expect(r.intent).toBe('modify_order');
    });

    it('classifies "8ayer l size" as modify_order', () => {
        const r = classifyPostContext('8ayer l size to medium');
        expect(r.intent).toBe('modify_order');
    });

    it('classifies "baddel l address la Beirut" as modify_order', () => {
        const r = classifyPostContext('baddel l address la Beirut');
        expect(r.intent).toBe('modify_order');
    });
});

// ══════════════════════════════════════════════════════════════
// D. Language detection: "size" does not trigger Spanish
// ══════════════════════════════════════════════════════════════

describe('Language detection regression', () => {
    it('detects English for message containing "size" (not Spanish)', () => {
        const lang = detectLanguage(
            'I want to order a crewneck black, size L, same name and number, change the adres'
        );
        expect(lang).toBe('english');
        expect(lang).not.toBe('spanish');
    });

    it('detects English for "What size is this?"', () => {
        expect(detectLanguage('What size is this?')).toBe('english');
    });

    it('detects English for "business hours"', () => {
        expect(detectLanguage('What are your business hours?')).toBe('english');
    });

    it('still detects Spanish for actual Spanish "si claro"', () => {
        expect(detectLanguage('si claro quiero')).toBe('spanish');
    });

    it('still detects Spanish for "quiero reservar"', () => {
        expect(detectLanguage('quiero reservar')).toBe('spanish');
    });
});

// ══════════════════════════════════════════════════════════════
// E. Address extraction: "change the adres to X"
// ══════════════════════════════════════════════════════════════

describe('Address extraction from change patterns', () => {
    it('extracts "zeleya" from "change the adres to zeleya"', () => {
        expect(extractAddressFromChange('change the adres to zeleya')).toBe('zeleya');
    });

    it('extracts "zeleya" from "change the address to zeleya"', () => {
        expect(extractAddressFromChange('change the address to zeleya')).toBe('zeleya');
    });

    it('extracts "beirut" from "update my adress to beirut"', () => {
        expect(extractAddressFromChange('update my adress to beirut')).toBe('beirut');
    });

    it('extracts via extractAddress which delegates to extractAddressFromChange', () => {
        // The top-level extractAddress should also pick up change patterns
        expect(extractAddress('change the adres to zeleya')).toBe('zeleya');
    });

    it('does NOT store "adress to zeleya" — stores only "zeleya"', () => {
        const result = extractAddressFromChange('change the adres to zeleya');
        expect(result).toBe('zeleya');
        expect(result).not.toContain('adres');
    });
});
