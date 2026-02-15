'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDashboard } from '@/contexts/DashboardContext';
import { MessageSquare, DollarSign, Package, Clock, Zap, MessageCircle, Sparkles, Instagram, Shield, Activity, BarChart3, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from '@/components/CountUp';
import GhostChat from '@/app/components/GhostChat';
import GhostModal from '@/components/GhostModal';
import { useAutopilot } from '@/context/AutopilotContext';
import { useRealtime, useRealtimeCount } from '@/hooks/useRealtime';
import clsx from 'clsx';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';

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
    const [sendingDrafts, setSendingDrafts] = useState<string[]>([]);
    const toast = useToast();

    const handleApproveDraft = async (activity: ActivityLog) => {
        if (!activity.metadata?.reply_text || !activity.metadata?.chat_id) {
            toast.error("Invalid draft data");
            return;
        }

        setSendingDrafts(prev => [...prev, activity.id]);

        try {
            const response = await fetch('/api/draft/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activityId: activity.id,
                    replyText: activity.metadata.reply_text,
                    recipientId: activity.metadata.chat_id
                })
            });

            if (!response.ok) throw new Error('Failed to send');

            toast.success("Message sent successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to send message");
        } finally {
            setSendingDrafts(prev => prev.filter(id => id !== activity.id));
        }
    };

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        };
        getUser();
    }, []);

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

    const { count: totalInteractions } = useRealtimeCount(
        'activity_log',
        userId ? { column: 'user_id', value: userId } : undefined,
        { pollingInterval: 3000 }
    );

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

    useEffect(() => {
        if (version > 0) {
            refetchActivities();
            refetchInventory();
        }
    }, [version, refetchActivities, refetchInventory]);

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

    const getEventIcon = (eventType: string) => {
        if (eventType === 'SALE' || eventType === 'IG_SALE') return <DollarSign className="w-3.5 h-3.5" />;
        if (eventType === 'RESTOCK' || eventType === 'NEW_ITEM') return <Package className="w-3.5 h-3.5" />;
        if (eventType === 'INCOMING_MESSAGE') return <MessageCircle className="w-3.5 h-3.5" />;
        return <MessageSquare className="w-3.5 h-3.5" />;
    };

    const getEventColor = (eventType: string) => {
        if (eventType === 'SALE' || eventType === 'IG_SALE' || eventType === 'AI_REPLY' || eventType === 'MANUAL_REPLY') return 'text-emerald-400 bg-emerald-500/10';
        if (eventType === 'RESTOCK' || eventType === 'NEW_ITEM') return 'text-amber-400 bg-amber-500/10';
        if (eventType === 'INCOMING_MESSAGE') return 'text-blue-400 bg-blue-500/10';
        return 'text-purple-400 bg-purple-500/10';
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

            {/* ═══════════════════════════════════════════════════ */}
            {/* HEADER                                             */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="flex items-center justify-between gap-4 mb-5 shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight text-white">
                        Dashboard
                    </h1>
                    <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active
                    </span>
                </div>
                <div className="hidden md:flex items-center gap-5 text-xs text-white/40">
                    <div className="flex items-center gap-1.5">
                        <span>Handled</span>
                        <span className="font-mono text-white/70">{stats.repliesSent}</span>
                    </div>
                    <div className="w-px h-3 bg-white/[0.06]" />
                    <div className="flex items-center gap-1.5">
                        <span>Saved</span>
                        <span className="font-mono text-white/70">{stats.timeSaved.toFixed(1)}h</span>
                    </div>
                    <div className="w-px h-3 bg-white/[0.06]" />
                    <div className="flex items-center gap-1.5">
                        <span>Revenue</span>
                        <span className="font-mono text-white/70">${stats.moneySaved.toFixed(0)}</span>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* MOBILE TAB SELECTOR                                 */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="lg:hidden flex items-center gap-1 mb-4 glass-card rounded-xl p-1">
                {[
                    { key: 'command' as const, label: 'Monitor', icon: MessageSquare },
                    { key: 'intel' as const, label: 'Overview', icon: BarChart3 },
                    { key: 'activity' as const, label: 'Activity', icon: Activity },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setMobileTab(tab.key)}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all",
                            mobileTab === tab.key
                                ? "bg-white/[0.06] text-white"
                                : "text-white/30 hover:text-white/50"
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* MAIN 3-COLUMN GRID                                 */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden min-h-0">

                {/* ─── ZONE 1: OVERVIEW SIDEBAR (Left, 3 cols) ─── */}
                <div className={clsx(
                    "lg:col-span-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar",
                    mobileTab !== 'intel' && "hidden lg:flex"
                )}>
                    {/* Today's Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Today&apos;s Summary</span>
                        </div>
                        <p className="text-sm text-white/60 leading-relaxed">
                            {totalInteractions > 10 ? (
                                <>Handled <span className="text-white font-medium font-mono">{totalInteractions}</span> interactions, saving you <span className="text-white font-medium font-mono">{stats.timeSaved.toFixed(1)} hours</span> of work.</>
                            ) : (
                                <span className="text-white/30 italic">Collecting data for your first summary...</span>
                            )}
                        </p>
                    </motion.div>

                    {/* KPI Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {[
                            { icon: Clock, label: 'Time Saved', value: stats.timeSaved, suffix: 'h', color: 'text-blue-400', bg: 'bg-blue-500/10', decimals: 1 },
                            { icon: DollarSign, label: 'Revenue', value: stats.moneySaved, prefix: '$', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                            { icon: MessageSquare, label: 'Replies', value: stats.repliesSent, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                            { icon: Package, label: 'In Stock', value: stats.stock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        ].map((metric, index) => (
                            <motion.div
                                key={metric.label}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 + (index * 0.05) }}
                                className="glass-card rounded-xl p-4"
                            >
                                <div className={clsx("p-1.5 rounded-lg w-fit mb-2.5", metric.bg)}>
                                    <metric.icon className={clsx("w-3.5 h-3.5", metric.color)} />
                                </div>
                                <div className="text-xl font-bold text-white/90 leading-none mb-1 font-mono">
                                    <CountUp
                                        end={metric.value}
                                        prefix={metric.prefix}
                                        suffix={metric.suffix}
                                        decimals={metric.decimals ?? (metric.value % 1 !== 0 ? 1 : 0)}
                                    />
                                </div>
                                <div className="text-[11px] text-white/30 font-medium">{metric.label}</div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Agent Status */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass-card rounded-2xl p-4"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-4 h-4 text-white/30" />
                            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">System Status</span>
                        </div>
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-white/30">Mode</span>
                                <span className={clsx(
                                    "text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full",
                                    autopilot
                                        ? "text-emerald-400 bg-emerald-500/10"
                                        : "text-amber-400 bg-amber-500/10"
                                )}>
                                    {autopilot ? 'Autopilot' : 'Manual'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-white/30">Status</span>
                                <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Online
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-white/30">Availability</span>
                                <span className="text-[10px] text-white/50 font-mono">24/7</span>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* ─── ZONE 2: AGENT MONITOR — Chat (Center, 6 cols) ─── */}
                <div className={clsx(
                    "lg:col-span-6 flex flex-col overflow-hidden min-h-0",
                    mobileTab !== 'command' && "hidden lg:flex"
                )}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.99 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15, duration: 0.3 }}
                        className="flex-1 flex flex-col rounded-2xl glass-card overflow-hidden"
                    >
                        {/* Chat Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-primary/10">
                                    <Zap className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-white">Agent Monitor</h3>
                                    <p className="text-[11px] text-[#9CA3AF]">System Status: Online</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/25 bg-white/[0.03] px-2.5 py-1 rounded-full">
                                    <Instagram className="w-3 h-3" />
                                    Connected
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-[10px] font-medium text-emerald-400/80">Online</span>
                                </div>
                            </div>
                        </div>

                        {/* Chat Body */}
                        <div className="flex-1 overflow-hidden">
                            <GhostChat />
                        </div>
                    </motion.div>
                </div>

                {/* ─── ZONE 3: ACTIVITY LOG (Right, 3 cols) ─── */}
                <div className={clsx(
                    "lg:col-span-3 flex flex-col overflow-hidden min-h-0",
                    mobileTab !== 'activity' && "hidden lg:flex"
                )}>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="flex-1 flex flex-col rounded-2xl glass-card overflow-hidden"
                    >
                        {/* Feed Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-white/30" />
                                <span className="text-xs font-medium text-white/50">Activity</span>
                                {filteredActivities.length > 0 && (
                                    <span className="text-[10px] bg-white/[0.04] text-white/25 px-1.5 py-0.5 rounded-full font-mono">
                                        {filteredActivities.length}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {filteredActivities.length > 0 && (
                                    <button
                                        onClick={() => setClearModalOpen(true)}
                                        className="text-[10px] text-red-400/50 hover:text-red-400 px-2 py-0.5 rounded-md transition-all font-medium"
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
                                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                                        <Sparkles className="w-5 h-5 text-white/10" />
                                    </div>
                                    <p className="text-sm font-medium text-white/20 mb-1">No events yet</p>
                                    <p className="text-[11px] text-white/10 leading-relaxed">Activity will appear here as your agent processes interactions.</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-0.5">
                                    {filteredActivities.map((activity, i) => {
                                        const colorClasses = getEventColor(activity.event_type);
                                        return (
                                            <motion.div
                                                key={activity.id}
                                                initial={i < 5 ? { opacity: 0, x: 10 } : false}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i < 5 ? i * 0.05 : 0 }}
                                                className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.02] transition-colors group"
                                            >
                                                <div className={clsx(
                                                    "p-1.5 rounded-lg shrink-0 mt-0.5",
                                                    colorClasses
                                                )}>
                                                    {getEventIcon(activity.event_type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-white/50 leading-relaxed line-clamp-2 group-hover:text-white/65 transition-colors">
                                                        {activity.description}
                                                    </p>
                                                    <span className="text-[10px] text-white/15 font-mono mt-1 block">
                                                        {formatTime(activity.timestamp)} ago
                                                    </span>
                                                </div>

                                                {/* Send Action for Drafts */}
                                                {
                                                    (activity.event_type === 'DRAFT_REPLY' || activity.description.startsWith('Draft:')) && (
                                                        <button
                                                            onClick={() => handleApproveDraft(activity)}
                                                            disabled={sendingDrafts.includes(activity.id)}
                                                            className="h-11 w-11 flex items-center justify-center rounded-full text-violet-500 hover:bg-violet-500/20 transition-all shrink-0 ml-2"
                                                            title="Send Now"
                                                        >
                                                            {sendingDrafts.includes(activity.id) ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Send className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    )
                                                }
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div >

            {/* Mobile floating chat button */}
            {
                mobileTab !== 'command' && (
                    <div className="lg:hidden fixed bottom-6 right-6 z-50">
                        <button
                            onClick={() => setMobileTab('command')}
                            className="w-14 h-14 rounded-2xl bg-primary text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                        >
                            <MessageSquare className="w-6 h-6" />
                        </button>
                    </div>
                )
            }

            {/* Clear Activity Modal */}
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
        </div >
    );
}
