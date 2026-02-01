'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import GhostLogo from '@/components/GhostLogo';
import { Ghost, Eye, Shield, User } from 'lucide-react';

export default function AboutPage() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <main className="min-h-screen bg-black text-white overflow-hidden relative">
            {/* Scanline Overlay Effect */}
            <div className="fixed inset-0 pointer-events-none z-50 opacity-10">
                <motion.div
                    className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                    animate={{ y: ['0%', '100vh'] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />
            </div>

            {/* Dark Background Gradient */}
            <div className="fixed inset-0 bg-gradient-to-br from-black via-purple-950/20 to-black -z-10" />

            <Navbar />

            {/* HERO SECTION */}
            <section className="relative min-h-screen flex items-center justify-center px-6 pt-32">
                <div className="max-w-5xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        {/* Glitch Headline */}
                        <h1 className="text-6xl md:text-9xl font-black tracking-tighter mb-8 relative">
                            <span className="relative z-10 text-white">WE OPERATE IN THE SHADOWS</span>
                            {/* Red Glitch Layer */}
                            <motion.span
                                className="absolute inset-0 text-red-500/60 z-0 select-none"
                                animate={{ x: [-3, 3, -3], opacity: [0.6, 0.3, 0.6] }}
                                transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 4 }}
                            >
                                WE OPERATE IN THE SHADOWS
                            </motion.span>
                            {/* Blue Glitch Layer */}
                            <motion.span
                                className="absolute inset-0 text-cyan-500/60 z-0 select-none"
                                animate={{ x: [3, -3, 3], opacity: [0.6, 0.3, 0.6] }}
                                transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 4 }}
                            >
                                WE OPERATE IN THE SHADOWS
                            </motion.span>
                        </h1>

                        {/* Glowing Subtext */}
                        <p className="text-xl md:text-2xl text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] max-w-3xl mx-auto leading-relaxed">
                            The internet never sleeps. Neither should your business. We are the invisible workforce building the future of automated commerce.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* THE ORIGIN CODE */}
            <section className="relative py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        {/* Left: Text */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                        >
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                                THE ORIGIN CODE
                            </h2>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                GhostAgent was born from a simple realization: human potential is wasted on repetition.
                                While you sleep, opportunities vanish. We built the Ghost Protocol to decouple time from revenue.
                                Our AI agents don't just answer questions; they understand intent, manage inventory, and close deals
                                while the world rests. We are not just a tool. <span className="text-purple-400 font-semibold">We are your digital phantom.</span>
                            </p>
                        </motion.div>

                        {/* Right: 3D Wireframe Cube */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="flex items-center justify-center"
                        >
                            <div className="relative w-80 h-80">
                                {/* Rotating Wireframe Cube */}
                                <motion.div
                                    animate={{ rotateX: 360, rotateY: 360 }}
                                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                                    className="w-full h-full"
                                    style={{ transformStyle: 'preserve-3d' }}
                                >
                                    <div className="absolute inset-0 border-2 border-purple-500/30 rounded-lg shadow-[0_0_30px_rgba(168,85,247,0.3)]" />
                                    <div className="absolute inset-[10%] border border-cyan-500/20 rounded-lg" />
                                    <div className="absolute inset-[25%] border border-purple-500/40 rounded-lg shadow-[0_0_20px_rgba(168,85,247,0.2)]" />

                                    {/* Glowing Core */}
                                    <div className="absolute inset-[40%] bg-purple-500/20 rounded-full blur-xl animate-pulse" />
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* THREE PILLARS */}
            <section className="relative py-32 px-6 border-t border-white/5">
                <div className="max-w-7xl mx-auto">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-5xl font-bold text-center mb-16 text-white"
                    >
                        OUR THREE PILLARS
                    </motion.h2>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Card 1: The Phantom */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0 }}
                            className="p-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-purple-500/50 transition-all group"
                        >
                            <div className="w-16 h-16 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Ghost className="w-8 h-8 text-purple-400" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4 text-white">Invisible Integration</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Your customers will never know it's AI. Seamless, natural, and always on brand.
                            </p>
                        </motion.div>

                        {/* Card 2: The Vigil */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="p-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-cyan-500/50 transition-all group"
                        >
                            <div className="w-16 h-16 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Eye className="w-8 h-8 text-cyan-400" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4 text-white">24/7 Uptime</h3>
                            <p className="text-gray-400 leading-relaxed">
                                No breaks, no sleep, no missed DMs. We capture every lead at any hour.
                            </p>
                        </motion.div>

                        {/* Card 3: The Shield */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="p-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-green-500/50 transition-all group"
                        >
                            <div className="w-16 h-16 rounded-xl bg-green-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Shield className="w-8 h-8 text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4 text-white">Grade-A Security</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Encryption-grade handling of your data, inventory, and sales interactions.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* THE OPERATORS */}
            <section className="relative py-32 px-6 border-t border-white/5">
                <div className="max-w-7xl mx-auto">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-5xl font-bold text-center mb-16 text-white"
                    >
                        THE OPERATORS
                    </motion.h2>

                    <div className="grid md:grid-cols-3 gap-12 max-w-4xl mx-auto">
                        {/* Operator 1: Lead Architect */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0 }}
                            className="text-center"
                        >
                            {/* Glitch Avatar */}
                            <div className="relative w-32 h-32 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.6)]" />
                                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-600/20 to-cyan-600/20 backdrop-blur-sm flex items-center justify-center">
                                    <motion.div
                                        animate={{ opacity: [1, 0.5, 1] }}
                                        transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 4 }}
                                    >
                                        <User className="w-12 h-12 text-purple-400" />
                                    </motion.div>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Lead Architect</h3>
                            <p className="text-cyan-400 text-sm font-mono">(You)</p>
                        </motion.div>

                        {/* Operator 2: Neural Core */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="text-center"
                        >
                            {/* Glitch Avatar */}
                            <div className="relative w-32 h-32 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/50 shadow-[0_0_30px_rgba(34,211,238,0.6)]" />
                                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-cyan-600/20 to-purple-600/20 backdrop-blur-sm flex items-center justify-center">
                                    <motion.div
                                        animate={{ opacity: [1, 0.5, 1] }}
                                        transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 4.5 }}
                                    >
                                        <GhostLogo className="w-12 h-12 text-cyan-400" />
                                    </motion.div>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Neural Core</h3>
                            <p className="text-cyan-400 text-sm font-mono">AI Model 1.5 Flash</p>
                        </motion.div>

                        {/* Operator 3: The Network */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="text-center"
                        >
                            {/* Glitch Avatar */}
                            <div className="relative w-32 h-32 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.6)]" />
                                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-green-600/20 to-cyan-600/20 backdrop-blur-sm flex items-center justify-center">
                                    <motion.div
                                        animate={{ opacity: [1, 0.5, 1], rotate: [0, 180, 360] }}
                                        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <div className="w-12 h-12 border-2 border-green-400 rounded-full" />
                                    </motion.div>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">The Network</h3>
                            <p className="text-cyan-400 text-sm font-mono">Global Operations Infrastructure</p>
                        </motion.div>
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
