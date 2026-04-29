"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Clock, Save, Loader2, Check, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/contexts/ToastContext";

interface DaySchedule {
    day: number;
    label: string;
    short: string;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
}

const DEFAULT_HOURS: DaySchedule[] = [
    { day: 0, label: "Sunday", short: "Sun", isOpen: false, openTime: "09:00", closeTime: "17:00" },
    { day: 1, label: "Monday", short: "Mon", isOpen: true, openTime: "09:00", closeTime: "17:00" },
    { day: 2, label: "Tuesday", short: "Tue", isOpen: true, openTime: "09:00", closeTime: "17:00" },
    { day: 3, label: "Wednesday", short: "Wed", isOpen: true, openTime: "09:00", closeTime: "17:00" },
    { day: 4, label: "Thursday", short: "Thu", isOpen: true, openTime: "09:00", closeTime: "17:00" },
    { day: 5, label: "Friday", short: "Fri", isOpen: true, openTime: "09:00", closeTime: "17:00" },
    { day: 6, label: "Saturday", short: "Sat", isOpen: false, openTime: "09:00", closeTime: "17:00" },
];

const DURATION_OPTIONS = [
    { value: 15, label: "15 min" },
    { value: 30, label: "30 min" },
    { value: 45, label: "45 min" },
    { value: 60, label: "1 hour" },
    { value: 90, label: "1.5 hours" },
    { value: 120, label: "2 hours" },
];

