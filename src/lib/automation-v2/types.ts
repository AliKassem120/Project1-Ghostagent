/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Types
 * ═══════════════════════════════════════════════════════════════
 * All shared types for the V2 automation engine.
 * No business logic here — pure type definitions.
 */

// ── Engine Input / Output ────────────────────────────────────

export interface AutomationInput {
    workspaceId: string;
    workspaceType: 'appointments' | 'ecommerce';
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
}

export interface AutomationResult {
    shouldReply: boolean;
    replyText?: string;
    actions: string[];
    stateBefore: ConversationStage;
    stateAfter: ConversationStage;
    debug: AutomationDebug;
    error?: string;
}

export interface AutomationDebug {
    requestId: string;
    engineVersion: 'v2';
    workspaceId: string;
    workspaceType: 'appointments' | 'ecommerce';
    chatId: string;
    language: DetectedLanguage;
    intent?: string;
    intentConfidence?: number;
    templateUsed?: string;
    dbWriteAttempted: boolean;
    dbWriteSuccess: boolean;
    durationMs: number;
}

// ── Workspace Config ─────────────────────────────────────────

export interface WorkspaceConfig {
    workspaceId: string;
    userId: string;
    businessName: string;
    businessType: 'appointments' | 'ecommerce';
    tone: string;
    language: string; // 'Auto-Detect' | 'English' | 'Arabic' | etc.
    timezone: string;
    useEmojis: boolean;
    useLocalSlang: boolean;
    systemInstructions: string | null;
    storeLocation: string | null;
    contactInfo: string | null;
    handoffKeywords: string[];
    // E-commerce specific
    shippingRules: string | null;
    maxDiscount: number | null;
    minOrderForDiscount: number | null;
    // Appointments specific
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

// ── Conversation State ───────────────────────────────────────

export type ConversationStage =
    // Shared
    | 'idle'
    | 'handoff'
    | 'failed'
    | 'awaiting_cancel_confirmation'
    // Appointments
    | 'awaiting_service'
    | 'awaiting_date_time'
    | 'awaiting_customer_details'
    | 'awaiting_booking_confirmation'
    // E-Commerce
    | 'awaiting_product'
    | 'awaiting_variant'
    | 'awaiting_order_details'
    | 'awaiting_checkout_confirmation';

export interface ConversationStateV2 {
    stage: ConversationStage;
    pendingAction?: 'create_appointment' | 'create_order';
    appointment?: AppointmentPendingData;
    order?: OrderPendingData;
    customer?: CustomerPendingData;
    missingFields?: string[];
    updatedAt?: string;
}

export interface AppointmentPendingData {
    workspaceId: string;
    serviceId?: string;
    serviceName?: string;
    servicePrice?: number;
    serviceDuration?: number;
    date?: string;       // YYYY-MM-DD
    startTime?: string;  // HH:mm
    endTime?: string;    // HH:mm
    timezone?: string;
}

export interface OrderPendingData {
    workspaceId: string;
    productId?: string;
    productName?: string;
    variantId?: string | null;
    variantLabel?: string | null;
    quantity?: number;
    unitPrice?: number;
}

export interface CustomerPendingData {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    instagramHandle?: string | null;
}

// ── Time Context ─────────────────────────────────────────────

export interface TimeContext {
    now: Date;
    timezone: string;
    isoDate: string;      // YYYY-MM-DD in workspace timezone
    isoTime: string;      // HH:mm in workspace timezone
    dayOfWeek: number;     // 0=Sun, 6=Sat
    dayName: string;       // "Monday", "Tuesday", etc.
    tomorrowDate: string;  // YYYY-MM-DD
    tomorrowDayOfWeek: number;
}

// ── Intent (Shared) ──────────────────────────────────────────

export interface ClassifiedIntent {
    intent: string;
    confidence: number;
    language: DetectedLanguage;
    extractedFields: Record<string, any>;
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
    openTime: string;  // HH:mm
    closeTime: string; // HH:mm
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

// ── Template Keys ────────────────────────────────────────────

export type AppointmentTemplateKey =
    | 'GREETING'
    | 'ASK_SERVICE'
    | 'ASK_DATE_TIME'
    | 'SLOT_AVAILABLE_NEED_DETAILS'
    | 'NEED_NAME_PHONE'
    | 'CONFIRMED'
    | 'CLOSED_DAY'
    | 'OUTSIDE_HOURS'
    | 'BOOKING_ERROR'
    | 'UNCLEAR'
    | 'REJECTION_ACK'
    | 'SERVICE_LIST'
    | 'SERVICE_PRICE'
    | 'BUSINESS_HOURS'
    | 'LOCATION'
    | 'GRATITUDE';

export type EcommerceTemplateKey =
    | 'GREETING'
    | 'ASK_PRODUCT'
    | 'ASK_VARIANT'
    | 'PRODUCT_AVAILABLE'
    | 'PRODUCT_UNAVAILABLE'
    | 'NEED_ORDER_DETAILS'
    | 'NEED_ADDRESS'
    | 'ORDER_CONFIRMED'
    | 'ORDER_ERROR'
    | 'UNCLEAR'
    | 'REJECTION_ACK'
    | 'PRODUCT_PRICE'
    | 'SHIPPING_INFO'
    | 'LOCATION'
    | 'GRATITUDE';
