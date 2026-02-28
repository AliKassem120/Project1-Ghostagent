'use client';

import React, { useState } from 'react';

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

            // Redirect to the mock checkout URL
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
        <div className="flex flex-col items-center justify-center p-6 bg-gray-900 rounded-2xl shadow-xl border border-gray-800">
            <div className="mb-6 text-center">
                <h3 className="text-xl font-semibold text-foreground">Complete Your Payment</h3>
                <p className="text-sm text-gray-400 mt-2">Secure checkout via Whish Money</p>
            </div>

            <button
                onClick={handleCheckout}
                disabled={loading}
                className="relative inline-flex items-center justify-center px-8 py-4 font-medium text-foreground transition-all duration-300 ease-in-out bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 overflow-hidden group w-full max-w-xs"
            >
                <div className="absolute inset-0 bg-surface-2 group-hover:translate-x-full transition-transform duration-500 ease-in-out -translate-x-full skew-x-12" />

                {loading ? (
                    <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 text-foreground animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Processing...</span>
                    </div>
                ) : (
                    <span className="flex items-center gap-2">
                        Pay with Whish
                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </span>
                )}
            </button>

            {error && (
                <div className="mt-4 p-3 text-sm text-red-200 bg-red-900/50 rounded-lg border border-red-800/50 w-full max-w-xs text-center">
                    {error}
                </div>
            )}
        </div>
    );
}
