/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Dashboard Metrics (Source of Truth)
 * ═══════════════════════════════════════════════════════════════
 * Server-side metric calculations from real database tables.
 * activity_log → interaction counts (strictly filtered)
 * orders       → revenue + order status breakdown
 * appointments → booking status breakdown
 * inventory    → stock level
 *
 * The frontend should NEVER calculate business metrics.
 * This module is the single source of truth.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────

export interface DashboardMetrics {
    totalInteractions: number;
    dmsReceived: number;
    comments: number;
    aiReplies: number;
    manualReplies: number;
    automationRate: number;
    revenue: number;
    orders: {
        pending: number;
        contacted: number;
        fulfilled: number;
        cancelled: number;
        total: number;
    };
    appointments: {
        pending: number;
        confirmed: number;
        cancelled: number;
        completed: number;
        noShow: number;
        total: number;
    };
    stock: number;
    chart: ChartDay[];
    debug: {
        workspaceId: string;
        range: string;
        sourceTables: string[];
    };
}

export interface ChartDay {
    date: string;   // YYYY-MM-DD
    day: string;    // Mon, Tue, ...
    interactions: number;
    dms: number;
    comments: number;
    aiReplies: number;
    manualReplies: number;
}

// ── Event type classification ────────────────────────────────

const DM_EVENTS = ['INCOMING_DM', 'INCOMING_MESSAGE'];
const COMMENT_EVENTS = ['INCOMING_COMMENT'];
const AI_REPLY_EVENTS = ['AI_REPLY', 'automation_v2', 'COMMENT_REPLY'];
const MANUAL_REPLY_EVENTS = ['MANUAL_REPLY'];

// All customer-facing events that count as interactions
const CUSTOMER_FACING_EVENTS = [
    ...DM_EVENTS,
    ...COMMENT_EVENTS,
    ...AI_REPLY_EVENTS,
    ...MANUAL_REPLY_EVENTS,
];

// Revenue-eligible order statuses (non-cancelled)
const REVENUE_STATUSES = ['Pending', 'Contacted', 'Fulfilled', 'Completed', 'fulfilled', 'completed', 'contacted'];

// ── Core query ───────────────────────────────────────────────

export async function getDashboardOverviewMetrics(
    supabase: SupabaseClient,
    workspaceId: string,
): Promise<DashboardMetrics> {
    const sourceTables: string[] = [];

    // ── 1. Activity log counts (all time, workspace-scoped) ──
    const activityCounts = await getActivityCounts(supabase, workspaceId);
    sourceTables.push('activity_log');

    const dmsReceived = activityCounts.dms;
    const comments = activityCounts.comments;
    const aiReplies = activityCounts.aiReplies;
    const manualReplies = activityCounts.manualReplies;
    const totalInteractions = dmsReceived + comments + aiReplies + manualReplies;
    const automationRate = (aiReplies + manualReplies) > 0
        ? Math.round((aiReplies / (aiReplies + manualReplies)) * 100)
        : 0;

    // ── 2. Orders (all time, workspace-scoped) ───────────────
    const ordersBreakdown = await getOrdersBreakdown(supabase, workspaceId);
    sourceTables.push('orders');

    // Revenue = all non-cancelled orders
    const revenue = ordersBreakdown.revenue;

    // ── 3. Appointments (all time, workspace-scoped) ─────────
    const appointmentsBreakdown = await getAppointmentsBreakdown(supabase, workspaceId);
    sourceTables.push('appointments');

    // ── 4. Inventory stock (workspace-scoped) ────────────────
    const stock = await getStockLevel(supabase, workspaceId);
    sourceTables.push('inventory');

    // ── 5. Chart data (last 7 days) ──────────────────────────
    const chart = await getChartData(supabase, workspaceId);

    return {
        totalInteractions,
        dmsReceived,
        comments,
        aiReplies,
        manualReplies,
        automationRate,
        revenue,
        orders: ordersBreakdown.counts,
        appointments: appointmentsBreakdown,
        stock,
        chart,
        debug: {
            workspaceId,
            range: 'all',
            sourceTables,
        },
    };
}

// ── Activity counts ──────────────────────────────────────────

interface ActivityCounts {
    dms: number;
    comments: number;
    aiReplies: number;
    manualReplies: number;
}

async function getActivityCounts(
    supabase: SupabaseClient,
    workspaceId: string,
): Promise<ActivityCounts> {
    // Single query: get counts grouped by event_type for customer-facing events
    const { data, error } = await supabase
        .from('activity_log')
        .select('event_type')
        .eq('workspace_id', workspaceId)
        .in('event_type', CUSTOMER_FACING_EVENTS);

    if (error || !data) {
        console.error('[METRICS] activity_log query failed:', error?.message);
        return { dms: 0, comments: 0, aiReplies: 0, manualReplies: 0 };
    }

    let dms = 0, comments = 0, aiReplies = 0, manualReplies = 0;

    for (const row of data) {
        if (DM_EVENTS.includes(row.event_type)) dms++;
        else if (COMMENT_EVENTS.includes(row.event_type)) comments++;
        else if (AI_REPLY_EVENTS.includes(row.event_type)) aiReplies++;
        else if (MANUAL_REPLY_EVENTS.includes(row.event_type)) manualReplies++;
    }

    return { dms, comments, aiReplies, manualReplies };
}

