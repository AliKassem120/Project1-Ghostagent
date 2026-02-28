'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Lock, Mail, Sparkles, Zap, MessageSquare, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import StarBackground from '@/components/StarBackground';
import GhostLogo from '@/components/GhostLogo';
import { supabase } from '@/lib/supabase';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                setError(signInError.message);
                setLoading(false);
                return;
            }

            window.location.href = '/dashboard';
        } catch (err) {
            console.error('Login error:', err);
            setError('An unexpected error occurred. Please try again.');
            setLoading(false);
        }
    };

    // Removed old handleGoogleLogin
    return (
        <div className="min-h-screen flex relative overflow-hidden">
            <StarBackground />

            {/* Back to Home */}
            <div className="absolute top-6 left-6 z-20">
                <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
                    <ArrowLeft className="w-4 h-4" /> Back
                </Link>
            </div>

            {/* ─── Left Panel: Branding & Animation ─── */}
            <div className="hidden lg:flex flex-1 flex-col justify-center items-center relative px-12">
                {/* Animated floating elements */}
                <div className="absolute inset-0 overflow-hidden">
                    {[...Array(3)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-64 h-64 rounded-full"
                            style={{
                                background: `radial-gradient(circle, rgba(139, 92, 246, ${0.08 - i * 0.02}) 0%, transparent 70%)`,
                                left: `${20 + i * 25}%`,
                                top: `${20 + i * 20}%`,
                            }}
                            animate={{
                                y: [0, -30, 0],
                                x: [0, 15, 0],
                                scale: [1, 1.1, 1],
                            }}
                            transition={{
                                duration: 6 + i * 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.5,
                            }}
                        />
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="relative z-10 max-w-md"
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <GhostLogo className="w-10 h-10 text-primary" />
                        </div>
                        <span className="text-2xl font-bold text-foreground tracking-tight">GhostAgent</span>
                    </div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="text-4xl font-bold text-foreground leading-tight mb-4"
                    >
                        Your AI sales agent
                        <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-400">
                            never sleeps.
                        </span>
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="text-muted-foreground text-lg leading-relaxed mb-10 font-medium"
                    >
                        Automate your Instagram DMs and comments with AI. Reply instantly, close sales, and grow your business — 24/7.
                    </motion.p>

                    {/* Feature pills */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.6 }}
                        className="flex flex-col gap-3"
                    >
                        {[
                            { icon: Zap, text: 'Instant AI replies to DMs & comments', color: 'text-amber-400 bg-amber-500/10' },
                            { icon: MessageSquare, text: 'Full conversation inbox & analytics', color: 'text-blue-400 bg-blue-500/10' },
                            { icon: Shield, text: 'Human takeover at any time', color: 'text-emerald-400 bg-emerald-500/10' },
                        ].map((feature, i) => (
                            <motion.div
                                key={feature.text}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.7 + i * 0.15 }}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-1 border border-border shadow-sm"
                            >
                                <div className={`p-1.5 rounded-lg ${feature.color}`}>
                                    <feature.icon className="w-4 h-4" />
                                </div>
                                <span className="text-sm text-muted-foreground font-medium">{feature.text}</span>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>
            </div>

            {/* ─── Right Panel: Login Form ─── */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="w-full max-w-md"
                >
                    {/* Mobile Logo */}
                    <div className="flex justify-center mb-8 lg:hidden">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <GhostLogo className="w-10 h-10" />
                        </div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-center mb-8 lg:text-left"
                    >
                        <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Welcome back</h1>
                        <p className="text-muted-foreground font-medium">Sign in to your dashboard</p>
                    </motion.div>

                    {/* Google Login — Primary action */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mb-6"
                    >
                        <GoogleSignInButton
                            onSuccess={() => {
                                window.location.href = '/dashboard';
                            }}
                            onError={(err) => {
                                setError(err.message || 'Failed to sign in with Google');
                            }}
                        />
                    </motion.div>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-background px-4 text-muted-foreground uppercase tracking-wider font-bold">or sign in with email</span>
                        </div>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-surface-1 border border-border rounded-xl py-3.5 pl-11 pr-4 text-foreground text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:bg-surface-2 transition-all shadow-sm"
                                    placeholder="you@company.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-surface-1 border border-border rounded-xl py-3.5 pl-11 pr-4 text-foreground text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:bg-surface-2 transition-all shadow-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end">
                            <Link href="/forgot-password" className="text-xs text-primary/70 hover:text-primary transition-colors">Forgot password?</Link>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary/10 border border-primary/20 text-primary font-semibold py-3.5 rounded-xl hover:bg-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-muted-foreground font-medium">
                        Don&apos;t have an account? <Link href="/register" className="text-primary hover:underline transition-colors">Start Free Trial</Link>
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
