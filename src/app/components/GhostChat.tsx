"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Ghost, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboard } from '@/contexts/DashboardContext';
import { createClient } from '@/utils/supabase/client';

interface GhostChatProps {
    onActionComplete?: () => void;
}

export default function GhostChat({ onActionComplete }: GhostChatProps) {
    const { refreshDashboard } = useDashboard();
    const supabase = createClient();
    const [userName, setUserName] = useState<string>("Boss");

    // Fetch user name for personalization
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.full_name) {
                setUserName(user.user_metadata.full_name.split(' ')[0]);
            } else if (user?.email) {
                setUserName(user.email.split('@')[0]);
            }
        };
        fetchUser();
    }, []);

    const { messages, setMessages, sendMessage, status, error } = useChat({
        onError: (err) => {
            console.error("GhostChat Client Error:", err);
        },
        onFinish: (msg) => {
            console.log("GhostChat Client Finished:", msg);

            const content = (msg as any).content || '';
            const toolCalls = (msg as any).toolInvocations || [];

            const hasToolAction =
                content.includes('added to inventory') ||
                content.includes('updated stock') ||
                content.includes('Restocked') ||
                content.includes('order') ||
                content.includes('product') ||
                content.includes('items') ||
                toolCalls.some((t: any) =>
                    t.toolName === 'add_inventory' ||
                    t.toolName === 'update_stock' ||
                    t.toolName === 'manageInventory' ||
                    t.toolName === 'create_order'
                );

            if (hasToolAction) {
                console.log('[GhostChat] Tool action detected, triggering refresh');
                refreshDashboard();
                if (onActionComplete) onActionComplete();
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 3000);
            }
        }
    });

    const [input, setInput] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasInitialized = useRef(false);

    const isLoading = status === 'streaming' || status === 'submitted';

    // Set initial greeting
    useEffect(() => {
        if (!hasInitialized.current && userName !== "Boss" && messages.length === 0) {
            setMessages([
                {
                    id: 'greeting',
                    role: 'assistant',
                    content: `Status: Online. Hello ${userName}, I am ready to handle DMs.`
                } as any
            ]);
            hasInitialized.current = true;
        } else if (!hasInitialized.current && messages.length === 0) {
            if (userName) {
                setMessages([
                    {
                        id: 'greeting',
                        role: 'assistant',
                        content: `Status: Online. Hello ${userName}, I am ready to handle DMs.`
                    } as any
                ]);
                hasInitialized.current = true;
            }
        }
    }, [userName, setMessages, messages.length]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input;
        setInput("");

        try {
            await sendMessage({ text: userMessage });
        } catch (err) {
            console.error("Error in handleSubmit:", err);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-surface-1 rounded-xl overflow-x-clip relative border border-border">

            {/* Success Overlay */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    >
                        <div
                            className="flex flex-col items-center p-6 bg-surface-1 rounded-2xl border border-border"
                            style={{ boxShadow: 'var(--shadow-xl)' }}
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4"
                            >
                                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                            </motion.div>
                            <h3 className="text-lg font-semibold text-white">Action Complete</h3>
                            <p className="text-muted-foreground text-sm mt-1">Data synced successfully</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                <AnimatePresence>
                    {messages.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-full text-foreground/15 space-y-3 mt-16"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center text-muted-foreground">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <p className="text-sm">Waiting for new messages...</p>
                        </motion.div>
                    )}
                    {messages.map((msg: UIMessage) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user"
                                    ? "bg-primary text-white rounded-2xl rounded-br-md shadow-sm"
                                    : "bg-surface-2 text-foreground/90 rounded-2xl rounded-bl-md prose prose-invert prose-sm max-w-none"
                                    }`}
                            >
                                {(msg as any).content ? (
                                    <ReactMarkdown>{(msg as any).content}</ReactMarkdown>
                                ) : msg.parts && msg.parts.length > 0 ? (
                                    msg.parts.map((part: any, idx: number) => (
                                        <div key={idx}>
                                            {part.type === 'text' && (
                                                <ReactMarkdown>{part.text}</ReactMarkdown>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <span className="text-white/30 italic">Processing...</span>
                                )}
                            </div>
                        </motion.div>
                    ))}
                    {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex justify-start"
                        >
                            <div className="bg-surface-2 p-3 rounded-2xl rounded-bl-md flex gap-1.5">
                                <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 my-2 bg-red-500/5 rounded-xl text-red-400/80 text-xs border border-red-500/10"
                    >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Connection error: {error.message || "Failed to reach agent."}</span>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border shrink-0">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                    <input
                        type="text"
                        name="message"
                        id="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        className="input-premium w-full pr-12"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 h-8 w-8 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 press"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
