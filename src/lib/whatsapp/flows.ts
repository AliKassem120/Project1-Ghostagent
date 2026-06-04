/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — WhatsApp Flows (Booking & Checkout)
 * ═══════════════════════════════════════════════════════════════
 * Creates and sends WhatsApp Flows — native structured forms
 * inside WhatsApp for booking appointments and ordering products.
 *
 * IMPORTANT: These are STATIC flows (no endpoint / no data exchange).
 * The user fills out the form, taps Submit, and the payload comes
 * back to the main WhatsApp webhook as an `nfm_reply` message.
 * No RSA keys, no health check, no endpoint_uri required.
 */

import { sendFlow, sendButtons, type WhatsAppCredentials } from './send';

const WA_API = 'https://graph.facebook.com/v21.0';

// ── Delete an existing Flow ──────────────────────────────────

export async function deleteFlow(
    flowId: string,
    accessToken: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await fetch(`${WA_API}/${flowId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('❌ [Flows] Failed to delete flow:', data.error);
            return { success: false, error: data.error?.message };
        }
        console.log(`🗑️ [Flows] Deleted flow ${flowId}`);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ── Create a Flow Definition (Static — No Endpoint) ──────────

export async function createBookingFlow(
    whatsappBusinessAccountId: string,
    accessToken: string,
    flowName: string = 'GhostAgent Booking V3'
) {
    let flowId: string | null = null;

    // 1. Try to create the flow WITHOUT an endpoint (static mode)
    const createRes = await fetch(`${WA_API}/${whatsappBusinessAccountId}/flows`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: flowName,
            categories: ['APPOINTMENT_BOOKING'],
            // No endpoint_uri = static flow (no data exchange, no RSA, no health check)
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

    // 2. Upload the flow JSON definition (static — no data_exchange actions)
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

/**
 * Delete the old flow (which may have been created with endpoint mode)
 * and create a fresh one as static (no endpoint).
 * Call this if your existing flow can't be published.
 */
export async function republishBookingFlow(
    whatsappBusinessAccountId: string,
    accessToken: string,
    oldFlowId?: string | null,
    flowName: string = 'GhostAgent Booking V3'
): Promise<{ success: boolean; flowId?: string; error?: string }> {
    // 1. Delete the old flow if we have its ID
    if (oldFlowId) {
        console.log(`🔄 [Flows] Deleting old flow ${oldFlowId} to recreate as static...`);
        await deleteFlow(oldFlowId, accessToken);
    } else {
        // Try to find and delete by name
        try {
            const listRes = await fetch(`${WA_API}/${whatsappBusinessAccountId}/flows`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            const listData = await listRes.json();
            const existing = (listData.data || []).find((f: any) => f.name === flowName);
            if (existing?.id) {
                console.log(`🔄 [Flows] Found existing flow "${flowName}" (${existing.id}). Deleting...`);
                await deleteFlow(existing.id, accessToken);
            }
        } catch (err) {
            console.warn('⚠️ [Flows] Could not list/delete existing flows:', err);
        }
    }

    // 2. Create a fresh static flow
    const result = await createBookingFlow(whatsappBusinessAccountId, accessToken, flowName);
    return result;
}

// ── Booking Flow JSON Definition (Static — No Endpoint) ──────
// 
// This is a self-contained form. No data_exchange, no routing_model,
// no endpoint calls. The user fills in all fields and hits "Book Now".
// The complete payload is delivered to the WhatsApp webhook as an
// nfm_reply interactive message.

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
                                        { id: '09:30', title: '9:30 AM' },
                                        { id: '10:00', title: '10:00 AM' },
                                        { id: '10:30', title: '10:30 AM' },
                                        { id: '11:00', title: '11:00 AM' },
                                        { id: '11:30', title: '11:30 AM' },
                                        { id: '12:00', title: '12:00 PM' },
                                        { id: '12:30', title: '12:30 PM' },
                                        { id: '13:00', title: '1:00 PM' },
                                        { id: '13:30', title: '1:30 PM' },
                                        { id: '14:00', title: '2:00 PM' },
                                        { id: '14:30', title: '2:30 PM' },
                                        { id: '15:00', title: '3:00 PM' },
                                        { id: '15:30', title: '3:30 PM' },
                                        { id: '16:00', title: '4:00 PM' },
                                        { id: '16:30', title: '4:30 PM' },
                                        { id: '17:00', title: '5:00 PM' },
                                        { id: '17:30', title: '5:30 PM' },
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
