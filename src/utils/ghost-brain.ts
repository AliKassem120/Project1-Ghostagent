// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Core AI Brain (v3 — Function Calling)
// Integrates: Dynamic System Prompt, Rolling Memory,
// Function Calling (finalize_transaction), and tenant-aware logic.
// ═══════════════════════════════════════════════════════════════

import { createGroq } from '@ai-sdk/groq';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { buildSystemPrompt, type BusinessProfile, type PromptContext } from './system-prompt-builder';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from './rolling-memory';
import { completeCheckoutOrder } from './checkout-flow';
import {
    checkEcommerceInventoryTool,
    checkCalendarAvailabilityTool,
    searchActiveListingsTool,
    searchMenuItemsTool,
    checkTicketAvailabilityTool,
    fetchSupportDocsTool
} from './ghost-read-tools';

// ─── Tool Result ───────────────────────────────────────────────
export interface TransactionResult {
    saved: boolean;
    workspace_type: string;
    data: Record<string, string | null>;
}

// ─── Success Messages (brief, per workspace type) ──────────────
const SUCCESS_MESSAGES: Record<string, string> = {
    ecommerce: "All set! Your order is confirmed and will be processed shortly. 🎉",
    appointments: "Booked! You'll receive a confirmation shortly. 📅",
    real_estate: "Got it! Our team will be in touch to schedule your viewing. 🏡",
    food_and_beverage: "Order placed! Sit tight — it's on its way. 🍽️",
    events_ticketing: "You're on the list! Check your email for your ticket. 🎟️",
    digital_services: "Request received! Our team will reach out within 24 hours. 💻",
    default: "All done! We've got everything we need. ✅",
};


