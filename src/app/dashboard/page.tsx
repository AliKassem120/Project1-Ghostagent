'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, DollarSign, Package, TrendingUp, TrendingDown, Activity, Instagram, Clock, Zap, MessageCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from '@/components/CountUp';
import FloatingGhost from '@/components/FloatingGhost';
import GhostChat from '@/app/components/GhostChat'; // Checked path
import { useAutopilot } from '@/context/AutopilotContext';
import clsx from 'clsx';
import { createClient } from '@/utils/supabase/client';

export default function DashboardPage() {
    const { autopilot } = useAutopilot();
    const supabase = createClient();
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

    // Stats & Activities
    const [stats, setStats] = useState({ comments: 0, sales: 0, stock: 0 });
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboardData = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Auto-Clean logs older than 24 hours
            const yesterday = new Date();
            yesterday.setHours(yesterday.getHours() - 24);
            await supabase
                .from('activity_log')
                .delete()
                .lt('timestamp', yesterday.toISOString());

            // 2. Fetch real logs (filtered)
            const { data: logs } = await supabase
                .from('activity_log')
                .select('*')
                .neq('event_type', 'CHAT_QUERY') // Filter out generic chats at db level too if possible
                .order('timestamp', { ascending: false })
                .limit(20);

            if (logs) {
                // Client-side filter just in case
                const highValueLogs = logs.filter(l => l.event_type !== 'CHAT_QUERY');
                setActivities(highValueLogs);
            }

            // 3. Fetch Stats
            // Fetch comments count (all time or last 24h?) - keeping all time for now as "Total"
            const { count: commentsCount } = await supabase
                .from('activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            // Fetch inventory stock
            const { data: inventory } = await supabase
                .from('inventory')
                .select('stock_level')
                .eq('user_id', user.id);

            const totalStock = inventory?.reduce((sum, item) => sum + (item.stock_level || 0), 0) || 0;

            setStats({
                comments: commentsCount || 0,
                sales: 1240, // Mocked for now
                stock: totalStock
            });
            setLoading(false);
        };
        loadDashboardData();
    }, []);

    const metrics = [
        {
            icon: Clock,
            label: 'Time Saved',
            value: 4.5,
            suffix: ' hrs',
            trend: 12,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/20'
        },
        {
            icon: DollarSign,
            label: 'Money Made',
            value: stats.sales,
            prefix: '$',
            trend: 8,
            color: 'text-green-400',
            bgColor: 'bg-green-500/20',
            glow: true
        },
        {
            icon: MessageSquare,
            label: 'Replies Sent',
            value: stats.comments,
            trend: 24,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/20'
        },
    ];

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col overflow-hidden pb-safe">
            {/* STICKY Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6 shrink-0 sticky top-0 z-50 py-4 glass-dark -mx-4 px-4 lg:static lg:bg-transparent lg:p-0 lg:m-0 backdrop-blur-xl border-b border-white/10 lg:border-none">
                <div>
                    <h1 className="text-3xl font-black mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 flex items-center gap-3">
                        COMMAND CENTER <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/30 tracking-widest">LIVE</span>
                    </h1>
                    <p className="text-white/40 text-sm">Real-time neural link established.</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Agent Status Bar */}
                    <div className="hidden md:flex items-center gap-6 bg-white/5 border border-white/10 px-6 py-2 rounded-full backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-white/40 uppercase tracking-widest">Handled</span>
                            <span className="font-bold text-white">{stats.comments}</span>
                        </div>
                        <div className="w-px h-4 bg-white/10" />
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-white/40 uppercase tracking-widest">Saved</span>
                            <span className="font-bold text-cyan-400">4.2 Hrs</span>
                        </div>
                        <div className="w-px h-4 bg-white/10" />
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs font-mono text-green-400">ACTIVE IN DMs</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-6 overflow-hidden min-h-0">

                {/* LEFT HERO SECTION (70%) */}
                <div className="lg:col-span-7 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">

                    {/* 1. Intelligence Summary Box (TOP) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 p-6 rounded-2xl relative overflow-hidden shrink-0"
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                            <Zap className="w-24 h-24 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-indigo-300 mb-2 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Daily Intelligence
                        </h3>
                        <p className="text-white/80 text-lg leading-relaxed max-w-2xl relative z-10">
                            "I've handled <span className="text-white font-bold">142 customer interactions</span> today. The most common question was about the <span className="text-indigo-300 underline decoration-dotted">Neon Hoodie sizing</span>. I saved you approximately 4.5 hours of typing."
                        </p>
                    </motion.div>

                    {/* 2. Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                        {metrics.map((metric, index) => (
                            <motion.div
                                key={metric.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 + (index * 0.1) }}
                                className={clsx(
                                    "glass-dark p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all group",
                                    metric.glow && "shadow-[0_0_30px_rgba(34,197,94,0.1)] hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]"
                                )}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${metric.bgColor} ${metric.color}`}>
                                        <metric.icon className="w-6 h-6" />
                                    </div>
                                    <div className="text-xs font-mono text-white/40 flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3 text-green-400" /> +{metric.trend}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-3xl font-black text-white/90">
                                        <CountUp end={metric.value} prefix={metric.prefix} suffix={metric.suffix} decimals={metric.value % 1 !== 0 ? 1 : 0} />
                                    </div>
                                    <div className="text-sm text-white/40 font-medium mt-1">{metric.label}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* 3. Live IG Feed */}
                    <div className="flex-1 glass-dark rounded-2xl border border-white/10 overflow-hidden flex flex-col min-h-[300px]">
                        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                            <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wide">
                                <Instagram className="w-4 h-4 text-pink-500" />
                                Live Feed
                            </h3>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                LISTENING
                            </div>
                        </div>
                        <div className="p-4 space-y-3 overflow-y-auto">
                            {activities.length === 0 && !loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                        <Sparkles className="w-6 h-6 text-white/30" />
                                    </div>
                                    <p className="font-medium text-white/60">The Ghost is working in silence...</p>
                                    <p className="text-xs text-white/30 mt-1">No critical events to report yet, but I'm watching.</p>
                                </div>
                            ) : (
                                activities
                                    .filter(a => a.event_type !== 'CHAT_QUERY')
                                    .map((activity, i) => (
                                        <motion.div
                                            key={activity.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-colors group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors">
                                                {activity.event_type === 'SALE' ? <DollarSign className="w-5 h-5 text-green-400" /> :
                                                    activity.event_type === 'RESTOCK' ? <Package className="w-5 h-5 text-purple-400" /> :
                                                        <MessageCircle className="w-5 h-5 text-white/70" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-white/90 truncate">{activity.event_type}</span>
                                                    <span className="text-xs font-mono text-white/30">
                                                        {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-white/50 truncate">
                                                    {activity.description}
                                                </p>
                                            </div>
                                        </motion.div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT ASSISTANT SECTION (30%) - DESKTOP */}
                <div className="hidden lg:flex lg:col-span-3 flex-col h-full bg-black/20 rounded-2xl border border-white/10 overflow-hidden relative">
                    <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:20px_20px]" />
                    <div className="p-4 bg-white/5 border-b border-white/10 backdrop-blur-md z-10">
                        <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wide text-cyan-400">
                            <Activity className="w-4 h-4" />
                            Ghost Operator
                        </h3>
                    </div>
                    <div className="flex-1 overflow-hidden relative z-10 p-2">
                        <GhostChat />
                    </div>
                </div>

            </div>

            {/* MOBILE: Floating Action Button for Chat */}
            <div className="lg:hidden fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => setIsMobileChatOpen(true)}
                    className="w-14 h-14 rounded-full bg-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.5)] flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all"
                >
                    <MessageSquare className="w-6 h-6" />
                </button>
            </div>

            {/* MOBILE: Chat Drawer */}
            <AnimatePresence>
                {isMobileChatOpen && (
                    <div className="lg:hidden fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
                            onClick={() => setIsMobileChatOpen(false)}
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="w-full sm:w-[500px] max-h-[500px] h-[50vh] bg-black border-t sm:border border-white/10 sm:rounded-tl-2xl sm:rounded-tr-2xl relative pointer-events-auto overflow-hidden flex flex-col"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                                <span className="font-bold text-white">Ghost Operator</span>
                                <button
                                    onClick={() => setIsMobileChatOpen(false)}
                                    className="p-2 text-white/50 hover:text-white"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <GhostChat />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}


