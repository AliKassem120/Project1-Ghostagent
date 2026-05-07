/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Appointment Golden Scenario Tests
 * ═══════════════════════════════════════════════════════════════
 * Deterministic FSM tests for appointment booking flows.
 */

import { describe, it, expect } from 'vitest';
import { classifyByRegex } from '../../classify/regex-fallbacks';
import { guardFinalReply } from '../../validation/final-reply-guard';

describe('Appointment Scenarios — Intent Classification', () => {
    it('S1: service question', () => {
        const r = classifyByRegex('what are your treatments?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('service_question');
    });

    it('S2: booking flow — English', () => {
        const r = classifyByRegex('I want to book an appointment');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('booking_intent');
        expect(r!.confidence).toBeGreaterThanOrEqual(0.80);
    });

    it('S3: booking flow — Arabizi', () => {
        const r = classifyByRegex('bde e7joz maw3ed');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('booking_intent');
    });

    it('S4: business hours question', () => {
        const r = classifyByRegex('what are your working hours?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('business_hours');
    });

    it('S5: closed day question', () => {
        const r = classifyByRegex('are you open on Sunday?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('business_hours');
    });

    it('S7: cancel appointment — English', () => {
        const r = classifyByRegex('cancel my appointment');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_appointment');
        expect(r!.confidence).toBeGreaterThanOrEqual(0.90);
    });

    it('S7b: cancel appointment — Arabizi "el8e l maw3ed"', () => {
        const r = classifyByRegex('el8e l maw3ed');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_appointment');
    });

    it('S7c: cancel appointment — "bde elghi l maw3ed"', () => {
        const r = classifyByRegex('bde elghi l maw3ed');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_appointment');
    });
});

describe('Appointment Scenarios — Safety', () => {
    it('S9: no false booking confirmation on DB failure', () => {
        const result = guardFinalReply({
            replyText: 'Your appointment is booked! ✅',
            language: 'english',
            dbWriteAttempted: true,
            dbWriteSuccess: false,
            actionType: 'create_appointment',
            sourcePath: 'test',
        });
        // Guard replaces the false success claim with a safe error reply
        expect(result.replyText).not.toContain('booked');
        expect(result.actionsToAdd).toContain('false_success_blocked');
    });

    it('REG: cancel appointment not confused with cancel order', () => {
        const r = classifyByRegex('cancel my appointment');
        expect(r!.intent).toBe('cancel_appointment');
        // Not cancel_order
        expect(r!.intent).not.toBe('cancel_order');
    });

    it('REG: booking intent detected for "reserve"', () => {
        const r = classifyByRegex('I want to reserve a slot');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('booking_intent');
    });

    it('REG: Arabizi "7ajez" triggers booking', () => {
        const r = classifyByRegex('bde 7ajez');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('booking_intent');
    });
});
