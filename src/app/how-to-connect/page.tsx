'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Image as ImageIcon, ArrowRight, Instagram, Facebook, Link as LinkIcon, Bot } from 'lucide-react';
import GhostLogo from '@/components/GhostLogo';
import Navbar from '@/components/Navbar';

export default function HowToConnectPage() {
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const steps = [
        {
            title: "Switch to Professional Account",
            description: "To use the Instagram API, your account must be a Professional (Business or Creator) account. You can change this in your Instagram settings under 'Account type and tools'.",
            icon: Instagram,
            color: "from-pink-500 to-orange-400"
        },
        {
            title: "Create a Facebook Page",
            description: "Even if you only use Instagram, Meta requires a Facebook Business Page to route automated messages through their security infrastructure. Create one if you haven't already.",
            icon: Facebook,
            color: "from-blue-600 to-blue-400"
        },
        {
            title: "Link Them Together",
            description: "Go to your new Facebook Page settings, find 'Linked Accounts', and connect your Professional Instagram account. Make sure to allow all permissions.",
            icon: LinkIcon,
            color: "from-purple-600 to-indigo-500"
        },
        {
            title: "Connect to Ghost Agent",
            description: "Return to Ghost Agent and click 'Connect Instagram'. Log in with the Facebook account that manages your connected page and approve all requested access.",
            icon: Bot,
            color: "from-violet-600 to-purple-500"
        }
    ];

    const faqs = [
        {
            question: "Why do I need a Facebook Page for an Instagram bot?",
            answer: "Meta's security infrastructure requires all automated Instagram inbox access to be routed through a connected Facebook Business Page. Think of the Facebook Page as the 'control center' that grants us secure access to your Instagram DMs."
        }
    ];

    return (
        <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] selection:bg-primary/30 font-sans flex flex-col pt-24 pb-12 overflow-hidden relative">

            {/* Ambient Background Glow */}
            <div className="absolute top-0 inset-x-0 h-[500px] w-full bg-gradient-to-b from-primary/10 to-transparent pointer-events-none opacity-50 blur-3xl z-0" />
            <div className="absolute top-[20%] -left-[10%] w-[40%] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
            <div className="absolute top-[40%] -right-[10%] w-[30%] h-[300px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none z-0" />

            <Navbar />

            <main className="flex-1 w-full max-w-5xl mx-auto px-5 relative z-10 flex flex-col gap-16">

                {/* Header Section */}
                <section className="text-center space-y-4 max-w-2xl mx-auto pt-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center justify-center p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] mb-4 overflow-hidden relative group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-violet-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <GhostLogo className="w-10 h-10 sm:w-12 sm:h-12 relative z-10 drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]" />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6"
                    >
                        Connection <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-600 drop-shadow-sm">Guide</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-lg text-white/60 leading-relaxed font-medium"
                    >
                        Master the setup process. Learn exactly how to configure your Instagram and Facebook accounts to grant access to your AI agent.
                    </motion.p>
                </section>

                {/* Vertical Timeline / Steps Section */}
                <section className="relative">
                    {/* Connecting Line (Desktop Only) */}
                    <div className="absolute left-[27px] top-6 bottom-6 w-px bg-gradient-to-b from-primary/5 via-primary/20 to-primary/5 hidden md:block" />

                    <div className="space-y-12 md:space-y-20 relative">
                        {steps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="relative flex flex-col md:flex-row gap-6 md:gap-12"
                            >
                                {/* Timeline Node (Desktop) */}
                                <div className="hidden md:flex flex-col items-center z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-[#0B0C10] border-2 border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.15)] overflow-hidden relative group">
                                        <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${step.color}`} />
                                        <span className="text-primary font-bold text-xl relative z-10">{index + 1}</span>
                                    </div>
                                </div>

                                {/* Content Card */}
                                <div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-[24px] p-6 sm:p-8 hover:bg-white/[0.03] hover:border-white/[0.1] transition-all duration-300 group shadow-lg shadow-black/20">
                                    <div className="flex flex-col xl:flex-row gap-8 items-start">

                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center gap-3 mb-2">
                                                {/* Mobile Node */}
                                                <div className="md:hidden flex-shrink-0 w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                                                    <span className="text-primary font-bold text-sm">{index + 1}</span>
                                                </div>
                                                <div className={`p-2 rounded-xl bg-gradient-to-br ${step.color} bg-opacity-10 shadow-inner`}>
                                                    <step.icon className="w-5 h-5 text-white drop-shadow-md" />
                                                </div>
                                                <h3 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">{step.title}</h3>
                                            </div>
                                            <p className="text-white/60 leading-relaxed text-base sm:text-lg">
                                                {step.description}
                                            </p>
                                        </div>

                                        {/* Placeholder Image Box */}
                                        <div className="w-full xl:w-[400px] aspect-[16/9] sm:aspect-video rounded-xl bg-[#1A1C23] border border-white/[0.08] flex flex-col items-center justify-center text-white/20 group-hover:border-primary/20 group-hover:text-primary/40 transition-colors overflow-hidden relative">
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px] opacity-50" />
                                            <ImageIcon className="w-12 h-12 mb-3 relative z-10" strokeWidth={1.5} />
                                            <span className="text-sm font-medium tracking-wide relative z-10">Screenshot Placeholder</span>
                                        </div>

                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* FAQ / Troubleshooting Section */}
                <section className="mt-8 mb-20 max-w-3xl mx-auto w-full">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-bold text-white mb-3">Frequently Asked Questions</h2>
                        <p className="text-white/50">Common confusion points cleared up.</p>
                    </div>

                    <div className="space-y-4">
                        {faqs.map((faq, index) => (
                            <div
                                key={index}
                                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${openFaq === index
                                        ? 'bg-white/[0.04] border-primary/30 shadow-[0_0_30px_rgba(139,92,246,0.1)]'
                                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.03] hover:border-white/[0.1]'
                                    }`}
                            >
                                <button
                                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                    className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 focus:outline-none"
                                >
                                    <span className="font-semibold text-white/90 text-lg">{faq.question}</span>
                                    <ChevronDown
                                        className={`w-5 h-5 text-white/50 transition-transform duration-300 flex-shrink-0 ${openFaq === index ? 'rotate-180 text-primary' : ''
                                            }`}
                                    />
                                </button>
                                <AnimatePresence>
                                    {openFaq === index && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                        >
                                            <div className="px-6 pb-6 pt-2 text-white/60 leading-relaxed border-t border-white/[0.04]">
                                                {faq.answer}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA / Quick Actions */}
                <section className="text-center pb-20">
                    <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-white font-semibold text-lg hover:bg-primary/90 transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(139,92,246,0.4)] active:scale-95">
                        Back to Dashboard
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </section>

            </main>
        </div>
    );
}
