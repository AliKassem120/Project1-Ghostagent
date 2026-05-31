export const VOICE_RULES = {
  banned_phrases: [
    'as an ai',
    'how may i assist',
    'how can i help you today',
    'i am here to help',
    'please let me know',
    'thank you for your patience',
    'your request has been processed',
    'is there anything else',
    'i understand your concern',
    'i apologize for the inconvenience',
    'we value your business',
    'have a great day',
    'best regards',
  ],
  banned_patterns: [
    /^yes, /i,  // "Yes, the product..."
    /^no, /i,   // "No, we don't..."
    /\*\*/g,    // Markdown bold
    /\d+\.\s/g, // Numbered lists
  ],
  max_length: 300,
  min_length: 2,
};

export interface VoiceGuardResult {
  approved: boolean;
  correctedText: string;
  violations: string[];
}

export function checkVoiceConsistency(
  text: string,
  workspaceConfig: any,
  toolResults: any[]
): VoiceGuardResult {
  const violations: string[] = [];
  let corrected = text;

  // 1. Check banned phrases
  const lowerText = corrected.toLowerCase();
  for (const phrase of VOICE_RULES.banned_phrases) {
    if (lowerText.includes(phrase)) {
      violations.push(`Banned phrase: "${phrase}"`);
      // Strip out the phrase
      corrected = corrected.replace(new RegExp(phrase, 'gi'), '').trim();
    }
  }

  // 2. Check banned patterns
  for (const pattern of VOICE_RULES.banned_patterns) {
    if (pattern.test(corrected)) {
      violations.push(`Banned pattern: ${pattern.toString()}`);
      corrected = corrected.replace(pattern, '').trim();
    }
  }

  // 3. Length checks
  if (corrected.length > VOICE_RULES.max_length) {
    violations.push(`Too long: ${corrected.length} chars`);
    corrected = corrected.slice(0, VOICE_RULES.max_length).trim();
  }

  if (corrected.length < VOICE_RULES.min_length) {
    violations.push(`Too short: ${corrected.length} chars`);
  }

  // 4. Tone check based on config
  if (workspaceConfig.tone === 'Casual' && corrected.toLowerCase().includes('dear')) {
    violations.push('Too formal for casual tone');
    corrected = corrected.replace(/dear/gi, '').trim();
  }

  // 5. Hallucination guard — verify any price/stock claims against tool results
  const searchResult = toolResults.find(r => r.tool === 'search_products' || r.tool === 'check_stock')?.result;
  if (searchResult) {
    const product = Array.isArray(searchResult) ? searchResult[0] : searchResult;
    if (product && product.price && corrected.includes('$')) {
      const priceMatch = corrected.match(/\$(\d+(?:\.\d+)?)/);
      if (priceMatch && parseFloat(priceMatch[1]) !== product.price) {
        violations.push(`Hallucinated price: expected $${product.price}, found $${priceMatch[1]}`);
        corrected = corrected.replace(/\$(\d+(?:\.\d+)?)/, `$${product.price}`);
      }
    }
  }

  return {
    approved: violations.length === 0,
    correctedText: corrected,
    violations,
  };
}
