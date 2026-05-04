/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Product Matching & Extraction
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { findBestProductMatch } from '../ecommerce/products';
import { extractProductCandidate, extractAvailabilityCandidate } from '../ecommerce/extract-product';
import type { InventoryRecord } from '../types';

const mockProducts: InventoryRecord[] = [
    { id: '1', itemName: 'Black Hoodie', price: 50, stockLevel: 5, description: null, variants: [] },
    { id: '2', itemName: 'White T-Shirt', price: 25, stockLevel: 0, description: null, variants: [] },
    { id: '3', itemName: 'Blue Jeans', price: 75, stockLevel: 3, description: null, variants: [] },
    { id: '4', itemName: 'PS5 Console', price: 499, stockLevel: 2, description: null, variants: [] },
];

describe('findBestProductMatch', () => {
    it('finds exact match', () => {
        const result = findBestProductMatch(mockProducts, 'Black Hoodie');
        expect(result?.itemName).toBe('Black Hoodie');
    });

    it('finds case-insensitive match', () => {
        const result = findBestProductMatch(mockProducts, 'black hoodie');
        expect(result?.itemName).toBe('Black Hoodie');
    });

    it('finds partial match', () => {
        const result = findBestProductMatch(mockProducts, 'hoodie');
        expect(result?.itemName).toBe('Black Hoodie');
    });

    it('finds reverse partial match', () => {
        const result = findBestProductMatch(mockProducts, 'blue jeans size 32');
        expect(result?.itemName).toBe('Blue Jeans');
    });

    it('matches PS5 from short query', () => {
        const result = findBestProductMatch(mockProducts, 'ps5');
        expect(result?.itemName).toBe('PS5 Console');
    });

    it('does NOT default to first item for unknown product', () => {
        const result = findBestProductMatch(mockProducts, 'sneakers');
        expect(result).toBeNull();
    });

    it('does NOT default to first item for random text', () => {
        const result = findBestProductMatch(mockProducts, 'something completely different');
        expect(result).toBeNull();
    });

    it('returns null for empty query', () => {
        const result = findBestProductMatch(mockProducts, '');
        expect(result).toBeNull();
    });

    it('returns null for empty catalog', () => {
        const result = findBestProductMatch([], 'hoodie');
        expect(result).toBeNull();
    });
});

describe('extractProductCandidate', () => {
    it('strips English filler: "Okay i want one ps5"', () => {
        const result = extractProductCandidate('Okay i want one ps5');
        expect(result.productCandidate).toBe('ps5');
        expect(result.quantity).toBe(1);
    });

    it('strips Arabizi filler: "bade wa7ad ps5"', () => {
        const result = extractProductCandidate('bade wa7ad ps5');
        expect(result.productCandidate).toBe('ps5');
        expect(result.quantity).toBe(1);
    });

    it('extracts numeric quantity: "i want 3 hoodies"', () => {
        const result = extractProductCandidate('i want 3 hoodies');
        expect(result.productCandidate).toBe('hoodies');
        expect(result.quantity).toBe(3);
    });

    it('extracts word quantity: "give me two black hoodies"', () => {
        const result = extractProductCandidate('give me two black hoodies');
        expect(result.productCandidate).toBe('black hoodies');
        expect(result.quantity).toBe(2);
    });

    it('preserves product name as-is when no filler', () => {
        const result = extractProductCandidate('ps5');
        expect(result.productCandidate).toBe('ps5');
        expect(result.quantity).toBe(1);
    });

    it('handles complex message: "I need the tv samsung"', () => {
        const result = extractProductCandidate('I need the tv samsung');
        expect(result.productCandidate).toBe('tv samsung');
    });

    it('returns original when all filler: "i want"', () => {
        const result = extractProductCandidate('i want');
        expect(result.productCandidate).toBe('i want');
    });
});


// ── Availability / Price Candidate Extraction Tests ─────────────────

