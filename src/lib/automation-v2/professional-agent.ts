/**
 * GhostAgent Professional Brain
 *
 * Philosophy:
 * - The LLM owns wording, tone, messy language, and natural conversation.
 * - The backend owns truth: inventory, services, hours, orders, appointments.
 * - Browsing/inquiries should feel like a helpful employee, not checkout scripts.
 * - Strict state machines are only used for actual order/booking execution.
 */

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { AutomationInput, AutomationResult, WorkspaceConfig, DetectedLanguage, InventoryRecord, ServiceRecord, ConversationStage } from './types';
import { buildTimeContext } from './time';
import { loadConversationHistory } from './history';
import { searchProducts } from './ecommerce/products';
import { loadActiveServices } from './appointments/services';
import { loadBusinessHours } from './appointments/hours';
import { detectYesNo } from './language';
import { clearConversationStateV2 } from './state';
import { v2log } from './logger';

const PROFESSIONAL_MODEL = 'llama-3.3-70b-versatile';

function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    return createGroq({ apiKey });
}

function buildResult(args: {
    input: AutomationInput;
    config: WorkspaceConfig;
    replyText: string;
    language: DetectedLanguage;
    intent: string;
    actions?: string[];
    startTime: number;
    stateAfter?: ConversationStage;
}): AutomationResult {
    return {
        shouldReply: true,
        replyText: args.replyText,
        actions: args.actions || ['professional_reply'],
        stateBefore: 'idle',
        stateAfter: args.stateAfter || 'idle',
        debug: {
            requestId: crypto.randomUUID(),
            engineVersion: 'v2',
            workspaceId: args.input.workspaceId,
            workspaceType: args.config.businessType,
            chatId: args.input.chatId,
            language: args.language,
            intent: args.intent,
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            durationMs: Date.now() - args.startTime,
        },
    };
}

function languageInstruction(language: DetectedLanguage, config: WorkspaceConfig): string {
    const preferred = String(config.language || '').toLowerCase();
    if (preferred !== 'auto-detect' && preferred !== 'auto detect') {
        return `Reply in ${config.language}.`;
    }
    switch (language) {
        case 'arabizi':
            return 'Reply in natural Lebanese Arabizi/Franco, matching the customer. Do not translate literally. Example style: "Akid, shu baddak?"';
        case 'arabic':
            return 'Reply in natural Arabic.';
        case 'french':
            return 'Reply in French.';
        case 'spanish':
            return 'Reply in Spanish.';
        case 'mixed':
            return 'Reply in the same mixed style as the customer.';
        default:
            return 'Reply in English.';
    }
}

function toneInstruction(config: WorkspaceConfig): string {
    const tone = String(config.tone || 'Professional').toLowerCase();
    if (tone.includes('casual')) return 'Tone: warm, casual, confident, like a good salesperson in DMs.';
    if (tone.includes('luxury')) return 'Tone: polished, calm, premium, like a boutique concierge.';
    if (tone.includes('sarcastic')) return 'Tone: lightly witty, but never rude or confusing.';
    return 'Tone: professional, helpful, natural, and not scripted.';
}

function baseProfessionalPrompt(config: WorkspaceConfig, language: DetectedLanguage): string {
    const timeCtx = buildTimeContext(config.timezone);
    return `You are the customer-facing employee for ${config.businessName}.

${toneInstruction(config)}
${languageInstruction(language, config)}
${config.useEmojis ? 'Use at most one emoji only when it feels natural.' : 'Do not use emojis.'}

Core behavior:
- Sound like a smart human employee, not a rule-following bot.
- Answer the customer's actual question first, then guide them to the next useful step.
- Do not force checkout or booking too early.
- If the customer is browsing, help them browse.
- If the customer clearly wants to buy or book, ask for only the next missing detail.
- Ask one useful question at a time unless the customer already gave multiple details.
- Keep Instagram DM replies short: usually one or two sentences.
- Never say you are an AI.

Truth rules:
- Only use the business facts provided below.
- Never invent prices, stock, services, hours, delivery rules, or appointment availability.
- If the facts are missing, ask a natural clarifying question instead of guessing.
- Never say an order or appointment is confirmed unless the backend has confirmed it.

Current workspace time: ${timeCtx.dayName}, ${timeCtx.isoDate} ${timeCtx.isoTime}.
${config.systemInstructions || ''}`;
}

function productsFacts(products: InventoryRecord[]): string {
    if (!products.length) return 'No products are configured in inventory yet.';
    return products.map(p => `- ${p.itemName}: $${p.price}, stock ${p.stockLevel}${p.description ? `, ${p.description}` : ''}`).join('\n');
}

function servicesFacts(services: ServiceRecord[]): string {
    if (!services.length) return 'No services are configured yet.';
    return services.map(s => `- ${s.name}: $${s.price}, ${s.durationMinutes} minutes${s.description ? `, ${s.description}` : ''}`).join('\n');
}

function compactHours(hours: any[]): string {
    if (!hours?.length) return 'Working hours are not configured.';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return hours.map(h => h.isOpen ? `${days[h.dayOfWeek]} ${h.openTime}-${h.closeTime}` : `${days[h.dayOfWeek]} closed`).join(', ');
}

