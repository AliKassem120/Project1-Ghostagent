'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import StarBackground from '@/components/StarBackground';
import GhostLogo from '@/components/GhostLogo';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings`,
            });

            if (resetError) {
                setError(resetError.message);
                setLoading(false);
                return;
            }

            setSubmitted(true);
        } catch (err) {
            console.error('Reset error:', err);
            setError('An unexpected error occurred. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
            <StarBackground />

            <div className="absolute top-6 left-6 z-20">
                <Link href="/login" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
            </div>

            <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="glass-dark p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl">
                    <div className="flex justify-center mb-8">
                        <div className="p-4 bg-primary/10 rounded-2xl shadow-[0_0_40px_rgba(192,132,252,0.2)]">
                            <GhostLogo className="w-12 h-12" />
                        </div>
                    </div>

                    {!submitted ? (
                        <>
                            <div className="text-center mb-10">
                                <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
                                <p className="text-white/60">Enter your email and we'll send you a link to return to the void.</p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleResetRequest} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/80 ml-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-black/40 transition-all"
                                            placeholder="ghost@agent.com"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-primary text-black font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Reset Link"}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center py-4 animate-in zoom-in-95 duration-500">
                            <div className="flex justify-center mb-6">
                                <div className="p-4 bg-green-500/20 rounded-full">
                                    <CheckCircle2 className="w-12 h-12 text-green-400" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold mb-4">Link Sent!</h2>
                            <p className="text-white/60 mb-8">
                                Check your email for further instructions on how to reset your password.
                            </p>
                            <Link
                                href="/login"
                                className="inline-block bg-white/5 border border-white/10 text-white font-medium py-3 px-8 rounded-xl hover:bg-white/10 transition-all"
                            >
                                Return to Login
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
