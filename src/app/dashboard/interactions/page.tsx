'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Edit2, Share, Loader2, MessageCircle, User, Instagram, Search, Send } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import clsx from 'clsx';

type Message = {
    id: string;
    text: string;
    sender: string;
    is_sender: boolean;
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
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchLogs = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: logsData } = await supabase
            .from('activity_log')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: true }); // Ascending for internal thread sorting

        if (logsData) setLogs(logsData);
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();

        // Realtime sync
        const channel = supabase
            .channel('interactions-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
                fetchLogs();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // Process logs into threaded conversations
    const conversations = useMemo(() => {
        const threads: Record<string, Conversation> = {};

        logs.forEach(log => {
            const meta = log.metadata || {};
            const chatId = meta.chat_id || 'unknown';

            // Skip loopback duplicates: Don't show "ghostagent.ai Received" if we already have the "Sent" log
            if (log.event_type === 'INCOMING_DM' && log.description.includes('ghostagent.ai')) return;

            // Extract content and sender
            let text = log.description;
            let senderName = 'Unknown';
            let isBot = log.event_type === 'AI_REPLY';

            if (log.event_type === 'INCOMING_DM') {
                const parts = log.description.split('from');
                senderName = parts[parts.length - 1]?.trim() || 'User';
                text = parts.slice(0, parts.length - 1).join('from').replace('Received:', '').replace(/"/g, '').trim();
            } else if (isBot) {
                senderName = 'Assistant';
                text = text.replace('Sent DM to', '').replace(/".*"/, '').trim();
                // Get original content from description quotes if possible or use description
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
                is_sender: isBot,
                timestamp: log.timestamp,
                type: log.event_type
            });

            threads[chatId].lastMessage = text;
            threads[chatId].timestamp = log.timestamp;
        });

        // Convert to array and sort by latest message
        return Object.values(threads).sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }, [logs]);

    const activeChat = conversations.find(c => c.chat_id === selectedChatId);

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );

    return (
        <div className="h-[calc(100vh-160px)] flex gap-4 overflow-hidden">
            {/* Conversation List */}
            <div className="w-80 flex flex-col gap-3 h-full">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Instagram className="w-5 h-5 text-pink-500" />
                        Inbox
                    </h1>
                </div>

                <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                        placeholder="Search chats..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {conversations.map((conv) => (
                        <button
                            key={conv.chat_id}
                            onClick={() => setSelectedChatId(conv.chat_id)}
                            className={clsx(
                                "w-full text-left p-4 rounded-2xl border transition-all duration-200 group",
                                selectedChatId === conv.chat_id
                                    ? "glass-dark border-primary/40 bg-primary/5"
                                    : "border-white/5 hover:bg-white/5"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/10">
                                    <User className="w-5 h-5 text-white/60" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-sm truncate">{conv.username}</h3>
                                        <span className="text-[10px] text-white/30 whitespace-nowrap">
                                            {new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/40 truncate mt-0.5">
                                        {conv.lastMessage}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}

                    {conversations.length === 0 && (
                        <div className="text-center py-10 opacity-40">
                            <MessageCircle className="w-10 h-10 mx-auto mb-2" />
                            <p className="text-sm">No conversations yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat View */}
            <div className="flex-1 glass-dark rounded-3xl border border-white/10 flex flex-col overflow-hidden relative">
                {activeChat ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                {activeChat.username[0].toUpperCase()}
                            </div>
                            <div>
                                <h2 className="font-bold text-sm">{activeChat.username}</h2>
                                <span className="text-[10px] text-green-400 flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                    Active via Instagram
                                </span>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            <AnimatePresence>
                                {activeChat.messages.map((msg, i) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={clsx(
                                            "flex flex-col max-w-[80%]",
                                            msg.is_sender ? "ml-auto items-end" : "mr-auto items-start"
                                        )}
                                    >
                                        <div className={clsx(
                                            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                                            msg.is_sender
                                                ? "bg-primary text-black font-medium rounded-tr-none shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]"
                                                : "bg-white/10 text-white rounded-tl-none border border-white/5"
                                        )}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[9px] text-white/20 mt-1 uppercase tracking-wider">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Quick Action Input (Internal Use) */}
                        <div className="p-4 bg-white/5 border-t border-white/10">
                            <div className="relative group">
                                <input
                                    placeholder={`Reply as Operator to ${activeChat.username}...`}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                />
                                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-[10px] text-white/20 mt-2 text-center uppercase tracking-widest">
                                Handled by Ghost Agent Pro 🤖
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 select-none">
                        <MessageCircle className="w-20 h-20 mb-4" />
                        <h2 className="text-xl font-bold uppercase tracking-widest">Select a Transmission</h2>
                        <p className="text-sm">Choose a thread to view the communication history</p>
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
            `}</style>
        </div>
    );
}