export async function generateGhostReply(
    userId: string,
    userMessage: string,
    supabase: any,
    chatId?: string,
    workspaceId?: string,
    checkoutContext?: string
) {
    console.log('👻 Ghost Brain v3: Generating reply for', userId, workspaceId ? `(workspace: ${workspaceId})` : '');

    try {
        // ═══════════════════════════════════════
        // 1. FETCH BUSINESS SETTINGS (workspace-aware — STRICT isolation)
        // ═══════════════════════════════════════
        // CRITICAL: When workspaceId is provided, ONLY query by workspace ID.
        // Never fall-through to user_id when a workspace is known — that would
        // bleed settings from another workspace of the same user.
        let settingsQuery = supabase
            .from('ai_settings')
            .select('business_name, business_type, tone, system_instructions, urgency_mode, handoff_keywords, language, store_location, contact_info, use_emojis, use_local_slang, shipping_rules, is_autopilot_enabled');

        if (workspaceId) {
            settingsQuery = settingsQuery.eq('id', workspaceId);
        } else {
            settingsQuery = settingsQuery.eq('user_id', userId).is('id', null); // only match user-level rows (no workspace)
        }

        const { data: settings, error: settingsError } = await settingsQuery.limit(1).maybeSingle();

        if (settingsError) {
            console.warn('⚠️ Business settings fetch warning:', settingsError.message);
        }

        if (!settings) {
            // If we have a workspaceId but found no settings, fallback to user-level settings
            // (this handles edge cases where the workspace was created but settings not yet saved)
            if (workspaceId) {
                console.warn(`⚠️ No ai_settings for workspace ${workspaceId} — falling back to user-level settings`);
            }
        }

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

        // ═══════════════════════════════════════
        // 2. GHOST PROTOCOL: Handoff Check
        // ═══════════════════════════════════════
        if (Array.isArray(business.handoff_keywords) && business.handoff_keywords.some(
            (kw: string) => userMessage.toLowerCase().includes(kw.toLowerCase())
        )) {
            console.log('🛑 Ghost Protocol: Handoff Keyword Detected. Pausing AI.');
            return null;
        }

        // ═══════════════════════════════════════
        // 3. FETCH CONVERSATION MEMORY (Rolling)
        // ═══════════════════════════════════════
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

            const recentBotMessages = fullHistory
                .filter((h: any) => h.event_type === 'AI_REPLY')
                .slice(-3);
            hasGreetedRecently = recentBotMessages.some((h: any) =>
                h.description.toLowerCase().includes('welcome') ||
                h.description.toLowerCase().includes('how can i help') ||
                h.description.toLowerCase().includes('store manager')
            );
        }

        // ═══════════════════════════════════════
        // 4. FETCH INVENTORY & CATALOG (workspace-isolated)
        // ═══════════════════════════════════════
        let inventoryContext = 'No inventory items listed currently.';
        let catalogContext = '';

        // STRICT workspace isolation: never mix inventory between workspaces
        let inventoryQuery = supabase.from('inventory').select('item_name, stock_level, price');
        if (workspaceId) {
            inventoryQuery = inventoryQuery.eq('workspace_id', workspaceId);
        } else {
            inventoryQuery = inventoryQuery.eq('user_id', userId).is('workspace_id', null);
        }
        const { data: inventory } = await inventoryQuery.limit(50);

        if (inventory?.length) {
            inventoryContext = inventory
                .map((i: any) => {
                    const availability = i.stock_level > 0 ? 'In Stock' : 'Out of Stock';
                    return `- ${i.item_name}: ${availability} ($${i.price})`;
                })
                .join('\n');
        }

        // STRICT workspace isolation for knowledge base
        let knowledgeQuery = supabase.from('business_knowledge').select('content, file_name');
        if (workspaceId) {
            knowledgeQuery = knowledgeQuery.eq('workspace_id', workspaceId);
        } else {
            knowledgeQuery = knowledgeQuery.eq('user_id', userId).is('workspace_id', null);
        }
        const { data: knowledgeData } = await knowledgeQuery.single();

        if (knowledgeData?.content) {
            try {
                const catalogItems = JSON.parse(knowledgeData.content);
                catalogContext = `PRODUCT CATALOG:\n${JSON.stringify(catalogItems, null, 2)}`;
            } catch { /* ignore parse errors */ }
        }

        // ═══════════════════════════════════════
        // 5. BUILD THE DYNAMIC SYSTEM PROMPT
        // ═══════════════════════════════════════
        const promptContext: PromptContext = {
            business,
            inventoryContext,
            catalogContext,
            historyContext,
            contextSummary,
            hasGreetedRecently,
        };

        const basePrompt = buildSystemPrompt(promptContext);
        const systemPrompt = checkoutContext ? `${checkoutContext}\n\n${basePrompt}` : basePrompt;

        // ═══════════════════════════════════════
        // 6. GENERATE AI RESPONSE (with Tool Calling)
        // ═══════════════════════════════════════

        // Define the finalize_transaction tool inside so it can use the closure (supabase, userId, etc.)
        // Dynamically build strict Zod schemas per workspace type to force LLM field collection
        let transactionSchema: z.ZodType<any>;
        switch (business.business_type) {
            case 'ecommerce':
                transactionSchema = z.object({
                    workspace_type: z.literal('ecommerce'),
                    item_name: z.string().describe("Product name the customer ordered."),
                    item_variant: z.string().optional().describe("Product variant or size (if applicable)."),
                    payment_method: z.string().describe("Payment method, e.g. Cash on Delivery."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_phone: z.string().describe("Customer phone number."),
                    delivery_address: z.string().describe("Delivery or shipping address."),
                });
                break;
            case 'appointments':
                transactionSchema = z.object({
                    workspace_type: z.literal('appointments'),
                    service_type: z.string().describe("Type of service being booked."),
                    preferred_datetime: z.string().describe("Preferred date and time for the appointment."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_phone: z.string().optional().describe("Customer phone number."),
                    customer_email: z.string().optional().describe("Customer email address. (At least one contact method is required)"),
                });
                break;
            case 'real_estate':
                transactionSchema = z.object({
                    workspace_type: z.literal('real_estate'),
                    budget: z.string().describe("Customer's budget range."),
                    desired_location: z.string().describe("Preferred property location(s)."),
                    property_type: z.string().describe("Rent or buy, and property type (apartment, villa, etc.)."),
                    timeline: z.string().describe("How soon the customer wants to move or invest."),
                    customer_name: z.string().describe("Full name of the prospect."),
                    customer_phone: z.string().describe("Customer phone number."),
                });
                break;
            case 'food_and_beverage':
                transactionSchema = z.object({
                    workspace_type: z.literal('food_and_beverage'),
                    menu_items: z.string().describe("Ordered menu items as a comma-separated list."),
                    delivery_address: z.string().describe("Delivery address OR 'pickup'."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_phone: z.string().describe("Customer phone number."),
                    dietary_notes: z.string().optional().describe("Dietary restrictions or notes."),
                });
                break;
            case 'events_ticketing':
                transactionSchema = z.object({
                    workspace_type: z.literal('events_ticketing'),
                    event_name: z.string().describe("Name of the event."),
                    ticket_count: z.string().describe("Number of tickets requested."),
                    ticket_tier: z.string().describe("Ticket tier: VIP or General Admission."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_email: z.string().describe("Email address (for digital ticket delivery)."),
                });
                break;
            case 'digital_services':
                transactionSchema = z.object({
                    workspace_type: z.literal('digital_services'),
                    service_required: z.string().describe("The specific service or product the customer needs."),
                    problem_description: z.string().describe("Description of the customer's specific request or problem."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_email: z.string().describe("Email address (for delivery or support)."),
                });
                break;
            default:
                transactionSchema = z.object({
                    workspace_type: z.string().describe("The active workspace type."),
                    customer_name: z.string().describe("Full name of the customer."),
                    customer_phone: z.string().optional().describe("Customer phone number."),
                    delivery_address: z.string().optional().describe("Delivery or shipping address."),
                });
        }

        const finalizeTransactionTool = tool({
            description:
                "Call this tool ONLY AND IMMEDIATELY once the customer has provided ALL required information " +
                "for their workspace type (Name, Phone, Address, etc.) AND has confirmed their intent. " +
                "CRITICAL: If any required field is missing (e.g. you don't have their name or phone), " +
                "STOP and ask the customer for the missing information. DO NOT call this tool with empty or placeholder values. " +
                "Do not ask for the same field twice. " +
                "After calling this tool, send ONE brief success message and stop.",
            inputSchema: transactionSchema,
            execute: async (args) => {
                console.log('✅ Finalizing transaction via tool:', args);
                let handle = chatId || 'unknown_customer';
                let itemRequested = 'General Request';
                try {
                    // 1. Resolve customer handle from activity_log metadata
                    const { data: lastMsg } = await supabase
                        .from('activity_log')
                        .select('metadata')
                        .eq('user_id', userId)
                        .filter('metadata->>chat_id', 'eq', chatId)
                        .order('timestamp', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (lastMsg?.metadata?.username) {
                        handle = lastMsg.metadata.username;
                    }

                    // 2. Map workspace items based on type
                    itemRequested = args.item_name || args.service_type || args.event_name || args.service_required || 'General Request';

                    // 3. Insert into orders table
                    const { error } = await supabase.from('orders').insert({
                        user_id: userId,
                        workspace_id: workspaceId || null,
                        instagram_handle: handle,
                        instagram_user_id: chatId,
                        item_requested: itemRequested,
                        customer_name: args.customer_name || null,
                        customer_phone: args.customer_phone || null,
                        customer_address: args.delivery_address || null,
                        status: 'Pending',
                        created_at: new Date().toISOString(),
                    });

                    if (error) throw error;
                    console.log(`✅ [Ghost Brain] Order saved for ${handle}: ${itemRequested}`);

                    return {
                        status: 'success',
                        message: "Transaction finalized and saved to the dashboard.",
                        order_details: {
                            item: itemRequested,
                            customer: args.customer_name || 'Guest'
                        }
                    };
                } catch (err: any) {
                    console.error('❌ [Ghost Brain] Failed to finalize transaction:', err);

                    // Fallback: If column is missing, try inserting without it to at least save the lead
                    if (err?.message?.includes('customer_address')) {
                        console.log('🔄 Retrying order insert without customer_address column...');
                        const { error: retryError } = await supabase.from('orders').insert({
                            user_id: userId,
                            workspace_id: workspaceId || null,
                            instagram_handle: handle,
                            instagram_user_id: chatId,
                            item_requested: itemRequested,
                            customer_name: args.customer_name || null,
                            customer_phone: args.customer_phone || null,
                            status: 'Pending',
                            raw_message: `Address (fallback): ${args.delivery_address || 'N/A'}`
                        });
                        if (!retryError) return { status: 'success', message: "Order saved (with address in notes)." };
                    }

                    return { status: 'error', message: "Failed to save the transaction to the database." };
                }
            }
        });

        const toolsMapping: Record<string, any> = { finalize_transaction: finalizeTransactionTool };

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

        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

        // ─── MODEL TIERING (Intent Detection & Vision) ───
        const purchaseKeywords = ['buy', 'order', 'checkout', 'pay', 'purchase', 'book', 'schedule', 'viewing', 'ticket', 'delivery', 'shipping'];
        const isPurchaseIntent = purchaseKeywords.some(kw => userMessage.toLowerCase().includes(kw));
        const hasActiveToolContext = historyContext.toLowerCase().includes('transaction') || historyContext.toLowerCase().includes('order');

        // Extract attachment URL if present
        const attachmentMatch = userMessage.match(/\[ATTACHMENT:(.*?)\]/);
        const attachmentUrl = attachmentMatch ? attachmentMatch[1] : null;

        // Strip the attachment tag from the text prompt
        const cleanMessage = userMessage.replace(/\[ATTACHMENT:.*?\]/g, '').trim() || 'What is this?';

        // Choose Model: Use Vision if attachment, Big Brain (70B) for transactions, else use fast/cheap 8B
        let selectedModel = 'llama-3.1-8b-instant';
        if (attachmentUrl) selectedModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
        else if (isPurchaseIntent || hasActiveToolContext || checkoutContext) selectedModel = 'llama-3.3-70b-versatile';

        console.log(`🚀 [Ghost Brain] Selected Model: ${selectedModel} (${attachmentUrl ? 'Vision' : isPurchaseIntent ? 'Purchase Intent' : 'General Chat'})`);

        // ─── CONSTRUCT MESSAGE HISTORY ───
        // Map the database activity_log history to a format the LLM understands (role: user/assistant)
        const messages: any[] = (fullHistory || [])
            .filter((h: any) => h.event_type === 'INCOMING_MESSAGE' || h.event_type === 'AI_REPLY')
            .map((h: any) => ({
                role: h.event_type === 'INCOMING_MESSAGE' ? 'user' : 'assistant',
                content: h.description.includes('"') ? h.description.split('"')[1] : h.description // Extract text from log description
            }))
            .slice(-10); // Keep last 10 messages for context efficiency

        // Append the current message
        if (attachmentUrl) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: cleanMessage },
                    { type: 'image', image: attachmentUrl }
                ]
            });
        } else {
            messages.push({ role: 'user', content: cleanMessage });
        }

        let finalResult = await generateText({
            model: groq(selectedModel),
            system: systemPrompt,
            messages: messages,
            tools: toolsMapping,
            toolChoice: 'auto',
            temperature: 0,
        });

        // Log Usage
        if (finalResult.usage) {
            const { promptTokens, completionTokens, totalTokens } = finalResult.usage as any;
            console.log(`📊 [Usage] Tokens: ${promptTokens || 0} (In) / ${completionTokens || 0} (Out) — Total: ${totalTokens || 0}`);
        }

        // ─── MANUAL REASONING STEP ───
        // If the LLM called a lookup tool (e.g., inventory) but provided no text, 
        // we need to feed the result back manually once so it can actually answer the user.
        if (finalResult.toolCalls && finalResult.toolCalls.length > 0 && !finalResult.text) {
            const executedResults = (finalResult as any).toolResults || [];

            if (executedResults.length > 0) {
                console.log(`[Ghost Brain] Tool used. Powering up for final answer...`);

                const toolResultsMessages: any[] = [{ role: 'user', content: userMessage }];

                // Assistant message with tool calls
                toolResultsMessages.push({
                    role: 'assistant',
                    content: finalResult.toolCalls.map((tc: any) => ({
                        type: 'tool-call',
                        toolCallId: tc.toolCallId,
                        toolName: tc.toolName,
                        input: tc.input || tc.args
                    }))
                });

                // Tool message with results
                toolResultsMessages.push({
                    role: 'tool',
                    content: executedResults.map((tr: any) => ({
                        type: 'tool-result',
                        toolCallId: tr.toolCallId,
                        toolName: tr.toolName,
                        output: { type: 'json', value: tr.output || tr.result }
                    }))
                });

                finalResult = await generateText({
                    model: groq('llama-3.3-70b-versatile'), // Always use 70B for the final reasoning pass if tools were involved
                    system: systemPrompt,
                    messages: toolResultsMessages,
                    tools: toolsMapping,
                    toolChoice: 'auto',
                    temperature: 0,
                });

                if (finalResult.usage) {
                    const { promptTokens, completionTokens, totalTokens } = finalResult.usage as any;
                    console.log(`📊 [Usage - Pass 2] Tokens: ${promptTokens || 0} (In) / ${completionTokens || 0} (Out) — Total: ${totalTokens || 0}`);
                }
            }
        }

        const result = finalResult;

        // ═══════════════════════════════════════
        // 7. HANDLE TOOL CALLS (finalize_transaction)
        // ═══════════════════════════════════════
        // In this version of the SDK, if a tool is called, it's available in result.toolCalls
        if (result.toolCalls && result.toolCalls.length > 0) {
            const toolCall = result.toolCalls.find((tc: any) => tc.toolName === 'finalize_transaction');
            if (toolCall && toolCall.type === 'tool-call') {
                const args = ((toolCall as any).input || (toolCall as any).args) as Record<string, string | undefined>;

                console.log('🔧 [Tool] finalize_transaction called with args:', args);

                const wsType = args?.workspace_type || business.business_type;

                // ── Persist the data to Supabase ──────────────────────────
                try {
                    // Build a unified order record that captures all fields
                    const orderPayload: Record<string, any> = {
                        user_id: userId,
                        workspace_id: workspaceId || null,
                        instagram_user_id: chatId || null,
                        instagram_handle: chatId || null,
                        status: 'Pending',
                        created_at: new Date().toISOString(),
                        // Universal
                        customer_name: args?.customer_name || null,
                        customer_phone: args?.customer_phone || null,
                        customer_email: args?.customer_email || null,
                        // Workspace-specific — store as item_requested (JSON string) for non-ecommerce
                        item_requested: buildOrderDescription(wsType, args),
                        customer_address: args?.delivery_address || null,
                        payment_method: args?.payment_method || 'Cash on Delivery',
                    };

                    const { error: orderError } = await supabase.from('orders').insert(orderPayload);
                    if (orderError) {
                        console.error('❌ [Tool] Failed to save order:', orderError.message);
                    } else {
                        console.log(`✅ [Tool] Order saved for workspace type: ${wsType}`);
                    }
                } catch (saveErr) {
                    console.error('❌ [Tool] Exception while saving:', saveErr);
                }

                // ── Return short success message (never loop back) ─────────
                const successMsg = SUCCESS_MESSAGES[wsType] || SUCCESS_MESSAGES.default;
                console.log(`✅ [Tool] Returning success message: "${successMsg}"`);
                return successMsg;
            }
        }

        // ═══════════════════════════════════════
        // 8. BACKGROUND: Rolling Summarization
        // ═══════════════════════════════════════
        if (chatId && fullHistory.length > 0) {
            trackConversationMessage(supabase, userId, chatId, workspaceId)
                .catch(err => console.error('⚠️ message tracking failed:', err));
            summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory, workspaceId)
                .catch(err => console.error('⚠️ Background summarization failed:', err));
        }

        return result.text;

    } catch (error: any) {
        // Rate limit — stay silent
        if (error?.message?.includes('rate_limit') || error?.statusCode === 429 || error?.message?.includes('Rate limit')) {
            console.warn('⚠️ Ghost Brain: Groq rate limit hit — skipping reply.');
            return null;
        }
        console.error('Ghost Brain Error:', error);
        return null;
    }
}

// ─── Build human-readable order description per workspace type ─
function buildOrderDescription(
    workspaceType: string,
    args: Record<string, string | undefined>
): string {
    switch (workspaceType) {
        case 'ecommerce':
            return [args.item_name, args.item_variant].filter(Boolean).join(' — ') || 'Unknown item';
        case 'appointments':
            return `Service: ${args.service_type || 'N/A'} at ${args.preferred_datetime || 'TBD'}`;
        case 'real_estate':
            return `${args.property_type || 'Property'} in ${args.desired_location || 'N/A'} — Budget: ${args.budget || 'N/A'} — Timeline: ${args.timeline || 'N/A'}`;
        case 'food_and_beverage':
            return [args.menu_items, args.dietary_notes ? `(Notes: ${args.dietary_notes})` : null].filter(Boolean).join(' ') || 'Food order';
        case 'events_ticketing':
            return `${args.event_name || 'Event'} — ${args.ticket_count || '1'} × ${args.ticket_tier || 'General'}`;
        case 'digital_services':
            return `${args.service_required || 'Service'}: ${args.problem_description || 'N/A'}`;
        default:
            return 'Order';
    }
}
