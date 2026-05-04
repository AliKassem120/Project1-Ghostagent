import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGodModeAccess } from '@/lib/god-mode/auth';
import { handleAutomationMessage } from '@/lib/automation-v2';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const sb = getAdmin();
    const body = await req.json();
    const { workspaceId, message, platform = 'instagram' } = body;

    if (!workspaceId || !message) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    try {
        // Fetch business type to determine the simulation context
        const { data: settings } = await sb
            .from('ai_settings')
            .select('business_type, user_id')
            .eq('id', workspaceId)
            .maybeSingle();

        if (!settings) {
            return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
        }

        // Use a simulation chat ID so it doesn't pollute real chats
        const simChatId = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const result = await handleAutomationMessage({
            workspaceId,
            workspaceType: settings.business_type as 'appointments' | 'ecommerce',
            chatId: simChatId,
            message,
            platform,
            supabase: sb,
            userId: settings.user_id,
        });

        // Fetch the conversation state after the message to see what the FSM saved
        const { data: stateData } = await sb
            .from('conversation_state')
            .select('*')
            .eq('chat_id', simChatId)
            .maybeSingle();

        return NextResponse.json({ 
            success: true, 
            result,
            stateAfter: stateData || null,
            simChatId 
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
