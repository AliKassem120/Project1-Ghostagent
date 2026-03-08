// ═══════════════════════════════════════════════════════════════
// 🛒 GHOST AGENT — Checkout Session State Machine
//
// Manages multi-turn checkout conversations for ecommerce workspaces.
// Flow: purchase intent detected → collect name → phone → address → save order
// ═══════════════════════════════════════════════════════════════

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export type CheckoutStage = 'collecting_name' | 'collecting_phone' | 'collecting_address';

export interface CheckoutSession {
    id: string;
    user_id: string;
    workspace_id: string | null;
    sender_id: string;
    stage: CheckoutStage;
    item_requested: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_address: string | null;
}

// ─── Fetch active checkout session for a sender ───────────────────────────
export async function getCheckoutSession(
    supabase: any,
    userId: string,
    senderId: string
): Promise<CheckoutSession | null> {
    const { data } = await supabase
        .from('order_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('sender_id', senderId)
        .maybeSingle();
    return data || null;
}

// ─── Create a new checkout session (purchase intent detected) ─────────────
export async function createCheckoutSession(
    supabase: any,
    userId: string,
    workspaceId: string | null,
    senderId: string,
    item: string
): Promise<CheckoutSession | null> {
    const { data, error } = await supabase
        .from('order_sessions')
        .upsert({
            user_id: userId,
            workspace_id: workspaceId,
            sender_id: senderId,
            stage: 'collecting_name',
            item_requested: item,
            customer_name: null,
            customer_phone: null,
            customer_address: null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'sender_id,user_id' })
        .select()
        .single();

    if (error) {
        console.error('❌ [Checkout] Failed to create session:', error.message);
        return null;
    }
    console.log(`🛒 [Checkout] Session started for sender ${senderId} — item: "${item}"`);
    return data;
}

// ─── Advance the session to the next stage with extracted value ───────────
export async function advanceCheckoutSession(
    supabase: any,
    session: CheckoutSession,
    extractedValue: string
): Promise<{ completed: boolean; nextStage: CheckoutStage | null; updated: CheckoutSession }> {
    const updates: Partial<CheckoutSession> & { updated_at: string } = {
        updated_at: new Date().toISOString(),
    };

    let nextStage: CheckoutStage | null = null;
    let completed = false;

    if (session.stage === 'collecting_name') {
        updates.customer_name = extractedValue;
        updates.stage = 'collecting_phone';
        nextStage = 'collecting_phone';
    } else if (session.stage === 'collecting_phone') {
        updates.customer_phone = extractedValue;
        updates.stage = 'collecting_address';
        nextStage = 'collecting_address';
    } else if (session.stage === 'collecting_address') {
        updates.customer_address = extractedValue;
        completed = true;
    }

    const { data } = await supabase
        .from('order_sessions')
        .update(updates)
        .eq('id', session.id)
        .select()
        .single();

    return { completed, nextStage, updated: data || { ...session, ...updates } };
}

// ─── Save completed order and clean up session ────────────────────────────
export async function completeCheckoutOrder(
    supabase: any,
    session: CheckoutSession,
    instagramHandle: string
): Promise<void> {
    const { error } = await supabase.from('orders').insert({
        user_id: session.user_id,
        workspace_id: session.workspace_id || null,
        instagram_handle: instagramHandle,
        instagram_user_id: session.sender_id,
        item_requested: session.item_requested || 'Unknown item',
        customer_name: session.customer_name,
        customer_phone: session.customer_phone,
        customer_address: session.customer_address,
        status: 'Pending',
        created_at: new Date().toISOString(),
    });

    if (error) {
        console.error('❌ [Checkout] Failed to save order:', error.message);
    } else {
        console.log(`✅ [Checkout] Order saved for ${instagramHandle} — "${session.item_requested}"`);
    }

    // Clean up session
    await supabase.from('order_sessions').delete().eq('id', session.id);
}

// ─── Use Groq to extract a specific field from the customer's message ─────
export async function extractCheckoutField(
    customerMessage: string,
    stage: CheckoutStage
): Promise<string | null> {
    const fieldDescriptions: Record<CheckoutStage, string> = {
        collecting_name: 'full name',
        collecting_phone: 'phone number (digits only, include country code if present)',
        collecting_address: 'delivery address',
    };

    try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
        const { text } = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            system: `Extract the customer's ${fieldDescriptions[stage]} from their message.
Return ONLY the extracted value as plain text — nothing else.
If the value is NOT present or unclear, return exactly: NOT_FOUND`,
            messages: [{ role: 'user', content: customerMessage }],
        });

        const trimmed = text.trim();
        return trimmed === 'NOT_FOUND' ? null : trimmed;
    } catch {
        return null;
    }
}

// ─── Lightweight purchase intent detection (no AI call, fast) ────────────
const PURCHASE_INTENT_PATTERNS = [
    /\b(i want to buy|i want to order|i'd like to buy|i'll take|can i buy|i want to get|i'll get|i'd like to order|add to cart|place an? order|i want it|i want one|i'll order|order it|buy it|purchase)\b/i,
    /\b(yes please|yes i want|yes i'll take|yep|confirmed|confirm my order|i confirm|proceed with|let's go|go ahead)\b/i,
];

export function detectsPurchaseIntent(message: string): boolean {
    return PURCHASE_INTENT_PATTERNS.some(p => p.test(message));
}

// ─── Build checkout system prompt injection ───────────────────────────────
export function buildCheckoutPromptSection(session: CheckoutSession): string {
    const item = session.item_requested || 'an item';
    const name = session.customer_name;
    const phone = session.customer_phone;

    if (session.stage === 'collecting_name') {
        return `
═══════════════════════════════════════
🛒 ACTIVE CHECKOUT — COLLECTING INFO
═══════════════════════════════════════
The customer wants to order: "${item}"
✅ Item: confirmed
❌ Name: NOT YET COLLECTED
❌ Phone: NOT YET COLLECTED
❌ Address: NOT YET COLLECTED

⚠️ YOUR ONLY JOB RIGHT NOW: Ask the customer for their FULL NAME to register the order.
Do NOT discuss anything else. Just ask for the name naturally and briefly.`;
    }

    if (session.stage === 'collecting_phone') {
        return `
═══════════════════════════════════════
🛒 ACTIVE CHECKOUT — COLLECTING INFO
═══════════════════════════════════════
The customer wants to order: "${item}"
✅ Item: confirmed
✅ Name: ${name}
❌ Phone: NOT YET COLLECTED
❌ Address: NOT YET COLLECTED

⚠️ YOUR ONLY JOB RIGHT NOW: Thank them for the name and ask for their PHONE NUMBER.
Do NOT discuss anything else.`;
    }

    if (session.stage === 'collecting_address') {
        return `
═══════════════════════════════════════
🛒 ACTIVE CHECKOUT — COLLECTING INFO
═══════════════════════════════════════
The customer wants to order: "${item}"
✅ Item: confirmed
✅ Name: ${name}
✅ Phone: ${phone}
❌ Address: NOT YET COLLECTED

⚠️ YOUR ONLY JOB RIGHT NOW: Ask them for their DELIVERY ADDRESS (street, city).
Do NOT discuss anything else.`;
    }

    return '';
}
