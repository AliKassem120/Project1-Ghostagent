'use client';

import { X, Play, Pause, RotateCcw, ChevronRight, Zap, Check, Calendar, ShoppingCart, User, MessageCircle, Instagram, Sparkles, Loader2, Database, ShieldAlert, Cpu, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface DemoVideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    videoSrc?: string;
    posterSrc?: string;
}

interface MessageStep {
    sender: 'user' | 'bot' | 'comment' | 'system';
    text: string;
    timestamp?: string;
    brainLogs?: string[];
}

interface Scenario {
    id: string;
    title: string;
    platform: 'instagram' | 'whatsapp' | 'instagram-comment';
    icon: any;
    colorClass: string;
    steps: MessageStep[];
}

const SCENARIOS: Scenario[] = [
    {
        id: 'ecommerce',
        title: 'E-Commerce Order Checkout (Instagram)',
        platform: 'instagram',
        icon: Instagram,
        colorClass: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
        steps: [
            { 
                sender: 'user', 
                text: "Hey! Do you have the Essential Hoodie in Black M?", 
                timestamp: "10:14 AM",
                brainLogs: [
                    "📥 Incoming message received via Instagram DM Webhook.",
                    "🧠 Parsed message intent: product_inquiry | Product: 'Essential Hoodie', Size: 'M', Color: 'Black'",
                    "🗄️ Querying database inventory for active workspace (Famosa2)...",
                    "✅ Match found: Size (M) / Color (Black). Live stock level: 3 items available."
                ]
            },
            { 
                sender: 'bot', 
                text: "Hey! 👋 Yes, we have 3 left in stock in Black (M) for $65. Would you like me to send you the checkout link?", 
                timestamp: "10:14 AM",
                brainLogs: [
                    "📝 Response Generator: Formulating reply using E-commerce business settings.",
                    "🔥 LLM settings: Temp 0.9, Sentence limit: 2 sentences max.",
                    "🚀 Sent: 'Hey! Yes, we have 3 left in stock...'"
                ]
            },
            { 
                sender: 'user', 
                text: "Yes please, size M!", 
                timestamp: "10:15 AM",
                brainLogs: [
                    "📥 User input: 'Yes please, size M!'",
                    "🧠 Intent classified: purchase_intent",
                    "⚙️ FSM transition: idle ➡️ awaiting_checkout_confirmation"
                ]
            },
            { 
                sender: 'bot', 
                text: "Perfect! 🚀 Click below to complete your checkout:\n🛒 [Checkout: Essential Hoodie Black M - $65]", 
                timestamp: "10:15 AM",
                brainLogs: [
                    "🔗 Generating secure payment checkout session link...",
                    "📦 Created draft order #9821 in database. Price: $65.00.",
                    "🚀 Sent payment card to user: https://getghostagent.com/checkout/9821"
                ]
            },
            { 
                sender: 'system', 
                text: "🔒 Webhook: Order #9821 Completed & Paid. Inventory updated: 3 ➡️ 2. Status: Order Closed.",
                brainLogs: [
                    "⚡ Webhook event 'checkout.session.completed' received from Stripe.",
                    "📉 Inventory update: Decremented stock level for Essential Hoodie (Black M) by 1.",
                    "🎉 Goal achieved: Order finalized. Resetting FSM loop count back to idle."
                ]
            }
        ]
    },
    {
        id: 'appointments',
        title: 'Service & Appointments Booking (WhatsApp)',
        platform: 'whatsapp',
        icon: MessageCircle,
        colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        steps: [
            { 
                sender: 'user', 
                text: "Hello! Can I book a Laser Treatment for tomorrow afternoon?", 
                timestamp: "2:30 PM",
                brainLogs: [
                    "📥 Incoming message received via WhatsApp Business API.",
                    "🧠 Parsed intent: book_appointment | Service: 'Laser Treatment'",
                    "🗄️ Checking services directory: Laser Treatment duration is 45 minutes. Price: $90.00.",
                    "📅 Checking Google Calendar availability & working hours for tomorrow...",
                    "✅ Slots found: 2:00 PM and 4:30 PM are currently available."
                ]
            },
            { 
                sender: 'bot', 
                text: "Hi! We have two slots open tomorrow: 2:00 PM and 4:30 PM. Which one works best?", 
                timestamp: "2:30 PM",
                brainLogs: [
                    "📝 Formulating slot options in English.",
                    "⚙️ FSM transition: idle ➡️ awaiting_date_time",
                    "🚀 Sent: 'Hi! We have two slots open tomorrow...'"
                ]
            },
            { 
                sender: 'user', 
                text: "2:00 PM is great.", 
                timestamp: "2:31 PM",
                brainLogs: [
                    "📥 User input: '2:00 PM is great.'",
                    "🧠 NLP parsed date/time selection: tomorrow at 14:00.",
                    "🔒 Locking slot availability temporarily for 10 minutes.",
                    "⚙️ FSM transition: awaiting_date_time ➡️ awaiting_customer_details"
                ]
            },
            { 
                sender: 'bot', 
                text: "Awesome! Please reply with your full name and phone number to confirm the booking.", 
                timestamp: "2:31 PM",
                brainLogs: [
                    "🛡️ Guardrail check: Capture customer details (name and phone number) before booking.",
                    "🚀 Sent confirmation request: 'Awesome! Please reply with...'"
                ]
            },
            { 
                sender: 'user', 
                text: "Ali Kassem, +961 70 123 456", 
                timestamp: "2:32 PM",
                brainLogs: [
                    "📥 User input: 'Ali Kassem, +961 70 123 456'",
                    "🧠 NLP parsed details: Name='Ali Kassem', Phone='+961 70 123 456'.",
                    "🗄️ Inserting booking record into Calendar..."
                ]
            },
            { 
                sender: 'bot', 
                text: "Done, Ali! Your Laser Treatment is confirmed for tomorrow at 2:00 PM. See you then! 📅", 
                timestamp: "2:32 PM",
                brainLogs: [
                    "✅ Booking saved successfully in Google Calendar (ID: apt_7721).",
                    "🎉 Goal achieved: Booking confirmed. Autopilot reset to idle."
                ]
            }
        ]
    },
    {
        id: 'comments',
        title: 'Comment Auto-Reply & DM Sales (Instagram)',
        platform: 'instagram-comment',
        icon: MessageSquare,
        colorClass: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
        steps: [
            { 
                sender: 'comment', 
                text: "Ali commented on your post: 'Price? Do you ship to Beirut?'", 
                timestamp: "Just now",
                brainLogs: [
                    "🔔 Public comment webhook notification received on Post #8821.",
                    "🧠 Parsed comment intent: price_inquiry & shipping_rules.",
                    "⚙️ Triggering Comment auto-reply pipeline..."
                ]
            },
            { 
                sender: 'bot', 
                text: "Just sent you a DM with the price and shipping rules! 💬", 
                timestamp: "Just now",
                brainLogs: [
                    "💬 Sent public thread reply to @alikassem.",
                    "🚀 Initiating a direct message thread with customer."
                ]
            },
            { 
                sender: 'bot', 
                text: "Hey Ali! Thanks for commenting. The Essential Hoodie is $65. We offer flat-rate shipping to Beirut in 2 days. Would you like to check sizes?", 
                timestamp: "Just now",
                brainLogs: [
                    "📝 Formulating DM reply with pricing & Beirut shipping rules.",
                    "⚙️ FSM transition: idle ➡️ awaiting_order_details",
                    "🚀 Sent DM: 'Hey Ali! Thanks for commenting...'"
                ]
            },
            { 
                sender: 'user', 
                text: "Yes please, size L", 
                timestamp: "Just now",
                brainLogs: [
                    "📥 User DM input: 'Yes please, size L'",
                    "🧠 NLP parsed size: L.",
                    "🗄️ Checking stock level: Size L has 5 items in stock."
                ]
            },
            { 
                sender: 'bot', 
                text: "We have L in stock! Here is your checkout link:\n🛒 [Checkout Link - Size L]", 
                timestamp: "Just now",
                brainLogs: [
                    "📦 Created draft order #9822. Price: $65.00.",
                    "🎉 Goal achieved: Public comment successfully converted into direct checkout DM. Autopilot reset to idle."
                ]
            }
        ]
    }
];

