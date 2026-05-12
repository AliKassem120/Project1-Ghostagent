/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — State Validator
 * ═══════════════════════════════════════════════════════════════
 * Enforces valid state transitions, loop limits, and state duration
 * timeouts. This is the safety net that prevents:
 *
 *   BUG 2 (infinite loops) — Max loop enforcement per state.
 *         If the bot asks the same question 3x with no progress,
 *         force a menu reset.
 *
 *   Stuck conversations — State duration timeout. If user is
 *         stuck in a single state for > maxDurationMinutes,
 *         reset to idle with a friendly menu.
 */

import type { ConversationStage } from './state/types';

// ── State Configuration ──────────────────────────────────────

export interface StateConfig {
    validNext: ConversationStage[];
    maxLoops: number;
    maxDurationMinutes: number;
    fallbackState: ConversationStage;
}

const DEFAULT_STATE_CONFIG: Record<ConversationStage, StateConfig> = {
    idle: {
        validNext: [
            'awaiting_product', 'awaiting_variant', 'awaiting_order_details',
            'awaiting_checkout_confirmation', 'awaiting_service', 'awaiting_date_time',
            'awaiting_customer_details', 'awaiting_booking_confirmation',
            'handoff', 'post_order_modify', 'post_appointment_modify',
        ],
        maxLoops: 1,
        maxDurationMinutes: Infinity,
        fallbackState: 'idle',
    },
    awaiting_product: {
        validNext: ['awaiting_variant', 'awaiting_order_details', 'awaiting_checkout_confirmation', 'idle'],
        maxLoops: 3,
        maxDurationMinutes: 15,
        fallbackState: 'idle',
    },
    awaiting_variant: {
        validNext: ['awaiting_order_details', 'awaiting_checkout_confirmation', 'idle'],
        maxLoops: 2,
        maxDurationMinutes: 10,
        fallbackState: 'idle',
    },
    awaiting_order_details: {
        validNext: ['awaiting_checkout_confirmation', 'idle'],
        maxLoops: 3,
        maxDurationMinutes: 20,
        fallbackState: 'idle',
    },
    awaiting_checkout_confirmation: {
        validNext: ['idle', 'post_order_modify'],
        maxLoops: 2,
        maxDurationMinutes: 10,
        fallbackState: 'idle',
    },
    awaiting_service: {
        validNext: ['awaiting_date_time', 'awaiting_customer_details', 'awaiting_booking_confirmation', 'idle'],
        maxLoops: 3,
        maxDurationMinutes: 15,
        fallbackState: 'idle',
    },
    awaiting_date_time: {
        validNext: ['awaiting_customer_details', 'awaiting_booking_confirmation', 'idle'],
        maxLoops: 3,
        maxDurationMinutes: 15,
        fallbackState: 'idle',
    },
    awaiting_customer_details: {
        validNext: ['awaiting_booking_confirmation', 'idle'],
        maxLoops: 3,
        maxDurationMinutes: 20,
        fallbackState: 'idle',
    },
    awaiting_booking_confirmation: {
        validNext: ['idle', 'post_appointment_modify'],
        maxLoops: 2,
        maxDurationMinutes: 10,
        fallbackState: 'idle',
    },
    handoff: {
        validNext: ['idle'],
        maxLoops: 1,
        maxDurationMinutes: Infinity,
        fallbackState: 'idle',
    },
    post_order_modify: {
        validNext: ['idle'],
        maxLoops: 2,
        maxDurationMinutes: 30,
        fallbackState: 'idle',
    },
    post_appointment_modify: {
        validNext: ['idle'],
        maxLoops: 2,
        maxDurationMinutes: 30,
        fallbackState: 'idle',
    },
};

// ── Validation Result ────────────────────────────────────────

export interface StateValidationResult {
    /** The approved next stage (may differ from proposed if rejected) */
    approvedStage: ConversationStage;
    /** True if the loop counter should be reset (new state) */
    resetLoop: boolean;
    /** True if we should force a main menu offer (loops exceeded) */
    forceMenu: boolean;
    /** Human-readable reason if the transition was modified */
    reason?: string;
}