function formatTimeDisplay(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function getHoursWorked(open: string, close: string): string {
    const [oh, om] = open.split(":").map(Number);
    const [ch, cm] = close.split(":").map(Number);
    const diff = (ch * 60 + cm) - (oh * 60 + om);
    if (diff <= 0) return "0h";
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function HoursPage() {
    const { user } = useAuth();
    const { activeWorkspaceId } = useWorkspace();
    const supabase = createClient();
    const toast = useToast();

    const [hours, setHours] = useState<DaySchedule[]>(DEFAULT_HOURS);
    const [slotDuration, setSlotDuration] = useState(60);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const fetchHours = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            let query = supabase.from("business_hours").select("*");
            if (activeWorkspaceId) {
                query = query.eq("workspace_id", activeWorkspaceId);
            } else {
                query = query.eq("user_id", user.id).is("workspace_id", null);
            }

            const { data } = await query;

            if (data && data.length > 0) {
                const mapped = DEFAULT_HOURS.map((def) => {
                    const found = data.find((d: any) => d.day_of_week === def.day);
                    if (found) {
                        return {
                            ...def,
                            isOpen: found.is_open,
                            openTime: found.open_time?.slice(0, 5) || def.openTime,
                            closeTime: found.close_time?.slice(0, 5) || def.closeTime,
                        };
                    }
                    return def;
                });
                setHours(mapped);
            }

            // Load slot duration from ai_settings
            let settingsQuery = supabase.from("ai_settings").select("slot_duration_minutes");
            if (activeWorkspaceId) {
                settingsQuery = settingsQuery.eq("id", activeWorkspaceId);
            } else {
                settingsQuery = settingsQuery.eq("user_id", user.id);
            }
            const { data: settingsData } = await settingsQuery.maybeSingle();
            if (settingsData?.slot_duration_minutes) {
                setSlotDuration(settingsData.slot_duration_minutes);
            }
        } catch (err) {
            console.error("Failed to load hours:", err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, activeWorkspaceId, supabase]);

    useEffect(() => {
        fetchHours();
    }, [fetchHours]);

    const handleSave = async () => {
        if (!user?.id) return;
        setSaving(true);
        try {
            // Delete existing rows and re-insert
            let deleteQuery = supabase.from("business_hours").delete();
            if (activeWorkspaceId) {
                deleteQuery = deleteQuery.eq("workspace_id", activeWorkspaceId);
            } else {
                deleteQuery = deleteQuery.eq("user_id", user.id).is("workspace_id", null);
            }
            await deleteQuery;

            const rows = hours.map((h) => ({
                user_id: user.id,
                workspace_id: activeWorkspaceId || null,
                day_of_week: h.day,
                is_open: h.isOpen,
                open_time: h.openTime,
                close_time: h.closeTime,
            }));

            const { error } = await supabase.from("business_hours").insert(rows);
            if (error) throw error;

            // Save slot duration to ai_settings
            let updateQuery = supabase.from("ai_settings").update({ slot_duration_minutes: slotDuration });
            if (activeWorkspaceId) {
                updateQuery = updateQuery.eq("id", activeWorkspaceId);
            } else {
                updateQuery = updateQuery.eq("user_id", user.id);
            }
            await updateQuery;

            toast.success("Schedule Saved", { description: "Your working hours have been updated." });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);
        } catch (err: any) {
            console.error("Failed to save hours:", err);
            toast.error("Failed to save schedule: " + (err?.message || "Unknown error"));
        } finally {
            setSaving(false);
        }
    };

    const updateDay = (day: number, updates: Partial<DaySchedule>) => {
        setHours((prev) => prev.map((h) => (h.day === day ? { ...h, ...updates } : h)));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    const openDays = hours.filter((h) => h.isOpen).length;

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Working Hours</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Set your weekly availability. The AI uses this to offer appointment times.
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={clsx(
                            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all press",
                            success
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
                        )}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : success ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {success ? "Saved!" : "Save Schedule"}
                    </button>
                </div>
            </motion.div>

            {/* Session Duration */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Session Duration</h2>
                        <p className="text-[11px] text-muted-foreground">
                            Default length for each appointment slot
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setSlotDuration(opt.value)}
                            className={clsx(
                                "px-4 py-2 rounded-xl text-sm font-medium transition-all border press",
                                slotDuration === opt.value
                                    ? "bg-primary/15 border-primary/30 text-primary shadow-sm"
                                    : "bg-surface-2 border-border text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Summary Bar */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-4 px-5 py-3 bg-surface-1 border border-border rounded-xl"
            >
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">{openDays}</span> days open
                    </span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400/60" />
                    <span className="text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">{7 - openDays}</span> days closed
                    </span>
                </div>
                <div className="w-px h-4 bg-border" />
                <span className="text-xs text-muted-foreground">
                    Appointment slots: <span className="font-bold text-foreground">{slotDuration} min</span>
                </span>
            </motion.div>

            {/* Day Cards */}
            <div className="grid gap-3">
                {hours.map((h, i) => (
                    <motion.div
                        key={h.day}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * (i + 3) }}
                        className={clsx(
                            "bg-surface-1 border shadow-sm rounded-2xl p-4 md:p-5 transition-all",
                            h.isOpen ? "border-border" : "border-border/50 opacity-60"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            {/* Day Name */}
                            <div className="w-24 md:w-32 shrink-0">
                                <span className="text-sm font-bold text-foreground">{h.label}</span>
                            </div>

                            {/* Toggle */}
                            <div
                                className="cursor-pointer shrink-0"
                                onClick={() => updateDay(h.day, { isOpen: !h.isOpen })}
                            >
                                <div
                                    className={clsx(
                                        "relative w-11 rounded-full transition-colors duration-300",
                                        h.isOpen ? "bg-emerald-500" : "bg-surface-3 border border-border"
                                    )}
                                    style={{ height: "24px" }}
                                >
                                    <motion.div
                                        className="absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white shadow-sm"
                                        animate={{ x: h.isOpen ? 22 : 2 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                </div>
                            </div>

                            {/* Status */}
                            <span
                                className={clsx(
                                    "text-xs font-semibold shrink-0 w-14",
                                    h.isOpen ? "text-emerald-400" : "text-red-400/60"
                                )}
                            >
                                {h.isOpen ? "Open" : "Closed"}
                            </span>

                            {/* Time Inputs */}
                            <AnimatePresence>
                                {h.isOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: "auto" }}
                                        exit={{ opacity: 0, width: 0 }}
                                        className="flex items-center gap-2 md:gap-3 overflow-hidden"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                            <input
                                                type="time"
                                                value={h.openTime}
                                                onChange={(e) => updateDay(h.day, { openTime: e.target.value })}
                                                className="input-premium !py-1.5 !px-2 !text-xs w-[100px] md:w-[110px]"
                                            />
                                        </div>
                                        <span className="text-muted-foreground text-xs">→</span>
                                        <div className="flex items-center gap-1.5">
                                            <Moon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                            <input
                                                type="time"
                                                value={h.closeTime}
                                                onChange={(e) => updateDay(h.day, { closeTime: e.target.value })}
                                                className="input-premium !py-1.5 !px-2 !text-xs w-[100px] md:w-[110px]"
                                            />
                                        </div>
                                        <span className="hidden md:inline text-[10px] text-muted-foreground font-mono ml-2">
                                            {getHoursWorked(h.openTime, h.closeTime)}
                                        </span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Visual Timeline Bar (desktop only) */}
                            {h.isOpen && (
                                <div className="hidden lg:flex flex-1 items-center ml-auto">
                                    <div className="relative w-full h-2 bg-surface-3 rounded-full overflow-hidden">
                                        {(() => {
                                            const [oh, om] = h.openTime.split(":").map(Number);
                                            const [ch, cm] = h.closeTime.split(":").map(Number);
                                            const startPct = ((oh * 60 + om) / (24 * 60)) * 100;
                                            const endPct = ((ch * 60 + cm) / (24 * 60)) * 100;
                                            return (
                                                <div
                                                    className="absolute h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/40 rounded-full"
                                                    style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}