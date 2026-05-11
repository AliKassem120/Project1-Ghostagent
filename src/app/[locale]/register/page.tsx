'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Loader2, Lock, Mail, User, ShoppingBag, CalendarDays, CheckCircle2, Bot, Sparkles } from 'lucide-react';
import StarBackground from '@/components/StarBackground';
import GhostLogo from '@/components/GhostLogo';
import { supabase } from '@/lib/supabase';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { useToast } from '@/contexts/ToastContext';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';

export default function RegisterPage() {
    const router = useRouter();
    const toast = useToast();
    const tAuth = useTranslations('Auth');
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

        if (data?.user?.id) {
            await supabase.from('users').upsert({
                id: data.user.id,
                plan_tier: 'starter',
            }, { onConflict: 'id' });
        }

        toast.success('Registration successful! Please check your email.');
        setLoading(false);
        setIsPendingVerification(true);
    };

    return (
        <div className="min-h-[100dvh] flex bg-background relative overflow-hidden">
            <StarBackground />
            
            {/* Split Layout Container */}
            <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row relative z-10 min-h-screen">
                
                {/* ── LEFT SIDE: FEATURES SHOWCASE (Hidden on Mobile) ── */}
                <div className="hidden lg:flex flex-1 flex-col justify-center p-12 lg:p-20 relative">
                    <motion.div 
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    >
                        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-1/50 border border-border/50 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-all mb-12">
                            <ArrowLeft className="w-4 h-4" /> Back to Home
                        </Link>
                        
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-xs font-bold text-primary tracking-widest uppercase">One Agent. Dual Power.</span>
                        </div>
                        
                        <h1 className="text-4xl lg:text-5xl font-black text-foreground tracking-tighter leading-tight mb-6">
                            Automate sales & <br />book appointments <br />while you sleep.
                        </h1>
                        <p className="text-lg text-muted-foreground font-medium mb-12 max-w-md leading-relaxed">
                            Connect your Instagram account and let GhostAgent handle your DMs, 24/7.
                        </p>

                        <div className="space-y-6 max-w-md">
                            {/* E-commerce Card */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.6 }}
                                className="glass-frosted p-6 rounded-3xl border border-border/50 bg-gradient-to-br from-surface-1/50 to-transparent flex items-start gap-5 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full group-hover:bg-blue-500/20 transition-colors" />
                                <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                    <ShoppingBag className="w-6 h-6 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">E-Commerce Automation</h3>
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Live inventory checks</li>
                                        <li className="flex items-center gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Automated order capture</li>
                                        <li className="flex items-center gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Size & color variant support</li>
                                    </ul>
                                </div>
                            </motion.div>

                            {/* Appointments Card */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4, duration: 0.6 }}
                                className="glass-frosted p-6 rounded-3xl border border-border/50 bg-gradient-to-br from-surface-1/50 to-transparent flex items-start gap-5 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full group-hover:bg-purple-500/20 transition-colors" />
                                <div className="w-12 h-12 shrink-0 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                    <CalendarDays className="w-6 h-6 text-purple-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">Service Appointments</h3>
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="w-4 h-4 text-purple-500" /> Smart calendar availability</li>
                                        <li className="flex items-center gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="w-4 h-4 text-purple-500" /> Auto-calculates duration</li>
                                        <li className="flex items-center gap-2 text-sm text-muted-foreground font-medium"><CheckCircle2 className="w-4 h-4 text-purple-500" /> Mandatory detail collection</li>
                                    </ul>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>

                {/* ── RIGHT SIDE: REGISTRATION FORM ── */}
                <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative w-full">
                    {/* Background glow just for the form area */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none" />

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full max-w-[420px]"
                    >
                        {/* Mobile Back Button */}
                        <div className="lg:hidden mb-8">
                            <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-1/50 border border-border/50 text-xs font-bold text-muted-foreground hover:text-foreground">
                                <ArrowLeft className="w-3 h-3" /> Back
                            </Link>
                        </div>

                        <div className="bg-surface-1/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2.5rem] border border-border/60 shadow-2xl relative overflow-hidden">
                            {/* Decorative top gradient */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                            <div className="flex justify-center mb-8 relative">
                                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150" />
                                <div className="w-14 h-14 bg-surface-2 border border-border/50 rounded-2xl flex items-center justify-center relative z-10 shadow-lg">
                                    <GhostLogo iconOnly className="w-8 h-8" />
                                </div>
                            </div>

                            {isPendingVerification ? (
                                <motion.div 
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="text-center py-4"
                                >
                                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                                        <div className="absolute inset-0 border-2 border-primary border-dashed rounded-full animate-spin-slow opacity-30" />
                                        <Mail className="w-8 h-8 text-primary relative z-10" />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-3 text-foreground tracking-tight">Check your email</h2>
                                    <p className="text-muted-foreground font-medium mb-6 text-sm leading-relaxed">
                                        We sent a verification link to <br/><span className="text-primary font-bold">{email}</span>
                                    </p>
                                    <div className="p-4 bg-surface-2 rounded-xl text-xs text-muted-foreground/80 font-medium">
                                        Please click the link to activate your account. Check your spam folder if you don't see it.
                                    </div>
                                </motion.div>
                            ) : (
                                <>
                                    <div className="text-center mb-8">
                                        <h2 className="text-3xl font-black mb-2 text-foreground tracking-tighter">Get Started Free</h2>
                                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Try for free • No credit card needed</p>
                                    </div>

                                    <div className="mb-6 w-full">
                                        <GoogleSignInButton
                                            onSuccess={() => { window.location.href = '/dashboard'; }}
                                            onError={(err) => { toast.error(err.message || 'Failed to sign up with Google'); }}
                                        />
                                    </div>

                                    {/* Divider */}
                                    <div className="relative my-6">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-border/60"></div>
                                        </div>
                                        <div className="relative flex justify-center text-xs">
                                            <span className="bg-surface-1 px-4 text-muted-foreground/70 uppercase tracking-widest font-bold">OR</span>
                                        </div>
                                    </div>

                                    <form onSubmit={handleRegister} className="space-y-5">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1">Full Name</label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                                <input
                                                    type="text"
                                                    required
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="w-full bg-surface-2 border border-border/50 rounded-2xl py-4 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-medium text-sm"
                                                    placeholder="e.g. John Doe"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1">{tAuth('email')}</label>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                                <input
                                                    type="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="w-full bg-surface-2 border border-border/50 rounded-2xl py-4 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-medium text-sm"
                                                    placeholder="name@company.com"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1">{tAuth('password')}</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                                <input
                                                    type="password"
                                                    required
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="w-full bg-surface-2 border border-border/50 rounded-2xl py-4 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-medium text-sm"
                                                    placeholder="••••••••"
                                                    minLength={8}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full bg-foreground text-background font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-foreground/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 mt-2 border border-transparent hover:border-foreground/20"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                                <>
                                                    {tAuth('signUp')} <ArrowLeft className="w-4 h-4 rotate-180" />
                                                </>
                                            )}
                                        </button>
                                    </form>

                                    <div className="mt-8 pt-6 border-t border-border/50 text-center">
                                        <p className="text-sm text-muted-foreground font-medium">
                                            {tAuth('hasAccount')} <Link href="/login" className="text-foreground hover:text-primary font-bold transition-colors">{tAuth('signIn')}</Link>
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
