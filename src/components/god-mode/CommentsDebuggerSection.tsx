'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, Loader2, RefreshCw } from 'lucide-react';

export default function CommentsDebuggerSection() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/god-mode/comments-debugger');
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <MessageCircle className="w-6 h-6 text-green-500" />
                        Comments Debugger
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Monitor recent auto-replies to public comments.</p>
                </div>
                <button 
                    onClick={loadLogs} 
                    className="p-2 bg-surface-2 hover:bg-surface-3 rounded-xl transition-colors"
                    disabled={loading}
                >
                    <RefreshCw className={`w-5 h-5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            
            <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-2 text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 font-medium">Timestamp</th>
                            <th className="px-4 py-3 font-medium">Workspace</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Public Comment</th>
                            <th className="px-4 py-3 font-medium">Private DM</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {logs.length === 0 && !loading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                    No comment replies found.
                                </td>
                            </tr>
                        ) : logs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-surface-2/50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-xs">
                                    {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                    {log.workspace_id?.slice(0, 8)}...
                                </td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-1 bg-green-500/10 text-green-400 text-[10px] uppercase font-bold rounded">
                                        REPLIED
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="max-w-[200px] truncate">{log.metadata?.publicCommentText || '-'}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="max-w-[200px] truncate">{log.metadata?.privateDmText || '-'}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
