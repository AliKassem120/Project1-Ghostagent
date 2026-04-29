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
import { useRealtime } from "@/contexts/RealtimeContext";
import { Plus, Search, Filter, Info, MapPin, ExternalLink, CalendarDays, ListFilter } from "lucide-react";

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
    source?: 'instagram' | 'manual';
}

interface BusinessHours {
    day_of_week: number;
    is_open: boolean;
    open_time: string;
    close_time: string;
}

interface Service {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
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
    const { lastUpdate } = useRealtime();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [businessHours, setBusinessHours] = useState<Record<number, BusinessHours>>({});
    const [services, setServices] = useState<Service[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [showModal, setShowModal] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const fetchData = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
            const lastDay = new Date(year, month + 1, 0).getDate();
            const endOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;

            // 1. Appointments
            let apptQuery = supabase
                .from("appointments")
                .select("*")
                .gte("appointment_date", startOfMonth)
                .lte("appointment_date", endOfMonth)
                .order("start_time", { ascending: true });

            if (activeWorkspaceId) {
                apptQuery = apptQuery.eq("workspace_id", activeWorkspaceId);
            } else {
                apptQuery = apptQuery.eq("user_id", user.id).is("workspace_id", null);
            }

            // 2. Business Hours
            let hoursQuery = supabase.from("business_hours").select("*");
            if (activeWorkspaceId) hoursQuery = hoursQuery.eq("workspace_id", activeWorkspaceId);
            else hoursQuery = hoursQuery.eq("user_id", user.id).is("workspace_id", null);

            // 3. AI Settings
            let settingsQuery = supabase.from("ai_settings").select("*");
            if (activeWorkspaceId) settingsQuery = settingsQuery.eq("id", activeWorkspaceId);
            else settingsQuery = settingsQuery.eq("user_id", user.id).is("id", null);

            // 4. Services
            let servicesQuery = supabase.from("services").select("*");
            if (activeWorkspaceId) servicesQuery = servicesQuery.eq("workspace_id", activeWorkspaceId);
            else servicesQuery = servicesQuery.eq("user_id", user.id).is("workspace_id", null);

            const [apptsRes, hoursRes, settingsRes, servicesRes] = await Promise.all([
                apptQuery,
                hoursQuery,
                settingsQuery.maybeSingle(),
                servicesQuery
            ]);

            if (apptsRes.error) throw apptsRes.error;
            setAppointments(apptsRes.data || []);

            const hoursMap: Record<number, BusinessHours> = {};
            (hoursRes.data || []).forEach((h: BusinessHours) => {
                hoursMap[h.day_of_week] = h;
            });
            setBusinessHours(hoursMap);

            setSettings(settingsRes.data);
            setServices(servicesRes.data || []);

        } catch (err) {
            console.error("Failed to load dashboard data:", err);
            toast.error("Failed to refresh calendar data");
        } finally {
            setLoading(false);
        }
    }, [user?.id, activeWorkspaceId, year, month, supabase, toast, lastUpdate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

    const stats = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        return {
            todayCount: appointments.filter(a => a.appointment_date === todayStr).length,
            confirmed: appointments.filter(a => a.status === 'confirmed').length,
            completed: appointments.filter(a => a.status === 'completed').length,
            cancelled: appointments.filter(a => a.status === 'cancelled' || a.status === 'no_show').length
        };
    }, [appointments]);

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

    const selectedDate = selectedDay ? new Date(year, month, selectedDay) : null;
    const dayOfWeek = selectedDate ? selectedDate.getDay() : null;
    const hours = dayOfWeek !== null ? businessHours[dayOfWeek] : null;
    const slotDuration = settings?.slot_duration_minutes || 60;
    
    const availableSlots = useMemo(() => {
        if (!hours || !hours.is_open) return 0;
        const [startH, startM] = hours.open_time.split(':').map(Number);
        const [endH, endM] = hours.close_time.split(':').map(Number);
        const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        const totalSlots = Math.floor(totalMinutes / slotDuration);
        return Math.max(0, totalSlots - selectedAppointments.length);
    }, [hours, selectedAppointments, slotDuration]);

    const addManualAppointment = async (data: any) => {
        try {
            const { error } = await supabase.from("appointments").insert({
                ...data,
                user_id: user?.id,
                workspace_id: activeWorkspaceId,
                status: 'confirmed'
            });
            if (error) throw error;
            fetchData();
            setShowModal(false);
            toast.success("Appointment added manually");
        } catch (err: any) {
            toast.error("Failed to add appointment");
        }
    };

    return (
        <div className="space-y-6 pb-8">
            {/* Header & Main Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <CalendarIcon className="w-6 h-6 text-primary" />
                        Calendar Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Professional appointment operations & scheduling.
                    </p>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, x: 10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2"
                >
                    <div className="relative group hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search customer or service..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 pl-9 pr-4 rounded-xl bg-surface-1 border border-border focus:border-primary outline-none text-sm transition-all w-48 lg:w-64"
                        />
                    </div>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="h-10 px-4 rounded-xl bg-primary text-white font-bold text-sm flex items-center gap-2 hover:bg-primary-hover transition-colors press shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        Add Appointment
                    </button>
                </motion.div>
            </div>

            {/* Stats Summary Bar */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
                {[
                    { label: "Today", value: stats.todayCount, icon: Clock, color: "text-primary", bg: "bg-primary/10" },
                    { label: "Confirmed", value: stats.confirmed, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { label: "Completed", value: stats.completed, icon: User, color: "text-blue-400", bg: "bg-blue-500/10" },
                    { label: "Cancelled", value: stats.cancelled, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
                ].map((s, idx) => (
                    <div key={idx} className="bg-surface-1 border border-border p-4 rounded-2xl flex items-center gap-4">
                        <div className={clsx("p-2.5 rounded-xl", s.bg)}>
                            <s.icon className={clsx("w-5 h-5", s.color)} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                            <p className="text-xl font-black text-foreground">{s.value}</p>
                        </div>
                    </div>
                ))}
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
                                const isTodayCell = isToday(day);
                                
                                // Business Hours Context
                                const dayOfWeek = new Date(year, month, day).getDay();
                                const hoursForDay = businessHours[dayOfWeek];
                                const isClosed = hoursForDay && !hoursForDay.is_open;

                                return (
                                    <button
                                        key={day}
                                        onClick={() => setSelectedDay(day)}
                                        className={clsx(
                                            "aspect-square rounded-xl flex flex-col items-center justify-between p-1.5 md:p-2 transition-all press text-sm relative border",
                                            isSelected
                                                ? "bg-primary/10 border-primary/40 text-primary font-bold ring-2 ring-primary/20"
                                                : isTodayCell
                                                ? "bg-surface-2 border-primary/20 text-foreground font-semibold"
                                                : isClosed
                                                ? "bg-red-500/5 border-red-500/10 opacity-70"
                                                : "bg-surface-1 border-border hover:bg-surface-2 text-foreground"
                                        )}
                                    >
                                        <div className="w-full flex items-center justify-between">
                                            <span className={clsx(
                                                "text-xs",
                                                isTodayCell && "bg-primary text-white w-5 h-5 flex items-center justify-center rounded-full"
                                            )}>{day}</span>
                                            {hasAppts && (
                                                <span className="text-[10px] font-bold bg-primary/10 text-primary px-1 rounded-md">
                                                    {dayAppts.length}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap justify-center gap-0.5 mt-auto">
                                            {isClosed ? (
                                                <span className="text-[8px] font-bold text-red-500/60 uppercase">Closed</span>
                                            ) : (
                                                <>
                                                    {dayAppts.slice(0, 4).map((a, j) => (
                                                        <div
                                                            key={j}
                                                            className={clsx(
                                                                "w-1.5 h-1.5 rounded-full",
                                                                a.status === "confirmed" && "bg-emerald-400",
                                                                a.status === "completed" && "bg-blue-400",
                                                                a.status === "cancelled" && "bg-red-400",
                                                                a.status === "no_show" && "bg-amber-400"
                                                            )}
                                                        />
                                                    ))}
                                                </>
                                            )}
                                        </div>
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
                    className="bg-surface-1 border border-border shadow-sm rounded-2xl p-5 md:p-6 self-start flex flex-col gap-6"
                >
                    {selectedDay ? (
                        <>
                            {/* Panel Header */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
                                        {DAYS[dayOfWeek!]} Summary
                                    </p>
                                    <h3 className="text-xl font-bold text-foreground">
                                        {MONTHS[month]} {selectedDay}, {year}
                                    </h3>
                                </div>
                                <div className="p-2.5 rounded-xl bg-primary/10">
                                    <CalendarIcon className="w-5 h-5 text-primary" />
                                </div>
                            </div>

                            {/* Daily Context Info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl bg-surface-2 border border-border">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-3 h-3 text-muted-foreground" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Working Hours</span>
                                    </div>
                                    <p className="text-xs font-bold text-foreground">
                                        {hours?.is_open ? `${formatTime12(hours.open_time)} - ${formatTime12(hours.close_time)}` : "Closed"}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-surface-2 border border-border">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ListFilter className="w-3 h-3 text-muted-foreground" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Availability</span>
                                    </div>
                                    <p className="text-xs font-bold text-foreground">
                                        {availableSlots} slots left
                                    </p>
                                </div>
                            </div>

                            {/* Appointment List */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-bold text-foreground">Appointments</h4>
                                    <span className="text-[10px] font-bold text-muted-foreground bg-surface-2 px-2 py-0.5 rounded-full border border-border">
                                        {selectedAppointments.length} total
                                    </span>
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
                                                            "p-4 rounded-xl border relative overflow-hidden group",
                                                            cfg.bg,
                                                            cfg.border
                                                        )}
                                                    >
                                                        {/* Status Bar */}
                                                        <div className={clsx("absolute left-0 top-0 bottom-0 w-1", cfg.color.replace('text-', 'bg-'))} />
                                                        
                                                        {/* Time & Service */}
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                                                <span className="text-xs font-bold text-foreground">
                                                                    {formatTime12(appt.start_time)}
                                                                </span>
                                                            </div>
                                                            <span className={clsx("flex items-center gap-1 text-[9px] font-bold rounded-full px-2 py-0.5 border", cfg.bg, cfg.color, cfg.border)}>
                                                                <StatusIcon className="w-2.5 h-2.5" />
                                                                {cfg.label}
                                                            </span>
                                                        </div>

                                                        {/* Service */}
                                                        <p className="text-sm font-bold text-foreground mb-3">{appt.service}</p>

                                                        {/* Customer Info */}
                                                        <div className="flex flex-wrap gap-4 mb-4">
                                                            {appt.customer_name && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <User className="w-3 h-3 text-muted-foreground" />
                                                                    <span className="text-[11px] text-muted-foreground font-medium">{appt.customer_name}</span>
                                                                </div>
                                                            )}
                                                            {appt.customer_phone && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Phone className="w-3 h-3 text-muted-foreground" />
                                                                    <span className="text-[11px] text-muted-foreground font-mono">{appt.customer_phone}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Quick Actions */}
                                                        <div className="flex items-center gap-1.5 pt-3 border-t border-border/20">
                                                            {appt.status !== "completed" && (
                                                                <button
                                                                    onClick={() => updateStatus(appt.id, "completed")}
                                                                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                                                >
                                                                    Complete
                                                                </button>
                                                            )}
                                                            {appt.status !== "cancelled" && (
                                                                <button
                                                                    onClick={() => updateStatus(appt.id, "cancelled")}
                                                                    className="text-[10px] font-bold text-red-400/70 hover:text-red-400 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            )}
                                                            {appt.status !== "no_show" && (
                                                                <button
                                                                    onClick={() => updateStatus(appt.id, "no_show")}
                                                                    className="text-[10px] font-bold text-amber-400/70 hover:text-amber-400 transition-colors"
                                                                >
                                                                    No Show
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => deleteAppointment(appt.id)}
                                                                className="ml-auto text-muted-foreground/30 hover:text-red-400 transition-colors p-1"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-10 text-center bg-surface-2/50 border border-dashed border-border rounded-2xl">
                                            <CalendarDays className="w-6 h-6 text-muted-foreground/50 mb-2" />
                                            <p className="text-xs text-muted-foreground font-medium">No appointments scheduled</p>
                                            <button 
                                                onClick={() => setShowModal(true)}
                                                className="mt-3 text-[10px] font-bold text-primary hover:underline"
                                            >
                                                + Add Manual Appointment
                                            </button>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Side Panel Footer Actions */}
                            <div className="pt-4 border-t border-border flex flex-col gap-2">
                                <button 
                                    onClick={() => setShowModal(true)}
                                    className="w-full h-10 rounded-xl bg-surface-2 border border-border text-sm font-bold text-foreground hover:bg-surface-3 transition-colors press flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Book Manually
                                </button>
                                <button 
                                    onClick={() => window.location.href = '/dashboard/hours'}
                                    className="w-full h-10 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                                >
                                    Edit Working Hours
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <CalendarDays className="w-10 h-10 text-muted-foreground/20 mb-4" />
                            <p className="text-sm text-muted-foreground">Select a day to view details</p>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Manual Appointment Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-surface-1 border border-border shadow-2xl rounded-3xl p-6 w-full max-w-lg relative z-10"
                        >
                            <h2 className="text-xl font-bold text-foreground mb-1">New Appointment</h2>
                            <p className="text-sm text-muted-foreground mb-6">Schedule a customer manually for {MONTHS[month]} {selectedDay}, {year}.</p>
                            
                            <form onSubmit={(e: any) => {
                                e.preventDefault();
                                const formData = new FormData(e.target);
                                addManualAppointment({
                                    customer_name: formData.get('customer_name'),
                                    customer_phone: formData.get('customer_phone'),
                                    service: formData.get('service'),
                                    appointment_date: `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`,
                                    start_time: formData.get('start_time'),
                                    notes: formData.get('notes'),
                                    source: 'manual'
                                });
                            }} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Service</label>
                                        <select name="service" required className="w-full h-11 bg-surface-2 border border-border rounded-xl px-3 text-sm focus:border-primary outline-none appearance-none">
                                            {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                            {!services.length && <option value="General Service">General Service</option>}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Start Time</label>
                                        <input type="time" name="start_time" required className="w-full h-11 bg-surface-2 border border-border rounded-xl px-3 text-sm focus:border-primary outline-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Customer Name</label>
                                    <input type="text" name="customer_name" placeholder="John Doe" required className="w-full h-11 bg-surface-2 border border-border rounded-xl px-4 text-sm focus:border-primary outline-none" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Phone Number</label>
                                    <input type="tel" name="customer_phone" placeholder="+961..." className="w-full h-11 bg-surface-2 border border-border rounded-xl px-4 text-sm focus:border-primary outline-none" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Notes</label>
                                    <textarea name="notes" rows={2} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none resize-none" placeholder="Optional notes..."></textarea>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 h-12 rounded-2xl border border-border text-sm font-bold text-foreground hover:bg-surface-2 transition-colors press">Cancel</button>
                                    <button type="submit" className="flex-1 h-12 rounded-2xl bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors press">Schedule</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}