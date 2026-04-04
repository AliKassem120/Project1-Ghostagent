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
    const [selectedPlan, setSelectedPlan] = useState<'free_trial' | 'pro'>('free_trial');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                }
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
                plan_tier: 'free_trial',
                trial_ends_at: trialEnd.toISOString(),
            }, { onConflict: 'id' });
        }

        if (selectedPlan === 'pro' && data?.user?.id) {
            toast.success('Registration successful! Redirecting to checkout...');
            router.push(`/checkout?user_id=${data.user.id}&amount=49`);
            return;
        }

        if (data?.session) {
            toast.success('Registration successful! Redirecting to your dashboard...');
            router.push('/dashboard');
            return;
        }

        toast.success('Registration successful! Please check your email for verification.');
        router.push('/login');
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

                        <div className="space-y-3 pt-2">
                            <label className="text-sm font-bold text-muted-foreground ml-1">Select Plan</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlan('free_trial')}
                                    className={`p-4 rounded-xl border text-left transition-all ${selectedPlan === 'free_trial'
                                        ? 'bg-primary/10 border-primary shadow-sm'
                                        : 'bg-surface-2 border-border hover:bg-surface-3 shadow-sm'
                                        }`}
                                >
                                    <div className={`font-bold mb-1 ${selectedPlan === 'free_trial' ? 'text-primary' : 'text-foreground'}`}>Starter</div>
                                    <div className="text-xs text-muted-foreground font-medium mb-2">$0 / month</div>
                                    <ul className="text-[11px] text-muted-foreground space-y-1">
                                        <li>✓ 50 AI Replies / month</li>
                                        <li>✓ 1 Instagram Account</li>
                                        <li>✓ Arabic & English</li>
                                    </ul>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlan('pro')}
                                    className={`p-4 rounded-xl border text-left transition-all ${selectedPlan === 'pro'
                                        ? 'bg-primary/10 border-primary shadow-sm'
                                        : 'bg-surface-2 border-border hover:bg-surface-3 shadow-sm'
                                        }`}
                                >
                                    <div className={`font-bold mb-1 ${selectedPlan === 'pro' ? 'text-primary' : 'text-foreground'}`}>Pro Agent</div>
                                    <div className="text-xs text-muted-foreground font-medium mb-2">$49 / month</div>
                                    <ul className="text-[11px] text-muted-foreground space-y-1">
                                        <li>✓ 1,000 AI Replies / month</li>
                                        <li>✓ Inventory Sync</li>
                                        <li>✓ Sales Analytics</li>
                                    </ul>
                                </button>
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
                </div>
            </div>
        </div>
    );
}
