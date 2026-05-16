/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — AI Broadcast Campaigns API
 * ═══════════════════════════════════════════════════════════════
 * Sends a marketing blast to a list of phone numbers using the
 * ghostagent_promotional_blast WhatsApp template.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getWorkspaceWhatsAppCreds, notifyPromotionalBlast } from '@/lib/whatsapp/notifications';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { workspaceId, phones, messageBody } = await req.json();

        if (!workspaceId || !phones || !Array.isArray(phones) || phones.length === 0 || !messageBody) {
            return NextResponse.json({ error: 'Missing workspaceId, phones, or messageBody' }, { status: 400 });
        }

        const creds = await getWorkspaceWhatsAppCreds(supabase, workspaceId);
        if (!creds) {
            return NextResponse.json({ error: 'WhatsApp credentials not found for workspace' }, { status: 400 });
        }

        let sentCount = 0;
        let failedCount = 0;

        for (const phone of phones) {
            try {
                // Ensure phone has no spaces or + signs, just digits
                const cleanPhone = phone.replace(/\D/g, '');
                if (!cleanPhone) {
                    failedCount++;
                    continue;
                }

                await notifyPromotionalBlast(creds, cleanPhone, messageBody);
                sentCount++;
                
                // Sleep slightly to respect rate limits if list is large
                await new Promise(r => setTimeout(r, 100));
            } catch (err) {
                console.error(`Failed to send blast to ${phone}:`, err);
                failedCount++;
            }
        }

        // Log the blast
        await supabase.from('activity_log').insert({
            user_id: user.id,
            workspace_id: workspaceId,
            event_type: 'MARKETING_BLAST_SENT',
            description: `Sent marketing blast to ${sentCount} customers`,
            timestamp: new Date().toISOString(),
            metadata: {
                sent_count: sentCount,
                failed_count: failedCount,
                message: messageBody,
            },
        });

        return NextResponse.json({
            success: true,
            sentCount,
            failedCount
        });

    } catch (e: any) {
        console.error('❌ [Marketing Blast] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
