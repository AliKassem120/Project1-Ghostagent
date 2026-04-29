'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Lock, Mail, User } from 'lucide-react';
import StarBackground from '@/components/StarBackground';
import GhostLogo from '@/components/GhostLogo';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';

export default function RegisterPage() {
    const router = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isPendingVerification, setIsPendingVerification] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            }
        });

        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }

        // Set trial_ends_at = 14 days from now for all new free accounts
        if (data?.user?.id) {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 14);
            await supabase.from('users').upsert({
                id: data.user.id,
                plan_tier: 'free_trial', // Keep everyone on free_trial initially
                trial_ends_at: trialEnd.toISOString(),
            }, { onConflict: 'id' });
        }

        toast.success('Registration successful! Please check your email.');
        setLoading(false);
        setIsPendingVerification(true);
    };

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 relative overflow-x-clip">
            <StarBackground />

            <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 mt-8 mb-8">
                {/* Back to Home positioned above the card */}
                <div className="mb-6 flex">
                    <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium bg-surface-1/50 backdrop-blur-md px-4 py-2 rounded-full border border-border/50">
                        <ArrowLeft className="w-4 h-4" /> Back to Home
                    </Link>
                </div>

                <div className="bg-surface-1 p-6 sm:p-8 md:p-12 rounded-3xl border border-border shadow-2xl">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-primary/10 rounded-2xl shadow-[0_0_40px_rgba(192,132,252,0.1)]">
                            <GhostLogo className="w-10 h-10 text-primary" />
                        </div>
                    </div>

                    {isPendingVerification ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Mail className="w-8 h-8 text-primary" />
                            </div>
                            <h1 className="text-2xl font-bold mb-4 text-foreground tracking-tight">Check your email</h1>
                            <p className="text-muted-foreground font-medium mb-8">
                                We sent a verification link to <span className="text-primary">{email}</span>. Please click the link to activate your account.
                            </p>
                            <div className="text-sm text-foreground/60 mb-2">
                                Didn't receive it? Check your spam folder.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-10">
                                <h1 className="text-3xl font-bold mb-2 text-foreground tracking-tight">Create Account</h1>
                                <p className="text-muted-foreground font-medium">Start selling on Instagram with AI.</p>
                            </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground ml-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30" />
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-surface-2 border border-border rounded-xl py-4 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/50 focus:bg-surface-3 transition-all font-medium"
                                    placeholder="Ghost Rider"
                                />
                            </div>
                        </div>

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

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-surface-2 border border-border rounded-xl py-4 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/50 focus:bg-surface-3 transition-all font-medium"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-black font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign Up"}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-muted-foreground font-medium">
                        Already have an account? <Link href="/login" className="text-primary hover:underline font-bold transition-colors">Sign In</Link>
                    </div>
                    </>
                    )}
                </div>
            </div>
        </div>
    );
}
