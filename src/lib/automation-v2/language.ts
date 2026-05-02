/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Language Detection
 * ═══════════════════════════════════════════════════════════════
 * Unified multilingual detection: English, Arabic, Arabizi/Franco,
 * French, Spanish, Mixed.
 */

import type { DetectedLanguage } from './types';

export function normalizeText(input: string): string {
    return input
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s:.\-@$+]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function hasArabicScript(msg: string): boolean {
    return /[\u0600-\u06FF]/.test(msg);
}

function hasLatinLetters(msg: string): boolean {
    return /[a-zA-Z]/.test(msg);
}

const ARABIZI_SIGNALS = [
    'bde', 'bade', 'baddi', 'badde', 'baddak', 'baddik', 'bdak', 'bdek', 'baddna',
    'e5od', 'e5ud', 'ekhod', 'ekhed',
    'maw3ed', 'mawed', 'ma3ed', '7ajez', 'hajez', 'hajiz', 'se3a', 'sa3a', 'seaa',
    'shu', 'shi', 'wen', 'wain', 'ade', 'adde', 'addesh',
    'btefta7', 'btfta7', 'bteftah', 'msakrin', 'fet7in', 'fethin',
    'bukra', 'bokra', 'lyom', 'elyoum', 'sobo7', 'masa', 'dohor', 'ba3ed', 'ba3d',
    'tamem', 'tayeb', 'akid', 'tekram', 'yalla', 'sah', 'tmm',
    'mish', 'msh', 'la2', 'fi', 'mawjud', 'mawjoud',
    'se3r', 'se3ro', 'ra2m', '3nwen', '3enwen', 'towsil', 'tawsil',
    'kifak', 'kifik', 'kif halak',
    'we7de', 'wehde', 'wa7de', 'wahde', 'wa7ad', 'wahad', 'tnen', '2ten',
    'kholsan', '2yes', 'ma2as', 'lon', 'alwen', 'z8ir', 's8ir', 'kbir', 'makfule', 'balesh', 'asle',
    'hayda', 'hayde', 'no3', 'naw3', 'category', 'type',
    'manta2a', 'bineye', 'bser3a', 'd8re', 'halla2', 'hala2', '3al beit', '3albeit',
    't2a5arto', 'ma woselne', '8alat', 'bade badela', 'el8iya',
    'mnfa3el', 'bteb3at', 'b3atle', 'saf7a',
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

export function detectLanguage(message: string): DetectedLanguage {
    const hasArabic = hasArabicScript(message);
    const hasLatin = hasLatinLetters(message);
    const normalized = normalizeText(message);
    const has = (words: string[]) => words.some(w => normalized.includes(w));

    if (hasArabic && hasLatin) return 'mixed';
    if (hasArabic && !hasLatin) return 'arabic';
    if (has(ARABIZI_SIGNALS)) return 'arabizi';
    if (has(FRENCH_SIGNALS)) return 'french';
    if (has(SPANISH_SIGNALS)) return 'spanish';
    if (hasLatin) return 'english';
    return 'unknown';
}

const YES_WORDS = [
    'yes', 'yeah', 'yep', 'yea', 'ok', 'okay', 'sure', 'confirm', 'correct',
    'نعم', 'ايوا', 'اي', 'ايه', 'تمام', 'أكيد', 'صح', 'طيب',
    'eh', 'ee', 'akid', 'tamem', 'tmm', 'tayeb', 'yalla', 'mazbout', 'sah',
    'oui', 'ouais', 'd\'accord', 'bien sur', 'absolument',
    'si', 'claro', 'vale', 'por supuesto', 'de acuerdo',
];

const NO_WORDS = [
    'no', 'nope', 'nah', 'cancel', 'stop', 'never',
    'لا', 'مش', 'ابدا',
    'la', 'la2', 'mish', 'msh',
    'non', 'pas', 'jamais', 'annuler',
    'no', 'nunca', 'cancelar', 'tampoco',
];

export function detectYesNo(message: string): 'yes' | 'no' | null {
    const normalized = normalizeText(message);
    const tokens = normalized.split(' ');
    if (tokens.length <= 4) {
        const hasWord = (list: string[]) => tokens.some(token => list.includes(token));
        if (hasWord(YES_WORDS)) return 'yes';
        if (hasWord(NO_WORDS)) return 'no';
    }
    return null;
}

export function extractPhone(message: string): string | null {
    const match = message.match(/(?:\+?\d[\d\s().\-]{6,}\d)/);
    return match ? match[0].replace(/[\s()\-.]/g, '').trim() : null;
}

export function extractNameAndPhone(message: string): { name: string | null; phone: string | null } {
    const phone = extractPhone(message);
    if (!phone) return { name: null, phone: null };
    const remaining = message.replace(phone, '').replace(/[,\-:]/g, ' ').replace(/\s+/g, ' ').trim();
    const skipWords = ['my', 'name', 'is', 'im', 'i', 'am', 'esme', 'ana', 'phone', 'number', 'tel', 'ra2m', 'رقم', 'اسمي', 'انا'];
    const nameCandidate = remaining.split(' ').filter(w => w.length > 1 && !skipWords.includes(w.toLowerCase())).join(' ').trim();
    return { name: nameCandidate || null, phone };
}

export function extractAddress(message: string): string | null {
    const phone = extractPhone(message);
    let remaining = message;
    if (phone) remaining = remaining.replace(phone, '');
    remaining = remaining.replace(/[,\-:]/g, ' ').replace(/\s+/g, ' ').trim();
    if (remaining.length > 2 && remaining.length < 200) return remaining;
    return null;
}
