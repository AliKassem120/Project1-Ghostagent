'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import GhostLogo from '@/components/GhostLogo';
import { Mail, MessageSquare, MapPin, Send } from 'lucide-react';

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate submission (replace with actual API call)
        setTimeout(() => {
            setIsSubmitting(false);
            setSubmitStatus('success');
            setFormData({ name: '', email: '', subject: '', message: '' });

            setTimeout(() => setSubmitStatus('idle'), 5000);
        }, 1500);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    return (
        <main className="min-h-screen bg-black text-white overflow-hidden relative">
            {/* Scanline Overlay */}
            <div className="fixed inset-0 pointer-events-none z-50 opacity-10">
                <motion.div
                    className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                    animate={{ y: ['0%', '100vh'] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />
            </div>

            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-black via-purple-950/20 to-black -z-10" />

            <Navbar />

            {/* HERO SECTION */}
            <section className="relative min-h-[50vh] flex items-center justify-center px-6 pt-32 pb-16">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                            INITIATE CONTACT
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                            Have questions about the Ghost Protocol? Need integration support? Want to become part of the network?
                            <span className="text-cyan-400"> Send us a signal.</span>
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* CONTACT SECTION */}
            <section className="relative py-16 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-12">

                        {/* Left: Contact Info */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                            className="space-y-8"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-purple-400">Direct Channels</h2>

                            {/* Email */}
                            <motion.div
                                className="flex items-start gap-4 p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-purple-500/50 transition-all group"
                                whileHover={{ scale: 1.02 }}
                            >
                                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Mail className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg mb-1 text-white">Email</h3>
                                    <a href="mailto:support@ghostagent.com" className="text-cyan-400 hover:underline">
                                        support@ghostagent.com
                                    </a>
                                    <p className="text-gray-500 text-sm mt-1">Response within 24 hours</p>
                                </div>
                            </motion.div>

                            {/* Support Chat */}
                            <motion.div
                                className="flex items-start gap-4 p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-cyan-500/50 transition-all group"
                                whileHover={{ scale: 1.02 }}
                            >
                                <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <MessageSquare className="w-6 h-6 text-cyan-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg mb-1 text-white">Live Support</h3>
                                    <p className="text-gray-400">Available in your dashboard</p>
                                    <p className="text-gray-500 text-sm mt-1">Mon-Fri, 9AM-6PM EST</p>
                                </div>
                            </motion.div>

                            {/* Location */}
                            <motion.div
                                className="flex items-start gap-4 p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-green-500/50 transition-all group"
                                whileHover={{ scale: 1.02 }}
                            >
                                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <MapPin className="w-6 h-6 text-green-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg mb-1 text-white">Network Hub</h3>
                                    <p className="text-gray-400">Global Infrastructure</p>
                                    <p className="text-gray-500 text-sm mt-1">Distributed across 12 regions</p>
                                </div>
                            </motion.div>

                            {/* Social Links */}
                            <div className="pt-8">
                                <p className="text-gray-500 text-sm mb-4">Follow the Ghost Protocol:</p>
                                <div className="flex gap-4">
                                    {['Twitter', 'LinkedIn', 'GitHub'].map((platform) => (
                                        <a
                                            key={platform}
                                            href="#"
                                            className="px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-cyan-400/50 transition-all text-sm font-mono"
                                        >
                                            {platform}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        {/* Right: Contact Form */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <form onSubmit={handleSubmit} className="p-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 space-y-6">
                                <h2 className="text-2xl font-bold mb-6 text-white">Send a Message</h2>

                                {/* Name */}
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2">
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 focus:border-cyan-400 focus:outline-none text-white placeholder-gray-500 transition-all"
                                        placeholder="Your name"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 focus:border-cyan-400 focus:outline-none text-white placeholder-gray-500 transition-all"
                                        placeholder="you@example.com"
                                    />
                                </div>

                                {/* Subject */}
                                <div>
                                    <label htmlFor="subject" className="block text-sm font-medium text-gray-400 mb-2">
                                        Subject
                                    </label>
                                    <input
                                        type="text"
                                        id="subject"
                                        name="subject"
                                        value={formData.subject}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 focus:border-cyan-400 focus:outline-none text-white placeholder-gray-500 transition-all"
                                        placeholder="What's this about?"
                                    />
                                </div>

                                {/* Message */}
                                <div>
                                    <label htmlFor="message" className="block text-sm font-medium text-gray-400 mb-2">
                                        Message
                                    </label>
                                    <textarea
                                        id="message"
                                        name="message"
                                        value={formData.message}
                                        onChange={handleChange}
                                        required
                                        rows={6}
                                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 focus:border-cyan-400 focus:outline-none text-white placeholder-gray-500 transition-all resize-none"
                                        placeholder="Tell us what you need..."
                                    />
                                </div>

                                {/* Submit Button */}
                                <motion.button
                                    type="submit"
                                    disabled={isSubmitting}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full py-4 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold text-lg flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <motion.div
                                                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            />
                                            Transmitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Send Message
                                        </>
                                    )}
                                </motion.button>

                                {/* Success Message */}
                                {submitStatus === 'success' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 rounded-lg bg-green-500/20 border border-green-500/50 text-green-400 text-center"
                                    >
                                        ✓ Message received. We'll respond within 24 hours.
                                    </motion.div>
                                )}
                            </form>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <section className="relative py-32 px-6 border-t border-white/5">
                <div className="max-w-4xl mx-auto">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl font-bold text-center mb-12 text-white"
                    >
                        Quick Answers
                    </motion.h2>

                    <div className="space-y-4">
                        {[
                            {
                                q: 'How fast is integration?',
                                a: 'Most users are live within 15 minutes. Just connect your accounts and customize your agent.',
                            },
                            {
                                q: 'What platforms do you support?',
                                a: 'Instagram, Facebook, WhatsApp, and custom chat widgets for your website.',
                            },
                            {
                                q: 'Is there a free trial?',
                                a: 'Yes! Start with our 14-day free trial. No credit card required.',
                            },
                            {
                                q: 'How does billing work?',
                                a: 'Simple per-message pricing. Pay only for what you use with transparent, monthly billing.',
                            },
                        ].map((faq, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-cyan-500/30 transition-all"
                            >
                                <h3 className="font-bold text-lg mb-2 text-cyan-400">{faq.q}</h3>
                                <p className="text-gray-400">{faq.a}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="py-12 border-t border-white/5 text-center text-white/40 text-sm bg-black">
                <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
                    <GhostLogo className="w-6 h-6 grayscale" /> GhostAgent &copy; 2024
                </div>
                <p>Built for the next generation of commerce.</p>
            </footer>
        </main>
    );
}
