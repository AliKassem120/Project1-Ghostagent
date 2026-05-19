/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: E-Commerce Inventory
 * ═══════════════════════════════════════════════════════════════
 * Handles stock checks and variant resolution.
 */

import type { InventoryRecord } from '../types';

export interface StockCheckResult {
    inStock: boolean;
    availableStock: number;
    variantMatch?: any;
    reason?: 'sold_out' | 'unknown_variant' | 'not_found';
}

export function checkProductStock(
    product: InventoryRecord,
    variantQuery?: string | null
): StockCheckResult {
    // 1. If no variants, just check base stock
    if (!product.variants || product.variants.length === 0) {
        return {
            inStock: product.stockLevel > 0,
            availableStock: product.stockLevel,
            reason: product.stockLevel > 0 ? undefined : 'sold_out'
        };
    }

    // 2. Resolve variant
    if (!variantQuery) {
        // If variant exists but not specified, we can't confirm stock for a specific one
        // But we can say "In stock, please pick a size/color"
        const totalStock = product.variants.reduce((acc, v) => acc + (v.stock || v.qty || 0), 0);
        return {
            inStock: totalStock > 0,
            availableStock: totalStock,
            reason: undefined // Need variant clarification
        };
    }

    const queryLower = variantQuery.toLowerCase().trim();
    const match = product.variants.find(v => {
        const label = (typeof v === 'string' ? v : (v.label || v.name || v.variant || '')).toLowerCase().trim();
        if (!label) return false;
        if (label === queryLower) return true;

        // If it's a short string (like L, M, S, XL), use word boundaries
        if (label.length <= 2) {
            const regex = new RegExp(`\\b${label}\\b`, 'i');
            return regex.test(queryLower);
        }

        return label.includes(queryLower) || queryLower.includes(label);
    });

    if (!match) {
        return { inStock: false, availableStock: 0, reason: 'unknown_variant' };
    }

    const stock = match.stock || match.qty || 0;
    return {
        inStock: stock > 0,
        availableStock: stock,
        variantMatch: match,
        reason: stock > 0 ? undefined : 'sold_out'
    };
}
