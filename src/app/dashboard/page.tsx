'use client';

import { MessageSquare, DollarSign, Package, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from '@/components/CountUp';
import FloatingGhost from '@/components/FloatingGhost';
import ApprovalQueue from '@/components/ApprovalQueue';
import { useAutopilot } from '@/context/AutopilotContext';
import clsx from 'clsx';

export default function DashboardPage() {
    const { autopilot } = useAutopilot();

    const metrics = [
        {
            icon: MessageSquare,
            label: 'Total Comments',
            value: 1247,
            trend: +12.5,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/20'
        },
        {
            icon: DollarSign,
            label: 'Sales Converted',
            value: 8450,
            prefix: '$',
            suffix: ' USD',
            trend: +23.8,
            color: 'text-green-400',
            bgColor: 'bg-green-500/20',
            glow: true
        },
        {
            icon: Package,
            label: 'Active Stock',
            value: 342,
            trend: -5.2,
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
                                <h2 className="text-2xl font-bold">Recent Conversions</h2>
                                <span className="text-xs text-white/40 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                                    Auto-processed by Agent
                                </span>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { user: '@sarah_j', product: 'Neon Ghost Light', amount: 49.99, time: '5m ago' },
                                    { user: '@mike_drops', product: 'Phantom Hoodie', amount: 85.00, time: '12m ago' },
                                    { user: '@lux_life', product: 'Ectoplasm Lamp', amount: 120.00, time: '25m ago' },
                                ].map((sale, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between p-4 glass rounded-xl hover:bg-white/10 transition-colors border border-white/5"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500" />
                                            <div>
                                                <div className="font-medium">{sale.user}</div>
                                                <div className="text-sm text-white/60">{sale.product}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-green-400 glow-text text-lg">
                                                ${sale.amount.toFixed(2)} USD
                                            </div>
                                            <div className="text-xs text-white/40">{sale.time}</div>
                                        </div>
                                    </div>
                                ))}
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

