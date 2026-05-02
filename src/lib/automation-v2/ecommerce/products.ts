/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: E-Commerce Products
 * ═══════════════════════════════════════════════════════════════
 * Loads and matches products from inventory and knowledge base.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { InventoryRecord } from '../types';
import { v2log } from '../logger';

export async function searchProducts(args: {
    supabase: SupabaseClient;
    workspaceId: string;
    query?: string | null;
    limit?: number;
}): Promise<InventoryRecord[]> {
    const { supabase, workspaceId, query, limit = 10 } = args;

    // 1. Search inventory table
    // NOTE: inventory table columns are: id, user_id, workspace_id, item_name, price, stock_level, created_at
    // There is NO 'description' or 'variants' column.
    let dbQuery = supabase
        .from('inventory')
        .select('id, item_name, price, stock_level')
        .eq('workspace_id', workspaceId)
        .limit(limit);

    if (query) {
        dbQuery = dbQuery.ilike('item_name', `%${query}%`);
    }

    const { data: dbItems, error } = await dbQuery;
    if (error) {
        v2log.error('V2_ECOM_PRODUCTS', 'Inventory search failed', { error, workspaceId });
    }

    let items: InventoryRecord[] = (dbItems || []).map(i => ({
        id: i.id,
        itemName: i.item_name,
        price: Number(i.price),
        stockLevel: Number(i.stock_level),
        description: null,
        variants: [],
    }));

    // 2. Fallback to business_knowledge (CSV catalog)
    if (items.length < limit) {
        try {
            const { data: knowledge } = await supabase
                .from('business_knowledge')
                .select('content')
                .eq('workspace_id', workspaceId)
                .maybeSingle();

            if (knowledge?.content) {
                const csvRows = JSON.parse(knowledge.content);
                const queryLower = query?.toLowerCase();

                const csvItems: InventoryRecord[] = csvRows
                    .filter((row: any) => {
                        const name = (row.name || row.title || row.product || row.item || '').toLowerCase();
                        return !queryLower || name.includes(queryLower);
                    })
                    .slice(0, limit - items.length)
                    .map((row: any, index: number) => ({
                        id: `csv-${index}`,
                        itemName: row.name || row.title || row.product || row.item || `Item ${index + 1}`,
                        price: parseFloat(String(row.price || row.cost || '0').replace(/[^0-9.]/g, '')) || 0,
                        stockLevel: parseInt(String(row.stock || row.qty || '1').replace(/[^0-9]/g, '')) || 0,
                        description: row.description || row.details || null,
                        variants: [],
                    }));

                items = [...items, ...csvItems];
            }
        } catch (err) {
            v2log.warn('V2_ECOM_PRODUCTS', 'CSV search failed', { err, workspaceId });
        }
    }

    return items;
}

function normalizeProductText(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function findBestProductMatch(
    items: InventoryRecord[],
    query: string
): InventoryRecord | null {
    if (!query || items.length === 0) return null;

    const normalizedQuery = normalizeProductText(query);
    if (!normalizedQuery) return null;

    // Exact match
    const exact = items.find(i => normalizeProductText(i.itemName) === normalizedQuery);
    if (exact) return exact;

    // Contains match in either direction: "ps5" ↔ "sony ps5 console"
    const contains = items.find(i => {
        const name = normalizeProductText(i.itemName);
        return name.includes(normalizedQuery) || normalizedQuery.includes(name);
    });
    if (contains) return contains;

    // IMPORTANT: never fall back to the first product.
    // If the bot guesses here, customers can accidentally order the wrong item.
    return null;
}
