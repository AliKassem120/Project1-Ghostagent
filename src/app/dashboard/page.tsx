'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDashboard } from '@/contexts/DashboardContext';
import { MessageSquare, DollarSign, Package, Clock, Zap, MessageCircle, Sparkles, Instagram, ChevronDown, ChevronUp, Shield, Activity, Brain, BarChart3, ArrowUpRight, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from '@/components/CountUp';
import GhostChat from '@/app/components/GhostChat';
import GhostModal from '@/components/GhostModal';
import { useAutopilot } from '@/context/AutopilotContext';
import { useRealtime, useRealtimeCount } from '@/hooks/useRealtime';
import clsx from 'clsx';
import { createClient } from '@/utils/supabase/client';

// Database types
type ActivityLog = {
    id: string;
    user_id: string;
    event_type: string;
    description: string;
    timestamp: string;
    metadata?: any;
};

type InventoryItem = {
    id: string;
    stock_level: number;
};

export default function DashboardPage() {
    const { autopilot } = useAutopilot();
    const supabase = createClient();
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [clearModalOpen, setClearModalOpen] = useState(false);
    const [mobileTab, setMobileTab] = useState<'command' | 'intel' | 'activity'>('command');

    // Get user ID on mount
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        };
        getUser();
    }, []);

    // 🔥 REALTIME: Subscribe to activity_log changes
    const { data: activities, loading: activitiesLoading, refetch: refetchActivities } = useRealtime<ActivityLog>(
        'activity_log',
        '*',
        {
            filter: userId ? { column: 'user_id', value: userId } : undefined,
            orderBy: 'timestamp',
            orderDirection: 'desc',
            limit: 50,
            enabled: !!userId,
            pollingInterval: 3000,
        }
    );

    // 🔥 REALTIME: Get live count of all activities
    const { count: totalInteractions } = useRealtimeCount(
        'activity_log',
        userId ? { column: 'user_id', value: userId } : undefined,
        { pollingInterval: 3000 }
    );

    // 🔥 REALTIME: Subscribe to inventory for stock count
    const { data: inventoryItems, refetch: refetchInventory } = useRealtime<InventoryItem>(
        'inventory',
        'id, stock_level',
        {
            filter: userId ? { column: 'user_id', value: userId } : undefined,
            enabled: !!userId,
            pollingInterval: 3000,
        }
    );

    const { version } = useDashboard();

    // Listen for global dashboard refresh triggers
    useEffect(() => {
        if (version > 0) {
            refetchActivities();
            refetchInventory();
        }
    }, [version, refetchActivities, refetchInventory]);

    // 📊 COMPUTED STATS
    const stats = useMemo(() => {
        let moneySaved = 0;
        activities.forEach(log => {
            if (log.event_type === 'IG_SALE' && log.description) {
                const match = log.description.match(/\$([\d.]+)/);
                if (match) moneySaved += parseFloat(match[1]);
            }
        });
        const timeSaved = (totalInteractions * 2) / 60;
        const stock = inventoryItems.reduce((sum, item) => sum + (item.stock_level || 0), 0);
        return { timeSaved, moneySaved, repliesSent: totalInteractions, stock };
    }, [activities, totalInteractions, inventoryItems]);

    const loading = activitiesLoading;

    // Categorize activities for the feed
    const getEventIcon = (eventType: string) => {
        if (eventType === 'SALE' || eventType === 'IG_SALE') return <DollarSign className="w-3.5 h-3.5" />;
        if (eventType === 'RESTOCK' || eventType === 'NEW_ITEM') return <Package className="w-3.5 h-3.5" />;
        if (eventType === 'INCOMING_MESSAGE') return <MessageCircle className="w-3.5 h-3.5" />;
        return <MessageSquare className="w-3.5 h-3.5" />;
    };

    const getEventColor = (eventType: string) => {
        if (eventType === 'SALE' || eventType === 'IG_SALE') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (eventType === 'RESTOCK' || eventType === 'NEW_ITEM') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        if (eventType === 'INCOMING_MESSAGE') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    };

    const formatTime = (timestamp: string) => {
        const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    };

    const filteredActivities = activities.filter(a => a.event_type !== 'CHAT_QUERY');

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col overflow-hidden pb-safe">

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* HEADER — Compact status bar                               */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="flex items-center justify-between gap-4 mb-5 shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/50">
                        COMMAND CENTER
                    </h1>
                    <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/25 tracking-widest flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                    </span>
                </div>
                <div className="hidden md:flex items-center gap-5 text-xs font-mono text-white/50">
                    <div className="flex items-center gap-1.5">
                        <span className="text-white/30">HANDLED</span>
                        <span className="text-white font-bold">{stats.repliesSent}</span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-white/30">SAVED</span>
                        <span className="text-cyan-400 font-bold">{stats.timeSaved.toFixed(1)}h</span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-white/30">REVENUE</span>
                        <span className="text-emerald-400 font-bold">${stats.moneySaved.toFixed(0)}</span>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* MOBILE TAB SELECTOR                                       */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="lg:hidden flex items-center gap-1 mb-4 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
                {[
                    { key: 'command' as const, label: 'Command', icon: MessageSquare },
                    { key: 'intel' as const, label: 'Intelligence', icon: Brain },
                    { key: 'activity' as const, label: 'Activity', icon: Activity },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setMobileTab(tab.key)}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all",
                            mobileTab === tab.key
                                ? "bg-white/10 text-white shadow-sm"
                                : "text-white/40 hover:text-white/60"
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* MAIN 3-COLUMN GRID                                        */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden min-h-0">

                {/* ─────────────────────────────────────────────────────── */}
                {/* ZONE 1: INTELLIGENCE SIDEBAR (Left, 3 cols)            */}
                {/* ─────────────────────────────────────────────────────── */}
                <div className={clsx(
                    "lg:col-span-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar",
                    mobileTab !== 'intel' && "hidden lg:flex"
                )}>
                    {/* Daily Briefing */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-purple-950/40 via-indigo-950/30 to-transparent border border-purple-500/10 rounded-2xl p-5 relative overflow-hidden"
                    >
                        <div className="absolute -top-4 -right-4 opacity-[0.04]">
                            <Brain className="w-28 h-28 text-white" />
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-purple-500/15">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            </div>
                            <span className="text-[11px] font-semibold text-purple-300/80 uppercase tracking-wider">Daily Briefing</span>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed">
                            {totalInteractions > 10 ? (
                                <>I handled <span className="text-white font-semibold">{totalInteractions}</span> interactions and saved you <span className="text-cyan-400 font-semibold">{stats.timeSaved.toFixed(1)} hours</span> of work.</>
                            ) : (
                                <span className="text-white/40 italic">Collecting data for your first briefing...</span>
                            )}
                        </p>
                    </motion.div>

                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                        {[
                            { icon: Clock, label: 'Time Saved', value: stats.timeSaved, suffix: 'h', color: 'text-cyan-400', bg: 'bg-cyan-500/8', border: 'border-cyan-500/10', decimals: 1 },
                            { icon: DollarSign, label: 'Revenue', value: stats.moneySaved, prefix: '$', color: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/10', glow: stats.moneySaved > 0 },
                            { icon: MessageSquare, label: 'Replies', value: stats.repliesSent, color: 'text-purple-400', bg: 'bg-purple-500/8', border: 'border-purple-500/10' },
                            { icon: Package, label: 'In Stock', value: stats.stock, color: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/10' },
                        ].map((metric, index) => (
                            <motion.div
                                key={metric.label}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 + (index * 0.05) }}
                                className={clsx(
                                    "rounded-xl p-4 border transition-all group",
                                    "bg-white/[0.02] hover:bg-white/[0.04]",
                                    metric.border,
                                    metric.glow && "shadow-[0_0_20px_rgba(16,185,129,0.06)]"
                                )}
                            >
                                <div className={clsx("p-1.5 rounded-lg w-fit mb-2.5", metric.bg)}>
                                    <metric.icon className={clsx("w-3.5 h-3.5", metric.color)} />
                                </div>
                                <div className="text-xl font-bold text-white/90 leading-none mb-1">
                                    <CountUp
                                        end={metric.value}
                                        prefix={metric.prefix}
                                        suffix={metric.suffix}
                                        decimals={metric.decimals ?? (metric.value % 1 !== 0 ? 1 : 0)}
                                    />
                                </div>
                                <div className="text-[11px] text-white/35 font-medium">{metric.label}</div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Agent Status Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="rounded-2xl p-4 border border-white/[0.06] bg-white/[0.02]"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-cyan-500/10">
                                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Agent Status</span>
                        </div>
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-white/40">Mode</span>
                                <span className={clsx(
                                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                    autopilot
                                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                        : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                )}>
                                    {autopilot ? 'Autopilot' : 'Manual'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-white/40">DM Status</span>
                                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Active
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-white/40">Uptime</span>
                                <span className="text-[10px] font-mono text-white/60">24/7</span>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* ─────────────────────────────────────────────────────── */}
                {/* ZONE 2: COMMAND CENTER — Chat (Center, 6 cols)         */}
                {/* The primary focal point of the entire dashboard        */}
                {/* ─────────────────────────────────────────────────────── */}
                <div className={clsx(
                    "lg:col-span-6 flex flex-col overflow-hidden min-h-0",
                    mobileTab !== 'command' && "hidden lg:flex"
                )}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15, duration: 0.4 }}
                        className="flex-1 flex flex-col rounded-2xl border border-cyan-500/15 bg-black/40 overflow-hidden relative shadow-[0_0_40px_rgba(6,182,212,0.06)]"
                    >
                        {/* Subtle grid overlay */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.015)_1px,transparent_1px)] bg-[length:32px_32px] pointer-events-none" />

                        {/* Chat Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative z-10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-cyan-400/20 blur-lg rounded-full animate-pulse" />
                                    <div className="relative p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                                        <Zap className="w-4 h-4 text-cyan-400" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white/90 tracking-wide">Ghost Operator</h3>
                                    <p className="text-[10px] text-cyan-400/60 font-mono">Neural link active</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-white/30 bg-white/[0.03] px-2.5 py-1 rounded-full border border-white/[0.05]">
                                    <Instagram className="w-3 h-3" />
                                    Connected
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                                    <span className="text-[10px] font-bold text-cyan-400/80 tracking-widest">ONLINE</span>
                                </div>
                            </div>
                        </div>

                        {/* Chat Body (GhostChat component fills this) */}
                        <div className="flex-1 overflow-hidden relative z-10">
                            <GhostChat />
                        </div>
                    </motion.div>
                </div>

                {/* ─────────────────────────────────────────────────────── */}
                {/* ZONE 3: ACTIVITY LOG (Right, 3 cols)                   */}
                {/* Single scrollable feed — the only scroll region        */}
                {/* ─────────────────────────────────────────────────────── */}
                <div className={clsx(
                    "lg:col-span-3 flex flex-col overflow-hidden min-h-0",
                    mobileTab !== 'activity' && "hidden lg:flex"
                )}>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="flex-1 flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden"
                    >
                        {/* Feed Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-purple-500/10">
                                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                                </div>
                                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Activity</span>
                                {filteredActivities.length > 0 && (
                                    <span className="text-[10px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded-full font-mono">
                                        {filteredActivities.length}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {filteredActivities.length > 0 && (
                                    <button
                                        onClick={() => setClearModalOpen(true)}
                                        className="text-[9px] text-red-400/60 hover:text-red-400 border border-red-500/10 hover:border-red-500/20 px-2 py-0.5 rounded-md transition-all uppercase tracking-wider font-semibold"
                                    >
                                        Clear
                                    </button>
                                )}
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                            </div>
                        </div>

                        {/* Feed Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {filteredActivities.length === 0 && !loading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                                        <Sparkles className="w-5 h-5 text-white/15" />
                                    </div>
                                    <p className="text-sm font-medium text-white/25 mb-1">No events yet</p>
                                    <p className="text-[11px] text-white/15 leading-relaxed">Activity will appear here as your Ghost Agent processes interactions.</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {filteredActivities.map((activity, i) => {
                                        const colorClasses = getEventColor(activity.event_type);
                                        return (
                                            <motion.div
                                                key={activity.id}
                                                initial={i < 5 ? { opacity: 0, x: 10 } : false}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i < 5 ? i * 0.05 : 0 }}
                                                className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group"
                                            >
                                                <div className={clsx(
                                                    "p-1.5 rounded-lg border shrink-0 mt-0.5",
                                                    colorClasses
                                                )}>
                                                    {getEventIcon(activity.event_type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-white/60 leading-relaxed line-clamp-2 group-hover:text-white/75 transition-colors">
                                                        {activity.description}
                                                    </p>
                                                    <span className="text-[10px] text-white/20 font-mono mt-1 block">
                                                        {formatTime(activity.timestamp)} ago
                                                    </span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>

            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* MOBILE: Floating Chat Button (only on non-command tabs)   */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {mobileTab !== 'command' && (
                <div className="lg:hidden fixed bottom-6 right-6 z-50">
                    <button
                        onClick={() => setMobileTab('command')}
                        className="w-14 h-14 rounded-2xl bg-cyan-500/90 shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all"
                    >
                        <MessageSquare className="w-6 h-6" />
                    </button>
                </div>
            )}

            {/* Clear Activity Confirmation Modal */}
            <GhostModal
                isOpen={clearModalOpen}
                variant="danger"
                title="Clear All Activity?"
                message="This will permanently delete all activity history and reset your stats. This action cannot be undone."
                confirmText="Clear Everything"
                cancelText="Keep Data"
                onConfirm={async () => {
                    if (userId) {
                        await supabase
                            .from('activity_log')
                            .delete()
                            .eq('user_id', userId);
                        refetchActivities();
                    }
                }}
                onCancel={() => setClearModalOpen(false)}
            />
        </div>
    );
}
