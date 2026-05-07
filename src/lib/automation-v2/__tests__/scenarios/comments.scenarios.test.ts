/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Comment Context Golden Scenario Tests
 * ═══════════════════════════════════════════════════════════════
 * Tests intent classification for Instagram comment scenarios.
 */

import { describe, it, expect } from 'vitest';
import { classifyByRegex } from '../../classify/regex-fallbacks';

describe('Comment Scenarios — Intent Classification', () => {
    it('S1: price comment — "how much?"', () => {
        const r = classifyByRegex('how much is this?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('price_question');
    });

    it('S2: availability comment — "do you have this?"', () => {
        const r = classifyByRegex('do you have this in stock?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('product_availability');
    });

    it('S3: Arabizi price — "adde?"', () => {
        const r = classifyByRegex('adde se3ro?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('price_question');
    });

    it('S4: Arabizi availability — "fi meno?"', () => {
        const r = classifyByRegex('fi meno?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('product_availability');
    });

    it('S5: greeting comment should be classified', () => {
        const r = classifyByRegex('hey');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('greeting');
    });

    it('S6: shipping question from comment', () => {
        const r = classifyByRegex('do you deliver?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('shipping_question');
    });

    it('S7: location question from comment', () => {
        const r = classifyByRegex('where are you located?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('location_question');
    });
});
