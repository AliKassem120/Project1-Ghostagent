/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Types
 * ═══════════════════════════════════════════════════════════════
 * All shared type definitions.
 */

// ── Engine Input / Output ────────────────────────────────────

export interface AutomationInput {
    workspaceId: string;
    workspaceType: 'appointments' | 'ecommerce' ;
    chatId: string;
    message: string;
    platform: 'instagram' | 'whatsapp';
    /** Supabase admin client (service role) */
    supabase: any;
    /** Owner user ID */
    userId: string;
    /** Customer profile from platform */
    customer?: {
        name?: string | null;
        username?: string | null;
        profilePic?: string | null;
    };
    /** Message type from webhook (text, image, audio, reaction, etc.) */
    messageType?: string;
    /** Whether this is a reaction event */
    isReaction?: boolean;
    /** Whether the message has media attached */
    hasMedia?: boolean;
    /** Type of media if any (image, audio, video, sticker, etc.) */
    mediaType?: string;
}

// Inlined from deleted state/types
export type ConversationStage = 'idle' | 'collecting' | 'confirming' | 'complete';

export interface AutomationResult {
    shouldReply: boolean;
    replyText?: string;
    actions: string[];
    stateBefore: ConversationStage;
    stateAfter: ConversationStage;
    debug: AutomationDebug;
    error?: string;
    cancelMeta?: {
        requestedScope?: string;
        requestedCount?: number;
        cancelledCount?: number;
    };
}

export interface AutomationDebug {
    requestId: string;
    engineVersion: 'v2' | 'v3' | 'v3-agent';
    workspaceId: string;
    workspaceType: 'appointments' | 'ecommerce' ;
    chatId: string;
    language: DetectedLanguage;
    intent?: string;
    dbWriteAttempted: boolean;
    dbWriteSuccess: boolean;
    blockedReason?: string;
    replyBeforeGuard?: string | null;
    replyAfterGuard?: string | null;
    durationMs: number;
    /** Classifier observability */
    classifierSource?: 'regex' | 'llm';
    classifierConfidence?: number;
    classifierResult?: unknown;
}

// ── Workspace Config ─────────────────────────────────────────

export interface WorkspaceConfig {
    workspaceId: string;
    userId: string;
    businessName: string;
    businessType: 'appointments' | 'ecommerce' ;
    tone: string;
    language: string;
    timezone: string;
    useEmojis: boolean;
    systemInstructions: string | null;
    storeLocation: string | null;
    contactInfo: string | null;
    handoffKeywords: string[];
    shippingRules: string | null;
    maxDiscount: number | null;
    minOrderForDiscount: number | null;
    slotDurationMinutes: number;
}

// ── Language ─────────────────────────────────────────────────

export type DetectedLanguage =
    | 'english'
    | 'arabic'
    | 'arabizi'
    | 'french'
    | 'spanish'
    | 'mixed'
    | 'unknown';

// ── Time Context ─────────────────────────────────────────────

export interface TimeContext {
    now: Date;
    timezone: string;
    isoDate: string;
    isoTime: string;
    dayOfWeek: number;
    dayName: string;
    tomorrowDate: string;
    tomorrowDayOfWeek: number;
}

// ── Service (Appointments) ───────────────────────────────────

export interface ServiceRecord {
    id: string;
    name: string;
    description: string | null;
    price: number;
    durationMinutes: number;
    isActive: boolean;
    aliases: string[];
    category: string | null;
    bufferBefore: number;
    bufferAfter: number;
}

// ── Business Hours ───────────────────────────────────────────

export interface BusinessHoursRecord {
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
}

// ── Inventory (E-Commerce) ───────────────────────────────────

export interface InventoryRecord {
    id: string;
    itemName: string;
    price: number;
    stockLevel: number;
    description: string | null;
    variants: any[];
}
