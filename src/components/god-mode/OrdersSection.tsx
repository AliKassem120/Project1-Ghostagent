'use client';

import React, { useEffect, useState } from 'react';
import { fetchGodMode } from '@/lib/god-mode/api-client';
import { Loader2 } from 'lucide-react';

export default function OrdersSection() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadOrders = () => {
        setLoading(true);
        fetchGodMode('orders').then(res => {
            setOrders(res.orders);
            setLoading(false);
        }).catch(console.error);
    };

    useEffect(() => { loadOrders(); }, []);

    const updateStatus = async (orderId: string, status: string) => {
        try {
            await fetchGodMode('orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status })
            });
            loadOrders();
        } catch (err) {
            console.error(err);
            alert('Failed to update order');
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">Orders Debugger</h2>
            <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-2 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 font-medium">Workspace</th>
                                <th className="px-4 py-3 font-medium">Product</th>
                                <th className="px-4 py-3 font-medium">Customer</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {orders.map(o => (
                                <tr key={o.id} className="hover:bg-surface-2/50 transition-colors">
                                    <td className="px-4 py-3 font-medium">{o.workspaceName}</td>
                                    <td className="px-4 py-3">
                                        <div>{o.product_name} x{o.quantity}</div>
                                        {o.variant_label && <div className="text-xs text-muted-foreground">{o.variant_label}</div>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div>{o.customer_name}</div>
                                        <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${o.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-surface-2'}`}>
                                            {o.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                        {new Date(o.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <select 
                                            value={o.status} 
                                            onChange={e => updateStatus(o.id, e.target.value)}
                                            className="bg-surface-2 border border-border rounded text-xs px-2 py-1"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="fulfilled">Fulfilled</option>
                                            <option value="cancelled">Cancelled</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
