'use client';

import { useState, useEffect } from 'react';
import { Check, Crown, Zap, CreditCard, Calendar, AlertCircle, X, TrendingUp, MessageSquare, DollarSign, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';

export default function BillingPage() {
    const [currentPlan, setCurrentPlan] = useState<string>('Pro Agent');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('•••• 4242');
    const [isUpdating, setIsUpdating] = useState(false);
    const [usage, setUsage] = useState({ replies: 0, conversations: 0, revenue: 0 });
    const supabase = createClient();
    const toast = useToast();

    useEffect(() => {
        const fetchUsage = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { count } = await supabase
                .from('activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('event_type', 'CHAT_QUERY');

            setUsage(prev => ({ ...prev, replies: count || 0 }));
        };
        fetchUsage();
    }, []);

    const plans = [
        {
            name: 'Starter',
            price: 0,
            description: 'For getting started',
            icon: Zap,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            features: ['50 Auto-Replies / month', 'Basic Analytics', 'Community Support', '1 Instagram Account'],
            highlight: false,
        },
        {
            name: 'Pro Agent',
            price: 49,
            description: 'Most popular for growing stores',
            icon: Crown,
            color: 'text-primary',
            bg: 'bg-primary/10',
            features: ['Unlimited Replies', 'Inventory Sync', 'Advanced Analytics', 'Priority Support', 'WhatsApp Alerts'],
            highlight: true,
        },
        {
            name: 'Empire',
            price: 199,
            description: 'For enterprise-scale operations',
            icon: Shield,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            features: ['Everything in Pro', 'Multiple Accounts', 'Custom AI Model', 'API Access', 'Dedicated Manager', 'SLA Guaranteed'],
            highlight: false,
        }
    ];

    const handlePlanChange = (planName: string) => {
        setIsUpdating(true);
        setTimeout(() => {
            setCurrentPlan(planName);
            setIsUpdating(false);
            toast.success(`Successfully ${planName === 'Starter' ? 'downgraded to' : 'upgraded to'} ${planName}!`);
        }, 1500);
    };

    const handleUpdatePayment = () => {
        setIsUpdating(true);
        setTimeout(() => {
            setPaymentMethod('•••• 5678');
            setShowPaymentModal(false);
            setIsUpdating(false);
            toast.success('Payment method updated successfully!');
        }, 1500);
    };

    const handleCancelSubscription = () => {
        setIsUpdating(true);
        setTimeout(() => {
            setCurrentPlan('Starter');
            setShowCancelModal(false);
            setIsUpdating(false);
            toast.info('Subscription cancelled. You\'ll remain on Pro until Feb 23, 2026.');
        }, 1500);
    };

    const currentPlanData = plans.find(p => p.name === currentPlan);

    return (
        <div className="space-y-6 pb-6 md:pb-8">

            {/* ═══ HEADER ═══ */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-2xl font-bold tracking-tight text-white">Billing & Subscription</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your plan, usage, and payment details.</p>
            </motion.div>

            {/* ═══ CURRENT PLAN CARD ═══ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass-card rounded-2xl overflow-hidden"
            >
                {/* Plan gradient strip */}
                <div className="h-1 bg-gradient-to-r from-primary via-violet-400 to-fuchsia-500" />

                <div className="p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-primary/10">
                                <Crown className="w-7 h-7 text-primary" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-white">{currentPlan}</h2>
                                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">Active</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">{currentPlanData?.description}</p>
                            </div>
                        </div>
                        <div className="text-left sm:text-right">
                            <div className="text-3xl font-bold text-white">
                                ${currentPlanData?.price || 0}
                                <span className="text-sm text-white/30 font-normal ml-1">/mo</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                            <Calendar className="w-4 h-4 text-white/30 shrink-0" />
                            <div>
                                <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Next Billing</p>
                                <p className="text-sm font-semibold text-white/70">Feb 23, 2026</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                            <CreditCard className="w-4 h-4 text-white/30 shrink-0" />
                            <div>
                                <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Payment Method</p>
                                <p className="text-sm font-semibold text-white/70">Visa {paymentMethod}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => setShowPaymentModal(true)}
                            className="px-5 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all text-sm font-medium text-white/60 hover:text-white/80"
                        >
                            Update Payment
                        </button>
                        <button
                            onClick={() => setShowCancelModal(true)}
                            className="px-5 py-2.5 bg-red-500/5 border border-red-500/10 rounded-xl hover:bg-red-500/10 transition-all text-sm font-medium text-red-400/60 hover:text-red-400"
                        >
                            Cancel Subscription
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* ═══ USAGE STATS ═══ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 ml-1">This Month&apos;s Usage</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { icon: MessageSquare, label: 'Auto-Replies Sent', value: usage.replies, limit: currentPlan === 'Starter' ? '/ 50 limit' : 'Unlimited', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                        { icon: TrendingUp, label: 'Conversations', value: usage.conversations, limit: 'Active threads', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        { icon: DollarSign, label: 'Revenue Generated', value: `$${usage.revenue}`, limit: 'From AI sales', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    ].map((stat, i) => (
                        <div key={stat.label} className="glass-card rounded-2xl p-5">
                            <div className={clsx("p-2 rounded-xl w-fit mb-3", stat.bg)}>
                                <stat.icon className={clsx("w-4 h-4", stat.color)} />
                            </div>
                            <div className="text-2xl font-bold text-white tracking-tight">{stat.value}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
                            <div className={clsx("text-[10px] font-semibold mt-2", stat.color === 'text-emerald-400' ? 'text-emerald-400/60' : 'text-white/20')}>{stat.limit}</div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* ═══ AVAILABLE PLANS ═══ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
            >
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 ml-1">Available Plans</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {plans.map((plan, i) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + i * 0.08 }}
                            className={clsx(
                                "relative rounded-2xl p-6 transition-all duration-300",
                                plan.highlight
                                    ? "bg-primary/[0.04] border-2 border-primary/20 shadow-[0_0_40px_rgba(139,92,246,0.08)]"
                                    : "glass-card"
                            )}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-black text-[10px] font-black uppercase tracking-wider">
                                    Most Popular
                                </div>
                            )}

                            {plan.name === currentPlan && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-primary mb-3">
                                    <Zap className="w-3 h-3" /> CURRENT PLAN
                                </div>
                            )}

                            <div className={clsx("p-2.5 rounded-xl w-fit mb-4", plan.bg)}>
                                <plan.icon className={clsx("w-5 h-5", plan.color)} />
                            </div>

                            <h4 className="text-lg font-bold text-white mb-1">{plan.name}</h4>
                            <p className="text-xs text-white/30 mb-4">{plan.description}</p>

                            <div className="mb-6">
                                <span className="text-3xl font-bold text-white">${plan.price}</span>
                                <span className="text-sm text-white/25 ml-1">/mo</span>
                            </div>

                            <ul className="space-y-2.5 mb-6">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-2.5 text-sm text-white/60">
                                        <Check className={clsx("w-3.5 h-3.5 shrink-0", plan.highlight ? 'text-primary' : 'text-white/20')} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            {plan.name === currentPlan ? (
                                <button disabled className="w-full py-3 rounded-xl bg-white/[0.04] text-white/25 cursor-not-allowed text-sm font-medium">
                                    Current Plan
                                </button>
                            ) : (
                                <button
                                    onClick={() => handlePlanChange(plan.name)}
                                    disabled={isUpdating}
                                    className={clsx(
                                        "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50",
                                        plan.highlight
                                            ? "bg-primary text-black hover:opacity-90 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                                            : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                                    )}
                                >
                                    {isUpdating ? 'Processing...' : (
                                        <>
                                            {plan.price > (currentPlanData?.price || 0) ? 'Upgrade' : 'Downgrade'}
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            )}
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* ═══ PAYMENT MODAL ═══ */}
            <AnimatePresence>
                {showPaymentModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowPaymentModal(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                        />
                        <div className="fixed inset-0 z-[51] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="relative w-full max-w-md glass-dark rounded-2xl p-8 border border-white/[0.06]"
                            >
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-4 h-4 text-white/40" />
                                </button>

                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2.5 rounded-xl bg-primary/10">
                                        <CreditCard className="w-5 h-5 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Update Payment</h3>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Card Number</label>
                                        <input
                                            type="text"
                                            placeholder="1234 5678 9012 3456"
                                            className="input-premium w-full"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Exp Date</label>
                                            <input type="text" placeholder="MM/YY" className="input-premium w-full" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">CVV</label>
                                            <input type="text" placeholder="123" className="input-premium w-full" />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleUpdatePayment}
                                    disabled={isUpdating}
                                    className="w-full py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {isUpdating ? 'Updating...' : 'Save Payment Method'}
                                </button>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* ═══ CANCEL MODAL ═══ */}
            <AnimatePresence>
                {showCancelModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCancelModal(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                        />
                        <div className="fixed inset-0 z-[51] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="relative w-full max-w-md glass-dark rounded-2xl p-8 border border-red-500/10"
                            >
                                <button
                                    onClick={() => setShowCancelModal(false)}
                                    className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-4 h-4 text-white/40" />
                                </button>

                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 rounded-xl bg-red-500/10">
                                        <AlertCircle className="w-5 h-5 text-red-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Cancel Subscription?</h3>
                                </div>

                                <p className="text-sm text-white/40 mb-6 leading-relaxed">
                                    You&apos;ll lose access to <span className="text-white/60 font-medium">{currentPlan}</span> features after Feb 23, 2026. Your data will be preserved but the AI agent will stop responding.
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowCancelModal(false)}
                                        className="flex-1 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all font-medium text-sm text-white/60"
                                    >
                                        Keep Subscription
                                    </button>
                                    <button
                                        onClick={handleCancelSubscription}
                                        disabled={isUpdating}
                                        className="flex-1 py-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all font-medium text-sm disabled:opacity-50"
                                    >
                                        {isUpdating ? 'Cancelling...' : 'Yes, Cancel'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
