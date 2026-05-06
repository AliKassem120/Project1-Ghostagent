// ═══════════════════════════════════════════════════════════════
// 📦 GHOST AGENT — DM Debounce Engine v3 (Upsert Buffer)
//
// Replaces the old sleep+lock approach with an upsert-based buffer.
//
// Design:
//   1. On each incoming DM, UPSERT a single row in `dm_buffer` keyed
//      by (owner_id, sender_id, channel). Append the message text and
//      push reply_at forward by DEBOUNCE_SECONDS.
//
//   2. Schedule processDmBuffer() to run after DEBOUNCE_SECONDS.
//
//   3. When the timer fires, processDmBuffer() checks:
//      - Is reply_at still in the past? (no newer message)
//      - Is the row still 'waiting' and not locked by another invocation?
//      If yes → atomically claim → generate AI reply → send → delete buffer.
//      If no  → exit. A later timer (from the newer message) will handle it.
//
// This eliminates all race conditions because there is only ONE row per
// sender, and the claim is a single atomic UPDATE with WHERE guards.
// ═══════════════════════════════════════════════════════════════

export const DEBOUNCE_SECONDS = 5;
const LOCK_TTL_SECONDS = 60;

export interface DmBufferParams {
    supabase: any;
    ownerId: string;
    senderId: string;
    workspaceId: string | null;
    messageText: string;
    channel?: string;
}

function withWorkspaceFilter(query: any, workspaceId: string | null) {
    return workspaceId
        ? query.eq('workspace_id', workspaceId)
        : query.is('workspace_id', null);
}

/**
 * Upsert the dm_buffer row for this sender.
 * If a row already exists, appends the new message and resets the reply_at timer.
 * Returns the reply_at timestamp so the caller can schedule the processor.
 */
export async function upsertDmBuffer({
    supabase,
    ownerId,
    senderId,
    workspaceId,
    messageText,
    channel = 'instagram',
}: DmBufferParams): Promise<string> {
    const replyAt = new Date(Date.now() + DEBOUNCE_SECONDS * 1000).toISOString();
    const now = new Date().toISOString();

    // Try to get existing buffer row first
    const { data: existing } = await withWorkspaceFilter(
        supabase
            .from('dm_buffer')
            .select('id, buffered_text')
            .eq('owner_id', ownerId)
            .eq('sender_id', senderId)
            .eq('channel', channel),
        workspaceId
    ).maybeSingle();

    if (existing) {
        // Append message to existing buffer and push reply_at forward
        const combinedText = existing.buffered_text
            ? `${existing.buffered_text}\n${messageText}`
            : messageText;

        const { error: updateErr } = await supabase
            .from('dm_buffer')
            .update({
                buffered_text: combinedText,
                reply_at: replyAt,
                status: 'waiting',
                workspace_id: workspaceId,
                lock_expires_at: null, // Release any stale lock
                updated_at: now,
            })
            .eq('id', existing.id);

        if (updateErr) {
            console.error('❌ [Buffer] Failed to update dm_buffer row:', updateErr);
            throw updateErr;
        }

        console.log(`📨 [Buffer] Appended to existing buffer for sender ${senderId}. reply_at: ${replyAt}`);
    } else {
        // Create new buffer row
        const { error } = await supabase
            .from('dm_buffer')
            .insert({
                owner_id: ownerId,
                sender_id: senderId,
                workspace_id: workspaceId,
                channel,
                buffered_text: messageText,
                reply_at: replyAt,
                status: 'waiting',
                lock_expires_at: null,
                created_at: now,
                updated_at: now,
            });

        if (error) {
            // Handle race condition: another webhook fired at the exact same time
            // and inserted first. Retry as an update (append) instead.
            if (error.code === '23505') {
                console.log(`🔄 [Buffer] Race condition caught for sender ${senderId}. Retrying as update...`);
                let { data: raceRow } = await withWorkspaceFilter(
                    supabase
                        .from('dm_buffer')
                        .select('id, buffered_text')
                        .eq('owner_id', ownerId)
                        .eq('sender_id', senderId)
                        .eq('channel', channel),
                    workspaceId
                ).maybeSingle();

                if (!raceRow) {
                    const unscoped = await supabase
                        .from('dm_buffer')
                        .select('id, buffered_text')
                        .eq('owner_id', ownerId)
                        .eq('sender_id', senderId)
                        .eq('channel', channel)
                        .maybeSingle();
                    raceRow = unscoped.data;
                }

                if (raceRow) {
                    const combined = raceRow.buffered_text
                        ? `${raceRow.buffered_text}\n${messageText}`
                        : messageText;
                    await supabase
                        .from('dm_buffer')
                        .update({ buffered_text: combined, workspace_id: workspaceId, reply_at: replyAt, status: 'waiting', lock_expires_at: null, updated_at: now })
                        .eq('id', raceRow.id);
                    console.log(`📨 [Buffer] Race resolved — appended to existing buffer for sender ${senderId}.`);
                }
            } else {
                console.error('❌ [Buffer] Failed to insert dm_buffer row:', error);
                throw error;
            }
        } else {
            console.log(`📨 [Buffer] Created new buffer for sender ${senderId}. reply_at: ${replyAt}`);
        }
    }

    return replyAt;
}

