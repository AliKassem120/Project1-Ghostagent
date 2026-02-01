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
        <div className="space-y-8 pb-12">
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

            {/* Ghost Agent Chat Interface */}
            <div className="w-full">
                <GhostChat />
            </div>

            {/* Glassmorphic KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {metrics.map((metric, index) => (
                    <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        className={clsx(
                            "glass-dark p-6 rounded-3xl border border-white/10 hover:border-white/20 transition-all group",
                            metric.glow && "hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]"
                        )}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-3 rounded-xl ${metric.bgColor} ${metric.color} group-hover:scale-110 transition-transform`}>
                                <metric.icon className="w-6 h-6" />
                            </div>

                            {/* Trend Badge */}
                            <div className={clsx(
                                "px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1",
                                metric.trend > 0
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                            )}>
                                {metric.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(metric.trend)}%
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className={clsx(
                                "text-3xl font-black",
                                metric.glow && "text-green-400 glow-text"
                            )}>
                                <CountUp
                                    end={metric.value}
                                    prefix={metric.prefix || ''}
                                    suffix={metric.suffix || ''}
                                    decimals={metric.prefix === '$' ? 2 : 0}
                                />
                            </div>
                            <div className="text-sm text-white/60 font-medium">{metric.label}</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Dynamic Section: Approval Queue or Recent Activity */}
            <AnimatePresence mode="wait">
                {!autopilot ? (
                    <motion.div
                        key="approval-queue"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.4 }}
                    >
                        <ApprovalQueue />
                    </motion.div>
                ) : (
                    <motion.div
                        key="recent-activity"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-6"
                    >
                        <div className="glass-dark p-8 rounded-3xl border border-white/10">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold">Live Activity Feed</h2>
                                <span className="text-xs text-white/40 flex items-center gap-1">
                                    <Activity className="w-3 h-3 text-primary" />
                                    Real-time Events
                                </span>
                            </div>
                            <div className="space-y-4">
                                {activities.length === 0 ? (
                                    <div className="text-center text-white/40 py-8 italic">No recent activity detected.</div>
                                ) : (
                                    activities.map((log) => (
                                        <div
                                            key={log.id}
                                            className="flex items-center justify-between p-4 glass rounded-xl hover:bg-white/10 transition-colors border border-white/5"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                                                    <span className="text-xs font-bold">{log.event_type.slice(0, 2)}</span>
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white/90">{log.event_type}</div>
                                                    <div className="text-sm text-white/50">{log.description}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-white/40">
                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Avg Response Time', value: '12s' },
                                { label: 'Active Chats', value: '34' },
                                { label: 'Conversion Rate', value: '23%' },
                                { label: 'Customer Satisfaction', value: '4.8/5' },
                            ].map((stat, i) => (
                                <div key={i} className="glass p-4 rounded-xl border border-white/5 text-center">
                                    <div className="text-2xl font-bold text-primary mb-1">{stat.value}</div>
                                    <div className="text-xs text-white/60">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

