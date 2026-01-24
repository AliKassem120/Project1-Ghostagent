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

const MOCK_PENDING: PendingInteraction[] = [
    {
        id: '1',
        customerName: 'Layla S.',
        comment: 'How much for the Neon Ghost Light?',
        draftResponse: 'Hi Layla! The Neon Ghost Light is $49.99 USD. It comes with a 1-year warranty and free shipping in Beirut. Click below to order on WhatsApp!',
        productName: 'Neon Ghost Light',
        price: 49.99,
        timestamp: '2m ago'
    },
    {
        id: '2',
        customerName: 'Hadi K.',
        comment: 'Do you have the Phantom Hoodie in Large?',
        draftResponse: 'Hello Hadi! Yes, we have the Phantom Hoodie in Large ready for delivery. It is $85.00 USD. Check it out on WhatsApp for more details!',
        productName: 'Phantom Hoodie',
        price: 85.00,
        timestamp: '15m ago'
    }
];

export default function ApprovalQueue() {
    const [pending, setPending] = useState<PendingInteraction[]>(MOCK_PENDING);
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
            <div className="glass-dark p-12 rounded-3xl border border-white/10 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">Queue is Empty</h3>
                <p className="text-white/40">You're all caught up! No messages waiting for approval.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                    <MessageSquare className="w-6 h-6 text-primary" />
                    Approval Queue
                    <span className="bg-primary text-black text-xs px-2 py-1 rounded-full">{pending.length}</span>
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
                            className="glass-dark p-4 md:p-6 rounded-3xl border border-white/10 hover:border-white/20 transition-all"
                        >
                            <div className="flex flex-col lg:flex-row gap-6">
                                {/* Left Side: Customer & Comment */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/50 to-indigo-500/50 flex items-center justify-center border border-white/10">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold">{item.customerName}</div>
                                            <div className="text-xs text-white/40">{item.timestamp}</div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-2xl italic text-sm text-white/80 border border-white/5">
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
                                                className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors"
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
                                                className="w-full h-32 bg-black/40 border border-primary/30 rounded-2xl p-4 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => saveEdit(item.id)}
                                                    className="px-4 py-2 rounded-xl bg-primary text-black font-bold text-sm transition-all"
                                                >
                                                    Save Draft
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="p-4 glass rounded-2xl text-sm border border-white/10 relative group">
                                                {item.draftResponse}
                                                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-medium text-green-400">
                                                    <span className="flex items-center gap-1">
                                                        <ExternalLink className="w-3 h-3" />
                                                        WhatsApp Link
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button
                                                    onClick={() => handleApprove(item.id)}
                                                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold py-3 rounded-2xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                                                >
                                                    <Check className="w-5 h-5" />
                                                    Approve & Send
                                                </button>
                                                <button
                                                    onClick={() => setPending(prev => prev.filter(p => p.id !== item.id))}
                                                    className="bg-white/5 hover:bg-red-500/10 hover:text-red-400 p-3 rounded-2xl border border-white/10 transition-all group flex items-center justify-center"
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
