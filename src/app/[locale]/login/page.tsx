'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Loader2, Lock, Mail, MessageSquare, Shield, CalendarDays, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import StarBackground from '@/components/StarBackground';
import GhostLogo from '@/components/GhostLogo';
import { supabase } from '@/lib/supabase';
import GoogleSignInButton from '@/components/GoogleSignInButton';

import { useTranslations } from 'next-intl';

export default function LoginPage() {
    const router = useRouter();
    const tLogin = useTranslations('Login');
    const tAuth = useTranslations('Auth');
    const tCommon = useTranslations('Common');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);

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

            if (typeof window !== 'undefined') {
                localStorage.setItem('remember_me', rememberMe ? 'true' : 'false');
                sessionStorage.setItem('session_active', 'true');
            }

            window.location.href = '/dashboard';
        } catch (err) {
            console.error('Login error:', err);
            setError('An unexpected error occurred. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-background">
            <StarBackground />

            {/* Back to Home - Cleaner Container */}
            <div className="absolute top-0 left-0 p-4 lg:p-6 z-20">
                <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-1/50 backdrop-blur-md border border-border/50 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-all">
                    <ArrowLeft className="w-4 h-4" /> Back
                </Link>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto relative z-10">
                {/* ─── Left Panel: Branding & Animation ─── */}
                <div className="hidden lg:flex flex-1 flex-col justify-center relative p-12 lg:p-20">
                    {/* Subtle Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/10 blur-[140px] rounded-full pointer-events-none -z-10" />

                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="max-w-md"
                    >
                        <div className="flex items-center gap-3 mb-10">
                            <GhostLogo size="lg" />
                        </div>

                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="text-4xl lg:text-5xl font-black text-foreground leading-[1.1] tracking-tighter mb-6"
                        >
                            {tLogin('title')}
                            <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-violet-400">
                                {tLogin('titleHighlight')}
                            </span>
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                            className="text-muted-foreground text-lg leading-relaxed mb-12 font-medium"
                        >
                            {tLogin('description')}
                        </motion.p>

                        {/* Feature pills */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6, duration: 0.6 }}
                            className="flex flex-col gap-4"
                        >
                            {[
                                { icon: MessageSquare, text: tLogin('feature1'), color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                                { icon: CalendarDays, text: tLogin('feature2'), color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                                { icon: Shield, text: tLogin('feature3'), color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                            ].map((feature, i) => (
                                <motion.div
                                    key={feature.text}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.7 + i * 0.15 }}
                                    className="flex items-center gap-4 px-5 py-4 rounded-2xl glass-frosted border border-border/50 shadow-sm"
                                >
                                    <div className={`p-2 rounded-xl border ${feature.color}`}>
                                        <feature.icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-sm text-foreground font-semibold tracking-tight">{feature.text}</span>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                </div>

                {/* ─── Right Panel: Login Form ─── */}
                <div className="flex-1 flex flex-col justify-center items-center w-full px-4 sm:px-6 py-12 lg:p-12 relative">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full max-w-[420px] relative group"
                    >
                        {/* Mobile Header / Logo */}
                        <div className="flex flex-col items-center mb-8 lg:hidden mt-8">
                            <div className="mb-4">
                                <GhostLogo size="lg" />
                            </div>
                        </div>

                        {/* Ambient Card Glow */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-violet-500/15 to-primary/10 rounded-[2.6rem] blur-2xl opacity-75 group-hover:opacity-100 transition duration-700 pointer-events-none" />

                        <div className="relative bg-surface-1/80 backdrop-blur-xl p-6 sm:p-10 rounded-[2.5rem] border border-border/60 shadow-2xl overflow-hidden">
                            {/* Decorative top gradient */}
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

                            <div className="text-center mb-8 lg:text-left mt-2">
                                <h1 className="text-3xl font-black text-foreground mb-2 tracking-tight">{tLogin('welcomeBack')}</h1>
                                <p className="text-muted-foreground font-medium text-sm">{tLogin('signInToDashboard')}</p>
                            </div>

                            <div className="mb-6 w-full">
                                <GoogleSignInButton
                                    onSuccess={() => {
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('remember_me', 'true');
                                            sessionStorage.setItem('session_active', 'true');
                                        }
                                        window.location.href = '/dashboard';
                                    }}
                                    onError={(err) => { setError(err.message || 'Failed to sign in with Google'); }}
                                />
                            </div>

                            {/* Divider */}
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border/60"></div>
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="bg-surface-1 px-4 text-muted-foreground/70 uppercase tracking-widest font-bold">{tLogin('or')}</span>
                                </div>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-medium flex items-start gap-3"
                                >
                                    <Shield className="w-5 h-5 shrink-0" />
                                    {error}
                                </motion.div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-4 w-full">
                                <div className="space-y-1.5">
                                    <label htmlFor="email" className="text-xs font-black text-muted-foreground/70 uppercase tracking-widest ml-1">{tAuth('email')}</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                        <input
                                            id="email"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-surface-2 border border-border/50 rounded-2xl py-4 pl-12 pr-4 text-foreground text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-medium"
                                            placeholder="you@company.com"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between ml-1 rtl:flex-row-reverse">
                                        <label htmlFor="password" className="text-xs font-black text-muted-foreground/70 uppercase tracking-widest">{tAuth('password')}</label>
                                        <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors font-bold">{tAuth('forgotPassword')}</Link>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                        <input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-surface-2 border border-border/50 rounded-2xl py-4 pl-12 pr-12 text-foreground text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-medium"
                                            placeholder="••••••••"
                                            dir="ltr"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors p-1"
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Remember Me Checkbox */}
                                <div className="flex items-center justify-between py-1 ml-1">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="w-4 h-4 rounded border-border bg-surface-2 text-primary focus:ring-primary/50 cursor-pointer accent-primary"
                                        />
                                        <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors select-none">
                                            {tAuth('rememberMe')}
                                        </span>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !email || !password}
                                    className="w-full bg-foreground text-background font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-foreground/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed mt-2 border border-transparent hover:border-foreground/20"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : tAuth('signIn')}
                                </button>
                            </form>

                            <div className="mt-8 pt-6 border-t border-border/50 text-center">
                                <p className="text-sm text-muted-foreground font-medium">
                                    {tAuth('noAccount')} <Link href="/register" className="text-foreground hover:text-primary font-bold transition-colors">{tAuth('signUp')}</Link>
                                </p>
                            </div>
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
        </div>
    );
}
