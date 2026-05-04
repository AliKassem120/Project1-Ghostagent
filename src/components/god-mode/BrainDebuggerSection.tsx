'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Play, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { fetchGodMode } from '@/lib/god-mode/api-client';

export default function BrainDebuggerSection() {
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        fetchGodMode('workspaces').then(res => {
            if (res.success) {
                setWorkspaces(res.workspaces);
                if (res.workspaces.length > 0) {
                    setSelectedWorkspace(res.workspaces[0].id);
                }
            }
        });
    }, []);

    const runSimulation = async () => {
        if (!selectedWorkspace || !message.trim()) return;
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch('/api/god-mode/brain-debugger/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: selectedWorkspace, message })
            });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setResult({ success: false, error: 'Network error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Brain className="w-6 h-6 text-purple-500" />
                        Brain Debugger
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Test LLM prompts and tool execution safely without sending messages.</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface-1 border border-border rounded-xl p-6 space-y-4">
                    <h3 className="font-bold text-foreground">Simulation Input</h3>
                    
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Target Workspace</label>
                        <select 
                            value={selectedWorkspace}
                            onChange={(e) => setSelectedWorkspace(e.target.value)}
                            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                        >
                            {workspaces.map(w => (
                                <option key={w.id} value={w.id}>{w.name || w.business_name || w.id}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">User Message</label>
                        <textarea 
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type a message to test (e.g. 'I want to book an appointment' or 'how much is ps5?')"
                            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm min-h-[120px] focus:outline-none focus:border-purple-500 transition-colors resize-y"
                        />
                    </div>

                    <button 
                        onClick={runSimulation}
                        disabled={loading || !message.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                        Run Simulation
                    </button>
                </div>

                <div className="bg-surface-1 border border-border rounded-xl overflow-hidden flex flex-col h-[500px]">
                    <div className="p-4 border-b border-border bg-surface-2 font-bold flex justify-between items-center">
                        <span>Simulation Output</span>
                        {result && result.success && (
                            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-md">Sim Chat: {result.simChatId}</span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-black/50 font-mono text-xs text-green-400">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-purple-400">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Processing...
                            </div>
                        ) : result ? (
                            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(result, null, 2)}</pre>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                                <p>Ready for simulation</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
