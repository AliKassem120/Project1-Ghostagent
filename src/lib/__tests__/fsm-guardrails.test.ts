import { describe, it, expect, vi } from 'vitest';
import { validateTransition } from '../ai/state-validator';
import { verifyAgentReply } from '../ai/guardrails/reply-verifier';
import { isFreshSessionTimeout } from '../automation-v3/session-manager';

describe('FSM Guardrails & Session/Loop Management', () => {
    describe('FSM State Transitions', () => {
        it('allows valid state transitions', () => {
            // idle to awaiting_service
            const res1 = validateTransition('idle', 'awaiting_service', 0);
            expect(res1.approvedStage).toBe('awaiting_service');
            expect(res1.resetLoop).toBe(true);
            expect(res1.forceMenu).toBe(false);

            // awaiting_service to awaiting_date_time
            const res2 = validateTransition('awaiting_service', 'awaiting_date_time', 0);
            expect(res2.approvedStage).toBe('awaiting_date_time');

            // awaiting_date_time to awaiting_booking_confirmation
            const res3 = validateTransition('awaiting_date_time', 'awaiting_booking_confirmation', 0);
            expect(res3.approvedStage).toBe('awaiting_booking_confirmation');

            // awaiting_product to awaiting_checkout_confirmation
            const res4 = validateTransition('awaiting_product', 'awaiting_checkout_confirmation', 0);
            expect(res4.approvedStage).toBe('awaiting_checkout_confirmation');

            // awaiting_variant to awaiting_checkout_confirmation
            const res5 = validateTransition('awaiting_variant', 'awaiting_checkout_confirmation', 0);
            expect(res5.approvedStage).toBe('awaiting_checkout_confirmation');
        });

        it('allows global transitions to post_appointment_modify and post_order_modify from any state', () => {
            const res1 = validateTransition('idle', 'post_appointment_modify', 0);
            expect(res1.approvedStage).toBe('post_appointment_modify');

            const res2 = validateTransition('awaiting_customer_details', 'post_appointment_modify', 0);
            expect(res2.approvedStage).toBe('post_appointment_modify');

            const res3 = validateTransition('awaiting_service', 'post_order_modify', 0);
            expect(res3.approvedStage).toBe('post_order_modify');
        });

        it('allows booking shortcuts from idle straight to booking confirmation', () => {
            const res = validateTransition('idle', 'awaiting_booking_confirmation', 0);
            expect(res.approvedStage).toBe('awaiting_booking_confirmation');
            expect(res.resetLoop).toBe(true);
        });

        it('rejects invalid cross-domain state transitions and keeps current state', () => {
            // awaiting_service (appointment domain) to awaiting_checkout_confirmation (e-commerce domain)
            const res = validateTransition('awaiting_service', 'awaiting_checkout_confirmation', 0);
            expect(res.approvedStage).toBe('awaiting_service');
            expect(res.resetLoop).toBe(false);
            expect(res.reason).toBe('Invalid transition from awaiting_service to awaiting_checkout_confirmation');
        });

        it('forces fallback when loop limit is reached', () => {
            // maxLoops for awaiting_date_time is 3. At loopCount 2, the next loop (which will be 3) triggers fallback
            const res = validateTransition('awaiting_date_time', 'awaiting_date_time', 2);
            expect(res.approvedStage).toBe('idle'); // fallbackState is 'idle'
            expect(res.forceMenu).toBe(true);
            expect(res.resetLoop).toBe(true);
            expect(res.reason).toContain('Conversation loop detected');
        });

        it('forces fallback when state duration timeout is exceeded', () => {
            const enteredAt = new Date(Date.now() - 25 * 60 * 1000).toISOString(); // 25 minutes ago
            // maxDurationMinutes for awaiting_date_time is 15 minutes
            const res = validateTransition('awaiting_date_time', 'awaiting_customer_details', 0, enteredAt);
            expect(res.approvedStage).toBe('idle');
            expect(res.forceMenu).toBe(false);
            expect(res.reason).toContain('State timeout exceeded');
        });
    });

    describe('E-Commerce Safety Reply Verifier', () => {
        const productCatalog = [
            { name: 'Leather Jacket', price: 120, stockLevel: 5 },
            { name: 'Blue Jeans', price: 45, stockLevel: 0 },
        ];

        it('corrects false order claims if order tool was not successfully run', () => {
            const reply = 'Your order is confirmed and will be shipped soon!';
            const result = verifyAgentReply(reply, [], productCatalog, 'ecommerce');
            expect(result.verified).toBe(false);
            expect(result.correctedReply).toContain('Just need your name, phone, and address to lock it in');
            expect(result.violations).toContain('order_claim_without_tool: Reply claims order was placed but place_order never succeeded');
        });

        it('accepts order claims if order tool was successfully run', () => {
            const reply = 'Your order has been placed successfully!';
            const result = verifyAgentReply(reply, ['place_order_success'], productCatalog, 'ecommerce');
            expect(result.verified).toBe(true);
            expect(result.correctedReply).toBe(reply);
        });

        it('accepts order claims if order tool was not run in this step but hasActiveOrder is true', () => {
            const reply = 'Your order has been placed successfully!';
            const result = verifyAgentReply(reply, [], productCatalog, 'ecommerce', false, true);
            expect(result.verified).toBe(true);
            expect(result.correctedReply).toBe(reply);
        });

        it('accepts booking claims if booking tool was not run in this step but hasActiveBooking is true', () => {
            const reply = 'Your booking is confirmed for Monday!';
            const result = verifyAgentReply(reply, [], [], 'appointments', true, false);
            expect(result.verified).toBe(true);
            expect(result.correctedReply).toBe(reply);
        });

        it('corrects stock denial claims if search products was not run', () => {
            const reply = 'Sorry, that item is out of stock.';
            const result = verifyAgentReply(reply, [], productCatalog, 'ecommerce');
            expect(result.verified).toBe(false);
            expect(result.correctedReply).toContain("Which product? I'll check stock right now.");
            expect(result.violations).toContain('stock_claim_without_check: Reply claims item is out of stock but search_products was never called');
        });

        it('corrects price hallucinations to match database values', () => {
            const reply = 'The Leather Jacket is available for $150.';
            const result = verifyAgentReply(reply, ['tool_search_products'], productCatalog, 'ecommerce');
            expect(result.verified).toBe(false);
            expect(result.correctedReply).toBe('The Leather Jacket is available for $120.');
            expect(result.violations[0]).toContain('price_mismatch');
        });
    });

    describe('Session Management Lifecycle', () => {
        it('detects fresh session timeouts', () => {
            const staleTime = new Date(Date.now() - 31 * 60 * 1000).toISOString(); // 31 mins ago
            const recentTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 mins ago

            expect(isFreshSessionTimeout(staleTime, 30)).toBe(true);
            expect(isFreshSessionTimeout(recentTime, 30)).toBe(false);
        });
    });
});
