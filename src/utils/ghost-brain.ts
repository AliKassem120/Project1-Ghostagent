// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Core AI Brain (v4 — Workflow & Anti-Loop)
// ═══════════════════════════════════════════════════════════════

import { createGroq } from '@ai-sdk/groq';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { buildSystemPrompt, type BusinessProfile, type PromptContext } from './system-prompt-builder';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from './rolling-memory';
import {
    checkEcommerceInventoryTool,
    checkCalendarAvailabilityTool,
    searchActiveListingsTool,
    searchMenuItemsTool,
    checkTicketAvailabilityTool,
    fetchSupportDocsTool
} from './ghost-read-tools';

export async function generateGhostReply(
    userId: string,
    userMessage: string,
    supabase: any,
    chatId?: string,
    workspaceId?: string,
    checkoutContext?: string
) {
    console.log('👻 Ghost Brain v4: Generating reply for', userId, workspaceId ? `(workspace: ${workspaceId})` : '');

    try {
        let settingsQuery = supabase
            .from('ai_settings')
            .select('business_name, business_type, tone, system_instructions, urgency_mode, handoff_keywords, language, store_location, contact_info, use_emojis, use_local_slang, shipping_rules, is_autopilot_enabled');

        if (workspaceId) {
            settingsQuery = settingsQuery.eq('id', workspaceId);
        } else {
            settingsQuery = settingsQuery.eq('user_id', userId).is('id', null);
        }

        const { data: settings } = await settingsQuery.limit(1).maybeSingle();
        const { data: userRecord } = await supabase.from('users').select('plan_tier').eq('id', userId).single();
        const planTier = userRecord?.plan_tier?.toLowerCase() || 'free_trial';
        
        const businessType = settings?.business_type || 'ecommerce';

        const business: BusinessProfile = {
            business_name: settings?.business_name || 'our store',
            business_type: businessType,
            tone: settings?.tone || 'Professional',
            system_instructions: settings?.system_instructions || null,
            language: settings?.language || 'Auto',
            store_location: settings?.store_location || null,
            contact_info: settings?.contact_info || null,
            use_emojis: settings?.use_emojis ?? true,
            use_local_slang: settings?.use_local_slang ?? false,
            urgency_mode: settings?.urgency_mode ?? false,
            handoff_keywords: settings?.handoff_keywords || [],
            shipping_rules: settings?.shipping_rules || null,
        };

        if (Array.isArray(business.handoff_keywords) && business.handoff_keywords.some(
            (kw: string) => userMessage.toLowerCase().includes(kw.toLowerCase())
        )) {
            console.log('🛑 Ghost Protocol: Handoff Keyword Detected. Pausing AI.');
            return null;
        }

        let historyContext = '';
        let contextSummary: string | null = null;
        let fullHistory: any[] = [];
        let hasGreetedRecently = false;

        if (chatId) {
            const { contextSummary: fetchedContextSummary, recentHistory, fullHistory: fetchedFullHistory } =
                await getConversationMemory(supabase, userId, chatId, workspaceId);
            contextSummary = fetchedContextSummary;
            historyContext = recentHistory;
            fullHistory = fetchedFullHistory;
        }

        let inventoryContext = 'No inventory items listed currently.';
        let catalogContext = '';

        let inventoryQuery = supabase.from('inventory').select('item_name, stock_level, price');
        if (workspaceId) inventoryQuery = inventoryQuery.eq('workspace_id', workspaceId);
        else inventoryQuery = inventoryQuery.eq('user_id', userId).is('workspace_id', null);

        const { data: inventory } = await inventoryQuery.limit(50);
        if (inventory?.length) {
            inventoryContext = inventory.map((i: any) => `- ${i.item_name}: ${i.stock_level > 0 ? 'In Stock' : 'Out of Stock'} ($${i.price})`).join('\n');
        }

        let knowledgeQuery = supabase.from('business_knowledge').select('content, file_name');
        if (workspaceId) knowledgeQuery = knowledgeQuery.eq('workspace_id', workspaceId);
        else knowledgeQuery = knowledgeQuery.eq('user_id', userId).is('workspace_id', null);

        const { data: knowledgeData } = await knowledgeQuery.single();
        if (knowledgeData?.content) {
            try {
                catalogContext = `PRODUCT/SERVICE CATALOG:\n${JSON.stringify(JSON.parse(knowledgeData.content), null, 2)}`;
            } catch { }
        }

        const promptContext: PromptContext = { business, inventoryContext, catalogContext, historyContext, contextSummary, hasGreetedRecently };
        const basePrompt = buildSystemPrompt(promptContext);
        const systemPrompt = checkoutContext ? `${checkoutContext}\n\n${basePrompt}` : basePrompt;

        // ─── DYNAMIC ZOD SCHEMAS (Synced with Checklists — all 6 workspace types) ───
        let transactionSchema: z.ZodType<any>;
        switch (business.business_type) {
            case 'ecommerce':
                transactionSchema = z.object({
                    workspace_type: z.literal('ecommerce'),
                    item_name: z.string().describe("Product name & variant confirmed by customer (e.g. 'Hijab – Black, One Size')."),
                    item_variant: z.string().optional().describe("Product variant, size, or color if not already in item_name."),
                    payment_method: z.string().optional().describe("Payment method (e.g., Cash on Delivery)."),
                    customer_name: z.string().optional().describe("Full name of the customer."),
                    customer_phone: z.string().describe("Customer phone number."),
                    delivery_address: z.string().describe("Full delivery address including area/neighborhood."),
                });
                break;
            case 'appointments':
                transactionSchema = z.object({
                    workspace_type: z.literal('appointments'),
                    service_type: z.string().describe("The specific service being booked (e.g. 'Haircut', 'Consultation')."),
                    preferred_datetime: z.string().describe("Exact agreed-upon date AND time (e.g. 'Monday March 10 at 3pm')."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_phone: z.string().describe("Customer phone number."),
                });
                break;
            case 'real_estate':
                transactionSchema = z.object({
                    workspace_type: z.literal('real_estate'),
                    budget: z.string().describe("Customer's stated budget range (e.g. '$200k–$300k' or '$1500/month')."),
                    desired_location: z.string().describe("Preferred location or neighborhood."),
                    property_type: z.string().describe("Rent or Buy, and property type (e.g. 'Buy – Apartment', 'Rent – Villa')."),
                    timeline: z.string().describe("How soon the customer wants to move or invest (e.g. 'ASAP', 'within 3 months')."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_phone: z.string().describe("Customer phone number."),
                });
                break;
            case 'food_and_beverage':
                transactionSchema = z.object({
                    workspace_type: z.literal('food_and_beverage'),
                    menu_items: z.string().describe("All ordered menu items with sizes/quantities as a readable list (e.g. '1x Cheese Pizza large, 2x Pepsi')."),
                    delivery_address: z.string().describe("Full delivery address OR the word 'Pickup' if collecting in store."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_phone: z.string().describe("Customer phone number."),
                    dietary_notes: z.string().optional().describe("Any dietary restrictions or special prep notes (e.g. 'no onions', 'extra spicy')."),
                });
                break;
            case 'events_ticketing':
                transactionSchema = z.object({
                    workspace_type: z.literal('events_ticketing'),
                    event_name: z.string().describe("Name of the event the customer wants to attend."),
                    ticket_count: z.string().describe("Number of tickets requested (e.g. '2')."),
                    ticket_tier: z.string().describe("Ticket tier: 'VIP' or 'General Admission'."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_email: z.string().describe("Customer email address for ticket delivery."),
                });
                break;
            case 'digital_services':
                transactionSchema = z.object({
                    workspace_type: z.literal('digital_services'),
                    service_required: z.string().describe("The specific service or package the customer needs (e.g. 'Logo Design', 'Monthly SEO')."),
                    problem_description: z.string().describe("Brief description of the customer's request or problem in their own words."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_email: z.string().describe("Customer email address for delivery and follow-up."),
                });
                break;
            default:
                transactionSchema = z.object({
                    workspace_type: z.string(),
                    item_requested: z.string(),
                    customer_name: z.string(),
                    customer_phone: z.string().optional(),
                });
        }

        const finalizeTransactionTool = tool({
            description: "Call this ONLY when all required info from your checklist is collected. DO NOT call if user is just saying thanks.",
            inputSchema: transactionSchema,
            execute: async (args) => {
                console.log('✅ Finalizing transaction via tool:', args);
                let handle = chatId || 'unknown_customer';
                const a = args as any;

                // Resolve the primary item label per workspace type
                const itemRequested =
                    a.item_name ||            // ecommerce
                    a.service_type ||         // appointments
                    a.service_required ||     // digital_services
                    a.event_name ||           // events_ticketing
                    a.menu_items ||           // food_and_beverage
                    a.property_type ||        // real_estate
                    a.item_requested ||       // generic default
                    'General Request';

                try {
                    // 🛑 ANTI-LOOP / DUPLICATE PREVENTION LOGIC (15 MINUTE COOLDOWN)
                    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
                    const { data: duplicateCheck } = await supabase
                        .from('orders')
                        .select('id')
                        .eq('instagram_user_id', chatId)
                        .eq('item_requested', itemRequested)
                        .gte('created_at', fifteenMinsAgo)
                        .limit(1)
                        .maybeSingle();

                    if (duplicateCheck) {
                        console.log(`⚠️ [Ghost Brain] Blocked duplicate order for ${handle}`);
                        return "DUPLICATE PREVENTED: You already saved this exact order a few minutes ago. DO NOT try to save it again. Just reply to the user naturally (e.g., 'Takram hbb!').";
                    }

                    // 1. Resolve customer handle
                    const { data: lastMsg } = await supabase
                        .from('activity_log')
                        .select('metadata')
                        .eq('user_id', userId)
                        .filter('metadata->>chat_id', 'eq', chatId)
                        .order('timestamp', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (lastMsg?.metadata?.username) handle = lastMsg.metadata.username;

                    // 2. Build workspace-aware payload
                    const orderPayload: Record<string, any> = {
                        user_id: userId,
                        workspace_id: workspaceId || null,
                        instagram_user_id: chatId || null,
                        instagram_handle: handle,
                        status: 'Pending',
                        created_at: new Date().toISOString(),
                        // Universal fields
                        customer_name: a?.customer_name || null,
                        customer_phone: a?.customer_phone || null,
                        customer_email: a?.customer_email || null,
                        item_requested: itemRequested,
                        // Ecommerce / Food
                        customer_address: a?.delivery_address || null,
                        payment_method: a?.payment_method || 'Cash on Delivery',
                        // Extra fields stored as JSON in raw_message for types that need it
                        raw_message: JSON.stringify({
                            item_variant:       a?.item_variant       || undefined,
                            preferred_datetime: a?.preferred_datetime || undefined,
                            budget:             a?.budget             || undefined,
                            desired_location:   a?.desired_location   || undefined,
                            timeline:           a?.timeline           || undefined,
                            ticket_count:       a?.ticket_count       || undefined,
                            ticket_tier:        a?.ticket_tier        || undefined,
                            dietary_notes:      a?.dietary_notes      || undefined,
                            problem_description:a?.problem_description|| undefined,
                        }),
                    };

                    const { error } = await supabase.from('orders').insert(orderPayload);
                    if (error) throw error;

                    return "Order saved successfully! Tell the customer it's confirmed in 1 short sentence.";
                } catch (err: any) {
                    console.error('❌ [Ghost Brain] Failed to save transaction:', err);
                    return "Failed to save to database. Apologize to the user.";
                }
            }
        });

        const toolsMapping: Record<string, any> = {};
        
        // ── GATE: Advanced Tools (Checkout / Sync) are disabled for Starter tier ──
        if (planTier !== 'starter' && planTier !== 'free_trial') {
            toolsMapping['finalize_transaction'] = finalizeTransactionTool;
            if (workspaceId) {
                switch (business.business_type) {
                    case 'ecommerce': toolsMapping['check_ecommerce_inventory'] = checkEcommerceInventoryTool(workspaceId); break;
                    case 'appointments': toolsMapping['check_calendar_availability'] = checkCalendarAvailabilityTool(workspaceId); break;
                    case 'real_estate': toolsMapping['search_active_listings'] = searchActiveListingsTool(workspaceId); break;
                    case 'food_and_beverage': toolsMapping['search_menu_items'] = searchMenuItemsTool(workspaceId); break;
                    case 'events_ticketing': toolsMapping['check_ticket_availability'] = checkTicketAvailabilityTool(workspaceId); break;
                    case 'digital_services': toolsMapping['fetch_support_docs'] = fetchSupportDocsTool(workspaceId); break;
                }
            }
        }

        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
        const purchaseKeywords = ['buy', 'order', 'checkout', 'pay', 'purchase', 'book', 'schedule', 'viewing', 'ticket', 'delivery', 'bde otlob', 'bade'];
        const isPurchaseIntent = purchaseKeywords.some(kw => userMessage.toLowerCase().includes(kw));
        const hasActiveToolContext = historyContext.toLowerCase().includes('transaction') || historyContext.toLowerCase().includes('order');

        const cleanMessage = userMessage.replace(/\[ATTACHMENT:.*?\]/g, '').trim() || 'What is this?';
        const selectedModel = (isPurchaseIntent || hasActiveToolContext) ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';

        console.log(`🚀 [Ghost Brain] Selected Model: ${selectedModel}`);

        const messages: any[] = (fullHistory || [])
            .filter((h: any) => h.event_type === 'INCOMING_MESSAGE' || h.event_type === 'AI_REPLY')
            .map((h: any) => ({
                role: h.event_type === 'INCOMING_MESSAGE' ? 'user' : 'assistant',
                content: h.description.includes('"') ? h.description.split('"')[1] : h.description
            })).slice(-10);

        messages.push({ role: 'user', content: cleanMessage });

        let finalResult = await generateText({
            model: groq(selectedModel),
            system: systemPrompt,
            messages: messages,
            tools: toolsMapping,
            toolChoice: 'auto',
            temperature: 0.1,
        });

        if (finalResult.usage) {
            const { promptTokens, completionTokens, totalTokens } = finalResult.usage as any;
            console.log(`📊 [Usage] Tokens: ${promptTokens || 0} (In) / ${completionTokens || 0} (Out) — Total: ${totalTokens || 0}`);
        }

        if (finalResult.toolCalls && finalResult.toolCalls.length > 0 && !finalResult.text) {
            const executedResults = (finalResult as any).toolResults || [];
            if (executedResults.length > 0) {
                console.log(`[Ghost Brain] Tool used. Powering up for final answer...`);
                const toolResultsMessages: any[] = [...messages];
                toolResultsMessages.push({
                    role: 'assistant',
                    content: finalResult.toolCalls.map((tc: any) => ({
                        type: 'tool-call', toolCallId: tc.toolCallId, toolName: tc.toolName, input: tc.input || tc.args
                    }))
                });
                toolResultsMessages.push({
                    role: 'tool',
                    content: executedResults.map((tr: any) => ({
                        type: 'tool-result', toolCallId: tr.toolCallId, toolName: tr.toolName, output: { type: 'json', value: tr.output || tr.result }
                    }))
                });

                finalResult = await generateText({
                    model: groq('llama-3.3-70b-versatile'),
                    system: systemPrompt,
                    messages: toolResultsMessages,
                    tools: toolsMapping,
                    toolChoice: 'auto',
                    temperature: 0.1,
                });

                if (finalResult.usage) {
                    const { promptTokens, completionTokens, totalTokens } = finalResult.usage as any;
                    console.log(`📊 [Usage - Pass 2] Tokens: ${promptTokens || 0} (In) / ${completionTokens || 0} (Out) — Total: ${totalTokens || 0}`);
                }
            }
        }

        if (chatId && fullHistory.length > 0) {
            trackConversationMessage(supabase, userId, chatId, workspaceId).catch(console.error);
            summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory, workspaceId).catch(console.error);
        }

        return finalResult.text;

    } catch (error: any) {
        if (error?.statusCode === 429) return null;
        console.error('Ghost Brain Error:', error);
        return null;
    }
}
