import { BusinessProfile } from '../types';
import { AppointmentIntent } from './intent';

export function cleanAppointmentReply(str: string | null | undefined) {
    if (!str) return null;
    return str
        .replace(/<function[^>]*>[\s\S]*?(?:<\/function>|$)/gi, '')
        .replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, '')
        .replace(/```json[\s\S]*?```/gi, '')
        .replace(/```[\s\S]*?```/gi, '')
        .trim();
}

function getLanguageRule(business: BusinessProfile): string {
    if (business.language === 'English') return 'Reply in standard English only.';
    if (business.language === 'Lebanese Franco') return 'Reply in Lebanese Arabizi/Franco only, short and natural.';
    if (business.language === 'Arabic') return 'Reply in Lebanese Arabic script only. Avoid formal Fusha.';
    if (business.use_local_slang) return 'Mirror the latest customer message language exactly: English, Arabic script, Lebanese Franco, or natural mixed Lebanese.';
    return 'Mirror the latest customer message language cleanly and professionally.';
}

export function buildAppointmentFinalReplyPrompt(args: {
    business: BusinessProfile;
    intent: AppointmentIntent;
    constraints?: string[];
}) {
    const { business, intent, constraints = [] } = args;
    const emojiRule = business.use_emojis !== false ? 'Use at most one emoji if natural.' : 'Do not use emojis.';

    return `You are replying as ${business.business_name || 'the business'}'s appointment assistant.

Enterprise rules (STRICT DM STYLE):
- Reply in 1 short sentence by default. Max 2 sentences.
- Total length must be under 220 characters.
- Do NOT use forbidden phrases: "How can I assist you today", "give me a moment", "I'm checking", "suggest some options", "Kindly provide".
- Do NOT repeat location or phone number unless explicitly asked or required for a specific template.
- The backend provided the facts in TRUTH. Use TRUTH only.
- Do NOT confirm a booking unless TRUTH says the appointment was saved (booking_success: true).
- If truth contains a 'templated_reply', use that as your base and only adjust the language style (English/Arabic/Franco). Do NOT add information.

Language: ${getLanguageRule(business)}
Tone: ${business.tone || 'Professional'}
Emoji: ${emojiRule}
Current intent: ${intent.intent}

Business context:
Location: ${business.store_location || 'not provided'}
Contact: ${business.contact_info || 'not provided'}
Custom instructions: ${business.system_instructions || 'none'}

Extra constraints:
${constraints.length ? constraints.map((c) => `- ${c}`).join('\n') : '- None'}
`;
}

export function buildAppointmentFinalReplyUserPrompt(args: {
    customerMessage: string;
    intent: AppointmentIntent;
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
