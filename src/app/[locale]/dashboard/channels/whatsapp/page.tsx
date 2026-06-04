'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, Loader2, Wifi, Sparkles, Lock, ChevronDown, Check, AlertTriangle, Megaphone } from 'lucide-react';
import { clsx } from 'clsx';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { updateWorkspaceSettingsAction } from '@/app/actions/settings';
import Link from 'next/link';

const TEMPLATE_INFO: Record<string, { title: string; category: string; trigger: string; preview: string; businessType: 'appointments' | 'ecommerce' | 'all' }> = {
    ghostagent_order_shipped: {
        title: 'Order Shipped',
        category: 'Utility',
        trigger: 'Triggers automatically when you change an order\'s status to "Shipped" in the Orders page.',
        preview: '📦 Your order *[Item Name]* has been shipped! You can expect delivery soon.\n\nTracking: [Link]\n\nThank you for shopping with us! 🙏',
        businessType: 'ecommerce'
    },
    ghostagent_order_delivered: {
        title: 'Order Delivered',
        category: 'Utility',
        trigger: 'Triggers automatically when you change an order\'s status to "Delivered" in the Orders page.',
        preview: '✅ Your order *[Item Name]* has been delivered!\n\nWe hope you love it. If you have any questions, just reply to this message.\n\nThank you! 💜',
        businessType: 'ecommerce'
    },
    ghostagent_review_request: {
        title: 'Review Request',
        category: 'Marketing',
        trigger: 'Triggers automatically 3 days after an order is marked as "Delivered" to request feedback.',
        preview: 'Hey [Customer Name]! 👋\n\nHow was your experience with *[Item Name]*? We\'d love to hear your feedback!\n\nJust reply with a quick review — it really helps us improve. ⭐',
        businessType: 'ecommerce'
    },
    ghostagent_appointment_reminder: {
        title: 'Appointment Reminder',
        category: 'Utility',
        trigger: 'Triggers automatically when you update an appointment\'s status to "Reminder" to notify the client.',
        preview: '📅 Reminder: You have a *[Service]* appointment tomorrow at *[Time]*.\n\nNeed to reschedule? Just reply to this message.\n\nSee you soon! 😊',
        businessType: 'appointments'
    },
    ghostagent_appointment_confirmed: {
        title: 'Appointment Confirmed',
        category: 'Utility',
        trigger: 'Triggers automatically when you mark an appointment as "Confirmed" in the Calendar or bookings list.',
        preview: '✅ Your *[Service]* appointment is confirmed!\n\n📅 Date: [Date]\n🕐 Time: [Time]\n💰 Price: $[Price]\n\nSee you there! 🙌',
        businessType: 'appointments'
    },
    ghostagent_promotional_blast: {
        title: 'Promotional Broadcast',
        category: 'Marketing',
        trigger: 'Triggered manually when you launch a campaign blast from the Marketing page.',
        preview: 'Exclusive Offer\n\nHey! 👋\n\n[Your Custom Campaign Message Body]\n\nReply to this message if you have any questions or want to claim this offer! 👻\n\nPowered by GhostAgent',
        businessType: 'all'
    }
};

