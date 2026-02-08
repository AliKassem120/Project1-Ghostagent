'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GhostIcon from '@/components/GhostIcon';
import GhostLogo from '@/components/GhostLogo';
import StarBackground from '@/components/StarBackground';
import VideoModal from '@/components/VideoModal';
import Link from 'next/link';
import { ArrowRight, Bot, MessageCircle, BarChart3, ShoppingBag } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function Home() {
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen text-white overflow-hidden relative selection:bg-primary/30">
      {/* Cyberpunk Grid Background */}
      <div className="fixed inset-0 bg-black">
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"
          style={{ maskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)' }}
        />
      </div>

      <StarBackground />
      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            initial={{ opacity: 0, top: "110%", left: `${Math.random() * 100}%` }}
            animate={{ opacity: [0, 0.8, 0], top: "-10%" }}
            transition={{ duration: Math.random() * 10 + 10, repeat: Infinity, ease: "linear", delay: Math.random() * 5 }}
          />
        ))}
      </div>

      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col md:flex-row items-center justify-center p-6 pt-32 max-w-7xl mx-auto gap-12 z-10">
        <div className="flex-1 space-y-8 text-center md:text-left">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="relative mb-6">
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-2 drop-shadow-2xl">
                {/* Typewriter Effect with Gradient Text */}
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
                  {"YOUR GHOST".split("").map((char, index) => (
                    <motion.span
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.08, duration: 0.01 }}
                      className="bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500"
                    >
                      {char}
                    </motion.span>
                  ))}
                </span>
                <br />
                <span className="relative inline-block mt-2">
                  <span className="relative z-10 bg-clip-text text-transparent bg-gradient-to-b from-purple-300 to-purple-600 font-black tracking-widest drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                    SALES AGENT
                  </span>
                  {/* Chromatic Aberration Layers */}
                  <motion.span
                    className="absolute inset-0 text-red-500/40 z-0 mix-blend-screen select-none"
                    animate={{ x: [-2, 2, -2], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    SALES AGENT
                  </motion.span>
                  <motion.span
                    className="absolute inset-0 text-cyan-500/40 z-0 mix-blend-screen select-none"
                    animate={{ x: [2, -2, 2], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    SALES AGENT
                  </motion.span>
                </span>
              </h1>
            </div>
            <p className="text-lg md:text-xl text-white/60 max-w-xl mx-auto md:mx-0 leading-relaxed px-4 md:px-0">
              Scale your Instagram store with an AI that never sleeps.
              Auto-replies to comments, DMs, and manages inventory in the shadows.
            </p>
          </motion.div>

          {/* Buttons: Slide Up */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="flex flex-col md:flex-row gap-4 justify-center md:justify-start"
          >
            <Link href="/login" className="relative z-50 overflow-hidden px-8 py-4 bg-primary text-black font-bold rounded-full hover:scale-105 transition-transform flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(192,132,252,0.3)] hover:shadow-[0_0_30px_rgba(192,132,252,0.5)] cursor-pointer touch-manipulation">
              <span className="relative z-10 flex items-center gap-2">Start Free Trial <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              />
            </Link>
            <button
              onClick={() => setShowVideo(true)}
              className="px-8 py-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors backdrop-blur-md"
            >
              Watch Demo
            </button>
          </motion.div>
        </div>

        {/* Floating Ghost with Glitch */}
        <div className="flex-1 flex items-center justify-center relative min-h-[300px] md:min-h-[400px]">
          <motion.div
            className="scale-75 md:scale-100 relative"
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Holographic Signal Noise */}
            <motion.div
              className="absolute inset-0 z-10 mix-blend-color-dodge"
              animate={{ opacity: [0, 0.8, 0], x: [0, -5, 5, 0], skewX: [0, 10, -10, 0] }}
              transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 5 }}
            >
              <GhostIcon className="text-cyan-400 blur-[2px]" />
            </motion.div>

            <div className="relative filter drop-shadow-[0_0_50px_rgba(192,132,252,0.3)]">
              <GhostIcon />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      {/* Features Section */}
      <section id="features" className="relative py-32 px-6 z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: MessageCircle, title: "Smart Replies", desc: "Context-aware responses to every comment and DM instantly." },
            { icon: ShoppingBag, title: "Inventory Sync", desc: "Real-time stock management directly from your chats." },
            { icon: BarChart3, title: "Sales Analytics", desc: "Track conversions and revenue with beautiful charts." }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="glass p-8 rounded-3xl border border-white/5 hover:border-primary/20 transition-colors group"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
              <p className="text-white/60 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      {/* How it Works */}
      <section id="about" className="relative py-32 px-6 border-t border-white/5 bg-black/40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Automate in 3 Steps</h2>
            <p className="text-white/60 max-w-2xl mx-auto">Set up your agent once, and watch it handle sales forever.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connector Line */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

            {[
              { step: "01", title: "Connect Account", desc: "Link your Instagram business profile securely in seconds." },
              { step: "02", title: "Configure Agent", desc: "Set your tone, upload inventory, and define sales rules." },
              { step: "03", title: "Watch It Scale", desc: "The agent replies to comments and closes deals 24/7." }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="relative z-10 text-center"
              >
                <div className="w-24 h-24 mx-auto glass-dark rounded-full flex items-center justify-center border border-white/10 mb-8 shadow-[0_0_30px_rgba(192,132,252,0.15)]">
                  <span className="text-3xl font-black text-primary">{item.step}</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                <p className="text-white/60 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      {/* Pricing */}
      <section id="pricing" className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Simple Pricing</h2>
            <p className="text-white/60">Start free, upgrade as you grow.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
              <h3 className="text-xl font-bold text-white/80 mb-2">Starter</h3>
              <div className="text-4xl font-bold mb-6">$0<span className="text-lg text-white/40 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 text-white/60">
                <li className="flex gap-2"><Bot className="w-5 h-5 text-white" /> 50 Auto-Replies</li>
                <li className="flex gap-2"><Bot className="w-5 h-5 text-white" /> Basic Analytics</li>
                <li className="flex gap-2"><Bot className="w-5 h-5 text-white" /> Community Support</li>
              </ul>
              <Link href="/login" className="block w-full py-3 rounded-xl border border-white/20 text-center font-bold hover:bg-white text-white hover:text-black transition-all">
                Try For Free
              </Link>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-3xl border border-primary/50 bg-primary/5 relative transform md:-translate-y-4">
              <div className="absolute top-0 right-0 bg-primary text-black text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">POPULAR</div>
              <h3 className="text-xl font-bold text-primary mb-2">Pro Agent</h3>
              <div className="text-4xl font-bold mb-6">$49<span className="text-lg text-white/40 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 text-white/80">
                <li className="flex gap-2"><Bot className="w-5 h-5 text-primary" /> Unlimited Replies</li>
                <li className="flex gap-2"><Bot className="w-5 h-5 text-primary" /> Inventory Sync</li>
                <li className="flex gap-2"><Bot className="w-5 h-5 text-primary" /> Priority Support</li>
              </ul>
              <Link href="/login" className="block w-full py-3 rounded-xl bg-primary text-black text-center font-bold hover:shadow-[0_0_20px_rgba(192,132,252,0.4)] transition-all">
                Get Started
              </Link>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
              <h3 className="text-xl font-bold text-white/80 mb-2">Empire</h3>
              <div className="text-4xl font-bold mb-6">$199<span className="text-lg text-white/40 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 text-white/60">
                <li className="flex gap-2"><Bot className="w-5 h-5 text-white" /> Multiple Accounts</li>
                <li className="flex gap-2"><Bot className="w-5 h-5 text-white" /> Custom AI Model</li>
                <li className="flex gap-2"><Bot className="w-5 h-5 text-white" /> API Access</li>
              </ul>
              <Link href="/login" className="block w-full py-3 rounded-xl border border-white/20 text-center font-bold hover:bg-white text-white hover:text-black transition-all">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      {/* Footer */}
      <footer id="contact" className="py-12 border-t border-white/5 text-center text-white/40 text-sm bg-black">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
          <GhostLogo className="w-6 h-6 grayscale" /> GhostAgent &copy; 2024
        </div>
        <p>Built for the next generation of commerce.</p>
      </footer>

      <VideoModal isOpen={showVideo} onClose={() => setShowVideo(false)} />


    </main>
  );
}
