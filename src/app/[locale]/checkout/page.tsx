'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Crown, Zap, Check, Shield, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import CheckoutButton from '@/components/CheckoutButton';
import StarBackground from '@/components/StarBackground';
import GhostLogo from '@/components/GhostLogo';

const PLAN_FEATURES: Record<string, string[]> = {
    'Pro Agent': [
        'Unlimited AI replies',
        'Full booking automation',
        'E-commerce order capture',
        'Custom AI persona & tone',
        'Priority email support',
    ],
    'Empire': [
        'Everything in Pro Agent',
        'Multi-workspace support',
        'Sales & booking analytics',
        'Custom AI persona & tone',
        'Priority email support',
        'Advanced integrations',
    ],
};

function CheckoutContent() {
    const searchParams = useSearchParams();
    const userId = searchParams.get('user_id');
    const amountStr = searchParams.get('amount') || '49';
    const planName = searchParams.get('plan') || 'Pro Agent';
    const amount = parseFloat(amountStr);
    const hasError = searchParams.get('error');
    const features = PLAN_FEATURES[planName] || PLAN_FEATURES['Pro Agent'];

    if (!userId) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center p-10 bg-surface-1/80 backdrop-blur-xl rounded-[2.5rem] border border-border/60 shadow-2xl max-w-md w-full relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
                <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <Shield className="w-7 h-7 text-red-400" />
                </div>
                <h2 className="text-xl font-black text-foreground mb-2 tracking-tight">Invalid Session</h2>
                <p className="text-muted-foreground text-sm mb-6 font-medium">No user ID provided. Please log in or sign up first.</p>
                <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-surface-2 border border-border/50 rounded-2xl text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-all">
                    <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
            </motion.div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row relative z-10 min-h-screen">

            {/* ── LEFT SIDE: Plan Benefits ── */}
            <div className="hidden lg:flex flex-1 flex-col justify-center p-12 lg:p-20 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/10 blur-[140px] rounded-full pointer-events-none -z-10" />

                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-md"
                >
                    <div className="flex items-center gap-3 mb-10">
                        <div className="p-3 bg-surface-1 border border-border/50 rounded-2xl shadow-sm">
                            <GhostLogo className="w-8 h-8" />
                        </div>
                        <span className="text-xl font-black text-foreground tracking-tighter">GhostAgent</span>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6"
                    >
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-primary tracking-widest uppercase">Upgrade Your Business</span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="text-4xl lg:text-5xl font-black text-foreground leading-[1.1] tracking-tighter mb-6"
                    >
                        Unlock the full
                        <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-400">
                            power of AI
                        </span>
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="text-muted-foreground text-lg leading-relaxed mb-10 font-medium"
                    >
                        Your {planName} plan includes everything you need to automate your business 24/7.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                        className="space-y-3"
                    >
                        {features.map((feature, i) => (
                            <motion.div
                                key={feature}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + i * 0.08 }}
                                className="flex items-center gap-3 text-sm text-foreground font-semibold"
                            >
                                <div className="p-1 rounded-lg bg-primary/10">
                                    <Check className="w-3.5 h-3.5 text-primary" />
                                </div>
                                {feature}
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>
            </div>

            {/* ── RIGHT SIDE: Checkout Card ── */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative w-full">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-[420px]"
                >
                    {/* Mobile Logo */}
                    <div className="flex flex-col items-center mb-8 lg:hidden mt-8">
                        <div className="p-3 bg-surface-1 border border-border/50 rounded-2xl shadow-sm mb-4">
                            <GhostLogo className="w-8 h-8" />
                        </div>
                    </div>

                    <div className="bg-surface-1/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2.5rem] border border-border/60 shadow-2xl relative overflow-hidden">
                        {/* Decorative top gradient */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                        {/* Plan Badge */}
                        <div className="flex justify-center mb-6 relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150" />
                            <div className="w-14 h-14 bg-surface-2 border border-border/50 rounded-2xl flex items-center justify-center relative z-10 shadow-lg">
                                {planName === 'Empire'
                                    ? <Crown className="w-7 h-7 text-amber-400" />
                                    : <Zap className="w-7 h-7 text-primary" />
                                }
                            </div>
                        </div>

                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-black text-foreground mb-2 tracking-tight">
                                Upgrade to {planName}
                            </h1>
                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                                Secure checkout • Cancel anytime
                            </p>
                        </div>

                        {hasError && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium text-center">
                                Payment failed. Please try again.
                            </div>
                        )}

                        {/* Order Summary */}
                        <div className="bg-surface-2 border border-border/50 rounded-2xl p-5 mb-6 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-medium">Plan</span>
                                <span className="font-bold text-foreground">{planName}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-medium">Billing</span>
                                <span className="text-foreground font-medium">Monthly</span>
                            </div>
                            <div className="border-t border-border/50 pt-3 mt-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-foreground">Total</span>
                                    <div className="text-right">
                                        <span className="text-2xl font-black text-foreground">${amount.toFixed(2)}</span>
                                        <span className="text-muted-foreground text-xs font-medium ml-1">/mo</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <CheckoutButton userId={userId} amount={amount} planName={planName} />
                    </div>

                    {/* Footer Links */}
                    <div className="mt-8 flex items-center justify-center gap-6 text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">
                        <Link href="/privacy" className="hover:text-muted-foreground transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-muted-foreground transition-colors">Terms</Link>
                        <Link href="/contact" className="hover:text-muted-foreground transition-colors">Contact</Link>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <div className="min-h-[100dvh] flex relative overflow-hidden bg-background">
            <StarBackground />

            <div className="absolute top-0 left-0 p-4 lg:p-6 z-20">
                <Link href="/dashboard/billing" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-1/50 backdrop-blur-md border border-border/50 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-all">
                    <ArrowLeft className="w-4 h-4" /> Back
                </Link>
            </div>

            <Suspense fallback={
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-muted-foreground text-sm animate-pulse font-medium">Loading checkout...</div>
                </div>
            }>
                <CheckoutContent />
            </Suspense>
        </div>
    );
}
