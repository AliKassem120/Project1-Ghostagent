'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StarBackground from '@/components/StarBackground';
import { Scale } from 'lucide-react';

const sections = [
    {
        title: '1. Acceptance of Terms',
        content: `By accessing or using GhostAgent ("we," "our," or "us"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use our services.`,
    },
    {
        title: '2. Description of Service',
        content: 'GhostAgent provides an automated Instagram DM management platform powered by Artificial Intelligence (AI). We enable businesses to manage messaging workflows, inventory syncing, and automated replies.',
    },
    {
        title: '4. User Responsibilities',
        content: 'You agree to use the service in compliance with all applicable laws and Meta\'s Terms of Service. You are responsible for maintaining the security of your account credentials.',
    },
    {
        title: '5. Termination',
        content: 'We reserve the right to suspend or terminate your access to GhostAgent at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties, or for any other reason.',
    },
    {
        title: '6. Changes to Terms',
        content: 'We reserve the right to modify these terms at any time. Your continued use of the service constitutes acceptance of the modified terms.',
    },
];

export default function TermsOfService() {
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
            <section className="relative z-10 pt-32 pb-16 px-4 md:px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="flex justify-center mb-6">
                            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                                <Scale className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
                            Terms of Service
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium">
                            Last updated: February 2026
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Content */}
            <section className="relative z-10 pb-24 px-4 md:px-6">
                <div className="max-w-3xl mx-auto space-y-5">
                    {sections.map((section, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08, duration: 0.5 }}
                            className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 md:p-8"
                        >
                            <h2 className="text-xl font-bold text-foreground mb-4">{section.title}</h2>
                            <p className="text-muted-foreground leading-relaxed font-medium">{section.content}</p>
                        </motion.div>
                    ))}

                    {/* AI Liability — Warning highlight */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="bg-surface-1 border border-red-500/20 shadow-sm rounded-2xl p-6 md:p-8"
                        style={{ borderColor: 'rgba(239,68,68,0.2)' }}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                            <h2 className="text-xl font-bold text-foreground">3. AI Liability Disclaimer</h2>
                        </div>
                        <p className="text-muted-foreground leading-relaxed mb-4 font-medium">
                            <strong className="text-foreground">GhostAgent is an AI-powered tool.</strong> While we strive for accuracy, AI models may generate incorrect, misleading, or inappropriate responses (&quot;hallucinations&quot;).
                        </p>
                        <p className="text-muted-foreground font-semibold mb-3">You acknowledge and agree that:</p>
                        <ul className="space-y-3">
                            {[
                                'You are solely responsible for reviewing and overseeing the AI\'s interactions with your customers.',
                                'GhostAgent is not liable for any loss of business, reputation damage, or legal consequences arising from AI-generated content.',
                                'You should regularly monitor the AI\'s performance and intervene when necessary.',
                            ].map((item, j) => (
                                <li key={j} className="flex gap-3 text-muted-foreground leading-relaxed text-sm font-medium">
                                    <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
