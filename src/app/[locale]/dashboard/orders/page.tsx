'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ShoppingBag, Instagram, Clock, CheckCircle2, PhoneCall, Loader2, RefreshCw, ChevronDown, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import CustomSelect from '@/components/CustomSelect';
import GhostModal from '@/components/GhostModal';
import clsx from 'clsx';

type OrderStatus = 'Pending' | 'Contacted' | 'Fulfilled';

interface OrderLead {
    id: string;
    created_at: string;
    instagram_handle: string;
    item_requested: string;
    customer_name: string | null;
    customer_phone: string | null;
    customer_address: string | null;
    status: OrderStatus;
    raw_message: string | null;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string; icon: React.ElementType }> = {
    Pending: { label: 'Pending', className: 'bg-amber-500/15   text-amber-400   border border-amber-500/20', icon: Clock },
    Contacted: { label: 'Contacted', className: 'bg-blue-500/15    text-blue-400    border border-blue-500/20', icon: PhoneCall },
    Fulfilled: { label: 'Fulfilled', className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20', icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: OrderStatus }) {
    const { label, className, icon: Icon } = STATUS_CONFIG[status];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${className}`}>
            <Icon className="w-3 h-3" />
            {label}
        </span>
    );
}

function StatusSelector({ current, onChange }: { current: OrderStatus; onChange: (s: OrderStatus) => void }) {
    const options = [
        { label: 'Pending', value: 'Pending' },
        { label: 'Contacted', value: 'Contacted' },
        { label: 'Fulfilled', value: 'Fulfilled' }
    ];

    return (
        <div className="relative inline-flex items-center min-w-[110px]" onClick={e => e.stopPropagation()}>
            <CustomSelect
                options={options}
                value={current}
                onChange={(v) => onChange(v as OrderStatus)}
                className="!py-0"
            />
        </div>
    );
}

// Custom specialized selector to fit in the table row
function InlineStatusSelector({ current, onChange }: { current: OrderStatus; onChange: (s: OrderStatus) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const options: OrderStatus[] = ['Pending', 'Contacted', 'Fulfilled'];

    return (
        <div className="relative" ref={containerRef} onClick={e => e.stopPropagation()}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide transition-all",
                    STATUS_CONFIG[current].className,
                    "hover:scale-[1.02] active:scale-[0.98]"
                )}
            >
                {current}
                <ChevronDown className={clsx("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute top-full left-0 mt-2 z-[100] min-w-[130px] bg-surface-1 border border-border shadow-2xl rounded-xl overflow-hidden p-1"
                    >
                        {options.map((status) => {
                            const { icon: Icon } = STATUS_CONFIG[status];
                            return (
                                <button
                                    key={status}
                                    onClick={() => {
                                        onChange(status);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                                        current === status ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {status}
                                    {current === status && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export default function OrdersPage() {
    const supabase = createClient();
    const { activeWorkspaceId, activeWorkspace } = useWorkspace();
    const { lastUpdate } = useRealtime();
    const [orders, setOrders] = useState<OrderLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase.from('orders').select('*').order('created_at', { ascending: false });
            if (!activeWorkspaceId) {
                setOrders([]);
                setLoading(false);
                return;
            }
            q = q.eq('workspace_id', activeWorkspaceId);
            const { data, error } = await q;
            if (!error && data) setOrders(data as OrderLead[]);
        } finally {
            setLoading(false);
        }
    }, [activeWorkspaceId, supabase, lastUpdate]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        setUpdating(orderId);
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
        setUpdating(null);
    };

    const confirmDeleteOrder = async () => {
        if (!orderToDelete) return;
        const id = orderToDelete;
        setOrderToDelete(null);
        setUpdating(id);
        await supabase.from('orders').delete().eq('id', id);
        setOrders(prev => prev.filter(o => o.id !== id));
        setUpdating(null);
    };

    const handleDeleteOrderRequest = (orderId: string) => {
        setOrderToDelete(orderId);
        setDeleteModalOpen(true);
    };

    const handleExportCSV = () => {
        const header = 'Date,Instagram Handle,Item Requested,Status\n';
        const rows = orders.map(o => `${formatDate(o.created_at)},@${o.instagram_handle},"${o.item_requested}",${o.status}`).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `order_leads_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const counts = {
        Pending: orders.filter(o => o.status === 'Pending').length,
        Contacted: orders.filter(o => o.status === 'Contacted').length,
        Fulfilled: orders.filter(o => o.status === 'Fulfilled').length,
    };

    return (
        <div className="space-y-6 pb-8">

            {/* ── Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start justify-between gap-4"
            >
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Order Leads</h1>
                    <p className="text-sm text-muted-foreground mt-1">Purchase requests captured automatically by your AI.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={fetchOrders}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleExportCSV}
                        disabled={orders.length === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-40"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </motion.div>

            {/* ── Stat Cards ── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="grid grid-cols-3 gap-4"
            >
                {(Object.entries(counts) as [OrderStatus, number][]).map(([status, count]) => {
                    const { className, icon: Icon } = STATUS_CONFIG[status];
                    return (
                        <div key={status} className="bg-surface-1 border border-border rounded-2xl p-4 flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${className}`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{status}</p>
                                <p className="text-xl font-bold text-foreground">{loading ? '—' : count}</p>
                            </div>
                        </div>
                    );
                })}
            </motion.div>

            {/* ── Table ── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-surface-1 border border-border rounded-2xl shadow-sm"
            >
                {/* Card header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                    <div className="p-2 rounded-xl bg-purple-500/10">
                        <ShoppingBag className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Lead Inbox</h2>
                        <p className="text-[11px] text-muted-foreground">{loading ? 'Loading…' : `${orders.length} total lead${orders.length !== 1 ? 's' : ''} captured`}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <ShoppingBag className="w-10 h-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-medium text-foreground">No order leads yet</p>
                        <p className="text-xs text-muted-foreground mt-2 max-w-sm leading-relaxed mb-6">
                            When a customer DMs your Instagram saying they want to buy something, GhostAgent captures their details here automatically.
                        </p>
                        {activeWorkspace?.instagram_account_id ? (
                            <span className="flex items-center justify-center gap-2 text-emerald-500 text-sm font-semibold bg-emerald-500/10 px-5 py-2.5 rounded-xl border border-emerald-500/20">
                                <CheckCircle2 className="w-4 h-4" />
                                Monitoring DMs for Orders...
                            </span>
                        ) : (
                            <a
                                href="/dashboard/settings?tab=connection"
                                className="bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold py-2.5 px-6 rounded-xl transition-all"
                            >
                                Connect Instagram to Start
                            </a>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Date</th>
                                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Handle</th>
                                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Item</th>
                                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Name</th>
                                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Phone</th>
                                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Address</th>
                                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Status</th>
                                    <th className="text-right text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {orders.map((order, i) => (
                                    <motion.tr
                                        key={order.id}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.12 + i * 0.03 }}
                                        className="hover:bg-muted/30 transition-colors cursor-default"
                                    >
                                        <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                                            {formatDate(order.created_at)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                                                <Instagram className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                                                @{order.instagram_handle}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-foreground">
                                            {order.item_requested}
                                        </td>
                                        <td className="px-6 py-4 text-foreground text-xs">
                                            {order.customer_name || <span className="text-muted-foreground/50 italic">Pending…</span>}
                                        </td>
                                        <td className="px-6 py-4 text-foreground text-xs">
                                            {order.customer_phone || <span className="text-muted-foreground/50 italic">Pending…</span>}
                                        </td>
                                        <td className="px-6 py-4 text-foreground text-xs max-w-[160px] truncate">
                                            {order.customer_address || <span className="text-muted-foreground/50 italic">Pending…</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {updating === order.id
                                                ? <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-border"><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="text-[11px]">Updating…</span></div>
                                                : <InlineStatusSelector current={order.status} onChange={(s) => handleStatusChange(order.id, s)} />
                                            }
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteOrderRequest(order.id)}
                                                disabled={updating === order.id}
                                                className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors inline-flex disabled:opacity-50"
                                                title="Delete Order"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>

            <GhostModal
                isOpen={deleteModalOpen}
                title="Delete Order Lead"
                message="Are you sure you want to delete this order? This action cannot be undone and will permanently remove the lead from your dashboard."
                confirmText="Delete Permanently"
                cancelText="Keep Order"
                variant="danger"
                onConfirm={confirmDeleteOrder}
                onCancel={() => setDeleteModalOpen(false)}
            />
        </div>
    );
}