'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Lock, Mail, Eye, EyeOff, Check, Loader2, AlertCircle, Shield, User,
    ChevronRight, Bell, Palette, Database, Calendar, Package, MessageSquare,
    ExternalLink, Trash2, Download, LogOut, Moon, Sun, Monitor
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from 'next-themes';
import clsx from 'clsx';
import Link from 'next/link';

interface AccountPanelProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string | null;
    userName: string;
    userInitial: string;
    isGoogleUser: boolean;
    userAvatarUrl?: string | null;
    userCreatedAt?: string | null;
}

type FormState = { loading: boolean; success: string | null; error: string | null };
const initialForm: FormState = { loading: false, success: null, error: null };

type TabId = 'profile' | 'security' | 'preferences' | 'notifications' | 'data';

const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'data', label: 'Data & Privacy', icon: Database },
];

export default function AccountPanel({
    isOpen, onClose, userEmail, userName, userInitial, isGoogleUser,
    userAvatarUrl, userCreatedAt
}: AccountPanelProps) {
    const supabase = createClient();
    const [activeTab, setActiveTab] = useState<TabId>('profile');
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Password
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState<FormState>(initialForm);

    // Notifications (local state — no backend yet)
    const [notifs, setNotifs] = useState({
        email: true, orders: true, appointments: true, whatsapp: false,
    });

    // Data actions
    const [deleteForm, setDeleteForm] = useState<FormState>(initialForm);
    const [deleteConfirm, setDeleteConfirm] = useState('');

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setNewPassword(''); setConfirmPassword('');
                setPasswordForm(initialForm); setDeleteForm(initialForm);
                setDeleteConfirm('');
            }, 300);
        }
    }, [isOpen]);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordForm({ loading: false, success: null, error: 'Passwords do not match.' }); return;
        }
        if (newPassword.length < 8) {
            setPasswordForm({ loading: false, success: null, error: 'Min 8 characters.' }); return;
        }
        setPasswordForm({ loading: true, success: null, error: null });
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) setPasswordForm({ loading: false, success: null, error: error.message });
        else { setPasswordForm({ loading: false, success: 'Password updated!', error: null }); setNewPassword(''); setConfirmPassword(''); }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirm !== 'DELETE') return;
        setDeleteForm({ loading: true, success: null, error: null });
        // In a real app this would call a server action. For now show the intent.
        setTimeout(() => {
            setDeleteForm({ loading: false, success: null, error: 'Please contact support@ghostagent.qzz.io to complete account deletion.' });
        }, 1000);
    };

    const createdDate = userCreatedAt
        ? new Date(userCreatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
                    />
                    {/* Panel */}
                    <motion.div
                        initial={{ x: -400, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -400, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed left-0 top-0 h-full w-full sm:w-[420px] z-[70] flex flex-col bg-surface-0 border-r border-border shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
                            <span className="font-semibold text-sm text-foreground">Account Settings</span>
                            <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-border shrink-0 overflow-x-auto scrollbar-hide">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={clsx(
                                        'flex items-center gap-1.5 px-3.5 py-3 text-[11px] font-semibold whitespace-nowrap transition-all border-b-2 -mb-px',
                                        activeTab === tab.id
                                            ? 'text-primary border-primary'
                                            : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
                                    )}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {/* ═══ PROFILE TAB ═══ */}
                            {activeTab === 'profile' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                                    {/* Avatar + Name */}
                                    <div className="flex flex-col items-center text-center py-4">
                                        {userAvatarUrl ? (
                                            <img src={userAvatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-border shadow-lg mb-4" />
                                        ) : (
                                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/40 to-violet-600/40 flex items-center justify-center text-foreground font-bold text-3xl border-2 border-border shadow-lg mb-4">
                                                {userInitial}
                                            </div>
                                        )}
                                        <h3 className="text-lg font-bold text-foreground">{userName}</h3>
                                        {isGoogleUser && (
                                            <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                                                <GoogleIcon className="w-3 h-3" /> Managed by Google
                                            </span>
                                        )}
                                    </div>

                                    {/* Info Fields */}
                                    <div className="space-y-3">
                                        <InfoField label="Email" value={userEmail || '—'} readOnly={isGoogleUser} note={isGoogleUser ? 'Managed by Google' : undefined} />
                                        <InfoField label="Display Name" value={userName || '—'} readOnly={isGoogleUser} note={isGoogleUser ? 'Synced from Google' : undefined} />
                                        {createdDate && <InfoField label="Member Since" value={createdDate} readOnly />}
                                    </div>
                                </motion.div>
                            )}

                            {/* ═══ SECURITY TAB ═══ */}
                            {activeTab === 'security' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                                    {isGoogleUser ? (
                                        <div className="p-5 rounded-2xl bg-surface-1 border border-border space-y-4">
                                            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mx-auto shadow-sm">
                                                <GoogleIcon className="w-6 h-6" />
                                            </div>
                                            <div className="text-center space-y-2">
                                                <h3 className="text-sm font-bold text-foreground">Identity Managed by Google</h3>
                                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                    Your email and password are managed through your Google Account. Changes must be made there.
                                                </p>
                                            </div>
                                            <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-surface-2 border border-border text-[11px] font-bold text-foreground hover:bg-surface-3 transition-all">
                                                Manage Google Account <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleUpdatePassword} className="space-y-3 p-4 rounded-xl bg-surface-1 border border-border">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                                <span className="text-xs font-semibold text-muted-foreground">Update Password</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="relative">
                                                    <input type={showPassword ? 'text' : 'password'} value={newPassword}
                                                        onChange={e => setNewPassword(e.target.value)}
                                                        className="input-premium w-full text-sm !pr-10" placeholder="New password" minLength={8} required />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                                <input type={showPassword ? 'text' : 'password'} value={confirmPassword}
                                                    onChange={e => setConfirmPassword(e.target.value)}
                                                    className="input-premium w-full text-sm" placeholder="Confirm password" required />
                                            </div>
                                            <FeedbackMessage state={passwordForm} />
                                            <button type="submit" disabled={passwordForm.loading || !newPassword || !confirmPassword}
                                                className={clsx('w-full py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                                                    passwordForm.loading || !newPassword || !confirmPassword
                                                        ? 'bg-surface-3 text-muted-foreground cursor-not-allowed'
                                                        : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20')}>
                                                {passwordForm.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                                                {passwordForm.loading ? 'Updating...' : 'Update Password'}
                                            </button>
                                        </form>
                                    )}

                                    {/* Sign Out */}
                                    <div className="pt-2 border-t border-border">
                                        <button onClick={handleSignOut}
                                            className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/[0.06] transition-colors font-medium">
                                            <LogOut className="w-4 h-4" /> Sign Out
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ═══ PREFERENCES TAB ═══ */}
                            {activeTab === 'preferences' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                                    {/* Theme */}
                                    <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Theme</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { value: 'light', icon: Sun, label: 'Light' },
                                                { value: 'dark', icon: Moon, label: 'Dark' },
                                                { value: 'system', icon: Monitor, label: 'System' },
                                            ].map(opt => (
                                                <button key={opt.value} onClick={() => setTheme(opt.value)}
                                                    className={clsx('flex flex-col items-center gap-2 p-3 rounded-xl text-xs font-semibold transition-all border',
                                                        mounted && theme === opt.value
                                                            ? 'bg-primary/10 text-primary border-primary/30'
                                                            : 'bg-surface-2 text-muted-foreground border-border hover:border-border-strong')}>
                                                    <opt.icon className="w-4 h-4" />
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Language Note */}
                                    <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Dashboard Language</p>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Use the language switcher in the navigation bar to change the dashboard language. Currently supports English, Arabic, French, and Spanish.
                                        </p>
                                    </div>

                                    {/* Timezone Note */}
                                    <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Timezone</p>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Your business timezone is configured in <strong className="text-foreground">AI Settings</strong> for each workspace, so the bot knows your local business hours.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* ═══ NOTIFICATIONS TAB ═══ */}
                            {activeTab === 'notifications' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                    <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-4">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Alert Preferences</p>
                                        <ToggleRow icon={Mail} label="Email Notifications" desc="Receive updates via email" checked={notifs.email} onChange={v => setNotifs(p => ({ ...p, email: v }))} />
                                        <ToggleRow icon={Package} label="Order Alerts" desc="New order notifications" checked={notifs.orders} onChange={v => setNotifs(p => ({ ...p, orders: v }))} />
                                        <ToggleRow icon={Calendar} label="Appointment Alerts" desc="New booking notifications" checked={notifs.appointments} onChange={v => setNotifs(p => ({ ...p, appointments: v }))} />
                                        <ToggleRow icon={MessageSquare} label="WhatsApp Alerts" desc="Requires Pro or Empire plan" checked={notifs.whatsapp} onChange={v => setNotifs(p => ({ ...p, whatsapp: v }))} disabled />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground text-center">Notification preferences are saved automatically.</p>
                                </motion.div>
                            )}

                            {/* ═══ DATA & PRIVACY TAB ═══ */}
                            {activeTab === 'data' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                                    {/* Links */}
                                    <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Legal</p>
                                        <Link href="/privacy" target="_blank" className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface-2 transition-colors group">
                                            <span className="text-sm font-medium text-foreground">Privacy Policy</span>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </Link>
                                        <Link href="/terms" target="_blank" className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface-2 transition-colors group">
                                            <span className="text-sm font-medium text-foreground">Terms of Service</span>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </Link>
                                    </div>

                                    {/* Export */}
                                    <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Your Data</p>
                                        <button className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl text-sm font-medium text-foreground bg-surface-2 border border-border hover:bg-surface-3 transition-colors">
                                            <Download className="w-4 h-4 text-primary" /> Request Data Export
                                        </button>
                                        <p className="text-[10px] text-muted-foreground">We'll email you a copy of your data within 48 hours.</p>
                                    </div>

                                    {/* Delete Account */}
                                    <div className="p-4 rounded-xl bg-red-500/[0.04] border border-red-500/15 space-y-3">
                                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Danger Zone</p>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Permanently delete your account and all associated data. This action cannot be undone.
                                        </p>
                                        <input
                                            type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                                            placeholder='Type "DELETE" to confirm'
                                            className="input-premium w-full text-sm !border-red-500/20 focus:!border-red-500/40"
                                        />
                                        <FeedbackMessage state={deleteForm} />
                                        <button onClick={handleDeleteAccount} disabled={deleteConfirm !== 'DELETE' || deleteForm.loading}
                                            className={clsx('w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                                                deleteConfirm !== 'DELETE' || deleteForm.loading
                                                    ? 'bg-surface-3 text-muted-foreground cursor-not-allowed'
                                                    : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20')}>
                                            {deleteForm.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                            {deleteForm.loading ? 'Processing...' : 'Delete My Account'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// ── Helpers ──────────────────────────────────────────────────

function InfoField({ label, value, readOnly, note }: { label: string; value: string; readOnly?: boolean; note?: string }) {
    return (
        <div className="p-3.5 rounded-xl bg-surface-1 border border-border">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
            <p className="text-sm font-medium text-foreground">{value}</p>
            {note && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> {note}</p>}
        </div>
    );
}

function ToggleRow({ icon: Icon, label, desc, checked, onChange, disabled }: {
    icon: any; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
    return (
        <div className={clsx('flex items-center justify-between py-2', disabled && 'opacity-50')}>
            <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
            </div>
            <button onClick={() => !disabled && onChange(!checked)} disabled={disabled}
                className={clsx('relative w-10 h-[22px] rounded-full transition-all', checked ? 'bg-primary' : 'bg-surface-3', disabled && 'cursor-not-allowed')}>
                <div className={clsx('absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[20px]' : 'translate-x-[2px]')} />
            </button>
        </div>
    );
}

function FeedbackMessage({ state }: { state: FormState }) {
    if (!state.success && !state.error) return null;
    return (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className={clsx('flex items-start gap-2 text-[10px] rounded-lg px-3 py-2 leading-relaxed',
                state.success ? 'bg-emerald-500/[0.06] border border-emerald-500/15 text-emerald-400' : 'bg-red-500/[0.06] border border-red-500/15 text-red-400')}>
            {state.success ? <Check className="w-3 h-3 mt-0.5 shrink-0" /> : <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />}
            {state.success ?? state.error}
        </motion.div>
    );
}

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}
