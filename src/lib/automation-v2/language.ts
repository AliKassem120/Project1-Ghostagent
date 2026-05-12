/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Language Detection
 * ═══════════════════════════════════════════════════════════════
 * Unified multilingual detection: English, Arabic, Arabizi/Franco,
 * French, Spanish, Mixed.
 *
 * ALLOWED: language vocabulary, date words, yes/no words,
 *          appointment words, price words, product words.
 * FORBIDDEN: business hours, prices, service names, products,
 *            stock, phone numbers, addresses, fake data.
 */

import type { DetectedLanguage } from './types';

// ── Normalization ────────────────────────────────────────────

export function normalizeText(input: string): string {
    return input
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s:.\-@$+]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── Script Detectors ─────────────────────────────────────────

function hasArabicScript(msg: string): boolean {
    return /[\u0600-\u06FF]/.test(msg);
}

function hasLatinLetters(msg: string): boolean {
    return /[a-zA-Z]/.test(msg);
}

// ── Signal Word Banks ────────────────────────────────────────

const ARABIZI_SIGNALS = [
    'bde', 'bade', 'baddi', 'badde', 'baddak', 'baddik', 'e5od', 'e5ud', 'ekhod',
    'maw3ed', 'mawed', '7ajez', 'hajez', 'se3a', 'sa3a',
    'shu', 'wen', 'wain', 'ade', 'adde', 'addesh',
    'btefta7', 'btfta7', 'msakrin', 'fet7in', 'fethin',
    'bukra', 'bokra', 'lyom', 'elyoum', 'sobo7', 'masa',
    'tamem', 'tayeb', 'akid', 'tekram', 'yalla', 'sah',
    'mish', 'la2', 'fi', 'mawjud', 'mawjoud',
    'se3r', 'se3ro', 'ra2m', '3nwen', 'towsil',
    'kifak', 'kifik', 'kif halak',
    // Shopping/Commerce
    'kholsan', '2yes', 'lon', 'alwen', 'z8ir', 'kbir', 'makfule', 'balesh', 'asle',
    // Logistics
    'manta2a', 'bineye', 'bser3a', 'd8re', 'halla2',
    // Complaints
    't2a5arto', 'ma woselne', '8alat', 'bade badela', 'el8iya',
    // Digital
    'mnfa3el', 'bteb3at', 'b3atle', 'saf7a',
    // Casual
    'khaye', 'e5te', 'enshalla', 'basita', 'wala yhemak', '3a rase',
];

const FRENCH_SIGNALS = [
    'je veux', 'je voudrais', 'rendez-vous', 'rendez vous',
    'bonjour', 'bonsoir', 'merci', 'svp', 's\'il vous',
    'est-ce que', 'est ce que', 'combien', 'comment',
    'disponible', 'disponibilite', 'horaire', 'horaires',
    'commande', 'commander', 'acheter', 'livraison',
    'oui', 'non', 'peut-etre', 'demain', 'aujourd',
    'quelle heure', 'a quelle',
];

const SPANISH_SIGNALS = [
    'quiero', 'quisiera', 'cita', 'reservar', 'reserva',
    'hola', 'buenos', 'buenas', 'gracias', 'por favor',
    'cuanto', 'cuanto cuesta', 'precio', 'como',
    'disponible', 'disponibilidad', 'horario',
    'pedido', 'pedir', 'comprar', 'envio', 'entrega',
    'manana', 'hoy', 'si', 'claro',
];

// ── Main Detection ───────────────────────────────────────────

