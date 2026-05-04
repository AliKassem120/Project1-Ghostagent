'use client';

import React, { useEffect, useState } from 'react';
import { fetchGodMode } from '@/lib/god-mode/api-client';
import { Loader2, ShieldAlert, Plus, Trash2 } from 'lucide-react';

export default function ControlsSection() {
    const [flags, setFlags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadFlags = () => {
        setLoading(true);
        fetchGodMode('controls').then(res => {
            setFlags(res.flags);
            setLoading(false);
        }).catch(console.error);
    };

    useEffect(() => { loadFlags(); }, []);

    const toggleFlag = async (flagId: string, field: string, currentValue: boolean) => {
        try {
            await fetchGodMode('controls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', flagId, [field]: !currentValue })
            });
            loadFlags();
        } catch (err) {
            console.error(err);
            alert('Failed to update flag');
        }
    };

    const deleteFlag = async (flagId: string) => {
        if (!confirm('Are you sure you want to delete this kill switch?')) return;
        try {
            await fetchGodMode('controls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', flagId })
            });
            loadFlags();
        } catch (err) {
            console.error(err);
            alert('Failed to delete flag');
        }
    };

    const addGlobalPause = async () => {
        const confirmText = prompt('WARNING: This will pause ALL outgoing DMs and comments across ALL workspaces.\nType "PAUSE ALL" to confirm:');
        if (confirmText !== 'PAUSE ALL') return;
        
        try {
            await fetchGodMode('controls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'create', 
                    scope: 'global', 
                    pauseDms: true, 
                    pauseComments: true, 
                    disableExternalSends: true,
                    reason: 'Emergency global pause' 
                })
            });
            loadFlags();
        } catch (err) {
            console.error(err);
            alert('Failed to create global pause');
        }
    };

    const addWorkspacePause = async () => {
        const workspaceId = prompt('Enter Workspace ID to pause:');
        if (!workspaceId) return;

        const confirmText = prompt('Type "PAUSE WORKSPACE" to confirm:');
        if (confirmText !== 'PAUSE WORKSPACE') return;

        try {
            await fetchGodMode('controls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'create', 
                    scope: 'workspace', 
                    workspaceId,
                    pauseDms: true, 
                    pauseComments: true, 
                    reason: 'Admin workspace pause' 
                })
            });
            loadFlags();
        } catch (err) {
            console.error(err);
            alert('Failed to create workspace pause');
        }
    };

    const resumeAll = async () => {
        if (!confirm('Are you sure you want to RESUME ALL automation? This will delete all kill switches.')) return;
        try {
            await fetchGodMode('controls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resume-all' })
            });
            loadFlags();
        } catch (err) {
            console.error(err);
            alert('Failed to resume all');
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;

    const globalFlags = flags.filter(f => f.scope === 'global');
    const workspaceFlags = flags.filter(f => f.scope === 'workspace');
    const chatFlags = flags.filter(f => f.scope === 'chat');

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ShieldAlert className="w-6 h-6 text-red-500" />
                        System Kill Switches
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Pauses outgoing DMs and comments for every workspace.</p>
                </div>
                <div className="flex gap-2">
                    {flags.length > 0 && (
                        <button onClick={resumeAll} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-white rounded-xl text-sm font-bold transition-colors">
                            Resume All
                        </button>
                    )}
                    <button onClick={addWorkspacePause} className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-xl text-sm font-bold transition-colors">
                        <Plus className="w-4 h-4" />
                        Pause Selected Workspace
                    </button>
                    {globalFlags.length === 0 && (
                        <button onClick={addGlobalPause} className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors">
                            <Plus className="w-4 h-4" />
                            Global Kill Switch
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-bold text-red-400">GLOBAL LEVEL (Overrides Everything)</h3>
                {globalFlags.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-surface-1 p-4 rounded-xl border border-border">No global flags active.</div>
                ) : (
                    globalFlags.map(f => (
                        <div key={f.id} className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="font-bold text-red-400">GLOBAL KILL SWITCH</div>
                                <div className="text-xs text-muted-foreground mt-1">Reason: {f.reason || 'None provided'}</div>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={f.pause_dms} onChange={() => toggleFlag(f.id, 'pauseDms', f.pause_dms)} /> Pause DMs
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={f.pause_comments} onChange={() => toggleFlag(f.id, 'pauseComments', f.pause_comments)} /> Pause Comments
                                </label>
                                <button onClick={() => deleteFlag(f.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="space-y-4">
                <h3 className="font-bold text-orange-400">WORKSPACE LEVEL</h3>
                {workspaceFlags.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-surface-1 p-4 rounded-xl border border-border">No workspace flags active.</div>
                ) : (
                    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface-2 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Workspace</th>
                                    <th className="px-4 py-3 font-medium">Pause DMs</th>
                                    <th className="px-4 py-3 font-medium">Pause Comments</th>
                                    <th className="px-4 py-3 font-medium">Force Draft</th>
                                    <th className="px-4 py-3 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {workspaceFlags.map(f => (
                                    <tr key={f.id}>
                                        <td className="px-4 py-3 font-medium">{f.workspaceName}</td>
                                        <td className="px-4 py-3"><input type="checkbox" checked={f.pause_dms} onChange={() => toggleFlag(f.id, 'pauseDms', f.pause_dms)} /></td>
                                        <td className="px-4 py-3"><input type="checkbox" checked={f.pause_comments} onChange={() => toggleFlag(f.id, 'pauseComments', f.pause_comments)} /></td>
                                        <td className="px-4 py-3"><input type="checkbox" checked={f.force_draft} onChange={() => toggleFlag(f.id, 'forceDraft', f.force_draft)} /></td>
                                        <td className="px-4 py-3"><button onClick={() => deleteFlag(f.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            <div className="space-y-4">
                <h3 className="font-bold text-yellow-400">CHAT LEVEL</h3>
                {chatFlags.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-surface-1 p-4 rounded-xl border border-border">No chat-level flags active.</div>
                ) : (
                    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface-2 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Chat ID</th>
                                    <th className="px-4 py-3 font-medium">Pause DMs</th>
                                    <th className="px-4 py-3 font-medium">Force Draft</th>
                                    <th className="px-4 py-3 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {chatFlags.map(f => (
                                    <tr key={f.id}>
                                        <td className="px-4 py-3 font-mono text-xs">{f.chat_id}</td>
                                        <td className="px-4 py-3"><input type="checkbox" checked={f.pause_dms} onChange={() => toggleFlag(f.id, 'pauseDms', f.pause_dms)} /></td>
                                        <td className="px-4 py-3"><input type="checkbox" checked={f.force_draft} onChange={() => toggleFlag(f.id, 'forceDraft', f.force_draft)} /></td>
                                        <td className="px-4 py-3"><button onClick={() => deleteFlag(f.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
