import type { V3BusinessContext, V3ConversationMemory } from './schema';

function summarizeHours(rows: any[]): string {
    if (!rows?.length) return 'Not configured';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return rows
        .map((h) => h.is_open || h.isOpen
            ? `${days[h.day_of_week ?? h.dayOfWeek]} ${h.open_time ?? h.openTime}-${h.close_time ?? h.closeTime}`
            : `${days[h.day_of_week ?? h.dayOfWeek]} closed`)
        .join(', ');
}

export async function loadV3Context(args: {
    supabase: any;
    userId: string;
    workspaceId: string;
    chatId: string;
}): Promise<V3BusinessContext | null> {
    const { supabase, workspaceId, chatId, userId } = args;

    const { data: settings, error: settingsError } = await supabase
        .from('ai_settings')
        .select('id, user_id, business_name, business_type, tone, system_instructions, language, timezone, use_emojis, use_local_slang, store_location, contact_info, shipping_rules')
        .eq('id', workspaceId)
        .maybeSingle();

    if (settingsError || !settings) return null;

    const workspaceType = (settings.business_type || 'ecommerce') as 'ecommerce' | 'appointments';

    const [{ data: inv }, { data: svc }, { data: hours }, { data: state }] = await Promise.all([
        supabase.from('inventory').select('id, item_name, price, stock_level').eq('workspace_id', workspaceId).limit(30),
        supabase.from('services').select('id, name, description, price, duration_minutes, is_active').eq('workspace_id', workspaceId).eq('is_active', true).limit(30),
        supabase.from('business_hours').select('*').eq('workspace_id', workspaceId).order('day_of_week', { ascending: true }),
        supabase.from('conversation_states').select('data').eq('user_id', userId).eq('workspace_id', workspaceId).eq('chat_id', chatId).eq('workspace_type', workspaceType).eq('platform', 'instagram').maybeSingle(),
    ]);

    const memory = ((state?.data as any)?.v3 || {}) as V3ConversationMemory;

    return {
        workspaceId,
        userId: settings.user_id || userId,
        workspaceType,
        businessName: settings.business_name || 'the business',
        tone: settings.tone || 'Professional',
        language: settings.language || 'Auto-Detect',
        timezone: settings.timezone || 'UTC',
        useEmojis: settings.use_emojis ?? true,
        useLocalSlang: settings.use_local_slang ?? false,
        systemInstructions: settings.system_instructions || null,
        storeLocation: settings.store_location || null,
        contactInfo: settings.contact_info || null,
        shippingRules: settings.shipping_rules || null,
        products: (inv || []).map((p: any) => ({
            id: p.id,
            name: p.item_name,
            price: Number(p.price || 0),
            stock: Number(p.stock_level || 0),
            description: null,
        })),
        services: (svc || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            price: Number(s.price || 0),
            durationMinutes: Number(s.duration_minutes || 30),
            description: s.description || null,
        })),
        hoursSummary: summarizeHours(hours || []),
        memory,
    };
}

export async function saveV3Memory(args: {
    supabase: any;
    userId: string;
    workspaceId: string;
    chatId: string;
    workspaceType: 'ecommerce' | 'appointments';
    memory: V3ConversationMemory;
}) {
    const { supabase, userId, workspaceId, chatId, workspaceType, memory } = args;
    await supabase.from('conversation_states').upsert({
        user_id: userId,
        workspace_id: workspaceId,
        chat_id: chatId,
        external_chat_id: chatId,
        workspace_type: workspaceType,
        platform: 'instagram',
        stage: memory.mode === 'ordering'
            ? 'awaiting_order_details'
            : memory.mode === 'booking'
                ? 'awaiting_customer_details'
                : 'idle',
        data: { v3: memory },
        updated_at: new Date().toISOString(),
    }, {
        onConflict: 'user_id,workspace_id,chat_id,workspace_type,platform'
    });
}

export async function clearV3Memory(args: {
    supabase: any;
    userId: string;
    workspaceId: string;
    chatId: string;
    workspaceType: 'ecommerce' | 'appointments';
}) {
    const { supabase, userId, workspaceId, chatId, workspaceType } = args;
    await supabase.from('conversation_states')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .eq('chat_id', chatId)
        .eq('workspace_type', workspaceType)
        .eq('platform', 'instagram');
}
