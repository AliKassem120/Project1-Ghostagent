import type { WorkspaceConfig } from '@/lib/ai/types';

export function buildPrompt(
  config: WorkspaceConfig,
  replyLanguage: string,
  ragExamples: { customer_message: string, owner_reply: string }[] | undefined,
  platform: 'instagram' | 'whatsapp',
  skipTools = false,
  services?: any[],
  recentSummaries?: string[],
  session?: any,
  customerNotes?: string[],
  emotionBlock?: string,
  proactiveBlock?: string,
  crossChannelNote?: string,
  configuredLanguage?: string
): string {
  const businessDesc = config.businessType === 'appointments'
    ? 'a service-based business that takes appointments'
    : 'an online store that sells products';

  const toneMap: Record<string, string> = {
    'Casual': 'Casual & friendly — like a cool employee texting a friend.',
    'Friendly': 'Friendly, warm, and conversational — polite, helpful, and natural.',
    'Professional': 'Professional & polished — courteous, precise, zero slang.',
    'Luxury': 'Luxury & premium — elegant, refined, exclusive language.',
    'Sarcastic': 'Sarcastic & witty — helpful but with dry humor. Never rude.',
  };
  const tone = toneMap[config.tone] || toneMap['Professional'];

  const emojiRule = config.useEmojis
    ? 'You may use up to 1 emoji per message, only when it feels natural. EXCEPTION: If the customer is frustrated, angry, or using ALL CAPS, do NOT use any emojis at all — they come across as dismissive and insincere.'
    : 'Do NOT use any emojis. Zero. No exceptions.';

  let serviceCatalogBlock = '';
  if (config.businessType === 'appointments' && services && services.length > 0) {
    const serviceLines = services.map(s =>
      `- ${s.name}: $${s.price}, ${s.durationMinutes || s.duration} min`
    ).join('\n');
    serviceCatalogBlock = `\nSERVICES MENU (from database):\n${serviceLines}\n`;
  }

  let shippingBlock = '';
  if (config.shippingRules) {
    shippingBlock = `\nSHIPPING & DELIVERY RULES:\n${config.shippingRules}\n`;
  }

  const lengthRule = 'Keep replies short and DM-style. MAX 2 SENTENCES. No paragraphs. Be natural, not robotic.';

  let memoryBlock = '';
  if (recentSummaries && recentSummaries.length > 0) {
    memoryBlock = `\nRECALLED CONVERSATION HISTORY (summaries of prior sessions):\n${recentSummaries.map((s, idx) => `- Session ${idx + 1}: ${s}`).join('\n')}\nUse these summaries to remember what was previously discussed with this customer if they refer to past events, choices, or agreements. Do not mention that you are retrieving this from database memory.\n`;
  }

  let notesBlock = '';
  if (customerNotes && customerNotes.length > 0) {
    notesBlock = `\nCUSTOMER MEMORY (things you know about this person):\n${customerNotes.map(n => `- ${n}`).join('\n')}\nUse these naturally in conversation. Never say "according to my notes" — just reference them as if you personally remember.\n`;
  }

  let sessionBlock = '';
  if (session) {
    sessionBlock = `\nCURRENT CONVERSATION STATE:\n- Current Stage: ${session.state}\n- Loop Count: ${session.loopCount}\n- Last Bot Message: ${session.lastBotMessage || 'None'}\n`;
  }

  let identityNote = '';
  if (crossChannelNote) {
    identityNote = `\n${crossChannelNote}\n`;
  }

  let culturalRules = '';
  if (replyLanguage === 'ar' || replyLanguage === 'arabizi' || replyLanguage === 'franco') {
    culturalRules = `\nCULTURAL RULES (Middle East/Levant):\n- Be warmly hospitable and welcoming.\n- If writing in Arabic, use natural conversational phrasing, not overly rigid MSA.\n`;
  } else if (replyLanguage === 'es') {
    culturalRules = `\nCULTURAL RULES (Spanish):\n- Be warm and friendly (cálido y amable).\n- Use polite forms unless the tone is strictly Casual.\n`;
  } else if (replyLanguage === 'fr') {
    culturalRules = `\nCULTURAL RULES (French):\n- Be polite and maintain a professional distance (vouvoiement) unless the tone is Casual.\n- Focus on elegance and clear formatting.\n`;
  } else {
    culturalRules = `\nCULTURAL RULES (General):\n- Be polite, direct, and culturally neutral.\n`;
  }

  return `You are the DM manager of "${config.businessName}", ${businessDesc}.
You're chatting with a customer on ${platform === 'whatsapp' ? 'WhatsApp' : 'Instagram DMs'}.

${memoryBlock}${notesBlock}${identityNote}${sessionBlock}${emotionBlock || ''}${proactiveBlock || ''}${culturalRules}
${config.systemInstructions ? `BUSINESS INFO:\n${config.systemInstructions}` : ''}
${config.storeLocation ? `LOCATION: ${config.storeLocation}` : ''}
${config.contactInfo ? `CONTACT: ${config.contactInfo}` : ''}
${shippingBlock}${serviceCatalogBlock}

=== CRITICAL RULES (these override everything above) ===
1. ${lengthRule}
2. ${tone}
3. ${emojiRule}
4. You are HUMAN. Never say you're an AI or bot.
5. ONLY reply EXACTLY with [HANDOFF] if the user explicitly asks for a human agent.
${configuredLanguage && configuredLanguage !== 'Auto-Detect' ? `6. LANGUAGE ENFORCEMENT: You MUST reply ONLY in ${configuredLanguage}. Do NOT switch languages even if the customer writes in a different language. Always respond in ${configuredLanguage}.` : ''}`;
}
