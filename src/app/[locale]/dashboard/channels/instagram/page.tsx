'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Instagram, Loader2, Sparkles, Lock, Trash2, MessageCircle, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAutopilot } from '@/context/AutopilotContext';
import { updateWorkspaceSettingsAction } from '@/app/actions/settings';
import GhostModal from '@/components/GhostModal';

export default function InstagramChannelPage() {
    const supabase = createClient();
    const toast = useToast();
    const { activeWorkspaceId, planTier, isLoading: wsLoading } = useWorkspace();
    const isPro = planTier === 'pro' || planTier === 'empire';
    const isEmpire = planTier === 'empire';
    const { autopilot, setAutopilot } = useAutopilot();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [instagramStatus, setInstagramStatus] = useState<{ connected: boolean; accounts: any[] } | null>(null);
    const [disconnectModal, setDisconnectModal] = useState<{ open: boolean; accountId: string | null }>({ open: false, accountId: null });

    // Comment auto-reply settings
    const [commentAutoReply, setCommentAutoReply] = useState(false);
    const [commentReplyStyle, setCommentReplyStyle] = useState<'public' | 'dm' | 'both'>('public');
    const [commentKeywords, setCommentKeywords] = useState('');
    const [commentMaxPerPost, setCommentMaxPerPost] = useState(0);

    // Fetch settings
    const fetchSettings = useCallback(async (signal?: AbortSignal) => {
        if (!activeWorkspaceId) return;
        setLoading(true);
        try {
            const { data } = await supabase
                .from('ai_settings')
                .select('comment_auto_reply, comment_reply_style, comment_keywords, comment_max_per_post')
                .eq('id', activeWorkspaceId)
                .single();

            if (signal?.aborted) return;
            if (data) {
                setCommentAutoReply(data.comment_auto_reply ?? false);
                setCommentReplyStyle(data.comment_reply_style || 'public');
                setCommentKeywords(Array.isArray(data.comment_keywords) ? data.comment_keywords.join(', ') : '');
                setCommentMaxPerPost(data.comment_max_per_post || 0);
            }
        } catch (err) {
            console.error('Failed to load IG settings:', err);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [activeWorkspaceId, supabase]);

    useEffect(() => {
        if (wsLoading) return;
        const controller = new AbortController();
        fetchSettings(controller.signal);
        return () => controller.abort();
    }, [fetchSettings, wsLoading]);

    // Check Instagram status
    const checkInstagramStatus = useCallback(async (signal?: AbortSignal) => {
        if (!activeWorkspaceId) return;
        try {
            const res = await fetch(`/api/instagram/status?workspace_id=${activeWorkspaceId}`, { signal });
            const data = await res.json();
            if (!signal?.aborted) setInstagramStatus(data);
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error('Failed to check Instagram status:', e);
            }
        }
    }, [activeWorkspaceId]);

    useEffect(() => {
        setInstagramStatus(null);
        const controller = new AbortController();
        checkInstagramStatus(controller.signal);
        const interval = setInterval(() => {
            if (!controller.signal.aborted) checkInstagramStatus(controller.signal);
        }, 5000);
        return () => { controller.abort(); clearInterval(interval); };
    }, [checkInstagramStatus]);

    // Check for success/error query params from OAuth callback
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'instagram_connected') {
            toast.success('Instagram Connected', { description: 'Your account is now linked to Ghost Agent.' });
            checkInstagramStatus();
            window.history.replaceState({}, '', window.location.pathname);
        }
        const errorParam = params.get('error');
        if (errorParam) {
            const details = params.get('details') || errorParam;
            toast.error('Instagram Connection Failed', { description: details });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const handleConnectInstagram = () => {
        setConnecting(true);
        const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID;
        const redirectUri = `${window.location.origin}/api/auth/callback/instagram`;
        const scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';

        if (!appId) {
            toast.error("Missing NEXT_PUBLIC_INSTAGRAM_APP_ID in env");
            setConnecting(false);
            return;
        }

        const stateParam = activeWorkspaceId || '';
        const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${stateParam}`;
        window.location.href = authUrl;
    };

    const handleDisconnect = async (accountId: string) => {
        try {
            setInstagramStatus(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    accounts: prev.accounts.filter(a => a.id !== accountId)
                };
            });

            const res = await fetch('/api/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, workspaceId: activeWorkspaceId })
            });

            toast.success('Account Disconnected', { description: 'The integration has been removed.' });
            checkInstagramStatus();
            
            const data = await res.json();
            if (data.autopilotDisabled && autopilot) {
                setAutopilot(false);
            }
        } catch (e) {
            toast.error('Failed to disconnect');
            checkInstagramStatus();
        }
    };

    const handleSave = async () => {
        if (!activeWorkspaceId) return;
        setSaving(true);
        try {
            const { data: current } = await supabase
                .from('ai_settings')
                .select('*')
                .eq('id', activeWorkspaceId)
                .single();

            if (!current) throw new Error('Workspace not found');

            await updateWorkspaceSettingsAction(activeWorkspaceId, {
                businessName: current.business_name,
                tone: current.tone,
                useEmojis: current.use_emojis,
                maxDiscount: current.max_discount,
                minOrderForDiscount: current.min_order_for_discount,
                language: current.language,
                systemPrompt: current.system_instructions,
                whatsappTemplate: current.whatsapp_template,
                storeLocation: current.store_location,
                contactInfo: current.contact_info,
                shippingRules: current.shipping_rules,
                businessType: current.business_type,
                replyDelay: current.reply_delay_seconds,
                emergencyWhatsApp: current.emergency_whatsapp,
                commentAutoReply: commentAutoReply,
                commentReplyStyle: commentReplyStyle,
                commentKeywords: commentKeywords,
                commentMaxPerPost: commentMaxPerPost,
                waBusinessAccountId: current.whatsapp_business_account_id,
                waPhoneNumberId: current.whatsapp_phone_number_id,
                waAccessToken: current.whatsapp_access_token,
            }, isEmpire);

            toast.success('Instagram settings saved!');
        } catch (e: any) {
            toast.error('Failed to save: ' + (e.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-6 md:pb-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2.5 rounded-xl bg-pink-500/10">
                        <Instagram className="w-6 h-6 text-pink-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Instagram Channel</h1>
                        <p className="text-sm text-muted-foreground">Connect and manage your Instagram Business integration.</p>
                    </div>
                </div>
            </motion.div>

            {/* Instagram Connection Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6"
            >
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                    <div className="p-2.5 rounded-xl bg-pink-500/10">
                        <Instagram className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Connected Accounts</h2>
                        <p className="text-[11px] text-muted-foreground">Your linked Instagram business accounts</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {instagramStatus === null ? (
                        <div className="flex justify-center items-center h-20 bg-surface-2 border border-border rounded-xl">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {instagramStatus.accounts.length > 0 && instagramStatus.accounts.map((acc: any) => (
                                <div key={acc.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-surface-2 p-4 rounded-xl border border-border gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 rounded-xl flex items-center justify-center shrink-0">
                                            <Instagram className="w-5 h-5 text-foreground" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-sm text-foreground truncate max-w-[150px]">{acc.username || 'Insta User'}</h3>
                                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold rounded-full flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Running
                                                </span>
                                            </div>
                                            <p className="text-muted-foreground text-[10px] font-mono">{acc.id}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setDisconnectModal({ open: true, accountId: acc.id })}
                                        className="px-3 py-1.5 bg-red-500/5 text-red-400/60 border border-red-500/10 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors w-full sm:w-auto justify-center"
                                    >
                                        <Trash2 className="w-3 h-3" /> Disconnect
                                    </button>
                                </div>
                            ))}

                            {instagramStatus.accounts.length === 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-surface-2 rounded-2xl border border-border gap-4">
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 shrink-0">
                                            <Instagram className="w-6 h-6 text-pink-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-foreground">Meta Login</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">Link your account in 30 seconds.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleConnectInstagram}
                                        disabled={connecting}
                                        className="w-full sm:w-auto px-6 py-2.5 bg-pink-500 text-black font-bold rounded-xl hover:bg-pink-400 transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_20px_rgba(236,72,153,0.2)] disabled:opacity-50"
                                    >
                                        {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Instagram'}
                                    </button>
                                </div>
                            )}

                            {/* How It Works */}
                            <div className="p-5 rounded-2xl bg-pink-500/5 border border-pink-500/10 space-y-3 mt-6">
                                <div className="flex items-center gap-2 text-pink-400">
                                    <Sparkles className="w-4 h-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">How It Works</p>
                                </div>
                                <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                                    <p>1. Click <strong>Connect Instagram</strong> above — you'll be taken to Meta to log in safely.</p>
                                    <p>2. Select the <strong>Instagram Professional Account</strong> you want to connect.</p>
                                    <p>3. That's it! GhostAgent will start answering DMs and comments automatically.</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>

            {/* Auto Comment Reply */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 relative overflow-x-clip"
            >
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                    <div className="p-2.5 rounded-xl bg-blue-500/10">
                        <MessageCircle className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Auto Comment Reply</h2>
                        <p className="text-[11px] text-muted-foreground">Control how the AI handles public comments</p>
                    </div>
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
                        {!isPro && <Lock className="w-3 h-3" />}
                        Pro+
                    </span>
                </div>

                <div className="space-y-6">
                    {/* Master Toggle */}
                    <div
                        className={clsx("flex items-center justify-between p-4 bg-surface-2 rounded-xl border border-border hover:bg-surface-3 transition-all", isPro ? "cursor-pointer" : "opacity-50 pointer-events-none")}
                        onClick={() => isPro && setCommentAutoReply(!commentAutoReply)}
                    >
                        <div>
                            <p className="text-sm font-semibold text-foreground">Reply to Comments</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Ghost AI will automatically reply to public comments on your posts</p>
                        </div>
                        <div className={clsx("relative w-11 rounded-full transition-colors duration-300 shrink-0", commentAutoReply && isPro ? "bg-primary" : "bg-surface-3 border border-border")} style={{ height: '24px' }}>
                            <motion.div
                                className="absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white shadow-sm"
                                animate={{ x: commentAutoReply && isPro ? 22 : 2 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        </div>
                    </div>

                    {/* Reply Style */}
                    <div className={clsx("space-y-2", !isPro || !commentAutoReply ? "opacity-40 pointer-events-none" : "")}>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Reply Style</label>
                        <div className="grid grid-cols-3 gap-2">
                            {([['public', '💬 Public Reply', 'Reply visibly under the comment'], ['dm', '📩 Send to DM', 'Slide into their DMs instead'], ['both', '⚡ Both', 'Reply publicly & continue in DMs']] as const).map(([val, label, desc]) => (
                                <button
                                    key={val}
                                    onClick={() => setCommentReplyStyle(val)}
                                    className={clsx(
                                        "p-3 rounded-xl border text-left transition-all",
                                        commentReplyStyle === val
                                            ? "bg-primary/10 border-primary/30 text-primary"
                                            : "bg-surface-2 border-border text-muted-foreground hover:bg-surface-3"
                                    )}
                                >
                                    <p className="text-xs font-bold">{label}</p>
                                    <p className="text-[10px] mt-0.5 opacity-70">{desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Keyword Filter */}
                    <div className={clsx("space-y-1.5", !isPro || !commentAutoReply ? "opacity-40 pointer-events-none" : "")}>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Keyword Filter <span className="normal-case font-normal">(optional)</span></label>
                        <input
                            type="text"
                            value={commentKeywords}
                            onChange={(e) => setCommentKeywords(e.target.value)}
                            className="input-premium w-full"
                            placeholder="price, stock, available, how much ..."
                            disabled={!isPro || !commentAutoReply}
                        />
                        <p className="text-[10px] text-muted-foreground ml-1">Comma-separated. AI only replies to comments containing these words. Leave empty to reply to all comments.</p>
                    </div>

                    {/* Max Replies per Post */}
                    <div className={clsx("space-y-3", !isPro || !commentAutoReply ? "opacity-40 pointer-events-none" : "")}>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Max Replies per Post</label>
                        <input
                            type="range"
                            min="0"
                            max="50"
                            step="5"
                            value={commentMaxPerPost}
                            onChange={(e) => setCommentMaxPerPost(parseInt(e.target.value))}
                            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary border border-border"
                            disabled={!isPro || !commentAutoReply}
                            style={{
                                background: `linear-gradient(to right, rgb(139 92 246) 0%, rgb(139 92 246) ${(commentMaxPerPost / 50) * 100}%, var(--surface-3) ${(commentMaxPerPost / 50) * 100}%, var(--surface-3) 100%)`
                            }}
                        />
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">Unlimited</span>
                            <span className="text-primary font-bold text-xl font-mono">
                                {commentMaxPerPost === 0 ? '∞' : commentMaxPerPost}
                            </span>
                            <span className="text-[10px] text-muted-foreground">50</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground ml-1">Stops the AI from spamming replies if a post goes viral. 0 = no limit.</p>
                    </div>
                </div>

                {/* Paywall overlay for Starter */}
                {!isPro && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-3 z-10">
                        <div className="p-3 rounded-full bg-surface-2 border border-border">
                            <Lock className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="text-center px-6">
                            <p className="text-sm font-bold text-muted-foreground">Pro Feature</p>
                            <p className="text-[11px] text-muted-foreground mt-1">Upgrade to Pro to enable automatic replies to public comments on your posts.</p>
                        </div>
                        <a href="/dashboard/billing" className="text-[11px] font-bold text-primary hover:underline">Upgrade to Pro →</a>
                    </div>
                )}
            </motion.div>

            {/* Save Button */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_25px_rgba(139,92,246,0.2)] disabled:opacity-50"
                >
                    {saving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                    ) : (
                        <><Check className="w-4 h-4" /> Save Instagram Settings</>
                    )}
                </button>
            </motion.div>

            {/* Disconnect Confirmation Modal */}
            <GhostModal
                isOpen={disconnectModal.open}
                onCancel={() => setDisconnectModal({ open: false, accountId: null })}
                title="Disconnect Account?"
                message="This will stop all AI replies for this account."
                confirmText="Disconnect"
                onConfirm={() => {
                    if (disconnectModal.accountId) handleDisconnect(disconnectModal.accountId);
                    setDisconnectModal({ open: false, accountId: null });
                }}
                variant="danger"
            />
        </div>
    );
}
