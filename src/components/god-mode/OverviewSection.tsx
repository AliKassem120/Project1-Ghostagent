'use client';

import React, { useEffect, useState } from 'react';
import { fetchGodMode } from '@/lib/god-mode/api-client';
import { Loader2, Activity, Users, MessageSquare, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function OverviewSection() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGodMode('overview').then(res => {
            setData(res.metrics);
            setLoading(false);
        }).catch(console.error);
    }, []);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;
    if (!data) return <div>Failed to load metrics</div>;

    const cards = [
        { label: 'Total Workspaces', value: data.totalWorkspaces, icon: Users },
        { label: 'Active Workspaces', value: data.activeWorkspaces, icon: Activity },
        { label: 'Internal Workspaces', value: data.internalWorkspaces, icon: ShieldAlert },
        { label: '24h DMs', value: data.dms24h, icon: MessageSquare },
        { label: '24h AI Replies', value: data.aiReplies24h, icon: MessageSquare },
        { label: '24h Errors', value: data.errors24h, icon: AlertTriangle, color: 'text-red-400' },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">God Mode Overview</h2>
            
            {data.globalPaused && (
                <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-xl flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5" />
                    <strong>SYSTEM PAUSED:</strong> Global kill switch is currently active.
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((c, i) => (
                    <div key={i} className="bg-surface-1 p-5 rounded-2xl border border-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-surface-2 rounded-lg">
                                <c.icon className={`w-5 h-5 ${c.color || 'text-muted-foreground'}`} />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">{c.label}</span>
                        </div>
                        <div className="text-3xl font-bold">{c.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
