'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import GhostLogo from '@/components/GhostLogo';
import StarBackground from '@/components/StarBackground';
import { Zap, Globe, ShieldCheck, Users, MessageCircle, TrendingUp } from 'lucide-react';

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
};

export default function AboutUs() {
    return (
        <main className="min-h-screen text-white overflow-hidden relative selection:bg-primary/30">
            {/* Background */}
            <div className="fixed inset-0 bg-background">
                <div
                    className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"
                    style={{ maskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)' }}
                />
            </div>
            <StarBackground />

            <Navbar />

            {/* Hero */}
            <section className="relative z-10 pt-32 pb-20 px-4 md:px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div {...fadeUp} transition={{ duration: 0.8 }}>
                        <div className="flex justify-center mb-8">
                            <motion.div
                                className="p-5 rounded-3xl bg-primary/10 border border-primary/20"
                                animate={{ boxShadow: ['0 0 20px rgba(139,92,246,0.1)', '0 0 40px rgba(139,92,246,0.25)', '0 0 20px rgba(139,92,246,0.1)'] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            >
                                <GhostLogo className="w-16 h-16" />
                            </motion.div>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight mb-6">
                            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                                Automating Commerce for the{' '}
                            </span>
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
                                Modern Business
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-white/45 max-w-2xl mx-auto leading-relaxed">
                            GhostAgent is the AI-powered sidekick that handles your Instagram DMs, so you can focus on building your empire.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Mission */}
            <section className="relative z-10 py-20 px-4 md:px-6">
                <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="space-y-6"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-white">Our Mission</h2>
                        <div className="space-y-5 text-white/45 leading-relaxed">
                            <p>
                                We built GhostAgent because we saw small business owners drowning in DMs.
                                Trying to reply to every customer while managing inventory and shipping orders is impossible to do alone.
                            </p>
                            <p>
                                Traditional chatbots are clunky and robotic. We wanted to build something different — an AI that feels human, understands your brand voice, and actually helps you sell.
                            </p>
                            <p>
                                Today, GhostAgent processes thousands of conversations daily, helping merchants reclaim their time and capture sales they would have otherwise missed.
                            </p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="relative h-80 rounded-3xl glass-frosted overflow-hidden flex items-center justify-center"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-blue-500/10" />
                        <div className="text-[120px] font-black text-white/[0.03] select-none leading-none">
                            GHOST
                        </div>
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent"
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 4, repeat: Infinity }}
                        />
                    </motion.div>
                </div>
            </section>

            {/* Stats */}
            <section className="relative z-10 py-20 px-4 md:px-6">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    {[
                        { value: '2,000+', label: 'Stores Automated' },
                        { value: '5M+', label: 'Messages Handled' },
                        { value: '99.9%', label: 'Uptime SLA' },
                        { value: '< 2s', label: 'Avg Response Time' },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className="glass-frosted rounded-2xl p-5 md:p-6 text-center"
                        >
                            <div className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</div>
                            <div className="text-xs md:text-sm text-white/35">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Values */}
            <section className="relative z-10 py-20 px-4 md:px-6 border-t border-white/5">
                <div className="max-w-5xl mx-auto">
                    <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 mb-4">
                            What We Stand For
                        </h2>
                        <p className="text-white/40 max-w-md mx-auto">
                            Our core values drive every feature we build.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-5">
                        {[
                            { icon: Zap, title: 'Automation First', desc: 'We believe every repetitive task should be handled by AI, freeing humans for creative work.' },
                            { icon: Globe, title: 'Multilingual Native', desc: 'Built from day one to speak your customers\' language — Arabic, English, French, and beyond.' },
                            { icon: ShieldCheck, title: 'Privacy-First', desc: 'Your data is yours. We never train on your conversations and comply with Meta\'s strictest policies.' },
                            { icon: Users, title: 'Community Driven', desc: 'Shaped by feedback from 2,000+ merchants who use Ghost Agent daily.' },
                            { icon: MessageCircle, title: 'Human-Like AI', desc: 'Our AI doesn\'t just reply — it understands tone, context, and closes sales naturally.' },
                            { icon: TrendingUp, title: 'Growth Obsessed', desc: 'Every feature is designed to increase your revenue and reduce your response time.' },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1, duration: 0.6 }}
                                className="bento-card group"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <item.icon className="w-6 h-6 text-purple-400" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                                <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
