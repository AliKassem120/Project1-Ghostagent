'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Bot, DollarSign, Bell, Globe, Sparkles, Upload, Building2, Loader2, Check, FileSpreadsheet, X, Instagram, Phone, Trash2, Plus, Lock, Wifi } from 'lucide-react';
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

export default function SettingsPage() {
    const supabase = createClient();
    const toast = useToast();
    const { activeWorkspaceId, planTier, isLoading: wsLoading, removeWorkspace, workspaces } = useWorkspace();
    const isPro = planTier === 'pro' || planTier === 'empire';
    const isEmpire = planTier === 'empire';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [instagramStatus, setInstagramStatus] = useState<{ connected: boolean; accounts: any[] }>({ connected: false, accounts: [] });
    const [uploadedFile, setUploadedFile] = useState<{ name: string; rowCount: number } | null>(null);
    const [disconnectModal, setDisconnectModal] = useState<{ open: boolean; accountId: string | null }>({ open: false, accountId: null });
    const [deleteWsModal, setDeleteWsModal] = useState(false);
    const [deletingWs, setDeletingWs] = useState(false);

    // Initial state
    const [settings, setSettings] = useState({
        businessName: '',
        tone: 'Professional',
        useEmojis: true,
        maxDiscount: 20,
        minOrderForDiscount: 50,
        emergencyWhatsApp: '',
        language: 'Auto-Detect',
        useLocalSlang: false,
        systemPrompt: '',
        whatsappTemplate: '',
        storeLocation: '',
        contactInfo: '',
        shippingRules: '',
        businessType: 'ecommerce' as BusinessCategory,
        // WhatsApp Business (Empire)
        waBusinessAccountId: '',
        waPhoneNumberId: '',
        waAccessToken: '',
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

    useEffect(() => {
        // If workspace context is still loading, wait
        if (wsLoading) return;

        const fetchSettings = async () => {
            setLoading(true);
            try {
                let query = supabase.from('bot_settings').select('*');

                if (activeWorkspaceId) {
                    // Workspace-scoped fetch (new mode — after SQL migration)
                    query = query.eq('id', activeWorkspaceId);
                } else {
                    // Fallback: fetch by user_id (existing users before migration)
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) { setLoading(false); return; }
                    query = query.eq('user_id', user.id);
                }

                const { data } = await query.single();

                if (data) {
                    setSettings({
                        businessName: data.business_name || '',
                        tone: data.tone || 'Professional',
                        useEmojis: data.use_emojis ?? true,
                        maxDiscount: data.max_discount || 20,
                        minOrderForDiscount: data.min_order_for_discount || 50,
                        emergencyWhatsApp: data.emergency_whatsapp || '',
                        language: data.language || 'Auto-Detect',
                        useLocalSlang: data.use_local_slang ?? false,
                        systemPrompt: data.system_instructions || '',
                        whatsappTemplate: data.whatsapp_template || '',
                        storeLocation: data.store_location || '',
                        contactInfo: data.contact_info || '',
                        shippingRules: data.shipping_rules || '',
                        businessType: (data.business_type || 'ecommerce') as BusinessCategory,
                        waBusinessAccountId: data.whatsapp_business_account_id || '',
                        waPhoneNumberId: data.whatsapp_phone_number_id || '',
                        waAccessToken: data.whatsapp_access_token || '',
                    });
                }
            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [activeWorkspaceId, wsLoading]);

    const checkInstagramStatus = useCallback(async () => {
        if (!activeWorkspaceId) return;
        try {
            const res = await fetch(`/api/instagram/status?workspace_id=${activeWorkspaceId}`);
            const data = await res.json();
            setInstagramStatus(data);
        } catch (e) {
            console.error('Failed to check Instagram status:', e);
        }
    }, [activeWorkspaceId]);

    // Automatically check status when activeWorkspaceId changes
    useEffect(() => {
        checkInstagramStatus();
    }, [checkInstagramStatus]);

    // CSV Upload Handler
    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            toast.error('Please upload a CSV file');
            return;
        }

        setUploading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please log in to upload a catalog');
                setUploading(false);
                return;
            }

            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const rows = results.data as Record<string, string>[];

                    if (rows.length === 0) {
                        toast.error('CSV file is empty');
                        setUploading(false);
                        return;
                    }

                    const jsonContent = JSON.stringify(rows, null, 2);

                    const { error } = await supabase
                        .from('business_knowledge')
                        .upsert({
                            user_id: user.id,
                            file_name: file.name,
                            content: jsonContent,
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'user_id'
                        });

                    if (error) {
                        console.error('Upload error:', error);
                        toast.error('Failed to save catalog. Please try again.');
                    } else {
                        setUploadedFile({ name: file.name, rowCount: rows.length });
                        toast.success('Catalog Uploaded', { description: `"${file.name}" with ${rows.length} products loaded.` });
                    }

                    setUploading(false);
                },
                error: (parseError) => {
                    console.error('CSV parse error:', parseError);
                    toast.error('Failed to parse CSV file');
                    setUploading(false);
                }
            });
        } catch (err) {
            console.error('Upload error:', err);
            toast.error('Upload failed');
            setUploading(false);
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveCatalog = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('business_knowledge')
            .delete()
            .eq('user_id', user.id);

        if (!error) {
            setUploadedFile(null);
            toast.info('Product catalog removed');
        }
    };

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

        console.log("Redirecting to Meta:", authUrl);
        window.location.href = authUrl;
    };

    const handleDisconnect = async (accountId: string) => {
        try {
            // Optimistic update
            setInstagramStatus(prev => ({
                ...prev,
                accounts: prev.accounts.filter(a => a.id !== accountId)
            }));

            await fetch('/api/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId })
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
        if (params.get('success') === 'true') {
            toast.success('Instagram Connected', { description: 'Your account is now linked to Ghost Agent.' });
            checkInstagramStatus();
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    useEffect(() => {
        checkInstagramStatus();
        // Poll status every 5 seconds to catch connection updates without refresh
        const interval = setInterval(checkInstagramStatus, 5000);
        return () => clearInterval(interval);
    }, []);
    const handleDeleteWorkspace = async () => {
        if (!activeWorkspaceId) return;
        setDeletingWs(true);
        try {
            const { error } = await supabase.from('bot_settings').delete().eq('id', activeWorkspaceId);
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
            if (!activeWorkspaceId) {
                toast.error('No active workspace selected.');
                setSaving(false);
                return;
            }

            const { success } = await updateWorkspaceSettingsAction(activeWorkspaceId, settings, isEmpire);

            if (success) {
                console.log('✅ Settings Saved Successfully!');
                toast.success('Settings Saved', { description: 'Your Ghost Agent configuration has been updated.' });
                setSuccess(true);
                setTimeout(() => setSuccess(false), 2000);
            }
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

            {/* Business Identity */}
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
                </div>
            </motion.div>

            {/* AI Persona */}
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
                </div>
            </motion.div>

            {/* Manager Alerts */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 relative overflow-hidden">
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

            {/* WhatsApp Business (Omnichannel — Empire only) */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10">
                        <Wifi className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">WhatsApp Business</h2>
                        <p className="text-[11px] text-muted-foreground">Omnichannel AI — reply to WhatsApp customers</p>
                    </div>
                    <span className={clsx(
                        'ml-auto flex items-center gap-1 text-[10px] font-bold rounded-full px-2.5 py-1 border',
                        isEmpire
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-muted-foreground bg-surface-2 border-border'
                    )}>
                        {!isEmpire && <Lock className="w-3 h-3" />}
                        Empire
                    </span>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">WA Business Account ID</label>
                        <input type="text" value={settings.waBusinessAccountId}
                            onChange={e => setSettings({ ...settings, waBusinessAccountId: e.target.value })}
                            className="input-premium w-full" placeholder="123456789012345" disabled={!isEmpire} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Phone Number ID</label>
                        <input type="text" value={settings.waPhoneNumberId}
                            onChange={e => setSettings({ ...settings, waPhoneNumberId: e.target.value })}
                            className="input-premium w-full" placeholder="Phone Number ID from Meta dashboard" disabled={!isEmpire} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Access Token</label>
                        <input type="password" value={settings.waAccessToken}
                            onChange={e => setSettings({ ...settings, waAccessToken: e.target.value })}
                            className="input-premium w-full" placeholder="Permanent system user token" disabled={!isEmpire} />
                        <p className="text-[10px] text-muted-foreground ml-1">Stored encrypted. Only used to send WhatsApp replies from your number.</p>
                    </div>
                </div>

                {/* Paywall overlay for non-Empire */}
                {!isEmpire && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-3 z-10">
                        <div className="p-3 rounded-full bg-surface-2 border border-border">
                            <Lock className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="text-center px-6">
                            <p className="text-sm font-bold text-muted-foreground">Empire Feature</p>
                            <p className="text-[11px] text-muted-foreground mt-1">Connect a WhatsApp Business number and let Ghost Agent reply to customers on WhatsApp too.</p>
                        </div>
                        <a href="/dashboard/billing" className="text-[11px] font-bold text-primary hover:underline">Upgrade to Empire →</a>
                    </div>
                )}
            </motion.div>

            {/* Sales Rules */}

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

            {/* Integrations */}
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
                </div>
            </motion.div>

            {/* Language */}
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
                                ]}
                            />
                            <p className="text-[10px] text-muted-foreground ml-1 mt-2">Auto-Detect is recommended. Ghost Agent mirrors any language the customer uses.</p>
                        </div>

                        <div className="space-y-1.5 pt-2">
                            <label className="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest ml-1">Advanced Personality</label>
                            <div className="flex items-center justify-between p-3.5 bg-amber-500/[0.05] rounded-xl border border-amber-500/10 hover:bg-amber-500/10 transition-all cursor-pointer group"
                                onClick={() => setSettings({ ...settings, useLocalSlang: !settings.useLocalSlang })}>
                                <div>
                                    <span className="block text-sm text-amber-600 dark:text-amber-500/80 group-hover:text-amber-500 transition-colors">Use Local Slang</span>
                                    <span className="block text-[10px] text-amber-600/70 dark:text-amber-500/40 mt-0.5">&quot;Walla&quot;, &quot;Yalla&quot;, or &quot;Kifak&quot;</span>
                                </div>
                                <div className={clsx(
                                    "relative w-11 rounded-full transition-colors duration-300",
                                    settings.useLocalSlang ? "bg-amber-500" : "bg-surface-2"
                                )} style={{ height: '24px' }}>
                                    <motion.div
                                        className="absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white shadow-sm"
                                        animate={{ x: settings.useLocalSlang ? 22 : 2 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="hidden md:block">
                        <label className="text-[10px] font-bold text-primary/60 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Live Translation Playground</label>
                        <div className="rounded-xl border border-border bg-gradient-to-b from-surface-1 to-surface-0 min-h-[200px] flex flex-col relative overflow-hidden shadow-sm">
                            {/* App Header Mockup */}
                            <div className="h-10 border-b border-border bg-surface-2 flex items-center justify-between px-3 shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                        <GhostLogo className="w-3 h-3 text-primary" />
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
                                                {settings.useLocalSlang ? "أهلا يا غالي! إي موجود، من عيوني." : "أهلا بك! نعم، هذا متوفر لدينا."}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Agent Training */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border">
                    <div className="p-2.5 rounded-xl bg-violet-500/10">
                        <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Agent Training</h2>
                        <p className="text-[11px] text-muted-foreground">Knowledge base and product data</p>
                    </div>
                </div>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Knowledge Base (System Instructions)</label>

                        {/* Generate with AI */}
                        <div className="bg-primary/[0.03] border border-primary/[0.08] rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Generate with AI</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mb-3">Describe your business briefly and AI will write detailed instructions.</p>
                            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                <input
                                    type="text"
                                    value={aiPromptInput}
                                    onChange={(e) => setAiPromptInput(e.target.value)}
                                    className="input-premium flex-1 w-full text-sm"
                                    placeholder="e.g. We sell handmade candles, free shipping over $50..."
                                    disabled={generating}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleGenerateInstructions();
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleGenerateInstructions}
                                    disabled={generating || !aiPromptInput.trim()}
                                    className={clsx(
                                        "w-full sm:w-auto px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all press shrink-0",
                                        generating
                                            ? "bg-primary/10 text-primary/40"
                                            : "bg-primary text-black hover:scale-[1.02]"
                                    )}
                                >
                                    {generating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                    {generating ? 'Writing...' : 'Generate AI System'}
                                </button>
                            </div>
                        </div>

                        <textarea
                            className="input-premium w-full h-52 resize-none text-sm"
                            value={settings.systemPrompt}
                            onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                            placeholder="Example: We are an eco-friendly streetwear brand. Our shipping takes 3-5 days. Return policy is 30 days..."
                        />
                        <p className="text-[10px] text-muted-foreground ml-1">Most important field — tell the bot everything about your business.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Product Catalog (CSV)</label>
                        {uploadedFile ? (
                            <div className="border border-emerald-500/15 bg-emerald-500/[0.04] rounded-xl p-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/10">
                                        <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm text-emerald-400">{uploadedFile.name}</div>
                                        <div className="text-[10px] text-muted-foreground">{uploadedFile.rowCount} products loaded</div>
                                    </div>
                                </div>
                                <button onClick={handleRemoveCatalog} className="p-2 rounded-lg bg-red-500/5 text-red-400/50 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={clsx(
                                    "border border-dashed rounded-xl p-10 text-center transition-all cursor-pointer group",
                                    uploading ? "border-primary/30 bg-primary/[0.04]" : "border-border hover:border-border-strong hover:bg-surface-2"
                                )}
                            >
                                {uploading ? (
                                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-primary animate-spin" />
                                ) : (
                                    <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground group-hover:text-primary/50 transition-colors" />
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".csv"
                                    onChange={handleCsvUpload}
                                    disabled={uploading}
                                />
                                <div className="text-muted-foreground mb-1 font-medium text-sm">
                                    {uploading ? 'Processing...' : 'Click to upload CSV'}
                                </div>
                                <div className="text-[10px] text-muted-foreground">Required: name, price, description, stock</div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Danger Zone */}
            {workspaces.length > 1 && (
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
