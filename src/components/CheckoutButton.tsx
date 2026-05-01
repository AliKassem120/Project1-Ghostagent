'use client';

import React, { useState } from 'react';
import { Loader2, ArrowRight, Shield } from 'lucide-react';

interface CheckoutButtonProps {
    userId: string;
    amount: number;
    planName?: string;
}

export default function CheckoutButton({ userId, amount, planName = 'Pro Agent' }: CheckoutButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCheckout = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/checkout/whish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    amount,
                    plan_name: planName
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Checkout failed');
            }

            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full bg-foreground text-background font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-foreground/10 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed border border-transparent hover:border-foreground/20 text-sm"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Generating payment link...</span>
                    </>
                ) : (
                    <>
                        <span>Pay ${amount.toFixed(2)} with Whish</span>
                        <ArrowRight className="w-4 h-4" />
                    </>
                )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/50 font-medium">
                <Shield className="w-3.5 h-3.5" />
                <span>256-bit SSL encrypted • Powered by Whish Money</span>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium text-center">
                    {error}
                </div>
            )}
        </div>
    );
}
