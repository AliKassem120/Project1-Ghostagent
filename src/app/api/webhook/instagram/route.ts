import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';

// Helper to get admin supabase client
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // HARDCODED PASSWORD (To fix the error)
    const MY_SECRET_TOKEN = 'ghost_agent_secret';

    console.log('Verifying:', { mode, token, challenge });

    if (mode === 'subscribe' && token === MY_SECRET_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden - Token Mismatch', { status: 403 });
}

export async function POST(request: NextRequest) {
    console.log(" [DEBUG] /api/webhook/instagram POST HIT");

    try {
        const body = await request.json();

        // Loop through all entries and messaging events
        const entries = body.entry || [];

        for (const entry of entries) {
            const changes = entry.messaging || [];

            for (const event of changes) {
                console.log('Processing event:', JSON.stringify(event));

                // 🛑 SAFETY CHECK: Filter out read receipts, deliveries, or non-text events
                // If event.message is undefined, attempting to access event.message.text would normally crash if not checked carefuly,
                // but here !event.message catches it first.
                if (!event.message || !event.message.text) {
                    console.log('Received non-message event (read receipt/delivery). Returning OK.');
                    return NextResponse.json({ status: 'ok' });
                }

                // If we are here, it is a valid text message
                const senderId = event.sender.id;
                const messageText = event.message.text;

                console.log(`Received Message from ${senderId}: ${messageText}`);

                // 2. Identify Owner
                const supabaseAdmin = getSupabaseAdmin();
                const { data: inventoryUser } = await supabaseAdmin.from('inventory').select('user_id').limit(1).single();
                const ownerId = inventoryUser?.user_id;

                if (!ownerId) {
                    console.error('No Store Owner found in DB');
                    return NextResponse.json({ error: 'No owner found' }, { status: 404 });
                }

                // 3. AI Processing
                const aiResponse = await generateGhostReply(
                    ownerId,
                    messageText,
                    supabaseAdmin,
                    senderId
                );

                if (!aiResponse) {
                    console.log('No AI response generated.');
                    return NextResponse.json({ status: 'no_reply' });
                }

                console.log('AI Reply:', aiResponse);

                // 4. Send Reply via Graph API
                const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
                if (!PAGE_ACCESS_TOKEN) {
                    console.error('Missing INSTAGRAM_PAGE_ACCESS_TOKEN');
                    return NextResponse.json({ error: 'Config Error' }, { status: 500 });
                }

                const response = await fetch(`https://graph.instagram.com/v24.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipient: { id: senderId },
                        message: { text: aiResponse }
                    })
                });

                const responseData = await response.json();

                if (response.ok) {
                    console.log('Message Sent:', responseData);

                    // Log to DB
                    await supabaseAdmin.from('activity_log').insert({
                        user_id: ownerId,
                        event_type: 'AI_REPLY',
                        description: `Sent: "${aiResponse}"`,
                        timestamp: new Date().toISOString(),
                        metadata: { chat_id: senderId, platform: 'instagram' }
                    });

                    return NextResponse.json({ status: 'success', data: responseData });
                } else {
                    console.error('Instagram API Error:', responseData);
                    return NextResponse.json({ error: 'Instagram API Failed', details: responseData }, { status: 500 });
                }
            }
        }

        // If no events matched criteria (e.g. empty batch)
        return NextResponse.json({ status: 'ok' });

    } catch (e: any) {
        console.error('Webhook Post Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
