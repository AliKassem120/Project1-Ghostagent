"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Building2, CheckCircle2, Instagram, MessageCircle, Check, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import BusinessTypeSelector, { BusinessCategory } from "@/components/BusinessTypeSelector";
import GhostLogo from "@/components/GhostLogo";
import StarBackground from "@/components/StarBackground";
import { useAuth } from "@/contexts/AuthContext";

export default function OnboardingPage() {
    const router = useRouter();
    const supabase = createClient();
    const { user, loading: authLoading } = useAuth();

    // Multi-step State
    const [step, setStep] = useState(1);
    const [workspaceName, setWorkspaceName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<BusinessCategory | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);

    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [whatsappConnected, setWhatsappConnected] = useState(false);
    const [connectingWhatsapp, setConnectingWhatsapp] = useState(false);

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

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push("/login");
            } else {
                const checkStatus = async () => {
                    const { data } = await supabase
                        .from("users")
                        .select("business_type")
                        .eq("id", user.id)
                        .single();

                    if (data?.business_type) {
                        router.push("/dashboard");
                    } else {
                        setCheckingStatus(false);
                    }
                };
                checkStatus();
            }
        }
    }, [user, authLoading, router, supabase]);

    const getOrCreateWorkspaceId = async () => {
        if (workspaceId) return workspaceId;
        if (!selectedCategory || !user || !workspaceName.trim()) throw new Error("Missing parameters");

        await supabase
            .from("users")
            .upsert({ id: user.id, business_type: selectedCategory }, { onConflict: "id" });

        const { data, error } = await supabase
            .from("ai_settings")
            .insert({
                user_id: user.id,
                name: workspaceName.trim(),
                business_type: selectedCategory,
                is_autopilot_enabled: false,
            })
            .select("id")
            .single();

        if (error) throw error;
        setWorkspaceId(data.id);
        return data.id;
    };

    const handleConnectInstagram = async () => {
        if (!selectedCategory || !user || !workspaceName.trim()) return;
        setIsSaving(true);
        try {
            const targetWorkspaceId = await getOrCreateWorkspaceId();
            const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID;
            if (!appId) {
                console.error("Missing NEXT_PUBLIC_INSTAGRAM_APP_ID");
                alert("Instagram App ID not configured.");
                setIsSaving(false);
                return;
            }
            const redirectUri = `${window.location.origin}/api/auth/callback/instagram`;
            const scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';
            const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${targetWorkspaceId}`;
            window.location.href = authUrl;
        } catch (e: any) {
            console.error(e);
            alert("Instagram connection failed: " + e.message);
            setIsSaving(false);
        }
    };

    const handleConnectWhatsApp = async () => {
        if (!selectedCategory || !user || !workspaceName.trim()) return;
        if (!(window as any).FB) {
            alert("Facebook SDK not loaded yet. Please wait a moment or refresh.");
            return;
        }

        setConnectingWhatsapp(true);
        try {
            const targetWorkspaceId = await getOrCreateWorkspaceId();

            (window as any).FB.login((response: any) => {
                if (response.authResponse) {
                    const code = response.authResponse.code;
                    if (!code) {
                        alert("Meta did not return a valid auth code.");
                        setConnectingWhatsapp(false);
                        return;
                    }

                    fetch('/api/auth/callback/whatsapp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            code,
                            workspaceId: targetWorkspaceId
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            setWhatsappConnected(true);
                        } else {
                            alert(data.error || "Failed to link WhatsApp");
                        }
                    })
                    .catch(err => {
                        console.error("WA Callback error:", err);
                        alert("An error occurred during WhatsApp connection.");
                    })
                    .finally(() => {
                        setConnectingWhatsapp(false);
                    });
                } else {
                    alert("WhatsApp connection cancelled or failed.");
                    setConnectingWhatsapp(false);
                }
            }, {
                config_id: process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID || '1287853626231294',
                response_type: 'code',
                override_default_response_type: true,
                extras: {
                    setup: {}
                }
            });
        } catch (e: any) {
            console.error(e);
            alert("WhatsApp setup failed: " + e.message);
            setConnectingWhatsapp(false);
        }
    };

    const handleFinalize = async () => {
        if (!selectedCategory || !user || !workspaceName.trim()) return;

        setIsSaving(true);
        try {
            // 1) Update User Object
            const { error: userError } = await supabase
                .from("users")
                .upsert({ id: user.id, business_type: selectedCategory }, { onConflict: "id" });
            if (userError) throw userError;

            // 2) Create the initial workspace (ai_settings) if not already created
            if (!workspaceId) {
                const { error: botError } = await supabase
                    .from("ai_settings")
                    .insert({
                        user_id: user.id,
                        name: workspaceName.trim(),
                        business_type: selectedCategory,
                        is_autopilot_enabled: false,
                    });
                if (botError) throw botError;
            }

            router.push("/dashboard");
        } catch (error: any) {
            console.error("Failed to save onboarding flow:", error);
            alert("Error saving your setup: " + (error.message || JSON.stringify(error)));
            setIsSaving(false);
        }
    };

    if (authLoading || checkingStatus) {
        return (
            <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center relative overflow-x-clip">
                <StarBackground />
                <Loader2 className="w-8 h-8 text-primary animate-spin relative z-10" />
            </div>
        );
    }

    const stepsItems = [
        { label: "Workspace" },
        { label: "Category" },
        { label: "Finalize" }
    ];

    return (
        <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center relative overflow-x-clip p-4">
            <StarBackground />

            {/* Stepper Progress */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-4">
                <div className="flex gap-2">
                    {stepsItems.map((s, idx) => {
                        const active = step >= idx + 1;
                        return (
                            <div key={idx} className="flex-1 flex flex-col gap-2">
                                <div className={`h-1.5 w-full rounded-full transition-colors duration-500 ${active ? "bg-primary" : "bg-surface-2"}`} />
                                <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-500 ${active ? "text-primary" : "text-muted-foreground"}`}>
                                    {s.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <motion.div
                layout
                className="w-full max-w-2xl bg-surface-1 rounded-2xl p-8 relative z-10 border border-border flex flex-col min-h-[480px] shadow-sm"
            >
                <div className="flex flex-col items-center text-center mb-8 gap-4 mt-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center p-3 relative overflow-x-clip group">
                        <div className="absolute inset-0 bg-primary/20 scale-0 group-hover:scale-100 rounded-2xl transition-transform duration-500 ease-out" />
                        <GhostLogo iconOnly className="w-full h-full relative z-10" />
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* STEP 1: Workspace Name */}
                    {step === 1 && (
                        <motion.div
                            key="step-1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full"
                        >
                            <h1 className="text-2xl font-bold text-foreground text-center mb-2 tracking-tight">Name Your Agent</h1>
                            <p className="text-sm text-muted-foreground text-center mb-8">What should we call your first automated AI assistant?</p>

                            <div className="space-y-4">
                                <label className="text-sm font-semibold text-muted-foreground">Workspace Name</label>
                                <input
                                    type="text"
                                    value={workspaceName}
                                    onChange={(e) => setWorkspaceName(e.target.value)}
                                    placeholder="e.g. My Awesome Store"
                                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3.5 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/30 outline-none transition-all placeholder:text-muted-foreground/50 hover:border-muted-foreground/30 font-medium"
                                    autoFocus
                                />
                            </div>

                            <div className="mt-10 flex flex-col gap-3">
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={!workspaceName.trim()}
                                    className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    Continue <ArrowRight className="w-4 h-4 relative top-px" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: Category Component */}
                    {step === 2 && (
                        <motion.div
                            key="step-2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="flex-1 flex flex-col w-full"
                        >
                            <h1 className="text-2xl font-bold text-foreground text-center mb-2 tracking-tight">Business Category</h1>
                            <p className="text-sm text-muted-foreground text-center mb-6">This helps the AI understand your domain.</p>

                            <div className="mb-4">
                                <BusinessTypeSelector
                                    value={selectedCategory || "ecommerce"}
                                    onChange={setSelectedCategory}
                                    isLoading={false}
                                />
                            </div>

                            <div className="mt-auto flex gap-3 pt-4 border-t border-border">
                                <button
                                    onClick={() => setStep(1)}
                                    className="px-6 py-3.5 rounded-xl border border-border bg-surface-2 font-bold text-foreground hover:bg-surface-3 transition-colors text-sm"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedCategory('ecommerce');
                                        setStep(3);
                                    }}
                                    className="px-6 py-3.5 rounded-xl border border-transparent font-bold text-muted-foreground hover:text-foreground transition-colors text-sm"
                                >
                                    Skip
                                </button>
                                <button
                                    onClick={() => {
                                        if (!selectedCategory) setSelectedCategory('ecommerce');
                                        setStep(3);
                                    }}
                                    className="flex-1 py-3.5 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    Continue <ArrowRight className="w-4 h-4 relative top-px" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: Connect & Finalize */}
                    {step === 3 && (
                        <motion.div
                            key="step-3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center"
                        >
                            <div className="flex gap-4 mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 via-pink-500 to-primary p-[1px] shadow-lg shadow-pink-500/20 flex items-center justify-center">
                                    <div className="w-full h-full rounded-2xl bg-surface-1 flex items-center justify-center">
                                        <Instagram className="w-8 h-8 text-foreground" />
                                    </div>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/20 flex items-center justify-center">
                                    <div className="w-full h-full rounded-2xl bg-surface-1 flex items-center justify-center">
                                        <MessageCircle className="w-8 h-8 text-foreground" />
                                    </div>
                                </div>
                            </div>

                            <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Connect Channels</h1>
                            <p className="text-sm text-muted-foreground mb-8 w-4/5 mx-auto">
                                Link Instagram, WhatsApp, or both to let your AI agent handle customer conversations.
                            </p>

                            <div className="w-full flex flex-col gap-4 mt-auto">
                                {/* Instagram Connection Card */}
                                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-xl border border-border">
                                    <div className="flex items-center gap-3 text-left">
                                        <Instagram className="w-5 h-5 text-pink-500" />
                                        <div>
                                            <p className="text-xs font-bold text-foreground">Instagram DMs</p>
                                            <p className="text-[10px] text-muted-foreground">Automate direct messages & comments</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleConnectInstagram}
                                        disabled={isSaving || connectingWhatsapp}
                                        className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
                                    </button>
                                </div>

                                {/* WhatsApp Connection Card */}
                                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-xl border border-border">
                                    <div className="flex items-center gap-3 text-left">
                                        <MessageCircle className="w-5 h-5 text-emerald-500" />
                                        <div>
                                            <p className="text-xs font-bold text-foreground">WhatsApp Business</p>
                                            <p className="text-[10px] text-muted-foreground">Automate chats and booking forms</p>
                                        </div>
                                    </div>
                                    {whatsappConnected ? (
                                        <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/20">
                                            <Check className="w-3 h-3" /> Connected
                                        </span>
                                    ) : (
                                        <button
                                            onClick={handleConnectWhatsApp}
                                            disabled={isSaving || connectingWhatsapp}
                                            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50"
                                        >
                                            {connectingWhatsapp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2 mt-4">
                                    <button
                                        onClick={handleFinalize}
                                        disabled={isSaving || connectingWhatsapp}
                                        className="w-full py-3.5 bg-surface-3 border border-border text-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-surface-4 transition-colors disabled:opacity-50 shadow-sm"
                                    >
                                        {whatsappConnected ? "Finish Setup" : "Skip / Go to Dashboard"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
