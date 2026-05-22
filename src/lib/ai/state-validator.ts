/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — State Validator
 * ═══════════════════════════════════════════════════════════════
 * Enforces valid state transitions, detects conversation loops,
 * and manages stage timeouts.
 */

import type { ConversationStage } from './types';
import { v2log } from './logger';

export interface StateConfig {
    validNext: string[];
    maxLoops: number;
    maxDurationMinutes: number;
    fallbackState: ConversationStage;
}

export interface StateValidationResult {
    approvedStage: ConversationStage;
    resetLoop: boolean;
    forceMenu: boolean;
    reason?: string;
}

export const STATE_CONFIGS: Record<string, StateConfig> = {
    idle: {
        validNext: ['collecting', 'confirming', 'handoff', 'awaiting_product', 'awaiting_service'],
        maxLoops: 1,
        maxDurationMinutes: Infinity,
        fallbackState: 'idle',
    },
    // V2 / standard stages
    collecting: {
        validNext: ['confirming', 'idle', 'handoff'],
        maxLoops: 3,
        maxDurationMinutes: 15,
        fallbackState: 'idle',
    },
    confirming: {
        validNext: ['complete', 'idle', 'handoff'],
        maxLoops: 2,
        maxDurationMinutes: 10,
        fallbackState: 'idle',
    },
    complete: {
        validNext: ['idle', 'handoff'],
        maxLoops: 1,
        maxDurationMinutes: 5,
        fallbackState: 'idle',
    },
    handoff: {
        validNext: ['idle'],
        maxLoops: 1,
        maxDurationMinutes: Infinity,
        fallbackState: 'idle',
    },
    // Detailed enterprise refactor stages
    awaiting_product: {
        validNext: ['awaiting_variant', 'awaiting_order_details', 'idle', 'handoff'],
        maxLoops: 3,
        maxDurationMinutes: 15,
        fallbackState: 'idle',
    },
    awaiting_variant: {
        validNext: ['awaiting_order_details', 'idle', 'handoff'],
        maxLoops: 2,
        maxDurationMinutes: 10,
        fallbackState: 'idle',
    },
    awaiting_order_details: {
        validNext: ['awaiting_checkout_confirmation', 'idle', 'handoff'],
        maxLoops: 3,
        maxDurationMinutes: 20,
        fallbackState: 'idle',
    },
    awaiting_checkout_confirmation: {
        validNext: ['idle', 'post_order_modify', 'handoff'],
        maxLoops: 2,
        maxDurationMinutes: 10,
        fallbackState: 'idle',
    },
    awaiting_service: {
        validNext: ['awaiting_date_time', 'idle', 'handoff'],
        maxLoops: 3,
        maxDurationMinutes: 15,
        fallbackState: 'idle',
    },
    awaiting_date_time: {
        validNext: ['awaiting_customer_details', 'idle', 'handoff'],
        maxLoops: 3,
        maxDurationMinutes: 15,
        fallbackState: 'idle',
    },
    awaiting_customer_details: {
        validNext: ['awaiting_booking_confirmation', 'idle', 'handoff'],
        maxLoops: 3,
        maxDurationMinutes: 20,
        fallbackState: 'idle',
    },
    awaiting_booking_confirmation: {
        validNext: ['idle', 'post_appointment_modify', 'handoff'],
        maxLoops: 2,
        maxDurationMinutes: 10,
        fallbackState: 'idle',
    },
    post_order_modify: {
        validNext: ['idle', 'handoff'],
        maxLoops: 2,
        maxDurationMinutes: 30,
        fallbackState: 'idle',
    },
    post_appointment_modify: {
        validNext: ['idle', 'handoff'],
        maxLoops: 2,
        maxDurationMinutes: 30,
        fallbackState: 'idle',
    },
};

/**
 * Validate a transition between conversation stages.
 * Prevents loops, invalid path transitions, and handles stage timeout.
 */
export function validateTransition(
    currentStage: string,
    proposedNext: string,
    loopCount: number,
    stateEnteredAtIso?: string
): StateValidationResult {
    const config = STATE_CONFIGS[currentStage] || STATE_CONFIGS.idle;

    // 1. Time duration limit check
    if (stateEnteredAtIso && config.maxDurationMinutes !== Infinity) {
        const enteredTime = new Date(stateEnteredAtIso).getTime();
        const elapsedMinutes = (Date.now() - enteredTime) / (1000 * 60);

        if (elapsedMinutes > config.maxDurationMinutes) {
            v2log.warn('STATE_VALIDATOR', 'State duration exceeded', {
                currentStage,
                elapsedMinutes,
                max: config.maxDurationMinutes,
            });

            return {
                approvedStage: config.fallbackState,
                resetLoop: true,
                forceMenu: true,
                reason: 'State timeout exceeded',
            };
        }
    }

    // 2. Global Escape States (allow transitioning to idle or handoff at any time)
    if (proposedNext === 'idle' || proposedNext === 'handoff') {
        return {
            approvedStage: proposedNext as ConversationStage,
            resetLoop: true,
            forceMenu: false,
        };
    }

    // 3. Transition validation check
    const isValidTransition = config.validNext.includes(proposedNext);
    if (!isValidTransition && currentStage !== proposedNext) {
        v2log.warn('STATE_VALIDATOR', 'Rejected invalid state transition', {
            currentStage,
            proposedNext,
            validNext: config.validNext,
        });

        return {
            approvedStage: currentStage as ConversationStage,
            resetLoop: false,
            forceMenu: false,
            reason: `Invalid transition from ${currentStage} to ${proposedNext}`,
        };
    }

    // 4. Loop count check for repeat messages
    if (proposedNext === currentStage) {
        const nextLoopCount = loopCount + 1;
        if (nextLoopCount >= config.maxLoops) {
            v2log.warn('STATE_VALIDATOR', 'Max loops reached in stage', {
                currentStage,
                loopCount: nextLoopCount,
                max: config.maxLoops,
            });

            return {
                approvedStage: config.fallbackState,
                resetLoop: true,
                forceMenu: true,
                reason: 'Conversation loop detected (max retries exceeded)',
            };
        }

        return {
            approvedStage: proposedNext as ConversationStage,
            resetLoop: false,
            forceMenu: false,
        };
    }

    // Successful new state transition
    return {
        approvedStage: proposedNext as ConversationStage,
        resetLoop: true,
        forceMenu: false,
    };
}
