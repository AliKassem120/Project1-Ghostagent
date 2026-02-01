'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, DollarSign, Package, TrendingUp, TrendingDown, CheckCircle2, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from '@/components/CountUp';
import FloatingGhost from '@/components/FloatingGhost';
import ApprovalQueue from '@/components/ApprovalQueue';
import { useAutopilot } from '@/context/AutopilotContext';
import clsx from 'clsx';
import GhostChat from '../components/GhostChat';
import { createClient } from '@/utils/supabase/client';

type ActivityLog = {
    id: string;
    event_type: string;
    description: string;
    timestamp: string;
};

export default function DashboardPage() {
    const { autopilot } = useAutopilot();
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const supabase = createClient();

    useEffect(() => {
        const fetchActivity = async () => {
            const { data } = await supabase
                .from('activity_log')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(10);

            if (data) setActivities(data);
        };

        fetchActivity();

        // Optional: Realtime subscription could go here
    }, []);

    const [stats, setStats] = useState({ comments: 0, sales: 0, stock: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch comments (activity log count)
            const { count: commentsCount } = await supabase
                .from('activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            // Fetch stock (sum of stock_level)
            const { data: inventory } = await supabase
                .from('inventory')
                .select('stock_level')
                .eq('user_id', user.id);

            const totalStock = inventory?.reduce((sum, item) => sum + (item.stock_level || 0), 0) || 0;

            setStats({
                comments: commentsCount || 0,
                sales: 0, // Placeholder
                stock: totalStock
            });
        };
        fetchStats();
    }, []);

    const metrics = [
        {
            icon: MessageSquare,
            label: 'Total Comments',
            value: stats.comments,
            trend: 0,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/20'
        },
        {
            icon: DollarSign,
            label: 'Sales Converted',
            value: stats.sales,
            prefix: '$',
            suffix: ' USD',
            trend: 0,
            color: 'text-green-400',
            bgColor: 'bg-green-500/20',
            glow: true
        },
        {
            icon: Package,
            label: 'Active Stock',
            value: stats.stock,
            trend: 0,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/20'
        },
    ];

    return (
        <div className="space-y-6 pb-12">
            {/* Header with Floating Ghost */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative">
                <div className="z-10">
                    <h1 className="text-3xl lg:text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        Dashboard Overview
                    </h1>
                    <div className="flex items-center gap-2">
                        <div className={clsx(
                            "w-2 h-2 rounded-full",
                            autopilot ? "bg-green-500 animate-pulse" : "bg-yellow-500"
                        )} />
                        <p className="text-white/60 text-sm lg:text-base">
                            {autopilot
                                ? "Your AI sales agent is online and auto-replying"
                                : "Agent is drafting responses for your approval"}
                        </p>
                    </div>
                </div>
                <div className="absolute right-0 top-0 -translate-y-1/4 lg:relative lg:translate-y-0 opacity-30 lg:opacity-100 pointer-events-none lg:pointer-events-auto">
                    <FloatingGhost />
                </div>
            </div>

            {/* BENTO GRID LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* LEFT MAIN COLUMN (3fr) */}
                <div className="lg:col-span-3 space-y-6">

                    {/* Row 1: Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {metrics.map((metric, index) => (
                            <motion.div
                                key={metric.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1, duration: 0.5 }}
                                className={clsx(
                                    "glass-dark p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all group backdrop-blur-md",
                                    metric.glow && "hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]"
                                )}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 rounded-xl ${metric.bgColor} ${metric.color} group-hover:scale-110 transition-transform`}>
                                        <metric.icon className="w-6 h-6" />
                                    </div>
                                    <div className={clsx(
                                        "px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1",
                                        metric.trend > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                    )}>
                                        {metric.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {Math.abs(metric.trend)}%
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className={clsx("text-3xl font-black", metric.glow && "text-green-400 glow-text")}>
                                        <CountUp end={metric.value} prefix={metric.prefix || ''} suffix={metric.suffix || ''} decimals={metric.prefix === '$' ? 2 : 0} />
                                    </div>
                                    <div className="text-sm text-white/60 font-medium">{metric.label}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Row 2: Console / GhostChat */}
                    <div className="h-[600px] w-full relative glass-dark rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                        {/* Pass height prop or wrap style if needed, but GhostChat usually handles its own height. We force container here. */}
                        <div className="absolute inset-0">
                            <GhostChat />
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDEBAR COLUMN (1fr) */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6 glass-dark rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[calc(100vh-6rem)] backdrop-blur-md">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wide">
                                <Activity className="w-4 h-4 text-primary" />
                                {autopilot ? "Live Activity" : "Approvals"}
                            </h3>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                            <AnimatePresence mode="wait">
                                {!autopilot ? (
                                    <motion.div
                                        key="approval-queue"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                    >
                                        <ApprovalQueue />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="recent-activity"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="space-y-4"
                                    >
                                        {activities.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-12 text-center opacity-70">
                                                <div className="relative w-32 h-32 mb-6">
                                                    <div className="absolute inset-0 border-2 border-green-500/20 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.1)]" />
                                                    <div className="absolute inset-[10%] border border-green-500/10 rounded-full" />
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                                        className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,rgba(34,197,94,0.3)_360deg)]"
                                                    />
                                                </div>
                                                <div className="font-mono text-green-400 text-[10px] tracking-widest uppercase animate-pulse">
                                                    SCANNING...
                                                </div>
                                            </div>
                                        ) : (
                                            activities.map((log) => (
                                                <div key={log.id} className="p-4 glass rounded-xl border border-white/5 hover:bg-white/10 transition-colors group">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/5 text-xs font-bold text-white/70">
                                                            {log.event_type.slice(0, 1)}
                                                        </div>
                                                        <span className="font-bold text-white/90 text-xs">{log.event_type}</span>
                                                    </div>
                                                    <p className="text-white/60 text-xs leading-relaxed pl-1">{log.description}</p>
                                                    <div className="mt-2 text-right">
                                                        <span className="text-[10px] text-white/30 font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

