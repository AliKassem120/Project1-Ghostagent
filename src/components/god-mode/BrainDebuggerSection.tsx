'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Play, Loader2, Sparkles, RotateCw, History } from 'lucide-react';
import { fetchGodMode } from '@/lib/god-mode/api-client';

type SimMode = 'fresh' | 'replay';

function FieldRow({ label, value, color = 'text-green-400' }: { label: string; value: any; color?: string }) {
    if (value === null || value === undefined) return null;
    const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return (
        <div className="flex gap-2 py-1 border-b border-white/5 last:border-0">
            <span className="text-muted-foreground min-w-[180px] flex-shrink-0">{label}</span>
            <span className={`${color} break-all`}>{display}</span>
        </div>
    );
}

export default function BrainDebuggerSection() {
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState('');
    const [message, setMessage] = useState('');
    const [mode, setMode] = useState<SimMode>('fresh');
    const [replayChatId, setReplayChatId] = useState('');
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
        if (mode === 'replay' && !replayChatId.trim()) return;
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch('/api/god-mode/brain-debugger/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: selectedWorkspace,
                    message,
                    mode,
                    chatId: mode === 'replay' ? replayChatId.trim() : undefined
                })
            });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setResult({ success: false, error: 'Network error' });
        } finally {
            setLoading(false);
        }
    };

    const r = result; // alias
    const pf = r?.preflight;
    const res = r?.result;
    const dbg = res?.debug;
    const val = r?.validation;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Brain className="w-6 h-6 text-purple-500" />
                        Brain Debugger
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Test the decision engine safely without sending external messages.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── INPUT PANEL ────────────────────────────────────── */}
                <div className="bg-surface-1 border border-border rounded-xl p-6 space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMode('fresh')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'fresh' ? 'bg-purple-500 text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}
                        >
                            <Sparkles className="w-4 h-4" /> Fresh Simulation
                        </button>
                        <button
                            onClick={() => setMode('replay')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'replay' ? 'bg-blue-500 text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}
                        >
                            <History className="w-4 h-4" /> Existing Chat Replay
                        </button>
                    </div>

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

                    {mode === 'replay' && (
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Chat ID</label>
                            <input
                                type="text"
                                value={replayChatId}
                                onChange={(e) => setReplayChatId(e.target.value)}
                                placeholder="Real Instagram / WhatsApp Chat ID"
                                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">User Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={mode === 'replay'
                                ? "Test what happens if THIS customer sends this message..."
                                : "Type a message to test (e.g. 'how much is ps5?')"
                            }
                            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-purple-500 transition-colors resize-y"
                        />
                    </div>

                    <button
                        onClick={runSimulation}
                        disabled={loading || !message.trim() || (mode === 'replay' && !replayChatId.trim())}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-bold transition-all disabled:opacity-50 ${mode === 'replay' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'}`}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                        {mode === 'replay' ? 'Replay Against Real State' : 'Run Fresh Simulation'}
                    </button>
                </div>

                {/* ── OUTPUT PANEL ───────────────────────────────────── */}
                <div className="bg-surface-1 border border-border rounded-xl overflow-hidden flex flex-col max-h-[700px]">
                    <div className="p-4 border-b border-border bg-surface-2 font-bold flex justify-between items-center flex-shrink-0">
                        <span>Structured Output</span>
                        {r?.success && (
                            <span className={`text-xs px-2 py-1 rounded-md ${r.mode === 'replay' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                                {r.mode === 'replay' ? `Chat: ${r.chatId}` : `Sim: ${r.simChatId}`}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-black/50 font-mono text-xs">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-purple-400">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Processing...
                            </div>
                        ) : r?.success ? (
                            <div className="space-y-4">
                                {/* Preflight */}
                                <div className="text-purple-400 font-bold mb-1">── PREFLIGHT ──</div>
                                <FieldRow label="Detected Language" value={pf?.detectedLanguage} />
                                <FieldRow label="Intent" value={`${pf?.intentClassification?.intent} (${pf?.intentClassification?.confidence}, ${pf?.intentClassification?.source})`} />
                                <FieldRow label="Availability Candidate" value={pf?.availabilityCandidate} />
                                <FieldRow label="Purchase Candidate" value={pf?.purchaseCandidate} />
                                <FieldRow label="Purchase Quantity" value={pf?.purchaseQuantity} />
                                <FieldRow label="Product Match" value={pf?.productMatch} color="text-yellow-400" />
                                {pf?.postContextClassification && <FieldRow label="Post-Context" value={pf.postContextClassification} color="text-orange-400" />}

                                {/* Replay-specific context */}
                                {r.mode === 'replay' && (
                                    <>
                                        <div className="text-blue-400 font-bold mt-4 mb-1">── PRE-EXISTING CONTEXT ──</div>
                                        <FieldRow label="State Before (DB)" value={r.stateBefore} color="text-blue-400" />
                                        <FieldRow label="Post-Context Before" value={r.postContextBefore} color="text-blue-400" />
                                        {r.latestOrder && <FieldRow label="Latest Order" value={r.latestOrder} color="text-blue-400" />}
                                        {r.latestAppointment && <FieldRow label="Latest Appointment" value={r.latestAppointment} color="text-blue-400" />}
                                    </>
                                )}

                                {/* Engine Result */}
                                <div className="text-green-400 font-bold mt-4 mb-1">── ENGINE RESULT ──</div>
                                <FieldRow label="Should Reply" value={res?.shouldReply} />
                                <FieldRow label="State Before" value={res?.stateBefore} />
                                <FieldRow label="State After" value={res?.stateAfter} />
                                <FieldRow label="Intent (Engine)" value={dbg?.intent} />
                                <FieldRow label="Actions" value={res?.actions} color="text-cyan-400" />
                                <FieldRow label="DB Write Attempted" value={dbg?.dbWriteAttempted} />
                                <FieldRow label="DB Write Success" value={dbg?.dbWriteSuccess} />
                                <FieldRow label="Duration (ms)" value={dbg?.durationMs} />
                                {res?.error && <FieldRow label="Error" value={res.error} color="text-red-400" />}

                                {/* Reply */}
                                <div className="text-yellow-400 font-bold mt-4 mb-1">── REPLY ──</div>
                                <FieldRow label="Final Reply" value={res?.replyText} color="text-white" />

                                {/* Validation */}
                                <div className="text-orange-400 font-bold mt-4 mb-1">── VALIDATION ──</div>
                                {val ? (
                                    <>
                                        <FieldRow label="Valid" value={val.isValid} color={val.isValid ? 'text-green-400' : 'text-red-400'} />
                                        {val.reason && <FieldRow label="Reason" value={val.reason} color="text-red-400" />}
                                        {val.repaired && <FieldRow label="Repaired Reply" value={val.repaired} color="text-yellow-400" />}
                                    </>
                                ) : (
                                    <FieldRow label="Validation" value="No reply to validate" />
                                )}

                                {/* Post-State */}
                                {r.stateAfter && (
                                    <>
                                        <div className="text-purple-400 font-bold mt-4 mb-1">── STATE AFTER ──</div>
                                        <FieldRow label="State After (DB)" value={r.stateAfter} color="text-purple-400" />
                                    </>
                                )}
                                {r.postContextAfter && (
                                    <FieldRow label="Post-Context After" value={r.postContextAfter} color="text-purple-400" />
                                )}
                            </div>
                        ) : r?.error ? (
                            <div className="text-red-400">{r.error}</div>
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
