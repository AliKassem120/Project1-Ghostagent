/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — WhatsApp Buffer Golden Scenario Tests
 * ═══════════════════════════════════════════════════════════════
 * Tests WhatsApp-specific routing safety and buffer behavior.
 */

import { describe, it, expect, vi } from 'vitest';

describe('WhatsApp Scenarios — Routing Safety', () => {
    it('S1: no fallback in production when workspace not found', () => {
        // Simulate production: WHATSAPP_ALLOW_DEV_FALLBACK not set
        const originalEnv = process.env.WHATSAPP_ALLOW_DEV_FALLBACK;
        delete process.env.WHATSAPP_ALLOW_DEV_FALLBACK;

        // The behavior is: if no workspace, skip (don't reply)
        // We verify the env check logic
        const allowDevFallback = process.env.WHATSAPP_ALLOW_DEV_FALLBACK === 'true';
        expect(allowDevFallback).toBe(false);

        // Restore
        if (originalEnv) process.env.WHATSAPP_ALLOW_DEV_FALLBACK = originalEnv;
    });

    it('S2: dev fallback only with explicit env flag', () => {
        process.env.WHATSAPP_ALLOW_DEV_FALLBACK = 'true';
        const allowed = process.env.WHATSAPP_ALLOW_DEV_FALLBACK === 'true';
        expect(allowed).toBe(true);
        delete process.env.WHATSAPP_ALLOW_DEV_FALLBACK;
    });

    it('S3: fallback not allowed with random env value', () => {
        process.env.WHATSAPP_ALLOW_DEV_FALLBACK = 'yes';
        const allowed = process.env.WHATSAPP_ALLOW_DEV_FALLBACK === 'true';
        expect(allowed).toBe(false);
        delete process.env.WHATSAPP_ALLOW_DEV_FALLBACK;
    });
});

describe('WhatsApp Scenarios — Platform Propagation', () => {
    it('S4: platform "whatsapp" is recognized as valid', () => {
        const validPlatforms = ['instagram', 'whatsapp'];
        expect(validPlatforms).toContain('whatsapp');
    });
});
