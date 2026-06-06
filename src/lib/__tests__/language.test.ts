import { describe, it, expect } from 'vitest';
import { extractNameAndPhone, extractAddress } from '../ai/language';

describe('Name & Phone Extraction Heuristics', () => {
    it('extracts name and phone from standard comma-separated details', () => {
        const res = extractNameAndPhone('Ali, 71123456, Hamra');
        expect(res.name).toBe('Ali');
        expect(res.phone).toBe('71123456');
    });

    it('extracts name and phone when name is first, then phone, then address without commas', () => {
        const res = extractNameAndPhone('Ali 71123456 Hamra beirut');
        expect(res.name).toBe('Ali');
        expect(res.phone).toBe('71123456');
    });

    it('extracts name and phone from Arabizi labeled formats', () => {
        const res = extractNameAndPhone('esme Ali ra2me 71123456 3nwene Hamra');
        expect(res.name).toBe('Ali');
        expect(res.phone).toBe('71123456');
    });

    it('does not corrupt name with conversational sentence when no phone is present', () => {
        const res = extractNameAndPhone('Okay i want one delivered to beirut rweis');
        expect(res.name).toBeNull();
        expect(res.phone).toBeNull();
    });

    it('extracts name when name is sent alone and is short', () => {
        const res = extractNameAndPhone('Ali Kassem');
        expect(res.name).toBe('Ali Kassem');
        expect(res.phone).toBeNull();
    });

    it('extracts name when intro phrase is present', () => {
        const res = extractNameAndPhone('My name is Ali');
        expect(res.name).toBe('Ali');
        expect(res.phone).toBeNull();
    });

    it('does not extract name from address-only string when no phone is present', () => {
        const res = extractNameAndPhone('Beirut Rweis');
        expect(res.name).toBeNull();
        expect(res.phone).toBeNull();
    });

    it('ignores location words and verbs when extracting name with a phone number', () => {
        const res = extractNameAndPhone('71123456, Hamra');
        expect(res.name).toBeNull();
        expect(res.phone).toBe('71123456');
    });
});

describe('Address Extraction Heuristics', () => {
    it('extracts address from change address triggers', () => {
        expect(extractAddress('change address to Hamra near Verdun')).toBe('Hamra near Verdun');
    });

    it('extracts address from natural sentences using prefix regex', () => {
        expect(extractAddress('Okay i want one delivered to beirut rweis')).toBe('beirut rweis');
        expect(extractAddress('send it to Hamra, Beirut')).toBe('Hamra, Beirut');
    });

    it('extracts address from comma-separated string containing phone', () => {
        expect(extractAddress('Ali, 71123456, Hamra near Verdun Hall')).toBe('Hamra near Verdun Hall');
    });

    it('extracts address from comma-separated string where phone is at the end', () => {
        expect(extractAddress('Ali, Hamra, 71123456')).toBe('Hamra');
    });

    it('extracts address using Lebanese area fallbacks and prepositions when no phone or prefix is present', () => {
        expect(extractAddress('I am in Beirut Hamra')).toBe('in Beirut Hamra');
        expect(extractAddress('Beirut Rweis')).toBe('Beirut Rweis');
    });
});
