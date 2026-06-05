'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Loader2, Lock, CheckCircle2, Eye, EyeOff, Shield } from 'lucide-react';
import StarBackground from '@/components/StarBackground';
import GhostLogo from '@/components/GhostLogo';
import { createClient } from '@/utils/supabase/client';
import { useTranslations } from 'next-intl';

export default function UpdatePasswordPage() {
    const router = useRouter();
    const tAuth = useTranslations('Auth');
    const supabase = createClient();
    
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.log('No active session found, redirecting to login...');
                router.replace('/login');
            } else {
                setLoading(false);
            }
        };
        checkAuth();
    }, [supabase, router]);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError(tAuth('passwordTooShort'));
            return;
        }

        if (password !== confirmPassword) {
            setError(tAuth('passwordMismatch'));
            return;
        }

        setUpdating(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) {
                setError(updateError.message);
                setUpdating(false);
                return;
            }

            setSubmitted(true);
        } catch (err) {
            console.error('Password update error:', err);
            setError('An unexpected error occurred. Please try again.');
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center p-6 relative overflow-x-clip bg-background">
                <StarBackground />
                <div className="flex flex-col items-center gap-4 relative z-10">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-muted-foreground font-semibold text-sm">Verifying recovery session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-6 relative overflow-x-clip bg-background">
            <StarBackground />

            <div className="absolute top-6 left-6 z-20">
                <Link href="/login" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft className="w-4 h-4" /> {tAuth('backToLogin')}
                </Link>
            </div>

            <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="bg-surface-1 p-8 md:p-12 rounded-3xl border border-border shadow-2xl relative">
                    {/* Top gradient highlight */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                    <div className="flex justify-center mb-8">
                        <div className="p-4 bg-primary/10 rounded-2xl shadow-[0_0_40px_rgba(192,132,252,0.1)]">
                            <GhostLogo iconOnly className="w-12 h-12" />
                        </div>
                    </div>

                    {!submitted ? (
                        <>
                            <div className="text-center mb-10">
                                <h1 className="text-3xl font-bold mb-2 text-foreground tracking-tight">{tAuth('updatePassword')}</h1>
                                <p className="text-muted-foreground font-medium">Enter your new secure password below to regain full access.</p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2 flex items-start gap-2">
                                    <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleUpdatePassword} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground ml-1">{tAuth('newPassword')}</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-surface-2 border border-border rounded-xl py-4 pl-12 pr-12 text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/50 focus:bg-surface-3 transition-all font-medium text-sm"
                                            placeholder="••••••••"
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

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground ml-1">{tAuth('confirmNewPassword')}</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 focus-within:text-primary transition-colors" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-surface-2 border border-border rounded-xl py-4 pl-12 pr-12 text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/50 focus:bg-surface-3 transition-all font-medium text-sm"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={updating || !password || !confirmPassword}
                                    className="w-full bg-foreground text-background font-black py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-foreground/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {updating ? <Loader2 className="w-5 h-5 animate-spin" /> : tAuth('saveNewPassword')}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center py-4 animate-in zoom-in-95 duration-500">
                            <div className="flex justify-center mb-6">
                                <div className="p-4 bg-green-500/20 rounded-full animate-bounce">
                                    <CheckCircle2 className="w-12 h-12 text-green-400" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold mb-4 text-foreground tracking-tight">{tAuth('passwordUpdated')}</h2>
                            <p className="text-muted-foreground font-medium mb-8 leading-relaxed">
                                Your account is secure. You can now access your dashboard and continue using your AI agent.
                            </p>
                            <Link
                                href="/dashboard"
                                className="inline-block bg-primary text-black font-bold py-4 px-8 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 w-full"
                            >
                                {tAuth('goToDashboard')}
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
