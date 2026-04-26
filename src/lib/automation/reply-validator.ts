export type ReplyValidationInput = {
  userMessage: string;
  reply: string;
  templateReply: string;
  allowLong?: boolean;
  appointmentInsertSuccess?: boolean;
  orderInsertSuccess?: boolean;
};

const CONFIRM_WORDS = ['confirmed', 'booked', 'scheduled', 'order confirmed', 'order placed', 'reserved', 'appointment is set'];

export function validateReply(input: ReplyValidationInput): { ok: boolean; reason?: string; safeReply: string } {
  const reply = input.reply.trim();
  const max = input.allowLong ? 300 : 220;
  const sentenceCount = reply.split(/[.!?]+/).filter(Boolean).length;

  if (!reply) return { ok: false, reason: 'empty_reply', safeReply: input.templateReply };
  if (reply.length > max) return { ok: false, reason: 'too_long', safeReply: input.templateReply };
  if (sentenceCount > 2) return { ok: false, reason: 'too_many_sentences', safeReply: input.templateReply };
  if (/i'?m checking|please give me a moment/i.test(reply)) return { ok: false, reason: 'filler_text', safeReply: input.templateReply };
  if (/tool|database|json|payload|classifier|schema/i.test(reply)) return { ok: false, reason: 'internal_language', safeReply: input.templateReply };

  const normalizedUser = input.userMessage.toLowerCase().replace(/\W+/g, ' ').trim();
  const normalizedReply = reply.toLowerCase().replace(/\W+/g, ' ').trim();
  if (normalizedUser && (normalizedReply.includes(normalizedUser) || similarity(normalizedUser, normalizedReply) > 0.88)) {
    return { ok: false, reason: 'parroting', safeReply: input.templateReply };
  }

  const allowsConfirm = input.appointmentInsertSuccess === true || input.orderInsertSuccess === true;
  if (!allowsConfirm && CONFIRM_WORDS.some((w) => normalizedReply.includes(w))) {
    return { ok: false, reason: 'unsafe_confirmation', safeReply: input.templateReply };
  }

  return { ok: true, safeReply: reply };
}

function similarity(a: string, b: string): number {
  const aSet = new Set(a.split(' '));
  const bSet = new Set(b.split(' '));
  const intersection = [...aSet].filter((w) => bSet.has(w)).length;
  return intersection / Math.max(aSet.size, bSet.size, 1);
}
