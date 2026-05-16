/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Auto-Provision WhatsApp Templates
 * ═══════════════════════════════════════════════════════════════
 * Called after a workspace connects WhatsApp to automatically
 * create all required message templates in their WA Business Account.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { provisionAllTemplates, listExistingTemplates } from '@/lib/whatsapp/templates';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { workspaceId } = await req.json();
        if (!workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });

        // Fetch WA Business Account ID and token
        const { data: ws } = await supabase
            .from('ai_settings')
            .select('whatsapp_business_account_id, whatsapp_access_token')
            .eq('id', workspaceId)
            .maybeSingle();

        const wabaId = ws?.whatsapp_business_account_id || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        const token = ws?.whatsapp_access_token || process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;

        if (!wabaId || !token) {
            return NextResponse.json({ error: 'WhatsApp Business Account not connected' }, { status: 400 });
        }

        // Check existing templates first
        const existing = await listExistingTemplates(wabaId, token);
        const existingNames = existing.map((t: any) => t.name);

        // Provision all missing templates
        const results = await provisionAllTemplates(wabaId, token);

        return NextResponse.json({
            success: true,
            existingBefore: existingNames,
            provisionResults: results,
        });

    } catch (e: any) {
        console.error('❌ [Provision] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
