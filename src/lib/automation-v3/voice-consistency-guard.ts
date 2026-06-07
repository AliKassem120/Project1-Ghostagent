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

  // Humanize the final output based on workspace tone
  const tone = workspaceConfig.tone || 'Friendly';
  corrected = humanizeText(corrected, tone);

  return {
    approved: violations.length === 0,
    correctedText: corrected,
    violations,
  };
}

/**
 * Humanize text by expanding contractions, adding natural variation,
 * and making it sound like a real person texting.
 */
function humanizeText(text: string, tone: string): string {
    let humanized = text;
    
    // Step 1: Expand all contractions first (normalize)
    const contractions: Record<string, string> = {
        "don't": 'do not',
        "can't": 'cannot',
        "won't": 'will not',
        "isn't": 'is not',
        "aren't": 'are not',
        "wasn't": 'was not',
        "weren't": 'were not',
        "haven't": 'have not',
        "hasn't": 'has not',
        "hadn't": 'had not',
        "wouldn't": 'would not',
        "shouldn't": 'should not',
        "couldn't": 'could not',
        "mightn't": 'might not',
        "mustn't": 'must not',
        "shan't": 'shall not',
        "let's": 'let us',
        "that's": 'that is',
        "who's": 'who is',
        "what's": 'what is',
        "where's": 'where is',
        "when's": 'when is',
        "why's": 'why is',
        "how's": 'how is',
        "it's": 'it is',
        "he's": 'he is',
        "she's": 'she is',
        "here's": 'here is',
        "there's": 'there is',
    };
    
    // Only humanize if tone is Casual or Friendly
    if (tone === 'Casual' || tone === 'Friendly' || tone === 'Sarcastic') {
        // Step 2: Re-contract for casual feel (reverse the above)
        const casualContractions = [
            { full: 'do not', contracted: "don't" },
            { full: 'cannot', contracted: "can't" },
            { full: 'will not', contracted: "won't" },
            { full: 'it is', contracted: "it's" },
            { full: 'that is', contracted: "that's" },
            { full: 'here is', contracted: "here's" },
            { full: 'let us', contracted: "let's" },
            { full: 'what is', contracted: "what's" },
            { full: 'is not', contracted: "isn't" },
            { full: 'are not', contracted: "aren't" },
            { full: 'does not', contracted: "doesn't" },
            { full: 'did not', contracted: "didn't" },
            { full: 'was not', contracted: "wasn't" },
            { full: 'were not', contracted: "weren't" },
            { full: 'has not', contracted: "hasn't" },
            { full: 'have not', contracted: "haven't" },
            { full: 'had not', contracted: "hadn't" },
            { full: 'would not', contracted: "wouldn't" },
            { full: 'should not', contracted: "shouldn't" },
            { full: 'could not', contracted: "couldn't" },
        ];
        
        for (const { full, contracted } of casualContractions) {
            const regex = new RegExp(`\\b${full}\\b`, 'gi');
            humanized = humanized.replace(regex, contracted);
        }
        
        // Step 3: Lowercase start occasionally (20% chance, not for questions or names)
        if (!humanized.match(/^(\?|Who|What|Where|When|Why|How|[A-Z][a-z]+\b)/) && Math.random() < 0.2) {
            humanized = humanized.charAt(0).toLowerCase() + humanized.slice(1);
        }
        
        // Step 4: Replace overly formal words
        const formalToCasual: Record<string, string> = {
            'however': 'but',
            'nevertheless': 'still',
            'furthermore': 'also',
            'additionally': 'plus',
            'regarding': 'about',
            'concerning': 'about',
            'utilize': 'use',
            'purchase': 'get',
            'obtain': 'get',
            'require': 'need',
            'assist': 'help',
            'inform': 'let you know',
            'apologize': 'sorry',
        };
        
        for (const [formal, casual] of Object.entries(formalToCasual)) {
            const regex = new RegExp(`\\b${formal}\\b`, 'gi');
            humanized = humanized.replace(regex, casual);
        }
        
        // Step 5: Clean up any double negatives created
        humanized = humanized.replace(/can not/gi, "can't");
    }
    
    // Step 6: Final cleanup
    humanized = humanized
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([.,!?])/g, '$1')
        .trim();
    
    return humanized;
}
