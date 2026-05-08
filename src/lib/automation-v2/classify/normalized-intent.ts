/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Normalized Intent Model
 * ═══════════════════════════════════════════════════════════════
 * Replaces flat one-off intent growth with a structured model:
 *   intent + target + action + scope + entities
 *
 * This avoids endless cases like:
 *   cancel_order, cancel_both_orders, cancel_first_order, cancel_all_orders
 *
 * Instead:
 *   intent = cancel_order
 *   scope  = latest | all_pending | count | ordinal | product_reference
 *   entities = { count, ordinal, product }
 */

// ── Canonical Intent ─────────────────────────────────────────

export type CanonicalIntent =
    // ── Universal ────────────────────────────────────────────
    | 'greeting'
    | 'gratitude'
    | 'goodbye'
    | 'correction'
    | 'clarification_request'
    | 'human_handoff'
    | 'frustration_stop'
    | 'unsupported_message'
    | 'deleted_message'
    | 'reply_to_context'

    // ── Ecommerce: Product ───────────────────────────────────
    | 'product_availability'
    | 'product_price'
    | 'product_details'
    | 'product_variant_question'
    | 'catalog_browse'
    | 'product_recommendation'
    | 'product_comparison'
    | 'product_reference'

    // ── Ecommerce: Order ─────────────────────────────────────
    | 'purchase_intent'
    | 'provide_order_details'
    | 'confirm_order'
    | 'reject_order'
    | 'repeat_last_order'
    | 'new_order_same_customer'
    | 'modify_order'
    | 'cancel_order'
    | 'cancel_status'
    | 'order_status'
    | 'order_summary'
    | 'payment_question'
    | 'delivery_question'
    | 'return_refund_question'
    | 'warranty_question'

    // ── Appointments: Discovery ──────────────────────────────
    | 'service_question'
    | 'service_price'
    | 'service_duration'
    | 'availability_question'
    | 'staff_question'

    // ── Appointments: Booking ────────────────────────────────
    | 'booking_intent'
    | 'provide_datetime'
    | 'provide_appointment_details'
    | 'confirm_appointment'
    | 'reject_appointment'
    | 'reschedule_appointment'
    | 'modify_appointment'
    | 'cancel_appointment'
    | 'appointment_status'

    // ── Business Info ────────────────────────────────────────
    | 'business_hours'
    | 'location_question'
    | 'shipping_question'
    | 'discount_question'
    | 'policy_question'
    | 'payment_methods_question'

    // ── Comments / Social ────────────────────────────────────
    | 'comment_price_question'
    | 'comment_availability'
    | 'comment_purchase_interest'
    | 'comment_booking_interest'
    | 'comment_dm_request'
    | 'comment_spam'

    // ── Media (reserved — not implemented yet) ───────────────
    | 'story_reply'
    | 'post_share'
    | 'reel_share'
    | 'voice_message'
    | 'image_message'
    | 'video_message'

    | 'unknown';

// ── Target ───────────────────────────────────────────────────

export type IntentTarget =
    | 'product'
    | 'order'
    | 'appointment'
    | 'service'
    | 'business'
    | 'comment'
    | 'media'
    | 'conversation';

// ── Action ───────────────────────────────────────────────────

export type IntentAction =
    | 'query'
    | 'create'
    | 'update'
    | 'cancel'
    | 'confirm'
    | 'reject'
    | 'repeat'
    | 'handoff'
    | 'clarify'
    | 'ignore';

// ── Scope ────────────────────────────────────────────────────

export type IntentScope =
    | 'none'
    | 'latest'
    | 'all'
    | 'all_pending'
    | 'count'
    | 'ordinal'
    | 'specific_id'
    | 'product_reference'
    | 'active_flow';

// ── Ordinal ──────────────────────────────────────────────────

export type IntentOrdinal = 'first' | 'second' | 'third' | 'last' | 'latest';

// ── Entities ─────────────────────────────────────────────────

export interface IntentEntities {
    product?: string;
    productId?: string;
    service?: string;
    serviceId?: string;

    quantity?: number;
    color?: string;
    size?: string;
    variant?: string;

    customerName?: string;
    customerPhone?: string;
    address?: string;

    date?: string;
    time?: string;

    orderId?: string;
    appointmentId?: string;

    reuseName?: boolean;
    reusePhone?: boolean;
    reuseAddress?: boolean;

    changedAddress?: string;
    changedPhone?: string;
    changedQuantity?: number;
    changedVariant?: string;

    replyToMessageId?: string;
    mediaType?: 'voice' | 'image' | 'video' | 'post' | 'reel' | 'story';
}

// ── Normalized Intent ────────────────────────────────────────

export interface NormalizedIntent {
    intent: CanonicalIntent;
    confidence: number;

    target?: IntentTarget;
    action?: IntentAction;
    scope?: IntentScope;
    count?: number;
    ordinal?: IntentOrdinal;

    entities: IntentEntities;

    isTransactional: boolean;
    needsClarification: boolean;
    language: string;
    source: 'regex' | 'llm' | 'state' | 'reply_to' | 'post_context';
}

// ── Helpers ──────────────────────────────────────────────────

/** Check if an intent represents a transactional action */
export function isTransactionalIntent(intent: CanonicalIntent): boolean {
    return [
        'purchase_intent',
        'confirm_order',
        'repeat_last_order',
        'new_order_same_customer',
        'modify_order',
        'cancel_order',
        'booking_intent',
        'confirm_appointment',
        'reschedule_appointment',
        'modify_appointment',
        'cancel_appointment',
    ].includes(intent);
}

/** Build a NormalizedIntent with sensible defaults */
export function createNormalizedIntent(
    partial: Partial<NormalizedIntent> & Pick<NormalizedIntent, 'intent'>
): NormalizedIntent {
    return {
        confidence: 0,
        entities: {},
        isTransactional: isTransactionalIntent(partial.intent),
        needsClarification: false,
        language: 'unknown',
        source: 'regex',
        ...partial,
    };
}
