type Message = {
    id: string;
    text: string;
    sender: string;
    is_sender: boolean;
    is_bot: boolean;
    is_manual: boolean;
    timestamp: string;
    type: string;
};

type Conversation = {
    chat_id: string;
    username: string;
    lastMessage: string;
    timestamp: string;
    messages: Message[];
    account_id?: string;
    isComment?: boolean;
    platform?: 'instagram' | 'whatsapp';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildConversations(logs: any[], fetchedProfiles: Record<string, string>): Conversation[] {
    const threads: Record<string, Conversation> = {};

    logs.forEach(log => {
        const meta = log.metadata || {};
        const chatId = meta.chat_id || meta.chatId || 'unknown';

        // 🛑 Strict Event Filtering: Only process actual conversations
        const allowedEvents = ['INCOMING_DM', 'INCOMING_MESSAGE', 'AI_REPLY', 'DRAFT_REPLY', 'MANUAL_REPLY', 'COMMENT_REPLY', 'DRAFT_COMMENT_REPLY'];
        if (!allowedEvents.includes(log.event_type)) return;

        if (log.event_type === 'INCOMING_DM' && log.description.includes('ghostagent.qzz.io')) return;

        // Hide public-only comment replies, but keep those that sent a private DM
        if (log.event_type === 'COMMENT_REPLY' || log.event_type === 'DRAFT_COMMENT_REPLY') {
            const replyStyle = meta.reply_style || '';
            const source = meta.source || '';
            const isPrivateDm = replyStyle.includes('dm') || replyStyle === 'both' || source === 'comment_private_reply' || meta.private_dm_text;
            if (!isPrivateDm) return; // Ignore public-only comment replies
        }

        // Orphan check: If this is an outgoing message (AI, DRAFT, MANUAL) and we haven't seen an incoming message for this chat yet, ignore it.
        // We do NOT ignore COMMENT_REPLY/DRAFT_COMMENT_REPLY here because the business did send a DM to that person, creating a thread.
        if (['AI_REPLY', 'DRAFT_REPLY', 'MANUAL_REPLY'].includes(log.event_type)) {
            if (!threads[chatId]) return;
        }

        // Strip out legacy 'V3 sent:' prefixes
        let rawDescription = log.description || '';
        rawDescription = rawDescription.replace(/^(V[1-3]\s+sent:\s*)/i, 'Sent: ');

        let text = rawDescription;
        const isBot = log.event_type === 'AI_REPLY' || log.event_type === 'COMMENT_REPLY';
        const isDraft = log.event_type === 'DRAFT_REPLY' || log.event_type === 'DRAFT_COMMENT_REPLY';
        const isManual = log.event_type === 'MANUAL_REPLY' || (meta.is_sender && !isBot && !isDraft);
        const isComment = false; // They are private DMs now, so treat them as normal messages.
        let senderName = 'Unknown';

        // Extract Sender Name & Text
        if (log.event_type === 'INCOMING_DM') {
            if (meta.sender && meta.sender.attendee_name) {
                senderName = meta.sender.attendee_name;
            } else if (meta.username && meta.username !== 'You') {
                senderName = meta.username;
            } else if (meta.commenter_name) {
                senderName = `@${meta.commenter_name}`;
            } else {
                const parts = rawDescription.split('from');
                senderName = parts[parts.length - 1]?.trim() || 'Instagram User';
            }
            text = text.replace(/^Received: "(.*)" from .*$/, '$1').replace(/"/g, '').trim();
        } else if (log.event_type === 'INCOMING_MESSAGE') {
            // Handling for standard meta messenger webhooks if they use this type
            if (meta.profile_name) {
                senderName = meta.profile_name;
            } else if (meta.sender_name) {
                senderName = meta.sender_name;
            } else if (meta.username && meta.username !== 'You') {
                senderName = meta.username;
            } else if (meta.platform === 'whatsapp') {
                senderName = `WhatsApp User (${chatId})`;
            } else {
                senderName = 'User';
            }
            text = text.replace(/^.*: "(.*)"$/, '$1').replace(/"/g, '').trim();
        } else if (isBot) {
            senderName = 'Ghost AI';
            text = text.replace(/^(Sent|Replied to @.*): "(.*)"$/, '$2').replace(/"/g, '').trim();
            if ((log.event_type === 'COMMENT_REPLY' || log.event_type === 'DRAFT_COMMENT_REPLY') && meta.private_dm_text) {
                text = meta.private_dm_text;
            }
        } else if (isDraft) {
            senderName = 'Ghost AI (Draft)';
            text = text.replace(/^Draft( Comment Reply)?: "(.*)"$/, '$2').replace(/"/g, '').trim();
            if ((log.event_type === 'COMMENT_REPLY' || log.event_type === 'DRAFT_COMMENT_REPLY') && meta.private_dm_text) {
                text = meta.private_dm_text;
            }
        } else if (isManual) {
            senderName = 'You';
            text = text.replace(/^Sent \(Manual\): "(.*)"$/, '$1').replace(/"/g, '').trim();
        }

        // Cleanup text quotes if regex didn't catch
        if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);

        if (!threads[chatId]) {
            let defaultName = senderName !== 'Unknown' ? senderName : 'User';
            if (defaultName === 'User' || defaultName === 'Unknown') {
                defaultName = meta.platform === 'whatsapp' ? `WhatsApp User (${chatId})` : 'Instagram User';
            }
            threads[chatId] = {
                chat_id: chatId,
                username: defaultName, // Initial name
                lastMessage: text,
                timestamp: log.timestamp,
                messages: [],
                account_id: meta.account_id, // Capture account_id if available
                isComment: isComment, // Add flag
                platform: meta.platform === 'whatsapp' ? 'whatsapp' : 'instagram',
            };
        }

        // Capture account_id if missing and available in this log
        if (!threads[chatId].account_id && meta.account_id) {
            threads[chatId].account_id = meta.account_id;
        }

        // Update Username Logic (Prioritize Customer Name)
        const currentName = threads[chatId].username;
        const isGenericName = currentName === 'User' || currentName === 'You' || currentName === 'Ghost AI' || currentName === 'Unknown' || currentName.startsWith('User ');
        const isNewSenderGeneric = senderName === 'User' || senderName === 'You' || senderName === 'Ghost AI' || senderName === 'Unknown' || senderName.startsWith('User ');

        // 1. First priority: fetched profile name from instagram
        if (fetchedProfiles[chatId] && fetchedProfiles[chatId] !== 'Instagram User' && fetchedProfiles[chatId] !== 'Unknown' && !fetchedProfiles[chatId].startsWith('Loading')) {
            threads[chatId].username = fetchedProfiles[chatId];
        } 
        // 2. Second priority: metadata
        else if (meta.sender?.attendee_name) {
            threads[chatId].username = meta.sender.attendee_name;
        } else if (meta.profile_name) {
            threads[chatId].username = meta.profile_name;
        } else if (meta.sender_name) {
            threads[chatId].username = meta.sender_name;
        } else if (meta.username && meta.username !== 'You' && !String(meta.username).startsWith('User ')) {
            threads[chatId].username = meta.username;
        } else if (meta.commenter_name) {
            threads[chatId].username = `@${meta.commenter_name}`;
        } else if (meta.platform === 'whatsapp' && (isGenericName || currentName === 'Instagram User')) {
            threads[chatId].username = `WhatsApp User (${chatId})`;
        }
        // 3. Fallback
        else if (isGenericName && !isNewSenderGeneric) {
            threads[chatId].username = senderName;
        }

        threads[chatId].messages.push({
            id: log.id,
            text,
            sender: senderName,
            is_sender: isBot || isManual || isDraft,
            is_bot: isBot,
            is_manual: isManual,
            timestamp: log.timestamp,
            type: log.event_type
        });

        threads[chatId].lastMessage = text;
        threads[chatId].timestamp = log.timestamp;
    });

    return Object.values(threads).sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}
