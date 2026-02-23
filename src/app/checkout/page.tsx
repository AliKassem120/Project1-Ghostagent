'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CheckoutButton from '@/components/CheckoutButton';
import StarBackground from '@/components/StarBackground';
import GhostLogo from '@/components/GhostLogo';

function CheckoutContent() {
    const searchParams = useSearchParams();
    const userId = searchParams.get('user_id');
    const amountStr = searchParams.get('amount') || '49';
    const planName = searchParams.get('plan') || 'Pro Agent';
    const amount = parseFloat(amountStr);

    if (!userId) {
        return (
            <div className="text-center p-8 glass-dark rounded-3xl border border-white/10 max-w-md w-full animate-in fade-in">
                <h2 className="text-xl font-bold text-red-400 mb-2">Invalid Session</h2>
                <p className="text-white/60 text-sm mb-6">No user ID provided. Please log in or sign up first.</p>
                <Link href="/login" className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors inline-block text-white font-medium text-sm">
                    Back to Login
                </Link>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 mx-auto">
            <div className="glass-dark p-8 md:p-10 rounded-3xl border border-white/10 shadow-2xl">
                <div className="flex justify-center mb-6">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-[0_0_30px_rgba(192,132,252,0.2)]">
                        <GhostLogo className="w-10 h-10" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold mb-1">Upgrade to {planName}</h1>
                    <p className="text-white/60 text-sm">Complete your setup to activate premium features.</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-white/70">Plan</span>
                        <span className="font-bold text-white">{planName}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                        <span className="text-white/70">Billing Cycle</span>
                        <span className="text-white">Monthly</span>
                    </div>
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-bold text-white">Total due</span>
                        <span className="font-bold text-primary">${amount.toFixed(2)}</span>
                    </div>
                </div>

                <CheckoutButton userId={userId} amount={amount} planName={planName} />

                <p className="text-center text-xs text-white/40 mt-6 mt-4">
                    Secure checkout provided by Whish Money. You can cancel at any time.
                </p>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
            <StarBackground />

            <div className="absolute top-6 left-6 z-20">
                <Link href="/login" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium">
                    <ArrowLeft className="w-4 h-4" /> Go Back
                </Link>
            </div>

            <Suspense fallback={
                <div className="text-white/50 text-sm animate-pulse flex items-center gap-2">
                    Loading checkout...
                </div>
            }>
                <CheckoutContent />
            </Suspense>
        </div>
    );
}
