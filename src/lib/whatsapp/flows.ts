/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — WhatsApp Flows (Booking & Checkout)
 * ═══════════════════════════════════════════════════════════════
 * Creates and sends WhatsApp Flows — native structured forms
 * inside WhatsApp for booking appointments and ordering products.
 */

import { sendFlow, sendButtons, type WhatsAppCredentials } from './send';

const WA_API = 'https://graph.facebook.com/v21.0';

// ── Create a Flow Definition ─────────────────────────────────

export async function createBookingFlow(
    whatsappBusinessAccountId: string,
    accessToken: string,
    flowName: string = 'GhostAgent Booking V3'
) {
    let flowId: string | null = null;

    // 1. Try to create the flow
    const createRes = await fetch(`${WA_API}/${whatsappBusinessAccountId}/flows`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: flowName,
            categories: ['OTHER'],
        }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
        // Flow name already exists — find the existing flow ID
        if (createData.error?.error_subcode === 4016019 || createData.error?.message?.includes('not unique') || createData.error?.message?.includes('already exists')) {
            console.log(`ℹ️ [Flows] Flow "${flowName}" already exists. Looking up existing ID...`);

            // List all flows for this WABA and find ours
            const listRes = await fetch(`${WA_API}/${whatsappBusinessAccountId}/flows`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            const listData = await listRes.json();
            const existingFlow = (listData.data || []).find((f: any) => f.name === flowName);

            if (existingFlow?.id) {
                flowId = existingFlow.id;
                console.log(`ℹ️ [Flows] Found existing flow ID: ${flowId}`);
            } else {
                console.log(`ℹ️ [Flows] Flow exists but could not locate ID. Skipping JSON upload.`);
                return { success: true, alreadyExists: true };
            }
        } else {
            console.error('❌ [Flows] Failed to create flow:', createData.error);
            return { success: false, error: createData.error?.message };
        }
    } else {
        flowId = createData.id;
    }

    if (!flowId) return { success: false, error: 'No flow ID available' };

    // 2. Upload the flow JSON definition
    const flowJson = buildBookingFlowJSON();

    const formData = new FormData();
    formData.append('name', 'flow.json');
    formData.append('asset_type', 'FLOW_JSON');
    
    const jsonBlob = new Blob([JSON.stringify(flowJson)], { type: 'application/json' });
    formData.append('file', jsonBlob, 'flow.json');

    const updateRes = await fetch(`${WA_API}/${flowId}/assets`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
    });

    const updateData = await updateRes.json();
    if (!updateRes.ok) {
        console.error('❌ [Flows] Failed to upload flow JSON:', updateData.error);
        return { success: false, flowId, error: updateData.error?.message };
    }

    console.log(`✅ [Flows] Booking flow ready (ID: ${flowId})`);
    return { success: true, flowId };
}

// ── Booking Flow JSON Definition ─────────────────────────────

function buildBookingFlowJSON() {
    return {
        version: '6.2',
        screens: [
            {
                id: 'BOOKING_DETAILS',
                title: 'Book Appointment',
                terminal: true,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        {
                            type: 'Form',
                            name: 'booking_form',
                            children: [
                                {
                                    type: 'TextInput',
                                    'input-type': 'text',
                                    required: true,
                                    name: 'customer_name',
                                    label: 'Your Name',
                                    'helper-text': 'Enter your full name',
                                },
                                {
                                    type: 'TextInput',
                                    'input-type': 'phone',
                                    required: true,
                                    name: 'customer_phone',
                                    label: 'Phone Number',
                                    'helper-text': 'We will send you a confirmation',
                                },
                                {
                                    type: 'DatePicker',
                                    name: 'booking_date',
                                    label: 'Preferred Date',
                                    required: true,
                                },
                                {
                                    type: 'Dropdown',
                                    name: 'booking_time',
                                    label: 'Preferred Time',
                                    required: true,
                                    'data-source': [
                                        { id: '09:00', title: '9:00 AM' },
                                        { id: '10:00', title: '10:00 AM' },
                                        { id: '11:00', title: '11:00 AM' },
                                        { id: '12:00', title: '12:00 PM' },
                                        { id: '13:00', title: '1:00 PM' },
                                        { id: '14:00', title: '2:00 PM' },
                                        { id: '15:00', title: '3:00 PM' },
                                        { id: '16:00', title: '4:00 PM' },
                                        { id: '17:00', title: '5:00 PM' },
                                        { id: '18:00', title: '6:00 PM' },
                                    ],
                                },
                                {
                                    type: 'TextArea',
                                    name: 'notes',
                                    label: 'Special Requests (Optional)',
                                    required: false,
                                },
                                {
                                    type: 'Footer',
                                    label: 'Book Now',
                                    'on-click-action': {
                                        name: 'complete',
                                        payload: {
                                            customer_name: '${form.customer_name}',
                                            customer_phone: '${form.customer_phone}',
                                            booking_date: '${form.booking_date}',
                                            booking_time: '${form.booking_time}',
                                            notes: '${form.notes}',
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    };
}

// ── Send Booking Flow to Customer ────────────────────────────

export async function sendBookingFlow(
    creds: WhatsAppCredentials,
    to: string,
    flowId: string,
    serviceName: string,
    servicePrice?: number
) {
    const priceText = servicePrice ? ` • $${servicePrice}` : '';
    const body = `📅 Ready to book your *${serviceName}*${priceText}?\n\nTap below to choose your preferred date and time:`;

    const flowToken = `booking_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return sendFlow(
        creds,
        to,
        flowId,
        flowToken,
        body,
        '📅 Book Now',
        'BOOKING_DETAILS',
        { service_name: serviceName, service_price: servicePrice },
        `Book ${serviceName}`,
        'Powered by GhostAgent'
    );
}

// ── Fallback: Interactive Booking (no Flow required) ─────────

export async function sendBookingButtons(
    creds: WhatsAppCredentials,
    to: string,
    serviceName: string,
    availableSlots: { date: string; time: string; label: string }[]
) {
    if (availableSlots.length === 0) {
        return sendButtons(creds, to,
            `Sorry, no available slots for *${serviceName}* right now. Would you like to be notified when slots open up?`,
            [{ id: 'notify_me', title: '🔔 Notify Me' }]
        );
    }

    // Show up to 3 quick slot buttons (WhatsApp limit)
    const slots = availableSlots.slice(0, 3);

    return sendButtons(
        creds,
        to,
        `📅 Available slots for *${serviceName}*:\n\n${slots.map(s => `• ${s.label}`).join('\n')}\n\nTap to book:`,
        slots.map(s => ({ id: `book_${s.date}_${s.time}`, title: s.label.slice(0, 20) })),
        `Book ${serviceName}`
    );
}
