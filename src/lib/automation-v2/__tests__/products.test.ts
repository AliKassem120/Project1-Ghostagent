/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Product Matching
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { findBestProductMatch } from '../ecommerce/products';
import type { InventoryRecord } from '../types';

const mockProducts: InventoryRecord[] = [
    { id: '1', itemName: 'Black Hoodie', price: 50, stockLevel: 5, description: null, variants: [] },
    { id: '2', itemName: 'White T-Shirt', price: 25, stockLevel: 0, description: null, variants: [] },
    { id: '3', itemName: 'Blue Jeans', price: 75, stockLevel: 3, description: null, variants: [] },
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
