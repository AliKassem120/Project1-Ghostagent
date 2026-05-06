/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { upsertDmBuffer } from '@/utils/dm-debounce';

function createBufferSupabase() {
    let row: any = null;

    function builder() {
        return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
            insert: vi.fn(async (payload: any) => {
                row = { id: 'buffer-1', ...payload };
                return { error: null };
            }),
            update: vi.fn((payload: any) => ({
                eq: vi.fn(async () => {
                    row = { ...row, ...payload };
                    return { error: null };
                }),
            })),
        };
    }

    return {
        from: vi.fn(() => builder()),
        get row() {
            return row;
        },
    } as any;
}

describe('WhatsApp dm_buffer behavior', () => {
    it('combines quick WhatsApp messages before brain processing', async () => {
        const supabase = createBufferSupabase();

        await upsertDmBuffer({
            supabase,
            ownerId: 'owner-1',
            workspaceId: 'ws-1',
            senderId: '96178820707',
            channel: 'whatsapp',
            messageText: 'I want ps5',
        });
        await upsertDmBuffer({
            supabase,
            ownerId: 'owner-1',
            workspaceId: 'ws-1',
            senderId: '96178820707',
            channel: 'whatsapp',
            messageText: 'Ali Kassem',
        });

        expect(supabase.row.buffered_text).toBe('I want ps5\nAli Kassem');
        expect(supabase.row.channel).toBe('whatsapp');
        expect(supabase.row.sender_id).toBe('96178820707');
    });
});
