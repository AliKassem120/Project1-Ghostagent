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
import { createBookingFlow, republishBookingFlow } from '@/lib/whatsapp/flows';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { workspaceId, republishFlow } = await req.json();
        if (!workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });

        // Fetch workspace WA credentials
        const { data: ws } = await supabase
            .from('ai_settings')
            .select('whatsapp_business_account_id, whatsapp_access_token, whatsapp_phone_number_id, whatsapp_booking_flow_id, business_type')
            .eq('id', workspaceId)
            .maybeSingle();

        const { data: workspace } = await supabase
            .from('workspaces')
            .select('business_type')
            .eq('id', workspaceId)
            .maybeSingle();

        const wabaId = ws?.whatsapp_business_account_id || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        const token = ws?.whatsapp_access_token || process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;

        if (!wabaId || !token) {
            return NextResponse.json({ error: 'WhatsApp Business Account not connected. Please connect WhatsApp first or enter credentials in Advanced Config.' }, { status: 400 });
        }

        const businessType = ws?.business_type || workspace?.business_type || 'ecommerce';

        // ── 1. Provision Message Templates ──
        const existingTemplates = await listExistingTemplates(wabaId, token);
        const templateResults = await provisionAllTemplates(wabaId, token, businessType as any);

        // ── 2. Create Booking Flow (Appointments Only) ──
        let flowResult: any = { skipped: true, reason: 'No WABA ID' };
        const isAppointmentBiz = businessType === 'appointments';

        if (wabaId && isAppointmentBiz) {
            // Skipped because the user cannot publish it yet (new number needs warm-up messages first)
            flowResult = {
                success: false,
                skipped: true,
                reason: 'WhatsApp Flows are coming soon (your number needs higher messaging volume before publishing flows).'
            };
        } else if (wabaId) {
            flowResult = { skipped: true, reason: 'Flows are only supported/needed for Appointments workspaces. E-Commerce uses native WhatsApp Catalogs/Carts.' };
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
