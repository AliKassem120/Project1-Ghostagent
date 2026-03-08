'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, ShoppingBag, Instagram, Clock, CheckCircle2, PhoneCall } from 'lucide-react';

type OrderStatus = 'Pending' | 'Contacted' | 'Fulfilled';

interface OrderLead {
    id: number;
    date: string;
    handle: string;
    item: string;
    status: OrderStatus;
}

const DUMMY_ORDERS: OrderLead[] = [
    { id: 1, date: 'Mar 08, 2026', handle: 'leila.style', item: 'Black Oversized Hoodie — Size M', status: 'Pending' },
    { id: 2, date: 'Mar 07, 2026', handle: 'nour.beirut', item: 'Silver Chain Necklace — 45cm', status: 'Contacted' },
    { id: 3, date: 'Mar 07, 2026', handle: 'reem_fashion', item: 'Beige Linen Co-ord Set — Size S', status: 'Fulfilled' },
    { id: 4, date: 'Mar 06, 2026', handle: 'joelle.k', item: 'Gold Hoop Earrings — Large', status: 'Contacted' },
    { id: 5, date: 'Mar 05, 2026', handle: 'maya.lookbook', item: 'White Crop Blazer — Size XS', status: 'Pending' },
    { id: 6, date: 'Mar 04, 2026', handle: 'dana.closet', item: 'Vintage Denim Jacket — Size L', status: 'Fulfilled' },
];

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string; icon: React.ElementType }> = {
    Pending: { label: 'Pending', className: 'bg-amber-500/15  text-amber-400  border border-amber-500/20', icon: Clock },
    Contacted: { label: 'Contacted', className: 'bg-blue-500/15   text-blue-400   border border-blue-500/20', icon: PhoneCall },
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

export default function OrdersPage() {
    const [orders] = useState<OrderLead[]>(DUMMY_ORDERS);

    const handleExportCSV = () => {
        const header = 'Date,Instagram Handle,Item Requested,Status\n';
        const rows = orders.map(o => `${o.date},@${o.handle},"${o.item}",${o.status}`).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'order_leads.csv';
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
                    <p className="text-sm text-muted-foreground mt-1">Manage purchase requests captured by your AI.</p>
                </div>
                <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm flex-shrink-0"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
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
                                <p className="text-xl font-bold text-foreground">{count}</p>
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
                className="bg-surface-1 border border-border rounded-2xl overflow-hidden shadow-sm"
            >
                {/* Table header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                    <div className="p-2 rounded-xl bg-purple-500/10">
                        <ShoppingBag className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Lead Inbox</h2>
                        <p className="text-[11px] text-muted-foreground">{orders.length} total leads captured</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Date</th>
                                <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Instagram Handle</th>
                                <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Item Requested</th>
                                <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {orders.map((order, i) => (
                                <motion.tr
                                    key={order.id}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.12 + i * 0.04 }}
                                    className="hover:bg-muted/30 transition-colors group cursor-default"
                                >
                                    <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                                        {order.date}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                                            <Instagram className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                                            @{order.handle}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-foreground">
                                        {order.item}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={order.status} />
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Empty state (hidden for now but ready) */}
                {orders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <ShoppingBag className="w-10 h-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No order leads yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">When customers ask to buy something, Ghost Agent logs it here.</p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}