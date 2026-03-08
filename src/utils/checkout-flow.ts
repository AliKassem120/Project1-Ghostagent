// ═══════════════════════════════════════════════════════════════
// 🛒 GHOST AGENT — Checkout Session (Single-Turn Info Collection)
//
// Flow: purchase intent detected → bot asks for name + phone + address
//       in ONE message → customer replies → extract all 3 → save order
// ═══════════════════════════════════════════════════════════════

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export type CheckoutStage = 'collecting_info';

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

export interface ExtractedInfo {
    name: string | null;
    phone: string | null;
    address: string | null;
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

// ─── Create a new checkout session ───────────────────────────────────────
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
            stage: 'collecting_info',
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

// ─── Use Groq to extract name, phone, address from ONE message ───────────
export async function extractAllCheckoutFields(
    customerMessage: string
): Promise<ExtractedInfo> {
    try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
        const { text } = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            system: `Extract the following from the customer's message:
1. Full name
2. Phone number (digits, include country code if present)
3. Delivery address (street/area/city)

Return ONLY valid JSON — no markdown, no explanation:
{"name": "...", "phone": "...", "address": "..."}

If any field is missing or unclear, use null for that field.
Examples:
- "Ali Kassem, 78820707, Aramoun Aley" → {"name": "Ali Kassem", "phone": "78820707", "address": "Aramoun, Aley"}
- "My name is Sara Haddad, phone 03123456, I live in Hamra Beirut" → {"name": "Sara Haddad", "phone": "03123456", "address": "Hamra, Beirut"}
- "Ali Kassem Haret Hreik Beirut 78820707" → {"name": "Ali Kassem", "phone": "78820707", "address": "Haret Hreik, Beirut"}`,
            messages: [{ role: 'user', content: customerMessage }],
        });

        const parsed = JSON.parse(text.trim());
        return {
            name: parsed.name || null,
            phone: parsed.phone || null,
            address: parsed.address || null,
        };
    } catch {
        return { name: null, phone: null, address: null };
    }
}

// ─── Save completed order and clean up session ────────────────────────────
export async function completeCheckoutOrder(
    supabase: any,
    session: CheckoutSession,
    info: ExtractedInfo,
    instagramHandle: string
): Promise<void> {
    const { error } = await supabase.from('orders').insert({
        user_id: session.user_id,
        workspace_id: session.workspace_id || null,
        instagram_handle: instagramHandle,
        instagram_user_id: session.sender_id,
        item_requested: session.item_requested || 'Unknown item',
        customer_name: info.name,
        customer_phone: info.phone,
        customer_address: info.address,
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
    console.log(`🗑️ [Checkout] Session cleared for ${session.sender_id}`);
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

    return `
═══════════════════════════════════════
🛒 ACTIVE CHECKOUT — COLLECT ORDER INFO
═══════════════════════════════════════
The customer has confirmed they want to order: "${item}"

⚠️ YOUR ONLY JOB RIGHT NOW:
Ask for their FULL NAME, PHONE NUMBER, and DELIVERY ADDRESS — all in ONE single message.
Be natural and brief. Example:
"To register your order, I just need: your full name, phone number, and delivery address 📦"

Do NOT ask for them one at a time. Ask for all 3 in one go.
Do NOT discuss anything else until you have this info.`;
}
