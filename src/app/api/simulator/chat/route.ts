import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateGhostReply } from '@/utils/ghost-brain';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { workspaceId, message, chatId } = await req.json();

        if (!workspaceId || !message) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Simulate the WhatsApp webhook by calling the ghost brain
        const brainRes = await generateGhostReply(
            user.id,
            message,
            supabase,
            chatId || `sim_${workspaceId}`,
            workspaceId,
            'whatsapp'
        );

        const responses = [];

        // In a real scenario, tool calls might have sent side-channel interactive messages.
        // For the simulator, we just return the text the agent generated.
        // If the agent decided to reply with text:
        if (brainRes?.automationResult?.shouldReply && brainRes?.replyText) {
            responses.push({
                type: 'text',
                text: { body: brainRes.replyText }
            });
        }
        
        // Let's also check if any actions were taken (like sending a product card)
        // If so, mock it in the simulator UI.
        if (brainRes?.actions) {
            brainRes.actions.forEach((action: string) => {
                if (action.includes('ProductStock') || action.includes('searchProducts')) {
                    responses.push({
                        type: 'interactive',
                        interactive: {
                            header: { text: 'Product Catalog' },
                            body: { text: 'Here is the product you requested.' },
                            action: { buttons: [{ reply: { title: 'View Item' } }] }
                        }
                    });
                } else if (action.includes('book_appointment') || action.includes('checkAvailability') || action.includes('Availability')) {
                    responses.push({
                        type: 'interactive',
                        interactive: {
                            header: { text: 'Book Appointment' },
                            body: { text: 'Click below to choose a time.' },
                            action: { buttons: [{ reply: { title: 'Book Now' } }] }
                        }
                    });
                } else if (action.includes('place_order')) {
                    responses.push({
                        type: 'interactive',
                        interactive: {
                            header: { text: 'Checkout' },
                            body: { text: 'Click below to complete your order.' },
                            action: { buttons: [{ reply: { title: 'Pay Now' } }] }
                        }
                    });
                }
            });
        }

        return NextResponse.json({
            success: true,
            responses: responses.length > 0 ? responses : [{ type: 'text', text: { body: '[No Response generated]' } }]
        });

    } catch (error: any) {
        console.error('Simulator error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