export function detectLanguage(message: string): DetectedLanguage {
    const hasArabic = hasArabicScript(message);
    const hasLatin = hasLatinLetters(message);
    const normalized = normalizeText(message);

    const has = (words: string[]) => words.some(w => {
        // For short signals (≤3 chars), use word boundary matching to avoid
        // false positives like "si" matching inside "size" or "business"
        if (w.length <= 3 && !w.includes(' ')) {
            const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`\\b${escaped}\\b`).test(normalized);
        }
        return normalized.includes(w);
    });

    // ── BUG 1 FIX: Mixed Arabic + Latin ──────────────────────
    // Previously returned 'mixed' → fell back to English.
    // Now: check for Arabizi signals first. If the Latin portion
    // contains Arabizi words, this is Franco-Arabic (arabizi).
    // If no Arabizi signals, check if it's mostly Arabic script
    // with some Latin sprinkled in (still reply in Arabic/Arabizi).
    if (hasArabic && hasLatin) {
        // Check if the Latin portion contains Arabizi signals
        if (has(ARABIZI_SIGNALS)) return 'arabizi';

        // Count Arabic vs Latin characters to determine dominant script
        const arabicCharCount = (message.match(/[\u0600-\u06FF]/g) || []).length;
        const latinCharCount = (message.match(/[a-zA-Z]/g) || []).length;

        // If Arabic-dominant, reply in arabizi (our best approximation)
        if (arabicCharCount > latinCharCount) return 'arabizi';

        // If Latin-dominant with Arabic, still use arabizi
        // (user is likely code-switching, mirror their mix)
        return 'mixed';
    }

    // Pure Arabic script
    if (hasArabic && !hasLatin) return 'arabic';

    // Check Arabizi (must be before French/Spanish since they share Latin)
    if (has(ARABIZI_SIGNALS)) return 'arabizi';

    // French
    if (has(FRENCH_SIGNALS)) return 'french';

    // Spanish
    if (has(SPANISH_SIGNALS)) return 'spanish';

    // Default Latin = English
    if (hasLatin) return 'english';

    return 'unknown';
}

// ── Language Script Detection ────────────────────────────────
// Simplified version that returns just the script family.
// Used by the response generator to set the language rule.

export type LanguageScript = 'english' | 'arabic' | 'franco' | 'mixed';

export function detectLanguageScript(message: string): LanguageScript {
    const detected = detectLanguage(message);
    switch (detected) {
        case 'arabic':
            return 'arabic';
        case 'arabizi':
            return 'franco';
        case 'mixed':
            return 'mixed';
        case 'french':
        case 'spanish':
        case 'english':
        case 'unknown':
        default:
            return 'english';
    }
}

// ── Yes/No Detection (language-agnostic) ─────────────────────

const YES_WORDS = [
    // English
    'yes', 'yeah', 'yep', 'yea', 'yup', 'y', 'ok', 'okay', 'sure', 'confirm', 'confirmed', 'correct',
    'confirm it', 'proceed', 'go ahead', 'do it', 'please confirm',
    'i said yes', 'i told you yes', 'i already said yes',
    // Arabic
    'نعم', 'ايوا', 'اي', 'ايه', 'تمام', 'أكيد', 'صح', 'طيب',
    // Arabizi
    'eh', 'eeh', 'ee', 'e', 'akid', 'tamem', 'tamam', 'tayeb', 'yalla', 'mazbout',
    'aywa', 'aywah', 'tmm', 'mnih',
    // French
    'oui', 'ouais', 'd\'accord', 'bien sur', 'absolument',
    // Spanish
    'si', 'claro', 'vale', 'por supuesto', 'de acuerdo',
];

const NO_WORDS = [
    // English
    'no', 'nope', 'nah', 'cancel', 'stop', 'never', 'no thanks', 'never mind', 'dont', 'don t',
    // Arabic
    'لا', 'مش', 'ابدا',
    // Arabizi
    'la', 'la2', 'laa', 'mish', 'msh', 'mesh', 'khalas', 'ma bde', 'ma bade', 'ma badde',
    // French
    'non', 'pas', 'jamais', 'annuler',
    // Spanish
    'no', 'nunca', 'cancelar', 'tampoco',
];

export function detectYesNo(message: string): 'yes' | 'no' | null {
    const normalized = normalizeRepeatedLetters(normalizeText(message));
    const tokens = normalized.split(' ');

    const hasWord = (list: string[]) =>
        list.some(w => {
            const word = normalizeRepeatedLetters(w);
            return word.includes(' ')
                ? normalized.includes(word)
                : tokens.includes(word);
        });

    if (tokens.length <= 5) {
        if (hasWord(NO_WORDS)) return 'no';
        if (hasWord(YES_WORDS)) return 'yes';
    }

    const yesPhrases = ['i said yes', 'i told you yes', 'i already said yes', 'please confirm'];
    const noPhrases = ['never mind', 'no thanks', 'ma bde', 'ma bade', 'ma badde'];

    if (noPhrases.some(phrase => normalized.includes(phrase))) return 'no';
    if (yesPhrases.some(phrase => normalized.includes(phrase))) return 'yes';

    return null;
}

