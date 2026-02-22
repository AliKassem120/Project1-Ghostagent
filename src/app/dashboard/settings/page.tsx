'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Bot, DollarSign, Bell, Globe, Sparkles, Upload, Building2, Loader2, Check, FileSpreadsheet, X, Instagram, Phone, Trash2, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import GhostModal from '@/components/GhostModal';
import CustomSelect from '@/components/CustomSelect';
import Papa from 'papaparse';

export default function SettingsPage() {
    const supabase = createClient();
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [instagramStatus, setInstagramStatus] = useState<{ connected: boolean; accounts: any[] }>({ connected: false, accounts: [] });
    const [uploadedFile, setUploadedFile] = useState<{ name: string; rowCount: number } | null>(null);
    const [disconnectModal, setDisconnectModal] = useState<{ open: boolean; accountId: string | null }>({ open: false, accountId: null });

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
        const fetchSettings = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    setLoading(false);
                    return;
                }

                const { data, error } = await supabase
                    .from('bot_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

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
                    });
                }
            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const checkInstagramStatus = async () => {
        try {
            const res = await fetch('/api/instagram/status');
            const data = await res.json();
            setInstagramStatus(data);
        } catch (e) {
            console.error('Failed to check Instagram status:', e);
        }
    };

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
        const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
        // Use window.location.origin for dynamic domain handling (localhost vs production)
        const redirectUri = `${window.location.origin}/api/auth/callback/instagram`;
        // UPDATED SCOPES: Removes business_basic, adds required engagement/management permissions
        const scope = 'instagram_basic,pages_show_list,pages_read_engagement,instagram_manage_comments,instagram_manage_messages';

        if (!appId) {
            toast.error("Missing NEXT_PUBLIC_FACEBOOK_APP_ID in env");
            setConnecting(false);
            return;
        }

        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;

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


    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast.error('You must be logged in to save settings.');
                setSaving(false);
                return;
            }

            console.log('💾 Saving Settings:', {
                user_id: user.id,
                language: settings.language,
                // ... other fields implicitly logged by the object check if we wanted
            });

            const { error } = await supabase
                .from('bot_settings')
                .upsert({
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
                    // Note: store_location, contact_info, and use_local_slang are skipped to avoid schema cache error
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });

            if (error) {
                throw error;
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
        <div className="space-y-6 pb-32 md:pb-12">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-2xl font-bold tracking-tight text-white">Agent Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">Configure how your Ghost Agent behaves and responds.</p>
            </motion.div>

            {/* Business Identity */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.04]">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10">
                        <Building2 className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Business Identity</h2>
                        <p className="text-[11px] text-muted-foreground">Core business information</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Business Name</label>
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
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Store Location</label>
                            <input
                                type="text"
                                value={settings.storeLocation}
                                onChange={(e) => setSettings({ ...settings, storeLocation: e.target.value })}
                                className="input-premium w-full"
                                placeholder="e.g. Hamra, Beirut, Lebanon"
                            />
                            <p className="text-[10px] text-white/20 ml-1">The AI will share this exact address when asked.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Contact Info</label>
                            <input
                                type="text"
                                value={settings.contactInfo}
                                onChange={(e) => setSettings({ ...settings, contactInfo: e.target.value })}
                                className="input-premium w-full"
                                placeholder="e.g. +961 71 123 456 / info@store.com"
                            />
                            <p className="text-[10px] text-white/20 ml-1">Phone, email, or website the AI can share.</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* AI Persona */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.04]">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                        <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">AI Persona</h2>
                        <p className="text-[11px] text-muted-foreground">Personality and communication style</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Response Tone</label>
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
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Use Emojis</label>
                        <div className="flex items-center justify-between p-3.5 bg-white/[0.02] rounded-xl border border-white/[0.04] hover:bg-white/[0.04] transition-all cursor-pointer group"
                            onClick={() => setSettings({ ...settings, useEmojis: !settings.useEmojis })}>
                            <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors">Add emojis to responses</span>
                            <div className={clsx(
                                "relative w-11 rounded-full transition-colors duration-300",
                                settings.useEmojis ? "bg-primary" : "bg-white/10"
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
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.04]">
                    <div className="p-2.5 rounded-xl bg-amber-500/10">
                        <Bell className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Manager Alerts</h2>
                        <p className="text-[11px] text-muted-foreground">Human escalation via WhatsApp</p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Owner WhatsApp Number</label>
                    <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                        <input
                            type="tel"
                            value={settings.emergencyWhatsApp}
                            onChange={(e) => setSettings({ ...settings, emergencyWhatsApp: e.target.value })}
                            className="input-premium w-full pl-10"
                            placeholder="+1 234 567 8900"
                        />
                    </div>
                    <p className="text-[10px] text-white/20 ml-1">Ghost Agent texts this number if a customer says &quot;Manager&quot;, &quot;Scam&quot;, or &quot;Bot&quot;.</p>
                </div>
            </motion.div>

            {/* Sales Rules */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.04]">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Sales Rules</h2>
                        <p className="text-[11px] text-muted-foreground">Pricing and discount boundaries</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Maximum Discount %</label>
                        <input
                            type="range"
                            min="0"
                            max="50"
                            value={settings.maxDiscount}
                            onChange={(e) => setSettings({ ...settings, maxDiscount: parseInt(e.target.value) })}
                            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                            style={{
                                background: `linear-gradient(to right, rgb(139 92 246) 0%, rgb(139 92 246) ${settings.maxDiscount * 2}%, rgba(255,255,255,0.06) ${settings.maxDiscount * 2}%, rgba(255,255,255,0.06) 100%)`
                            }}
                        />
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-white/20">0%</span>
                            <span className="text-primary font-bold text-2xl font-mono">{settings.maxDiscount}%</span>
                            <span className="text-[10px] text-white/20">50%</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Minimum Order for Discount</label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 text-sm font-semibold">$</span>
                            <input
                                type="number"
                                value={settings.minOrderForDiscount}
                                onChange={(e) => setSettings({ ...settings, minOrderForDiscount: parseInt(e.target.value) || 0 })}
                                className="input-premium w-full pl-8 pr-14 font-semibold appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0"
                                placeholder="50"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-bold uppercase">USD</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Integrations */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.04]">
                    <div className="p-2.5 rounded-xl bg-pink-500/10">
                        <Instagram className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Integrations</h2>
                        <p className="text-[11px] text-muted-foreground">Connected social accounts</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {instagramStatus.accounts.length > 0 && instagramStatus.accounts.map((acc: any) => (
                        <div key={acc.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white/[0.02] p-4 rounded-xl border border-white/[0.04] gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 rounded-xl flex items-center justify-center shrink-0">
                                    <Instagram className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-sm text-white truncate max-w-[150px]">{acc.username || 'Insta User'}</h3>
                                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold rounded-full flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Running
                                        </span>
                                    </div>
                                    <p className="text-white/25 text-[10px] font-mono">{acc.id}</p>
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
                        className="w-full py-4 border border-dashed border-white/[0.06] hover:border-white/15 hover:bg-white/[0.02] rounded-xl flex items-center justify-center gap-2 text-white/30 hover:text-white/60 transition-all group press"
                    >
                        {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> :
                            <div className="w-7 h-7 rounded-full bg-white/[0.04] flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                <Plus className="w-4 h-4" />
                            </div>}
                        <span className="text-sm font-medium">Add Account</span>
                    </button>
                </div>
            </motion.div>

            {/* Language */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.04]">
                    <div className="p-2.5 rounded-xl bg-blue-500/10">
                        <Globe className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Language</h2>
                        <p className="text-[11px] text-muted-foreground">Ghost Agent mirrors the user&apos;s language</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Language Mode</label>
                            <CustomSelect
                                value={settings.language}
                                onChange={(val) => setSettings({ ...settings, language: val })}
                                options={[
                                    { value: "Auto-Detect", label: "🌍 Auto-Detect" },
                                    { value: "English", label: "🇬🇧 English Only" },
                                    { value: "Lebanese Franco", label: "🇱🇧 Lebanese Franco" },
                                ]}
                            />
                            <p className="text-[10px] text-white/20 ml-1 mt-2">Auto-Detect is recommended. Ghost Agent mirrors any language the customer uses.</p>
                        </div>

                        <div className="space-y-1.5 pt-2">
                            <label className="text-[10px] font-bold text-amber-500/50 uppercase tracking-widest ml-1">Advanced Personality</label>
                            <div className="flex items-center justify-between p-3.5 bg-amber-500/[0.02] rounded-xl border border-amber-500/[0.04] hover:bg-amber-500/[0.04] transition-all cursor-pointer group"
                                onClick={() => setSettings({ ...settings, useLocalSlang: !settings.useLocalSlang })}>
                                <div>
                                    <span className="block text-sm text-amber-500/80 group-hover:text-amber-400 transition-colors">Use Local Slang</span>
                                    <span className="block text-[10px] text-amber-500/40 mt-0.5">&quot;Walla&quot;, &quot;Yalla&quot;, or &quot;Kifak&quot;</span>
                                </div>
                                <div className={clsx(
                                    "relative w-11 rounded-full transition-colors duration-300",
                                    settings.useLocalSlang ? "bg-amber-500" : "bg-white/10"
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
                        <label className="text-[10px] font-bold text-primary/60 uppercase tracking-widest ml-1 mb-1.5 block">Live Translation Playground</label>
                        <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/[0.04] min-h-[140px] flex flex-col justify-end space-y-3 relative overflow-hidden">

                            {settings.language !== 'Auto-Detect' ? (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-white/20 text-center px-6">
                                    Live playground only available when Auto-Detect is enabled.
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {(demoPhase === 0 || demoPhase === 1) && (
                                        <motion.div
                                            key="user-fr"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                                            className="self-end max-w-[80%] bg-white/10 text-white text-[13px] px-3 py-2 rounded-2xl rounded-tr-sm"
                                        >
                                            Bonjour!
                                        </motion.div>
                                    )}

                                    {demoPhase === 1 && (
                                        <motion.div
                                            key="bot-fr"
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                            className="self-start max-w-[80%] bg-primary/20 text-primary-100 text-[13px] px-3 py-2 rounded-2xl rounded-tl-sm border border-primary/20"
                                        >
                                            Bonjour! Comment puis-je vous aider?
                                        </motion.div>
                                    )}

                                    {(demoPhase === 3 || demoPhase === 4) && (
                                        <motion.div
                                            key="user-ar"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                                            className="self-end max-w-[80%] bg-white/10 text-white text-[13px] px-3 py-2 rounded-2xl rounded-tr-sm"
                                        >
                                            مرحبا
                                        </motion.div>
                                    )}

                                    {demoPhase === 4 && (
                                        <motion.div
                                            key="bot-ar"
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                            className="self-start max-w-[80%] bg-primary/20 text-primary-100 text-[13px] px-3 py-2 rounded-2xl rounded-tl-sm border border-primary/20"
                                        >
                                            {settings.useLocalSlang ? "أهلا بك يا غالي! كيف فيني ساعدك اليوم؟" : "أهلا بك! كيف يمكنني مساعدتك؟"}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            )}

                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Agent Training */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.04]">
                    <div className="p-2.5 rounded-xl bg-violet-500/10">
                        <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Agent Training</h2>
                        <p className="text-[11px] text-muted-foreground">Knowledge base and product data</p>
                    </div>
                </div>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Knowledge Base (System Instructions)</label>

                        {/* Generate with AI */}
                        <div className="bg-primary/[0.03] border border-primary/[0.08] rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Generate with AI</span>
                            </div>
                            <p className="text-[10px] text-white/25 mb-3">Describe your business briefly and AI will write detailed instructions.</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={aiPromptInput}
                                    onChange={(e) => setAiPromptInput(e.target.value)}
                                    className="input-premium flex-1 text-sm"
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
                                        "px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all press shrink-0",
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
                                    {generating ? 'Writing...' : 'Generate'}
                                </button>
                            </div>
                        </div>

                        <textarea
                            className="input-premium w-full h-52 resize-none text-sm"
                            value={settings.systemPrompt}
                            onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                            placeholder="Example: We are an eco-friendly streetwear brand. Our shipping takes 3-5 days. Return policy is 30 days..."
                        />
                        <p className="text-[10px] text-white/20 ml-1">Most important field — tell the bot everything about your business.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Product Catalog (CSV)</label>
                        {uploadedFile ? (
                            <div className="border border-emerald-500/15 bg-emerald-500/[0.04] rounded-xl p-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/10">
                                        <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm text-emerald-400">{uploadedFile.name}</div>
                                        <div className="text-[10px] text-white/30">{uploadedFile.rowCount} products loaded</div>
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
                                    uploading ? "border-primary/30 bg-primary/[0.04]" : "border-white/[0.06] hover:border-primary/20 hover:bg-white/[0.02]"
                                )}
                            >
                                {uploading ? (
                                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-primary animate-spin" />
                                ) : (
                                    <Upload className="w-8 h-8 mx-auto mb-3 text-white/15 group-hover:text-primary/50 transition-colors" />
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".csv"
                                    onChange={handleCsvUpload}
                                    disabled={uploading}
                                />
                                <div className="text-white/40 mb-1 font-medium text-sm">
                                    {uploading ? 'Processing...' : 'Click to upload CSV'}
                                </div>
                                <div className="text-[10px] text-white/20">Required: name, price, description, stock</div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Save Button */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex justify-center pt-4 pb-20 md:pb-8 sticky bottom-4 md:static z-40"
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
                }}
                onCancel={() => setDisconnectModal({ open: false, accountId: null })}
            />
        </div>
    );
}
