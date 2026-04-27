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
    'bde', 'bade', 'baddi', 'badde', 'e5od', 'e5ud', 'ekhod',
    'maw3ed', 'mawed', '7ajez', 'hajez', 'se3a', 'sa3a',
    'shu', 'wen', 'wain', 'ade', 'adde', 'addesh',
    'btefta7', 'btfta7', 'msakrin', 'fet7in',
    'bukra', 'bokra', 'lyom', 'elyoum', 'sobo7', 'masa',
    'tamem', 'tayeb', 'akid', 'tekram', 'yalla',
    'mish', 'la2', 'fi', 'mawjud', 'mawjoud',
    'se3r', 'se3ro', 'ra2m', '3nwen', 'towsil',
    'kifak', 'kifik', 'kif halak',
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

    const has = (words: string[]) => words.some(w => normalized.includes(w));

    // Mixed Arabic + Latin
    if (hasArabic && hasLatin) return 'mixed';

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

// ── Yes/No Detection (language-agnostic) ─────────────────────

const YES_WORDS = [
    // English
    'yes', 'yeah', 'yep', 'yea', 'ok', 'okay', 'sure', 'confirm', 'correct',
    // Arabic
    'نعم', 'ايوا', 'اي', 'ايه', 'تمام', 'أكيد', 'صح', 'طيب',
    // Arabizi
    'eh', 'ee', 'akid', 'tamem', 'tayeb', 'yalla', 'mazbout',
    // French
    'oui', 'ouais', 'd\'accord', 'bien sur', 'absolument',
    // Spanish
    'si', 'claro', 'vale', 'por supuesto', 'de acuerdo',
];

const NO_WORDS = [
    // English
    'no', 'nope', 'nah', 'cancel', 'stop', 'never',
    // Arabic
    'لا', 'مش', 'ابدا',
    // Arabizi
    'la', 'la2', 'mish', 'msh',
    // French
    'non', 'pas', 'jamais', 'annuler',
    // Spanish
    'no', 'nunca', 'cancelar', 'tampoco',
];

export function detectYesNo(message: string): 'yes' | 'no' | null {
    const normalized = normalizeText(message);
    const tokens = normalized.split(' ');

    // Short messages (1-3 words) are more likely to be yes/no
    if (tokens.length <= 3) {
        if (YES_WORDS.some(w => normalized.includes(w))) return 'yes';
        if (NO_WORDS.some(w => normalized.includes(w))) return 'no';
    }

    return null;
}

// ── Name/Phone Extraction (heuristic) ────────────────────────

export function extractPhone(message: string): string | null {
    const match = message.match(/(?:\+?\d[\d\s().\-]{6,}\d)/);
    return match ? match[0].replace(/[\s()\-.]/g, '').trim() : null;
}

export function extractNameAndPhone(message: string): { name: string | null; phone: string | null } {
    const phone = extractPhone(message);
    if (!phone) return { name: null, phone: null };

    // Remove the phone from the message to get the name
    const remaining = message
        .replace(phone, '')
        .replace(/[,\-:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Filter out common non-name words
    const skipWords = ['my', 'name', 'is', 'im', 'i', 'am', 'esme', 'ana', 'phone', 'number', 'tel', 'ra2m', 'رقم', 'اسمي', 'انا'];
    const nameCandidate = remaining
        .split(' ')
        .filter(w => w.length > 1 && !skipWords.includes(w.toLowerCase()))
        .join(' ')
        .trim();

    return {
        name: nameCandidate || null,
        phone,
    };
}

// ── Address Extraction (heuristic) ───────────────────────────

export function extractAddress(message: string): string | null {
    // If the message is mostly a location/address (after removing name/phone)
    const phone = extractPhone(message);
    let remaining = message;
    if (phone) remaining = remaining.replace(phone, '');

    remaining = remaining.replace(/[,\-:]/g, ' ').replace(/\s+/g, ' ').trim();

    // Simple heuristic: if there's a word that looks like a place name
    // and the message context suggests it's an address
    if (remaining.length > 2 && remaining.length < 200) {
        return remaining;
    }

    return null;
}
