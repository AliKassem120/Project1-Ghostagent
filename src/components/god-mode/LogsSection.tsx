'use client';

import React, { useEffect, useState } from 'react';
import { fetchGodMode } from '@/lib/god-mode/api-client';
import { Loader2, AlertCircle, MessageSquare, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';

export default function LogsSection() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorOnly, setErrorOnly] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const loadLogs = () => {
        setLoading(true);
        fetchGodMode(`logs?limit=100${errorOnly ? '&errorOnly=true' : ''}`).then(res => {
            setLogs(res.logs);
            setLoading(false);
        }).catch(console.error);
    };

    useEffect(() => {
        loadLogs();
    }, [errorOnly]);

    const toggleRow = (id: string) => {
        const next = new Set(expandedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedRows(next);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Activity Logs</h2>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={errorOnly} onChange={e => setErrorOnly(e.target.checked)} className="rounded border-border bg-surface-1" />
                    Errors Only
                </label>
            </div>
            
            {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div> : (
                <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface-2 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium w-8"></th>
                                    <th className="px-4 py-3 font-medium">Time</th>
                                    <th className="px-4 py-3 font-medium">Workspace</th>
                                    <th className="px-4 py-3 font-medium">Event</th>
                                    <th className="px-4 py-3 font-medium">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {logs.map(log => {
                                    const isError = log.eventType === 'ERROR' || log.eventType === 'SYSTEM_WARNING';
                                    const isExpanded = expandedRows.has(log.id);
                                    return (
                                        <React.Fragment key={log.id}>
                                            <tr 
                                                className={`hover:bg-surface-2/50 transition-colors cursor-pointer ${isError ? 'bg-red-500/5' : ''}`}
                                                onClick={() => toggleRow(log.id)}
                                            >
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-foreground">{log.workspaceName || 'Global'}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide ${isError ? 'bg-red-500/20 text-red-400' : 'bg-surface-2 text-muted-foreground'}`}>
                                                        {log.eventType}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 truncate max-w-md ${isError ? 'text-red-400' : 'text-foreground'}`}>
                                                    {log.description}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-surface-0/50">
                                                    <td colSpan={5} className="p-4 border-b border-border">
                                                        <pre className="text-xs text-muted-foreground font-mono bg-surface-2 p-4 rounded-xl overflow-x-auto">
                                                            {JSON.stringify(log.metadata, null, 2)}
                                                        </pre>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
