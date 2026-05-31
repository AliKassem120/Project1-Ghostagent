'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Users, Megaphone, Loader2, Search, CheckSquare, Square, UserPlus, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function MarketingPage() {
    const supabase = createClient();
    const toast = useToast();
    const { activeWorkspaceId } = useWorkspace();
    
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [customers, setCustomers] = useState<{ phone: string, name: string, source: string }[]>([]);
    const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [showAddModal, setShowAddModal] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [addingCustomer, setAddingCustomer] = useState(false);

    const fetchCustomers = async () => {
        if (!activeWorkspaceId) return;
        setLoading(true);

        try {
            // Fetch from orders
            const { data: orders } = await supabase
                .from('orders')
                .select('customer_name, customer_phone')
                .eq('workspace_id', activeWorkspaceId)
                .not('customer_phone', 'is', null);

            // Fetch from appointments
            const { data: appts } = await supabase
                .from('appointments')
                .select('customer_name, customer_phone')
                .eq('workspace_id', activeWorkspaceId)
                .not('customer_phone', 'is', null);

            // Fetch from customer_profiles (unified profiles, including manual additions)
            const { data: profiles } = await supabase
                .from('customer_profiles')
                .select('name, phone')
                .eq('workspace_id', activeWorkspaceId)
                .not('phone', 'is', null);

            const map = new Map<string, { phone: string, name: string, source: string }>();
            const getDeduplicationKey = (p: string) => {
                let norm = p.replace(/\D/g, '');
                if (norm.startsWith('00961')) norm = norm.slice(5);
                else if (norm.startsWith('961')) norm = norm.slice(3);
                if (norm.startsWith('0')) norm = norm.slice(1);
                return norm;
            };

            orders?.forEach(o => {
                if (o.customer_phone && o.customer_phone.length > 5) {
                    const key = getDeduplicationKey(o.customer_phone);
                    if (key.length > 5) {
                        const existing = map.get(key);
                        if (!existing || o.customer_phone.length > existing.phone.length) {
                            map.set(key, { phone: o.customer_phone, name: o.customer_name || 'Customer', source: 'Order' });
                        }
                    }
                }
            });

            appts?.forEach(a => {
                if (a.customer_phone && a.customer_phone.length > 5) {
                    const key = getDeduplicationKey(a.customer_phone);
                    if (key.length > 5) {
                        const existing = map.get(key);
                        if (!existing || a.customer_phone.length > existing.phone.length) {
                            map.set(key, { phone: a.customer_phone, name: a.customer_name || 'Customer', source: 'Appointment' });
                        }
                    }
                }
            });

            profiles?.forEach(p => {
                if (p.phone && p.phone.length > 5) {
                    const key = getDeduplicationKey(p.phone);
                    if (key.length > 5) {
                        const existing = map.get(key);
                        if (!existing || p.phone.length > existing.phone.length) {
                            const source = existing ? existing.source : 'Manual';
                            map.set(key, { phone: p.phone, name: p.name || 'Customer', source });
                        }
                    }
                }
            });

            setCustomers(Array.from(map.values()));
        } catch (err: any) {
            console.error('Error fetching customers:', err);
            toast.error('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, [activeWorkspaceId, supabase]);

    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.phone.includes(searchQuery)
    );

    const toggleSelectAll = () => {
        if (selectedPhones.size === filteredCustomers.length) {
            setSelectedPhones(new Set());
        } else {
            setSelectedPhones(new Set(filteredCustomers.map(c => c.phone)));
        }
    };

    const togglePhone = (phone: string) => {
        const next = new Set(selectedPhones);
        if (next.has(phone)) next.delete(phone);
        else next.add(phone);
        setSelectedPhones(next);
    };

    const handleSendBlast = async () => {
        if (selectedPhones.size === 0) {
            toast.error('Select at least one customer');
            return;
        }
        if (!message.trim()) {
            toast.error('Please enter a message');
            return;
        }

        setSending(true);
        try {
            const res = await fetch('/api/marketing/send-blast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: activeWorkspaceId,
                    phones: Array.from(selectedPhones),
                    messageBody: message.trim()
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success('Blast Sent!', { description: `Successfully sent to ${data.sentCount} customers.` });
            if (data.failedCount > 0) {
                toast.error(`${data.failedCount} failed. Ensure numbers are valid WhatsApp accounts.`);
            }
            
            setMessage('');
            setSelectedPhones(new Set());
        } catch (err: any) {
            toast.error('Failed to send blast', { description: err.message });
        } finally {
            setSending(false);
        }
    };

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeWorkspaceId) {
            toast.error('No active workspace selected');
            return;
        }

        const trimmedName = newCustomerName.trim();
        const cleanedPhone = newCustomerPhone.replace(/[^\d+]/g, '');

        if (!trimmedName) {
            toast.error("Please enter the customer's name.");
            return;
        }

        if (!/^\+[1-9]\d{7,15}$/.test(cleanedPhone)) {
            toast.error('Invalid phone number. Please include "+" and the country code (e.g., +1234567890).');
            return;
        }

        setAddingCustomer(true);
        try {
            // First check if a customer profile with this whatsapp_chat_id exists
            const { data: existingProfile, error: searchError } = await supabase
                .from('customer_profiles')
                .select('id')
                .eq('workspace_id', activeWorkspaceId)
                .eq('whatsapp_chat_id', cleanedPhone)
                .maybeSingle();

            if (searchError) throw searchError;

            if (existingProfile) {
                toast.error('A customer with this phone number already exists in this workspace.');
                setAddingCustomer(false);
                return;
            }

            const { error: insertError } = await supabase
                .from('customer_profiles')
                .insert({
                    workspace_id: activeWorkspaceId,
                    name: trimmedName,
                    phone: cleanedPhone,
                    whatsapp_chat_id: cleanedPhone,
                    first_seen: new Date().toISOString(),
                    last_seen: new Date().toISOString()
                });

            if (insertError) {
                if (insertError.code === '23505') {
                    toast.error('A customer with this phone number already exists in this workspace.');
                } else {
                    throw insertError;
                }
            } else {
                toast.success('Customer added successfully!');
                setNewCustomerName('');
                setNewCustomerPhone('');
                setShowAddModal(false);
                
                await fetchCustomers();
                
                setSelectedPhones(prev => {
                    const next = new Set(prev);
                    next.add(cleanedPhone);
                    return next;
                });
            }
        } catch (err: any) {
            console.error('Error adding customer:', err);
            toast.error('Failed to add customer: ' + (err.message || 'Unknown error'));
        } finally {
            setAddingCustomer(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Megaphone className="w-6 h-6 text-primary" />
                    Broadcast Campaigns
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Send promotional WhatsApp blasts to your past customers.
                </p>
            </motion.div>

            <div className="grid lg:grid-cols-[1fr_400px] gap-6">
                {/* Customers List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 flex flex-col h-[600px]"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-foreground">Audience ({customers.length})</h3>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:text-primary-hover bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors press"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                Add Customer
                            </button>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search customers..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="input-premium w-full pl-9 h-9 text-sm relative z-0"
                                style={{ paddingLeft: '2.25rem' }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 px-4 py-2 border-b border-border mb-2">
                        <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-primary transition-colors">
                            {selectedPhones.size === filteredCustomers.length && filteredCustomers.length > 0 ? (
                                <CheckSquare className="w-5 h-5 text-primary" />
                            ) : (
                                <Square className="w-5 h-5" />
                            )}
                        </button>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select All</span>
                        <span className="ml-auto text-xs text-muted-foreground font-medium">
                            {selectedPhones.size} selected
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                        {filteredCustomers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                                <Users className="w-8 h-8 mb-2" />
                                <p className="text-sm font-medium">No customers found</p>
                            </div>
                        ) : (
                            filteredCustomers.map(c => (
                                <button
                                    key={c.phone}
                                    onClick={() => togglePhone(c.phone)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-2 transition-colors text-left"
                                >
                                    {selectedPhones.has(c.phone) ? (
                                        <CheckSquare className="w-5 h-5 text-primary shrink-0" />
                                    ) : (
                                        <Square className="w-5 h-5 text-muted-foreground shrink-0" />
                                    )}
                                    <div className="flex-1 truncate">
                                        <p className="font-semibold text-sm text-foreground truncate">{c.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono truncate">{c.phone}</p>
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground bg-surface-3 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                        {c.source}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Composer */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 flex flex-col h-[600px]"
                >
                    <h3 className="font-bold text-foreground mb-4">Composer</h3>
                    
                    <div className="flex-1 bg-surface-2 rounded-xl p-4 border border-border flex flex-col">
                        <div className="text-xs font-bold text-muted-foreground mb-2 flex items-center justify-between">
                            <span>WHATSAPP PREVIEW</span>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest">Marketing</span>
                        </div>
                        
                        <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-xl p-4 flex-1 flex flex-col justify-end">
                            {/* WhatsApp Bubble Mock */}
                            <div className="bg-white dark:bg-[#202c33] rounded-2xl rounded-tr-sm p-3 max-w-[85%] self-end shadow-sm">
                                <p className="text-[13px] font-bold text-foreground mb-1">Exclusive Offer! 🎉</p>
                                <p className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-relaxed mb-1">Hey! 👋</p>
                                <p className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                    {message || <span className="text-muted-foreground/50 italic">Your message here...</span>}
                                </p>
                                <p className="text-[14px] text-foreground/90 whitespace-pre-wrap leading-relaxed mt-1 mb-2">Reply to this message if you have any questions or want to claim this offer! 👻</p>
                                <p className="text-[10px] text-muted-foreground border-t border-border/50 pt-1 mt-1">Powered by GhostAgent</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Promotion Text</label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="We are running a 20% sale on all vintage jackets this weekend only!"
                                className="w-full h-24 bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none resize-none"
                            />
                        </div>

                        <button
                            onClick={handleSendBlast}
                            disabled={sending || selectedPhones.size === 0 || !message.trim()}
                            className="w-full h-12 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 transition-colors press"
                        >
                            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            {sending ? 'Sending...' : `Send to ${selectedPhones.size} Customers`}
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Manual Customer Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-surface-1 border border-border shadow-2xl rounded-3xl p-6 w-full max-w-md relative z-10"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold text-foreground">Add Customer Manually</h2>
                                <button 
                                    onClick={() => setShowAddModal(false)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">Create a new customer profile for WhatsApp marketing campaigns.</p>
                            
                            <form onSubmit={handleAddCustomer} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Full Name</label>
                                    <input 
                                        type="text" 
                                        value={newCustomerName}
                                        onChange={e => setNewCustomerName(e.target.value)}
                                        placeholder="John Doe" 
                                        required 
                                        className="w-full h-11 bg-surface-2 border border-border rounded-xl px-4 text-sm focus:border-primary outline-none" 
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Phone Number</label>
                                    <input 
                                        type="tel" 
                                        value={newCustomerPhone}
                                        onChange={e => setNewCustomerPhone(e.target.value)}
                                        placeholder="+1234567890" 
                                        required 
                                        className="w-full h-11 bg-surface-2 border border-border rounded-xl px-4 text-sm focus:border-primary outline-none font-mono" 
                                    />
                                    <p className="text-[10px] text-muted-foreground px-1">
                                        Must include &quot;+&quot; and country code (e.g., +96176123456)
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowAddModal(false)} 
                                        className="flex-1 h-12 rounded-2xl border border-border text-sm font-bold text-foreground hover:bg-surface-2 transition-colors press"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={addingCustomer || !newCustomerName.trim() || !newCustomerPhone.trim()}
                                        className="flex-1 h-12 rounded-2xl bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-50 transition-colors press flex items-center justify-center gap-2"
                                    >
                                        {addingCustomer && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {addingCustomer ? 'Adding...' : 'Add Customer'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