async function runProfessionalLLM(args: {
    input: AutomationInput;
    config: WorkspaceConfig;
    language: DetectedLanguage;
    intent: string;
    facts: string;
    guidance: string;
    temperature?: number;
}): Promise<string> {
    const groq = getGroqClient();
    if (!groq) return 'Not available at the moment.';

    const history = await loadConversationHistory(args.input.supabase, args.input.userId, args.input.workspaceId, args.input.chatId);
    const result = await generateText({
        model: groq(PROFESSIONAL_MODEL),
        system: `${baseProfessionalPrompt(args.config, args.language)}

Business facts available to you:
${args.facts}

Task:
${args.guidance}`,
        messages: [...history, { role: 'user' as const, content: args.input.message }],
        temperature: args.temperature ?? 0.45,
    });

    return (result.text || '').trim() || 'How can I help?';
}

export async function handleProfessionalProductInquiry(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    const products = await searchProducts({ supabase: input.supabase, workspaceId: input.workspaceId, limit: 20 });

    const replyText = await runProfessionalLLM({
        input,
        config,
        language,
        intent: 'professional_product_inquiry',
        facts: `Inventory:\n${productsFacts(products)}\n\nShipping rules: ${config.shippingRules || 'Not configured.'}\nStore location: ${config.storeLocation || 'Not configured.'}`,
        guidance: `Handle this as browsing/product inquiry, NOT checkout.
Examples of this mode: "what do you sell", "do you have Samsung TV", "how much is PS5", "fi 3andkon...".
Answer naturally using inventory. If there is a close match, mention it with price/stock and ask a helpful next question.
If the customer says something vague like "bde wahad" with no product, ask what product they mean.
Do not ask for name, phone, or address in this mode.`,
        temperature: 0.45,
    });

    return buildResult({ input, config, replyText, language, intent: 'product_inquiry', startTime, actions: ['product_inquiry'] });
}

export async function handleProfessionalServiceInquiry(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    const services = await loadActiveServices(input.supabase, input.workspaceId);
    const hours = await loadBusinessHours(input.supabase, input.workspaceId);

    const replyText = await runProfessionalLLM({
        input,
        config,
        language,
        intent: 'professional_service_inquiry',
        facts: `Services:\n${servicesFacts(services)}\n\nWorking hours: ${compactHours(hours)}\nLocation: ${config.storeLocation || 'Not configured.'}`,
        guidance: `Handle this as service browsing, NOT final appointment booking.
Answer service, price, duration, or availability questions naturally using the facts.
If they clearly ask to book, guide them by asking for the missing service/date/time naturally.
Do not confirm appointments in this mode.`,
        temperature: 0.45,
    });

    return buildResult({ input, config, replyText, language, intent: 'service_inquiry', startTime, actions: ['service_inquiry'] });
}

export async function handleProfessionalGeneralChat(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    const products = config.businessType === 'ecommerce'
        ? await searchProducts({ supabase: input.supabase, workspaceId: input.workspaceId, limit: 12 })
        : [];
    const services = config.businessType === 'appointments'
        ? await loadActiveServices(input.supabase, input.workspaceId)
        : [];

    const replyText = await runProfessionalLLM({
        input,
        config,
        language,
        intent: 'professional_general_chat',
        facts: config.businessType === 'ecommerce'
            ? `Business type: ecommerce. Inventory:\n${productsFacts(products)}\nShipping: ${config.shippingRules || 'Not configured.'}`
            : `Business type: appointments. Services:\n${servicesFacts(services)}`,
        guidance: `Have a natural customer DM conversation.
If the customer is vague, ask one helpful clarifying question.
If they ask what the business sells/offers, answer using the facts.
If they clearly want to order/book, guide them gently toward the next step without sounding scripted.`,
        temperature: 0.55,
    });

    return buildResult({ input, config, replyText, language, intent: 'general_chat', startTime, actions: ['conversation'] });
}

export function isClearEcommerceCheckoutIntent(message: string): boolean {
    const msg = message.toLowerCase().trim();

    // Questions/browsing should never trigger checkout directly.
    if (/\?/.test(msg) || /\b(do you have|what do you sell|what products|show me|price|how much|available|stock|catalog|menu|fi 3andkon|3andkon|ade|adde|addesh)\b/i.test(msg)) {
        return false;
    }

    // "bde wahad/wehde" without a product is vague browsing, not checkout.
    if (/\b(bde|bade|badde|baddi|bedde)\s+(wahad|wa7ad|we7de|wehde|wa7de|wahde)\b/i.test(msg) && msg.split(/\s+/).length <= 3) {
        return false;
    }

    return /\b(i\s*(want|wanna)\s*(to\s*)?(buy|order)|i'll\s*take|reserve\s*(it|one|this)|order\s*(it|one|this)|buy\s*(it|one|this)|take\s*(it|one|this)|bde\s+.*\b(ps5|tv|iphone|samsung|console|phone|headphones?)\b|badde\s+.*\b(ps5|tv|iphone|samsung|console|phone|headphones?)\b)\b/i.test(msg);
}

export function isClearBookingCheckoutIntent(message: string): boolean {
    const msg = message.toLowerCase().trim();
    if (/\b(what services|what do you offer|how much|price|available|open|hours)\b/i.test(msg)) return false;
    return /\b(book|reserve|appointment|schedule|maw3ed|mawed|7ajez|hajez|bde\s*(e7joz|a7joz|ehjez|e5od)|badde\s*(e7joz|a7joz|ehjez|e5od))\b/i.test(msg);
}

export async function clearStateIfUserBrowsesInstead(input: AutomationInput, config: WorkspaceConfig, message: string) {
    const msg = message.toLowerCase();
    const isBrowse = /\b(what do you sell|what products|do you have|show me|catalog|menu|what services|what do you offer)\b/i.test(msg);
    if (!isBrowse) return;
    await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, config.businessType, input.platform);
}
