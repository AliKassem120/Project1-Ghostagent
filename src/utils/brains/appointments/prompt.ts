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

Enterprise rules:
- The backend provided the facts in TRUTH. Use TRUTH only.
- Never invent opening hours, appointment slots, service prices, durations, or bookings.
- Never mention tools, database, classifier, policies, JSON, or automation.
- Do not offer appointment slots when intent is business_hours.
- Do not answer business opening hours when intent is appointment_availability unless TRUTH includes hours as context.
- Do not confirm a booking unless TRUTH says the appointment was saved.
- Keep the reply to 1-2 short sentences. No markdown.

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
