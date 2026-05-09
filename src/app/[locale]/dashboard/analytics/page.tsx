'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, TrendingUp, MessageSquare, DollarSign, Users, ArrowUpRight, ArrowDownRight, Zap, Lock, Crown } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import clsx from 'clsx';

interface AnalyticsData {
    totalReplies: number;
    totalConversations: number;
    totalRevenue: number;
    totalOrders: number;
    repliesThisMonth: number;
    conversationsThisMonth: number;
    revenueThisMonth: number;
    ordersThisMonth: number;
    repliesLastMonth: number;
    revenueLastMonth: number;
    replyLimit: number | null;
    topProducts: { name: string; orders: number; revenue: number }[];
    dailyReplies: { date: string; count: number }[];
}

function pct(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}

function StatCard({
    label, value, sub, icon: Icon, color, bg, change, suffix = ''
}: {
    label: string;
    value: string | number;
    sub?: string;
    icon: any;
    color: string;
    bg: string;
    change?: number;
    suffix?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-1 border border-border rounded-2xl p-5 flex flex-col gap-3"
        >
            <div className="flex items-center justify-between">
                <div className={clsx('p-2 rounded-xl', bg)}>
                    <Icon className={clsx('w-4 h-4', color)} />
                </div>
                {change !== undefined && (
                    <span className={clsx(
                        'text-[11px] font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-full',
                        change >= 0
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-red-400 bg-red-500/10'
                    )}>
                        {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(change)}%
                    </span>
                )}
            </div>
            <div>
                <p className="text-2xl font-black text-foreground tabular-nums">{value}{suffix}</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</p>
                {sub && <p className="text-[10px] text-muted-foreground/60 mt-1">{sub}</p>}
            </div>
        </motion.div>
    );
}

