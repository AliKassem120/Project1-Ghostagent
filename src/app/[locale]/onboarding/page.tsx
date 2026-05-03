"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Building2, CheckCircle2, Instagram } from "lucide-react";
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

    const handleFinalize = async () => {
        if (!selectedCategory || !user || !workspaceName.trim()) return;

        setIsSaving(true);
        try {
            // 1) Update User Object
            const { error: userError } = await supabase
                .from("users")
                .upsert({ id: user.id, business_type: selectedCategory }, { onConflict: "id" });
            if (userError) throw userError;

            // 2) Create the initial workspace (ai_settings)
            const { error: botError } = await supabase
                .from("ai_settings")
                .insert({
                    user_id: user.id,
                    name: workspaceName.trim(),
                    business_type: selectedCategory,
                });
            if (botError) throw botError;

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
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 via-pink-500 to-primary p-[1px] mb-6 shadow-lg shadow-pink-500/20">
                                <div className="w-full h-full rounded-2xl bg-surface-1 flex items-center justify-center">
                                    <Instagram className="w-8 h-8 text-foreground" />
                                </div>
                            </div>

                            <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Connect Instagram</h1>
                            <p className="text-sm text-muted-foreground mb-10 w-4/5 mx-auto">
                                The AI needs this connection to read and reply to your DMs and comments automatically.
                            </p>

                            <div className="w-full flex flex-col gap-3 mt-auto">
                                <button
                                    onClick={async () => {
                                        if (!selectedCategory || !user || !workspaceName.trim()) return;
                                        setIsSaving(true);
                                        try {
                                            await supabase.from("users").upsert({ id: user.id, business_type: selectedCategory }, { onConflict: "id" });
                                            const { data: wsData } = await supabase.from("ai_settings").insert({ user_id: user.id, name: workspaceName.trim(), business_type: selectedCategory }).select('id').single();
                                            const workspaceId = wsData?.id || '';
                                            // Build the proper Instagram OAuth URL (same as Settings page)
                                            const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID;
                                            if (!appId) { console.error("Missing NEXT_PUBLIC_INSTAGRAM_APP_ID"); setIsSaving(false); return; }
                                            const redirectUri = `${window.location.origin}/api/auth/callback/instagram`;
                                            const scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';
                                            const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${workspaceId}`;
                                            window.location.href = authUrl;
                                        } catch (e) { console.error(e); setIsSaving(false); }
                                    }}
                                    disabled={isSaving}
                                    className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md"
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Instagram className="w-4 h-4" />}
                                    {isSaving ? "Setting Up..." : "Connect Instagram"}
                                </button>
                                <button
                                    onClick={handleFinalize}
                                    disabled={isSaving}
                                    className="w-full py-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Skip for now
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