// ── Orders breakdown ─────────────────────────────────────────

interface OrdersResult {
    counts: DashboardMetrics['orders'];
    revenue: number;
}

async function getOrdersBreakdown(
    supabase: SupabaseClient,
    workspaceId: string,
): Promise<OrdersResult> {
    const { data, error } = await supabase
        .from('orders')
        .select('status, quantity, unit_price')
        .eq('workspace_id', workspaceId);

    if (error || !data) {
        console.error('[METRICS] orders query failed:', error?.message);
        return {
            counts: { pending: 0, contacted: 0, fulfilled: 0, cancelled: 0, total: 0 },
            revenue: 0,
        };
    }

    const counts = { pending: 0, contacted: 0, fulfilled: 0, cancelled: 0, total: 0 };
    let revenue = 0;

    for (const order of data) {
        counts.total++;
        const status = (order.status || '').toLowerCase();

        if (status === 'pending') counts.pending++;
        else if (status === 'contacted') counts.contacted++;
        else if (status === 'fulfilled' || status === 'completed') counts.fulfilled++;
        else if (status === 'cancelled' || status === 'canceled') counts.cancelled++;

        // Revenue = all non-cancelled orders
        if (REVENUE_STATUSES.map(s => s.toLowerCase()).includes(status)) {
            const qty = order.quantity || 1;
            const price = order.unit_price || 0;
            revenue += qty * price;
        }
    }

    return { counts, revenue };
}

// ── Appointments breakdown ───────────────────────────────────

async function getAppointmentsBreakdown(
    supabase: SupabaseClient,
    workspaceId: string,
): Promise<DashboardMetrics['appointments']> {
    const { data, error } = await supabase
        .from('appointments')
        .select('status')
        .eq('workspace_id', workspaceId);

    if (error || !data) {
        console.error('[METRICS] appointments query failed:', error?.message);
        return { pending: 0, confirmed: 0, cancelled: 0, completed: 0, noShow: 0, total: 0 };
    }

    const counts = { pending: 0, confirmed: 0, cancelled: 0, completed: 0, noShow: 0, total: 0 };

    for (const appt of data) {
        counts.total++;
        const status = (appt.status || '').toLowerCase();

        if (status === 'pending') counts.pending++;
        else if (status === 'confirmed') counts.confirmed++;
        else if (status === 'cancelled' || status === 'canceled') counts.cancelled++;
        else if (status === 'completed') counts.completed++;
        else if (status === 'no_show' || status === 'noshow') counts.noShow++;
    }

    return counts;
}

// ── Stock level ──────────────────────────────────────────────

async function getStockLevel(
    supabase: SupabaseClient,
    workspaceId: string,
): Promise<number> {
    const { data, error } = await supabase
        .from('inventory')
        .select('stock_level')
        .eq('workspace_id', workspaceId);

    if (error || !data) return 0;

    return data.reduce((sum, item) => sum + (item.stock_level || 0), 0);
}

// ── Chart data (last 7 days) ─────────────────────────────────

async function getChartData(
    supabase: SupabaseClient,
    workspaceId: string,
): Promise<ChartDay[]> {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('activity_log')
        .select('event_type, timestamp')
        .eq('workspace_id', workspaceId)
        .in('event_type', CUSTOMER_FACING_EVENTS)
        .gte('timestamp', sevenDaysAgo.toISOString())
        .order('timestamp', { ascending: true });

    // Build day buckets
    const buckets = new Map<string, ChartDay>();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD
        buckets.set(dateKey, {
            date: dateKey,
            day: dayNames[d.getDay()],
            interactions: 0,
            dms: 0,
            comments: 0,
            aiReplies: 0,
            manualReplies: 0,
        });
    }

    if (!error && data) {
        for (const row of data) {
            const dateKey = new Date(row.timestamp).toISOString().split('T')[0];
            const bucket = buckets.get(dateKey);
            if (!bucket) continue;

            bucket.interactions++;
            if (DM_EVENTS.includes(row.event_type)) bucket.dms++;
            else if (COMMENT_EVENTS.includes(row.event_type)) bucket.comments++;
            else if (AI_REPLY_EVENTS.includes(row.event_type)) bucket.aiReplies++;
            else if (MANUAL_REPLY_EVENTS.includes(row.event_type)) bucket.manualReplies++;
        }
    }

    return Array.from(buckets.values());
}
