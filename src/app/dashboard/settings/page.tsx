'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Bot, DollarSign, Bell, Globe, Sparkles, Upload, Building2, Loader2, Check, FileSpreadsheet, X, Instagram } from 'lucide-react';
import { clsx } from 'clsx';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
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

    // Initial state with empty values (No fake data!)
    const [settings, setSettings] = useState({
        businessName: '',
        tone: 'Professional',
        useEmojis: true,
        maxDiscount: 20,
        minOrderForDiscount: 50,
        emergencyWhatsApp: '',
        language: 'English',
        systemPrompt: '',
        whatsappTemplate: '',
    });

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

                if (error && error.code !== 'PGRST116') {
                    console.error('Error fetching settings:', error);
                }

                if (data) {
                    setSettings({
                        businessName: data.business_name || '',
                        tone: data.tone || 'Professional',
                        useEmojis: data.use_emojis ?? true,
                        maxDiscount: data.max_discount || 20,
                        minOrderForDiscount: data.min_order_for_discount || 50,
                        emergencyWhatsApp: data.emergency_whatsapp || '',
                        language: data.language || 'English',
                        systemPrompt: data.system_instructions || '',
                        whatsappTemplate: data.whatsapp_template || '',
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

        // Validate file type
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

            // Parse CSV with papaparse
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

                    // Convert to JSON string
                    const jsonContent = JSON.stringify(rows, null, 2);

                    // Upsert to business_knowledge (replace existing)
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
                        toast.success(`Uploaded "${file.name}" with ${rows.length} products!`);
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

        // Clear the input
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

    const handleConnectInstagram = async () => {
        setConnecting(true);
        try {
            const res = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: (await supabase.auth.getUser()).data.user?.id })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                toast.error('Failed to get connection link');
            }
        } catch (e) {
            console.error(e);
            toast.error('Connection failed');
        } finally {
            setConnecting(false);
        }
    };

    // Check for success redirect
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
            toast.success('Instagram connected successfully!');
            checkInstagramStatus();
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // Check status on mount
    useEffect(() => {
        checkInstagramStatus();
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
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });

            if (error) {
                throw error;
            }

            console.log('✅ Settings Saved Successfully!'); // Verification Log
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
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                    Agent Settings
                </h1>
                <p className="text-white/60">Configure how your Ghost Agent behaves and responds</p>
            </div>

            {/* Business Identity */}
            <div className="glass-dark p-8 rounded-3xl border border-white/10">
                <div className="flex items-center gap-4 pb-6 border-b border-white/10 mb-6">
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
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-base focus:border-primary/50 outline-none hover:bg-white/10 transition-all placeholder-white/20"
                        placeholder="e.g. Joe's Pizza"
                    />
                </div>
            </div>

            {/* AI Persona */}
            <div className="glass-dark p-8 rounded-3xl border border-white/10">
                <div className="flex items-center gap-4 pb-6 border-b border-white/10 mb-6">
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
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-base focus:border-primary/50 outline-none hover:bg-white/10 transition-all cursor-pointer"
                        >
                            <option value="Casual" className="bg-black">Casual & Friendly</option>
                            <option value="Professional" className="bg-black">Professional</option>
                            <option value="Luxury" className="bg-black">Luxury & Premium</option>
                            <option value="Sarcastic" className="bg-black">Sarcastic</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Use Emojis</label>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer group"
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

            {/* Sales Rules */}
            <div className="glass-dark p-8 rounded-3xl border border-white/10">
                <div className="flex items-center gap-4 pb-6 border-b border-white/10 mb-6">
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
                                <span className="text-primary font-black text-3xl glow-text">{settings.maxDiscount}%</span>
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
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-12 pr-16 text-lg font-semibold focus:border-primary/50 outline-none hover:bg-white/10 transition-all"
                                placeholder="50"
                            />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 text-sm">USD</span>
                        </div>
                        <p className="text-xs text-white/40 italic">Agent won't offer discounts below this amount</p>
                    </div>
                </div>
            </div>

            {/* Notification Settings */}
            <div className="glass-dark p-8 rounded-3xl border border-white/10">
                <div className="flex items-center gap-4 pb-6 border-b border-white/10 mb-6">
                    <div className="p-3 bg-yellow-500/20 rounded-xl">
                        <Bell className="w-7 h-7 text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Notifications</h2>
                        <p className="text-white/50">Human escalation settings</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Emergency WhatsApp Number</label>
                    <input
                        type="tel"
                        value={settings.emergencyWhatsApp}
                        onChange={(e) => setSettings({ ...settings, emergencyWhatsApp: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-base focus:border-primary/50 outline-none hover:bg-white/10 transition-all"
                        placeholder="+961 70 123 456"
                    />
                    <p className="text-xs text-white/40 italic">Agent will escalate complex issues to this number</p>
                </div>
            </div>

            {/* WhatsApp Smart Link */}
            <div className="glass-dark p-8 rounded-3xl border border-white/10">
                <div className="flex items-center gap-4 pb-6 border-b border-white/10 mb-6">
                    <div className="p-3 bg-green-500/20 rounded-xl">
                        <Bell className="w-7 h-7 text-green-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">WhatsApp Smart Link</h2>
                        <p className="text-white/50">Customize the pre-filled message for customers</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Message Template</label>
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-base focus:border-primary/50 outline-none hover:bg-white/10 transition-all h-24 resize-none font-mono"
                            value={settings.whatsappTemplate}
                            onChange={(e) => setSettings({ ...settings, whatsappTemplate: e.target.value })}
                            placeholder="Hello! I saw the {product} on Instagram for ${price} USD and I would like to order it."
                        />
                        <p className="text-xs text-white/40 italic">
                            Use <code className="bg-white/10 px-1 rounded">{'{product}'}</code> and <code className="bg-white/10 px-1 rounded">{'{price}'}</code> as placeholders
                        </p>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="text-xs text-white/40 uppercase tracking-wide mb-2">Live Preview</div>
                        <p className="text-white/80 font-medium mb-3">
                            {settings.whatsappTemplate
                                .replace('{product}', 'Neon Ghost Light')
                                .replace('{price}', '49.99')}
                        </p>
                        <div className="text-xs text-primary">
                            → Opens: <code className="bg-white/10 px-2 py-1 rounded text-xs">wa.me/{settings.emergencyWhatsApp.replace(/[\s\-+]/g, '')}</code>
                        </div>
                    </div>
                </div>
            </div>

            {/* Integrations */}
            <div className="glass-dark p-8 rounded-3xl border border-white/10 mb-8">
                <div className="flex items-center gap-4 pb-6 border-b border-white/10 mb-6">
                    <div className="p-3 bg-pink-500/20 rounded-xl">
                        <Instagram className="w-7 h-7 text-pink-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Integrations</h2>
                        <p className="text-white/50">Connect your social channels</p>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-white/5 p-6 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 rounded-xl flex items-center justify-center">
                            <Instagram className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg">Instagram</h3>
                                {instagramStatus.connected && (
                                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full flex items-center gap-1">
                                        <Check className="w-3 h-3" />
                                        Connected
                                    </span>
                                )}
                            </div>
                            {instagramStatus.connected && instagramStatus.accounts.length > 0 ? (
                                <p className="text-white/70 text-sm">@{instagramStatus.accounts[0].username}</p>
                            ) : (
                                <p className="text-white/50 text-sm">Connect to read DMs and auto-reply</p>
                            )}
                        </div>
                    </div>
                    {!instagramStatus.connected ? (
                        <button
                            onClick={handleConnectInstagram}
                            disabled={connecting}
                            className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
                            {connecting ? 'Connecting...' : 'Connect Account'}
                        </button>
                    ) : (
                        <button
                            onClick={checkInstagramStatus}
                            className="px-4 py-2 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-colors text-sm"
                        >
                            Refresh Status
                        </button>
                    )}
                </div>
            </div>

            {/* Language */}
            <div className="glass-dark p-8 rounded-3xl border border-white/10">
                <div className="flex items-center gap-4 pb-6 border-b border-white/10 mb-6">
                    <div className="p-3 bg-blue-500/20 rounded-xl">
                        <Globe className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Language</h2>
                        <p className="text-white/50">Communication language preference</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Primary Language</label>
                    <div className="grid grid-cols-2 gap-6">
                        {['English', 'Lebanese Franco'].map((lang) => (
                            <button
                                key={lang}
                                onClick={() => setSettings({ ...settings, language: lang })}
                                className={clsx(
                                    "p-6 rounded-2xl border-2 transition-all font-bold text-lg",
                                    settings.language === lang
                                        ? "bg-primary/20 border-primary text-primary shadow-[0_0_25px_rgba(192,132,252,0.3)]"
                                        : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                                )}
                            >
                                {lang === 'English' ? 'Strict English' : lang}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Training */}
            <div className="glass-dark p-8 rounded-3xl border border-white/10">
                <div className="flex items-center gap-4 pb-6 border-b border-white/10 mb-6">
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
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">KNOWLEDGE BASE (System Instructions)</label>
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-base focus:border-primary/50 outline-none h-60 resize-none hover:bg-white/10 transition-all"
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
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-green-500/20 rounded-xl">
                                        <FileSpreadsheet className="w-6 h-6 text-green-400" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-green-400">{uploadedFile.name}</div>
                                        <div className="text-sm text-white/50">{uploadedFile.rowCount} products loaded</div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleRemoveCatalog}
                                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={clsx(
                                    "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer group",
                                    uploading ? "border-primary/50 bg-primary/10" : "border-white/10 hover:border-primary/30 hover:bg-white/5"
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
            <div className="flex justify-center pt-6 pb-12">
                <button
                    onClick={handleSave}
                    disabled={saving || success}
                    className={clsx(
                        "px-16 py-5 rounded-2xl font-black text-xl transition-all shadow-[0_0_40px_rgba(192,132,252,0.5)] flex items-center gap-3 disabled:opacity-80 disabled:cursor-not-allowed transform",
                        success ? "bg-green-500 text-black scale-105" : "bg-primary text-black hover:scale-105 active:scale-95"
                    )}
                >
                    {saving ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : success ? (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1.25, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 15 }}
                            className="flex items-center gap-2"
                        >
                            <Check className="w-8 h-8" /> Saved!
                        </motion.div>
                    ) : (
                        <><Save className="w-6 h-6" /> Save All Settings</>
                    )}
                </button>
            </div>
        </div>
    );
}