export default function DemoVideoModal({ isOpen, onClose }: DemoVideoModalProps) {
    const [activeTab, setActiveTab] = useState<string>('ecommerce');
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(true);
    const [showTyping, setShowTyping] = useState<boolean>(false);
    const [visibleMessages, setVisibleMessages] = useState<MessageStep[]>([]);
    const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
    
    const logsEndRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<any>(null);

    const activeScenario = SCENARIOS.find(s => s.id === activeTab) || SCENARIOS[0];

    // Reset when tab changes
    useEffect(() => {
        setCurrentStepIndex(0);
        setVisibleMessages([]);
        setVisibleLogs([]);
        setShowTyping(false);
        if (timerRef.current) clearTimeout(timerRef.current);
    }, [activeTab, isOpen]);

    // Handle steps sequencing
    useEffect(() => {
        if (!isOpen) return;

        const executeStep = () => {
            const step = activeScenario.steps[currentStepIndex];
            if (!step) {
                // Scenario finished
                setIsPlaying(false);
                return;
            }

            // If bot, show typing first
            if (step.sender === 'bot') {
                setShowTyping(true);
                timerRef.current = setTimeout(() => {
                    setShowTyping(false);
                    setVisibleMessages(prev => [...prev, step]);
                    if (step.brainLogs) {
                        setVisibleLogs(prev => [...prev, ...step.brainLogs!]);
                    }
                    // Move to next step after some delay
                    timerRef.current = setTimeout(() => {
                        setCurrentStepIndex(prev => prev + 1);
                    }, 4000);
                }, 1800);
            } else {
                // User/System messages appear immediately
                setVisibleMessages(prev => [...prev, step]);
                if (step.brainLogs) {
                    setVisibleLogs(prev => [...prev, ...step.brainLogs!]);
                }
                timerRef.current = setTimeout(() => {
                    setCurrentStepIndex(prev => prev + 1);
                }, 3500);
            }
        };

        if (isPlaying) {
            executeStep();
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [currentStepIndex, isPlaying, activeTab, isOpen]);

    // Auto-scroll logs and chat
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [visibleLogs]);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [visibleMessages, showTyping]);

    const handleRestart = () => {
        setCurrentStepIndex(0);
        setVisibleMessages([]);
        setVisibleLogs([]);
        setShowTyping(false);
        setIsPlaying(true);
    };

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        setIsPlaying(true);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100]"
                    />

                    {/* Modal Wrapper */}
                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 15 }}
                            transition={{ duration: 0.3 }}
                            className="relative w-full max-w-5xl bg-surface-1 rounded-3xl p-4 md:p-6 border border-border shadow-2xl flex flex-col gap-6"
                        >
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute -top-12 right-0 md:-top-3 md:-right-3 p-2.5 rounded-full bg-surface-2 hover:bg-surface-3 text-foreground transition-colors z-50 border border-border shadow"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Header Info */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-primary" />
                                        <h3 className="text-lg font-bold text-foreground">Interactive Agent Demo</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Watch real-time conversation flows and trace how the AI brain connects with database logics.</p>
                                </div>

                                {/* Scenarios Tabs */}
                                <div className="flex flex-wrap gap-2">
                                    {SCENARIOS.map(s => {
                                        const Icon = s.icon;
                                        const isActive = activeTab === s.id;
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => handleTabChange(s.id)}
                                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                    isActive 
                                                        ? 'bg-primary text-primary-foreground border-primary/20 shadow-sm' 
                                                        : 'bg-surface-2 border-border text-muted-foreground hover:bg-surface-3'
                                                }`}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {s.id === 'ecommerce' ? 'E-Commerce' : s.id === 'appointments' ? 'Appointments' : 'Comment Auto-Reply'}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Simulator Sandbox */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[460px]">
                                {/* Column 1: Simulated Phone (5 cols) */}
                                <div className="md:col-span-5 flex items-center justify-center bg-surface-2/40 border border-border/60 rounded-2xl p-4">
                                    {/* Phone Frame */}
                                    <div className="w-full max-w-[270px] bg-background border-[6px] border-surface-3 rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col aspect-[9/18.5] h-[450px]">
                                        {/* Phone Speaker Notch */}
                                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-surface-3 rounded-full z-20 flex items-center justify-center">
                                            <div className="w-8 h-1 bg-zinc-700 rounded-full" />
                                        </div>

                                        {/* Mock App Header */}
                                        {activeScenario.platform === 'whatsapp' ? (
                                            <div className="flex items-center gap-2 px-3 pt-8 pb-2 border-b border-[#202c33] bg-[#0b141a] z-10 relative">
                                                <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-bold text-white leading-tight flex items-center gap-1">
                                                        GhostAgent
                                                        <span className="w-2.5 h-2.5 bg-emerald-500 text-black flex items-center justify-center text-[6px] font-black rounded-full">✓</span>
                                                    </p>
                                                    <p className="text-[8px] text-[#8696a0] leading-none">business account</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 pt-8 pb-2 border-b border-border bg-surface-1 z-10 relative">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 flex items-center justify-center">
                                                    <Instagram className="w-3.5 h-3.5 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-bold text-foreground leading-tight">ghostagent_store</p>
                                                    <p className="text-[8px] text-muted-foreground leading-none">Active now</p>
                                                </div>
                                                <span className="text-[7px] font-black bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wider">AI</span>
                                            </div>
                                        )}

                                        {/* Chat Screen area */}
                                        <div className={`flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 ${activeScenario.platform === 'whatsapp' ? 'bg-[#0b141a] text-white' : 'bg-background'}`}>
                                            {/* Messages */}
                                            {visibleMessages.map((msg, i) => {
                                                if (msg.sender === 'comment') {
                                                    return (
                                                        <div key={i} className="flex flex-col gap-1 p-2 bg-surface-1 rounded-xl border border-border text-[9px] text-muted-foreground max-w-[90%] mr-auto italic">
                                                            <div className="flex items-center gap-1 font-bold text-foreground not-italic text-[10px]">
                                                                <Instagram className="w-3 h-3 text-pink-400" /> post_comments
                                                            </div>
                                                            {msg.text}
                                                        </div>
                                                    );
                                                }
                                                if (msg.sender === 'system') {
                                                    return (
                                                        <div key={i} className="my-1.5 mx-auto bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg text-[9px] font-semibold max-w-[90%] text-center">
                                                            {msg.text}
                                                        </div>
                                                    );
                                                }
                                                
                                                const isUser = msg.sender === 'user';
                                                
                                                let bubbleClass = '';
                                                if (activeScenario.platform === 'whatsapp') {
                                                    bubbleClass = isUser 
                                                        ? 'bg-[#005c4b] text-[#e9edef] ml-auto rounded-tl-xl rounded-tr-xl rounded-bl-xl' 
                                                        : 'bg-[#202c33] text-[#e9edef] mr-auto rounded-tl-xl rounded-tr-xl rounded-br-xl';
                                                } else {
                                                    bubbleClass = isUser 
                                                        ? 'bg-primary text-primary-foreground ml-auto rounded-tl-xl rounded-tr-xl rounded-bl-xl' 
                                                        : 'bg-surface-2 text-foreground mr-auto rounded-tl-xl rounded-tr-xl rounded-br-xl';
                                                }

                                                return (
                                                    <div 
                                                        key={i} 
                                                        className={`p-2.5 max-w-[85%] text-[10px] leading-relaxed shadow-sm font-medium ${bubbleClass}`}
                                                    >
                                                        {msg.text}
                                                    </div>
                                                );
                                            })}

                                            {showTyping && (
                                                <div className={`p-2.5 max-w-[50px] rounded-tl-xl rounded-tr-xl rounded-br-xl mr-auto shadow-sm ${activeScenario.platform === 'whatsapp' ? 'bg-[#202c33]' : 'bg-surface-2'}`}>
                                                    <div className="chat-typing flex gap-1 items-center justify-center py-1">
                                                        <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            )}

                                            <div ref={chatEndRef} />
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2: AI Brain Engine Console (7 cols) */}
                                <div className="md:col-span-7 flex flex-col bg-surface-2 border border-border/80 rounded-2xl overflow-hidden shadow-inner">
                                    {/* Console Header */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-surface-3 border-b border-border">
                                        <div className="flex items-center gap-2">
                                            <Cpu className="w-4 h-4 text-primary animate-pulse" />
                                            <span className="text-xs font-bold font-mono tracking-tight text-foreground">AI_AGENT_ENGINE logs</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                            <span className="text-[10px] font-bold font-mono text-emerald-400">RUNNING</span>
                                        </div>
                                    </div>

                                    {/* Console Output */}
                                    <div className="flex-1 p-4 font-mono text-[10px] leading-relaxed overflow-y-auto bg-black text-zinc-400 flex flex-col gap-2 min-h-[300px] max-h-[360px]">
                                        {visibleLogs.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center gap-2 h-full text-zinc-600">
                                                <Database className="w-6 h-6 animate-pulse" />
                                                <p className="text-[9px]">Awaiting incoming customer trigger...</p>
                                            </div>
                                        ) : (
                                            visibleLogs.map((log, index) => {
                                                const isSuccess = log.includes('✅') || log.includes('🎉') || log.includes('🔒') || log.includes('SUCCESS');
                                                const isWarning = log.includes('⚠️') || log.includes('⚙️') || log.includes('🧠');
                                                
                                                let textClass = 'text-zinc-400';
                                                if (isSuccess) textClass = 'text-emerald-400 font-semibold';
                                                else if (isWarning) textClass = 'text-purple-400';
                                                else if (log.includes('🚀')) textClass = 'text-sky-400';

                                                return (
                                                    <div key={index} className={`border-l-2 border-zinc-800 pl-2.5 ${textClass}`}>
                                                        {log}
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div ref={logsEndRef} />
                                    </div>
                                </div>
                            </div>

                            {/* Autoplay / Timeline Controller */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setIsPlaying(!isPlaying)}
                                        className="w-10 h-10 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground flex items-center justify-center transition-all shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                                    >
                                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                    </button>
                                    <button
                                        onClick={handleRestart}
                                        className="w-10 h-10 rounded-full bg-surface-2 hover:bg-surface-3 border border-border text-foreground flex items-center justify-center transition-colors"
                                        title="Restart Scenario"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Scenarios Progression Indicators */}
                                <div className="flex-1 max-w-sm flex items-center gap-1 px-4">
                                    {activeScenario.steps.map((_, idx) => {
                                        const isDone = idx < currentStepIndex;
                                        const isActive = idx === currentStepIndex;
                                        return (
                                            <div 
                                                key={idx} 
                                                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                                    isDone ? 'bg-primary' : isActive ? 'bg-primary/50 animate-pulse' : 'bg-surface-3 border border-border/40'
                                                }`}
                                            />
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => {
                                        const nextIdx = (SCENARIOS.findIndex(s => s.id === activeTab) + 1) % SCENARIOS.length;
                                        handleTabChange(SCENARIOS[nextIdx].id);
                                    }}
                                    className="px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-border rounded-xl text-xs font-bold text-foreground transition-colors flex items-center gap-1"
                                >
                                    Next Scenario
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
