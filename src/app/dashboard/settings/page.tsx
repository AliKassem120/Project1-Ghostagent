'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Bot, DollarSign, Bell, Globe, Sparkles, Upload, Building2, Loader2, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { createClient } from '@/utils/supabase/client';

export default function SettingsPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

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

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert('You must be logged in to save settings.');
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
            alert('Failed to save settings.');
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
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Product Catalog (Optional CSV)</label>
                        <div className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center hover:border-primary/30 hover:bg-white/5 transition-all cursor-pointer group">
                            <Upload className="w-12 h-12 mx-auto mb-4 text-white/40 group-hover:text-primary transition-colors" />
                            <input type="file" className="hidden" accept=".csv,.json" />
                            <div className="text-white/60 mb-2 font-medium text-base">Drop CSV/JSON here or click to upload</div>
                            <div className="text-xs text-white/40">Fields: name, price, description, stock</div>
                        </div>
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
