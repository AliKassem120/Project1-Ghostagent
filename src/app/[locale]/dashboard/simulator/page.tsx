'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, Bot, Phone } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

type Message = {
    id: string;
    role: 'user' | 'agent';
    text?: string;
    isInteractive?: boolean;
    interactiveData?: any;
};

export default function SimulatorPage() {
    const { activeWorkspaceId } = useWorkspace();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !activeWorkspaceId) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/simulator/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: activeWorkspaceId,
                    message: userMsg.text,
                    chatId: 'simulator_' + activeWorkspaceId // Fixed session ID for simulator
                })
            });

            const data = await res.json();
            
            if (data.responses) {
                const agentMsgs: Message[] = data.responses.map((r: any, i: number) => {
                    if (r.type === 'text') {
                        return { id: Date.now().toString() + i, role: 'agent', text: r.text.body };
                    }
                    if (r.type === 'interactive') {
                        return { id: Date.now().toString() + i, role: 'agent', isInteractive: true, interactiveData: r.interactive };
                    }
                    if (r.type === 'template') {
                         return { id: Date.now().toString() + i, role: 'agent', text: `[Template Message Sent: ${r.template.name}]` };
                    }
                    return { id: Date.now().toString() + i, role: 'agent', text: `[Unsupported Message Type: ${r.type}]` };
                });
                setMessages(prev => [...prev, ...agentMsgs]);
            }
        } catch (error) {
            console.error('Simulator error:', error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', text: 'Error connecting to GhostAgent AI.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Phone className="w-6 h-6 text-emerald-500" />
                        WhatsApp Simulator
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Test your GhostAgent just like a real customer on WhatsApp.
                    </p>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 bg-[#efeae2] dark:bg-[#0b141a] border border-border shadow-xl rounded-3xl overflow-hidden flex flex-col relative max-w-2xl mx-auto w-full"
                style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain', backgroundBlendMode: 'overlay', backgroundColor: 'var(--surface-1)' }}
            >
                {/* Header */}
                <div className="bg-[#00a884] dark:bg-[#202c33] px-4 py-3 flex items-center gap-3 shadow-md z-10">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white text-base leading-tight">GhostAgent AI</h3>
                        <p className="text-white/80 text-xs">online</p>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="bg-[#ffeecd] dark:bg-[#182229] text-[#544c45] dark:text-[#8696a0] text-xs text-center p-2 rounded-lg mx-auto max-w-xs shadow-sm">
                            Messages are end-to-end simulated. Say "hi" to start testing your AI.
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm relative ${
                                msg.role === 'user' 
                                    ? 'bg-[#d9fdd3] dark:bg-[#005c4b] rounded-tr-sm' 
                                    : 'bg-white dark:bg-[#202c33] rounded-tl-sm'
                            }`}>
                                {msg.text && (
                                    <p className={`text-[15px] whitespace-pre-wrap leading-relaxed ${
                                        msg.role === 'user' ? 'text-[#111b21] dark:text-[#e9edef]' : 'text-[#111b21] dark:text-[#e9edef]'
                                    }`}>
                                        {msg.text}
                                    </p>
                                )}
                                
                                {/* Render Native WhatsApp Interactive Elements in Simulator */}
                                {msg.isInteractive && msg.interactiveData && (
                                    <div className="mt-2 flex flex-col gap-2">
                                        {msg.interactiveData.header && (
                                            <p className="font-bold text-[#111b21] dark:text-[#e9edef]">
                                                {msg.interactiveData.header.text}
                                            </p>
                                        )}
                                        {msg.interactiveData.body && (
                                            <p className="text-[15px] text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap">
                                                {msg.interactiveData.body.text}
                                            </p>
                                        )}
                                        {msg.interactiveData.action?.buttons && (
                                            <div className="flex flex-col gap-1 mt-2">
                                                {msg.interactiveData.action.buttons.map((b: any, i: number) => (
                                                    <div key={i} className="bg-white dark:bg-[#2a3942] border border-border/50 text-[#00a884] dark:text-[#00a884] font-semibold py-2 px-4 rounded-xl text-center shadow-sm">
                                                        {b.reply.title}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className={`text-[10px] mt-1 text-right ${msg.role === 'user' ? 'text-[#667781] dark:text-[#8696a0]' : 'text-[#667781] dark:text-[#8696a0]'}`}>
                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-[#202c33] rounded-2xl rounded-tl-sm p-3 shadow-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-[#8696a0]" />
                                <span className="text-[13px] text-[#8696a0]">typing...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-3 flex gap-2 items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                        placeholder="Type a message"
                        className="flex-1 bg-white dark:bg-[#2a3942] border-none rounded-full px-5 py-3 focus:outline-none focus:ring-1 focus:ring-[#00a884] text-[15px] text-[#111b21] dark:text-[#e9edef]"
                        disabled={loading}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="w-12 h-12 bg-[#00a884] hover:bg-[#008f6f] rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50 shrink-0 press"
                    >
                        <Send className="w-5 h-5 ml-1" />
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
