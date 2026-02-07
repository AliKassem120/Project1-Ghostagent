'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Edit2, Share, Loader2, MessageCircle, User, Instagram, Search, Send, Sparkles, Ghost, Menu, ArrowLeft, PlayCircle, PauseCircle, Phone } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import clsx from 'clsx';
import { toast } from 'sonner'; // Assuming sonner or similar toast lib is available or we use context

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
};

export default function InteractionsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [mutedChats, setMutedChats] = useState<Set<string>>(new Set());
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchLogs = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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

        if (logsData) setLogs(logsData);
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
                muted_until: newStatus ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null, // Mute for 24h default
                last_interaction_at: new Date().toISOString()
            }, { onConflict: 'user_id, external_chat_id' });

            // Optimistic Update
            const newMuted = new Set(mutedChats);
            if (newStatus) newMuted.add(chatId);
            else newMuted.delete(chatId);
            setMutedChats(newMuted);

        } catch (e) {
            console.error(e);
        }
    }

    useEffect(() => {
        fetchLogs();
        const channel = supabase
            .channel('interactions-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
                fetchLogs();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_states' }, () => {
                fetchLogs(); // Refresh mute states
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const conversations = useMemo(() => {
        const threads: Record<string, Conversation> = {};

        logs.forEach(log => {
            const meta = log.metadata || {};
            const chatId = meta.chat_id || 'unknown';

            if (log.event_type === 'INCOMING_DM' && log.description.includes('ghostagent.ai')) return;

            let text = log.description;
            let senderName = 'Unknown';
            let isBot = log.event_type === 'AI_REPLY';
            let isManual = log.event_type === 'MANUAL_REPLY' || (meta.is_sender && !isBot);

            if (log.event_type === 'INCOMING_DM') {
                const parts = log.description.split('from');
                senderName = parts[parts.length - 1]?.trim() || 'User';
                text = parts.slice(0, parts.length - 1).join('from').replace('Received:', '').replace(/"/g, '').trim();
            } else if (isBot) {
                senderName = 'Ghost AI';
                text = text.replace('Sent DM to', '').replace(/".*"/, '').trim();
                const contentMatch = log.description.match(/"(.*)"/);
                if (contentMatch) text = contentMatch[1];
            } else if (isManual) {
                senderName = 'You';
                text = text.replace('Sent (Manual):', '').replace(/".*"/, '').trim();
                const contentMatch = log.description.match(/"(.*)"/);
                if (contentMatch) text = contentMatch[1];
            }

            if (!threads[chatId]) {
                threads[chatId] = {
                    chat_id: chatId,
                    username: meta.username || senderName,
                    lastMessage: text,
                    timestamp: log.timestamp,
                    messages: []
                };
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
            if (threads[chatId].username === 'User' && senderName !== 'User' && senderName !== 'You') {
                threads[chatId].username = senderName;
            }
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
                "w-full md:w-80 flex flex-col gap-3 h-full absolute md:relative z-20 bg-[#0a0a0a] md:bg-transparent transition-transform duration-300",
                selectedChatId ? "-translate-x-full md:translate-x-0" : "translate-x-0"
            )}>
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
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50"
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
                "fixed inset-0 md:static flex-1 glass-dark md:rounded-3xl border-0 md:border border-white/10 flex flex-col overflow-hidden relative backdrop-blur-xl z-30 transition-transform duration-300 bg-[#000000] md:bg-transparent",
                selectedChatId ? "translate-x-0" : "translate-x-full md:translate-x-0"
            )}>
                {activeChat ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-3 pt-safe-top md:pt-4">
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
                                                "px-4 py-2.5 md:px-5 md:py-3 rounded-2xl text-[15px] md:text-sm leading-relaxed backdrop-blur-md border break-words",
                                                msg.is_bot
                                                    ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-50 rounded-tr-none shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                                                    : msg.is_manual
                                                        ? "bg-white/10 border-white/10 text-white rounded-tr-none"
                                                        : "bg-black/40 border-white/5 text-white/90 rounded-tl-none"
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

                        {/* Footer - Always Visible */}
                        <div className="p-4 bg-white/5 border-t border-white/10 pb-safe-bottom">
                            <div className="relative group">
                                <input
                                    placeholder={`Reply manually... (Bot is ${isMuted ? 'OFF' : 'ON'})`}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            // Ideally, implement manual send here if API exists
                                            // For now, placeholder functionality as requested (UI only)
                                            // You'd call Unipile API here
                                        }
                                    }}
                                />
                                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all">
                                    <Send className="w-4 h-4" />
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
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                            <Ghost className="w-24 h-24 mb-6 relative z-10 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold uppercase tracking-[0.2em] mb-2">Ghost Operator</h2>
                        <p className="text-sm font-mono text-primary/60">Select a frequency to intercept</p>
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
