'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, Loader2, Check, ShoppingBag, Calendar, Home, UtensilsCrossed, PartyPopper, Laptop } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { BusinessCategory } from '@/components/BusinessTypeSelector';
import clsx from 'clsx';

interface AddWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const BUSINESS_TYPES: { id: BusinessCategory; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'ecommerce', label: 'E-commerce', icon: ShoppingBag, desc: 'Products, shipping, inventory' },
    { id: 'appointments', label: 'Appointments', icon: Calendar, desc: 'Services, bookings, calendar' },
    { id: 'real_estate', label: 'Real Estate', icon: Home, desc: 'Properties, viewings, leads' },
    { id: 'food_and_beverage', label: 'Food & Beverage', icon: UtensilsCrossed, desc: 'Menus, delivery, orders' },
    { id: 'events_ticketing', label: 'Events & Ticketing', icon: PartyPopper, desc: 'Tickets, guest lists, venues' },
    { id: 'digital_services', label: 'Digital Services', icon: Laptop, desc: 'Downloads, support, consulting' },
];

export default function AddWorkspaceModal({ isOpen, onClose }: AddWorkspaceModalProps) {
    const supabase = createClient();
    const { user } = useAuth();
    const { addWorkspace } = useWorkspace();

    const [name, setName] = useState('');
    const [businessType, setBusinessType] = useState<BusinessCategory>('ecommerce');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setName('');
        setBusinessType('ecommerce');
        setSaving(false);
        setError(null);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id || !name.trim()) return;
        setSaving(true);
        setError(null);

        const { data, error: insertError } = await supabase
            .from('bot_settings')
            .insert({
                user_id: user.id,
                name: name.trim(),
                business_type: businessType,
            })
            .select('id, user_id, name, business_type, created_at')
            .single();

        if (insertError || !data) {
            setError(insertError?.message || 'Failed to create workspace.');
            setSaving(false);
            return;
        }

        addWorkspace({
            id: data.id,
            user_id: data.user_id,
            name: data.name || name.trim(),
            business_type: data.business_type as BusinessCategory,
            instagram_account_id: null,
            instagram_username: null,
            created_at: data.created_at,
        });

        reset();
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 12 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="pointer-events-auto w-full max-w-md bg-surface-1 border border-border rounded-2xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-primary/10">
                                        <Building2 className="w-4 h-4 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-foreground">Add Instagram Account</h2>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Create a new AI agent for this account</p>
                                    </div>
                                </div>
                                <button onClick={handleClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                {/* Business Name */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Business Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="input-premium w-full"
                                        placeholder="e.g. Ali's Fashion Store"
                                        required
                                        disabled={saving}
                                    />
                                </div>

                                {/* Business Type */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Business Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {BUSINESS_TYPES.map(({ id, label, icon: Icon, desc }) => {
                                            const active = businessType === id;
                                            return (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => setBusinessType(id)}
                                                    disabled={saving}
                                                    className={clsx(
                                                        'relative flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all',
                                                        active
                                                            ? 'bg-primary/10 border-primary/40 text-foreground'
                                                            : 'bg-surface-1 border-border text-muted-foreground hover:border-border-strong hover:bg-surface-2 hover:text-muted-foreground'
                                                    )}
                                                >
                                                    <Icon className={clsx('w-4 h-4 mt-0.5 shrink-0', active ? 'text-primary' : '')} />
                                                    <div>
                                                        <p className="text-[11px] font-semibold leading-tight">{label}</p>
                                                        <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
                                                    </div>
                                                    {active && (
                                                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Error */}
                                {error && (
                                    <p className="text-[11px] text-red-400 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-3 py-2">
                                        {error}
                                    </p>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        disabled={saving}
                                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground bg-surface-2 border border-border hover:bg-surface-3 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving || !name.trim()}
                                        className={clsx(
                                            'flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all',
                                            saving || !name.trim()
                                                ? 'bg-surface-2 text-muted-foreground cursor-not-allowed'
                                                : 'bg-primary text-foreground hover:brightness-110'
                                        )}
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        {saving ? 'Creating...' : 'Create Agent'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
