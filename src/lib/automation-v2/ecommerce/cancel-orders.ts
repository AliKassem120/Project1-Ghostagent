/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Scoped Order Cancellation
 * ═══════════════════════════════════════════════════════════════
 * Replaces single cancelLatestOrder with scope-aware cancellation.
 * Supports: latest, count, all_pending, ordinal, product_reference.
 *
 * Reply is generated from DB result only — never says "orders cancelled"
 * unless actual cancelledCount matches.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { IntentScope, IntentOrdinal } from '../classify/normalized-intent';
import { v2log } from '../logger';

// ── Types ────────────────────────────────────────────────────

export interface CancelOrdersInput {
    supabase: SupabaseClient;
    workspaceId: string;
    chatId: string;
    scope: IntentScope;
    count?: number;
    ordinal?: IntentOrdinal;
    product?: string;
    orderId?: string;
}

export interface CancelOrdersResult {
    requestedScope: IntentScope;
    requestedCount: number | null;
    cancelledCount: number;
    alreadyCancelledCount: number;
    notCancellableCount: number;
    notCancellableStatuses: string[];
    cancelledIds: string[];
    alreadyCancelledIds: string[];
    notCancellableIds: string[];
    error?: string;
}

const CANCELLABLE_STATUSES = ['pending', 'confirmed'];

// ── Main function ────────────────────────────────────────────

export async function cancelOrdersForChat(input: CancelOrdersInput): Promise<CancelOrdersResult> {
    const { supabase, workspaceId, chatId, scope } = input;

    const emptyResult: CancelOrdersResult = {
        requestedScope: scope,
        requestedCount: input.count ?? null,
        cancelledCount: 0,
        alreadyCancelledCount: 0,
        notCancellableCount: 0,
        notCancellableStatuses: [],
        cancelledIds: [],
        alreadyCancelledIds: [],
        notCancellableIds: [],
    };

    try {
        // ── Fetch orders for this chat ────────────────────────
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, status, item_requested, created_at')
            .eq('workspace_id', workspaceId)
            .or(`chat_id.eq.${chatId},instagram_user_id.eq.${chatId}`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            v2log.error('CANCEL_ORDERS', 'Failed to fetch orders', { error, workspaceId, chatId });
            return { ...emptyResult, error: error.message };
        }

        if (!orders || orders.length === 0) {
            return { ...emptyResult, error: 'no_orders' };
        }

        // ── Select orders based on scope ─────────────────────
        let targetOrders = orders;

        switch (scope) {
            case 'latest':
                targetOrders = [orders[0]];
                break;

            case 'count':
                targetOrders = orders.slice(0, input.count || 1);
                break;

            case 'all_pending':
                targetOrders = orders.filter(o => CANCELLABLE_STATUSES.includes(o.status));
                break;

            case 'all':
                // all = all orders for this chat
                break;

            case 'ordinal': {
                const idx = ordinalToIndex(input.ordinal);
                if (idx !== null && idx < orders.length) {
                    targetOrders = [orders[idx]];
                } else {
                    return { ...emptyResult, error: 'ordinal_out_of_range' };
                }
                break;
            }

            case 'product_reference':
                if (input.product) {
                    const productLower = input.product.toLowerCase();
                    targetOrders = orders.filter(o =>
                        o.item_requested?.toLowerCase().includes(productLower)
                    );
                    if (targetOrders.length === 0) {
                        return { ...emptyResult, error: 'product_not_found_in_orders' };
                    }
                }
                break;

            case 'specific_id':
                if (input.orderId) {
                    targetOrders = orders.filter(o => o.id === input.orderId);
                    if (targetOrders.length === 0) {
                        return { ...emptyResult, error: 'order_id_not_found' };
                    }
                }
                break;

            default:
                targetOrders = [orders[0]]; // fallback to latest
        }

        // ── Process cancellations ────────────────────────────
        const result: CancelOrdersResult = {
            ...emptyResult,
            requestedCount: targetOrders.length,
        };

        for (const order of targetOrders) {
            if (order.status === 'cancelled') {
                result.alreadyCancelledCount++;
                result.alreadyCancelledIds.push(order.id);
                continue;
            }

            if (!CANCELLABLE_STATUSES.includes(order.status)) {
                result.notCancellableCount++;
                result.notCancellableStatuses.push(order.status);
                result.notCancellableIds.push(order.id);
                continue;
            }

            // Cancel it
            const { error: cancelError } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', order.id);

            if (cancelError) {
                v2log.error('CANCEL_ORDERS', 'Failed to cancel order', { orderId: order.id, error: cancelError });
                result.notCancellableCount++;
                result.notCancellableIds.push(order.id);
                continue;
            }

            result.cancelledCount++;
            result.cancelledIds.push(order.id);
        }

        v2log.info('CANCEL_ORDERS', `Scoped cancel: ${scope}`, {
            workspaceId,
            chatId,
            scope,
            requestedCount: result.requestedCount,
            cancelledCount: result.cancelledCount,
            alreadyCancelledCount: result.alreadyCancelledCount,
            notCancellableCount: result.notCancellableCount,
        });

        return result;

    } catch (err: any) {
        v2log.error('CANCEL_ORDERS', 'Exception', { error: err?.message, workspaceId, chatId });
        return { ...emptyResult, error: err?.message || 'Unknown error' };
    }
}

// ── Helpers ──────────────────────────────────────────────────

function ordinalToIndex(ordinal?: IntentOrdinal): number | null {
    switch (ordinal) {
        case 'first': return 0;
        case 'second': return 1;
        case 'third': return 2;
        case 'last':
        case 'latest': return 0; // orders are desc by date, so 0 = latest
        default: return null;
    }
}
