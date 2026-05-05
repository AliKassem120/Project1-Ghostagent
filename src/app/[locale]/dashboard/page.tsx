'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDashboard } from '@/contexts/DashboardContext';
import { MessageSquare, DollarSign, Package, Clock, Zap, MessageCircle, Sparkles, Instagram, Shield, Activity, BarChart3, Send, Loader2, TrendingUp, ArrowUpRight, Users, Bot, Eye, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from '@/components/CountUp';
import GhostModal from '@/components/GhostModal';
import SetupChecklist from '@/components/SetupChecklist';
import { useAutopilot } from '@/context/AutopilotContext';
import { useRealtime, useRealtimeCount } from '@/hooks/useRealtime';
import clsx from 'clsx';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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

type ChartDataPoint = { day: string; interactions: number };
type EngagementChartProps = {
    data: ChartDataPoint[];
    metrics: {
        dmsReceived: number;
        comments: number;
        aiReplies: number;
        manualReplies: number;
    };
    loading?: boolean;
};

/* ── Engagement Overview (Premium Recharts) ────────────── */
function EngagementOverview({ data, metrics, loading }: EngagementChartProps) {
    return (
        <div className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <BarChart3 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Engagement Overview</h3>
                        <p className="text-[11px] text-muted-foreground">Interactions over the last 7 days</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        Interactions
                    </div>
                </div>
            </div>

            {/* Recharts AreaChart */}
            <div className="h-[250px] w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorInteractions" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={true} horizontal={false} strokeDasharray="4 4" stroke="currentColor" opacity={0.1} />
                        <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                            dy={10}
                        />
                        <YAxis hide padding={{ bottom: 15, top: 15 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #1e293b',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 'semibold',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'
                            }}
                            itemStyle={{ color: '#fff' }}
                            cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.4 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="interactions"
                            stroke="#6366f1"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorInteractions)"
                            animationDuration={1500}
                            dot={{ stroke: 'var(--color-surface-1, #111520)', strokeWidth: 4, r: 6, fill: '#6366f1' }}
                            activeDot={{ stroke: 'var(--color-surface-1, #111520)', strokeWidth: 4, r: 8, fill: '#6366f1' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Bottom Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
                {[
                    { label: 'DMs Received', value: metrics.dmsReceived, icon: MessageCircle, color: 'text-blue-400' },
                    { label: 'Comments', value: metrics.comments, icon: MessageSquare, color: 'text-pink-400' },
                    { label: 'AI Replies', value: metrics.aiReplies, icon: Bot, color: 'text-emerald-400' },
                    { label: 'Manual Replies', value: metrics.manualReplies, icon: Users, color: 'text-amber-400' },
                ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                        <item.icon className={clsx('w-4 h-4', item.color)} />
                        <div>
                            {loading ? (
                                <div className="h-5 w-8 bg-surface-2 rounded-md animate-pulse mb-0.5" />
                            ) : (
                                <p className="text-sm font-semibold text-foreground">{item.value}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground">{item.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Event badge for activity feed ──────────────────── */
function EventBadge({ type }: { type: string }) {
    const config: Record<string, { label: string; class: string }> = {
        'AI_REPLY': { label: 'AI Reply', class: 'badge-success' },
        'automation_v2': { label: 'AI Reply', class: 'badge-success' },
        'MANUAL_REPLY': { label: 'Manual', class: 'badge-info' },
        'SALE': { label: 'Sale', class: 'badge-success' },
        'IG_SALE': { label: 'Sale', class: 'badge-success' },
        'DRAFT_REPLY': { label: 'Draft', class: 'badge-warning' },
        'DRAFT_COMMENT_REPLY': { label: 'Draft', class: 'badge-warning' },
        'INCOMING_MESSAGE': { label: 'Message', class: 'badge-purple' },
        'INCOMING_DM': { label: 'DM', class: 'badge-purple' },
        'INCOMING_COMMENT': { label: 'Comment', class: 'badge-info' },
        'COMMENT_REPLY': { label: 'Replied', class: 'badge-success' },
        'RESTOCK': { label: 'Restock', class: 'badge-warning' },
        'NEW_ITEM': { label: 'New Item', class: 'badge-purple' },
        'INVENTORY_ADD': { label: 'Inventory Add', class: 'badge-warning' },
    };
    const c = config[type] || { label: type.replace(/_/g, ' '), class: 'badge-purple' };
    return <span className={c.class}>{c.label}</span>;
}

export default function DashboardPage() {
    const { autopilot } = useAutopilot();
    const supabase = createClient();
    const { user } = useAuth();
    const userId = user?.id;
    const { activeWorkspaceId, activeWorkspace, workspaces, workspaceStatus } = useWorkspace();
    const [clearModalOpen, setClearModalOpen] = useState(false);
    const [sendingDrafts, setSendingDrafts] = useState<string[]>([]);
    const [instagramStatus, setInstagramStatus] = useState<{ connected: boolean } | null>(null);
    const toast = useToast();

    // Re-check Instagram status whenever the active workspace changes
    useEffect(() => {
        if (!activeWorkspaceId) return;
        const checkInstagramStatus = async () => {
            try {
                const res = await fetch(`/api/instagram/status?workspace_id=${activeWorkspaceId}`);
                const data = await res.json();
                if (data && typeof data.connected === 'boolean') {
                    setInstagramStatus(data);
                }
            } catch (e) {
                console.error('Failed to check Instagram status:', e);
            }
        };
        checkInstagramStatus();
    }, [activeWorkspaceId]);

    // Check if AI settings have been configured (business_name or system_instructions set)
    const [hasAiSettings, setHasAiSettings] = useState<boolean | null>(null);
    useEffect(() => {
        if (!activeWorkspaceId) return;
        supabase
            .from('ai_settings')
            .select('business_name, system_instructions')
            .eq('id', activeWorkspaceId)
            .maybeSingle()
            .then(({ data }) => {
                setHasAiSettings(!!(data?.business_name || data?.system_instructions));
            });
    }, [activeWorkspaceId]);

    // Check if a CSV catalog has been uploaded (counts as having inventory for the checklist)
    const [hasCatalog, setHasCatalog] = useState<boolean | null>(null);
    useEffect(() => {
        if (!activeWorkspaceId || !userId) return;
        supabase
            .from('business_knowledge')
            .select('id')
            .eq('workspace_id', activeWorkspaceId)
            .maybeSingle()
            .then(({ data }) => {
                setHasCatalog(!!data);
            });
    }, [activeWorkspaceId, userId]);

    // Also show connected if the activeWorkspace has instagram info from WorkspaceContext
    const isConnected = instagramStatus?.connected || !!activeWorkspace?.instagram_username;

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

    // State for clearing activities
    const [clearing, setClearing] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Function to refetch all dashboard data (activities and inventory)
    const fetchDashboardData = () => {
        refetchActivities();
        refetchInventory();
    };

    const handleClearActivities = async () => {
        if (!userId) return;
        setClearing(true);
        try {
            const query = supabase
                .from('activity_log')
                .delete()
                .eq('user_id', userId);

            if (activeWorkspaceId) {
                query.eq('workspace_id', activeWorkspaceId);
            } else {
                query.is('workspace_id', null);
            }

            const { error } = await query;
            if (error) throw error;
            toast.success("Activity cleared");
            fetchDashboardData();
        } catch (err) {
            console.error('Failed to clear activity:', err);
            toast.error("Failed to clear activity");
        } finally {
            setClearing(false);
            setShowClearConfirm(false);
        }
    };

    const { data: allActivities, loading: activitiesLoading, refetch: refetchActivities } = useRealtime<ActivityLog>(
        'activity_log',
        '*',
        {
            filter: activeWorkspaceId ? { column: 'workspace_id', value: activeWorkspaceId } : undefined,
            orderBy: 'timestamp',
            orderDirection: 'desc',
            limit: 50,
            enabled: !!activeWorkspaceId,
            pollingInterval: 3000,
        }
    );

    const activities = allActivities;

    useRealtimeCount(
        'activity_log',
        activeWorkspaceId ? { column: 'workspace_id', value: activeWorkspaceId } : undefined,
        { pollingInterval: 3000, enabled: !!activeWorkspaceId }
    );
    // Adjust count to match the client-side filtered set
    const totalInteractions = activities.length;

    const { data: allInventoryItems, loading: inventoryLoading, refetch: refetchInventory } = useRealtime<InventoryItem>(
        'inventory',
        'id, stock_level',
        {
            filter: activeWorkspaceId ? { column: 'workspace_id', value: activeWorkspaceId } : undefined,
            enabled: !!activeWorkspaceId,
            pollingInterval: 3000,
        }
    );
    const inventoryItems = allInventoryItems;

    const { version } = useDashboard();

    useEffect(() => {
        if (version > 0) {
            refetchActivities();
            refetchInventory();
        }
    }, [version, refetchActivities, refetchInventory]);

    const stats = useMemo(() => {
        let moneySaved = 0;
        let aiReplies = 0;
        let manualReplies = 0;
        let comments = 0;
        let dms = 0;

        activities.forEach(log => {
            if (log.event_type === 'IG_SALE' && log.description) {
                const match = log.description.match(/\$([\d.]+)/);
                if (match) moneySaved += parseFloat(match[1]);
            }
            if (log.event_type === 'AI_REPLY' || log.event_type === 'COMMENT_REPLY' || log.event_type === 'automation_v2') aiReplies++;
            if (log.event_type === 'MANUAL_REPLY') manualReplies++;
            if (log.event_type === 'INCOMING_COMMENT') comments++;
            if (log.event_type === 'INCOMING_DM' || log.event_type === 'INCOMING_MESSAGE') dms++;
        });

        const timeSaved = (totalInteractions * 2) / 60;
        const stock = inventoryItems.reduce((sum, item) => sum + (item.stock_level || 0), 0);
        const automationRate = totalInteractions > 0 ? Math.round((aiReplies / Math.max(aiReplies + manualReplies, 1)) * 100) : 0;

        return { timeSaved, moneySaved, repliesSent: totalInteractions, stock, aiReplies, manualReplies, comments, dms, automationRate };
    }, [activities, totalInteractions, inventoryItems]);

    const loading = activitiesLoading;

    const getEventIcon = (eventType: string) => {
        if (eventType === 'SYSTEM_WARNING') return <AlertTriangle className="w-3.5 h-3.5" />;
        if (eventType === 'SALE' || eventType === 'IG_SALE') return <DollarSign className="w-3.5 h-3.5" />;
        if (eventType === 'RESTOCK' || eventType === 'NEW_ITEM') return <Package className="w-3.5 h-3.5" />;
        if (eventType === 'INCOMING_MESSAGE' || eventType === 'INCOMING_DM') return <MessageCircle className="w-3.5 h-3.5" />;
        if (eventType === 'INCOMING_COMMENT') return <MessageSquare className="w-3.5 h-3.5" />;
        if (eventType === 'COMMENT_REPLY') return <Send className="w-3.5 h-3.5" />;
        return <Bot className="w-3.5 h-3.5" />;
    };

    const getEventColor = (eventType: string) => {
        if (eventType === 'SYSTEM_WARNING') return 'text-red-400 bg-red-500/10';
        if (eventType === 'SALE' || eventType === 'IG_SALE' || eventType === 'AI_REPLY' || eventType === 'MANUAL_REPLY' || eventType === 'COMMENT_REPLY' || eventType === 'automation_v2') return 'text-emerald-400 bg-emerald-500/10';
        if (eventType === 'RESTOCK' || eventType === 'NEW_ITEM' || eventType === 'DRAFT_REPLY' || eventType === 'DRAFT_COMMENT_REPLY') return 'text-amber-400 bg-amber-500/10';
        if (eventType === 'INCOMING_MESSAGE' || eventType === 'INCOMING_DM' || eventType === 'INCOMING_COMMENT') return 'text-blue-400 bg-blue-500/10';
        return 'text-violet-400 bg-violet-500/10';
    };

    const formatTime = (timestamp: string) => {
        const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const filteredActivities = activities.filter(a => a.event_type !== 'CHAT_QUERY');

    // Clean up activity descriptions: strip version prefixes like "V3 sent:", "V2 sent:"
    const cleanDescription = (desc: string) => {
        return desc.replace(/^V\d+\s+sent:\s*/i, 'Sent: ');
    };

    // Generate chart data from activities (last 7 days)
    const chartData = useMemo(() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const series: ChartDataPoint[] = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            let count = 0;
            activities.forEach(a => {
                const ts = new Date(a.timestamp);
                if (ts.getDate() === d.getDate() && ts.getMonth() === d.getMonth()) count++;
            });
            series.push({ day: days[d.getDay()], interactions: count });
        }
        return series;
    }, [activities]);

    // Get greeting based on time
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }, []);

    const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

    return (
        <div className="min-h-[calc(100vh-2rem)] pb-8">

            {/* ═══════════════════════════════════════════════════ */}
            {/* HEADER — Greeting + Status                         */}
            {/* ═══════════════════════════════════════════════════ */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
            >
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {greeting}, {userName} 👋
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Here&apos;s what&apos;s happening with your Instagram today.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {workspaceStatus === 'needs_setup' && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-xs font-semibold">Setup Required</span>
                        </div>
                    )}
                    {workspaceStatus === 'connected' && (
                        <>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-1 border border-border">
                                <Instagram className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs text-muted-foreground">Connected</span>
                            </div>
                            <div className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-xl border",
                                autopilot === true
                                    ? "bg-primary/5 border-primary/20 text-primary"
                                    : autopilot === false
                                        ? "bg-surface-2 border-border text-muted-foreground"
                                        : "bg-surface-1 border-border animate-pulse"
                            )}>
                                <Zap className="w-4 h-4" />
                                <span className="text-xs font-medium">
                                    {autopilot === true ? 'Agent Active' : autopilot === false ? 'Agent Paused' : 'Syncing...'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* ACTIVATION CHECKLIST                               */}
            {/* ═══════════════════════════════════════════════════ */}
            <SetupChecklist
                hasInstagram={instagramStatus === null && !activeWorkspace?.instagram_username ? null : isConnected}
                hasInventory={inventoryLoading ? null : (inventoryItems.length > 0 || !!hasCatalog)}
                hasAiSettings={hasAiSettings}
                businessType={activeWorkspace?.business_type}
            />

            {/* ═══════════════════════════════════════════════════ */}
            {/* METRICS ROW — 4 Key Metrics                        */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    {
                        icon: MessageSquare,
                        label: 'Total Interactions',
                        value: stats.repliesSent,
                        color: 'text-violet-400',
                        bg: 'bg-violet-500/10',
                        change: 'All time',
                        changeColor: 'text-muted-foreground',
                    },
                    {
                        icon: Clock,
                        label: 'Time Saved',
                        value: stats.timeSaved,
                        suffix: 'h',
                        decimals: 1,
                        color: 'text-blue-400',
                        bg: 'bg-blue-500/10',
                        change: 'This week',
                        changeColor: 'text-muted-foreground',
                    },
                    {
                        icon: DollarSign,
                        label: 'Revenue Generated',
                        value: stats.moneySaved,
                        prefix: '$',
                        color: 'text-emerald-400',
                        bg: 'bg-emerald-500/10',
                        change: 'From sales',
                        changeColor: 'text-muted-foreground',
                    },
                    {
                        icon: Bot,
                        label: 'Automation Rate',
                        value: stats.automationRate,
                        suffix: '%',
                        color: 'text-primary',
                        bg: 'bg-primary/10',
                        change: 'AI handled',
                        changeColor: 'text-muted-foreground',
                    },
                ].map((metric, index) => (
                    <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                        className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 cursor-default group"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={clsx("p-2.5 rounded-xl", metric.bg)}>
                                <metric.icon className={clsx("w-5 h-5", metric.color)} />
                            </div>
                            <span className={clsx("text-[11px] font-medium flex items-center gap-1", metric.changeColor)}>
                                {metric.change}
                                {metric.changeColor === 'text-emerald-400' && <ArrowUpRight className="w-3 h-3" />}
                            </span>
                        </div>
                        <div className="text-2xl font-bold text-foreground leading-none mb-1.5 tracking-tight h-7 flex items-center">
                            {loading || inventoryLoading ? (
                                <div className="h-6 w-16 bg-surface-2 rounded animate-pulse" />
                            ) : (
                                <CountUp
                                    end={metric.value}
                                    prefix={metric.prefix}
                                    suffix={metric.suffix}
                                    decimals={metric.decimals ?? (metric.value % 1 !== 0 ? 1 : 0)}
                                />
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground">{metric.label}</span>
                    </motion.div>
                ))}
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* MAIN CONTENT — Chart + Activity + Status            */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                {/* ─── Engagement Chart (8 cols) ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="lg:col-span-8"
                >
                    <EngagementOverview
                        data={chartData}
                        metrics={{
                            dmsReceived: stats.dms,
                            comments: stats.comments,
                            aiReplies: stats.aiReplies,
                            manualReplies: stats.manualReplies,
                        }}
                        loading={loading}
                    />
                </motion.div>

                {/* ─── Quick Stats Panel (4 cols) ─── */}
                <div className="lg:col-span-4 flex flex-col gap-5">

                    {/* System Status */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 rounded-xl bg-emerald-500/10">
                                <Shield className="w-4 h-4 text-emerald-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">System Status</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Agent Mode</span>
                                {autopilot === null ? (
                                    <div className="h-5 w-20 bg-surface-2 rounded-full animate-pulse" />
                                ) : (
                                    <span className={clsx(
                                        "badge",
                                        autopilot === true
                                            ? "bg-emerald-500/10 text-emerald-400"
                                            : "bg-amber-500/10 text-amber-400"
                                    )}>
                                        {autopilot === true ? '🤖 Autopilot' : '👤 Manual'}
                                    </span>
                                )}
                            </div>
                            <div className="w-full h-px bg-surface-2" />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Status</span>
                                <span className="badge-success flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Online 24/7
                                </span>
                            </div>
                            <div className="w-full h-px bg-surface-2" />
                            {/* Inventory stat — only shown for product-based businesses */}
                            {activeWorkspace?.business_type === 'ecommerce' ? (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Inventory</span>
                                    {loading || inventoryLoading ? (
                                        <div className="h-4 w-24 bg-surface-2 rounded-md animate-pulse" />
                                    ) : (
                                        <span className="text-xs text-muted-foreground font-medium">{stats.stock} items in stock</span>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">AI Agent</span>
                                    <span className="text-xs font-medium text-emerald-400">Ready</span>
                                </div>
                            )}

                            {/* Automation Rate Bar */}
                            <div className="pt-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] text-muted-foreground">Automation Rate</span>
                                    {loading || inventoryLoading ? (
                                        <div className="h-3 w-8 bg-surface-2 rounded-md animate-pulse" />
                                    ) : (
                                        <span className="text-[11px] text-primary font-semibold">{stats.automationRate}%</span>
                                    )}
                                </div>
                                <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                                    {loading || inventoryLoading ? (
                                        <div className="h-full w-full bg-surface-2" />
                                    ) : (
                                        <motion.div
                                            initial={{ width: '0%' }}
                                            animate={{ width: `${stats.automationRate}%` }}
                                            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
                                            className="h-full bg-gradient-to-r from-primary to-violet-400 rounded-full"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Today's Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-violet-500/10">
                                <Sparkles className="w-4 h-4 text-violet-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">Today&apos;s Summary</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {totalInteractions > 10 ? (
                                <>Your agent handled <span className="text-foreground font-semibold">{totalInteractions}</span> interactions, saving you <span className="text-foreground font-semibold">{stats.timeSaved.toFixed(1)} hours</span> of manual work. {stats.moneySaved > 0 && <>You&apos;ve generated <span className="text-emerald-400 font-semibold">${stats.moneySaved.toFixed(0)}</span> in revenue.</>}</>
                            ) : totalInteractions > 0 ? (
                                <>Your agent has started processing interactions. Keep going — the data will get richer as more conversations come in!</>
                            ) : (
                                <span className="text-muted-foreground italic">Collecting data for your first summary. Once customers message you on Instagram, stats will appear here.</span>
                            )}
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* ACTIVITY FEED — Full Width                          */}
            {/* ═══════════════════════════════════════════════════ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-surface-1 border border-border shadow-sm rounded-2xl mt-5 overflow-hidden"
            >
                {/* Feed Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-surface-2">
                            <Activity className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
                        {filteredActivities.length > 0 && (
                            <span className="badge bg-surface-2 text-muted-foreground font-mono">
                                {filteredActivities.length}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {filteredActivities.length > 0 && (
                            <button
                                onClick={() => setClearModalOpen(true)}
                                className="text-[11px] text-red-400/50 hover:text-red-400 px-3 py-1.5 rounded-lg transition-all font-medium hover:bg-red-500/5 press"
                            >
                                Clear All
                            </button>
                        )}
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    </div>
                </div>

                {/* Feed Content */}
                <div className="h-[400px] overflow-y-auto custom-scrollbar">
                    {filteredActivities.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-6">
                            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                                <Sparkles className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">No activity yet</p>
                            <p className="text-[12px] text-muted-foreground leading-relaxed max-w-xs">Activity will appear here as your Ghost Agent processes Instagram messages and comments.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {filteredActivities.map((activity, i) => {
                                const colorClasses = getEventColor(activity.event_type);
                                return (
                                    <motion.div
                                        key={activity.id}
                                        initial={i < 5 ? { opacity: 0, x: 10 } : false}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i < 5 ? i * 0.03 : 0 }}
                                        className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface-3 transition-all group cursor-default"
                                    >
                                        <div className={clsx(
                                            "p-2 rounded-xl shrink-0",
                                            colorClasses
                                        )}>
                                            {getEventIcon(activity.event_type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 group-hover:text-muted-foreground transition-colors">
                                                {cleanDescription(activity.description)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <EventBadge type={activity.event_type} />
                                            <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                                                {formatTime(activity.timestamp)}
                                            </span>
                                        </div>

                                        {/* Send Action for Drafts */}
                                        {
                                            (activity.event_type === 'DRAFT_REPLY' || activity.description.startsWith('Draft:')) && (
                                                <button
                                                    onClick={() => handleApproveDraft(activity)}
                                                    disabled={sendingDrafts.includes(activity.id)}
                                                    className="h-9 w-9 flex items-center justify-center rounded-lg text-violet-400 hover:bg-violet-500/15 transition-all shrink-0 press"
                                                    title="Send Now"
                                                >
                                                    {sendingDrafts.includes(activity.id) ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Send className="w-3.5 h-3.5" />
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
        </div>
    );
}
