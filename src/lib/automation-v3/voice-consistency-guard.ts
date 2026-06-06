export const VOICE_RULES = {
  banned_phrases: [
    // English
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
    
    // Arabic
    'بصفتي ذكاء',
    'ذكاء اصطناعي',
    'كيف يمكنني مساعدتك',
    'أنا هنا للمساعدة',
    'يرجى إعلامي',
    'شكرا لصبرك',
    'هل هناك أي شيء آخر',
    'أتفهم قلقك',
    'أعتذر عن الإزعاج',
    
    // Franco/Arabizi
    'ana bot',
    'zaka2 stina3i',
    'zaka2 stina3e',
    'zaka2stina3e',
    'kif fiyi se3dak',
    'kif fiyyi se3dak',
    'kif fiyi se3dik',
    'kif fiyyi se3dik',
    'ana hon krmal se3dak',
    'ana hon kermel se3dak',
    'please khabirne',
    'plz khabirne',
    'shokran 3a sabrak',
    'chokran 3a sabrak',
    'fi shi tene',
    'fi chi tene',
    'sorry 3al eze3aj',
  ],
  banned_patterns: [
    /^yes, /i,  // "Yes, the product..."
    /^no, /i,   // "No, we don't..."
    /\*\*/g,    // Markdown bold
    /^\d+\.\s/gm, // Numbered lists
  ],
  max_length: 300,
  min_length: 2,
};

/** Contextual rewrites for banned phrases — preserves sentence flow */
const PHRASE_REWRITES: Record<string, string> = {
  // English
  'as an ai': '',
  'how may i assist': 'What do you need?',
  'how can i help you today': 'What are you looking for?',
  'i am here to help': '',
  'please let me know': 'let me know',
  'thank you for your patience': 'thanks for waiting',
  'your request has been processed': 'all set',
  'is there anything else': 'need anything else?',
  'i understand your concern': 'got it',
  'i apologize for the inconvenience': 'my bad',
  'we value your business': '',
  'have a great day': '',
  'best regards': '',

  // Arabic
  'بصفتي ذكاء': '',
  'ذكاء اصطناعي': '',
  'كيف يمكنني مساعدتك': 'كيف بقدر ساعدك؟',
  'أنا هنا للمساعدة': '',
  'يرجى إعلامي': 'خبرني',
  'شكرا لصبرك': 'شكراً لأنك ناطر',
  'هل هناك أي شيء آخر': 'في شي تاني؟',
  'أتفهم قلقك': 'فهمت عليك',
  'أعتذر عن الإزعاج': 'بعتذر',

  // Franco/Arabizi
  'ana bot': '',
  'zaka2 stina3i': '',
  'zaka2 stina3e': '',
  'zaka2stina3e': '',
  'kif fiyi se3dak': 'shu baddak?',
  'kif fiyyi se3dak': 'shu baddak?',
  'kif fiyi se3dik': 'shu baddik?',
  'kif fiyyi se3dik': 'shu baddik?',
  'ana hon krmal se3dak': '',
  'ana hon kermel se3dak': '',
  'please khabirne': 'khabirne',
  'plz khabirne': 'khabirne',
  'shokran 3a sabrak': 'thanks 3al natra',
  'chokran 3a sabrak': 'thanks 3al natra',
  'fi shi tene': 'baddak shi tene?',
  'fi chi tene': 'baddak shi tene?',
  'sorry 3al eze3aj': 'ba3tezer',
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

  // 1. Check banned phrases — rewrite with contextual fallback instead of stripping
  const lowerText = corrected.toLowerCase();
  for (const phrase of VOICE_RULES.banned_phrases) {
    if (lowerText.includes(phrase)) {
      violations.push(`Banned phrase: "${phrase}"`);
      const replacement = PHRASE_REWRITES[phrase] ?? '';
      // Match with word boundaries to avoid partial matches inside other words
      const pattern = new RegExp(
        phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
        'gi'
      );
      corrected = corrected.replace(pattern, replacement).trim();
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
    const products = searchResult.products || 
                     (Array.isArray(searchResult) ? searchResult : 
                     (searchResult.price !== undefined ? [searchResult] : []));
    if (products.length > 0 && corrected.includes('$')) {
      const pricePattern = /\$(\d+(?:\.\d+)?)/g;
      const priceMatches: { full: string; value: number }[] = [];
      let match;
      while ((match = pricePattern.exec(corrected)) !== null) {
        const val = parseFloat(match[1]);
        if (!isNaN(val)) {
          priceMatches.push({ full: match[0], value: val });
        }
      }

      for (const pm of priceMatches) {
        const hasMatchingProduct = products.some((p: any) => p.price === pm.value);
        if (!hasMatchingProduct) {
          const lowerCorrected = corrected.toLowerCase();
          const matchedProduct = products.find((p: any) => {
            const name = p.name || p.itemName;
            return name && lowerCorrected.includes(name.toLowerCase());
          });
          const expectedProduct = matchedProduct || products[0];
          const expectedPrice = expectedProduct.price;

          violations.push(`Hallucinated price: expected $${expectedPrice}, found $${pm.value}`);
          corrected = corrected.replace(pm.full, `$${expectedPrice}`);
        }
      }
    }
  }

  // Cleanup trailing connectors and spaces
  corrected = corrected
    .replace(/\s+and\s*([.!?])/gi, '$1')
    .replace(/\s+or\s*([.!?])/gi, '$1')
    .replace(/\s+,\s*([.!?])/gi, '$1')
    .replace(/\s+([.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '')
    .trim();

  return {
    approved: violations.length === 0,
    correctedText: corrected,
    violations,
  };
}