function normalizeRepeatedLetters(input: string): string {
    return input
        .replace(/\b(yes)s+\b/g, 'yes')
        .replace(/\b(yeah)h+\b/g, 'yeah')
        .replace(/\b(yep)p+\b/g, 'yep')
        .replace(/\b(no)o+\b/g, 'no');
}

// ── Name/Phone/Address Extraction (heuristic) ───────────────

export function extractPhone(message: string): string | null {
    const match = message.match(/(?:\+?\d[\d\s().\-]{6,}\d)/);
    return match ? match[0].replace(/[\s()\-.]/g, '').trim() : null;
}

/**
 * Extract name, phone, and address from a customer details message.
 * Supports formats:
 *   "Ali, 71123456, Hamra"
 *   "Ali 71123456 Hamra beirut"
 *   "esme Ali ra2me 71123456 3nwene Hamra"
 *   "name Ali phone 71123456 address Hamra"
 */
export function extractNameAndPhone(message: string): { name: string | null; phone: string | null } {
    const phone = extractPhone(message);
    if (!phone) {
        // No phone → check if the whole message is just a name
        const cleaned = message.replace(/[,\-:]/g, ' ').replace(/\s+/g, ' ').trim();
        const skipWords = ['my', 'name', 'is', 'im', 'i', 'am', 'esme', 'esmi', 'ana', 'phone', 'number', 'tel', 'ra2m', 'رقم', 'اسمي', 'انا'];
        const nameCandidate = cleaned.split(' ').filter(w => w.length > 1 && !skipWords.includes(w.toLowerCase())).join(' ').trim();
        return { name: nameCandidate || null, phone: null };
    }

    // Remove the phone from the message to process remaining parts
    const remaining = message.replace(phone, '').replace(/[\+\-\(\)]/g, ' ').replace(/\s+/g, ' ').trim();

    // Try comma-separated: "Ali, 71123456, Hamra"
    const commaParts = remaining.split(',').map(p => p.trim()).filter(p => p.length > 0);
    if (commaParts.length >= 1) {
        const nameCandidate = cleanNamePart(commaParts[0]);
        return { name: nameCandidate || null, phone };
    }

    // Try labeled format
    const labeledName = remaining.match(/(?:name|esme|esmi|ism|ismme|اسمي|اسم)\s*[:.]?\s*([^\d,]+?)(?:\s+(?:phone|ra2m|ra2me|tel|number|رقم|address|3nwen|3nwene|عنوان)|$)/i);
    if (labeledName) {
        return { name: cleanNamePart(labeledName[1]) || null, phone };
    }

    // Positional: everything before the phone number position is name
    const phoneIndex = message.indexOf(phone.replace(/[\s\-\(\)]/g, '').slice(0, 4));
    if (phoneIndex > 0) {
        const beforePhone = message.slice(0, phoneIndex).replace(/[,\-:]/g, ' ').replace(/\s+/g, ' ').trim();
        const nameCandidate = cleanNamePart(beforePhone);
        return { name: nameCandidate || null, phone };
    }

    // Fallback: first non-skip word(s) before any digits
    const words = remaining.split(' ');
    const skipWords = ['my', 'name', 'is', 'im', 'i', 'am', 'esme', 'esmi', 'ana', 'phone', 'number', 'tel', 'ra2m', 'ra2me', 'رقم', 'اسمي', 'انا', 'address', '3nwen', '3nwene', 'عنوان'];
    const nameWords: string[] = [];
    for (const w of words) {
        if (/\d{3,}/.test(w)) break; // stop at phone-like numbers
        if (w.length > 1 && !skipWords.includes(w.toLowerCase())) nameWords.push(w);
    }

    return { name: nameWords.join(' ').trim() || null, phone };
}

