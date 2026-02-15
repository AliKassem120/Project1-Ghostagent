'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Edit2, Share, Loader2, MessageCircle, User, Instagram, Search, Send, Sparkles, Ghost, Menu, ArrowLeft, PlayCircle, PauseCircle, Phone } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import clsx from 'clsx';
import { useToast } from '@/contexts/ToastContext';

type Message = {
    id: string;
    text: string;
    sender: string;
    is_sender: boolean;
    is_bot: boolean;
    is_manual: boolean;
    timestamp: string;
    type: string;
};

type Conversation = {
    chat_id: string;
    username: string;
    lastMessage: string;
    timestamp: string;
    messages: Message[];
    account_id?: string; // Store account context
};

export default function InteractionsPage() {
    const { success, error } = useToast();
    const [logs, setLogs] = useState<any[]>([]);
    const [mutedChats, setMutedChats] = useState<Set<string>>(new Set());
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [inputMessage, setInputMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const supabase = createClient();

    const fetchLogs = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Store userId for realtime subscription filter
        setUserId(user.id);

        // Fetch Logs
        const { data: logsData } = await supabase
            .from('activity_log')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: true });

        // Fetch Muted States
        const { data: states } = await supabase
            .from('conversation_states')
            .select('external_chat_id, is_muted')
            .eq('user_id', user.id)
            .eq('is_muted', true);

        if (logsData) {
            // Force Deduplication (UI Side) - use Map for guaranteed uniqueness
            const uniqueMap = new Map<string, any>();
            logsData.forEach(log => uniqueMap.set(log.id, log));
            setLogs(Array.from(uniqueMap.values()));
        }
        if (states) {
            setMutedChats(new Set(states.map(s => s.external_chat_id)));
        }
        setLoading(false);
    };

    const toggleMute = async (chatId: string, currentStatus: boolean) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const newStatus = !currentStatus;

            await supabase.from('conversation_states').upsert({
                user_id: user.id,
                external_chat_id: chatId,
                platform: 'INSTAGRAM',
                is_muted: newStatus,
                muted_until: newStatus ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
                last_interaction_at: new Date().toISOString()
            }, { onConflict: 'user_id, external_chat_id' });

            const newMuted = new Set(mutedChats);
            if (newStatus) newMuted.add(chatId);
            else newMuted.delete(chatId);
            setMutedChats(newMuted);

            if (newStatus) success('Ghost AI Muted');
            else success('Ghost AI Resumed');

        } catch (e) {
            console.error(e);
            error('Failed to update status');
        }
    }

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || !selectedChatId) return;

        // Find current chat to get account_id
        const activeChat = conversations.find(c => c.chat_id === selectedChatId);
        if (!activeChat) return;

        if (sending) return; // Prevent double sending
        setSending(true);

        const currentInput = inputMessage; // Capture current input
        setInputMessage(''); // Clear input immediately for responsiveness

        // Optimistic Update: Create a temporary message
        const tempId = `temp-${Date.now()}`;
        const tempLog = {
            id: tempId,
            user_id: userId, // Current user
            event_type: 'MANUAL_REPLY',
            description: `Sent (Manual): "${currentInput}"`, // Match DB format to avoid UI flickering
            timestamp: new Date().toISOString(),
            metadata: {
                chat_id: selectedChatId,
                username: 'You',
                is_sender: true,
                is_manual: true,
                account_id: activeChat.account_id
            }
        };

        // Show it immediately
        setLogs(prev => [...prev, tempLog]);

        try {
            const res = await fetch('/api/messages/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: selectedChatId,
                    text: currentInput, // send raw text
                    accountId: activeChat.account_id
                })
            });

            if (res.ok) {
                const { data } = await res.json(); // Get the real inserted log
                // Replace optimistic log with real log (swaps temp-ID for real UUID)
                setLogs(prev => prev.map(l => l.id === tempId ? data : l));
            } else {
                // Remove temp message on failure
                setLogs(prev => prev.filter(l => l.id !== tempId));
                const errData = await res.json();
                error(errData.error || 'Failed to send');
                setInputMessage(currentInput); // Restore text on error
            }
        } catch (e) {
            console.error(e);
            setLogs(prev => prev.filter(l => l.id !== tempId));
            error('Network error sending message');
            setInputMessage(currentInput); // Restore text on error
        } finally {
            setSending(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    // 🔥 REALTIME: Subscribe to activity_log with user filter and strict deduplication
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`interactions-sync-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_log',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const newLog = payload.new;
                    setLogs((prev) => {
                        // ✅ STRICT DEDUPLICATION: Only add if ID doesn't exist
                        if (prev.some(l => l.id === newLog.id)) {
                            console.log('[Interactions] Duplicate blocked:', newLog.id);
                            return prev;
                        }
                        return [...prev, newLog];
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversation_states',
                    filter: `user_id=eq.${userId}`
                },
                () => {
                    // Refetch muted states when they change
                    fetchLogs();
                }
            )
            .subscribe((status) => {
                console.log('[Interactions] Subscription status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const conversations = useMemo(() => {
        const threads: Record<string, Conversation> = {};

        logs.forEach(log => {
            const meta = log.metadata || {};
            const chatId = meta.chat_id || 'unknown';

            if (log.event_type === 'INCOMING_DM' && log.description.includes('ghostagent.ai')) return;

            let text = log.description || '';
            let senderName = 'Unknown';
            let isBot = log.event_type === 'AI_REPLY';
            let isManual = log.event_type === 'MANUAL_REPLY' || (meta.is_sender && !isBot);

            // Extract Sender Name & Text
            if (log.event_type === 'INCOMING_DM') {
                // Try to get robust name from metadata first
                if (meta.sender && meta.sender.attendee_name) {
                    senderName = meta.sender.attendee_name;
                } else if (meta.username && meta.username !== 'You') {
                    senderName = meta.username;
                } else {
                    const parts = log.description.split('from');
                    senderName = parts[parts.length - 1]?.trim() || 'User';
                }
                text = text.replace(/^Received: "(.*)" from .*$/, '$1').replace(/"/g, '').trim();
            } else if (isBot) {
                senderName = 'Ghost AI';
                text = text.replace(/^Sent: "(.*)"$/, '$1').replace(/"/g, '').trim();
            } else if (isManual) {
                senderName = 'You';
                text = text.replace(/^Sent \(Manual\): "(.*)"$/, '$1').replace(/"/g, '').trim();
            }

            // Cleanup text quotes if regex didn't catch
            if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);

            if (!threads[chatId]) {
                threads[chatId] = {
                    chat_id: chatId,
                    username: 'User', // Default
                    lastMessage: text,
                    timestamp: log.timestamp,
                    messages: [],
                    account_id: meta.account_id // Capture account_id if available
                };
            }

            // Capture account_id if missing and available in this log
            if (!threads[chatId].account_id && meta.account_id) {
                threads[chatId].account_id = meta.account_id;
            }

            // Update Username Logic (Prioritize Customer Name)
            // If current name is generic ('User', 'You', 'Ghost AI'), try to update it
            const currentName = threads[chatId].username;
            const isGenericName = currentName === 'User' || currentName === 'You' || currentName === 'Ghost AI';
            const isNewSenderGeneric = senderName === 'User' || senderName === 'You' || senderName === 'Ghost AI';

            if (isGenericName && !isNewSenderGeneric) {
                threads[chatId].username = senderName;
            }

            threads[chatId].messages.push({
                id: log.id,
                text,
                sender: senderName,
                is_sender: isBot || isManual,
                is_bot: isBot,
                is_manual: isManual,
                timestamp: log.timestamp,
                type: log.event_type
            });

            threads[chatId].lastMessage = text;
            threads[chatId].timestamp = log.timestamp;
        });

        return Object.values(threads).sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }, [logs]);

    const activeChat = conversations.find(c => c.chat_id === selectedChatId);
    const isMuted = selectedChatId ? mutedChats.has(selectedChatId) : false;

    return (
        <div className="h-[calc(100dvh-100px)] md:h-[calc(100vh-160px)] flex gap-4 overflow-hidden font-sans relative">

            {/* Sidebar (Responsive) */}
            <div className={clsx(
                "w-full md:w-80 flex flex-col gap-3 h-full absolute md:relative z-20 bg-background md:bg-transparent transition-transform duration-300",
                selectedChatId ? "-translate-x-full md:translate-x-0" : "translate-x-0"
            )}>
                {/* ... Header & Search (Keep Same) ... */}
                <div className="flex items-center justify-between mb-2 px-1">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Instagram className="w-5 h-5 text-pink-500" />
                        Inbox
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                    </h1>
                </div>

                <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                        placeholder="Search chats..."
                        className="input-premium w-full pl-10 py-2"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar pb-24 md:pb-0">
                    {conversations.map((conv) => (
                        <button
                            key={conv.chat_id}
                            onClick={() => setSelectedChatId(conv.chat_id)}
                            className={clsx(
                                "w-full text-left p-4 rounded-2xl border transition-all duration-200 group relative overflow-hidden",
                                selectedChatId === conv.chat_id
                                    ? "glass-dark border-primary/40 bg-primary/5"
                                    : "border-white/5 hover:bg-white/5"
                            )}
                        >
                            <div className={clsx("absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full transition-transform duration-1000", selectedChatId === conv.chat_id ? "translate-x-full" : "")} />

                            <div className="flex items-center gap-3 relative z-10">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/10 shrink-0">
                                    <User className="w-5 h-5 text-white/60" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-sm truncate">{conv.username}</h3>
                                        <span className="text-[10px] text-white/30 whitespace-nowrap">
                                            {new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className={clsx("text-xs truncate mt-0.5 flex items-center gap-1",
                                        conv.messages[conv.messages.length - 1]?.is_bot ? "text-primary/70" : "text-white/40"
                                    )}>
                                        {conv.messages[conv.messages.length - 1]?.is_bot && <Ghost className="w-3 h-3" />}
                                        {conv.lastMessage}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area (Responsive) */}
            <div className={clsx(
                "fixed inset-0 md:static flex-1 glass-dark md:rounded-3xl border-0 md:border-0 flex flex-col overflow-hidden relative z-30 transition-transform duration-300 bg-surface-1 md:bg-transparent",
                selectedChatId ? "translate-x-0" : "translate-x-full md:translate-x-0"
            )}>
                {activeChat ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-white/[0.06] bg-surface-2/50 flex items-center gap-3 pt-safe-top md:pt-4">
                            <button
                                onClick={() => setSelectedChatId(null)}
                                className="md:hidden p-2 -ml-2 text-white/60 hover:text-white"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                {activeChat.username[0].toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <h2 className="font-bold text-sm">{activeChat.username}</h2>
                                {isMuted ? (
                                    <span className="text-[10px] text-yellow-500 flex items-center gap-1 font-bold">
                                        <PauseCircle className="w-3 h-3" />
                                        MUTED (Manual)
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-green-400 flex items-center gap-1 font-bold">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                        GHOST ACTIVE
                                    </span>
                                )}
                            </div>

                            {/* Manual Toggle Button */}
                            <button
                                onClick={() => toggleMute(activeChat.chat_id, isMuted)}
                                className={clsx(
                                    "px-3 py-1.5 text-xs rounded-lg border flex items-center gap-2 transition-all font-bold",
                                    isMuted
                                        ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                                        : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                                )}
                            >
                                {isMuted ? (
                                    <><PlayCircle className="w-3 h-3" /> Resume AI</>
                                ) : (
                                    <><PauseCircle className="w-3 h-3" /> Mute AI</>
                                )}
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar pb-24 md:pb-6">
                            <AnimatePresence>
                                {activeChat.messages.map((msg, i) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        className={clsx(
                                            "flex flex-col max-w-[85%] md:max-w-[75%]",
                                            msg.is_sender ? "ml-auto items-end" : "mr-auto items-start"
                                        )}
                                    >
                                        <div className="flex items-end gap-2">
                                            {msg.is_bot && (
                                                <div className="w-6 h-6 rounded-full bg-cyan-500/10 flex items-center justify-center mb-1">
                                                    <Ghost className="w-3 h-3 text-cyan-400" />
                                                </div>
                                            )}

                                            <div className={clsx(
                                                "px-4 py-2.5 md:px-5 md:py-3 rounded-2xl text-[15px] md:text-sm leading-relaxed border break-words",
                                                msg.is_bot
                                                    ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-50 rounded-tr-none shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                                                    : msg.is_manual
                                                        ? "bg-surface-3 border-white/[0.08] text-white rounded-tr-none"
                                                        : "bg-surface-2 border-white/[0.06] text-white/90 rounded-tl-none"
                                            )}>
                                                {msg.text}
                                            </div>
                                        </div>

                                        <span className="text-[10px] text-white/20 mt-1 px-1 uppercase tracking-wider flex items-center gap-1">
                                            {msg.is_bot && <Sparkles className="w-2 h-2 text-cyan-500/50" />}
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {msg.is_manual && " • YOU"}
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Footer - Send Input */}
                        <div className="p-4 bg-surface-2/50 border-t border-white/[0.06] pb-safe-bottom">
                            <div className="relative group">
                                <input
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder={`Reply manually... (Bot is ${isMuted ? 'OFF' : 'ON'})`}
                                    className="input-premium w-full rounded-2xl py-3 pl-4 pr-12 disabled:opacity-50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    disabled={sending}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={sending || !inputMessage.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all disabled:opacity-0"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-white/20 mt-2 text-center uppercase tracking-widest flex justify-center gap-2">
                                <span>Manager Mode Active</span>
                                {isMuted ? (
                                    <span className="text-yellow-500">• Manual Control</span>
                                ) : (
                                    <span className="text-green-500">• Monitoring</span>
                                )}
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="hidden md:flex flex-1 flex-col items-center justify-center opacity-30 select-none">
                        {/* Empty State */}
                        <div className="relative">
                            <Ghost className="w-24 h-24 mb-6 relative z-10 text-white/10" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-white/20">Agent Monitor</h2>
                        <p className="text-sm text-white/15">Select a conversation to view</p>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                .pb-safe-top {
                    padding-top: env(safe-area-inset-top);
                }
                .pb-safe-bottom {
                    padding-bottom: env(safe-area-inset-bottom);
                }
            `}</style>
        </div>
    );
}
