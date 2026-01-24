'use client';

import { useState, useEffect } from 'react';
import { Save, Bot, DollarSign, Bell, Globe, Sparkles, Upload } from 'lucide-react';
import { clsx } from 'clsx';

export default function SettingsPage() {
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        tone: 'Professional',
        useEmojis: true,
        maxDiscount: 20,
        minOrderForDiscount: 50,
        emergencyWhatsApp: '+961 70 123 456',
        language: 'English',
        systemPrompt: 'You are a helpful sales assistant that uses ghost emojis. Always check stock levels before promising availability.',
        whatsappTemplate: 'Hello! I saw the {product} on Instagram for ${price} USD and I would like to order it.',
    });

    useEffect(() => {
        const saved = localStorage.getItem('ghost_agent_settings');
        if (saved) {
            try {
                setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
    }, []);

    const handleSave = async () => {
        setLoading(true);
        setTimeout(() => {
            localStorage.setItem('ghost_agent_settings', JSON.stringify(settings));
            setLoading(false);
            alert('✅ Settings saved successfully!');
        }, 800);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                    Agent Settings
                </h1>
                <p className="text-white/60">Configure how your Ghost Agent behaves and responds</p>
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
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Use Emojis</label>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                            onClick={() => setSettings({ ...settings, useEmojis: !settings.useEmojis })}>
                            <span className="text-base">Add emojis to responses</span>
                            <div className={clsx(
                                "relative w-12 h-7 rounded-full transition-all",
                                settings.useEmojis ? "bg-primary shadow-[0_0_15px_rgba(192,132,252,0.4)]" : "bg-white/20"
                            )}>
                                <div className={clsx(
                                    "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg transition-transform",
                                    settings.useEmojis ? "translate-x-5" : "translate-x-0.5"
                                )} />
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
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Product Catalog</label>
                        <div className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center hover:border-primary/30 hover:bg-white/5 transition-all cursor-pointer group">
                            <Upload className="w-12 h-12 mx-auto mb-4 text-white/40 group-hover:text-primary transition-colors" />
                            <input type="file" className="hidden" accept=".csv,.json" />
                            <div className="text-white/60 mb-2 font-medium text-base">Drop CSV/JSON here or click to upload</div>
                            <div className="text-xs text-white/40">Fields: name, price, description, stock</div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/80 uppercase tracking-wide">Brand Knowledge</label>
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-base focus:border-primary/50 outline-none h-40 resize-none hover:bg-white/10 transition-all"
                            value={settings.systemPrompt}
                            onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                            placeholder="Example: We are an eco-friendly streetwear brand. Our shipping takes 3-5 days..."
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-center pt-6 pb-12">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-16 py-5 bg-primary text-black font-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-transform flex items-center gap-3 shadow-[0_0_40px_rgba(192,132,252,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "Saving..." : <><Save className="w-6 h-6" /> Save All Settings</>}
                </button>
            </div>
        </div>
    );
}
