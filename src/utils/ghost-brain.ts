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

// ─── finalize_transaction Tool Schema ─────────────────────────
// All fields are optional at the schema level; the system prompt
// instructs the AI which subset is required for each workspace type.
// This allows a single universal tool across all 6 workspace types.
const finalizeTransactionTool = tool({
    description:
        "Call this tool IMMEDIATELY once the customer has provided ALL required information " +
        "for their workspace type AND has confirmed their intent. " +
        "DO NOT call this tool if any required field is still missing. " +
        "DO NOT ask for the same field twice. " +
        "After calling this tool, send ONE brief success message and stop.",
    inputSchema: z.object({
        workspace_type: z.enum([
            'ecommerce',
            'appointments',
            'real_estate',
            'food_and_beverage',
            'events_ticketing',
            'digital_services',
        ]).describe("The active workspace type."),

        // ── Ecommerce ──
        item_name: z.string().optional().describe("Product name the customer ordered."),
        item_variant: z.string().optional().describe("Product variant or size (if applicable)."),
        payment_method: z.string().optional().describe("Payment method, e.g. Cash on Delivery."),

        // ── Universal contact fields (shared across workspace types) ──
        customer_name: z.string().optional().describe("Full name of the customer."),
        customer_phone: z.string().optional().describe("Customer phone number."),
        customer_email: z.string().optional().describe("Customer email address."),

        // ── Ecommerce / Food ──
        delivery_address: z.string().optional().describe("Delivery or shipping address."),

        // ── Food extras ──
        menu_items: z.string().optional().describe("Ordered menu items as a comma-separated list."),
        dietary_notes: z.string().optional().describe("Dietary restrictions or notes."),

        // ── Appointments ──
        service_type: z.string().optional().describe("Type of service being booked."),
        preferred_datetime: z.string().optional().describe("Preferred date and time for the appointment."),

        // ── Real Estate ──
        budget: z.string().optional().describe("Customer's budget range."),
        desired_location: z.string().optional().describe("Preferred property location(s)."),
        property_type: z.string().optional().describe("Rent or buy, and property type (apartment, villa, etc.)."),
        timeline: z.string().optional().describe("How soon the customer wants to move or invest."),

        // ── Events & Ticketing ──
        event_name: z.string().optional().describe("Name of the event."),
        ticket_count: z.string().optional().describe("Number of tickets requested."),
        ticket_tier: z.string().optional().describe("Ticket tier: VIP or General Admission."),

        // ── Digital Services ──
        service_required: z.string().optional().describe("The specific service or product the customer needs."),
        problem_description: z.string().optional().describe("Description of the customer's specific request or problem."),
    }),
});

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
        // 1. FETCH BUSINESS SETTINGS (workspace-aware)
        // ═══════════════════════════════════════
        let settingsQuery = supabase
            .from('ai_settings')
            .select('business_name, business_type, tone, system_instructions, urgency_mode, handoff_keywords, language, store_location, contact_info, use_emojis, use_local_slang, shipping_rules');

        if (workspaceId) {
            settingsQuery = settingsQuery.eq('id', workspaceId);
        } else {
            settingsQuery = settingsQuery.eq('user_id', userId);
        }

        const { data: settings } = await settingsQuery.single();

        const business: BusinessProfile = {
            business_name: settings?.business_name || 'our store',
            business_type: settings?.business_type || 'ecommerce',
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
            const memory = await getConversationMemory(supabase, userId, chatId);
            contextSummary = memory.contextSummary;
            historyContext = memory.recentHistory;
            fullHistory = memory.fullHistory;

            const recentBotMessages = memory.fullHistory
                .filter((h: any) => h.event_type === 'AI_REPLY')
                .slice(-3);
            hasGreetedRecently = recentBotMessages.some((h: any) =>
                h.description.toLowerCase().includes('welcome') ||
                h.description.toLowerCase().includes('how can i help') ||
                h.description.toLowerCase().includes('store manager')
            );

            await trackConversationMessage(supabase, userId, chatId);
        }

        // ═══════════════════════════════════════
        // 4. FETCH INVENTORY & CATALOG
        // ═══════════════════════════════════════
        let inventoryContext = 'No inventory items listed currently.';
        let catalogContext = '';

        let inventoryQuery = supabase.from('inventory').select('item_name, stock_level, price');
        if (workspaceId) {
            inventoryQuery = inventoryQuery.eq('workspace_id', workspaceId);
        } else {
            inventoryQuery = inventoryQuery.eq('user_id', userId);
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

        let knowledgeQuery = supabase.from('business_knowledge').select('content, file_name');
        if (workspaceId) {
            knowledgeQuery = knowledgeQuery.eq('workspace_id', workspaceId);
        } else {
            knowledgeQuery = knowledgeQuery.eq('user_id', userId);
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
        let finalResult = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
            tools: toolsMapping,
            toolChoice: 'auto',
            temperature: 0,
        });

        // ─── MANUAL REASONING STEP ───
        // If the LLM called a lookup tool (e.g., inventory) but provided no text, 
        // we need to feed the result back manually once so it can actually answer the user.
        // In this SDK version, tools with 'execute' are run automatically in the first pass.
        if (finalResult.toolCalls && finalResult.toolCalls.length > 0 && !finalResult.text) {
            const executedResults = (finalResult as any).toolResults || [];

            if (executedResults.length > 0) {
                console.log(`[Ghost Brain] Found ${executedResults.length} executed tool results. Looping for final answer...`);

                const toolResultsMessages: any[] = [{ role: 'user', content: userMessage }];

                // 1. Assistant message with tool calls (using .input for this SDK version)
                toolResultsMessages.push({
                    role: 'assistant',
                    content: finalResult.toolCalls.map((tc: any) => ({
                        type: 'tool-call',
                        toolCallId: tc.toolCallId,
                        toolName: tc.toolName,
                        args: tc.input || tc.args
                    }))
                });

                // 2. Tool message with results (using .output for this SDK version)
                toolResultsMessages.push({
                    role: 'tool',
                    content: executedResults.map((tr: any) => ({
                        type: 'tool-result',
                        toolCallId: tr.toolCallId,
                        toolName: tr.toolName,
                        result: tr.output || tr.result
                    }))
                });

                finalResult = await generateText({
                    model: groq('llama-3.3-70b-versatile'),
                    system: systemPrompt,
                    messages: toolResultsMessages,
                    tools: toolsMapping,
                    toolChoice: 'auto',
                    temperature: 0,
                });
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
            summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory)
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
