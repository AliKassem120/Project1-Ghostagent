// ═══════════════════════════════════════════════════════════════
// 📦 GHOST AGENT — Message Batching (Debounce) Engine
// Solves the "machine gun" problem where users send multiple
// rapid messages and each triggers a separate AI response.
// ═══════════════════════════════════════════════════════════════

const DEBOUNCE_DELAY_MS = 5000; // 5 second window

/**
 * Saves an incoming message as 'pending' in the messages table.
 * Returns the message ID for tracking.
 */
export async function savePendingMessage(
    supabase: any,
    ownerId: string,
    senderId: string,
    messageText: string,
    platform: string = 'instagram'
): Promise<string> {
    const { data, error } = await supabase
        .from('messages')
        .insert({
            owner_id: ownerId,
            sender_id: senderId,
            message_text: messageText,
            platform,
            status: 'pending',
        })
        .select('id')
        .single();

    if (error) {
        console.error('❌ Failed to save pending message:', error);
        throw error;
    }

    console.log(`📥 Message saved as pending: ${data.id}`);
    return data.id;
}

/**
 * Waits for the debounce window, then checks if a newer pending
 * message exists. Returns null if this webhook should defer.
 * Returns the concatenated batch if this is the latest message.
 */
export async function waitAndBatchMessages(
    supabase: any,
    ownerId: string,
    senderId: string,
    currentMessageId: string
): Promise<string | null> {
    // 1. Wait for the debounce window
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_DELAY_MS));

    // 2. Check if a NEWER pending message exists for this sender
    const { data: newerMessages } = await supabase
        .from('messages')
        .select('id, created_at')
        .eq('owner_id', ownerId)
        .eq('sender_id', senderId)
        .eq('status', 'pending')
        .gt('created_at', await getMessageTimestamp(supabase, currentMessageId))
        .order('created_at', { ascending: false })
        .limit(1);

    if (newerMessages && newerMessages.length > 0) {
        // A newer message exists — this webhook should defer
        console.log(`⏳ Deferring to newer message: ${newerMessages[0].id}`);
        return null;
    }

    // 3. This is the latest message — fetch ALL pending messages for this sender
    const { data: pendingMessages, error } = await supabase
        .from('messages')
        .select('id, message_text, created_at')
        .eq('owner_id', ownerId)
        .eq('sender_id', senderId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (error || !pendingMessages?.length) {
        console.error('❌ Failed to fetch pending messages:', error);
        return null;
    }

    // 4. Concatenate all pending messages into a single string
    const batchedMessage = pendingMessages
        .map((m: { message_text: string }) => m.message_text)
        .join('\n');

    // 5. Mark all as 'processed'
    const messageIds = pendingMessages.map((m: { id: string }) => m.id);
    await supabase
        .from('messages')
        .update({ status: 'processed' })
        .in('id', messageIds);

    console.log(`📦 Batched ${pendingMessages.length} messages into one: "${batchedMessage.slice(0, 100)}..."`);
    return batchedMessage;
}

/**
 * Helper to get the created_at timestamp of a specific message.
 */
async function getMessageTimestamp(supabase: any, messageId: string): Promise<string> {
    const { data } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', messageId)
        .single();

    return data?.created_at || new Date().toISOString();
}
