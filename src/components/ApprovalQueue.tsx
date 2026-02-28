'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Edit2, MessageSquare, User, ExternalLink, X } from 'lucide-react';
import { generateSmartLink } from '@/lib/whatsapp';
import clsx from 'clsx';

interface PendingInteraction {
    id: string;
    customerName: string;
    comment: string;
    draftResponse: string;
    productName: string;
    price: number;
    timestamp: string;
}

const MOCK_PENDING: PendingInteraction[] = [];

export default function ApprovalQueue() {
    const [pending, setPending] = useState<PendingInteraction[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const handleApprove = (id: string) => {
        // Simulate sending
        setPending(prev => prev.filter(p => p.id !== id));
        // In a real app, this would call a server action
    };

    const handleEdit = (interaction: PendingInteraction) => {
        setEditingId(interaction.id);
        setEditValue(interaction.draftResponse);
    };

    const saveEdit = (id: string) => {
        setPending(prev => prev.map(p => p.id === id ? { ...p, draftResponse: editValue } : p));
        setEditingId(null);
    };

    if (pending.length === 0) {
        return (
            <div className="bg-surface-1 p-12 rounded-3xl border border-border text-center shadow-sm">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-foreground">Queue is Empty</h3>
                <p className="text-muted-foreground font-medium">You're all caught up! No messages waiting for approval.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                    <MessageSquare className="w-6 h-6 text-primary" />
                    Approval Queue
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">{pending.length}</span>
                </h2>
            </div>

            <div className="grid gap-6">
                <AnimatePresence mode="popLayout">
                    {pending.map((item) => (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-surface-1 p-4 md:p-6 rounded-3xl border border-border hover:border-muted-foreground/30 transition-all shadow-sm"
                        >
                            <div className="flex flex-col lg:flex-row gap-6">
                                {/* Left Side: Customer & Comment */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-indigo-500/20 flex items-center justify-center border border-border">
                                            <User className="w-5 h-5 text-foreground" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-foreground">{item.customerName}</div>
                                            <div className="text-xs text-muted-foreground font-medium">{item.timestamp}</div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-surface-2 rounded-2xl italic text-sm text-muted-foreground border border-border">
                                        "{item.comment}"
                                    </div>
                                </div>

                                {/* Right Side: AI Draft */}
                                <div className="flex-[1.5] space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-widest text-primary/60">AI Draft Response</span>
                                        {editingId !== item.id && (
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors font-medium"
                                            >
                                                <Edit2 className="w-3 h-3" /> Edit
                                            </button>
                                        )}
                                    </div>

                                    {editingId === item.id ? (
                                        <div className="space-y-3">
                                            <textarea
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="w-full h-32 bg-surface-2 border border-border rounded-2xl p-4 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-sm text-muted-foreground hover:text-foreground transition-all font-semibold"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => saveEdit(item.id)}
                                                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm transition-all"
                                                >
                                                    Save Draft
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-surface-2 rounded-2xl text-sm border border-border text-foreground relative group leading-relaxed font-medium">
                                                {item.draftResponse}
                                                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-green-500">
                                                    <span className="flex items-center gap-1">
                                                        <ExternalLink className="w-3 h-3" />
                                                        WhatsApp Link
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button
                                                    onClick={() => handleApprove(item.id)}
                                                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-foreground font-bold py-3 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                                                >
                                                    <Check className="w-5 h-5" />
                                                    Approve & Send
                                                </button>
                                                <button
                                                    onClick={() => setPending(prev => prev.filter(p => p.id !== item.id))}
                                                    className="bg-surface-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 p-3 rounded-2xl border border-border transition-all group flex items-center justify-center"
                                                >
                                                    <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
