'use client';

import { useState, useEffect } from 'react';
import { Check, Crown, Zap, CreditCard, Calendar, AlertCircle, X } from 'lucide-react';
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
            features: ['50 Auto-Replies/mo', 'Basic Analytics', 'Community Support'],
        },
        {
            name: 'Pro Agent',
            price: 49,
            features: ['Unlimited Replies', 'Inventory Sync', 'Advanced Analytics', 'Priority Support'],
        },
        {
            name: 'Empire',
            price: 199,
            features: ['Everything in Pro', 'Multiple Accounts', 'Custom AI Model', 'API Access', 'Dedicated Support'],
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
        // Simulate payment update
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
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
                <p className="text-white/60">Manage your plan and payment details.</p>
            </div>

            {/* Current Plan Card */}
            <div className="glass-card p-8 rounded-2xl">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/20 rounded-xl">
                            <Crown className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Current Plan: {currentPlan}</h2>
                            <p className="text-white/60">Billed monthly</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-primary font-mono">
                            ${currentPlanData?.price || 0} USD
                        </div>
                        <div className="text-sm text-white/40">per month</div>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6 p-6 bg-white/5 rounded-xl">
                    <div>
                        <div className="text-white/60 text-sm mb-1">Next billing date</div>
                        <div className="font-bold flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Feb 23, 2026
                        </div>
                    </div>
                    <div>
                        <div className="text-white/60 text-sm mb-1">Payment method</div>
                        <div className="font-bold flex items-center gap-2">
                            <CreditCard className="w-4 h-4" /> {paymentMethod}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        className="px-6 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors font-medium"
                    >
                        Update Payment Method
                    </button>
                    <button
                        onClick={() => setShowCancelModal(true)}
                        className="px-6 py-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors font-medium"
                    >
                        Cancel Subscription
                    </button>
                </div>
            </div>

            {/* Usage Stats */}
            <div className="glass-card p-8 rounded-2xl">
                <h3 className="text-xl font-bold mb-6">This Month's Usage</h3>
                <div className="grid md:grid-cols-3 gap-6">
                    <div>
                        <div className="text-white/60 text-sm mb-2">Auto-Replies Sent</div>
                        <div className="text-3xl font-bold">{usage.replies}</div>
                        <div className="text-primary text-sm mt-1">Unlimited</div>
                    </div>
                    <div>
                        <div className="text-white/60 text-sm mb-2">Conversations Handled</div>
                        <div className="text-3xl font-bold">{usage.conversations}</div>
                        <div className="text-white/40 text-sm mt-1">Syncing...</div>
                    </div>
                    <div>
                        <div className="text-white/60 text-sm mb-2">Revenue Generated</div>
                        <div className="text-3xl font-bold text-emerald-400 font-mono">${usage.revenue} USD</div>
                        <div className="text-green-400 text-sm mt-1">+0% from last month</div>
                    </div>
                </div>
            </div>

            {/* Available Plans */}
            <div>
                <h3 className="text-2xl font-bold mb-6">Available Plans</h3>
                <div className="grid md:grid-cols-3 gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={clsx(
                                "p-6 rounded-2xl border transition-all",
                                plan.name === currentPlan
                                    ? "border-primary/30 bg-primary/5 shadow-lg"
                                    : "border-white/10 bg-white/5 hover:bg-white/10"
                            )}
                        >
                            {plan.name === currentPlan && (
                                <div className="text-xs font-bold text-primary mb-2 flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> CURRENT PLAN
                                </div>
                            )}
                            <h4 className="text-xl font-bold mb-2">{plan.name}</h4>
                            <div className="text-3xl font-bold mb-4">
                                ${plan.price}
                                <span className="text-sm text-white/40 font-normal">/mo</span>
                            </div>
                            <ul className="space-y-3 mb-6">
                                {plan.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            {plan.name === currentPlan ? (
                                <button disabled className="w-full py-2 rounded-lg bg-white/10 text-white/40 cursor-not-allowed">
                                    Current Plan
                                </button>
                            ) : (
                                <button
                                    onClick={() => handlePlanChange(plan.name)}
                                    disabled={isUpdating}
                                    className="w-full py-2 rounded-lg bg-primary text-black font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {isUpdating ? 'Processing...' : plan.price > (currentPlanData?.price || 0) ? 'Upgrade' : 'Downgrade'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Payment Modal */}
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
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative w-full max-w-md glass-dark rounded-3xl p-8 border border-white/10"
                            >
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <h3 className="text-2xl font-bold mb-6">Update Payment Method</h3>
                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="text-sm text-white/60 mb-2 block">Card Number</label>
                                        <input
                                            type="text"
                                            placeholder="1234 5678 9012 3456"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:border-primary/50 outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm text-white/60 mb-2 block">Exp Date</label>
                                            <input
                                                type="text"
                                                placeholder="MM/YY"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:border-primary/50 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-white/60 mb-2 block">CVV</label>
                                            <input
                                                type="text"
                                                placeholder="123"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:border-primary/50 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleUpdatePayment}
                                    disabled={isUpdating}
                                    className="w-full py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {isUpdating ? 'Updating...' : 'Update Payment Method'}
                                </button>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* Cancel Modal */}
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
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative w-full max-w-md glass-dark rounded-3xl p-8 border border-red-500/20"
                            >
                                <button
                                    onClick={() => setShowCancelModal(false)}
                                    className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-4 mb-6">
                                    <div className="p-3 bg-red-500/20 rounded-xl">
                                        <AlertCircle className="w-6 h-6 text-red-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold">Cancel Subscription?</h3>
                                </div>

                                <p className="text-white/60 mb-6">
                                    You'll lose access to Pro features after Feb 23, 2026. Are you sure you want to cancel?
                                </p>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setShowCancelModal(false)}
                                        className="flex-1 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors font-medium"
                                    >
                                        Keep Subscription
                                    </button>
                                    <button
                                        onClick={handleCancelSubscription}
                                        disabled={isUpdating}
                                        className="flex-1 py-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50"
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
