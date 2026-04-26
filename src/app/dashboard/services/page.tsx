"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Clock, DollarSign, Briefcase, Loader2, AlertCircle, ClipboardList, Edit2, Save, X, Search, Sparkles, Power, Tag, Copy } from "lucide-react";
import { clsx } from "clsx";
import { useToast } from "@/contexts/ToastContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import GhostModal from "@/components/GhostModal";

const CATEGORIES = ["Hair", "Nails", "Beauty", "Consultation", "Clinic", "Other"] as const;

interface Service {
    id: string;
    name: string;
    description: string | null;
    price: number;
    duration_minutes: number;
    is_active: boolean;
    aliases: string[];
    category: string | null;
    buffer_before: number;
    buffer_after: number;
    created_at: string;
}

type FormState = {
    name: string; description: string; price: string; duration_minutes: string;
    is_active: boolean; aliases: string[]; aliasInput: string;
    category: string; buffer_before: string; buffer_after: string;
};

const EMPTY_FORM: FormState = {
    name: "", description: "", price: "", duration_minutes: "30",
    is_active: true, aliases: [], aliasInput: "",
    category: "", buffer_before: "0", buffer_after: "0",
};

export default function ServicesPage() {
    const supabase = createClient();
    const { user } = useAuth();
    const { activeWorkspaceId } = useWorkspace();
    const toast = useToast();

    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [formError, setFormError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<FormState>(EMPTY_FORM);
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string | null; name: string }>({ open: false, id: null, name: "" });

    const fetchServices = useCallback(async () => {
        if (!activeWorkspaceId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("services")
            .select("id, name, description, price, duration_minutes, is_active, aliases, category, buffer_before, buffer_after, created_at")
            .eq("workspace_id", activeWorkspaceId)
            .order("created_at", { ascending: false });

        if (error) {
            toast.error("Failed to load services.");
        } else {
            setServices((data || []).map((s: any) => ({ ...s, is_active: s.is_active ?? true, aliases: s.aliases || [], buffer_before: s.buffer_before ?? 0, buffer_after: s.buffer_after ?? 0 })));
        }
        setLoading(false);
    }, [activeWorkspaceId]);

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
            workspace_id: activeWorkspaceId,
            name: form.name.trim(),
            description: form.description.trim() || null,
            price: Number(form.price),
            duration_minutes: Number(form.duration_minutes),
            is_active: form.is_active,
            aliases: form.aliases.filter(a => a.trim()),
            category: form.category || null,
            buffer_before: Number(form.buffer_before) || 0,
            buffer_after: Number(form.buffer_after) || 0,
        });

        if (error) {
            toast.error("Failed to create service: " + error.message);
        } else {
            toast.success("Service Created", { description: `"${form.name}" is now available for booking.` });
            setForm(EMPTY_FORM);
            setIsAdding(false);
            fetchServices();
        }
        setSaving(false);
    };

    const handleEditClick = (s: Service) => {
        setEditingId(s.id);
        setEditValues({
            name: s.name,
            description: s.description || "",
            price: s.price.toString(),
            duration_minutes: s.duration_minutes.toString(),
            is_active: s.is_active,
            aliases: s.aliases || [],
            aliasInput: "",
            category: s.category || "",
            buffer_before: (s.buffer_before || 0).toString(),
            buffer_after: (s.buffer_after || 0).toString(),
        });
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editValues.name.trim()) return;
        const { error } = await supabase.from("services").update({
            name: editValues.name.trim(),
            description: editValues.description.trim() || null,
            price: Number(editValues.price) || 0,
            duration_minutes: Number(editValues.duration_minutes) || 30,
            is_active: editValues.is_active,
            aliases: editValues.aliases.filter(a => a.trim()),
            category: editValues.category || null,
            buffer_before: Number(editValues.buffer_before) || 0,
            buffer_after: Number(editValues.buffer_after) || 0,
        }).eq("id", editingId);

        if (error) {
            toast.error("Failed to update service.");
        } else {
            toast.success("Service Updated");
            setEditingId(null);
            fetchServices();
        }
    };

    const handleToggleActive = async (s: Service) => {
        const { error } = await supabase.from("services").update({ is_active: !s.is_active }).eq("id", s.id);
        if (!error) {
            toast.success(s.is_active ? "Service Deactivated" : "Service Activated");
            fetchServices();
        }
    };

    const handleDuplicate = async (s: Service) => {
        if (!user?.id) return;
        const { error } = await supabase.from("services").insert({
            user_id: user.id,
            workspace_id: activeWorkspaceId,
            name: s.name + " (Copy)",
            description: s.description,
            price: s.price,
            duration_minutes: s.duration_minutes,
            is_active: false,
            aliases: s.aliases || [],
            category: s.category,
            buffer_before: s.buffer_before,
            buffer_after: s.buffer_after,
        });
        if (!error) { toast.success("Service Duplicated"); fetchServices(); }
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from("services").delete().eq("id", id);
        if (error) {
            toast.error("Failed to delete service.");
        } else {
            toast.success("Service Deleted");
            setServices((prev) => prev.filter((s) => s.id !== id));
        }
        setDeleteModal({ open: false, id: null, name: "" });
    };

    const filtered = searchQuery.trim()
        ? services.filter((s) => {
            const q = searchQuery.toLowerCase();
            return s.name.toLowerCase().includes(q) || (s.aliases || []).some(a => a.toLowerCase().includes(q));
        })
        : services;

    const activeCount = services.filter(s => s.is_active).length;
    const totalRevenuePotential = services.reduce((sum, s) => sum + s.price, 0);
    const avgDuration = services.length > 0 ? Math.round(services.reduce((sum, s) => sum + s.duration_minutes, 0) / services.length) : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Services</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Define the services your AI agent can offer and book.
                    </p>
                </div>
                <button
                    onClick={() => { setIsAdding(true); setForm(EMPTY_FORM); setFormError(null); }}
                    className="w-full sm:w-auto px-6 py-3 bg-primary text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-95 text-sm"
                >
                    <Plus className="w-5 h-5" /> Add Service
                </button>
            </motion.div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: Briefcase, label: "Total Services", value: services.length, color: "text-violet-400", bg: "bg-violet-500/10" },
                    { icon: DollarSign, label: "Avg. Price", value: services.length > 0 ? `$${(totalRevenuePotential / services.length).toFixed(0)}` : "$0", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { icon: Clock, label: "Avg. Duration", value: `${avgDuration}m`, color: "text-blue-400", bg: "bg-blue-500/10" },
                    { icon: Sparkles, label: "AI Active", value: `${activeCount}/${services.length}`, color: activeCount > 0 ? "text-emerald-400" : "text-amber-400", bg: activeCount > 0 ? "bg-emerald-500/10" : "bg-amber-500/10" },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 + i * 0.05 }}
                        className="bg-surface-1 border border-border shadow-sm rounded-2xl p-5"
                    >
                        <div className={clsx("p-2 rounded-xl w-fit mb-3", stat.bg)}>
                            <stat.icon className={clsx("w-4 h-4", stat.color)} />
                        </div>
                        <div className="text-xl font-bold text-foreground tracking-tight">{stat.value}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* Search */}
            {services.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search services..."
                        className="input-premium w-full !pl-10 py-3"
                    />
                </motion.div>
            )}

            {/* Add Form */}
            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-surface-1 border-2 border-primary/20 shadow-sm rounded-2xl p-6 space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-border">
                                <div className="p-2 rounded-xl bg-primary/10">
                                    <Plus className="w-4 h-4 text-primary" />
                                </div>
                                <h3 className="font-bold text-foreground">New Service</h3>
                                <button onClick={() => setIsAdding(false)} className="ml-auto p-2 hover:bg-surface-2 rounded-xl transition-colors">
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Service Name *</label>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="e.g. Acrylic Nails"
                                            className="input-premium w-full"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Description</label>
                                        <input
                                            type="text"
                                            value={form.description}
                                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                                            placeholder="Optional short description"
                                            className="input-premium w-full"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Price (USD) *</label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">$</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={form.price}
                                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                                                placeholder="0.00"
                                                className="input-premium w-full !pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Duration (min) *</label>
                                        <div className="relative">
                                            <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                            <input
                                                type="number"
                                                min="1"
                                                value={form.duration_minutes}
                                                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                                                placeholder="30"
                                                className="input-premium w-full !pl-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Aliases */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Aliases / Keywords <span className="text-primary/60">(for AI matching)</span></label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {form.aliases.map((a, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-lg">
                                                {a}
                                                <button type="button" onClick={() => setForm({ ...form, aliases: form.aliases.filter((_, j) => j !== i) })} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                                            </span>
                                        ))}
                                    </div>
                                    <input type="text" value={form.aliasInput} onChange={(e) => setForm({ ...form, aliasInput: e.target.value })}
                                        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ',') && form.aliasInput.trim()) { e.preventDefault(); setForm({ ...form, aliases: [...form.aliases, form.aliasInput.trim()], aliasInput: "" }); } }}
                                        placeholder="Type alias and press Enter (e.g. haircut, قص شعر, 7ale2)" className="input-premium w-full" />
                                </div>

                                {/* Category + Buffer + Active */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Category</label>
                                        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-premium w-full">
                                            <option value="">None</option>
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Buffer Before</label>
                                        <select value={form.buffer_before} onChange={(e) => setForm({ ...form, buffer_before: e.target.value })} className="input-premium w-full">
                                            {[0,5,10,15,30].map(v => <option key={v} value={String(v)}>{v} min</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Buffer After</label>
                                        <select value={form.buffer_after} onChange={(e) => setForm({ ...form, buffer_after: e.target.value })} className="input-premium w-full">
                                            {[0,5,10,15,30].map(v => <option key={v} value={String(v)}>{v} min</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Status</label>
                                        <button type="button" onClick={() => setForm({ ...form, is_active: !form.is_active })}
                                            className={clsx("w-full py-2.5 rounded-xl text-sm font-bold transition-all border", form.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-surface-2 text-muted-foreground border-border")}>
                                            {form.is_active ? "Active" : "Inactive"}
                                        </button>
                                    </div>
                                </div>


                                <AnimatePresence>
                                    {formError && (
                                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                            className="flex items-center gap-2 text-red-400 text-sm px-1">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            {formError}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="submit"
                                        disabled={saving || !form.name.trim()}
                                        className="flex-1 sm:flex-none px-8 py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {saving ? "Saving..." : "Save Service"}
                                    </button>
                                    <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-3 bg-surface-2 text-muted-foreground rounded-xl hover:bg-surface-3 transition-colors">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Service List */}
            <div className="space-y-3">
                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3">
                    {filtered.map((service, i) => {
                        const isEditing = editingId === service.id;
                        return (
                            <motion.div
                                key={service.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="bg-surface-1 border border-border shadow-sm rounded-2xl p-5 group"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", service.is_active ? "bg-primary/10" : "bg-surface-2")}>
                                            <ClipboardList className={clsx("w-5 h-5", service.is_active ? "text-primary/70" : "text-muted-foreground/40")} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            {isEditing ? (
                                                <input className="input-premium py-1 px-3 w-full text-base font-bold mb-1" value={editValues.name}
                                                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <h3 className={clsx("font-bold text-base truncate", service.is_active ? "text-foreground" : "text-muted-foreground")}>{service.name}</h3>
                                                    <span className={clsx("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md shrink-0", service.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>{service.is_active ? "Active" : "Off"}</span>
                                                </div>
                                            )}
                                            {!isEditing && service.description && (
                                                <p className="text-xs text-muted-foreground truncate">{service.description}</p>
                                            )}
                                            {!isEditing && service.aliases?.length > 0 && (
                                                <p className="text-[10px] text-primary/50 truncate mt-0.5"><Tag className="w-3 h-3 inline mr-1" />{service.aliases.length} alias{service.aliases.length > 1 ? "es" : ""}</p>
                                            )}
                                        </div>
                                    </div>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            <button onClick={handleSaveEdit} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"><Save className="w-4 h-4" /></button>
                                            <button onClick={() => setEditingId(null)} className="p-2 text-muted-foreground hover:bg-surface-2 rounded-xl transition-all"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            <button onClick={() => handleEditClick(service)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => handleDuplicate(service)} className="p-2 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all" title="Duplicate"><Copy className="w-4 h-4" /></button>
                                            <button onClick={() => handleToggleActive(service)} className={clsx("p-2 rounded-xl transition-all", service.is_active ? "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10" : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10")} title={service.is_active ? "Deactivate" : "Activate"}><Power className="w-4 h-4" /></button>
                                            <button onClick={() => setDeleteModal({ open: true, id: service.id, name: service.name })} className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Price</p>
                                        {isEditing ? (
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">$</span>
                                                <input type="number" className="input-premium py-1.5 pl-8 pr-2 w-full text-base font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                    value={editValues.price} onChange={(e) => setEditValues({ ...editValues, price: e.target.value })} />
                                            </div>
                                        ) : (
                                            <p className="text-lg font-bold text-emerald-400">${Number(service.price).toFixed(2)}</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Duration</p>
                                        {isEditing ? (
                                            <input type="number" className="input-premium py-1.5 px-3 w-full text-base font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                value={editValues.duration_minutes} onChange={(e) => setEditValues({ ...editValues, duration_minutes: e.target.value })} />
                                        ) : (
                                            <p className="text-lg font-bold text-foreground">{service.duration_minutes}m</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Desktop Table */}
                <div className="hidden lg:block bg-surface-1 border border-border shadow-sm rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Service</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Price</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Duration</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Aliases</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {filtered.map((service) => {
                                const isEditing = editingId === service.id;
                                return (
                                    <tr key={service.id} className={clsx("hover:bg-surface-2 transition-colors group", !service.is_active && "opacity-60")}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", service.is_active ? "bg-primary/10" : "bg-surface-2")}>
                                                    <ClipboardList className={clsx("w-4 h-4", service.is_active ? "text-primary/60" : "text-muted-foreground/40")} />
                                                </div>
                                                {isEditing ? (
                                                    <input className="input-premium py-1 px-3 w-40 text-sm font-semibold" value={editValues.name} autoFocus
                                                        onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} />
                                                ) : (
                                                    <div>
                                                        <span className="font-semibold text-foreground text-sm truncate max-w-[200px] block">{service.name}</span>
                                                        {service.category && <span className="text-[10px] text-muted-foreground">{service.category}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={clsx("text-[10px] font-bold uppercase px-2 py-1 rounded-md", service.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>{service.is_active ? "Active" : "Inactive"}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {isEditing ? (
                                                <div className="relative w-24">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">$</span>
                                                    <input type="number" className="input-premium py-1 pl-7 pr-2 w-full text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                        value={editValues.price} onChange={(e) => setEditValues({ ...editValues, price: e.target.value })} />
                                                </div>
                                            ) : (
                                                <span className="font-semibold text-emerald-400 text-sm">${Number(service.price).toFixed(2)}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            {isEditing ? (
                                                <input type="number" className="input-premium py-1 px-3 w-20 text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                    value={editValues.duration_minutes} onChange={(e) => setEditValues({ ...editValues, duration_minutes: e.target.value })} />
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                                                    <span className="text-sm text-muted-foreground font-medium">{service.duration_minutes} min</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            {service.aliases?.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {service.aliases.slice(0, 3).map((a, i) => (
                                                        <span key={i} className="text-[10px] bg-primary/10 text-primary/70 px-1.5 py-0.5 rounded">{a}</span>
                                                    ))}
                                                    {service.aliases.length > 3 && <span className="text-[10px] text-muted-foreground">+{service.aliases.length - 3}</span>}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/40">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button onClick={handleSaveEdit} className="text-emerald-400/80 hover:text-emerald-400 p-1.5 hover:bg-emerald-500/10 rounded-lg transition-all" title="Save"><Save className="w-4 h-4" /></button>
                                                    <button onClick={() => setEditingId(null)} className="text-muted-foreground p-1.5 hover:bg-surface-2 rounded-lg transition-all" title="Cancel"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditClick(service)} className="text-muted-foreground hover:text-primary/80 transition-all p-1.5 hover:bg-primary/10 rounded-lg" title="Edit"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDuplicate(service)} className="text-muted-foreground hover:text-blue-400 transition-all p-1.5 hover:bg-blue-500/10 rounded-lg" title="Duplicate"><Copy className="w-4 h-4" /></button>
                                                    <button onClick={() => handleToggleActive(service)} className={clsx("p-1.5 rounded-lg transition-all", service.is_active ? "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10" : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10")} title={service.is_active ? "Deactivate" : "Activate"}><Power className="w-4 h-4" /></button>
                                                    <button onClick={() => setDeleteModal({ open: true, id: service.id, name: service.name })} className="text-muted-foreground hover:text-red-400 transition-all p-1.5 hover:bg-red-500/10 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Empty State */}
                {filtered.length === 0 && !isAdding && !loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 text-center relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
                        <motion.div
                            animate={{ y: [0, -12, 0] }}
                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                            className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(139,92,246,0.15)] backdrop-blur-md"
                        >
                            <ClipboardList className="w-10 h-10 text-primary/60" />
                        </motion.div>
                        <h3 className="text-foreground text-lg font-bold tracking-tight mb-2 relative z-10">
                            {searchQuery ? "No services match your search" : "No services yet"}
                        </h3>
                        <p className="text-muted-foreground text-sm relative z-10 max-w-sm">
                            {searchQuery ? "Try a different search term" : "Add your first service so the AI can offer it to customers and book appointments."}
                        </p>
                        {!searchQuery && (
                            <button onClick={() => { setIsAdding(true); setForm(EMPTY_FORM); }}
                                className="mt-6 bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold py-2.5 px-6 rounded-xl transition-all relative z-10">
                                Add First Service
                            </button>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <GhostModal
                isOpen={deleteModal.open}
                variant="danger"
                title="Delete Service?"
                message={<>Are you sure you want to delete <span className="font-bold text-foreground">&quot;{deleteModal.name}&quot;</span>? This action cannot be undone.</>}
                confirmText="Delete"
                cancelText="Keep It"
                onConfirm={() => { if (deleteModal.id) handleDelete(deleteModal.id); }}
                onCancel={() => setDeleteModal({ open: false, id: null, name: "" })}
            />
        </div>
    );
}