// ── Validate Transition ──────────────────────────────────────

/**
 * Validate a proposed state transition.
 *
 * Checks:
 *   1. Is the proposed next state valid from the current state?
 *   2. Has the loop limit been exceeded?
 *   3. Has the state duration timeout been exceeded?
 *
 * Returns the approved transition (may be modified).
 */
export function validateTransition(
    currentStage: ConversationStage,
    proposedNext: ConversationStage,
    loopCount: number,
    stateConfig: StateConfig,
    stateEnteredAt?: string // ISO timestamp, optional for backward compat
): StateValidationResult {
    const config = stateConfig || DEFAULT_STATE_CONFIG[currentStage];

    // If stateEnteredAt provided, check duration timeout:
    if (stateEnteredAt && config.maxDurationMinutes !== Infinity) {
        const minutesInState = (Date.now() - new Date(stateEnteredAt).getTime()) / (1000 * 60);
        if (minutesInState > config.maxDurationMinutes) {
            return {
                approvedStage: config.fallbackState,
                resetLoop: true,
                forceMenu: true,
                reason: `state_timeout: ${minutesInState.toFixed(0)}min > ${config.maxDurationMinutes}min`
            };
        }
    }

    // ── Check 1: Loop limit ──────────────────────────────────
    // If the proposed next state is the SAME as current and we've
    // exceeded the max loops, force a menu reset.
    if (proposedNext === currentStage && loopCount >= config.maxLoops) {
        return {
            approvedStage: config.fallbackState,
            resetLoop: true,
            forceMenu: true,
            reason: `Loop limit exceeded (${loopCount}/${config.maxLoops}) at ${currentStage}`,
        };
    }

    // ── Check 3: Valid transition ─────────────────────────────
    // Allow transition to idle from any state (cancel, reset, etc.)
    if (proposedNext === 'idle') {
        return {
            approvedStage: 'idle',
            resetLoop: true,
            forceMenu: false,
        };
    }

    // For non-idle transitions, check validity
    if (!config.validNext.includes(proposedNext)) {
        return {
            approvedStage: currentStage,
            resetLoop: false,
            forceMenu: false,
            reason: `Invalid transition: ${currentStage} → ${proposedNext}`,
        };
    }

    // ── Valid transition ─────────────────────────────────────
    const stateChanged = proposedNext !== currentStage;
    return {
        approvedStage: proposedNext,
        resetLoop: stateChanged,
        forceMenu: false,
    };
}

// ── Get State Config ─────────────────────────────────────────

/**
 * Get the configuration for a specific state.
 */
export function getStateConfig(stage: ConversationStage): StateConfig {
    return DEFAULT_STATE_CONFIG[stage] || DEFAULT_STATE_CONFIG.idle;
}

// ── Loop Menu Messages ───────────────────────────────────────

export function getLoopMenuMessage(
    workspaceType: 'ecommerce' | 'appointments' | 'saas_support',
    lang: string
): string {
    const t = (en: string, ar: string) => 
        lang === 'arabizi' || lang === 'lebanese franco' || lang === 'arabic' || lang === 'mixed' ? ar : en;

    if (workspaceType === 'ecommerce') {
        return t(
            "Looks like I'm stuck. Let's start fresh! What would you like to do?\n1. Browse products\n2. Track my order\n3. Talk to a human",
            "Shaklo 3am dawwar. Yalla mn el awal! Shu baddak ta3mel?\n1. Dawwar products\n2. Track order\n3. Haki ma3 beshar"
        );
    }
    
    if (workspaceType === 'appointments') {
        return t(
            "Looks like I'm stuck. Let's start fresh! What would you like to do?\n1. Book an appointment\n2. Check my appointments\n3. Talk to a human",
            "Shaklo 3am dawwar. Yalla mn el awal! Shu baddak ta3mel?\n1. 7ejz maw3ed\n2. Check maw3edak\n3. Haki ma3 beshar"
        );
    }

    return t(
        "Let's start fresh! How can I help?",
        "Yalla mn el awal! Kif fiye se3dak?"
    );
}
