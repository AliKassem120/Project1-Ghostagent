'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Bot, DollarSign, Bell, Globe, Sparkles, Upload, Building2, Loader2, Check, FileSpreadsheet, X, Instagram, Phone, Trash2, Plus, Lock, Wifi, Timer, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import GhostModal from '@/components/GhostModal';
import GhostLogo from '@/components/GhostLogo';
import CustomSelect from '@/components/CustomSelect';
import Papa from 'papaparse';
import BusinessTypeSelector, { BusinessCategory } from '@/components/BusinessTypeSelector';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { updateWorkspaceSettingsAction } from '@/app/actions/settings';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export type SettingsTab = 'business' | 'personality' | 'connections' | 'advanced' | 'team';
import { MessageCircle } from 'lucide-react';

export default function SettingsPage() {
    const supabase = createClient();
    const toast = useToast();
    const { activeWorkspaceId, planTier, isLoading: wsLoading, removeWorkspace, workspaces } = useWorkspace();
    const isPro = planTier === 'pro' || planTier === 'empire';
    const isEmpire = planTier === 'empire';
    const isFreePlan = planTier === 'starter';
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [instagramStatus, setInstagramStatus] = useState<{ connected: boolean; accounts: any[] } | null>(null);
    const [disconnectModal, setDisconnectModal] = useState<{ open: boolean; accountId: string | null }>({ open: false, accountId: null });
    const [deleteWsModal, setDeleteWsModal] = useState(false);
    const [deletingWs, setDeletingWs] = useState(false);
    // Team state
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'staff' | 'manager'>('staff');
    const [inviting, setInviting] = useState(false);

    // Tab Navigation
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const rawTab = searchParams.get('tab') as string;
    const VALID_TABS = ['business', 'personality', 'connections', 'advanced', 'team'];
    const activeTab: SettingsTab = VALID_TABS.includes(rawTab || '') 
        ? (rawTab as SettingsTab) 
        : 'business';

    const setTab = (tab: SettingsTab) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`${pathname}?${params.toString()}`);
    };

    // Initial state
    const [settings, setSettings] = useState({
        businessName: '',
        tone: 'Professional',
        useEmojis: true,
        maxDiscount: 20,
        minOrderForDiscount: 50,
        emergencyWhatsApp: '',
        language: 'Auto-Detect',
        systemPrompt: '',
        whatsappTemplate: '',
        storeLocation: '',
        contactInfo: '',
        shippingRules: '',
        businessType: 'ecommerce' as BusinessCategory,
        replyDelay: 0,
        // WhatsApp Business (Empire)
        waBusinessAccountId: '',
        waPhoneNumberId: '',
        waAccessToken: '',
        // Comment Auto-Reply (Pro+)
        commentAutoReply: false,
        commentReplyStyle: 'public' as 'public' | 'dm' | 'both',
        commentKeywords: '' as string,
        commentMaxPerPost: 0,
    });

    // AI Generate state
    const [aiPromptInput, setAiPromptInput] = useState('');
    const [generating, setGenerating] = useState(false);

    // Language Demo state
    const [demoPhase, setDemoPhase] = useState(0);

    useEffect(() => {
        if (settings.language !== 'Auto-Detect') return;

        const phases = [
            { delay: 1500, next: 1 }, // 0: Start, show FR user
            { delay: 3000, next: 2 }, // 1: Show FR bot
            { delay: 1500, next: 3 }, // 2: Reset, flip to AR
            { delay: 1500, next: 4 }, // 3: Show AR user
            { delay: 3000, next: 0 }, // 4: Show AR bot
        ];

        const timeout = setTimeout(() => {
            setDemoPhase(phases[demoPhase].next);
        }, phases[demoPhase].delay);

        return () => clearTimeout(timeout);
    }, [demoPhase, settings.language]);

    const handleGenerateInstructions = async () => {
        if (!aiPromptInput.trim() || generating) return;
        setGenerating(true);
        try {
            const res = await fetch('/api/generate-instructions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: aiPromptInput,
                    businessName: settings.businessName,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || 'Generation failed');
                return;
            }

            const { text } = await res.json();
            setSettings(prev => ({ ...prev, systemPrompt: text }));
            toast.success('Instructions generated! Review and save.');
            setAiPromptInput('');
        } catch (e) {
            console.error(e);
            toast.error('Failed to generate instructions');
        } finally {
            setGenerating(false);
        }
    };

    const fetchSettings = useCallback(async (isSilent = false, signal?: AbortSignal) => {
        if (!isSilent) setLoading(true);
        try {
            let query = supabase.from('ai_settings').select('*');

            if (activeWorkspaceId) {
                query = query.eq('id', activeWorkspaceId);
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user || signal?.aborted) { setLoading(false); return; }
                query = query.eq('user_id', user.id);
            }

            const { data } = await query.single();
            if (signal?.aborted) return;

            if (data) {
                setSettings({
                    businessName: data.business_name || '',
                    tone: data.tone || 'Professional',
                    useEmojis: data.use_emojis ?? true,
                    maxDiscount: data.max_discount || 20,
                    minOrderForDiscount: data.min_order_for_discount || 50,
                    emergencyWhatsApp: data.emergency_whatsapp || '',
                    language: data.language || 'Auto-Detect',
                    systemPrompt: data.system_instructions || '',
                    whatsappTemplate: data.whatsapp_template || '',
                    storeLocation: data.store_location || '',
                    contactInfo: data.contact_info || '',
                    shippingRules: data.shipping_rules || '',
                    businessType: (data.business_type || 'ecommerce') as BusinessCategory,
                    replyDelay: data.reply_delay_seconds || 0,
                    waBusinessAccountId: data.whatsapp_business_account_id || '',
                    waPhoneNumberId: data.whatsapp_phone_number_id || '',
                    waAccessToken: data.whatsapp_access_token || '',
                    commentAutoReply: data.comment_auto_reply ?? false,
                    commentReplyStyle: data.comment_reply_style || 'public',
                    commentKeywords: Array.isArray(data.comment_keywords) ? data.comment_keywords.join(', ') : '',
                    commentMaxPerPost: data.comment_max_per_post || 0,
                });
            }
        } catch (err) {
            console.error('Unexpected error:', err);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [activeWorkspaceId, supabase]);

    useEffect(() => {
        if (wsLoading) return;
        const controller = new AbortController();
        fetchSettings(false, controller.signal);
        return () => controller.abort();
    }, [fetchSettings, wsLoading]);

    // Background sync on window focus
    useEffect(() => {
        const handleFocus = () => fetchSettings(true);
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchSettings]);

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

    // Automatically check status when activeWorkspaceId changes
    useEffect(() => {
        setInstagramStatus(null); // Clear stale state during workspace switch
        const controller = new AbortController();
        checkInstagramStatus(controller.signal);
        // Poll status every 5 seconds to catch connection updates without refresh
        const interval = setInterval(() => {
            if (!controller.signal.aborted) checkInstagramStatus(controller.signal);
        }, 5000);
        return () => { controller.abort(); clearInterval(interval); };
    }, [checkInstagramStatus]);

    // Fetch team members when Empire user opens Team tab
    useEffect(() => {
        if (!isEmpire || !activeWorkspaceId || activeTab !== 'team') return;
        setTeamLoading(true);
        fetch(`/api/team?workspaceId=${activeWorkspaceId}`)
            .then(r => r.json())
            .then(d => setTeamMembers(d.members || []))
            .catch(() => {})
            .finally(() => setTeamLoading(false));
    }, [isEmpire, activeWorkspaceId, activeTab]);

    // Preload Facebook SDK for WhatsApp Embedded Signup to prevent popup blockers
    useEffect(() => {
        if (typeof window !== 'undefined' && !(window as any).FB) {
            const script = document.createElement('script');
            script.src = 'https://connect.facebook.net/en_US/sdk.js';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
                if ((window as any).FB && appId) {
                    (window as any).FB.init({
                        appId,
                        autoLogAppEvents: true,
                        xfbml: true,
                        version: 'v19.0',
                    });
                }
            };
            document.body.appendChild(script);
        }
    }, []);

    const handleConnectInstagram = () => {
        setConnecting(true);

        // Direct Meta Oauth
        // Use the Instagram App ID provided in the Meta Dashboard (under Instagram API)
        const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID;
        // Use window.location.origin for dynamic domain handling (localhost vs production)
        const redirectUri = `${window.location.origin}/api/auth/callback/instagram`;
        // UPDATED SCOPES: Based on Meta Dashboard requirements for Instagram Business Login
        const scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';

        if (!appId) {
            toast.error("Missing NEXT_PUBLIC_INSTAGRAM_APP_ID in env");
            setConnecting(false);
            return;
        }

        // New Instagram-only Login endpoint — pass activeWorkspaceId via state param
        const stateParam = activeWorkspaceId || '';
        const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${stateParam}`;

        console.log("Redirecting to Meta:", {
            appId,
            redirectUri,
            authUrl
        });
        window.location.href = authUrl;
    };
    
    const handleConnectWhatsApp = () => {
        if (!(window as any).FB) {
            toast.error("Facebook SDK not loaded yet. Please wait or refresh.");
            return;
        }

        (window as any).FB.login((response: any) => {
            if (response.authResponse) {
                const code = response.authResponse.code;
                if (!code) {
                    toast.error("Meta did not return a valid auth code.");
                    return;
                }
                
                // Exchange code via our backend
                fetch('/api/auth/callback/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code,
                        workspaceId: activeWorkspaceId
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        toast.success("WhatsApp Connected!");
                        fetchSettings(true);
                    } else {
                        toast.error(data.error || "Failed to link WhatsApp");
                    }
                })
                .catch(err => {
                    console.error("WA Callback error:", err);
                    toast.error("An error occurred during WhatsApp connection.");
                });
            } else {
                toast.error("WhatsApp connection cancelled or failed.");
            }
        }, {
            config_id: process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID || '1287853626231294', // WhatsApp Embedded Signup Config ID
            response_type: 'code',
            override_default_response_type: true,
            extras: {
                setup: {
                    // Pre-fill some info if possible
                }
            }
        });
    };

    const handleDisconnect = async (accountId: string) => {
        try {
            // Optimistic update
            setInstagramStatus(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    accounts: prev.accounts.filter(a => a.id !== accountId)
                };
            });

            await fetch('/api/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, workspaceId: activeWorkspaceId })
            });

            toast.success('Account Disconnected', { description: 'The integration has been removed.' });
            checkInstagramStatus(); // Refresh to be sure
        } catch (e) {
            toast.error('Failed to disconnect');
            checkInstagramStatus(); // Revert on error
        }
    };

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

    const handleDeleteWorkspace = async () => {
        if (!activeWorkspaceId) return;
        setDeletingWs(true);
        try {
            const { error } = await supabase.from('ai_settings').delete().eq('id', activeWorkspaceId);
            if (error) throw error;
            toast.success('Workspace deleted');
            removeWorkspace(activeWorkspaceId); // Sync with context
            setDeleteWsModal(false);
        } catch (e) {
            console.error('Failed to delete workspace:', e);
            toast.error('Failed to delete workspace. Please try again.');
        } finally {
            setDeletingWs(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (activeWorkspaceId) {
                // Empire mode: save scoped to the active workspace row
                await updateWorkspaceSettingsAction(activeWorkspaceId, settings, isEmpire);
            } else {
                // Single-workspace mode: save by user_id directly
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    toast.error('Not authenticated.');
                    setSaving(false);
                    return;
                }
                const { error } = await supabase.from('ai_settings').upsert({
                    user_id: user.id,
                    business_name: settings.businessName,
                    tone: settings.tone,
                    use_emojis: settings.useEmojis,
                    max_discount: settings.maxDiscount,
                    min_order_for_discount: settings.minOrderForDiscount,
                    emergency_whatsapp: settings.emergencyWhatsApp,
                    language: settings.language,
                    system_instructions: settings.systemPrompt,
                    whatsapp_template: settings.whatsappTemplate,
                    store_location: settings.storeLocation,
                    contact_info: settings.contactInfo,
                    shipping_rules: settings.shippingRules || null,
                    business_type: settings.businessType,
                    reply_delay_seconds: settings.replyDelay || 0,
                    comment_auto_reply: settings.commentAutoReply,
                    comment_reply_style: settings.commentReplyStyle,
                    comment_keywords: settings.commentKeywords ? settings.commentKeywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [],
                    comment_max_per_post: settings.commentMaxPerPost || 0,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });

                if (error) throw error;
            }

            console.log('✅ Settings Saved Successfully!');
            toast.success('Settings Saved', { description: 'Your Ghost Agent configuration has been updated.' });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);
        } catch (error: any) {
            console.error('Error saving settings:', error);
            const errorMessage = error?.message || error?.details || 'Unknown error occurred while saving';
            toast.error('Failed to save settings: ' + errorMessage);
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
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">Configure how your Ghost Agent behaves and responds.</p>
            </motion.div>

            {/* Tab Navigation */}
            <div className="flex overflow-x-auto custom-scrollbar gap-2 pb-2">
                {[
                    { id: 'business', label: 'Business & Sales', icon: Building2 },
                    { id: 'personality', label: 'AI Persona & Training', icon: Bot },
                    { id: 'connections', label: 'Integrations & Alerts', icon: Globe },
                    { id: 'advanced', label: 'Advanced', icon: Trash2 },
                    ...(isEmpire ? [{ id: 'team', label: 'Team', icon: Users }] : [])
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setTab(tab.id as SettingsTab)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border",
                            activeTab === tab.id
                                ? "bg-primary/10 border-primary/20 text-primary"
                                : "bg-surface-1 border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Business Identity */}
            {activeTab === 'business' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10">
                            <Building2 className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Business Identity</h2>
                            <p className="text-[11px] text-muted-foreground">Core business information</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Business Name</label>
                            <input
                                type="text"
                                value={settings.businessName}
                                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                                className="input-premium w-full"
                                placeholder="e.g. Joe's Pizza"
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Store Location</label>
                                <input
                                    type="text"
                                    value={settings.storeLocation}
                                    onChange={(e) => setSettings({ ...settings, storeLocation: e.target.value })}
                                    className="input-premium w-full"
                                    placeholder="e.g. Hamra, Beirut, Lebanon"
                                />
                                <p className="text-[10px] text-muted-foreground ml-1">The AI will share this exact address when asked.</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Contact Info</label>
                                <input
                                    type="text"
                                    value={settings.contactInfo}
                                    onChange={(e) => setSettings({ ...settings, contactInfo: e.target.value })}
                                    className="input-premium w-full"
                                    placeholder="e.g. +961 71 123 456 / info@store.com"
                                />
                                <p className="text-[10px] text-muted-foreground ml-1">Phone, email, or website the AI can share.</p>
                            </div>
                        </div>

                        {settings.businessType === 'ecommerce' && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Shipping &amp; Delivery Rules</label>
                                <textarea
                                    value={settings.shippingRules}
                                    onChange={(e) => setSettings({ ...settings, shippingRules: e.target.value })}
                                    className="input-premium w-full h-24 resize-none text-sm"
                                    placeholder="e.g. Free shipping over $50. Delivery 2-3 days within Lebanon. No international shipping."
                                />
                                <p className="text-[10px] text-muted-foreground ml-1">The AI will quote these rules exactly when customers ask about shipping.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* AI Persona */}
            {activeTab === 'personality' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                        <div className="p-2.5 rounded-xl bg-primary/10">
                            <Bot className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">AI Persona</h2>
                            <p className="text-[11px] text-muted-foreground">Personality and communication style</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Response Tone</label>
                            <CustomSelect
                                value={settings.tone}
                                onChange={(val) => setSettings({ ...settings, tone: val })}
                                options={[
                                    { value: "Casual", label: "Casual & Friendly" },
                                    { value: "Professional", label: "Professional" },
                                    { value: "Luxury", label: "Luxury & Premium" },
                                    { value: "Sarcastic", label: "Sarcastic" },
                                ]}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Use Emojis</label>
                            <div className="flex items-center justify-between p-3.5 bg-surface-2 rounded-xl border border-border hover:bg-surface-3 transition-all cursor-pointer group"
                                onClick={() => setSettings({ ...settings, useEmojis: !settings.useEmojis })}>
                                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Add emojis to responses</span>
                                <div className={clsx(
                                    "relative w-11 rounded-full transition-colors duration-300",
                                    settings.useEmojis ? "bg-primary" : "bg-surface-3 border border-border"
                                )} style={{ height: '24px' }}>
                                    <motion.div
                                        className="absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white shadow-sm"
                                        animate={{ x: settings.useEmojis ? 22 : 2 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Reply Delay */}
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                <Timer className="w-3 h-3" /> Reply Delay
                                {isFreePlan && (
                                    <span className="ml-1 flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-0.5">
                                        <Lock className="w-2.5 h-2.5" /> Paid
                                    </span>
                                )}
                            </label>
                            <div className={clsx(
                                "p-4 bg-surface-2 rounded-xl border border-border relative",
                                isFreePlan && 'opacity-50 pointer-events-none'
                            )}>
                                <input
                                    type="range"
                                    min="0"
                                    max="900"
                                    step="30"
                                    value={settings.replyDelay}
                                    onChange={(e) => setSettings({ ...settings, replyDelay: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-surface-3 rounded-full appearance-none cursor-pointer accent-primary border border-border"
                                    disabled={isFreePlan}
                                    style={{
                                        background: `linear-gradient(to right, rgb(139 92 246) 0%, rgb(139 92 246) ${(settings.replyDelay / 900) * 100}%, var(--surface-3) ${(settings.replyDelay / 900) * 100}%, var(--surface-3) 100%)`
                                    }}
                                />
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[10px] text-muted-foreground">Instant</span>
                                    <span className="text-primary font-bold text-lg font-mono">
                                        {settings.replyDelay === 0 ? 'Instant' : settings.replyDelay < 60 ? `${settings.replyDelay}s` : `${Math.floor(settings.replyDelay / 60)}m${settings.replyDelay % 60 > 0 ? ` ${settings.replyDelay % 60}s` : ''}`}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">15 min</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground ml-1">Add a delay before the bot replies. Makes responses feel more human and natural.</p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Manager Alerts */}
            {activeTab === 'connections' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 relative overflow-x-clip">
                    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                        <div className="p-2.5 rounded-xl bg-amber-500/10">
                            <Bell className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Manager Alerts</h2>
                            <p className="text-[11px] text-muted-foreground">Human escalation via WhatsApp</p>
                        </div>
                        {!isPro && (
                            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                                <Lock className="w-3 h-3" /> Pro+
                            </span>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Owner WhatsApp Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                type="tel"
                                value={settings.emergencyWhatsApp}
                                onChange={(e) => setSettings({ ...settings, emergencyWhatsApp: e.target.value })}
                                className="input-premium w-full !pl-10"
                                placeholder="+1 234 567 8900"
                                disabled={!isPro}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground ml-1">Ghost Agent texts this number if a customer says &quot;Manager&quot;, &quot;Scam&quot;, or &quot;Bot&quot;.</p>
                    </div>

                    {/* Paywall overlay for Starter */}
                    {!isPro && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-3 z-10">
                            <div className="p-3 rounded-full bg-surface-2 border border-border">
                                <Lock className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="text-center px-6">
                                <p className="text-sm font-bold text-muted-foreground">Pro Feature</p>
                                <p className="text-[11px] text-muted-foreground mt-1">Upgrade to Pro to receive WhatsApp alerts when customers need help.</p>
                            </div>
                            <a href="/dashboard/billing" className="text-[11px] font-bold text-primary hover:underline">Upgrade to Pro →</a>
                        </div>
                    )}
                </motion.div>
            )}

            {/* ═══ AUTO COMMENT SECTION ═══ */}
            {activeTab === 'connections' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 relative overflow-x-clip">
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
                            onClick={() => isPro && setSettings({ ...settings, commentAutoReply: !settings.commentAutoReply })}
                        >
                            <div>
                                <p className="text-sm font-semibold text-foreground">Reply to Comments</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Ghost AI will automatically reply to public comments on your posts</p>
                            </div>
                            <div className={clsx("relative w-11 rounded-full transition-colors duration-300 shrink-0", settings.commentAutoReply && isPro ? "bg-primary" : "bg-surface-3 border border-border")} style={{ height: '24px' }}>
                                <motion.div
                                    className="absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white shadow-sm"
                                    animate={{ x: settings.commentAutoReply && isPro ? 22 : 2 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </div>
                        </div>

                        {/* Reply Style */}
                        <div className={clsx("space-y-2", !isPro || !settings.commentAutoReply ? "opacity-40 pointer-events-none" : "")}>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Reply Style</label>
                            <div className="grid grid-cols-3 gap-2">
                                {([['public', '💬 Public Reply', 'Reply visibly under the comment'], ['dm', '📩 Send to DM', 'Slide into their DMs instead'], ['both', '⚡ Both', 'Reply publicly & continue in DMs']] as const).map(([val, label, desc]) => (
                                    <button
                                        key={val}
                                        onClick={() => setSettings({ ...settings, commentReplyStyle: val })}
                                        className={clsx(
                                            "p-3 rounded-xl border text-left transition-all",
                                            settings.commentReplyStyle === val
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
                        <div className={clsx("space-y-1.5", !isPro || !settings.commentAutoReply ? "opacity-40 pointer-events-none" : "")}>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Keyword Filter <span className="normal-case font-normal">(optional)</span></label>
                            <input
                                type="text"
                                value={settings.commentKeywords}
                                onChange={(e) => setSettings({ ...settings, commentKeywords: e.target.value })}
                                className="input-premium w-full"
                                placeholder="price, stock, available, how much ..."
                                disabled={!isPro || !settings.commentAutoReply}
                            />
                            <p className="text-[10px] text-muted-foreground ml-1">Comma-separated. AI only replies to comments containing these words. Leave empty to reply to all comments.</p>
                        </div>

                        {/* Max Replies per Post */}
                        <div className={clsx("space-y-3", !isPro || !settings.commentAutoReply ? "opacity-40 pointer-events-none" : "")}>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Max Replies per Post</label>
                            <input
                                type="range"
                                min="0"
                                max="50"
                                step="5"
                                value={settings.commentMaxPerPost}
                                onChange={(e) => setSettings({ ...settings, commentMaxPerPost: parseInt(e.target.value) })}
                                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary border border-border"
                                disabled={!isPro || !settings.commentAutoReply}
                                style={{
                                    background: `linear-gradient(to right, rgb(139 92 246) 0%, rgb(139 92 246) ${(settings.commentMaxPerPost / 50) * 100}%, var(--surface-3) ${(settings.commentMaxPerPost / 50) * 100}%, var(--surface-3) 100%)`
                                }}
                            />
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-muted-foreground">Unlimited</span>
                                <span className="text-primary font-bold text-xl font-mono">
                                    {settings.commentMaxPerPost === 0 ? '∞' : settings.commentMaxPerPost}
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
            )}

            {/* Sales Rules */}
            {activeTab === 'business' && (

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10">
                            <DollarSign className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Sales Rules</h2>
                            <p className="text-[11px] text-muted-foreground">Pricing and discount boundaries</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Maximum Discount %</label>
                            <input
                                type="range"
                                min="0"
                                max="50"
                                value={settings.maxDiscount}
                                onChange={(e) => setSettings({ ...settings, maxDiscount: parseInt(e.target.value) })}
                                className="w-full h-2 bg-surface-2 rounded-full appearance-none cursor-pointer accent-primary border border-border"
                                style={{
                                    background: `linear-gradient(to right, rgb(139 92 246) 0%, rgb(139 92 246) ${settings.maxDiscount * 2}%, var(--surface-3) ${settings.maxDiscount * 2}%, var(--surface-3) 100%)`
                                }}
                            />
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-muted-foreground">0%</span>
                                <span className="text-primary font-bold text-2xl font-mono">{settings.maxDiscount}%</span>
                                <span className="text-[10px] text-muted-foreground">50%</span>
                            </div>
                        </div>

                        <div className="space-y-1.5 flex flex-col items-start w-full">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-1 relative block">Minimum Order for Discount</label>
                            <div className="relative w-full group">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold z-10">$</span>
                                <input
                                    type="number"
                                    value={settings.minOrderForDiscount}
                                    onChange={(e) => setSettings({ ...settings, minOrderForDiscount: parseInt(e.target.value) || 0 })}
                                    className="input-premium w-full !pl-9 !pr-14 font-semibold appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0 focus:z-0 relative"
                                    placeholder="50"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold uppercase z-10">USD</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Integrations */}
            {activeTab === 'connections' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                        <div className="p-2.5 rounded-xl bg-pink-500/10">
                            <Instagram className="w-5 h-5 text-pink-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Integrations</h2>
                            <p className="text-[11px] text-muted-foreground">Connected social accounts</p>
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
                                    <button
                                        onClick={handleConnectInstagram}
                                        disabled={connecting}
                                        className="w-full py-4 border border-dashed border-border hover:border-border-strong hover:bg-surface-2 rounded-xl flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-all group press"
                                    >
                                        {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                            <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                                <Plus className="w-4 h-4" />
                                            </div>}
                                        <span className="text-sm font-medium">Add Account</span>
                                    </button>
                                )}

                                {/* Instagram Setup Helper */}
                                <div className="p-5 rounded-2xl bg-pink-500/5 border border-pink-500/10 space-y-3 mt-6">
                                    <div className="flex items-center gap-2 text-pink-400">
                                        <Sparkles className="w-4 h-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Instagram Setup Instructions</p>
                                    </div>
                                    <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                                        <p>1. Open <a href="https://developers.facebook.com/" target="_blank" className="text-pink-400 hover:underline">Meta Developers</a> and select your app.</p>
                                        <p>2. Go to <strong>Instagram Login for Business</strong> &gt; <strong>Settings</strong>.</p>
                                        <p>3. Add this exact URI to <strong>Valid OAuth Redirect URIs</strong>:</p>
                                    </div>
                                    <div className="relative group">
                                        <div className="flex items-center gap-2 p-3 bg-black/40 rounded-xl border border-white/5 font-mono text-[10px] text-pink-400 break-all select-all">
                                            {typeof window !== 'undefined' ? `${window.location.origin}/api/auth/callback/instagram` : '.../api/auth/callback/instagram'}
                                        </div>
                                        <p className="text-[9px] text-red-400/80 mt-2 italic">
                                            ⚠️ Error "Invalid redirect_uri"? Ensure the URI above matches EXACTLY (check http vs https and trailing slashes) in your Meta Dashboard.
                                        </p>
                                    </div>
                                </div>
                            </>
                         )}
                     </div>
                 </motion.div>
             )}

             {/* WhatsApp Integration Section */}
             {activeTab === 'connections' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 mt-6">
                    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10">
                            <Phone className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">WhatsApp Business</h2>
                            <p className="text-[11px] text-muted-foreground">Connect your official WhatsApp API</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-surface-2 rounded-2xl border border-border gap-4">
                            <div className="flex items-center gap-4 w-full">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                                    <MessageCircle className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-foreground">
                                        {settings.waPhoneNumberId ? 'Connected' : 'Meta Embedded Signup'}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {settings.waPhoneNumberId ? `ID: ${settings.waPhoneNumberId}` : 'Link your number in 30 seconds.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleConnectWhatsApp}
                                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                            >
                                {settings.waPhoneNumberId ? 'Re-Connect' : 'Connect WhatsApp'}
                            </button>
                        </div>

                        {/* How it works */}
                        <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <Sparkles className="w-4 h-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest">How It Works</p>
                            </div>
                            <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                                <p>1. Click <strong>Connect WhatsApp</strong> above — you'll be taken to Meta to log in.</p>
                                <p>2. Select your <strong>WhatsApp Business Account</strong> and phone number.</p>
                                <p>3. That's it! GhostAgent will start handling your WhatsApp messages automatically.</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
             )}

            {/* Language */}
            {activeTab === 'personality' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                        <div className="p-2.5 rounded-xl bg-blue-500/10">
                            <Globe className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Language</h2>
                            <p className="text-[11px] text-muted-foreground">Ghost Agent mirrors the user&apos;s language</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 items-start">
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Language Mode</label>
                                <CustomSelect
                                    value={settings.language}
                                    onChange={(val) => setSettings({ ...settings, language: val })}
                                    options={[
                                        { value: "Auto-Detect", label: "🌍 Auto-Detect" },
                                        { value: "English", label: "🇬🇧 English Only" },
                                        { value: "Lebanese Franco", label: "🇱🇧 Lebanese Franco" },
                                        { value: "Arabic", label: "🇱🇧 Arabic" },
                                    ]}
                                />
                                <p className="text-[10px] text-muted-foreground ml-1 mt-2">Auto-Detect is recommended. Ghost Agent mirrors any language the customer uses.</p>
                            </div>
                        </div>

                        <div className="hidden md:block">
                            <label className="text-[10px] font-bold text-primary/60 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Live Translation Playground</label>
                            <div className="rounded-xl border border-border bg-gradient-to-b from-surface-1 to-surface-0 min-h-[200px] flex flex-col relative overflow-x-clip shadow-sm">
                                {/* App Header Mockup */}
                                <div className="h-10 border-b border-border bg-surface-2 flex items-center justify-between px-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                            <GhostLogo iconOnly className="w-3 h-3" />
                                        </div>
                                        <span className="text-xs font-medium text-muted-foreground">GhostAgent</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-surface-2"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-surface-2"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-surface-2"></div>
                                    </div>
                                </div>

                                {/* Chat Area */}
                                <div className="flex-1 p-4 flex flex-col justify-end space-y-4">
                                    {settings.language !== 'Auto-Detect' ? (
                                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground text-center px-6">
                                            Enable Auto-Detect to test live translation
                                        </div>
                                    ) : (
                                        <AnimatePresence mode="popLayout">
                                            {(demoPhase === 0 || demoPhase === 1) && (
                                                <motion.div
                                                    key="user-fr"
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                                                    className="self-end max-w-[80%] bg-surface-2 text-foreground text-[13px] px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm border border-border"
                                                >
                                                    Bonjour! Avez-vous ça en stock?
                                                </motion.div>
                                            )}

                                            {demoPhase === 1 && (
                                                <motion.div
                                                    key="bot-fr"
                                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                                    className="self-start max-w-[80%] bg-gradient-to-br from-primary/20 to-primary/10 text-primary-100 dark:text-primary-foreground text-primary text-[13px] px-3.5 py-2.5 rounded-2xl rounded-tl-sm border border-primary/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                                                >
                                                    Bonjour! Oui, c'est disponible.
                                                </motion.div>
                                            )}

                                            {(demoPhase === 3 || demoPhase === 4) && (
                                                <motion.div
                                                    key="user-ar"
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                                                    className="self-end max-w-[80%] bg-surface-2 text-foreground text-[13px] px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm border border-border"
                                                >
                                                    مرحبا، في من هيدا؟
                                                </motion.div>
                                            )}

                                            {demoPhase === 4 && (
                                                <motion.div
                                                    key="bot-ar"
                                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                                    className="self-start max-w-[80%] bg-gradient-to-br from-primary/20 to-primary/10 text-primary-100 text-[13px] px-3.5 py-2.5 rounded-2xl rounded-tl-sm border border-primary/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                                                >
                                                    أهلا بك! نعم، هذا متوفر لدينا.
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Business Knowledge Base */}
            {activeTab === 'personality' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                        <div className="p-2.5 rounded-xl bg-violet-500/10">
                            <Sparkles className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Business Knowledge Base</h2>
                            <p className="text-[11px] text-muted-foreground">Teach your bot specific facts about your business</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-xs text-muted-foreground mb-4">
                            Add simple facts here. The bot will use these to answer customer questions automatically.
                        </p>
                        
                        <div className="space-y-3">
                            {(settings.systemPrompt.split('\n').filter(line => line.startsWith('• ')).map(line => line.replace('• ', '')) || []).map((fact, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-surface-2 p-3 rounded-xl border border-border group">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                    <span className="text-sm text-foreground flex-1">{fact}</span>
                                    <button 
                                        onClick={() => {
                                            const facts = settings.systemPrompt.split('\n').filter(line => line.startsWith('• ')).map(line => line.replace('• ', ''));
                                            facts.splice(idx, 1);
                                            setSettings({ ...settings, systemPrompt: facts.map(f => `• ${f}`).join('\n') });
                                        }}
                                        className="p-1.5 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}

                            <div className="flex gap-2 mt-4">
                                <input
                                    type="text"
                                    id="new-fact-input"
                                    className="input-premium flex-1 text-sm"
                                    placeholder="e.g. We have free parking behind the shop..."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = (e.target as HTMLInputElement).value;
                                            if (val.trim()) {
                                                const facts = settings.systemPrompt.split('\n').filter(line => line.startsWith('• ')).map(line => line.replace('• ', ''));
                                                setSettings({ ...settings, systemPrompt: [...facts, val.trim()].map(f => `• ${f}`).join('\n') });
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }
                                    }}
                                />
                                <button 
                                    onClick={() => {
                                        const input = document.getElementById('new-fact-input') as HTMLInputElement;
                                        if (input.value.trim()) {
                                            const facts = settings.systemPrompt.split('\n').filter(line => line.startsWith('• ')).map(line => line.replace('• ', ''));
                                            setSettings({ ...settings, systemPrompt: [...facts, input.value.trim()].map(f => `• ${f}`).join('\n') });
                                            input.value = '';
                                        }
                                    }}
                                    className="px-4 py-2 bg-primary text-black rounded-xl text-sm font-bold hover:scale-[1.02] transition-transform flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Fact
                                </button>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-border">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 block mb-2">Raw Memory (Advanced)</label>
                            <textarea
                                className="input-premium w-full h-24 resize-none text-[11px] font-mono opacity-50 focus:opacity-100 transition-opacity"
                                value={settings.systemPrompt}
                                onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                                placeholder="The itemized facts above are stored here..."
                            />
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Advanced Tab Content */}
            {activeTab === 'advanced' && (
                <>
                    {/* Plan & Usage */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                            <div className="p-2.5 rounded-xl bg-violet-500/10">
                                <Sparkles className="w-5 h-5 text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Plan & Usage</h2>
                                <p className="text-[11px] text-muted-foreground">Your current plan limits and usage this month</p>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-surface-2 rounded-xl p-4">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Active Plan</p>
                                <p className="text-lg font-black text-foreground capitalize">{planTier === 'starter' ? 'Starter' : planTier === 'pro' ? 'Pro Agent' : planTier === 'empire' ? 'Empire' : planTier}</p>
                            </div>
                            <div className="bg-surface-2 rounded-xl p-4">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Reply Limit</p>
                                <p className="text-lg font-black text-foreground">{planTier === 'empire' ? '10,000 / month' : planTier === 'pro' ? '1,000 / month' : '100 / month'}</p>
                            </div>
                            <div className="bg-surface-2 rounded-xl p-4">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Workspaces</p>
                                <p className="text-lg font-black text-foreground">{workspaces.length} / {planTier === 'empire' ? '3' : '1'}</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-border">
                            <a href="/dashboard/billing" className="text-xs text-primary font-bold hover:underline">Manage Billing & Upgrade Plan →</a>
                        </div>
                    </motion.div>

                    {/* Workspace Info */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                            <div className="p-2.5 rounded-xl bg-indigo-500/10">
                                <Building2 className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Workspace Info</h2>
                                <p className="text-[11px] text-muted-foreground">Technical details of this workspace</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-2 border-b border-border/50">
                                <span className="text-xs text-muted-foreground font-medium">Workspace ID</span>
                                <span className="text-xs font-mono text-foreground bg-surface-2 px-2 py-1 rounded-lg">{activeWorkspaceId || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-border/50">
                                <span className="text-xs text-muted-foreground font-medium">Business Type</span>
                                <span className="text-xs font-semibold text-foreground capitalize">{settings.businessType?.replace('_', ' ') || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-xs text-muted-foreground font-medium">Instagram Connected</span>
                                <span className={`text-xs font-bold ${instagramStatus === null ? 'text-muted-foreground' : instagramStatus.connected ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {instagramStatus === null ? 'Loading...' : instagramStatus.connected ? 'Yes' : 'No'}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}

            {/* Team Tab */}
            {activeTab === 'team' && isEmpire && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                        <div className="p-2.5 rounded-xl bg-amber-500/10">
                            <Users className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Team Access</h2>
                            <p className="text-[11px] text-muted-foreground">Invite staff members to view your inbox and manage conversations</p>
                        </div>
                        <span className="ml-auto px-2 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full uppercase tracking-wider">Empire</span>
                    </div>

                    {/* Invite Form */}
                    <div className="space-y-4 mb-6">
                        <p className="text-xs text-muted-foreground">Invited members can log in and view this workspace&apos;s inbox. Managers can also take over conversations.</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="email"
                                placeholder="teammate@email.com"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                className="input-premium flex-1 text-sm"
                            />
                            <select
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value as 'staff' | 'manager')}
                                className="input-premium text-sm w-full sm:w-36"
                            >
                                <option value="staff">Staff (View)</option>
                                <option value="manager">Manager (Act)</option>
                            </select>
                            <button
                                onClick={async () => {
                                    if (!inviteEmail || !activeWorkspaceId) return;
                                    setInviting(true);
                                    try {
                                        const res = await fetch('/api/team', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ workspaceId: activeWorkspaceId, email: inviteEmail, role: inviteRole })
                                        });
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data.error);
                                        toast.success(`Invite sent to ${inviteEmail}`);
                                        setInviteEmail('');
                                        // Refresh members
                                        const r2 = await fetch(`/api/team?workspaceId=${activeWorkspaceId}`);
                                        const d2 = await r2.json();
                                        setTeamMembers(d2.members || []);
                                    } catch (e: any) {
                                        toast.error(e.message || 'Failed to invite');
                                    } finally {
                                        setInviting(false);
                                    }
                                }}
                                disabled={inviting || !inviteEmail}
                                className="px-4 py-2 bg-primary text-black rounded-xl text-sm font-bold hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center gap-2 shrink-0"
                            >
                                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Invite
                            </button>
                        </div>
                    </div>

                    {/* Members List */}
                    <div className="space-y-2">
                        {teamLoading ? (
                            <div className="h-16 bg-surface-2 rounded-xl animate-pulse" />
                        ) : teamMembers.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                                No team members yet. Invite someone above.
                            </div>
                        ) : teamMembers.map((m: any) => (
                            <div key={m.id} className="flex items-center justify-between bg-surface-2 p-4 rounded-xl border border-border">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{m.invite_email}</p>
                                    <p className="text-[11px] text-muted-foreground capitalize">{m.role} · {m.status}</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!confirm(`Remove ${m.invite_email}?`)) return;
                                        await fetch(`/api/team?memberId=${m.id}`, { method: 'DELETE' });
                                        setTeamMembers(prev => prev.filter(x => x.id !== m.id));
                                        toast.success('Member removed');
                                    }}
                                    className="px-3 py-1.5 text-[11px] font-bold bg-red-500/5 text-red-400/60 border border-red-500/10 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Danger Zone */}
            {activeTab === 'advanced' && workspaces.length > 1 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="max-w-4xl mx-auto px-4 md:px-8 mb-8"
                >
                    <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                            <h3 className="text-xl font-bold text-red-500 flex items-center gap-2 mb-2">
                                <Trash2 className="w-5 h-5" /> Danger Zone
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                Permanently delete this workspace and all its data. This action cannot be undone.
                            </p>
                        </div>
                        <button
                            onClick={() => setDeleteWsModal(true)}
                            className="px-6 py-3 rounded-xl bg-red-500/10 text-red-500 font-semibold hover:bg-red-500 hover:text-foreground transition-colors shrink-0"
                        >
                            Delete Workspace
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Save Button */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex justify-center pt-4 pb-6 md:pb-8 sticky bottom-4 md:static z-40"
            >
                <button
                    onClick={handleSave}
                    disabled={saving || success}
                    className={clsx(
                        "px-12 py-4 rounded-2xl font-bold text-base transition-all shadow-[0_0_30px_rgba(139,92,246,0.4)] flex items-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed w-full md:w-auto justify-center mx-4 md:mx-0",
                        success ? "bg-emerald-500 text-black scale-[1.02]" : "bg-primary text-black hover:scale-[1.02] active:scale-[0.98]"
                    )}
                >
                    {saving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : success ? (
                        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="flex items-center gap-2">
                            <Check className="w-6 h-6" /> Saved!
                        </motion.div>
                    ) : (
                        <><Save className="w-5 h-5" /> Save All Settings</>
                    )}
                </button>
            </motion.div>

            {/* Disconnect Confirmation Modal */}
            <GhostModal
                isOpen={disconnectModal.open}
                variant="danger"
                title="Disconnect Account?"
                message="This will remove the Instagram integration. Your Ghost Agent will stop replying to messages on this account."
                confirmText="Disconnect"
                cancelText="Keep Connected"
                onConfirm={() => {
                    if (disconnectModal.accountId) {
                        handleDisconnect(disconnectModal.accountId);
                    }
                    setDisconnectModal({ open: false, accountId: null });
                }}
                onCancel={() => setDisconnectModal({ open: false, accountId: null })}
            />

            {/* Delete Workspace Confirmation Modal */}
            <GhostModal
                isOpen={deleteWsModal}
                variant="danger"
                title="Delete Workspace?"
                message={`Are you absolutely sure you want to delete this workspace? All settings, activity logs, and integrations will be permanently removed.`}
                confirmText={deletingWs ? 'Deleting...' : 'Permanently Delete'}
                cancelText="Cancel"
                onConfirm={handleDeleteWorkspace}
                onCancel={() => setDeleteWsModal(false)}
            />
        </div>
    );
}
