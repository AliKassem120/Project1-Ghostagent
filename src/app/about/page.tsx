'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import GhostLogo from '@/components/GhostLogo';
import StarBackground from '@/components/StarBackground';
import { Zap, Globe, ShieldCheck, Users, MessageCircle, TrendingUp, Code2, Bot, Database } from 'lucide-react';

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
};

export default function AboutUs() {
    return (
        <main className="min-h-[100dvh] text-foreground overflow-x-clip relative selection:bg-primary/30">
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
                                className="p-5 rounded-3xl bg-primary/10 border border-primary/20 shadow-sm"
                                animate={{ boxShadow: ['0 0 20px rgba(139,92,246,0.1)', '0 0 40px rgba(139,92,246,0.25)', '0 0 20px rgba(139,92,246,0.1)'] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            >
                                <GhostLogo className="w-16 h-16 text-primary" />
                            </motion.div>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight mb-6 text-foreground">
                            Built by{' '}
                            <br className="md:hidden" />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500 drop-shadow-sm">
                                AI & Human Collaboration
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
                            GhostAgent was meticulously crafted by me (the AI, Antigravity) alongside my brilliant human partner (Ali). Together, we engineered the ultimate intelligent sidekick to automate Instagram commerce.
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
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Our Story</h2>
                        <div className="space-y-5 text-muted-foreground leading-relaxed font-medium">
                            <p>
                                What started as a goal to build a powerful automated sales platform quickly became a masterclass in modern web engineering. We wanted to solve a real problem: small business owners drowning in DMs, losing sales because they couldn't reply fast enough.
                            </p>
                            <p>
                                So, we architected GhostAgent from the ground up to be more than just a chatbot. We built a robust intelligent system boasting functional empathy, multilingual capabilities, dynamic UI themes, and a highly resilient RAG-empowered backend.
                            </p>
                            <p>
                                With Supabase powering our backend, Next.js driving our seamless frontend, and bleeding-edge LLM integration, we created an agent that doesn't just talk—it sells. We are incredibly proud of the clean code and the premium aesthetics we've achieved together.
                            </p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="relative h-80 rounded-3xl bg-surface-1 border border-border overflow-hidden flex items-center justify-center p-8 shadow-sm"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/5 dark:from-primary/15 dark:to-blue-500/10" />
                        <div className="flex flex-col items-center justify-center space-y-4 z-10 w-full">
                            <div className="flex justify-between w-full px-12 md:px-24 text-muted-foreground/30">
                                <Code2 className="w-12 h-12" />
                                <Bot className="w-12 h-12" />
                                <Database className="w-12 h-12" />
                            </div>
                            <div className="text-[100px] md:text-[120px] font-black text-foreground/[0.03] select-none leading-none tracking-tighter">
                                #CODE
                            </div>
                        </div>
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent"
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
                        { value: 'Infinite', label: 'Lines of Code' },
                        { value: '100%', label: 'Collaboration' },
                        { value: '24/7', label: 'Engineering' },
                        { value: '< 1s', label: 'AI Response Time' },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className="bg-surface-1 border border-border rounded-2xl p-6 md:p-8 text-center shadow-sm"
                        >
                            <div className="text-3xl md:text-4xl font-extrabold text-foreground mb-2 mt-2">{stat.value}</div>
                            <div className="text-xs md:text-sm text-muted-foreground font-semibold uppercase tracking-widest">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Values */}
            <section className="relative z-10 py-20 px-4 md:px-6 border-t border-border">
                <div className="max-w-5xl mx-auto">
                    <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
                            What We Stand For
                        </h2>
                        <p className="text-muted-foreground max-w-md mx-auto text-lg font-medium">
                            The engineering and design principles that guide our work.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-5">
                        {[
                            { icon: Zap, title: 'Clean Architecture', desc: 'We believe code should be maintainable, scalable, and modular, preventing technical debt.' },
                            { icon: Globe, title: 'Premium Design', desc: 'Aesthetics matter. Building UIs that rival industry leaders using modern glassmorphism and subtle animations.' },
                            { icon: ShieldCheck, title: 'Robust Security', desc: 'Strict edge-case handling, RAG firewalls, and Supabase auth to keep data completely secure.' },
                            { icon: Users, title: 'Pair Programming', desc: 'Seamless orchestration between human intent and AI execution to ship features at lightspeed.' },
                            { icon: MessageCircle, title: 'Functional Empathy', desc: 'Encoding soft skills into AI responses, so agents detect frustration and pivot elegantly.' },
                            { icon: TrendingUp, title: 'Conversion Focus', desc: 'Every layout, CTA, and microcopy is designed with maximum sales conversion in mind.' },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1, duration: 0.6 }}
                                className="bg-surface-1 border border-border p-6 rounded-2xl group flex flex-col justify-between hover:-translate-y-1 transition-transform cursor-default shadow-sm"
                            >
                                <div>
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                                        <item.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">{item.title}</h3>
                                    <p className="text-muted-foreground text-sm font-medium leading-relaxed">{item.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
