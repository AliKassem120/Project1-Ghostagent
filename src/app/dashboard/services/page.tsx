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
            return setFormError("Please enter a valid duration (min. 1 minute).");
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
        <div className="space-y-8 pb-10">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl font-bold tracking-tight text-white">Services</h1>
                <p className="text-sm text-slate-400 mt-1">
                    Define the services your AI agent can offer and book for customers.
                </p>
            </motion.div>

            {/* Create Form */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass-card rounded-2xl p-6 border border-white/[0.04]"
            >
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/[0.04]">
                    <div className="p-2.5 rounded-xl bg-purple-500/10">
                        <Plus className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Add New Service</h2>
                        <p className="text-[11px] text-slate-400">This service will be made available to the AI for booking.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
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

                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">
                                Price (USD) *
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
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(147,51,234,0.25)]"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {saving ? "Saving..." : "Add Service"}
                        </button>
                    </div>
                </form>
            </motion.div>

            {/* Services List */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-xl bg-purple-500/10">
                        <Briefcase className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Your Services</h2>
                        <p className="text-[11px] text-slate-400">{services.length} service{services.length !== 1 ? "s" : ""} defined</p>
                    </div>
                </div>

                {loading ? (
                    <div className="glass-card rounded-2xl border border-white/[0.04] flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                    </div>
                ) : services.length === 0 ? (
                    <div className="glass-card rounded-2xl border border-white/[0.04] flex flex-col items-center justify-center py-16 text-center relative overflow-hidden bg-slate-900/50">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
                            <Scissors className="w-7 h-7 text-purple-400" />
                        </div>
                        <h3 className="text-base font-bold text-white mb-1">No services yet</h3>
                        <p className="text-sm text-slate-400 max-w-xs">
                            Add your first service above — the AI will use these to answer customer queries and book appointments.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                        <AnimatePresence>
                            {services.map((service, i) => (
                                <motion.div
                                    key={service.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="glass-card rounded-xl border border-white/[0.04] p-4 flex items-center gap-4 group hover:border-purple-500/20 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                                        <Scissors className="w-5 h-5 text-purple-400" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{service.name}</p>
                                        {service.description && (
                                            <p className="text-xs text-slate-400 truncate mt-0.5">{service.description}</p>
                                        )}
                                    </div>

                                    <div className="hidden sm:flex items-center gap-4 shrink-0">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                            <DollarSign className="w-3.5 h-3.5 text-purple-400" />
                                            <span className="font-semibold text-white">${Number(service.price).toFixed(2)}</span>
                                        </div>
                                        <div className="w-px h-4 bg-white/[0.06]" />
                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                            <Clock className="w-3.5 h-3.5 text-purple-400" />
                                            <span>{service.duration_minutes} min</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDelete(service.id)}
                                        disabled={deletingId === service.id}
                                        className="shrink-0 p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/[0.08] transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
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