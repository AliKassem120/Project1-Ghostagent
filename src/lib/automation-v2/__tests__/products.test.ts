/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Product Matching & Extraction
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { findBestProductMatch } from '../ecommerce/products';
import { extractProductCandidate } from '../ecommerce/extract-product';
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

