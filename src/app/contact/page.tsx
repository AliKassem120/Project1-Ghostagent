'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StarBackground from '@/components/StarBackground';
import { Mail, Send, Clock, CheckCircle } from 'lucide-react';

export default function Contact() {
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Simulate form submission
        setTimeout(() => {
            setLoading(false);
            setSubmitted(true);
        }, 1500);
    };

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

            <section className="relative z-10 pt-32 pb-20 px-4 md:px-6 min-h-[100dvh] flex flex-col items-center justify-center">
                <div className="max-w-lg w-full mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-center mb-10"
                    >
                        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
                            Get in Touch
                        </h1>
                        <p className="text-muted-foreground max-w-md mx-auto font-medium">
                            Have a question or need help setting up your agent? We&apos;re here for you.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        className="bg-surface-1 border border-border shadow-sm rounded-3xl p-8 md:p-10"
                    >
                        {submitted ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-8"
                            >
                                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle className="w-8 h-8 text-green-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-foreground mb-3">Message Sent!</h3>
                                <p className="text-muted-foreground font-medium">
                                    We&apos;ll get back to you within 24 hours. Check your inbox.
                                </p>
                            </motion.div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-muted-foreground ml-1">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                        <input
                                            type="email"
                                            required
                                            placeholder="you@example.com"
                                            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3.5 pl-11 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/30 outline-none transition-all placeholder:text-muted-foreground/50 hover:border-muted-foreground/30 font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-muted-foreground ml-1">Subject</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="How can we help?"
                                        className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3.5 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/30 outline-none transition-all placeholder:text-muted-foreground/50 hover:border-muted-foreground/30 font-medium"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-muted-foreground ml-1">Message</label>
                                    <textarea
                                        rows={5}
                                        required
                                        placeholder="Tell us more..."
                                        className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3.5 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/30 outline-none transition-all placeholder:text-muted-foreground/50 resize-none hover:border-muted-foreground/30 font-medium"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Send Message
                                            <Send className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        {/* Contact Info */}
                        <div className="mt-8 pt-6 border-t border-border space-y-3">
                            <a
                                href="mailto:support@ghostagent.qzz.io"
                                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
                            >
                                <Mail className="w-4 h-4" />
                                support@ghostagent.qzz.io
                            </a>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
                                <Clock className="w-4 h-4" />
                                Typically responds within 24 hours
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
