'use client';

import { useState, useEffect } from 'react';
import { Check, Crown, Zap, CreditCard, Calendar, AlertCircle, X, TrendingUp, MessageSquare, DollarSign, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { PLANS } from '@/lib/plans';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';

export default function BillingPage() {
    const [currentPlan, setCurrentPlan] = useState<string>('Starter');
    const [planDetails, setPlanDetails] = useState<{
        tier: string;
        trial_ends_at: string | null;
        period_end: string | null;
        cancel_at_period_end: boolean;
    }>({ tier: 'free_trial', trial_ends_at: null, period_end: null, cancel_at_period_end: false });

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showDowngradeModal, setShowDowngradeModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [targetPlan, setTargetPlan] = useState<{name: string, price: number} | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [usage, setUsage] = useState({ replies: 0, conversations: 0, revenue: 0 });
    const supabase = createClient();
    const toast = useToast();

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch User Plan data
            const { data: userData } = await supabase
                .from('users')
                .select('plan_tier, trial_ends_at, current_period_end, cancel_at_period_end')
                .eq('id', user.id)
                .single();

            if (userData) {
                const tier = userData.plan_tier || 'free_trial';
                setPlanDetails({
                    tier,
                    trial_ends_at: userData.trial_ends_at,
                    period_end: userData.current_period_end,
                    cancel_at_period_end: userData.cancel_at_period_end || false
                });

                // Map database tier to UI plan name
                if (tier === 'Pro Agent' || tier === 'pro') setCurrentPlan('Pro Agent');
                else if (tier === 'Empire') setCurrentPlan('Empire');
                else setCurrentPlan('Starter');
            }

            // 2. Fetch Usage (monthly)
            const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            const { count } = await supabase
                .from('activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('event_type', ['AI_REPLY', 'COMMENT_REPLY'])
                .gte('timestamp', firstDayOfMonth);

            setUsage(prev => ({ ...prev, replies: count || 0 }));
        };
        fetchData();
    }, []);

    const plans = PLANS.map(p => ({
        name: p.name,
        price: p.price,
        description: p.description,
        icon: p.icon,
        color: p.color,
        bg: p.bg,
        features: p.features,
        highlight: p.highlight,
        dmLimit: p.dmLimit,
    }));

        const handlePlanChange = async (planName: string, planPrice: number) => {
        const currentPrice = currentPlanData?.price || 0;
        setTargetPlan({ name: planName, price: planPrice });

        if (planName === 'Starter') {
            setShowCancelModal(true);
        } else if (planPrice > currentPrice) {
            setShowUpgradeModal(true);
        } else if (planPrice < currentPrice) {
            setShowDowngradeModal(true);
        }
    };

    const handleUpgradeProceed = async () => {
        if (!targetPlan) return;
        setIsUpdating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const res = await fetch('/api/checkout/whish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: targetPlan.price,
                    user_id: user.id,
                    plan_name: targetPlan.name
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Checkout failed');
            }

            const data = await res.json();
            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (error: any) {
            console.error('Plan change error:', error);
            toast.error('Failed to upgrade: ' + (error.message || 'Unknown error'));
            setIsUpdating(false);
        }
    };

    const handleDowngradeProceed = async () => {
        if (!targetPlan) return;
        setIsUpdating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let dbTier = 'pro';
            if (targetPlan.name === 'Starter') dbTier = 'starter';

            const { error } = await supabase
                .from('users')
                .update({ cancel_at_period_end: true, next_plan_tier: dbTier })
                .eq('id', user.id);

            if (error) throw error;

            setShowDowngradeModal(false);
            toast.info(`Downgrade scheduled. You will move to ${targetPlan.name} at the end of your billing cycle.`);
            setPlanDetails(prev => ({ ...prev, cancel_at_period_end: true }));
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to schedule downgrade.');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCancelSubscription = async () => {
        setIsUpdating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('users')
                .update({ cancel_at_period_end: true, next_plan_tier: 'starter' })
                .eq('id', user.id);

            if (error) throw error;

            setShowCancelModal(false);
            toast.info('Subscription cancelled. You will move to Starter at the end of the billing cycle.');
            setPlanDetails(prev => ({ ...prev, cancel_at_period_end: true }));
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to cancel subscription.');
        } finally {
            setIsUpdating(false);
        }
    };

    const currentPlanData = plans.find(p => p.name === currentPlan);

    return (
        <div className="space-y-6 pb-6 md:pb-8">

            {/* ═══ HEADER ═══ */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing & Subscription</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your plan, usage, and payment details.</p>
            </motion.div>

            {/* ═══ CURRENT PLAN CARD ═══ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-surface-1 border border-border shadow-sm rounded-2xl overflow-hidden"
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
                                    <h2 className="text-xl font-bold text-foreground">{currentPlan}</h2>
                                    {planDetails.cancel_at_period_end ? (
                                        <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider">
                                            Cancels {planDetails.period_end ? new Date(planDetails.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Soon'}
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">Active</span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">{currentPlanData?.description}</p>
                            </div>
                        </div>
                        <div className="text-left sm:text-right">
                            <div className="text-3xl font-bold text-foreground">
                                ${currentPlanData?.price || 0}
                                <span className="text-sm text-muted-foreground font-normal ml-1">/mo</span>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-2 max-w-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    {planDetails.tier === 'free_trial' ? 'Trial Ends' : 'Next Billing'}
                                </p>
                                <p className="text-sm font-semibold text-muted-foreground">
                                    {planDetails.period_end || planDetails.trial_ends_at
                                        ? new Date(planDetails.period_end || planDetails.trial_ends_at!).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })
                                        : 'Account verify pending'}
                                </p>
                            </div>
                        </div>
                    </div>                    <div className="flex flex-col sm:flex-row gap-3">
                        
                        {currentPlan !== 'Starter' && (
                            <button
                                onClick={() => setShowCancelModal(true)}
                                className="px-5 py-2.5 bg-red-500/5 border border-red-500/10 rounded-xl hover:bg-red-500/10 transition-all text-sm font-medium text-red-400/60 hover:text-red-400"
                            >
                                Cancel Subscription
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* ═══ USAGE STATS ═══ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 ml-1">This Month&apos;s Usage</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { icon: MessageSquare, label: 'Auto-Replies Sent', value: usage.replies, limit: currentPlan === 'Empire' ? 'Unlimited' : `/ ${currentPlanData?.dmLimit || 100} limit`, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                        { icon: TrendingUp, label: 'Conversations', value: usage.conversations, limit: 'Active threads', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        { icon: DollarSign, label: 'Revenue Generated', value: `$${usage.revenue}`, limit: 'From AI sales', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    ].map((stat, i) => (
                        <div key={stat.label} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-5">
                            <div className={clsx("p-2 rounded-xl w-fit mb-3", stat.bg)}>
                                <stat.icon className={clsx("w-4 h-4", stat.color)} />
                            </div>
                            <div className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
                            <div className={clsx("text-[10px] font-semibold mt-2", stat.color === 'text-emerald-400' ? 'text-emerald-400/60' : 'text-muted-foreground')}>{stat.limit}</div>
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
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 ml-1">Available Plans</h3>
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
                                    : "bg-surface-1 border border-border shadow-sm"
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

                            <h4 className="text-lg font-bold text-foreground mb-1">{plan.name}</h4>
                            <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>

                            <div className="mb-6">
                                <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                                <span className="text-sm text-muted-foreground ml-1">/mo</span>
                            </div>

                            <ul className="space-y-2.5 mb-6">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                                        <Check className={clsx("w-3.5 h-3.5 shrink-0", plan.highlight ? 'text-primary' : 'text-muted-foreground')} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            {plan.name === currentPlan ? (
                                <button disabled className="w-full py-3 rounded-xl bg-surface-2 text-muted-foreground cursor-not-allowed text-sm font-medium">
                                    Current Plan
                                </button>
                            ) : (
                                <button
                                    onClick={() => handlePlanChange(plan.name, plan.price)}
                                    disabled={isUpdating}
                                    className={clsx(
                                        "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50",
                                        plan.highlight
                                            ? "bg-primary text-black hover:opacity-90 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                                            : "bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
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

                        {/* ═══ UPGRADE MODAL ═══ */}
            <AnimatePresence>
                {showUpgradeModal && targetPlan && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowUpgradeModal(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                        />
                        <div className="fixed inset-0 z-[51] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="relative w-full max-w-md glass-dark rounded-2xl p-8 border border-border"
                            >
                                <button
                                    onClick={() => setShowUpgradeModal(false)}
                                    className="absolute top-4 right-4 p-2 rounded-lg bg-surface-2 hover:bg-surface-2 transition-colors"
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>

                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2.5 rounded-xl bg-primary/10">
                                        <TrendingUp className="w-5 h-5 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground">Upgrade to {targetPlan.name}</h3>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="p-4 rounded-xl bg-surface-2 border border-border flex items-center gap-4">
                                        <Calendar className="w-5 h-5 text-muted-foreground" />
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">New Billing Cycle</p>
                                            <p className="text-sm font-semibold text-foreground">
                                                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} 
                                                {' '}–{' '} 
                                                {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center p-4 rounded-xl bg-surface-2 border border-border">
                                        <span className="text-sm font-medium text-muted-foreground">Total due today</span>
                                        <span className="text-xl font-bold text-foreground">${targetPlan.price}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleUpgradeProceed}
                                    disabled={isUpdating}
                                    className="w-full py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isUpdating ? 'Redirecting...' : 'Proceed with Whish Money'}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* ═══ DOWNGRADE MODAL ═══ */}
            <AnimatePresence>
                {showDowngradeModal && targetPlan && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDowngradeModal(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                        />
                        <div className="fixed inset-0 z-[51] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="relative w-full max-w-md glass-dark rounded-2xl p-8 border border-border"
                            >
                                <button
                                    onClick={() => setShowDowngradeModal(false)}
                                    className="absolute top-4 right-4 p-2 rounded-lg bg-surface-2 hover:bg-surface-2 transition-colors"
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>

                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2.5 rounded-xl bg-surface-2">
                                        <AlertCircle className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground">Schedule Downgrade</h3>
                                </div>

                                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                                    You are moving to the <span className="font-medium text-foreground">{targetPlan.name}</span> plan. 
                                    You will keep your current <span className="text-primary font-medium">{currentPlan}</span> features until the end of your billing cycle on{' '}
                                    <span className="font-medium text-foreground">
                                        {planDetails.period_end ? new Date(planDetails.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'the end of your cycle'}
                                    </span>.
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowDowngradeModal(false)}
                                        className="flex-1 py-3 bg-surface-2 border border-border rounded-xl hover:bg-surface-3 transition-all font-medium text-sm text-muted-foreground"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDowngradeProceed}
                                        disabled={isUpdating}
                                        className="flex-1 py-3 bg-surface-2 border border-border text-foreground rounded-xl hover:bg-surface-3 transition-all font-medium text-sm disabled:opacity-50"
                                    >
                                        {isUpdating ? 'Scheduling...' : 'Confirm Downgrade'}
                                    </button>
                                </div>
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
                                    className="absolute top-4 right-4 p-2 rounded-lg bg-surface-2 hover:bg-surface-2 transition-colors"
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>

                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 rounded-xl bg-red-500/10">
                                        <AlertCircle className="w-5 h-5 text-red-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground">Downgrade to Starter?</h3>
                                </div>

                                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                                    You&apos;ll lose access to <span className="text-muted-foreground font-medium">{currentPlan}</span> features after {planDetails.period_end || planDetails.trial_ends_at
                                        ? new Date(planDetails.period_end || planDetails.trial_ends_at!).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })
                                        : 'the end of your current cycle'}. Your data will be preserved but the AI agent will stop responding.
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowCancelModal(false)}
                                        className="flex-1 py-3 bg-surface-2 border border-border rounded-xl hover:bg-surface-3 transition-all font-medium text-sm text-muted-foreground"
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
