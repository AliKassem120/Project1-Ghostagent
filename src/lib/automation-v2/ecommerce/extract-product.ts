/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Product Entity Extraction
 * ═══════════════════════════════════════════════════════════════
 * Strips filler/intent words from purchase messages to isolate
 * the actual product name before inventory search.
 *
 * "Okay i want one ps5" → { productCandidate: "ps5", quantity: 1 }
 * "bade wa7ad ps5"      → { productCandidate: "ps5", quantity: 1 }
 * "3atine one ps5"      → { productCandidate: "ps5", quantity: 1 }
 * "i need the tv samsung" → { productCandidate: "tv samsung", quantity: 1 }
 */

export interface ExtractionResult {
    productCandidate: string;
    quantity: number;
}

// Words that express intent/filler but are NOT product names
const FILLER_WORDS = new Set([
    // English intent
    'okay', 'ok', 'i', 'want', 'need', 'would', 'like', 'to',
    'the', 'a', 'an', 'please', 'pls', 'plz',
    'give', 'send', 'can', 'get', 'buy', 'order', 'purchase',
    'me', 'my', 'it', 'some', 'have', 'take', 'ill', "i'll",
    'id', "i'd", 'yes', 'yeah', 'yep',
    // Arabizi intent
    'badde', 'bade', 'bde', 'baddi',
    '3atine', 'b3atle', 'ab3atli', 'ab3atlii',
    'baddak', 'baddik',
    '3ayez', '3ayza',
    // French/Spanish
    'je', 'veux', 'voudrais', 'quiero', 'quisiera',
    'acheter', 'commander', 'comprar',
]);

// Number words → numeric quantity
const NUMBER_WORDS: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    // Arabizi numbers
    'wahad': 1, 'wa7ad': 1, 'wehde': 1, 'wa7de': 1,
    'tnen': 2, 'tnein': 2, 'talata': 3, 'tleta': 3,
    'arba3a': 4, 'arb3a': 4, '5amsa': 5, 'khamsa': 5,
};

/**
 * Extract the product candidate and quantity from a purchase message.
 * If extraction produces an empty string, returns the original message as fallback.
 */
export function extractProductCandidate(message: string): ExtractionResult {
    const normalized = message
        .toLowerCase()
        .replace(/[^a-z0-9\s\-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const tokens = normalized.split(' ');
    let quantity = 1;
    const productTokens: string[] = [];

    for (const token of tokens) {
        // Check for numeric quantity
        if (/^\d+$/.test(token)) {
            const num = parseInt(token, 10);
            if (num >= 1 && num <= 100) {
                quantity = num;
                continue;
            }
        }

        // Check for number words
        if (NUMBER_WORDS[token] !== undefined) {
            quantity = NUMBER_WORDS[token];
            continue;
        }

        // Skip filler words
        if (FILLER_WORDS.has(token)) {
            continue;
        }

        productTokens.push(token);
    }

    const candidate = productTokens.join(' ').trim();

    // If extraction produced nothing useful, fall back to original
    if (!candidate) {
        return { productCandidate: normalized, quantity };
    }

    return { productCandidate: candidate, quantity };
}
