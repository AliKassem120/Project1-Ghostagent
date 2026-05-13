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

    v2log.info('V2_ECOM_PRODUCTS', `DB Search returned ${dbItems?.length || 0} items`, { workspaceId, query });

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
                    .map((row: any, index: number) => {
                        const itemName = row.name || row.title || row.product || row.item || row['Product Name'] || row.Label || row.item_name;
                        if (!itemName) return null; // Skip invalid rows

                        const colors = row.color || row.colors || row.Colour || row.colours || null;
                        const sizes = row.size || row.sizes || row.Size || null;
                        
                        // Try to parse variants if they exist
                        let variants: string[] = [];
                        if (row.variants && Array.isArray(row.variants)) variants = row.variants;
                        else if (row.variants && typeof row.variants === 'string') variants = row.variants.split(',').map((s: string) => s.trim());
                        
                        return {
                            id: `csv-${index}`,
                            itemName,
                            price: parseFloat(String(row.price || row.cost || row.Price || '0').replace(/[^0-9.]/g, '')) || 0,
                            stockLevel: parseInt(String(row.stock || row.qty || row.Stock || row.Quantity || '1').replace(/[^0-9]/g, '')) || 0,
                            description: row.description || row.details || row.Description || null,
                            colors,
                            sizes,
                            variants,
                        } as InventoryRecord & { colors?: string, sizes?: string };
                    })
                    .filter((item): item is InventoryRecord => item !== null) // Remove nulls from skipped rows

                items = [...items, ...csvItems];
                v2log.info('V2_ECOM_PRODUCTS', `CSV Fallback added ${csvItems.length} items`, { workspaceId });
            }
        } catch (err) {
            v2log.warn('V2_ECOM_PRODUCTS', 'CSV search failed', { err, workspaceId });
        }
    }

    return items;
}

export interface ProductMatchResult {
    product: InventoryRecord;
    score: number;
    matchType: 'exact' | 'contains' | 'reverse_contains' | 'token_overlap' | 'fuzzy';
}

/**
 * Normalize a string for matching: lowercase, strip punctuation, collapse spaces.
 */
function normalizeForMatch(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
}

/**
 * Compute token overlap score between two strings.
 * Returns a value between 0 and 1.
 */
function tokenOverlap(a: string, b: string): number {
    const tokensA = new Set(normalizeForMatch(a).split(' ').filter(t => t.length > 0));
    const tokensB = new Set(normalizeForMatch(b).split(' ').filter(t => t.length > 0));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let matches = 0;
    for (const t of tokensA) {
        if (tokensB.has(t)) matches++;
    }
    return matches / Math.max(tokensA.size, tokensB.size);
}

/**
 * Simple similarity: longest common substring ratio.
 */
function simpleSimilarity(a: string, b: string): number {
    const s1 = normalizeForMatch(a);
    const s2 = normalizeForMatch(b);
    if (s1.length === 0 || s2.length === 0) return 0;

    let maxLen = 0;
    for (let i = 0; i < s1.length; i++) {
        for (let j = 0; j < s2.length; j++) {
            let k = 0;
            while (i + k < s1.length && j + k < s2.length && s1[i + k] === s2[j + k]) k++;
            if (k > maxLen) maxLen = k;
        }
    }
    return maxLen / Math.max(s1.length, s2.length);
}

export function findBestProductMatch(
    items: InventoryRecord[],
    query: string
): InventoryRecord | null {
    if (!query || items.length === 0) return null;

    const normalizedQuery = normalizeForMatch(query);
    if (!normalizedQuery) return null;

    // 1. Exact normalized match
    const exact = items.find(i => normalizeForMatch(i.itemName) === normalizedQuery);
    if (exact) return exact;

    // 2. Contains match (query inside product name)
    const contains = items.find(i => normalizeForMatch(i.itemName).includes(normalizedQuery));
    if (contains) return contains;

    // 3. Reverse contains (product name inside query)
    const reverseContains = items.find(i => normalizedQuery.includes(normalizeForMatch(i.itemName)));
    if (reverseContains) return reverseContains;

    // 4. Token overlap + fuzzy scoring
    const scored: ProductMatchResult[] = items.map(item => {
        const overlap = tokenOverlap(query, item.itemName);
        const similarity = simpleSimilarity(query, item.itemName);
        const score = Math.max(overlap, similarity);
        return { product: item, score, matchType: overlap >= similarity ? 'token_overlap' as const : 'fuzzy' as const };
    }).filter(r => r.score >= 0.4)
      .sort((a, b) => b.score - a.score);

    // If best match is strong enough and clearly ahead
    if (scored.length === 1 && scored[0].score >= 0.4) {
        return scored[0].product;
    }
    if (scored.length >= 2 && scored[0].score >= 0.5 && scored[0].score - scored[1].score >= 0.15) {
        return scored[0].product;
    }

    // Multiple close matches or low confidence → return null for disambiguation
    // NEVER default to items[0], that could sell the wrong product
    return null;
}
