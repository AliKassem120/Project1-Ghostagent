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

        if (selectedPlan === 'pro' && data?.user?.id) {
            toast.success('Registration successful! Redirecting to checkout...');
            // Pass minimal data to checkout page securely via query param for this mock flow
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
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
            <StarBackground />

            <div className="absolute top-6 left-6 z-20">
                <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>
            </div>

            <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="glass-dark p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl">
                    <div className="flex justify-center mb-8">
                        <div className="p-4 bg-primary/10 rounded-2xl shadow-[0_0_40px_rgba(192,132,252,0.2)]">
                            <GhostLogo className="w-12 h-12" />
                        </div>
                    </div>

                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold mb-2">Create Account</h1>
                        <p className="text-white/60">Join the elite network of GhostAgents.</p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80 ml-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-black/40 transition-all"
                                    placeholder="Ghost Rider"
                                />
                            </div>
                        </div>

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

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80 ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-black/40 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="text-sm font-medium text-white/80 ml-1">Select Plan</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlan('free_trial')}
                                    className={`p-4 rounded-xl border text-left transition-all ${selectedPlan === 'free_trial'
                                        ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                                        : 'bg-black/20 border-white/10 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="font-bold text-white mb-1">Free Trial</div>
                                    <div className="text-xs text-white/60">14 Days</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlan('pro')}
                                    className={`p-4 rounded-xl border text-left transition-all ${selectedPlan === 'pro'
                                        ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                                        : 'bg-black/20 border-white/10 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="font-bold text-white mb-1">Pro Agent</div>
                                    <div className="text-xs text-white/60">$49/mo</div>
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

                    <div className="mt-8 text-center text-sm text-white/40">
                        Already have an account? <Link href="/login" className="text-white hover:underline">Sign In</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
