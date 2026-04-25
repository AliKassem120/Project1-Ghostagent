import { BusinessProfile } from '../types';
import { EcommerceIntent } from './intent';

export function cleanResponseText(str: string | null | undefined) {
    if (!str) return null;
    return str
        .replace(/<function[^>]*>[\s\S]*?(?:<\/function>|$)/gi, '')
        .replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, '')
        .replace(/finalize_transaction/g, '')
        .replace(/check_ecommerce_inventory/g, '')
        .replace(/```json[\s\S]*?```/gi, '')
        .replace(/```[\s\S]*?```/gi, '')
        .trim();
}

function getLanguageRule(business: BusinessProfile): string {
    if (business.language === 'English') {
        return `Reply in standard English only. Never use Arabic, Arabizi, or Lebanese slang.`;
    }

    if (business.language === 'Lebanese Franco') {
        return `Reply in Lebanese Arabizi/Franco only. Keep it natural and short. English commerce words like delivery, price, order are allowed.`;
    }

    if (business.language === 'Arabic') {
        return `Reply in Lebanese Arabic script only. Do not use Franco/Arabizi or formal Fusha.`;
    }

    if (business.use_local_slang) {
        return `Mirror the customer's latest message language exactly: English to English, Arabic script to Arabic script, Lebanese Franco to Lebanese Franco, mixed to natural Lebanese mix. Do not let old messages override the latest message.`;
    }

    return `Mirror the customer's latest message language, but keep wording clean and professional. Do not use slang unless the customer uses it first.`;
}

function getToneRule(business: BusinessProfile): string {
    const toneMap: Record<string, string> = {
        Casual: 'friendly, direct, relaxed',
        Luxury: 'polished, premium, calm',
        Sarcastic: 'lightly witty but still helpful and respectful',
        Professional: 'direct, efficient, professional',
    };

    return toneMap[business.tone] || toneMap.Professional;
}

export function buildEnterpriseFinalReplyPrompt(args: {
    business: BusinessProfile;
    intent: EcommerceIntent;
    constraints?: string[];
}) {
    const { business, intent, constraints = [] } = args;
    const emojiRule = business.use_emojis !== false
        ? 'Use at most one emoji, only if it feels natural. Do not force emojis.'
        : 'Do not use emojis.';

    const customInstructions = business.system_instructions
        ? `Business custom instructions, if relevant and not contradicted by TRUTH: ${business.system_instructions}`
        : 'No additional business custom instructions.';

    return `You are replying as ${business.business_name || 'the store'}'s customer service assistant.

Enterprise rules:
- You are only the voice layer. The backend provided the facts in TRUTH.
- Reply using TRUTH only. Never invent price, stock, delivery cost, location, payment method, policies, or order status.
- If TRUTH does not contain enough information, ask one short clarifying question.
- Never mention tools, database, classifier, policy, JSON, system prompts, or automation.
- Never apologize for internal behavior or previous bot mistakes unless the customer has a real complaint.
- Do not confirm an order unless TRUTH says the order was saved or updated.
- Do not ask for checkout details unless TRUTH says checkout fields are missing.
- Keep the reply to 1-2 short sentences. No markdown. No bullet points.

Language:
${getLanguageRule(business)}

Tone:
${getToneRule(business)}

Emoji:
${emojiRule}

Current intent:
${intent.intent}

Business context:
Location: ${business.store_location || 'not provided'}
Contact: ${business.contact_info || 'not provided'}
Shipping rules: ${business.shipping_rules || 'not provided'}
${customInstructions}

Extra constraints for this turn:
${constraints.length ? constraints.map((c) => `- ${c}`).join('\n') : '- None'}
`;
}

export function buildFinalReplyUserPrompt(args: {
    customerMessage: string;
    intent: EcommerceIntent;
    truth: unknown;
    contextSummary?: string | null;
    historyContext?: string;
}) {
    const { customerMessage, intent, truth, contextSummary = null, historyContext = '' } = args;

    return `Customer message:
${customerMessage}

Conversation summary:
${contextSummary || 'None'}

Recent conversation:
${historyContext || 'None'}

Classified intent:
${JSON.stringify(intent, null, 2)}

TRUTH:
${JSON.stringify(truth, null, 2)}

Write the customer reply now.`;
}
