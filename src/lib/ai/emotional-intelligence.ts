/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Emotional Intelligence
 * ═══════════════════════════════════════════════════════════════
 * Lightweight, rule-based emotion detection from customer
 * messages. No LLM call — pure regex/keyword analysis for speed.
 *
 * Detects frustration, confusion, urgency, and positivity so
 * the agent can adapt its tone and escalate when necessary.
 */

import { v2log } from './logger';

// ── Types ───────────────────────────────────────────────────

export interface EmotionSignal {
    sentiment: 'positive' | 'neutral' | 'frustrated' | 'confused' | 'urgent';
    confidence: number; // 0–1
    triggers: string[]; // which patterns matched
}

// ── Pattern Definitions ─────────────────────────────────────

const FRUSTRATED_KEYWORDS = [
    // English
    'wtf', 'terrible', 'worst', 'horrible', 'ridiculous', 'unacceptable',
    'never again', 'waste of time', 'scam', 'rip off', 'pathetic',
    'fed up', 'sick of', 'tired of', 'useless', 'incompetent',
    'disgusting', 'awful', 'joke', 'garbage', 'trash',
    // Lebanese Arabizi
    'shu hal service', 'ya3ne ma fi', 'ma 3am tez-bat', 'ta3abet',
    'kifkon hek', 'ma byemshi', 'mesh ma32oul', 'araf',
    'kes ekhtak', 'yel3an', 'haram 3laykon', 'ba3dkon',
    'ma ken lazem', 'mesh jeyye', 'khalas', 'bala zo2',
    // Arabic
    'مقرف', 'سيء', 'أسوأ', 'فاشل', 'ما بيمشي',
];

const CONFUSED_KEYWORDS = [
    // English
    "i don't understand", "what do you mean", "i'm confused",
    "that doesn't make sense", "huh", "what?", "sorry what",
    "can you explain", "i don't get it", "unclear",
    // Lebanese Arabizi
    'shu ya3ne', 'mish fehim', 'mish feh-me', 'kif ya3ne',
    'ma fhemet', 'shu 2asde', 'ma 3am efham', 'chou hada',
    // Arabic
    'مش فاهم', 'شو يعني', 'كيف يعني',
];

const URGENT_KEYWORDS = [
    // English
    'asap', 'emergency', 'urgent', 'right now', 'immediately',
    'hurry', 'rush', 'time sensitive', 'critical', 'today please',
    // Lebanese Arabizi
    'halla2', '3ajel', 'daroure', 'bi ser3a', 'el yom',
    'ma fi wa2et', 'lazem halla2', 'bser3a',
    // Arabic
    'عاجل', 'ضروري', 'هلق', 'بسرعة',
];

const POSITIVE_KEYWORDS = [
    // English
    'thank you so much', 'amazing', 'love it', 'perfect', 'wow',
    'excellent', 'fantastic', 'wonderful', 'great job', 'awesome',
    'you rock', 'best service', 'highly recommend', 'impressed',
    'so happy', 'exactly what i wanted', 'beautiful',
    // Lebanese Arabizi
    'merci ktir', 'teslam', 'teslame', 'allah y3atik', 'hayete',
    'ahla shi', 'betjannin', 'mashallah', 'ya3tikon el 3afye',
    'ktir helwe', 'perfect wallah',
    // Arabic
    'ممتاز', 'رائع', 'شكراً كتير', 'الله يعطيك',
];

// ── Detection Engine ────────────────────────────────────────

/**
 * Detect the emotional tone of the current message and recent
 * conversation history. Returns the dominant emotion signal.
 *
 * This is purely rule-based — no LLM call, runs in < 1ms.
 */
