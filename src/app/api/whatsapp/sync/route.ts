/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — WhatsApp Sync (Templates + Flows)
 * ═══════════════════════════════════════════════════════════════
 * One-click endpoint to provision all WhatsApp templates AND
 * create the native booking Flow, saving the flow_id to DB.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { provisionAllTemplates, listExistingTemplates } from '@/lib/whatsapp/templates';
import { createBookingFlow } from '@/lib/whatsapp/flows';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { workspaceId } = await req.json();
        if (!workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });

        // Fetch workspace WA credentials
        const { data: ws } = await supabase
            .from('ai_settings')
            .select('whatsapp_business_account_id, whatsapp_access_token, whatsapp_phone_number_id')
            .eq('id', workspaceId)
            .maybeSingle();

        const wabaId = ws?.whatsapp_business_account_id || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        const token = ws?.whatsapp_access_token || process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;

        if (!wabaId || !token) {
            return NextResponse.json({ error: 'WhatsApp Business Account not connected. Please connect WhatsApp first or enter credentials in Advanced Config.' }, { status: 400 });
        }

        // ── 1. Provision Message Templates ──
        const existingTemplates = await listExistingTemplates(wabaId, token);
        const templateResults = await provisionAllTemplates(wabaId, token);

        // ── 2. Create Booking Flow ──
        let flowResult: any = { skipped: true, reason: 'No WABA ID' };
        if (wabaId) {
            flowResult = await createBookingFlow(wabaId, token);

            // Save the flow_id to DB if created successfully
            if (flowResult.success && flowResult.flowId) {
                await supabase
                    .from('ai_settings')
                    .update({ whatsapp_booking_flow_id: flowResult.flowId })
                    .eq('id', workspaceId);
            }
        }

        // ── 3. Re-fetch template statuses ──
        const updatedTemplates = await listExistingTemplates(wabaId, token);

        return NextResponse.json({
            success: true,
            templates: {
                before: existingTemplates.map((t: any) => t.name),
                results: templateResults,
                current: updatedTemplates,
            },
            flow: flowResult,
        });

    } catch (e: any) {
        console.error('❌ [WhatsApp Sync] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// GET — Fetch current template statuses
export async function GET(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const url = new URL(req.url);
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });

        const { data: ws } = await supabase
            .from('ai_settings')
            .select('whatsapp_business_account_id, whatsapp_access_token, whatsapp_booking_flow_id')
            .eq('id', workspaceId)
            .maybeSingle();

        const wabaId = ws?.whatsapp_business_account_id || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        const token = ws?.whatsapp_access_token || process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;

        if (!wabaId || !token) {
            return NextResponse.json({ templates: [], flowId: null });
        }

        const templates = await listExistingTemplates(wabaId, token);

        return NextResponse.json({
            templates,
            flowId: ws?.whatsapp_booking_flow_id || null,
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
