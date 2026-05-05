import { describe, it, expect } from 'vitest';
import { buildConversations } from '../dashboard/inbox-utils';

describe('Inbox Conversation Builder', () => {
    it('INCOMING_COMMENT does not create normal Inbox conversation', () => {
        const logs = [{
            id: '1',
            event_type: 'INCOMING_COMMENT',
            metadata: { chat_id: '123' },
            timestamp: new Date().toISOString(),
            description: 'Comment from @user'
        }];
        const convos = buildConversations(logs, {});
        expect(convos).toHaveLength(0);
    });

    it('COMMENT_REPLY does not create normal Inbox conversation', () => {
        const logs = [{
            id: '1',
            event_type: 'COMMENT_REPLY',
            metadata: { chat_id: '123' },
            timestamp: new Date().toISOString(),
            description: 'Replied to comment'
        }];
        const convos = buildConversations(logs, {});
        expect(convos).toHaveLength(0);
    });

    it('DRAFT_COMMENT_REPLY does not create normal Inbox conversation', () => {
        const logs = [{
            id: '1',
            event_type: 'DRAFT_COMMENT_REPLY',
            metadata: { chat_id: '123' },
            timestamp: new Date().toISOString(),
            description: 'Draft reply to comment'
        }];
        const convos = buildConversations(logs, {});
        expect(convos).toHaveLength(0);
    });

    it('AI_REPLY without prior incoming DM/message does not create fake "User" chat', () => {
        const logs = [{
            id: '1',
            event_type: 'AI_REPLY',
            metadata: { chat_id: '123' },
            timestamp: new Date().toISOString(),
            description: 'Sent: "Hello"'
        }];
        const convos = buildConversations(logs, {});
        expect(convos).toHaveLength(0);
    });

    it('AI_REPLY with prior incoming message attaches to conversation', () => {
        const logs = [{
            id: '1',
            event_type: 'INCOMING_DM',
            metadata: { chat_id: '123' },
            timestamp: new Date(Date.now() - 1000).toISOString(),
            description: 'Received: "Hi" from user123'
        }, {
            id: '2',
            event_type: 'AI_REPLY',
            metadata: { chat_id: '123' },
            timestamp: new Date().toISOString(),
            description: 'Sent: "Hello"'
        }];
        const convos = buildConversations(logs, {});
        expect(convos).toHaveLength(1);
        expect(convos[0].messages).toHaveLength(2);
    });

    it('Real INCOMING_MESSAGE with username shows that username', () => {
        const logs = [{
            id: '1',
            event_type: 'INCOMING_MESSAGE',
            metadata: { chat_id: '123', username: 'john_doe' },
            timestamp: new Date().toISOString(),
            description: 'Received: "Hello"'
        }];
        const convos = buildConversations(logs, {});
        expect(convos).toHaveLength(1);
        expect(convos[0].username).toBe('john_doe');
    });

    it('WhatsApp thread shows phone/name, not generic "User"', () => {
        const logs = [{
            id: '1',
            event_type: 'INCOMING_MESSAGE',
            metadata: { chat_id: '+1234567890', platform: 'whatsapp', profile_name: 'Jane Doe' },
            timestamp: new Date().toISOString(),
            description: 'Received: "Hello"'
        }];
        const convos = buildConversations(logs, {});
        expect(convos).toHaveLength(1);
        expect(convos[0].username).toBe('Jane Doe');
        
        // Fallback to phone number if no name
        const logs2 = [{
            id: '2',
            event_type: 'INCOMING_MESSAGE',
            metadata: { chat_id: '+0987654321', platform: 'whatsapp' },
            timestamp: new Date().toISOString(),
            description: 'Received: "Hello"'
        }];
        const convos2 = buildConversations(logs2, {});
        expect(convos2).toHaveLength(1);
        expect(convos2[0].username).toBe('WhatsApp User (+0987654321)');
    });
});
