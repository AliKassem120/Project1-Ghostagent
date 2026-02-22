'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Bot, DollarSign, Bell, Globe, Sparkles, Upload, Building2, Loader2, Check, FileSpreadsheet, X, Instagram, Phone, Trash2, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import GhostModal from '@/components/GhostModal';
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
        systemPrompt: '',
        whatsappTemplate: '',
        storeLocation: '',
        contactInfo: '',
    });

    // AI Generate state
    const [aiPromptInput, setAiPromptInput] = useState('');
    const [generating, setGenerating] = useState(false);

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
                    console.log('📬 Fetched Settings:', data);
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
                    store_location: settings.storeLocation,
                    contact_info: settings.contactInfo,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });

            if (error) {
                throw error;
            }

            console.log('✅ Settings Saved Successfully!');
            toast.success('Settings Saved', { description: 'Your Ghost Agent configuration has been updated.' });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings.');
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
        <div className="space-y-8 pb-32 md:pb-12 min-h-[100dvh]">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-2xl font-bold tracking-tight text-white">Agent Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">Configure how your Ghost Agent behaves and responds.</p>
            </motion.div>

            {/* Business Identity */}
            <div className="glass-dark p-8 rounded-3xl">
                <div className="flex items-center gap-4 pb-6 border-b border-white/[0.06] mb-6">
                    <div className="p-3 bg-indigo-500/20 rounded-xl">
                        <Building2 className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Business Identity</h2>
                        <p className="text-white/50">Core business information</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Business Name</label>
                    <input
                        type="text"
                        value={settings.businessName}
                        onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                        className="input-premium w-full"
                        placeholder="e.g. Joe's Pizza"
                    />
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-6">
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Store Location</label>
                        <input
                            type="text"
                            value={settings.storeLocation}
                            onChange={(e) => setSettings({ ...settings, storeLocation: e.target.value })}
                            className="input-premium w-full"
                            placeholder="e.g. Hamra, Beirut, Lebanon"
                        />
                        <p className="text-xs text-white/40 italic">The AI will share this exact address when asked. Leave blank to hide.</p>
                    </div>
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Contact Info</label>
                        <input
                            type="text"
                            value={settings.contactInfo}
                            onChange={(e) => setSettings({ ...settings, contactInfo: e.target.value })}
                            className="input-premium w-full"
                            placeholder="e.g. +961 71 123 456 / info@store.com"
                        />
                        <p className="text-xs text-white/40 italic">Phone, email, or website the AI can share with customers.</p>
                    </div>
                </div>
            </div>

            {/* AI Persona */}
            <div className="glass-dark p-8 rounded-3xl">
                <div className="flex items-center gap-4 pb-6 border-b border-white/[0.06] mb-6">
                    <div className="p-3 bg-primary/20 rounded-xl">
                        <Bot className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">AI Persona</h2>
                        <p className="text-white/50">Define personality and communication style</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Response Tone</label>
                        <select
                            value={settings.tone}
                            onChange={(e) => setSettings({ ...settings, tone: e.target.value })}
                            className="input-premium w-full cursor-pointer"
                        >
                            <option value="Casual" className="bg-black">Casual & Friendly</option>
                            <option value="Professional" className="bg-black">Professional</option>
                            <option value="Luxury" className="bg-black">Luxury & Premium</option>
                            <option value="Sarcastic" className="bg-black">Sarcastic</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Use Emojis</label>
                        <div className="flex items-center justify-between p-4 bg-surface-2 rounded-xl border border-white/[0.06] hover:bg-surface-3 transition-all cursor-pointer group"
                            onClick={() => setSettings({ ...settings, useEmojis: !settings.useEmojis })}>
                            <span className="text-base group-hover:text-white transition-colors">Add emojis to responses</span>
                            <div className={clsx(
                                "relative w-14 h-8 rounded-full transition-colors duration-300",
                                settings.useEmojis ? "bg-primary" : "bg-white/10"
                            )}>
                                <AnimatePresence>
                                    {settings.useEmojis && (
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0.8 }}
                                            animate={{ scale: 2.5, opacity: 0 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            transition={{ duration: 0.5 }}
                                            className="absolute inset-0 rounded-full bg-primary blur-md"
                                        />
                                    )}
                                </AnimatePresence>
                                <motion.div
                                    className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-lg"
                                    animate={{ x: settings.useEmojis ? 24 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Manager Alert System */}
            <div className="glass-dark p-8 rounded-3xl">
                <div className="flex items-center gap-4 pb-6 border-b border-white/[0.06] mb-6">
                    <div className="p-3 bg-yellow-500/20 rounded-xl">
                        <Bell className="w-7 h-7 text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Manager Alerts</h2>
                        <p className="text-white/50">Human escalation settings (WhatsApp)</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Owner WhatsApp Number</label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                        <input
                            type="tel"
                            value={settings.emergencyWhatsApp}
                            onChange={(e) => setSettings({ ...settings, emergencyWhatsApp: e.target.value })}
                            className="input-premium w-full pl-11"
                            placeholder="+1 234 567 8900"
                        />
                    </div>
                    <p className="text-xs text-white/40 italic">Ghost Agent will text this number if a customer says "Manager", "Scam", or "Bot".</p>
                </div>
            </div>

            {/* Sales Rules */}
            <div className="glass-dark p-8 rounded-3xl">
                {/* ... existing sales UI ... */}
                <div className="flex items-center gap-4 pb-6 border-b border-white/[0.06] mb-6">
                    <div className="p-3 bg-green-500/20 rounded-xl">
                        <DollarSign className="w-7 h-7 text-green-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Sales Rules</h2>
                        <p className="text-white/50">Set pricing and discount boundaries</p>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="space-y-4">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Maximum Discount %</label>
                        <div className="space-y-4">
                            <input
                                type="range"
                                min="0"
                                max="50"
                                value={settings.maxDiscount}
                                onChange={(e) => setSettings({ ...settings, maxDiscount: parseInt(e.target.value) })}
                                className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                                style={{
                                    background: `linear-gradient(to right, rgb(192 132 252) 0%, rgb(192 132 252) ${settings.maxDiscount * 2}%, rgba(255,255,255,0.1) ${settings.maxDiscount * 2}%, rgba(255,255,255,0.1) 100%)`
                                }}
                            />
                            <div className="flex justify-between items-center">
                                <span className="text-white/40">0%</span>
                                <span className="text-primary font-bold text-3xl font-mono">{settings.maxDiscount}%</span>
                                <span className="text-white/40">50%</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Minimum Order for Discount</label>
                        <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 text-lg font-bold">$</span>
                            <input
                                type="number"
                                value={settings.minOrderForDiscount}
                                onChange={(e) => setSettings({ ...settings, minOrderForDiscount: parseInt(e.target.value) })}
                                className="input-premium w-full pl-12 pr-16 text-lg font-semibold"
                                placeholder="50"
                            />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 text-sm">USD</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Integrations (Connected Accounts) */}
            <div className="glass-dark p-8 rounded-3xl mb-8">
                <div className="flex items-center gap-4 pb-6 border-b border-white/[0.06] mb-6">
                    <div className="p-3 bg-pink-500/20 rounded-xl">
                        <Instagram className="w-7 h-7 text-pink-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Integrations</h2>
                        <p className="text-white/50">Manage connected social accounts</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* List Connected Accounts */}
                    {instagramStatus.accounts.length > 0 && instagramStatus.accounts.map((acc: any) => (
                        <div key={acc.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-surface-2 p-4 rounded-2xl border border-white/[0.06] gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 rounded-xl flex items-center justify-center shrink-0">
                                    <Instagram className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg truncate max-w-[150px]">{acc.username || 'Insta User'}</h3>
                                        <span className="self-center px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Running
                                        </span>
                                    </div>
                                    <p className="text-white/50 text-xs font-mono">{acc.id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDisconnectModal({ open: true, accountId: acc.id })}
                                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
                            >
                                <Trash2 className="w-3 h-3" /> Disconnect
                            </button>
                        </div>
                    ))}

                    {/* Add Account Button */}
                    <button
                        onClick={handleConnectInstagram}
                        disabled={connecting}
                        className="w-full py-4 border-2 border-dashed border-white/[0.06] hover:border-white/20 hover:bg-surface-2 rounded-2xl flex items-center justify-center gap-2 text-white/60 hover:text-white transition-all group press"
                    >
                        {connecting ? <Loader2 className="w-5 h-5 animate-spin" /> :
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-colors">
                                <Plus className="w-5 h-5" />
                            </div>}
                        <span className="font-bold">Add Another Account</span>
                    </button>
                </div>
            </div>

            {/* Language */}
            <div className="glass-dark p-8 rounded-3xl">
                <div className="flex items-center gap-4 pb-6 border-b border-white/[0.06] mb-6">
                    <div className="p-3 bg-blue-500/20 rounded-xl">
                        <Globe className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Language</h2>
                        <p className="text-white/50">Ghost Agent automatically mirrors the user&apos;s language</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Language Mode</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { value: 'Auto-Detect', label: '🌍 Auto-Detect', desc: 'Mirrors user\'s language & dialect' },
                            { value: 'English', label: '🇬🇧 English Only', desc: 'Always respond in English' },
                            { value: 'Lebanese Franco', label: '🇱🇧 Lebanese Franco', desc: 'Always respond in Lebanese Arabizi' },
                        ].map((lang) => (
                            <button
                                key={lang.value}
                                onClick={() => setSettings(prev => ({ ...prev, language: lang.value }))}
                                className={clsx(
                                    "p-5 rounded-2xl border-2 transition-all text-left press",
                                    settings.language === lang.value
                                        ? "bg-primary/20 border-primary shadow-[0_0_25px_rgba(192,132,252,0.3)]"
                                        : "bg-white/5 border-white/[0.06] hover:bg-white/10 hover:border-white/15"
                                )}
                            >
                                <div className={clsx("font-bold text-base mb-1", settings.language === lang.value ? "text-primary" : "text-white")}>
                                    {lang.label}
                                </div>
                                <div className="text-xs text-white/40">{lang.desc}</div>
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-white/40 italic">Auto-Detect is recommended. Ghost Agent will reply in English, Lebanese Arabic, French, or any language the customer uses.</p>
                </div>
            </div>

            {/* Training */}
            <div className="glass-dark p-8 rounded-3xl">
                <div className="flex items-center gap-4 pb-6 border-b border-white/[0.06] mb-6">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                        <Sparkles className="w-7 h-7 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Agent Training</h2>
                        <p className="text-white/50">Upload product data and knowledge</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">KNOWLEDGE BASE (System Instructions)</label>
                        </div>

                        {/* Generate with AI */}
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Generate with AI</span>
                            </div>
                            <p className="text-xs text-white/40 mb-3">Describe your business in a few words and AI will write detailed instructions for your agent.</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={aiPromptInput}
                                    onChange={(e) => setAiPromptInput(e.target.value)}
                                    className="input-premium flex-1 text-sm"
                                    placeholder="e.g. We sell handmade candles, free shipping over $50, 7-day returns..."
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
                                            ? "bg-primary/20 text-primary/60"
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
                            className="input-premium w-full h-60 resize-none"
                            value={settings.systemPrompt}
                            onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                            placeholder="Example: We are an eco-friendly streetwear brand. Our shipping takes 3-5 days. Return policy is 30 days..."
                        />
                        <p className="text-xs text-white/40 italic">This is the most important field. Tell the bot everything it needs to know about your business.</p>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Product Catalog (CSV)</label>
                        {uploadedFile ? (
                            <div className="border-2 border-green-500/30 bg-green-500/10 rounded-2xl p-6 flex items-center justify-between">
                                {/* ... existing file UI ... */}
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-green-500/20 rounded-xl">
                                        <FileSpreadsheet className="w-6 h-6 text-green-400" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-green-400">{uploadedFile.name}</div>
                                        <div className="text-sm text-white/50">{uploadedFile.rowCount} products loaded</div>
                                    </div>
                                </div>
                                <button onClick={handleRemoveCatalog} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            // ... existing upload UI ...
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={clsx(
                                    "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer group",
                                    uploading ? "border-primary/50 bg-primary/10" : "border-white/[0.06] hover:border-primary/30 hover:bg-white/5"
                                )}
                            >
                                {uploading ? (
                                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                                ) : (
                                    <Upload className="w-12 h-12 mx-auto mb-4 text-white/40 group-hover:text-primary transition-colors" />
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".csv"
                                    onChange={handleCsvUpload}
                                    disabled={uploading}
                                />
                                <div className="text-white/60 mb-2 font-medium text-base">
                                    {uploading ? 'Processing...' : 'Click to upload CSV'}
                                </div>
                                <div className="text-xs text-white/40">Required columns: name, price, description, stock</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-center pt-6 pb-24 md:pb-12 sticky bottom-6 md:static z-40">
                <button
                    onClick={handleSave}
                    disabled={saving || success}
                    className={clsx(
                        "px-16 py-5 rounded-2xl font-black text-xl transition-all shadow-[0_0_40px_rgba(192,132,252,0.5)] flex items-center gap-3 disabled:opacity-80 disabled:cursor-not-allowed transform w-full md:w-auto justify-center mx-4 md:mx-0",
                        success ? "bg-green-500 text-black scale-105" : "bg-primary text-black hover:scale-105 active:scale-95"
                    )}
                >
                    {saving ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : success ? (
                        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.25, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="flex items-center gap-2">
                            <Check className="w-8 h-8" /> Saved!
                        </motion.div>
                    ) : (
                        <><Save className="w-6 h-6" /> Save All Settings</>
                    )}
                </button>
            </div>

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
