"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import BusinessTypeSelector, { BusinessCategory } from "@/components/BusinessTypeSelector";
import GhostLogo from "@/components/GhostLogo";
import StarBackground from "@/components/StarBackground";
import { useAuth } from "@/contexts/AuthContext";

export default function OnboardingPage() {
    const router = useRouter();
    const supabase = createClient();
    const { user, loading: authLoading } = useAuth();
    const [selectedCategory, setSelectedCategory] = useState<BusinessCategory | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push("/login");
            } else {
                // Check if user already has a business_type
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

    const handleContinue = async () => {
        if (!selectedCategory || !user) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("users")
                .upsert({ id: user.id, business_type: selectedCategory }, { onConflict: "id" });

            if (error) throw error;
            router.push("/dashboard");
        } catch (error) {
            console.error("Failed to save business type:", error);
            setIsSaving(false);
        }
    };

    if (authLoading || checkingStatus) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
                <StarBackground />
                <Loader2 className="w-8 h-8 text-primary animate-spin relative z-10" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center relative overflow-hidden p-4">
            <StarBackground />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-2xl glass-card rounded-2xl p-8 relative z-10 border border-white/[0.06] shadow-2xl"
            >
                <div className="flex flex-col items-center text-center mb-8 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center p-3 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-primary/20 scale-0 group-hover:scale-100 rounded-2xl transition-transform duration-500 ease-out" />
                        <GhostLogo className="w-full h-full text-primary relative z-10 drop-shadow-[0_0_10px_rgba(139,92,246,0.3)]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to Ghost Agent</h1>
                        <p className="text-sm text-white/50 mt-2">What kind of business are you running?</p>
                    </div>
                </div>

                <div className="mb-8 p-1">
                    <BusinessTypeSelector
                        value={selectedCategory || "ecommerce"}
                        onChange={setSelectedCategory}
                        isLoading={isSaving}
                    />
                </div>

                <div className="flex justify-end pt-4 border-t border-white/[0.04]">
                    <button
                        onClick={handleContinue}
                        disabled={!selectedCategory || isSaving}
                        className={`
                            px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2
                            ${!selectedCategory || isSaving
                                ? "bg-white/5 text-white/30 cursor-not-allowed"
                                : "bg-primary text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                            }
                        `}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Continue to Dashboard"
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