describe('extractAvailabilityCandidate', () => {
    it('extracts ps5 from "Do you have ps5?"', () => {
        expect(extractAvailabilityCandidate('Do you have ps5?')).toBe('ps5');
    });

    it('extracts ps5 from "is ps5 available?"', () => {
        expect(extractAvailabilityCandidate('is ps5 available?')).toBe('ps5');
    });

    it('extracts ps5 from "fi ps5?"', () => {
        expect(extractAvailabilityCandidate('fi ps5?')).toBe('ps5');
    });

    it('extracts ps5 from "3andkon ps5?"', () => {
        expect(extractAvailabilityCandidate('3andkon ps5?')).toBe('ps5');
    });

    it('extracts tv samsung from "do you have tv samsung?"', () => {
        expect(extractAvailabilityCandidate('do you have tv samsung?')).toBe('tv samsung');
    });

    it('extracts black hoodie from "is the black hoodie available?"', () => {
        expect(extractAvailabilityCandidate('is the black hoodie available?')).toBe('black hoodie');
    });

    it('extracts ps5 from "How much is ps5?"', () => {
        expect(extractAvailabilityCandidate('How much is ps5?')).toBe('ps5');
    });

    it('extracts ps5 from "addesh ps5?"', () => {
        expect(extractAvailabilityCandidate('addesh ps5?')).toBe('ps5');
    });

    it('extracts tv samsung from "price of tv samsung?"', () => {
        expect(extractAvailabilityCandidate('price of tv samsung?')).toBe('tv samsung');
    });

    it('returns empty for generic "What do you have?"', () => {
        expect(extractAvailabilityCandidate('What do you have?')).toBe('');
    });

    it('returns empty for generic "shu 3andkon?"', () => {
        expect(extractAvailabilityCandidate('shu 3andkon?')).toBe('');
    });
});


// ── Product-Specific Matching (simulating decision engine flow) ─────

describe('specific product query matching', () => {
    const catalog: InventoryRecord[] = [
        { id: '1', itemName: 'Ps5', price: 500, stockLevel: 3, description: null, variants: [] },
        { id: '2', itemName: 'Tv samsung 65inch', price: 490, stockLevel: 2, description: null, variants: [] },
    ];

    it('"Do you have ps5?" returns only Ps5, not TV', () => {
        const candidate = extractAvailabilityCandidate('Do you have ps5?');
        const match = findBestProductMatch(catalog, candidate);
        expect(match?.itemName).toBe('Ps5');
    });

    it('"is ps5 available?" returns only Ps5', () => {
        const candidate = extractAvailabilityCandidate('is ps5 available?');
        const match = findBestProductMatch(catalog, candidate);
        expect(match?.itemName).toBe('Ps5');
    });

    it('"fi ps5?" returns only Ps5', () => {
        const candidate = extractAvailabilityCandidate('fi ps5?');
        const match = findBestProductMatch(catalog, candidate);
        expect(match?.itemName).toBe('Ps5');
    });

    it('"3andkon ps5?" returns only Ps5', () => {
        const candidate = extractAvailabilityCandidate('3andkon ps5?');
        const match = findBestProductMatch(catalog, candidate);
        expect(match?.itemName).toBe('Ps5');
    });

    it('"How much is ps5?" returns only Ps5 price', () => {
        const candidate = extractAvailabilityCandidate('How much is ps5?');
        const match = findBestProductMatch(catalog, candidate);
        expect(match?.itemName).toBe('Ps5');
        expect(match?.price).toBe(500);
    });

    it('"What do you have?" extracts empty → no specific match', () => {
        const candidate = extractAvailabilityCandidate('What do you have?');
        expect(candidate).toBe('');
        // Empty candidate means general catalog, no findBestProductMatch call
    });

    it('unknown product does not match anything in catalog', () => {
        const candidate = extractAvailabilityCandidate('do you have iphone?');
        const match = findBestProductMatch(catalog, candidate);
        expect(match).toBeNull();
    });

    it('specific product question with 100 items returns only the matched product', () => {
        // Simulate a large catalog
        const largeCatalog: InventoryRecord[] = Array.from({ length: 100 }, (_, i) => ({
            id: `item-${i}`,
            itemName: `Product ${i}`,
            price: 10 + i,
            stockLevel: i % 3 === 0 ? 0 : 5,
            description: null,
            variants: [],
        }));
        largeCatalog.push({ id: 'ps5', itemName: 'Ps5', price: 500, stockLevel: 3, description: null, variants: [] });

        const candidate = extractAvailabilityCandidate('Do you have ps5?');
        const match = findBestProductMatch(largeCatalog, candidate);
        expect(match?.itemName).toBe('Ps5');
        // Should return ONLY ps5, not a listing of all 100 products
    });
});
