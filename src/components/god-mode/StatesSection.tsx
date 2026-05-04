'use client';

import React, { useEffect, useState } from 'react';
import { fetchGodMode } from '@/lib/god-mode/api-client';
import { Loader2, Trash2, RefreshCw } from 'lucide-react';

export default function StatesSection() {
    const [states, setStates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadStates = () => {
        setLoading(true);
        fetchGodMode('states').then(res => {
            setStates(res.states);
            setLoading(false);
        }).catch(console.error);
    };

    useEffect(() => {
        loadStates();
    }, []);

    const handleAction = async (action: string, stateId: string) => {
        if (!confirm(`Are you sure you want to ${action} this state?`)) return;
        try {
            await fetchGodMode('states', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, stateId })
            });
            loadStates();
        } catch (err) {
            console.error(err);
            alert('Failed to update state');
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">State Manager</h2>
                <button onClick={loadStates} className="p-2 hover:bg-surface-2 rounded-lg text-muted-foreground hover:text-foreground">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>
            
            <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-2 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 font-medium">Workspace</th>
                                <th className="px-4 py-3 font-medium">Chat ID</th>
                                <th className="px-4 py-3 font-medium">Stage</th>
                                <th className="px-4 py-3 font-medium">Data Preview</th>
                                <th className="px-4 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {states.map(s => (
                                <tr key={s.id} className="hover:bg-surface-2/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{s.workspaceName}</div>
                                        <div className="text-xs text-muted-foreground">{s.workspaceType}</div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">{s.chatId}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${s.stage === 'idle' ? 'bg-surface-2 text-muted-foreground' : 'bg-primary/20 text-primary'}`}>
                                            {s.stage}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="max-w-xs truncate text-xs text-muted-foreground font-mono">
                                            {s.dataPreview}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleAction('clear', s.id)} className="px-2 py-1 bg-surface-2 hover:bg-surface-3 rounded text-xs">Clear (Idle)</button>
                                            <button onClick={() => handleAction('force_handoff', s.id)} className="px-2 py-1 bg-surface-2 hover:bg-surface-3 rounded text-xs">Handoff</button>
                                            <button onClick={() => handleAction('delete', s.id)} className="p-1 text-red-400 hover:bg-red-500/10 rounded">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
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
