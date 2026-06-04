/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Catalog Sync API
 * ═══════════════════════════════════════════════════════════════
 * Syncs all workspace inventory products to Meta Commerce Catalog.
 * Called from the dashboard or automatically after product changes.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { syncAllInventory } from '@/lib/whatsapp/catalog';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let workspaceId: string | undefined;
        try {
            const body = await req.json();
            workspaceId = body?.workspaceId;
        } catch (e) {
            // empty body or invalid JSON
        }
        if (!workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });

        // Get catalog ID and token
        const { data: ws } = await supabase
            .from('ai_settings')
            .select('whatsapp_catalog_id, whatsapp_access_token')
            .eq('id', workspaceId)
            .maybeSingle();

        const catalogId = ws?.whatsapp_catalog_id || process.env.WHATSAPP_CATALOG_ID;
        const token = ws?.whatsapp_access_token || process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;

        if (!catalogId || !token) {
            return NextResponse.json({ error: 'No WhatsApp catalog connected. Set up a catalog in Meta Commerce Manager first.' }, { status: 400 });
        }

        const results = await syncAllInventory(supabase, workspaceId, catalogId, token);

        return NextResponse.json(results);
    } catch (e: any) {
        console.error('❌ [Catalog Sync] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
