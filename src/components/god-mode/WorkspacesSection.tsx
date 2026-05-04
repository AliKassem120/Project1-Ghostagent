'use client';

import React, { useEffect, useState } from 'react';
import { fetchGodMode } from '@/lib/god-mode/api-client';
import { Loader2, ExternalLink } from 'lucide-react';

export default function WorkspacesSection() {
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGodMode('workspaces').then(res => {
            setWorkspaces(res.workspaces);
            setLoading(false);
        }).catch(console.error);
    }, []);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">Workspaces</h2>
            
            <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-2 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 font-medium">Plan</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Errors</th>
                                <th className="px-4 py-3 font-medium">Flags</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {workspaces.map(ws => (
                                <tr key={ws.id} className="hover:bg-surface-2/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-foreground">{ws.name}</div>
                                        <div className="text-xs text-muted-foreground">{ws.id}</div>
                                        {ws.isInternal && <span className="inline-block mt-1 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">INTERNAL</span>}
                                    </td>
                                    <td className="px-4 py-3">{ws.businessType}</td>
                                    <td className="px-4 py-3 capitalize">{ws.ownerPlan?.replace('_', ' ')}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1 text-xs">
                                            <span className={ws.instagramConnected ? "text-green-400" : "text-muted-foreground"}>IG: {ws.instagramConnected ? `@${ws.instagramUsername}` : 'No'}</span>
                                            <span className={ws.autopilot ? "text-blue-400" : "text-muted-foreground"}>Autopilot: {ws.autopilot ? 'On' : 'Off'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={ws.errorCount > 0 ? "text-red-400 font-bold" : "text-muted-foreground"}>{ws.errorCount}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            {ws.paused && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded">PAUSED</span>}
                                            {ws.forceDraft && <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded">DRAFT</span>}
                                            {!ws.paused && !ws.forceDraft && <span className="text-muted-foreground text-xs">-</span>}
                                        </div>
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
