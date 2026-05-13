import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const { accountId, workspaceId } = await req.json();

        if (!accountId || !workspaceId) {
            return NextResponse.json({ error: 'Missing accountId or workspaceId' }, { status: 400 });
        }

        const supabase = await createClient(); // Use server client to respect RLS or check session
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only delete if it belongs to the user and the workspace
        const { error } = await supabase
            .from('instagram_integrations')
            .delete()
            .eq('instagram_account_id', accountId)
            .eq('workspace_id', workspaceId);

        if (error) throw error;

        // Check if any other Instagram accounts are connected
        const { count: igCount } = await supabase
            .from('instagram_integrations')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId);

        // Check if WhatsApp is connected
        const { data: settings } = await supabase
            .from('ai_settings')
            .select('whatsapp_phone_number_id')
            .eq('id', workspaceId)
            .single();

        let autopilotDisabled = false;
        if (igCount === 0 && !settings?.whatsapp_phone_number_id) {
            // Turn off autopilot since no channels are connected
            await supabase
                .from('ai_settings')
                .update({ is_autopilot_enabled: false })
                .eq('id', workspaceId);
            autopilotDisabled = true;
        }

        return NextResponse.json({ success: true, autopilotDisabled });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
