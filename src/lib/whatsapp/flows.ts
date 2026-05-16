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
    flowName: string = 'GhostAgent Booking'
) {
    // 1. Create the flow
    const createRes = await fetch(`${WA_API}/${whatsappBusinessAccountId}/flows`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: flowName,
            categories: ['APPOINTMENT_BOOKING'],
        }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
        // Flow might already exist
        if (createData.error?.message?.includes('already exists')) {
            console.log(`ℹ️ [Flows] Flow "${flowName}" already exists.`);
            return { success: true, alreadyExists: true };
        }
        console.error('❌ [Flows] Failed to create flow:', createData.error);
        return { success: false, error: createData.error?.message };
    }

    const flowId = createData.id;

    // 2. Upload the flow JSON definition
    const flowJson = buildBookingFlowJSON();

    const updateRes = await fetch(`${WA_API}/${flowId}/assets`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: 'flow.json',
            asset_type: 'FLOW_JSON',
            file: JSON.stringify(flowJson),
        }),
    });

    const updateData = await updateRes.json();
    if (!updateRes.ok) {
        console.error('❌ [Flows] Failed to upload flow JSON:', updateData.error);
        return { success: false, flowId, error: updateData.error?.message };
    }

    console.log(`✅ [Flows] Created booking flow (ID: ${flowId})`);
    return { success: true, flowId };
}

// ── Booking Flow JSON Definition ─────────────────────────────

function buildBookingFlowJSON() {
    return {
        version: '5.0',
        screens: [
            {
                id: 'BOOKING_DETAILS',
                title: 'Book Appointment',
                terminal: true,
                data: {},
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        {
                            type: 'TextHeading',
                            text: 'Book Your Appointment',
                        },
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
                            'helper-text': 'We\'ll send you a confirmation',
                        },
                        {
                            type: 'DatePicker',
                            name: 'booking_date',
                            label: 'Preferred Date',
                            required: true,
                            'min-date': new Date().toISOString().split('T')[0],
                            'max-date': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
                                payload: {},
                            },
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