/**
 * Attempt to claim and process the buffered messages for a sender.
 * Must be called AFTER reply_at has passed (e.g. via setTimeout).
 *
 * Returns the buffered text if claimed, null if another invocation won or
 * the buffer was already processed / pushed forward.
 */
export async function claimDmBuffer(
    supabase: any,
    ownerId: string,
    senderId: string,
    scheduledReplyAt: string,
    channel = 'instagram',
    workspaceId: string | null = null,
): Promise<{ text: string; workspaceId: string | null } | null> {
    // Call the Postgres RPC function to atomically claim the buffer
    // This bypasses PostgREST .or() URL filter limitations and ensures
    // the query executes fully-qualified as public.dm_buffer in Postgres.
    let { data: claimedRows, error } = await supabase
        .rpc('claim_dm_buffer', {
            p_owner_id: ownerId,
            p_sender_id: senderId,
            p_channel: channel,
            p_workspace_id: workspaceId,
            p_scheduled_reply_at: scheduledReplyAt,
            p_lock_ttl_seconds: LOCK_TTL_SECONDS
        });

    if (error) {
        const fallback = await supabase
            .rpc('claim_dm_buffer', {
                p_owner_id: ownerId,
                p_sender_id: senderId,
                p_channel: channel,
                p_scheduled_reply_at: scheduledReplyAt,
                p_lock_ttl_seconds: LOCK_TTL_SECONDS
            });
        claimedRows = fallback.data;
        error = fallback.error;
    }

    const claimed = claimedRows?.[0];

    if (error) {
        console.error('❌ [Buffer] Claim error:', error);
        return null;
    }

    if (!claimed) {
        console.log(`⏳ [Buffer] Claim failed for sender ${senderId} — newer message or already processing.`);
        return null;
    }

    console.log(`🔒 [Buffer] Claimed buffer for sender ${senderId}. Processing ${claimed.buffered_text.length} chars.`);
    return { text: claimed.buffered_text, workspaceId: claimed.workspace_id ?? null };
}

/**
 * Delete the dm_buffer row after a successful reply (cleanup).
 */
export async function clearDmBuffer(
    supabase: any,
    ownerId: string,
    senderId: string,
    channel = 'instagram',
    workspaceId: string | null = null,
): Promise<void> {
    await withWorkspaceFilter(
        supabase
            .from('dm_buffer')
            .delete()
            .eq('owner_id', ownerId)
            .eq('sender_id', senderId)
            .eq('channel', channel),
        workspaceId
    );
    console.log(`🗑️ [Buffer] Cleared buffer for sender ${senderId}`);
}

/**
 * Release a lock without deleting (used on failure so lock TTL eventually
 * allows a future retry).
 */
export async function releaseDmBuffer(
    supabase: any,
    ownerId: string,
    senderId: string,
    channel = 'instagram',
    workspaceId: string | null = null,
): Promise<void> {
    await withWorkspaceFilter(
        supabase
            .from('dm_buffer')
            .update({ status: 'waiting', lock_expires_at: null })
            .eq('owner_id', ownerId)
            .eq('sender_id', senderId)
            .eq('channel', channel),
        workspaceId
    );
    console.log(`🔓 [Buffer] Released lock for sender ${senderId}`);
}
