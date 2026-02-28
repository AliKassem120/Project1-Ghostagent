'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Mail, Eye, EyeOff, Check, Loader2, AlertCircle, Shield, User, ChevronRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import clsx from 'clsx';

interface AccountPanelProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string | null;
    userName: string;
    userInitial: string;
    isGoogleUser: boolean;
}

type FormState = {
    loading: boolean;
    success: string | null;
    error: string | null;
};

const initialForm: FormState = { loading: false, success: null, error: null };

export default function AccountPanel({ isOpen, onClose, userEmail, userName, userInitial, isGoogleUser }: AccountPanelProps) {
    const supabase = createClient();

    // Password form
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState<FormState>(initialForm);

    // Email form
    const [newEmail, setNewEmail] = useState('');
    const [emailForm, setEmailForm] = useState<FormState>(initialForm);

    // Reset forms when panel closes
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setNewPassword('');
                setConfirmPassword('');
                setNewEmail('');
                setPasswordForm(initialForm);
                setEmailForm(initialForm);
            }, 300);
        }
    }, [isOpen]);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordForm({ loading: false, success: null, error: 'Passwords do not match.' });
            return;
        }
        if (newPassword.length < 8) {
            setPasswordForm({ loading: false, success: null, error: 'Password must be at least 8 characters.' });
            return;
        }
        setPasswordForm({ loading: true, success: null, error: null });
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            setPasswordForm({ loading: false, success: null, error: error.message });
        } else {
            setPasswordForm({ loading: false, success: 'Password updated successfully!', error: null });
            setNewPassword('');
            setConfirmPassword('');
        }
    };

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail || !newEmail.includes('@')) {
            setEmailForm({ loading: false, success: null, error: 'Please enter a valid email address.' });
            return;
        }
        setEmailForm({ loading: true, success: null, error: null });
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) {
            setEmailForm({ loading: false, success: null, error: error.message });
        } else {
            setEmailForm({
                loading: false,
                success: 'Verification emails sent! Check both your old and new inboxes to confirm the change.',
                error: null,
            });
            setNewEmail('');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: -320, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -320, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                        className="fixed left-0 top-0 h-full w-[340px] z-[70] flex flex-col bg-surface-0 border-r border-border shadow-2xl overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 h-16 border-b border-border shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-primary/10">
                                    <Shield className="w-4 h-4 text-primary" />
                                </div>
                                <span className="font-semibold text-sm text-foreground">Account Security</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 p-5 space-y-5">
                            {/* Account Info */}
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-1 border border-border">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/30 to-violet-600/30 flex items-center justify-center text-foreground font-bold text-base border border-border shrink-0">
                                    {userInitial}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{userEmail}</p>
                                </div>
                            </div>

                            {/* Divider label */}
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Security</p>

                            {/* Security Section */}
                            {isGoogleUser ? (
                                <div className="p-5 rounded-2xl bg-surface-1 border border-border space-y-4">
                                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mx-auto shadow-sm">
                                        <svg viewBox="0 0 24 24" className="w-6 h-6">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <h3 className="text-sm font-bold text-foreground">Identity Managed by Google</h3>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Your account is linked to Google. Email and password settings are managed through your Google Account settings.
                                        </p>
                                    </div>
                                    <a
                                        href="https://myaccount.google.com/security"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-surface-2 border border-border text-[11px] font-bold text-foreground hover:bg-surface-3 transition-all"
                                    >
                                        Manage Google Account
                                        <ChevronRight className="w-3 h-3" />
                                    </a>
                                </div>
                            ) : (
                                <>
                                    {/* Update Password */}
                                    <form onSubmit={handleUpdatePassword} className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-xs font-semibold text-muted-foreground">Update Password</span>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="input-premium w-full text-sm !pr-10"
                                                    placeholder="New password"
                                                    minLength={8}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
                                                >
                                                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="input-premium w-full text-sm"
                                                placeholder="Confirm new password"
                                                required
                                            />
                                        </div>

                                        <FeedbackMessage state={passwordForm} />

                                        <button
                                            type="submit"
                                            disabled={passwordForm.loading || !newPassword || !confirmPassword}
                                            className={clsx(
                                                'w-full py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                                                passwordForm.loading || !newPassword || !confirmPassword
                                                    ? 'bg-white/[0.04] text-muted-foreground cursor-not-allowed'
                                                    : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                                            )}
                                        >
                                            {passwordForm.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                                            {passwordForm.loading ? 'Updating...' : 'Update Password'}
                                        </button>
                                    </form>

                                    {/* Update Email */}
                                    <form onSubmit={handleUpdateEmail} className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-xs font-semibold text-muted-foreground">Update Email</span>
                                        </div>

                                        <div className="text-[10px] text-muted-foreground bg-amber-500/[0.05] border border-amber-500/10 rounded-lg px-3 py-2 leading-relaxed">
                                            ⚠️ Changing your email requires clicking verification links sent to <strong className="text-amber-500/60">both</strong> your old and new addresses.
                                        </div>

                                        <input
                                            type="email"
                                            value={newEmail}
                                            onChange={(e) => setNewEmail(e.target.value)}
                                            className="input-premium w-full text-sm"
                                            placeholder="New email address"
                                            required
                                        />

                                        <FeedbackMessage state={emailForm} />

                                        <button
                                            type="submit"
                                            disabled={emailForm.loading || !newEmail}
                                            className={clsx(
                                                'w-full py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                                                emailForm.loading || !newEmail
                                                    ? 'bg-white/[0.04] text-muted-foreground cursor-not-allowed'
                                                    : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20'
                                            )}
                                        >
                                            {emailForm.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                                            {emailForm.loading ? 'Sending...' : 'Send Verification'}
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function FeedbackMessage({ state }: { state: FormState }) {
    if (!state.success && !state.error) return null;
    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx(
                'flex items-start gap-2 text-[10px] rounded-lg px-3 py-2 leading-relaxed',
                state.success ? 'bg-emerald-500/[0.06] border border-emerald-500/15 text-emerald-400' : 'bg-red-500/[0.06] border border-red-500/15 text-red-400'
            )}
        >
            {state.success ? <Check className="w-3 h-3 mt-0.5 shrink-0" /> : <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />}
            {state.success ?? state.error}
        </motion.div>
    );
}
