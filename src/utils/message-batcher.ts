// ═══════════════════════════════════════════════════════════════
// 📦 GHOST AGENT — Message Batching (Debounce) Engine v2
// Solves the "machine gun" problem where users send multiple
// rapid messages and each triggers a separate AI response.
//
// Strategy: DB-level "processing lock" using upsert to prevent
// race conditions between parallel serverless invocations.
// ═══════════════════════════════════════════════════════════════

const DEBOUNCE_DELAY_MS = 2000; // 2 seconds — enough to batch rapid-fire messages


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
 * Waits for the debounce window, then tries to acquire a DB-level
 * processing lock for this sender. Only one invocation will win the
 * lock — the rest will defer. Returns null if this webhook should defer.
 * Returns the concatenated batch if this invocation wins the lock.
 */
export async function waitAndBatchMessages(
    supabase: any,
    ownerId: string,
    senderId: string,
    currentMessageId: string
): Promise<string | null> {
    // 1. Wait for the debounce window
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_DELAY_MS));

    // 2. Try to acquire a DB-level lock using upsert.
    //    Only the LAST invocation should win — we do this by trying to
    //    set ourselves as the 'processor'. If another message arrived
    //    after ours, it will have already claimed the lock.
    const { data: newerMessages } = await supabase
        .from('messages')
        .select('id, created_at')
        .eq('owner_id', ownerId)
        .eq('sender_id', senderId)
        .eq('status', 'pending')
        .gt('created_at', await getMessageTimestamp(supabase, currentMessageId))
        .limit(1);

    if (newerMessages && newerMessages.length > 0) {
        // A newer pending message exists — defer to its handler
        console.log(`⏳ Deferring to newer message: ${newerMessages[0].id}`);
        return null;
    }

    // 3. We are the latest — atomically claim all pending messages
    //    by marking them 'processing' before fetching.
    //    This prevents another concurrent invocation from also claiming them.
    const claimTimestamp = new Date().toISOString();

    const { data: claimedMessages, error: claimError } = await supabase
        .from('messages')
        .update({ status: 'processing', updated_at: claimTimestamp })
        .eq('owner_id', ownerId)
        .eq('sender_id', senderId)
        .eq('status', 'pending')
        .select('id, message_text, created_at');

    if (claimError || !claimedMessages?.length) {
        // Another invocation already claimed them — defer
        console.log('⏳ No pending messages to claim (already taken). Deferring.');
        return null;
    }

    // 4. Sort claimed messages chronologically and concatenate
    const sorted = claimedMessages.sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const batchedMessage = sorted
        .map((m: { message_text: string }) => m.message_text)
        .join('\n');

    // 5. Mark all as 'processed'
    const messageIds = sorted.map((m: { id: string }) => m.id);
    await supabase
        .from('messages')
        .update({ status: 'processed' })
        .in('id', messageIds);

    console.log(`📦 Batched ${sorted.length} message(s) into one: "${batchedMessage.slice(0, 100)}..."`);
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
