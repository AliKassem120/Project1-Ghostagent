'use client';

import React, { useState } from 'react';
import { MessageSquare, Search, Loader2, User, Bot, AlertTriangle } from 'lucide-react';

export default function ConversationInspectorSection() {
    const [chatId, setChatId] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatId.trim()) return;

        setLoading(true);
        setError('');
        setHasSearched(true);
        setMessages([]);

        try {
            const res = await fetch(`/api/god-mode/conv-inspector?chatId=${encodeURIComponent(chatId.trim())}`);
            const data = await res.json();

            if (data.success) {
                setMessages(data.messages);
            } else {
                setError(data.error || 'Failed to fetch conversation');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-blue-500" />
                        Conversation Inspector
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Pull full raw conversation threads by Chat ID.</p>
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

            {messages.length > 0 && (
                <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-border bg-surface-2 font-bold flex justify-between items-center">
                        <span>Thread Transcript</span>
                        <span className="text-xs text-muted-foreground">{messages.length} messages</span>
                    </div>
                    <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'bot' && (
                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                        <Bot className="w-4 h-4 text-blue-400" />
                                    </div>
                                )}
                                <div className={`max-w-[70%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-surface-3 text-foreground rounded-tr-sm' : 'bg-blue-500/10 border border-blue-500/20 text-blue-100 rounded-tl-sm'}`}>
                                    <div className="text-sm whitespace-pre-wrap">{msg.content || '(Empty/Media)'}</div>
                                    <div className="text-[10px] text-muted-foreground mt-2 flex justify-between gap-4">
                                        <span>{new Date(msg.timestamp).toLocaleString()}</span>
                                        <span className="opacity-50">{msg.eventType}</span>
                                    </div>
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0 mt-1">
                                        <User className="w-4 h-4 text-muted-foreground" />
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
