"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Ghost, Sparkles, AlertCircle } from "lucide-react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboard } from '@/contexts/DashboardContext';

interface GhostChatProps {
    /** Called when the AI completes an action (inventory update, etc.) */
    onActionComplete?: () => void;
}

export default function GhostChat({ onActionComplete }: GhostChatProps) {
    const { refreshDashboard } = useDashboard();
    const { messages, sendMessage, status, error } = useChat({
        onError: (err) => {
            console.error("GhostChat Client Error:", err);
        },
        onFinish: (msg) => {
            console.log("GhostChat Client Finished:", msg);

            // Check if the message contains tool results (inventory actions, etc.)
            // This triggers a refresh of dashboard stats
            const content = (msg as any).content || '';
            const toolCalls = (msg as any).toolInvocations || [];

            const hasToolAction =
                content.includes('added to inventory') ||
                content.includes('updated stock') ||
                content.includes('Restocked') || // Added keyword
                content.includes('order') ||
                content.includes('product') ||
                content.includes('items') ||
                toolCalls.some((t: any) =>
                    t.toolName === 'add_inventory' ||
                    t.toolName === 'update_stock' ||
                    t.toolName === 'manageInventory' || // Added real tool name
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

    const isLoading = status === 'streaming' || status === 'submitted';

    useEffect(() => {
        console.log("GhostChat Status changed:", status);
    }, [status]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submit triggered. Input:", input, "IsLoading:", isLoading);

        if (!input.trim() || isLoading) {
            console.log("Submit aborted. Empty input or loading.");
            return;
        }

        const userMessage = input;
        setInput("");
        console.log("Calling sendMessage with:", userMessage);

        try {
            await sendMessage({ text: userMessage });
            console.log("sendMessage promise resolved");
        } catch (err) {
            console.error("Error in handleSubmit:", err);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-black/90 border border-cyan-500/30 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.15)] overflow-hidden backdrop-blur-md relative">

            {/* Success Animation Overlay */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    >
                        <div className="flex flex-col items-center p-6 bg-cyan-950/90 border border-cyan-500/50 rounded-2xl shadow-xl">
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4"
                            >
                                <Sparkles className="w-8 h-8 text-cyan-400" />
                            </motion.div>
                            <h3 className="text-xl font-bold text-cyan-100">Operation Successful</h3>
                            <p className="text-cyan-400/80 text-sm mt-1">Inventory Synced</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-cyan-500/20 bg-cyan-950/10 shrink-0">
                <div className="relative">
                    <div className="absolute inset-0 bg-cyan-400 blur-md opacity-20 animate-pulse" />
                    <Ghost className="w-6 h-6 text-cyan-400 relative z-10" />
                </div>
                <h2 className="text-cyan-100 font-medium tracking-wide">GHOST AGENT PRO</h2>
                <div className="ml-auto flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isLoading ? "bg-cyan-300 animate-ping" : "bg-cyan-500 animate-pulse"}`} />
                    <span className="text-xs text-cyan-400/70">ONLINE</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent mb-20 pb-10">
                <AnimatePresence>
                    {messages.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-full text-cyan-500/30 space-y-4 mt-20"
                        >
                            <Sparkles className="w-12 h-12" />
                            <p className="text-sm font-light">Awaiting neural input...</p>
                        </motion.div>
                    )}
                    {messages.map((msg: UIMessage) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[85%] p-3 rounded-lg text-sm leading-relaxed ${msg.role === "user"
                                    ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-100 rounded-br-none"
                                    : "bg-slate-900 border border-slate-700 text-gray-300 rounded-bl-none prose prose-invert prose-sm max-w-none"
                                    }`}
                            >
                                {/* Use content as primary, parts as fallback */}
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
                                    <span className="text-cyan-400/50 italic">Thinking...</span>
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
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg rounded-bl-none flex gap-1">
                                <span className="w-2 h-2 bg-cyan-500/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-2 h-2 bg-cyan-500/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-2 h-2 bg-cyan-500/50 rounded-full animate-bounce" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 my-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs"
                    >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Transmission error: {error.message || "Failed to contact ghost agent."}</span>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-xl bg-black/80 border border-cyan-500/20 rounded-xl backdrop-blur-md p-2 shadow-2xl shadow-cyan-900/20">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                    <input
                        type="text"
                        name="message"
                        id="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Transmit message..."
                        className="w-full bg-slate-900/50 text-cyan-100 placeholder-cyan-700/50 border border-cyan-500/20 rounded-lg py-3 px-4 pr-12 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_10px_rgba(6,182,212,0.1)] transition-all"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 p-2 text-cyan-500 hover:text-cyan-300 transition-colors disabled:opacity-50"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
