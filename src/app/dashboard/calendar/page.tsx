"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Loader2, CheckCircle2, Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

export default function Page() {
    const { user } = useAuth();
    const supabase = createClient();
    const searchParams = useSearchParams();
    const toast = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    useEffect(() => {
        // Show toasts for success or error from the OAuth callback using the hook
        const error = searchParams.get('error');
        const success = searchParams.get('success');

        if (success) {
            toast.success("Google Calendar connected successfully!");
        } else if (error) {
            toast.error("Failed to connect Google Calendar. Please try again.");
        }
    }, [searchParams, toast]);

    useEffect(() => {
        const checkConnection = async () => {
            if (!user?.id) return;

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('google_refresh_token')
                    .eq('id', user.id)
                    .single();

                if (!error && data?.google_refresh_token) {
                    setIsConnected(true);
                }
            } catch (err) {
                console.error("Failed to check calendar connection:", err);
            } finally {
                setIsLoading(false);
            }
        };

        checkConnection();
    }, [user?.id, supabase]);

    const handleConnectClick = () => {
        window.location.href = '/api/calendar/auth';
    };

    const handleDisconnect = async () => {
        if (!user?.id) return;
        setIsDisconnecting(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({ google_refresh_token: null })
                .eq('id', user.id);

            if (error) throw error;

            setIsConnected(false);
            toast.success("Calendar disconnected successfully.");

            // Remove success from URL if present to avoid confusing re-toasts on refresh
            if (searchParams.get('success')) {
                window.history.replaceState({}, '', '/dashboard/calendar');
            }
        } catch (err: any) {
            console.error("Failed to disconnect calendar:", err);
            toast.error("Failed to disconnect calendar. Please try again.");
        } finally {
            setIsDisconnecting(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex flex-col relative w-full pb-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendar Integration</h1>
                <p className="text-sm text-muted-foreground mt-1">Connect your calendar to allow the AI to check availability and book appointments.</p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-surface-1 border border-border shadow-sm rounded-2xl  p-8 lg:p-12 relative overflow-x-clip  flex flex-col items-center justify-center text-center"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

                <div className="max-w-2xl mx-auto flex flex-col items-center text-center relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                        <Sparkles className="w-8 h-8 text-purple-400" />
                    </div>

                    <h2 className="text-xl font-bold text-foreground mb-3 tracking-tight">Sync Your Google Calendar</h2>
                    <p className="text-sm text-muted-foreground max-w-lg mb-10 leading-relaxed text-center">
                        Securely connect your Google Calendar. Ghost Agent will automatically read your free/busy times and manage new customer bookings directly in your schedule.
                    </p>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                        </div>
                    ) : isConnected ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-sm font-semibold">Calendar Connected</span>
                            </div>

                            <button
                                onClick={handleDisconnect}
                                disabled={isDisconnecting}
                                className="text-sm text-red-400/80 hover:text-red-400 font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 press pt-1"
                            >
                                {isDisconnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Disconnect Calendar
                            </button>

                            <div className="px-4 py-2 rounded-xl bg-surface-2 border border-border text-xs font-mono text-purple-400 mt-4">
                                Calendar Features In Development
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleConnectClick}
                            className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-foreground text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] border border-border press"
                        >
                            <CalendarIcon className="w-5 h-5" />
                            Connect Google Calendar
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}