export function detectEmotion(
    message: string,
    conversationHistory?: { role: string; content: string }[]
): EmotionSignal {
    const msgLower = message.toLowerCase().trim();
    const triggers: string[] = [];
    const scores = { frustrated: 0, confused: 0, urgent: 0, positive: 0 };

    // ── 1. Keyword matching ─────────────────────────────────
    for (const kw of FRUSTRATED_KEYWORDS) {
        if (msgLower.includes(kw)) {
            scores.frustrated += 2;
            triggers.push(`keyword:${kw}`);
        }
    }
    for (const kw of CONFUSED_KEYWORDS) {
        if (msgLower.includes(kw)) {
            scores.confused += 2;
            triggers.push(`keyword:${kw}`);
        }
    }
    for (const kw of URGENT_KEYWORDS) {
        if (msgLower.includes(kw)) {
            scores.urgent += 2;
            triggers.push(`keyword:${kw}`);
        }
    }
    for (const kw of POSITIVE_KEYWORDS) {
        if (msgLower.includes(kw)) {
            scores.positive += 2;
            triggers.push(`keyword:${kw}`);
        }
    }

    // ── 2. Punctuation / formatting signals ─────────────────
    const capsRatio = message.replace(/[^a-zA-Z]/g, '').length > 0
        ? (message.replace(/[^A-Z]/g, '').length / message.replace(/[^a-zA-Z]/g, '').length)
        : 0;
    if (capsRatio > 0.7 && message.length > 5) {
        scores.frustrated += 3;
        triggers.push('all_caps');
    }

    const excessiveExclamation = (message.match(/!{2,}/g) || []).length;
    if (excessiveExclamation > 0) {
        scores.frustrated += excessiveExclamation;
        triggers.push('excessive_exclamation');
    }

    const excessiveQuestion = (message.match(/\?{2,}/g) || []).length;
    if (excessiveQuestion > 0) {
        scores.confused += excessiveQuestion;
        triggers.push('excessive_question_marks');
    }

    // ── 3. Conversation history patterns ────────────────────
    if (conversationHistory) {
        // Get all user messages in history
        const userMsgs = conversationHistory
            .filter(m => m.role === 'user')
            .map(m => m.content.toLowerCase().trim());

        // Check if current message is a repeat of the last user message in history
        if (userMsgs.length >= 1) {
            const lastUserMsg = userMsgs[userMsgs.length - 1];
            const words1 = new Set(lastUserMsg.split(/\s+/));
            const words2 = new Set(msgLower.split(/\s+/));
            let overlap = 0;
            words1.forEach(w => { if (words2.has(w)) overlap++; });
            const similarity = overlap / Math.max(words1.size, words2.size, 1);
            const minSize = Math.min(words1.size, words2.size);
            const containRatio = minSize > 0 ? overlap / minSize : 0;
            if (similarity > 0.6 || (containRatio > 0.85 && minSize >= 3)) {
                scores.frustrated += 2;
                triggers.push('repeated_message');
            }
        }

        // Also check if history itself has repeated messages
        if (userMsgs.length >= 2) {
            const lastTwo = userMsgs.slice(-2);
            const words1 = new Set(lastTwo[0].split(/\s+/));
            const words2 = new Set(lastTwo[1].split(/\s+/));
            let overlap = 0;
            words1.forEach(w => { if (words2.has(w)) overlap++; });
            const similarity = overlap / Math.max(words1.size, words2.size, 1);
            const minSize = Math.min(words1.size, words2.size);
            const containRatio = minSize > 0 ? overlap / minSize : 0;
            if ((similarity > 0.6 || (containRatio > 0.85 && minSize >= 3)) && !triggers.includes('repeated_message')) {
                scores.frustrated += 2;
                triggers.push('repeated_message');
            }
        }

        // Check if user asked the same question the bot just asked them
        const lastBotMsg = conversationHistory
            .filter(m => m.role === 'assistant')
            .pop()?.content?.toLowerCase() || '';
        if (lastBotMsg && msgLower.includes('?') && lastBotMsg.includes('?')) {
            // Both the bot and user are asking questions — potential confusion
            scores.confused += 1;
            triggers.push('mutual_questions');
        }
    }

    // ── 4. Determine dominant emotion ───────────────────────
    const maxScore = Math.max(scores.frustrated, scores.confused, scores.urgent, scores.positive);

    if (maxScore === 0) {
        return { sentiment: 'neutral', confidence: 1.0, triggers: [] };
    }

    let sentiment: EmotionSignal['sentiment'];
    if (scores.frustrated >= scores.confused && scores.frustrated >= scores.urgent && scores.frustrated >= scores.positive) {
        sentiment = 'frustrated';
    } else if (scores.confused >= scores.urgent && scores.confused >= scores.positive) {
        sentiment = 'confused';
    } else if (scores.urgent >= scores.positive) {
        sentiment = 'urgent';
    } else {
        sentiment = 'positive';
    }

    // Confidence: normalize score to 0-1 range (cap at 10 points = 1.0)
    const confidence = Math.min(maxScore / 10, 1.0);

    if (sentiment !== 'positive') {
        v2log.info('EMOTION', `Detected ${sentiment} (confidence: ${confidence.toFixed(2)})`, { triggers });
    }

    return { sentiment, confidence, triggers };
}

// ── Prompt Block Builder ────────────────────────────────────

/**
 * Build a prompt injection block based on detected emotion.
 * Returns empty string for neutral/positive sentiments.
 */
export function buildEmotionPromptBlock(signal: EmotionSignal): string {
    if (signal.sentiment === 'neutral' || signal.sentiment === 'positive') {
        return '';
    }

    if (signal.sentiment === 'frustrated') {
        return `
EMOTIONAL CONTEXT: The customer appears FRUSTRATED (${signal.triggers.join(', ')}).
- Be extra empathetic and patient. Acknowledge their frustration sincerely.
- Apologize for any inconvenience without making excuses.
- If you cannot resolve their issue quickly, offer to connect them with the owner.
- Do NOT repeat the same question they already answered.
- Keep your reply calm and helpful — never match their frustration.
- Do NOT use ANY emojis in your reply. Zero emojis. They come across as dismissive when someone is upset.`;
    }

    if (signal.sentiment === 'confused') {
        return `
EMOTIONAL CONTEXT: The customer seems CONFUSED (${signal.triggers.join(', ')}).
- Re-explain clearly and simply. Use shorter sentences.
- Give a specific example or option to choose from instead of an open-ended question.
- Do NOT use jargon or technical terms.
- Be patient — they may need things broken down step by step.`;
    }

    if (signal.sentiment === 'urgent') {
        return `
EMOTIONAL CONTEXT: The customer has an URGENT request (${signal.triggers.join(', ')}).
- Prioritize their request. Skip pleasantries and get straight to helping.
- If you can resolve it now, do so immediately.
- If you need more info, ask only the essential minimum.
- Acknowledge the urgency: "I understand this is urgent, let me help right away."`;
    }

    return '';
}
