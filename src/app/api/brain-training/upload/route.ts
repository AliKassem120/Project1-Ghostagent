import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const ownerName = formData.get('ownerName') as string;
        const workspaceId = formData.get('workspaceId') as string;

        if (!file || !ownerName || !workspaceId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const text = await file.text();
        const lines = text.split('\n');
        
        // Parse lines
        const messages: { sender: string, text: string }[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;
            
            // Remove unicode left-to-right marks common in WhatsApp exports
            line = line.replace(/[\u200E\u200F]/g, '');
            
            const match = line.match(/^\[?(?:\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4}[, ]+\d{1,2}:\d{2}(?::\d{2})?(?: [AP]M)?)\]?\s*[-:]?\s*([^:]+):\s*(.*)$/);
            
            if (match) {
                messages.push({ sender: match[1].trim(), text: match[2].trim() });
            } else if (messages.length > 0) {
                // Append multiline to previous
                messages[messages.length - 1].text += '\n' + line;
            }
        }
        
        // Group into QA pairs: Customer -> Owner
        const pairs: { customer: string, owner: string }[] = [];
        let lastCustomerMsg = '';
        
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            
            // Exclude system messages
            if (msg.text.includes('Messages and calls are end-to-end encrypted') || msg.text.includes('omitted')) {
                continue;
            }

            if (msg.sender === ownerName) {
                if (lastCustomerMsg) {
                    if (pairs.length > 0 && pairs[pairs.length - 1].customer === lastCustomerMsg) {
                        pairs[pairs.length - 1].owner += ' ' + msg.text;
                    } else {
                        pairs.push({ customer: lastCustomerMsg, owner: msg.text });
                    }
                }
            } else {
                if (i > 0 && messages[i-1].sender === msg.sender) {
                    lastCustomerMsg += ' ' + msg.text;
                } else {
                    lastCustomerMsg = msg.text;
                }
            }
        }
        
        if (pairs.length > 0) {
            const { error } = await supabase.from('business_training_data').insert(
                pairs.map(p => ({
                    workspace_id: workspaceId,
                    source: 'manual_upload',
                    customer_message: p.customer,
                    owner_reply: p.owner
                }))
            );
            if (error) {
                console.error(error);
                return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }
        }
        
        return NextResponse.json({ success: true, count: pairs.length });
    } catch (e: any) {
        console.error('Upload error:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