export default function WhatsAppChannelPage() {
    const supabase = createClient();
    const toast = useToast();
    const { activeWorkspaceId, activeWorkspace, planTier, isLoading: wsLoading } = useWorkspace();
    const isPro = planTier === 'pro' || planTier === 'empire';
    const isEmpire = planTier === 'empire';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAdvancedWA, setShowAdvancedWA] = useState(false);

    // WhatsApp credentials
    const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
    const [waAccessToken, setWaAccessToken] = useState('');
    const [waBusinessAccountId, setWaBusinessAccountId] = useState('');
    const [emergencyWhatsApp, setEmergencyWhatsApp] = useState('');

    // WhatsApp Sync state
    const [syncingWA, setSyncingWA] = useState(false);
    const [waTemplates, setWaTemplates] = useState<any[]>([]);
    const [waFlowId, setWaFlowId] = useState<string | null>(null);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

    // Fetch settings
    const fetchSettings = useCallback(async (signal?: AbortSignal) => {
        if (!activeWorkspaceId) return;
        setLoading(true);
        try {
            const { data } = await supabase
                .from('ai_settings')
                .select('whatsapp_business_account_id, whatsapp_access_token, whatsapp_phone_number_id, emergency_whatsapp')
                .eq('id', activeWorkspaceId)
                .single();

            if (signal?.aborted) return;
            if (data) {
                setWaBusinessAccountId(data.whatsapp_business_account_id || '');
                setWaAccessToken(data.whatsapp_access_token || '');
                setWaPhoneNumberId(data.whatsapp_phone_number_id || '');
                setEmergencyWhatsApp(data.emergency_whatsapp || '');
            }
        } catch (err) {
            console.error('Failed to load WA settings:', err);
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

    // Fetch template statuses
    useEffect(() => {
        if (!activeWorkspaceId) return;
        setLoadingTemplates(true);
        fetch(`/api/whatsapp/sync?workspaceId=${activeWorkspaceId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setWaTemplates(data.templates || []);
                    setWaFlowId(data.flowId || null);
                }
            })
            .catch(() => {})
            .finally(() => setLoadingTemplates(false));
    }, [activeWorkspaceId]);

    // Preload Facebook SDK for WhatsApp Embedded Signup
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
                        fetchSettings();
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
            config_id: process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID || '1287853626231294',
            response_type: 'code',
            override_default_response_type: true,
            extras: {
                setup: {}
            }
        });
    };

    const handleSyncWhatsApp = async () => {
        if (!activeWorkspaceId) return;
        setSyncingWA(true);
        try {
            const res = await fetch('/api/whatsapp/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: activeWorkspaceId }),
            });
            const data = await res.json();
            if (res.ok) {
                setWaTemplates(data.templates?.current || []);
                if (data.flow?.flowId) setWaFlowId(data.flow.flowId);
                toast.success('WhatsApp templates & flows synced successfully!');
            } else {
                toast.error(data.error || 'Sync failed');
            }
        } catch (e: any) {
            toast.error(e.message || 'Sync failed');
        } finally {
            setSyncingWA(false);
        }
    };

    const handleSave = async () => {
        if (!activeWorkspaceId) return;
        setSaving(true);
        try {
            // Fetch current full settings to merge
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
                emergencyWhatsApp: emergencyWhatsApp,
                commentAutoReply: current.comment_auto_reply,
                commentReplyStyle: current.comment_reply_style,
                commentKeywords: Array.isArray(current.comment_keywords) ? current.comment_keywords.join(', ') : '',
                commentMaxPerPost: current.comment_max_per_post,
                waBusinessAccountId: waBusinessAccountId,
                waPhoneNumberId: waPhoneNumberId,
                waAccessToken: waAccessToken,
            }, isEmpire);

            toast.success('WhatsApp settings saved!');
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

    const isConnected = !!waPhoneNumberId && waPhoneNumberId !== 'NOT SET';

    return (
        <div className="space-y-6 pb-6 md:pb-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10">
                        <MessageCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">WhatsApp Channel</h1>
                        <p className="text-sm text-muted-foreground">Connect and manage your WhatsApp Business integration.</p>
                    </div>
                </div>
            </motion.div>

            {/* Connection Status Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6"
            >
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10">
                        <Phone className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">WhatsApp Business API</h2>
                        <p className="text-[11px] text-muted-foreground">Connect your official WhatsApp phone number</p>
                    </div>
                    {isConnected && (
                        <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold rounded-full border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Connected
                        </span>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-surface-2 rounded-2xl border border-border gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                            <MessageCircle className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-foreground">
                                {isConnected ? 'Connected' : 'Meta Embedded Signup'}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {isConnected ? `Phone Number ID: ${waPhoneNumberId}` : 'Link your number in 30 seconds.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                        <Link
                            href="/dashboard/simulator"
                            className="px-6 py-2.5 bg-surface-3 border border-border text-foreground font-bold rounded-xl hover:bg-surface-4 transition-all flex items-center justify-center gap-2 text-sm shrink-0"
                        >
                            <Phone className="w-4 h-4 text-emerald-400" />
                            Test in Simulator
                        </Link>
                        <button
                            onClick={handleConnectWhatsApp}
                            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)] shrink-0"
                        >
                            {isConnected ? 'Re-Connect' : 'Connect WhatsApp'}
                        </button>
                    </div>
                </div>

                {/* How it works */}
                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-3 mt-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <Sparkles className="w-4 h-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">How It Works</p>
                    </div>
                    <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                        <p>1. Click <strong>Connect WhatsApp</strong> above — you'll be taken to Meta to log in.</p>
                        <p>2. Select your <strong>WhatsApp Business Account</strong> and phone number.</p>
                        <p>3. Click <strong>Sync to Meta</strong> below to activate message templates (booking flows coming soon).</p>
                        <p>4. That's it! GhostAgent will handle your WhatsApp messages automatically.</p>
                    </div>
                </div>
            </motion.div>

            {/* Sync Templates & Flows */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6"
            >
                <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/5 via-surface-2 to-blue-500/5 border border-purple-500/15 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-purple-500/10">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-foreground">Sync Templates & Flows</h4>
                                <p className="text-[10px] text-muted-foreground">One-click setup for marketing blasts & native booking forms</p>
                            </div>
                        </div>
                        <button
                            onClick={handleSyncWhatsApp}
                            disabled={syncingWA}
                            className="px-4 py-2 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-400 transition-all flex items-center gap-2 text-xs shadow-[0_0_20px_rgba(168,85,247,0.2)] disabled:opacity-50"
                        >
                            {syncingWA ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing...</>
                            ) : (
                                <><Wifi className="w-3.5 h-3.5" /> Sync to Meta</>
                            )}
                        </button>
                    </div>

                    {/* Template Status Grid */}
                    {(() => {
                        const bizType = activeWorkspace?.business_type || 'ecommerce';
                        const visibleTemplates = Object.entries(TEMPLATE_INFO).filter(([_, info]) => {
                            return info.businessType === 'all' || info.businessType === bizType;
                        });

                        return (
                            <div className="space-y-2.5">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Message Templates ({bizType === 'appointments' ? 'Services & Booking' : 'E-Commerce Orders'})
                                </p>
                                <div className="flex flex-col gap-2">
                                    {visibleTemplates.map(([key, info]) => {
                                        const synced = waTemplates.find(wa => wa.name === key);
                                        const status = synced ? synced.status : 'NOT SYNCED';
                                        const isExpanded = expandedTemplate === key;

                                        return (
                                            <div key={key} className="rounded-xl border border-border bg-surface-1 overflow-hidden transition-all duration-300">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedTemplate(isExpanded ? null : key)}
                                                    className="w-full flex items-center justify-between p-3.5 hover:bg-surface-2 transition-colors text-left"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${status === 'APPROVED' ? 'bg-emerald-400' : status === 'NOT SYNCED' ? 'bg-zinc-500' : 'bg-amber-400'}`} />
                                                        <div>
                                                            <span className="text-xs font-bold text-foreground block">{info.title}</span>
                                                            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{info.category}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : status === 'NOT SYNCED' ? 'bg-zinc-500/10 text-zinc-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                            {status}
                                                        </span>
                                                        <ChevronDown className={clsx("w-4 h-4 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")} />
                                                    </div>
                                                </button>

                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        className="border-t border-border p-4 bg-surface-2/40 space-y-4"
                                                    >
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Trigger Event</p>
                                                            <p className="text-xs text-foreground font-medium leading-relaxed">{info.trigger}</p>
                                                        </div>

                                                        <div className="space-y-2.5">
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp Preview</p>
                                                            
                                                            {/* Mock WhatsApp Chat Bubble */}
                                                            <div className="p-4 rounded-xl bg-[#0b141a] border border-[#202c33] max-w-sm relative">
                                                                {/* Speech Bubble Header */}
                                                                {info.title === 'Promotional Broadcast' && (
                                                                    <div className="pb-1.5 border-b border-[#202c33] mb-2">
                                                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Exclusive Offer</span>
                                                                    </div>
                                                                )}
                                                                {/* Speech Bubble Body */}
                                                                <div className="text-[11px] text-[#e9edef] whitespace-pre-wrap leading-relaxed font-sans">
                                                                    {info.preview}
                                                                </div>
                                                                {/* Double checkmark & Timestamp */}
                                                                <div className="flex items-center justify-end gap-1 mt-2 text-[9px] text-[#8696a0]">
                                                                    <span>12:00 PM</span>
                                                                    <svg className="w-3.5 h-3.5 text-sky-400 fill-current" viewBox="0 0 24 24">
                                                                        <path d="M0 12.116l2.053-1.897 5.713 5.56 12.044-12.219 2.19 1.737-14.234 14.703z" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {loadingTemplates && waTemplates.length === 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="text-[10px]">Loading template statuses...</span>
                        </div>
                    )}

                    {/* Flow Status */}
                    <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-surface-1 border border-border">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                            <span className="text-[10px] font-medium text-foreground">Native Booking Flow</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider ml-auto text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded border border-purple-500/20">
                                Coming Soon
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                            Native booking forms inside WhatsApp require a warmed-up phone number with higher messaging volume to get Meta approval. This feature will automatically unlock as you send more messages!
                        </p>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Click <strong>Sync to Meta</strong> to register all message templates (for marketing blasts & notifications). Flow sync is currently disabled during your number warmup phase.
                    </p>
                </div>
            </motion.div>

            {/* Marketing & Campaigns */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6"
            >
                <div className="flex items-center gap-3 pb-5 border-b border-border">
                    <div className="p-2.5 rounded-xl bg-purple-500/10">
                        <Megaphone className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Marketing Campaigns</h2>
                        <p className="text-[11px] text-muted-foreground">Send promotional blasts and broadcasts to your WhatsApp contacts</p>
                    </div>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row items-center justify-between p-5 bg-surface-2 rounded-2xl border border-border gap-4">
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Select a target audience from your orders and appointments list, draft a campaign message, and send bulk promotional updates directly via WhatsApp.
                        </p>
                    </div>
                    <Link
                        href="/dashboard/marketing"
                        className="w-full sm:w-auto px-6 py-2.5 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm shrink-0"
                    >
                        <Megaphone className="w-4 h-4" />
                        Launch Campaign
                    </Link>
                </div>
            </motion.div>

            {/* Manager Alerts */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 relative overflow-x-clip"
            >
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                    <div className="p-2.5 rounded-xl bg-amber-500/10">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
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
                            value={emergencyWhatsApp}
                            onChange={(e) => setEmergencyWhatsApp(e.target.value)}
                            className="input-premium w-full !pl-10"
                            placeholder="+1 234 567 8900"
                            disabled={!isPro}
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground ml-1">Ghost Agent texts this number if a customer says &quot;Manager&quot;, &quot;Scam&quot;, or &quot;Bot&quot;.</p>
                </div>

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

            {/* Advanced Configuration */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6"
            >
                <button
                    type="button"
                    onClick={() => setShowAdvancedWA(prev => !prev)}
                    className="w-full flex items-center justify-between text-sm font-semibold text-foreground"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-zinc-500/10">
                            <ChevronDown className={clsx("w-5 h-5 text-zinc-400 transition-transform", showAdvancedWA && "rotate-180")} />
                        </div>
                        <div className="text-left">
                            <h2 className="text-sm font-semibold text-foreground">Advanced Configuration</h2>
                            <p className="text-[11px] text-muted-foreground">Manual WhatsApp Business API credentials</p>
                        </div>
                    </div>
                </button>

                {showAdvancedWA && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-6 p-5 bg-surface-2 rounded-2xl border border-border space-y-4"
                    >
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Manual WhatsApp Credentials</h4>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Phone Number ID</label>
                                <input
                                    type="text"
                                    value={waPhoneNumberId}
                                    onChange={(e) => setWaPhoneNumberId(e.target.value)}
                                    className="input-premium w-full"
                                    placeholder="e.g. 109876543210987"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Access Token</label>
                                <input
                                    type="password"
                                    value={waAccessToken}
                                    onChange={(e) => setWaAccessToken(e.target.value)}
                                    className="input-premium w-full font-mono"
                                    placeholder="EAABw..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Business Account ID</label>
                                <input
                                    type="text"
                                    value={waBusinessAccountId}
                                    onChange={(e) => setWaBusinessAccountId(e.target.value)}
                                    className="input-premium w-full"
                                    placeholder="e.g. 987654321098765"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </motion.div>

            {/* Save Button */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_25px_rgba(139,92,246,0.2)] disabled:opacity-50"
                >
                    {saving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                    ) : (
                        <><Check className="w-4 h-4" /> Save WhatsApp Settings</>
                    )}
                </button>
            </motion.div>
        </div>
    );
}