function cleanNamePart(s: string): string {
    const skipWords = ['my', 'name', 'is', 'im', 'i', 'am', 'esme', 'esmi', 'ana', 'phone', 'number', 'tel', 'ra2m', 'اسمي', 'انا'];
    return s.split(' ')
        .filter(w => w.length > 1 && !skipWords.includes(w.toLowerCase()))
        .join(' ')
        .trim();
}

/**
 * Extract the delivery address from a message that may also contain name/phone.
 * Address is everything AFTER the name+phone parts.
 */
export function extractAddress(message: string): string | null {
    // First check for "change address to X" pattern
    const fromChange = extractAddressFromChange(message);
    if (fromChange) return fromChange;

    const phone = extractPhone(message);

    if (phone) {
        // Find what's AFTER the phone number
        const phoneRaw = phone.replace(/[\s\-\(\)]/g, '');
        // Find the last digit of the phone in the message
        let afterPhoneIdx = -1;
        for (let i = 0; i <= message.length - phoneRaw.length; i++) {
            const chunk = message.slice(i).replace(/[\s\-\(\)]/g, '');
            if (chunk.startsWith(phoneRaw)) {
                // Find end of phone in original string
                let consumed = 0;
                let j = i;
                while (j < message.length && consumed < phoneRaw.length) {
                    if (/[\s\-\(\)]/.test(message[j])) { j++; continue; }
                    consumed++; j++;
                }
                afterPhoneIdx = j;
                break;
            }
        }

        if (afterPhoneIdx > 0 && afterPhoneIdx < message.length) {
            const afterPhone = message.slice(afterPhoneIdx).replace(/^[\s,\-:]+/, '').trim();
            // Check for labeled address
            const addressLabel = afterPhone.match(/(?:address|adress|adres|addres|3nwen|3nwene|عنوان)\s*[:.]?\s*(.+)/i);
            if (addressLabel) return addressLabel[1].trim() || null;
            if (afterPhone.length > 2 && afterPhone.length < 200) return afterPhone;
        }

        // Try comma-separated: "Ali, 71123456, Hamra"
        const parts = message.split(',').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length >= 3) {
            // Last part(s) after phone are likely address
            const phonePart = parts.findIndex(p => p.includes(phoneRaw.slice(0, 4)));
            if (phonePart >= 0 && phonePart < parts.length - 1) {
                return parts.slice(phonePart + 1).join(', ').trim() || null;
            }
        }
    }

    // No phone — check labeled address (with typo normalization)
    const labeledAddress = message.match(/(?:address|adress|adres|addres|3nwen|3nwene|عنوان)\s*[:.!]?\s*(.+)/i);
    if (labeledAddress) return labeledAddress[1].trim() || null;

    return null;
}

/**
 * Extract address from "change the address to X" / "change adres to X" patterns.
 * Strips the trigger phrase and returns only the address value.
 * Handles common typos: adres, adress, addres, 3nwen, 3nwene
 */
export function extractAddressFromChange(message: string): string | null {
    const pattern = /\b(?:change|update|switch|modify|baddel|8ayer|ghayyir)\s*(?:the|my|el|l)?\s*(?:address|adress|adres|addres|3nwen|3nwene)\s*(?:to|la|l)?\s+(.+)/i;
    const match = pattern.exec(message);
    if (match && match[1]) {
        return match[1].replace(/[,.]$/, '').trim() || null;
    }
    return null;
}

/**
 * Detect "same name", "same number/phone", "same address" reuse signals.
 * Returns which customer fields should be reused from post-context.
 */
export function detectReuseSignals(message: string): {
    reuseName: boolean;
    reusePhone: boolean;
    reuseAddress: boolean;
} {
    const msg = message.toLowerCase();
    return {
        reuseName: /\b(same\s*(name|ism)|nefs\s*(el\s*)?(ism|esm))\b/i.test(msg),
        // Matches "same number", "same phone", AND "same name and number" pattern
        reusePhone: /\b(same\s*(number|phone|ra2m|ra2em|num)|nefs\s*(el\s*)?(ra2m|ra2em|number)|same\s+\w+\s+and\s+(number|phone|ra2m))\b/i.test(msg),
        reuseAddress: /\b(same\s*(address|adress|adres|addres|3nwen|3nwene)|nefs\s*(el\s*)?(3nwen|3nwene|address))\b/i.test(msg),
    };
}
