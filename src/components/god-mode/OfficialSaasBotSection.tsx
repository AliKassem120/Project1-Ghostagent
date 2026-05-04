'use client';

import React, { useState, useEffect } from 'react';
import { 
    Bot, Instagram, MessageSquare, Database, Plus, ExternalLink, 
    Loader2, Check, X, RefreshCw, AlertTriangle, Wifi, WifiOff,
    BookOpen, DollarSign, HelpCircle, Settings
} from 'lucide-react';
import { fetchGodMode } from '@/lib/god-mode/api-client';

interface WorkspaceInfo {
    id: string;
    user_id: string;
    business_name: string;
    business_type: string;
    is_internal: boolean;
    workspace_role: string;
    visibility: string;
    tone: string;
    language: string;
    autopilot: boolean;
}

interface InstagramInfo {
    connected: boolean;
    account_id?: string;
    username?: string;
    connected_at?: string;
}

interface BotStatus {
    exists: boolean;
    workspace?: WorkspaceInfo;
    instagram?: InstagramInfo;
    whatsapp?: { connected: boolean; phone_number?: string; connected_at?: string };
    knowledgeCount?: number;
    isPaused?: boolean;
}

export default function OfficialSaasBotSection() {
    const [status, setStatus] = useState<BotStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { loadStatus(); }, []);

    const loadStatus = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetchGodMode('official-saas-bot');
            if (res.success) {
                setStatus(res);
            } else {
                setError(res.error || 'Failed to load');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const createWorkspace = async () => {
        setCreating(true);
        setError('');
        try {
            const res = await fetchGodMode('official-saas-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            if (res.success) {
                await loadStatus();
            } else {
                setError(res.error || 'Failed to create');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const getInstagramConnectUrl = () => {
        if (!status?.workspace) return '#';
        const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || '';
        const redirectUri = `${window.location.origin}/api/auth/callback/instagram`;
        const state = status.workspace.id;
        return `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments&state=${state}`;
    };

    const disconnectInstagram = async () => {
        if (!status?.workspace || !status?.instagram?.account_id) return;
        if (!confirm('Disconnect Instagram from official workspace?')) return;
        try {
            const res = await fetch('/api/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    accountId: status.instagram.account_id,
                    workspaceId: status.workspace.id,
                }),
            });
            if ((await res.json()).success) await loadStatus();
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading Official SaaS Bot...
            </div>
        );
    }

    // ── NOT YET CREATED ─────────────────────────────────────────
    if (!status?.exists) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Bot className="w-6 h-6 text-purple-500" />
                        Official SaaS Bot
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create the internal GhostAgent workspace to sell and support the platform via Instagram DMs.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">
                        {error}
                    </div>
                )}

                <div className="bg-surface-1 border border-border rounded-2xl p-8 text-center max-w-lg mx-auto">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Bot className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">No Official Workspace Found</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                        Create an internal <code className="bg-surface-2 px-1.5 py-0.5 rounded text-xs">saas_support</code> workspace
                        to power the official GhostAgent bot. It will be hidden from normal users.
                    </p>
                    <div className="bg-surface-2 rounded-xl p-4 text-left text-xs font-mono space-y-1 mb-6 text-muted-foreground">
                        <div>business_name: <span className="text-foreground">"Ghost Agent Official"</span></div>
                        <div>business_type: <span className="text-purple-400">"saas_support"</span></div>
                        <div>is_internal: <span className="text-green-400">true</span></div>
                        <div>workspace_role: <span className="text-orange-400">"official_support"</span></div>
                        <div>visibility: <span className="text-yellow-400">"god_mode_only"</span></div>
                    </div>
                    <button
                        onClick={createWorkspace}
                        disabled={creating}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 flex items-center gap-2 mx-auto"
                    >
                        {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        Create Official Workspace
                    </button>
                </div>
            </div>
        );
    }

    // ── WORKSPACE EXISTS ─────────────────────────────────────────
    const ws = status.workspace!;
    const ig = status.instagram!;
    const wa = status.whatsapp;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Bot className="w-6 h-6 text-purple-500" />
                        Official SaaS Bot
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Internal workspace for the official GhostAgent support bot.</p>
                </div>
                <button onClick={loadStatus} className="p-2 bg-surface-1 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-all">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">
                    {error}
                </div>
            )}

            {/* Paused Banner */}
            {status.isPaused && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-none" />
                    <div>
                        <div className="font-bold text-red-400">Bot is Paused</div>
                        <p className="text-xs text-red-400/70">Global or workspace kill switch is active. The bot won't reply to customers.</p>
                    </div>
                </div>
            )}

            {/* Workspace Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Workspace Card */}
                <div className="bg-surface-1 border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Settings className="w-4 h-4 text-purple-400" />
                        <span className="font-bold text-sm">Workspace</span>
                    </div>
                    <InfoRow label="ID" value={ws.id} mono />
                    <InfoRow label="Type" value={ws.business_type} badge="purple" />
                    <InfoRow label="Role" value={ws.workspace_role} badge="orange" />
                    <InfoRow label="Visibility" value={ws.visibility} badge="yellow" />
                    <InfoRow label="Internal" value={ws.is_internal ? 'Yes' : 'No'} badge={ws.is_internal ? 'green' : 'red'} />
                    <InfoRow label="Tone" value={ws.tone} />
                    <InfoRow label="Language" value={ws.language} />
                </div>

                {/* Instagram Card */}
                <div className="bg-surface-1 border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Instagram className="w-4 h-4 text-pink-400" />
                        <span className="font-bold text-sm">Instagram</span>
                        {ig.connected
                            ? <span className="ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400"><Wifi className="w-3 h-3" /> Connected</span>
                            : <span className="ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400"><WifiOff className="w-3 h-3" /> Disconnected</span>
                        }
                    </div>
                    {ig.connected ? (
                        <>
                            <InfoRow label="Username" value={`@${ig.username}`} />
                            <InfoRow label="Account ID" value={ig.account_id || '—'} mono />
                            <InfoRow label="Connected" value={ig.connected_at ? new Date(ig.connected_at).toLocaleDateString() : '—'} />
                            <button
                                onClick={disconnectInstagram}
                                className="w-full mt-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-all"
                            >
                                Disconnect
                            </button>
                        </>
                    ) : (
                        <div className="pt-2">
                            <p className="text-xs text-muted-foreground mb-3">Connect your official Instagram account to enable the SaaS bot.</p>
                            <a
                                href={getInstagramConnectUrl()}
                                className="block w-full text-center px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-bold rounded-xl transition-all text-sm shadow-lg"
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Instagram className="w-4 h-4" /> Connect Official Instagram
                                </span>
                            </a>
                        </div>
                    )}
                </div>

                {/* Knowledge & Status Card */}
                <div className="bg-surface-1 border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Database className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold text-sm">Knowledge Base</span>
                    </div>
                    <div className="text-center py-4">
                        <div className="text-4xl font-black text-indigo-400">{status.knowledgeCount || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Documents Loaded</p>
                    </div>
                    {wa && (
                        <div className="pt-2 border-t border-border">
                            <div className="flex items-center gap-2 text-xs mt-2">
                                <MessageSquare className="w-3.5 h-3.5 text-green-400" />
                                <span className="text-muted-foreground">WhatsApp:</span>
                                {wa.connected
                                    ? <span className="text-green-400 font-bold">{wa.phone_number}</span>
                                    : <span className="text-red-400">Not connected</span>
                                }
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-surface-1 border border-border rounded-xl p-5">
                <h3 className="font-bold text-sm mb-4">Quick Actions — Knowledge Manager</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <QuickAction icon={DollarSign} label="Add Pricing" color="green" wsId={ws.id} sourceType="pricing" />
                    <QuickAction icon={HelpCircle} label="Add FAQ" color="blue" wsId={ws.id} sourceType="faq" />
                    <QuickAction icon={BookOpen} label="Add Docs" color="purple" wsId={ws.id} sourceType="docs" />
                    <QuickAction icon={Settings} label="Add Setup Guide" color="orange" wsId={ws.id} sourceType="manual" />
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ───────────────────────────────────────────

function InfoRow({ label, value, mono, badge }: { label: string; value: string; mono?: boolean; badge?: string }) {
    const badgeColors: Record<string, string> = {
        purple: 'bg-purple-500/10 text-purple-400',
        orange: 'bg-orange-500/10 text-orange-400',
        yellow: 'bg-yellow-500/10 text-yellow-400',
        green: 'bg-green-500/10 text-green-400',
        red: 'bg-red-500/10 text-red-400',
        blue: 'bg-blue-500/10 text-blue-400',
    };

    return (
        <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">{label}</span>
            {badge ? (
                <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${badgeColors[badge] || ''}`}>{value}</span>
            ) : (
                <span className={`text-foreground ${mono ? 'font-mono text-[10px] max-w-[160px] truncate' : ''}`}>{value}</span>
            )}
        </div>
    );
}

function QuickAction({ icon: Icon, label, color, wsId, sourceType }: { icon: any; label: string; color: string; wsId: string; sourceType: string }) {
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    const colorMap: Record<string, string> = {
        green: 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20',
        blue: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20',
        purple: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20',
        orange: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/20',
    };

    const templates: Record<string, { title: string; content: string }> = {
        pricing: {
            title: 'GhostAgent Pricing',
            content: `GhostAgent Pricing:
- Free Trial: 7 days, full features
- Starter: $29/mo — 1 workspace, Instagram DMs
- Pro: $49/mo — 2 workspaces, Instagram + WhatsApp, priority support
- Business: $99/mo — 5 workspaces, all channels, custom AI training

All plans include: AI automation, order management, appointment booking, analytics dashboard.
Annual billing saves 20%.`,
        },
        faq: {
            title: 'GhostAgent FAQ',
            content: `Frequently Asked Questions:

Q: What is GhostAgent?
A: GhostAgent is an AI-powered customer service platform that automates Instagram DMs and WhatsApp messages for businesses.

Q: Does it support WhatsApp?
A: Yes! GhostAgent supports both Instagram DMs and WhatsApp Business.

Q: Can it take orders?
A: Yes, GhostAgent can handle full e-commerce order flows including product search, order placement, and tracking.

Q: Can it book appointments?
A: Yes, GhostAgent supports appointment-based businesses with slot checking, booking, and cancellation.

Q: Does it support Arabic/Arabizi?
A: Yes! GhostAgent auto-detects language and replies naturally in English, Arabic, Arabizi, French, and Spanish.

Q: How do I get started?
A: Sign up at ghostagent.ai, connect your Instagram, and the AI starts handling messages automatically.`,
        },
        docs: {
            title: 'GhostAgent Features',
            content: `GhostAgent Features:

1. AI Customer Service — Automated DM replies on Instagram and WhatsApp
2. E-commerce Support — Product search, order placement, order tracking, cancellations
3. Appointment Booking — Service listing, slot checking, booking, rescheduling
4. Multi-language — English, Arabic, Arabizi, French, Spanish auto-detection
5. Smart Handoff — Detects when a human is needed and pauses automation
6. Dashboard — Real-time analytics, conversation logs, order/appointment management
7. Kill Switch — Pause automation globally or per workspace instantly
8. God Mode — Internal admin panel for full system control
9. Comment Replies — Auto-reply to Instagram post comments
10. Customer Memory — Remembers returning customers' names, phones, addresses`,
        },
        manual: {
            title: 'GhostAgent Setup Guide',
            content: `How to Set Up GhostAgent:

Step 1: Create an account at ghostagent.ai
Step 2: Choose your business type (E-commerce or Appointments)
Step 3: Connect your Instagram Business account
Step 4: Configure AI settings (tone, language, business info)
Step 5: Add your products or services
Step 6: Test with a sample message
Step 7: Enable autopilot — your AI is live!

Optional:
- Connect WhatsApp Business
- Upload product catalog via CSV
- Set business hours
- Configure discount rules
- Add custom system instructions`,
        },
    };

    const handleClick = async () => {
        const template = templates[sourceType];
        if (!template) return;

        const title = prompt('Document title:', template.title);
        if (!title) return;

        const content = prompt('Content (you can edit later in Knowledge Manager):', template.content);
        if (!content) return;

        setSaving(true);
        try {
            const res = await fetch('/api/god-mode/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    workspace_id: wsId,
                    title,
                    content,
                    source_type: sourceType,
                    visibility: 'public',
                }),
            });
            if ((await res.json()).success) {
                setDone(true);
                setTimeout(() => setDone(false), 2000);
            }
        } catch { /* ignore */ } finally {
            setSaving(false);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-3 border rounded-xl text-sm font-bold transition-all ${colorMap[color] || ''}`}
        >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            {label}
        </button>
    );
}