export default function AnalyticsPage() {
    const { activeWorkspaceId, planTier } = useWorkspace();
    const supabase = createClient();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AnalyticsData | null>(null);

    const isPro = planTier === 'pro' || planTier === 'empire';

    useEffect(() => {
        if (!activeWorkspaceId) return;
        fetchAnalytics();
    }, [activeWorkspaceId]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const now = new Date();
            const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
            const firstOfThisMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);

            // ── Replies this month
            const { count: repliesThis } = await supabase
                .from('activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('workspace_id', activeWorkspaceId)
                .in('event_type', ['AI_REPLY', 'COMMENT_REPLY'])
                .gte('timestamp', firstOfThisMonth);

            // ── Replies last month
            const { count: repliesLast } = await supabase
                .from('activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('workspace_id', activeWorkspaceId)
                .in('event_type', ['AI_REPLY', 'COMMENT_REPLY'])
                .gte('timestamp', firstOfLastMonth)
                .lt('timestamp', firstOfThisMonth);

            // ── Total replies all time
            const { count: repliesTotal } = await supabase
                .from('activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('workspace_id', activeWorkspaceId)
                .in('event_type', ['AI_REPLY', 'COMMENT_REPLY']);

            // ── Unique conversations this month
            const { data: convLogs } = await supabase
                .from('activity_log')
                .select('metadata')
                .eq('workspace_id', activeWorkspaceId)
                .in('event_type', ['INCOMING_DM', 'INCOMING_MESSAGE'])
                .gte('timestamp', firstOfThisMonth);

            const uniqueChatsThis = new Set(
                (convLogs || []).map((r: any) => r.metadata?.chat_id || r.metadata?.sender_id).filter(Boolean)
            ).size;

            // ── Total unique conversations all time
            const { data: allConvLogs } = await supabase
                .from('activity_log')
                .select('metadata')
                .eq('workspace_id', activeWorkspaceId)
                .in('event_type', ['INCOMING_DM', 'INCOMING_MESSAGE']);

            const uniqueChatsTotal = new Set(
                (allConvLogs || []).map((r: any) => r.metadata?.chat_id || r.metadata?.sender_id).filter(Boolean)
            ).size;

            // ── Revenue this month
            const { data: ordersThis } = await supabase
                .from('orders')
                .select('quantity, unit_price, item_name')
                .eq('workspace_id', activeWorkspaceId)
                .neq('status', 'cancelled')
                .gte('created_at', firstOfThisMonth);

            const revenueThis = (ordersThis || []).reduce((s: number, o: any) => s + ((o.quantity || 1) * (o.unit_price || 0)), 0);
            const ordersThisCount = ordersThis?.length || 0;

            // ── Revenue last month
            const { data: ordersLast } = await supabase
                .from('orders')
                .select('quantity, unit_price')
                .eq('workspace_id', activeWorkspaceId)
                .neq('status', 'cancelled')
                .gte('created_at', firstOfLastMonth)
                .lt('created_at', firstOfThisMonth);

            const revenueLast = (ordersLast || []).reduce((s: number, o: any) => s + ((o.quantity || 1) * (o.unit_price || 0)), 0);

            // ── Total revenue
            const { data: allOrders } = await supabase
                .from('orders')
                .select('quantity, unit_price')
                .eq('workspace_id', activeWorkspaceId)
                .neq('status', 'cancelled');

            const revenueTotal = (allOrders || []).reduce((s: number, o: any) => s + ((o.quantity || 1) * (o.unit_price || 0)), 0);

            // ── Top products this month
            const productMap: Record<string, { orders: number; revenue: number }> = {};
            (ordersThis || []).forEach((o: any) => {
                const name = o.item_name || 'Unknown';
                if (!productMap[name]) productMap[name] = { orders: 0, revenue: 0 };
                productMap[name].orders += 1;
                productMap[name].revenue += (o.quantity || 1) * (o.unit_price || 0);
            });
            const topProducts = Object.entries(productMap)
                .map(([name, v]) => ({ name, ...v }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);

            // ── Daily replies for the last 14 days (simple bar chart)
            const last14 = Array.from({ length: 14 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (13 - i));
                return d.toISOString().split('T')[0];
            });

            const { data: recentLogs } = await supabase
                .from('activity_log')
                .select('timestamp')
                .eq('workspace_id', activeWorkspaceId)
                .in('event_type', ['AI_REPLY', 'COMMENT_REPLY'])
                .gte('timestamp', new Date(Date.now() - 14 * 86400000).toISOString());

            const dailyMap: Record<string, number> = {};
            (recentLogs || []).forEach((l: any) => {
                const day = l.timestamp.split('T')[0];
                dailyMap[day] = (dailyMap[day] || 0) + 1;
            });
            const dailyReplies = last14.map(date => ({ date, count: dailyMap[date] || 0 }));

            // ── Plan reply limit
            const { data: userData } = await supabase.from('users').select('plan_tier').eq('id', user.id).single();
            const tier = userData?.plan_tier || 'starter';
            const replyLimit = tier === 'empire' ? 10000 : tier === 'pro' ? 1000 : 100;

            setData({
                totalReplies: repliesTotal || 0,
                totalConversations: uniqueChatsTotal,
                totalRevenue: revenueTotal,
                totalOrders: allOrders?.length || 0,
                repliesThisMonth: repliesThis || 0,
                conversationsThisMonth: uniqueChatsThis,
                revenueThisMonth: revenueThis,
                ordersThisMonth: ordersThisCount,
                repliesLastMonth: repliesLast || 0,
                revenueLastMonth: revenueLast,
                replyLimit,
                topProducts,
                dailyReplies,
            });
        } catch (err) {
            console.error('Analytics fetch error:', err);
            toast.error('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    const maxBar = data ? Math.max(...data.dailyReplies.map(d => d.count), 1) : 1;

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                        <BarChart2 className="w-6 h-6 text-primary" />
                        Analytics
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Your GhostAgent performance at a glance</p>
                </div>
                {!isPro && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-amber-400">Pro feature</span>
                    </div>
                )}
            </div>

            {!isPro ? (
                /* Paywall state — show blurred demo */
                <div className="relative">
                    <div className="blur-sm pointer-events-none select-none opacity-60">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'AI Replies This Month', value: '847', icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/10' },
                                { label: 'Unique Conversations', value: '312', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                                { label: 'Revenue This Month', value: '$4,200', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                { label: 'Orders Processed', value: '38', icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                            ].map(s => (
                                <StatCard key={s.label} {...s} change={24} />
                            ))}
                        </div>
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <div className="bg-surface-1 border border-border rounded-2xl p-8 text-center max-w-sm shadow-2xl">
                            <Crown className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                            <h3 className="text-lg font-black text-foreground mb-2">Unlock Analytics</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                See exactly how much revenue your AI agent is generating, which products sell most, and reply performance.
                            </p>
                            <a href="/dashboard/billing" className="inline-flex items-center gap-2 bg-primary text-black font-bold px-5 py-2.5 rounded-xl hover:scale-[1.02] transition-transform text-sm">
                                <Zap className="w-4 h-4" /> Upgrade to Pro
                            </a>
                        </div>
                    </div>
                </div>
            ) : loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-surface-1 border border-border rounded-2xl p-5 h-28 animate-pulse" />
                    ))}
                </div>
            ) : data ? (
                <div className="space-y-8">
                    {/* This Month Stats */}
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">This Month</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard
                                label="AI Replies" value={data.repliesThisMonth.toLocaleString()}
                                sub={data.replyLimit ? `${data.replyLimit.toLocaleString()} limit` : 'Unlimited'}
                                icon={MessageSquare} color="text-primary" bg="bg-primary/10"
                                change={pct(data.repliesThisMonth, data.repliesLastMonth)}
                            />
                            <StatCard
                                label="Conversations" value={data.conversationsThisMonth.toLocaleString()}
                                icon={Users} color="text-blue-400" bg="bg-blue-500/10"
                            />
                            <StatCard
                                label="Revenue" value={`$${data.revenueThisMonth.toLocaleString()}`}
                                icon={DollarSign} color="text-emerald-400" bg="bg-emerald-500/10"
                                change={pct(data.revenueThisMonth, data.revenueLastMonth)}
                            />
                            <StatCard
                                label="Orders" value={data.ordersThisMonth}
                                icon={TrendingUp} color="text-amber-400" bg="bg-amber-500/10"
                            />
                        </div>
                    </div>

                    {/* All Time Stats */}
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">All Time</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard label="Total Replies" value={data.totalReplies.toLocaleString()} icon={MessageSquare} color="text-primary/60" bg="bg-primary/5" />
                            <StatCard label="Total Conversations" value={data.totalConversations.toLocaleString()} icon={Users} color="text-blue-400/60" bg="bg-blue-500/5" />
                            <StatCard label="Total Revenue" value={`$${data.totalRevenue.toLocaleString()}`} icon={DollarSign} color="text-emerald-400/60" bg="bg-emerald-500/5" />
                            <StatCard label="Total Orders" value={data.totalOrders} icon={TrendingUp} color="text-amber-400/60" bg="bg-amber-500/5" />
                        </div>
                    </div>

                    {/* Reply Limit Bar */}
                    {data.replyLimit && (
                        <div className="bg-surface-1 border border-border rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-bold text-foreground">Reply Usage This Month</p>
                                <span className="text-xs text-muted-foreground tabular-nums">{data.repliesThisMonth} / {data.replyLimit.toLocaleString()}</span>
                            </div>
                            <div className="h-3 bg-surface-3 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min((data.repliesThisMonth / data.replyLimit) * 100, 100)}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className={clsx(
                                        'h-full rounded-full',
                                        data.repliesThisMonth / data.replyLimit > 0.85 ? 'bg-red-500' :
                                        data.repliesThisMonth / data.replyLimit > 0.65 ? 'bg-amber-500' : 'bg-primary'
                                    )}
                                />
                            </div>
                            {data.repliesThisMonth / data.replyLimit > 0.85 && (
                                <p className="text-xs text-red-400 mt-2 font-medium">⚠️ You're close to your limit. <a href="/dashboard/billing" className="underline">Upgrade to avoid interruptions</a></p>
                            )}
                        </div>
                    )}

                    {/* Daily Replies Chart */}
                    <div className="bg-surface-1 border border-border rounded-2xl p-5">
                        <p className="text-sm font-bold text-foreground mb-4">Daily AI Replies — Last 14 Days</p>
                        <div className="flex items-end gap-1 h-28">
                            {data.dailyReplies.map((d, i) => (
                                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                                    <div
                                        className="w-full rounded-t-sm bg-primary/30 group-hover:bg-primary transition-colors relative"
                                        style={{ height: `${Math.max((d.count / maxBar) * 100, d.count > 0 ? 4 : 0)}%` }}
                                    >
                                        {d.count > 0 && (
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                {d.count}
                                            </div>
                                        )}
                                    </div>
                                    {i % 7 === 0 && (
                                        <span className="text-[8px] text-muted-foreground/60 absolute -bottom-5 whitespace-nowrap">
                                            {new Date(d.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Products */}
                    {data.topProducts.length > 0 && (
                        <div className="bg-surface-1 border border-border rounded-2xl p-5">
                            <p className="text-sm font-bold text-foreground mb-4">Top Products This Month</p>
                            <div className="space-y-3">
                                {data.topProducts.map((p, i) => (
                                    <div key={p.name} className="flex items-center gap-3">
                                        <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                                            <p className="text-[11px] text-muted-foreground">{p.orders} orders</p>
                                        </div>
                                        <span className="text-sm font-black text-emerald-400">${p.revenue.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
