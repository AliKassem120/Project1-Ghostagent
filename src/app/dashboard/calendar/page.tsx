"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Loader2,
    User,
    Phone,
    Clock,
    Trash2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/contexts/ToastContext";

interface Appointment {
    id: string;
    customer_name: string | null;
    customer_phone: string | null;
    service: string;
    appointment_date: string;
    start_time: string;
    end_time: string | null;
    duration_minutes: number;
    status: string;
    instagram_handle: string | null;
    notes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
    confirmed: { label: "Confirmed", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: XCircle },
    completed: { label: "Completed", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: CheckCircle2 },
    no_show: { label: "No Show", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatTime12(time: string): string {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function CalendarPage() {
    const { user } = useAuth();
    const { activeWorkspaceId } = useWorkspace();
    const supabase = createClient();
    const toast = useToast();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const fetchAppointments = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
            const lastDay = new Date(year, month + 1, 0).getDate();
            const endOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;

            let query = supabase
                .from("appointments")
                .select("*")
                .gte("appointment_date", startOfMonth)
                .lte("appointment_date", endOfMonth)
                .order("start_time", { ascending: true });

            if (activeWorkspaceId) {
                query = query.eq("workspace_id", activeWorkspaceId);
            } else {
                query = query.eq("user_id", user.id).is("workspace_id", null);
            }

            const { data, error } = await query;
            if (error) throw error;
            setAppointments(data || []);
        } catch (err) {
            console.error("Failed to load appointments:", err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, activeWorkspaceId, year, month, supabase]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
        setSelectedDay(null);
    };
    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
        setSelectedDay(null);
    };
    const goToToday = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDay(today.getDate());
    };

