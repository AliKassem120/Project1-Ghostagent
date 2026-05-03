/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Language Detection
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { detectLanguage, detectYesNo, extractPhone, extractNameAndPhone } from '../language';

describe('detectLanguage', () => {
    it('detects English', () => {
        expect(detectLanguage('Hello, how are you?')).toBe('english');
        expect(detectLanguage('I want to buy a hoodie')).toBe('english');
    });

    it('detects Arabic', () => {
        expect(detectLanguage('مرحبا كيف الحال')).toBe('arabic');
        expect(detectLanguage('أريد حجز موعد')).toBe('arabic');
    });

    it('detects Arabizi', () => {
        expect(detectLanguage('Bde e7joz maw3ed')).toBe('arabizi');
        expect(detectLanguage('kifak')).toBe('arabizi');
        expect(detectLanguage('shu baddak')).toBe('arabizi');
        expect(detectLanguage('Adde se3ro')).toBe('arabizi');
        expect(detectLanguage('Fi hoodie black medium?')).toBe('arabizi');
    });

    it('detects French', () => {
        expect(detectLanguage('Je voudrais un rendez-vous')).toBe('french');
        expect(detectLanguage('Bonjour, combien ça coûte?')).toBe('french');
    });

    it('detects Spanish', () => {
        expect(detectLanguage('Quiero reservar una cita')).toBe('spanish');
        expect(detectLanguage('Hola, cuanto cuesta?')).toBe('spanish');
    });

    it('detects mixed Arabic + Latin', () => {
        expect(detectLanguage('أريد hoodie')).toBe('mixed');
    });

    it('returns english for plain latin text', () => {
        expect(detectLanguage('yes')).toBe('english');
        expect(detectLanguage('ok')).toBe('english');
    });
});

describe('detectYesNo', () => {
    it('detects yes in English', () => {
        expect(detectYesNo('yes')).toBe('yes');
        expect(detectYesNo('yeah')).toBe('yes');
        expect(detectYesNo('ok')).toBe('yes');
        expect(detectYesNo('sure')).toBe('yes');
    });

    it('detects yes in Arabizi', () => {
        expect(detectYesNo('eh')).toBe('yes');
        expect(detectYesNo('akid')).toBe('yes');
        expect(detectYesNo('tamem')).toBe('yes');
        expect(detectYesNo('yalla')).toBe('yes');
    });

    it('detects no in English', () => {
        expect(detectYesNo('no')).toBe('no');
        expect(detectYesNo('nope')).toBe('no');
        expect(detectYesNo('cancel')).toBe('no');
    });

    it('detects no in Arabizi', () => {
        expect(detectYesNo('la2')).toBe('no');
        expect(detectYesNo('la')).toBe('no');
        expect(detectYesNo('mish')).toBe('no');
    });

    it('returns null for non-yes/no messages', () => {
        expect(detectYesNo('I want to book an appointment for tomorrow')).toBe(null);
    });
});

describe('extractPhone', () => {
    it('extracts phone numbers', () => {
        expect(extractPhone('My number is 71123456')).toBe('71123456');
        expect(extractPhone('+961 71 123 456')).toBe('+96171123456');
    });

    it('returns null for no phone', () => {
        expect(extractPhone('hello there')).toBe(null);
    });
});

describe('extractNameAndPhone', () => {
    it('extracts both name and phone', () => {
        const result = extractNameAndPhone('Ali 71123456');
        expect(result.name).toBe('Ali');
        expect(result.phone).toBe('71123456');
    });

    it('handles "name, phone" format', () => {
        const result = extractNameAndPhone('Ali Kassem, 78820707');
        expect(result.name).toContain('Ali');
        expect(result.phone).toBe('78820707');
    });
});
