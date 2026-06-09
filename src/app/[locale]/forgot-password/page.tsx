'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import StarBackground from '@/components/StarBackground';
import GhostLogo from '@/components/GhostLogo';
import { createBrowserClient } from '@supabase/ssr';

// Create a custom supabase client with implicit flow specifically for cross-device forgot password
const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: {
            flowType: 'implicit',
        },
    }
);

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
                redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
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
        <div className="min-h-[100dvh] flex items-center justify-center p-6 relative overflow-x-clip">
            <StarBackground />

            <div className="absolute top-6 left-6 z-20">
                <Link href="/login" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
            </div>

            <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="bg-surface-1 p-8 md:p-12 rounded-3xl border border-border shadow-2xl">
                    <div className="flex justify-center mb-8">
                        <div className="p-4 bg-primary/10 rounded-2xl shadow-[0_0_40px_rgba(192,132,252,0.1)]">
                            <GhostLogo iconOnly className="w-12 h-12" />
                        </div>
                    </div>

                    {!submitted ? (
                        <>
                            <div className="text-center mb-10">
                                <h1 className="text-3xl font-bold mb-2 text-foreground tracking-tight">Reset Password</h1>
                                <p className="text-muted-foreground font-medium">Enter your email and we'll send you a link to return to the void.</p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleResetRequest} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground ml-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30" />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-surface-2 border border-border rounded-xl py-4 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/50 focus:bg-surface-3 transition-all font-medium"
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
                            <h2 className="text-2xl font-bold mb-4 text-foreground tracking-tight">Link Sent!</h2>
                            <p className="text-muted-foreground font-medium mb-8 leading-relaxed">
                                Check your email for further instructions on how to reset your password.
                            </p>
                            <Link
                                href="/login"
                                className="inline-block bg-surface-2 border border-border text-foreground font-bold py-3 px-8 rounded-xl hover:bg-surface-3 transition-all shadow-sm"
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
