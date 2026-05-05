'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Edit2, Share, Loader2, MessageCircle, User, Instagram, Search, Send, Sparkles, Ghost, Menu, ArrowLeft, PlayCircle, PauseCircle, Bot, Trash2 } from 'lucide-react';
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
    isComment?: boolean;
    platform?: 'instagram' | 'whatsapp'; // Track message source
};
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAutopilot } from '@/context/AutopilotContext';
import { buildConversations } from '@/lib/dashboard/inbox-utils';

// WhatsApp brand icon (official path)
const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

// ...

export default function InteractionsPage() {
    const { autopilot, setAutopilot, isLoading: autopilotLoading } = useAutopilot();
    const { success, error } = useToast();
    const [logs, setLogs] = useState<any[]>([]);
    const [mutedChats, setMutedChats] = useState<Set<string>>(new Set());
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [inputMessage, setInputMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [draftSending, setDraftSending] = useState<string | null>(null); // Track which draft is being sent
    const [fetchedProfiles, setFetchedProfiles] = useState<Record<string, string>>({}); // Cache for fetched names
    const { activeWorkspaceId, activeWorkspace, planTier } = useWorkspace(); // Get active workspace
    const supabase = createClient();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change or chat opens
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [selectedChatId, logs]); // Logs change when new messages arrive

    const fetchLogs = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Store userId for realtime subscription filter
        setUserId(user.id);

        if (!activeWorkspaceId) {
            setLoading(false);
            return;
        }

        let query = supabase
            .from('activity_log')
            .select('*')
            .eq('workspace_id', activeWorkspaceId);

        const currentWS = activeWorkspaceId;
        // Fetch Logs
        const { data: logsData } = await query.order('timestamp', { ascending: true });

        // Fetch Muted States
        const { data: states } = await supabase
            .from('conversation_states')
            .select('external_chat_id, is_muted')
            .eq('workspace_id', activeWorkspaceId)
            .eq('is_muted', true);

        if (currentWS !== activeWorkspaceId) return;

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
            if (!activeWorkspaceId) {
                error('No active workspace selected');
                return;
            }

            const newStatus = !currentStatus;

            const { data: existingState } = await supabase
                .from('conversation_states')
                .select('id')
                .eq('workspace_id', activeWorkspaceId)
                .eq('external_chat_id', chatId)
                .maybeSingle();

            let reqError;
            if (existingState) {
                const { error } = await supabase.from('conversation_states').update({
                    is_muted: newStatus,
                    muted_until: newStatus ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
                    last_interaction_at: new Date().toISOString()
                }).eq('id', existingState.id);
                reqError = error;
            } else {
                const { error } = await supabase.from('conversation_states').insert({
                    user_id: user.id,
                    workspace_id: activeWorkspaceId,
                    external_chat_id: chatId,
                    chat_id: chatId,
                    workspace_type: activeWorkspace?.business_type || 'ecommerce',
                    platform: conversations.find(c => c.chat_id === chatId)?.platform?.toUpperCase() || 'INSTAGRAM',
                    is_muted: newStatus,
                    muted_until: newStatus ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
                    last_interaction_at: new Date().toISOString()
                });
                reqError = error;
            }

            if (reqError) throw reqError;

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
                    accountId: activeChat.account_id,
                    workspaceId: activeWorkspaceId
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
    }, [activeWorkspaceId]);

    // 🔥 REALTIME: Subscribe to activity_log with user filter and strict deduplication
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`inbox-sync-${userId}`)
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
                    // Only process logs meant for the active workspace
                    if (activeWorkspaceId && newLog.workspace_id && newLog.workspace_id !== activeWorkspaceId) return;
                    setLogs((prev) => {
                        if (prev.some(l => l.id === newLog.id)) return prev;
                        return [...prev, newLog];
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'activity_log',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const updatedLog = payload.new;
                    setLogs((prev) => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
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

    // Fetch Profiles for Unknown Users
    useEffect(() => {
        const fetchProfiles = async () => {
            if (!logs.length) return;

            // Find unknown users from logs who don't have a fetched profile yet
            // Includes logic to detect previously failed fetch attempts like 'User 0461'
            const unknowns = logs.filter(l => {
                const isMessage = ['INCOMING_MESSAGE', 'INCOMING_DM', 'DRAFT_REPLY'].includes(l.event_type);
                const hasBadName = !l.metadata?.sender?.attendee_name &&
                    (!l.metadata?.username || String(l.metadata?.username).startsWith('User '));
                return isMessage && hasBadName && !fetchedProfiles[l.metadata?.chat_id];
            });

            // Deduplicate chat IDs
            const chatIds = Array.from(new Set(unknowns.map(l => l.metadata?.chat_id))).filter(Boolean) as string[];
            if (!chatIds.length) return;

            // Mark loading
            setFetchedProfiles(prev => {
                const next = { ...prev };
                chatIds.forEach(id => next[id] = 'Loading name...');
                return next;
            });

            // Fetch each profile
            for (const chatId of chatIds) {
                try {
                    const res = await fetch(`/api/instagram/profile?id=${chatId}&workspaceId=${activeWorkspaceId}`);
                    const data = await res.json();

                    if (data.name) {
                        setFetchedProfiles(prev => ({ ...prev, [chatId]: data.name }));

                        // Optional: Update DB to persist name (Fire and forget)
                        // We use metadata update via API or client if possible, but client RLS might block update.
                        // Relying on local state for now as requested ("Update the UI...").
                    } else {
                        setFetchedProfiles(prev => ({ ...prev, [chatId]: 'Instagram User' }));
                    }
                } catch (e) {
                    setFetchedProfiles(prev => ({ ...prev, [chatId]: 'Unknown' }));
                }
            }
        };

        fetchProfiles();
    }, [logs]); // Only runs when logs change

    const handleSendDraft = async (draftId: string, text: string, chatId: string, accountId?: string) => {
        if (draftSending) return;
        setDraftSending(draftId);

        try {
            // Optimistically update logs to show 'sending...' or similar? 
            // Or just rely on loading state.

            const res = await fetch('/api/messages/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, text, accountId, workspaceId: activeWorkspaceId })
            });

            if (res.ok) {
                success('Draft sent successfully');
                // Remove the draft log since it's now sent
                await supabase.from('activity_log').delete().eq('id', draftId);
                // Update local logs immediately so UI reflects
                setLogs(prev => prev.filter(l => l.id !== draftId));
            } else {
                const err = await res.json();
                error(err.error || 'Failed to send draft');
            }
        } catch (e) {
            console.error(e);
            error('Error sending draft');
        } finally {
            setDraftSending(null);
        }
    };

    const conversations = useMemo(() => {
        return buildConversations(logs, fetchedProfiles);
    }, [logs, fetchedProfiles]);

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
                        <MessageCircle className="w-5 h-5 text-primary" />
                        Inbox
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                    </h1>
                </div>

                <div className="relative mb-2">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        placeholder="Search chats..."
                        className="input-premium w-full !pl-10 py-2.5 text-sm"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar pb-6 md:pb-0">
                    {conversations.map((conv) => (
                        <button
                            key={conv.chat_id}
                            onClick={() => setSelectedChatId(conv.chat_id)}
                            className={clsx(
                                "w-full text-left p-4 rounded-2xl border transition-all duration-200 group relative overflow-x-clip",
                                selectedChatId === conv.chat_id
                                    ? "glass-dark border-primary/40 bg-primary/5"
                                    : "border-border hover:bg-surface-2"
                            )}
                        >
                            <div className={clsx("absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full transition-transform duration-1000", selectedChatId === conv.chat_id ? "translate-x-full" : "")} />

                            <div className="flex items-center gap-3 relative z-10">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-border shrink-0">
                                    <User className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-sm truncate flex items-center gap-2">
                                            {conv.platform === 'whatsapp'
                                                ? <WhatsAppIcon className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                                : <Instagram className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                                            }
                                            {conv.username}
                                            {conv.isComment && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-tighter">Comment</span>}
                                        </h3>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className={clsx("text-xs truncate mt-0.5 flex items-center gap-1",
                                        conv.messages[conv.messages.length - 1]?.is_bot ? "text-primary/70" : "text-muted-foreground"
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
                "absolute inset-0 md:static flex-1 glass-dark rounded-2xl md:rounded-3xl  md:border flex flex-col overflow-hidden z-30 transition-transform duration-300 bg-surface-1 md:bg-transparent",
                selectedChatId ? "translate-x-0" : "translate-x-full md:translate-x-0"
            )}>
                {activeChat ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-border bg-surface-2/50 flex items-center gap-3 pt-safe-top md:pt-4">
                            <button
                                onClick={() => setSelectedChatId(null)}
                                className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                {activeChat.username[0].toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <h2 className="font-bold text-sm flex items-center gap-2">
                                    {activeChat.platform === 'whatsapp'
                                        ? <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 uppercase font-bold tracking-tight flex items-center gap-1"><WhatsAppIcon className="w-3 h-3" />WhatsApp</span>
                                        : <span className="text-[10px] bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full border border-pink-500/20 uppercase font-bold tracking-tight flex items-center gap-1"><Instagram className="w-3 h-3" />Instagram</span>
                                    }
                                    {activeChat.username}
                                    {activeChat.isComment && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 uppercase font-bold tracking-tight">Public Comment</span>}
                                </h2>
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
                                onClick={() => {
                                    if (planTier === 'starter') {
                                        error('Upgrade to Pro to mute individual chats.');
                                        return;
                                    }
                                    toggleMute(activeChat.chat_id, isMuted);
                                }}
                                className={clsx(
                                    "px-3 py-1.5 text-xs rounded-lg border flex items-center gap-2 transition-all font-bold",
                                    planTier === 'starter' 
                                        ? "bg-surface-2 text-muted-foreground border-border opacity-70 cursor-not-allowed"
                                        : isMuted
                                        ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                                        : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                                )}
                            >
                                {planTier === 'starter' ? (
                                    <><PauseCircle className="w-3 h-3" /> Mute AI (Pro)</>
                                ) : isMuted ? (
                                    <><PlayCircle className="w-3 h-3" /> Resume AI</>
                                ) : (
                                    <><PauseCircle className="w-3 h-3" /> Mute AI</>
                                )}
                            </button>

                            {/* Delete Chat Button */}
                            <button
                                onClick={async () => {
                                    if (!confirm('Delete this entire chat thread? This cannot be undone.')) return;
                                    const chatId = activeChat.chat_id;
                                    // Delete all activity_log rows for this chat_id in the active workspace
                                    const { error: delErr } = await supabase
                                        .from('activity_log')
                                        .delete()
                                        .eq('workspace_id', activeWorkspaceId)
                                        .eq('metadata->>chat_id', chatId);
                                    if (delErr) {
                                        error('Failed to delete chat');
                                        console.error(delErr);
                                    } else {
                                        success('Chat deleted');
                                        setLogs(prev => prev.filter(l => l.metadata?.chat_id !== chatId));
                                        setSelectedChatId(null);
                                    }
                                }}
                                className="px-3 py-1.5 text-xs rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-2 transition-all font-bold"
                            >
                                <Trash2 className="w-3 h-3" /> Delete
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar pb-6 md:pb-6">
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
                                            {(msg.is_bot || msg.type === 'DRAFT_REPLY') && (
                                                <div className={clsx(
                                                    "w-6 h-6 rounded-full flex items-center justify-center mb-1",
                                                    msg.type === 'DRAFT_REPLY' ? "bg-yellow-500/10" : "bg-cyan-500/10"
                                                )}>
                                                    {msg.type === 'DRAFT_REPLY'
                                                        ? <Edit2 className="w-3 h-3 text-yellow-500" />
                                                        : <Ghost className="w-3 h-3 text-cyan-400" />
                                                    }
                                                </div>
                                            )}

                                            <div className={clsx(
                                                "px-4 py-2.5 md:px-5 md:py-3 rounded-2xl text-[15px] md:text-sm leading-relaxed border break-words min-w-[120px]",
                                                msg.type === 'DRAFT_REPLY'
                                                    ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-100 border-dashed rounded-tr-none"
                                                    : msg.is_bot
                                                        ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-50 rounded-tr-none shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                                                        : msg.is_manual
                                                            ? "bg-surface-3 border-border text-foreground rounded-tr-none"
                                                            : "bg-surface-2 border-border text-muted-foreground rounded-tl-none"
                                            )}>
                                                {msg.text}

                                                {msg.type === 'DRAFT_REPLY' && (
                                                    <button
                                                        onClick={() => handleSendDraft(msg.id, msg.text, activeChat.chat_id, activeChat.account_id)}
                                                        disabled={draftSending === msg.id}
                                                        className="mt-3 w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 text-xs py-2 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                                    >
                                                        {draftSending === msg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                                        Send Now
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <span className="text-[10px] text-muted-foreground mt-1 px-1 uppercase tracking-wider flex items-center gap-1">
                                            {msg.is_bot && <Sparkles className="w-2 h-2 text-cyan-500/50" />}
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {msg.is_manual && " • YOU"}
                                            {msg.type === 'DRAFT_REPLY' && " • DRAFT"}
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            <div ref={messagesEndRef}></div>
                        </div>

                        {/* Footer - Send Input */}
                        <div className="p-4 bg-surface-2/50 border-t border-border pb-safe-bottom">
                            <div className="relative group flex gap-3 items-center">
                                {/* Global Autopilot Toggle */}
                                <button
                                    onClick={() => { if (autopilot !== null) setAutopilot(!autopilot); }}
                                    disabled={autopilot === null || autopilotLoading}
                                    className={clsx(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border shrink-0",
                                        autopilot === null || autopilotLoading
                                            ? "bg-surface-2 border-border text-muted-foreground opacity-50 cursor-not-allowed"
                                            : autopilot === true
                                                ? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                                                : "bg-surface-3 border-border text-muted-foreground hover:text-foreground"
                                    )}
                                    title={autopilot === null ? "Syncing..." : autopilot ? "Autopilot ON (Mute)" : "Autopilot OFF (Resume)"}
                                >
                                    {autopilot === null ? <Loader2 className="w-5 h-5 animate-spin" /> : autopilot ? <Bot className="w-6 h-6" /> : <PauseCircle className="w-6 h-6" />}
                                </button>

                                <div className="relative flex-1">
                                    <input
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        placeholder={autopilot === null ? "Syncing autopilot status..." : autopilot ? "Autopilot is active. Type here to intervene..." : "Type a message..."}
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
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 text-center uppercase tracking-widest flex justify-center gap-2">
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
                    <div className="hidden md:flex flex-1 flex-col items-center justify-center opacity-70 select-none relative overflow-x-clip">
                        {/* Ambient Background Glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

                        <motion.div
                            animate={{ y: [0, -15, 0] }}
                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                            className="relative mb-6"
                        >
                            <Ghost className="w-20 h-20 relative z-10 text-primary/40 drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]" />
                            {/* Inner glow on ghost */}
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                        </motion.div>
                        {conversations.length === 0 ? (
                            <div className="text-center z-10">
                                <h2 className="text-xl font-bold mb-2 tracking-tight text-foreground">Inbox Empty</h2>
                                <p className="text-sm font-medium text-muted-foreground mb-6 max-w-sm">
                                    When customers DM or comment on your Instagram, GhostAgent manages those conversations here.
                                </p>
                                {!activeWorkspace?.instagram_account_id && (
                                    <a
                                        href="/dashboard/settings?tab=connections"
                                        className="bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold py-2.5 px-6 rounded-xl transition-all inline-block pointer-events-auto"
                                    >
                                        Connect Instagram to Start
                                    </a>
                                )}
                            </div>
                        ) : (
                            <div className="text-center z-10">
                                <h2 className="text-xl font-bold mb-2 tracking-tight text-foreground">Agent Monitor</h2>
                                <p className="text-sm font-medium text-muted-foreground">Select a conversation to view details</p>
                            </div>
                        )}
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
