/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — WhatsApp Catalog Sync
 * ═══════════════════════════════════════════════════════════════
 * Syncs Supabase inventory to Meta Commerce Catalog.
 * Sends native product cards and multi-product messages.
 */

import { sendProductCard, sendProductList, sendList, type WhatsAppCredentials, type ProductSection } from './send';

const WA_API = 'https://graph.facebook.com/v21.0';

// ── Sync Product to Meta Catalog ─────────────────────────────

export async function syncProductToCatalog(
    catalogId: string,
    accessToken: string,
    product: {
        retailerId: string; // your internal product ID
        name: string;
        description: string;
        price: number;
        currency: string;
        imageUrl?: string;
        availability: 'in stock' | 'out of stock';
        category?: string;
    }
) {
    const res = await fetch(`${WA_API}/${catalogId}/products`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            retailer_id: product.retailerId,
            name: product.name,
            description: product.description || product.name,
            price: `${(product.price * 100).toFixed(0)}`,  // Meta uses cents
            currency: product.currency || 'USD',
            availability: product.availability,
            image_url: product.imageUrl || '',
            category: product.category || 'Other',
        }),
    });

    const data = await res.json();
    if (!res.ok) {
        console.error(`❌ [Catalog] Failed to sync product "${product.name}":`, data.error);
        return { success: false, error: data.error?.message };
    }

    return { success: true, productId: data.id };
}

// ── Bulk Sync All Inventory ──────────────────────────────────

export async function syncAllInventory(
    supabase: any,
    workspaceId: string,
    catalogId: string,
    accessToken: string
) {
    const { data: products, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('workspace_id', workspaceId);

    if (error || !products) {
        return { success: false, error: error?.message || 'No products found' };
    }

    const results = [];
    for (const p of products) {
        const result = await syncProductToCatalog(catalogId, accessToken, {
            retailerId: p.id,
            name: p.item_name,
            description: p.description || p.item_name,
            price: p.price,
            currency: 'USD',
            availability: p.stock_level > 0 ? 'in stock' : 'out of stock',
        });
        results.push({ productId: p.id, name: p.item_name, ...result });
        await new Promise(r => setTimeout(r, 300)); // Rate limit
    }

    return {
        success: true,
        synced: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        details: results,
    };
}

// ── Send Product Card (Single Product) ───────────────────────

export async function sendSingleProductCard(
    creds: WhatsAppCredentials,
    to: string,
    catalogId: string,
    productId: string,
    message?: string
) {
    return sendProductCard(creds, to, catalogId, productId, message, 'Powered by GhostAgent');
}

// ── Send Multi-Product List ──────────────────────────────────

export async function sendMultiProductList(
    creds: WhatsAppCredentials,
    to: string,
    catalogId: string,
    products: { id: string; name: string; category?: string }[],
    headerText: string = 'Our Products',
    bodyText: string = 'Check out what we have available:'
) {
    // Group products by category
    const grouped: Record<string, { product_retailer_id: string }[]> = {};
    for (const p of products) {
        const cat = p.category || 'Products';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ product_retailer_id: p.id });
    }

    const sections: ProductSection[] = Object.entries(grouped).map(([title, items]) => ({
        title,
        product_items: items.slice(0, 30), // Max 30 per section
    }));

    return sendProductList(creds, to, catalogId, headerText, bodyText, sections);
}

// ── Fallback: Send as Text List (when no catalog) ────────────

export async function sendProductListAsText(
    creds: WhatsAppCredentials,
    to: string,
    products: { name: string; price: number; inStock: boolean; variants?: string[] }[]
) {
    const inStockProducts = products.filter(p => p.inStock);

    if (inStockProducts.length === 0) {
        return null; // Let the AI handle "out of stock" response
    }

    const sections = [{
        title: 'Available Products',
        rows: inStockProducts.slice(0, 10).map((p, i) => ({
            id: `product_${i}`,
            title: p.name.slice(0, 24),
            description: `$${p.price}${p.variants?.length ? ` • ${p.variants.join(', ')}` : ''}`,
        })),
    }];

    return sendList(
        creds,
        to,
        '🛍️ Here\'s what we have available. Tap an item to order:',
        'View Products',
        sections,
        'Our Products',
        'Tap an item to learn more'
    );
}
