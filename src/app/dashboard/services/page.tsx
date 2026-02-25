"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Clock, DollarSign, Briefcase, Loader2, AlertCircle, Scissors } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

interface Service {
    id: string;
    name: string;
    description: string | null;
    price: number;
    duration_minutes: number;
    created_at: string;
}

const EMPTY_FORM = { name: "", description: "", price: "", duration_minutes: "30" };

export default function ServicesPage() {
    const supabase = createClient();
    const { user } = useAuth();
    const toast = useToast();

    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState<string | null>(null);

    const fetchServices = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("services")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            toast.error("Failed to load services.");
        } else {
            setServices(data || []);
        }
        setLoading(false);
    }, [user?.id]);

    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!form.name.trim()) return setFormError("Service name is required.");
        if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0)
            return setFormError("Please enter a valid price.");
        if (!form.duration_minutes || isNaN(Number(form.duration_minutes)) || Number(form.duration_minutes) < 1)
            return setFormError("Please enter a valid duration.");
        if (!user?.id) return;

        setSaving(true);
        const { error } = await supabase.from("services").insert({
            user_id: user.id,
            name: form.name.trim(),
            description: form.description.trim() || null,
            price: Number(form.price),
            duration_minutes: Number(form.duration_minutes),
        });

        if (error) {
            toast.error("Failed to create service: " + error.message);
        } else {
            toast.success("Service created!");
            setForm(EMPTY_FORM);
            fetchServices();
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        const { error } = await supabase.from("services").delete().eq("id", id);
        if (error) {
            toast.error("Failed to delete service.");
        } else {
            toast.success("Service deleted.");
            setServices((prev) => prev.filter((s) => s.id !== id));
        }
        setDeletingId(null);
    };

    return (
        <div className="space-y-6 pb-8">

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl font-bold tracking-tight text-white">Services</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Define the services your AI agent can offer and book for your customers.
                </p>
            </motion.div>

            {/* Create Form Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass-card rounded-2xl p-6"
            >
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.04]">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                        <Plus className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Add New Service</h2>
                        <p className="text-[11px] text-muted-foreground">This will be made available to the AI agent for booking.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Row 1: Name + Description */}
                    <div className="grid md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">
                                Service Name *
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Acrylic Nails"
                                className="input-premium w-full"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">
                                Description
                            </label>
                            <input
                                type="text"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Optional short description"
                                className="input-premium w-full"
                            />
                        </div>
                    </div>

                    {/* Row 2: Price + Duration */}
                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">
                                Price *
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.price}
                                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                                    placeholder="0.00"
                                    className="input-premium w-full pl-9"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">
                                Duration (minutes) *
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                                <input
                                    type="number"
                                    min="1"
                                    value={form.duration_minutes}
                                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                                    placeholder="30"
                                    className="input-premium w-full pl-9"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Error message */}
                    <AnimatePresence>
                        {formError && (
                            <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                className="flex items-center gap-2 text-red-400 text-sm px-1"
                            >
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {formError}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex justify-end pt-1">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-black text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {saving ? "Saving..." : "Add Service"}
                        </button>
                    </div>
                </form>
            </motion.div>

            {/* Services List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card rounded-2xl overflow-hidden"
            >
                {/* Section Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/5">
                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">Your Services</h3>
                        {services.length > 0 && (
                            <span className="badge bg-white/[0.06] text-white/35 font-mono">
                                {services.length}
                            </span>
                        )}
                    </div>
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : services.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                            <Scissors className="w-6 h-6 text-white/10" />
                        </div>
                        <p className="text-sm font-medium text-white/20 mb-1">No services yet</p>
                        <p className="text-[12px] text-white/10 leading-relaxed max-w-xs">
                            Add your first service above — the AI will use these to answer customer queries and book appointments.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.03]">
                        <AnimatePresence>
                            {services.map((service, i) => (
                                <motion.div
                                    key={service.id}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ delay: i < 5 ? i * 0.04 : 0 }}
                                    className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-all group cursor-default"
                                >
                                    <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                                        <Scissors className="w-4 h-4 text-primary" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white/90 truncate">{service.name}</p>
                                        {service.description && (
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">{service.description}</p>
                                        )}
                                    </div>

                                    <div className="hidden sm:flex items-center gap-4 shrink-0">
                                        <div className="flex items-center gap-1.5">
                                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                            <span className="text-sm font-semibold text-white">{Number(service.price).toFixed(2)}</span>
                                        </div>
                                        <div className="w-px h-4 bg-white/[0.06]" />
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                                            <span>{service.duration_minutes} min</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDelete(service.id)}
                                        disabled={deletingId === service.id}
                                        className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/[0.08] transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 press"
                                        title="Delete service"
                                    >
                                        {deletingId === service.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </motion.div>
        </div>
    );
}