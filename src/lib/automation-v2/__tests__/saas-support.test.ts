import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../classify/intent-classifier';

describe('SaaS Support Intents', () => {
    it('classifies feature questions correctly', () => {
        expect(classifyIntent('does it support whatsapp?').intent).toBe('feature_question');
        expect(classifyIntent('what features do you have?').intent).toBe('feature_question');
        expect(classifyIntent('can it connect to instagram?').intent).toBe('feature_question');
    });

    it('classifies setup questions correctly', () => {
        expect(classifyIntent('how to start?').intent).toBe('setup_question');
        expect(classifyIntent('how do i create account').intent).toBe('setup_question');
    });

    it('classifies arabizi questions correctly', () => {
        expect(classifyIntent('do you support arabizi?').intent).toBe('arabizi_question');
        expect(classifyIntent('can it detect language?').intent).toBe('arabizi_question');
    });

    it('classifies demo requests correctly', () => {
        expect(classifyIntent('can i see a demo?').intent).toBe('demo_request');
        expect(classifyIntent('try it').intent).toBe('demo_request');
    });

    it('classifies support requests correctly', () => {
        expect(classifyIntent('i need help').intent).toBe('support_request');
        expect(classifyIntent('its not working').intent).toBe('support_request');
        expect(classifyIntent('i found a bug').intent).toBe('support_request');
    });

    it('classifies pricing questions correctly', () => {
        // Handled by existing price_question intent
        expect(classifyIntent('how much does it cost?').intent).toBe('price_question');
        expect(classifyIntent('price?').intent).toBe('price_question');
    });
});
