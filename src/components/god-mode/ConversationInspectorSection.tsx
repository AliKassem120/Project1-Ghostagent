'use client';

import React, { useState } from 'react';
import { MessageSquare, Search, Loader2, User, Bot, AlertTriangle, Database, ShoppingCart, Calendar } from 'lucide-react';

export default function ConversationInspectorSection() {
    const [chatId, setChatId] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [linkedData, setLinkedData] = useState<any>(null);
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [expandedMeta, setExpandedMeta] = useState<Set<number>>(new Set());

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatId.trim()) return;

        setLoading(true);
        setError('');
        setHasSearched(true);
        setMessages([]);
        setLinkedData(null);
        setExpandedMeta(new Set());

        try {
            const res = await fetch(`/api/god-mode/conv-inspector?chatId=${encodeURIComponent(chatId.trim())}`);
            const data = await res.json();

            if (data.success) {
                setMessages(data.messages);
                setLinkedData(data.linkedData);
            } else {
                setError(data.error || 'Failed to fetch conversation');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const toggleMeta = (idx: number) => {
        setExpandedMeta(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-blue-500" />
                        Conversation Inspector
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Pull full raw conversation threads by Chat ID with linked automation metadata.</p>
                </div>
            </div>

            <div className="bg-surface-1 border border-border rounded-xl p-6">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <input
                        type="text"
                        value={chatId}
                        onChange={(e) => setChatId(e.target.value)}
                        placeholder="Enter Chat ID (e.g. 1234567890)"
                        className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                    <button
                        type="submit"
                        disabled={loading || !chatId.trim()}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        Inspect
                    </button>
                </form>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {hasSearched && !loading && !error && messages.length === 0 && (
                <div className="bg-surface-1 border border-border rounded-xl p-8 text-center text-muted-foreground">
                    <MessageSquare className="w-8 h-8 text-blue-500 mx-auto mb-4 opacity-50" />
                    <p>No conversation history found for this Chat ID.</p>
                </div>
            )}

            {/* Linked Data Cards */}
            {linkedData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Current State */}
                    <div className="bg-surface-1 border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 font-bold text-sm mb-2">
                            <Database className="w-4 h-4 text-purple-500" /> Current State
                        </div>
                        {linkedData.currentState ? (
                            <div className="text-xs font-mono space-y-1">
                                <div>Stage: <span className="text-purple-400">{linkedData.currentState.stage}</span></div>
                                <div className="text-muted-foreground">Updated: {new Date(linkedData.currentState.updated_at).toLocaleString()}</div>
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground">idle (no saved state)</div>
                        )}
                    </div>

                    {/* Linked Orders */}
                    <div className="bg-surface-1 border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 font-bold text-sm mb-2">
                            <ShoppingCart className="w-4 h-4 text-green-500" /> Linked Orders ({linkedData.orders.length})
                        </div>
                        {linkedData.orders.length > 0 ? linkedData.orders.map((o: any) => (
                            <div key={o.id} className="text-xs font-mono text-muted-foreground">
                                {o.item_name || 'Order'} — <span className="text-green-400">{o.status}</span>
                            </div>
                        )) : <div className="text-xs text-muted-foreground">None</div>}
                    </div>

                    {/* Linked Appointments */}
                    <div className="bg-surface-1 border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 font-bold text-sm mb-2">
                            <Calendar className="w-4 h-4 text-orange-500" /> Linked Appointments ({linkedData.appointments.length})
                        </div>
                        {linkedData.appointments.length > 0 ? linkedData.appointments.map((a: any) => (
                            <div key={a.id} className="text-xs font-mono text-muted-foreground">
                                {a.service_name || 'Appt'} — <span className="text-orange-400">{a.status}</span>
                            </div>
                        )) : <div className="text-xs text-muted-foreground">None</div>}
                    </div>
                </div>
            )}

            {/* Message Thread */}
            {messages.length > 0 && (
                <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-border bg-surface-2 font-bold flex justify-between items-center">
                        <span>Thread Transcript</span>
                        <span className="text-xs text-muted-foreground">{messages.length} messages</span>
                    </div>
                    <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'bot' && (
                                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                        <Bot className="w-3.5 h-3.5 text-blue-400" />
                                    </div>
                                )}
                                <div className="max-w-[75%]">
                                    <div className={`rounded-2xl p-3 ${msg.role === 'user' ? 'bg-surface-3 text-foreground rounded-tr-sm' : 'bg-blue-500/10 border border-blue-500/20 text-blue-100 rounded-tl-sm'}`}>
                                        <div className="text-sm whitespace-pre-wrap">{msg.content || '(Empty/Media)'}</div>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-3">
                                        <span>{new Date(msg.timestamp).toLocaleString()}</span>
                                        <span className="opacity-50">{msg.eventType}</span>
                                        {/* V2 metadata badges */}
                                        {msg.intent && <span className="bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">{msg.intent}</span>}
                                        {msg.actions && msg.actions.length > 0 && (
                                            <span className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded">{msg.actions.join(', ')}</span>
                                        )}
                                        {msg.stateBefore && msg.stateAfter && msg.stateBefore !== msg.stateAfter && (
                                            <span className="bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded">{msg.stateBefore} → {msg.stateAfter}</span>
                                        )}
                                        {msg.error && <span className="bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">ERROR</span>}
                                        {(msg.intent || msg.actions) && (
                                            <button onClick={() => toggleMeta(i)} className="text-muted-foreground hover:text-foreground underline">
                                                {expandedMeta.has(i) ? 'hide' : 'meta'}
                                            </button>
                                        )}
                                    </div>
                                    {/* Expandable metadata */}
                                    {expandedMeta.has(i) && (
                                        <div className="mt-2 p-2 bg-black/30 rounded-lg text-[10px] font-mono text-muted-foreground space-y-0.5">
                                            {msg.language && <div>language: {msg.language}</div>}
                                            {msg.intent && <div>intent: {msg.intent}</div>}
                                            {msg.stateBefore && <div>state: {msg.stateBefore} → {msg.stateAfter}</div>}
                                            {msg.actions && <div>actions: [{msg.actions.join(', ')}]</div>}
                                            {msg.durationMs && <div>duration: {msg.durationMs}ms</div>}
                                            {msg.platform && <div>platform: {msg.platform}</div>}
                                            {msg.requestId && <div>requestId: {msg.requestId}</div>}
                                            {msg.error && <div className="text-red-400">error: {msg.error}</div>}
                                        </div>
                                    )}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0 mt-1">
                                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
