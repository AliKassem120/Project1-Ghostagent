/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — State Machine Types
 * ═══════════════════════════════════════════════════════════════
 * All conversation state types for the deterministic FSM.
 */

// ── Conversation Stages ──────────────────────────────────────

export type ConversationStage =
    | 'idle'
    | 'handoff'
    // Appointments
    | 'awaiting_service'
    | 'awaiting_date_time'
    | 'awaiting_customer_details'
    | 'awaiting_booking_confirmation'
    // E-Commerce
    | 'awaiting_product'
    | 'awaiting_variant'
    | 'awaiting_order_details'
    | 'awaiting_checkout_confirmation'
    // Post-action modification
    | 'post_order_modify'
    | 'post_appointment_modify';

// ── Post-Action Context ──────────────────────────────────────
// Saved after every successful order/appointment so the bot
// can handle "change it", "where is my order", "same address", etc.

export interface PostActionContext {
    type: 'order' | 'appointment';
    // Order-specific
    lastOrderId?: string;
    productName?: string;
    variantLabel?: string | null;
    quantity?: number;
    unitPrice?: number;
    orderStatus?: string;
    // Appointment-specific
    lastAppointmentId?: string;
    serviceName?: string;
    serviceId?: string;
    servicePrice?: number;
    serviceDuration?: number;
    date?: string;
    startTime?: string;
    endTime?: string;
    // Shared
    customer: {
        name: string;
        phone: string;
        address?: string | null;
    };
    createdAt: string;
    /** Timestamp after which the action is no longer editable via DM */
    editableUntil: string;
    /** Where this context originated from */
    source?: 'comment_private_reply' | 'dm_cta' | 'completed_action';
    /** What kind of CTA the bot sent that expects a follow-up */
    ctaType?: 'purchase_offer' | 'booking_offer' | 'price_answer' | 'availability_answer';
    /** Original comment text if this came from a comment */
    originalCommentText?: string;
    /** Instagram comment ID */
    commentId?: string;
    /** Product ID from inventory match */
    productId?: string;
}

// ── Appointment State Data ───────────────────────────────────

export interface AppointmentStateData {
    stage: ConversationStage;
    pendingAction: 'create_appointment';
    appointment: {
        serviceId?: string;
        serviceName?: string;
        servicePrice?: number;
        serviceDuration?: number;
        date?: string;          // YYYY-MM-DD
        startTime?: string;     // HH:mm
        endTime?: string;       // HH:mm
    };
    customer: {
        name?: string | null;
        phone?: string | null;
        instagramHandle?: string | null;
    };
    missingFields: string[];
    postContext?: PostActionContext | null;
    /** Where this state was initiated from */
    source?: 'comment_private_reply' | 'dm_cta' | 'completed_action';
}

export interface EcommerceStateData {
    stage: ConversationStage;
    pendingAction: 'create_order';
    order: {
        productId?: string;
        productName?: string;
        variantLabel?: string | null;
        quantity: number;
        unitPrice?: number;
    };
    customer: {
        name?: string | null;
        phone?: string | null;
        address?: string | null;
        instagramHandle?: string | null;
    };
    missingFields: string[];
    postContext?: PostActionContext | null;
    /** Where this state was initiated from */
    source?: 'comment_private_reply' | 'dm_cta' | 'completed_action';
}

export interface IdleStateData {
    stage: 'idle';
    postContext?: PostActionContext | null;
}

// ── Union State ──────────────────────────────────────────────

export type StateData = AppointmentStateData | EcommerceStateData | IdleStateData;

// ── FSM Result ───────────────────────────────────────────────

export interface FSMResult {
    replyText: string;
    nextStage: ConversationStage;
    nextData: StateData | null;
    actions: string[];
    dbWriteAttempted: boolean;
    dbWriteSuccess: boolean;
    shouldReply: boolean;
    /** Set after successful order/appointment creation */
    postContext?: PostActionContext;
}

// ── DB Row ───────────────────────────────────────────────────

export interface ConversationStateRow {
    id: string;
    user_id: string;
    workspace_id: string;
    chat_id: string;
    workspace_type: 'appointments' | 'ecommerce';
    stage: string;
    data: Record<string, any>;
    updated_at: string;
}