    // Calendar grid
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarCells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) calendarCells.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarCells.push(i);
    while (calendarCells.length % 7 !== 0) calendarCells.push(null);

    // Appointments grouped by day
    const appointmentsByDay = useMemo(() => {
        const map: Record<number, Appointment[]> = {};
        appointments.forEach((a) => {
            const day = parseInt(a.appointment_date.split("-")[2]);
            if (!map[day]) map[day] = [];
            map[day].push(a);
        });
        return map;
    }, [appointments]);

    const selectedAppointments = selectedDay ? appointmentsByDay[selectedDay] || [] : [];
    const isToday = (day: number) => {
        const today = new Date();
        return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            const { error } = await supabase.from("appointments").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
            if (error) throw error;
            setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
            toast.success(`Status updated to ${newStatus}`);
        } catch (err: any) {
            toast.error("Failed to update status");
        }
    };

    const deleteAppointment = async (id: string) => {
        try {
            const { error } = await supabase.from("appointments").delete().eq("id", id);
            if (error) throw error;
            setAppointments((prev) => prev.filter((a) => a.id !== id));
            toast.success("Appointment deleted");
        } catch (err: any) {
            toast.error("Failed to delete appointment");
        }
    };

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendar</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    View and manage all booked appointments.
                </p>
            </motion.div>

            <div className="grid lg:grid-cols-[1fr_380px] gap-6">
                {/* Calendar Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-surface-1 border border-border shadow-sm rounded-2xl p-5 md:p-6"
                >
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-surface-2 transition-colors press">
                            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                        </button>
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-foreground">
                                {MONTHS[month]} {year}
                            </h2>
                            <button
                                onClick={goToToday}
                                className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5 hover:bg-primary/20 transition-colors press"
                            >
                                Today
                            </button>
                        </div>
                        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-surface-2 transition-colors press">
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {DAYS.map((d) => (
                            <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-2">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Cells */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-1">
                            {calendarCells.map((day, i) => {
                                if (day === null) {
                                    return <div key={`empty-${i}`} className="aspect-square" />;
                                }

                                const dayAppts = appointmentsByDay[day] || [];
                                const hasAppts = dayAppts.length > 0;
                                const isSelected = selectedDay === day;
                                const todayClass = isToday(day);

                                return (
                                    <button
                                        key={day}
                                        onClick={() => setSelectedDay(day)}
                                        className={clsx(
                                            "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all press text-sm relative",
                                            isSelected
                                                ? "bg-primary/15 border-2 border-primary/40 text-primary font-bold"
                                                : todayClass
                                                ? "bg-surface-2 border border-primary/20 text-foreground font-semibold"
                                                : "hover:bg-surface-2 text-foreground"
                                        )}
                                    >
                                        <span>{day}</span>
                                        {hasAppts && (
                                            <div className="flex gap-0.5">
                                                {dayAppts.slice(0, 3).map((a, j) => (
                                                    <div
                                                        key={j}
                                                        className={clsx(
                                                            "w-1.5 h-1.5 rounded-full",
                                                            a.status === "confirmed" && "bg-emerald-400",
                                                            a.status === "completed" && "bg-blue-400",
                                                            a.status === "cancelled" && "bg-red-400/50",
                                                            a.status === "no_show" && "bg-amber-400"
                                                        )}
                                                    />
                                                ))}
                                                {dayAppts.length > 3 && (
                                                    <span className="text-[8px] text-muted-foreground ml-0.5">+{dayAppts.length - 3}</span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-[10px] text-muted-foreground">Confirmed</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                            <span className="text-[10px] text-muted-foreground">Completed</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-400/50" />
                            <span className="text-[10px] text-muted-foreground">Cancelled</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                            <span className="text-[10px] text-muted-foreground">No Show</span>
                        </div>
                        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                            {appointments.filter((a) => a.status === "confirmed").length} upcoming
                        </span>
                    </div>
                </motion.div>

                {/* Day Detail Panel */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-surface-1 border border-border shadow-sm rounded-2xl p-5 md:p-6 self-start"
                >
                    {selectedDay ? (
                        <>
                            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
                                <div className="p-2 rounded-xl bg-primary/10">
                                    <CalendarIcon className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">
                                        {MONTHS[month]} {selectedDay}, {year}
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground">
                                        {selectedAppointments.length} appointment{selectedAppointments.length !== 1 ? "s" : ""}
                                    </p>
                                </div>
                            </div>

                            <AnimatePresence mode="popLayout">
                                {selectedAppointments.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedAppointments.map((appt) => {
                                            const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.confirmed;
                                            const StatusIcon = cfg.icon;
                                            return (
                                                <motion.div
                                                    key={appt.id}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className={clsx(
                                                        "p-4 rounded-xl border",
                                                        cfg.bg,
                                                        cfg.border
                                                    )}
                                                >
                                                    {/* Time & Service */}
                                                    <div className="flex items-center justify-between mb-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                                            <span className="text-xs font-bold text-foreground">
                                                                {formatTime12(appt.start_time)}
                                                            </span>
                                                        </div>
                                                        <span className={clsx("flex items-center gap-1 text-[9px] font-bold rounded-full px-2 py-0.5", cfg.bg, cfg.color, cfg.border, "border")}>
                                                            <StatusIcon className="w-2.5 h-2.5" />
                                                            {cfg.label}
                                                        </span>
                                                    </div>

                                                    {/* Service */}
                                                    <p className="text-sm font-semibold text-foreground mb-2">{appt.service}</p>

                                                    {/* Customer Info */}
                                                    <div className="space-y-1 mb-3">
                                                        {appt.customer_name && (
                                                            <div className="flex items-center gap-2">
                                                                <User className="w-3 h-3 text-muted-foreground" />
                                                                <span className="text-xs text-muted-foreground">{appt.customer_name}</span>
                                                            </div>
                                                        )}
                                                        {appt.customer_phone && (
                                                            <div className="flex items-center gap-2">
                                                                <Phone className="w-3 h-3 text-muted-foreground" />
                                                                <span className="text-xs text-muted-foreground font-mono">{appt.customer_phone}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1.5 pt-2 border-t border-border/50">
                                                        {appt.status !== "completed" && (
                                                            <button
                                                                onClick={() => updateStatus(appt.id, "completed")}
                                                                className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1 hover:bg-blue-500/20 transition-colors press"
                                                            >
                                                                Complete
                                                            </button>
                                                        )}
                                                        {appt.status !== "cancelled" && (
                                                            <button
                                                                onClick={() => updateStatus(appt.id, "cancelled")}
                                                                className="text-[10px] font-semibold text-red-400/70 bg-red-500/5 border border-red-500/10 rounded-lg px-2 py-1 hover:bg-red-500/10 transition-colors press"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                        {appt.status !== "no_show" && (
                                                            <button
                                                                onClick={() => updateStatus(appt.id, "no_show")}
                                                                className="text-[10px] font-semibold text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded-lg px-2 py-1 hover:bg-amber-500/10 transition-colors press"
                                                            >
                                                                No Show
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => deleteAppointment(appt.id)}
                                                            className="ml-auto text-red-400/40 hover:text-red-400 transition-colors press p-1"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex flex-col items-center justify-center py-12 text-center"
                                    >
                                        <div className="p-3 bg-surface-2 border border-border rounded-2xl mb-3">
                                            <CalendarIcon className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm text-muted-foreground">No appointments</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Bookings made via Instagram DMs will appear here.
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <CalendarIcon className="w-8 h-8 text-muted-foreground mb-3" />
                            <p className="text-sm text-muted-foreground">Select a day to view appointments</p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}