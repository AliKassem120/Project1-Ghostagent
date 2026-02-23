'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import GhostLogo from '@/components/GhostLogo';
import Navbar from '@/components/Navbar';
import StarBackground from '@/components/StarBackground';
import VideoModal from '@/components/VideoModal';
import Footer from '@/components/Footer';
import Link from 'next/link';
import {
  ArrowRight,
  MessageCircle,
  BarChart3,
  ShoppingBag,
  Globe,
  Zap,
  Shield,
  Check,
  Star,
  Quote,
} from 'lucide-react';

/* ════════════════════════════════════════════════════
   CHAT MESSAGES — Multilingual DM Demo
   ════════════════════════════════════════════════════ */
const chatMessages = [
  { type: 'user', text: 'Hi! How does Ghost Agent actually work?', delay: 0.5 },
  { type: 'bot', text: 'Hey! 👋 We connect to your Instagram to automatically answer DMs and comments 24/7. It learns your inventory and replies in any language. Want to see pricing?', delay: 3.0 },
  { type: 'user', text: 'Yeah, how much is the Pro plan?', delay: 5.5 },
  { type: 'bot', text: 'Pro is $49/mo and gives you unlimited AI replies, live inventory sync, and sales analytics. Should I send you the setup link? 🚀', delay: 8.5 },
  { type: 'user', text: "Let's do it!", delay: 11.5 },
  { type: 'bot', text: 'Awesome! ✅ I just sent you a DM with the onboarding link. Welcome aboard!', delay: 13.5 },
];

/* ════════════════════════════════════════════════════
   PHONE MOCKUP — Animated DM Chat
   ════════════════════════════════════════════════════ */
function PhoneMockup() {
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [showTyping, setShowTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    chatMessages.forEach((msg, index) => {
      // Show typing indicator before bot messages
      if (msg.type === 'bot') {
        timeouts.push(
          setTimeout(() => setShowTyping(true), msg.delay * 1000 - 1200)
        );
      }

      timeouts.push(
        setTimeout(() => {
          setShowTyping(false);
          setVisibleMessages((prev) => [...prev, index]);
        }, msg.delay * 1000)
      );
    });

    // Reset after full cycle
    const resetTimeout = setTimeout(() => {
      setVisibleMessages([]);
      setShowTyping(false);
      // Re-trigger after a pause
      const restartTimeout = setTimeout(() => {
        chatMessages.forEach((msg, index) => {
          if (msg.type === 'bot') {
            timeouts.push(
              setTimeout(() => setShowTyping(true), msg.delay * 1000 - 1200)
            );
          }
          timeouts.push(
            setTimeout(() => {
              setShowTyping(false);
              setVisibleMessages((prev) => [...prev, index]);
            }, msg.delay * 1000)
          );
        });
      }, 1000);
      timeouts.push(restartTimeout);
    }, 16000);
    timeouts.push(resetTimeout);

    return () => timeouts.forEach(clearTimeout);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [visibleMessages, showTyping]);

  return (
    <div className="phone-frame" style={{ animation: 'float 6s ease-in-out infinite' }}>
      <div className="phone-notch" />
      <div className="phone-screen">
        {/* Instagram DM Header */}
        <div className="flex items-center gap-3 px-4 pt-10 pb-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <GhostLogo className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-white text-xs font-semibold">Ghost Agent</p>
            <p className="text-white/40 text-[10px]">Active now</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-[10px]">AI</span>
          </div>
        </div>

        {/* Chat Messages */}
        <div
          ref={chatContainerRef}
          className="flex flex-col gap-2.5 p-3 overflow-y-auto"
          style={{ height: 'calc(100% - 60px)' }}
        >
          {visibleMessages.map((msgIndex) => {
            const msg = chatMessages[msgIndex];
            return (
              <div
                key={`msg-${msgIndex}`}
                className={`chat-bubble ${msg.type === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'}`}
                style={{ animationDelay: '0s' }}
              >
                {msg.text}
              </div>
            );
          })}

          {showTyping && (
            <div className="chat-bubble chat-bubble-bot" style={{ opacity: 1, transform: 'none' }}>
              <div className="chat-typing" style={{ opacity: 1, transform: 'none', padding: 0 }}>
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   SCROLL-TRIGGERED STEP COMPONENT
   ════════════════════════════════════════════════════ */
function StepCard({
  step,
  title,
  description,
  icon: Icon,
  index,
}: {
  step: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: index % 2 === 0 ? -40 : 40 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex items-start gap-6 md:gap-8"
    >
      {/* Step Number */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center relative"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.1) 100%)',
            border: '1px solid rgba(139,92,246,0.2)',
            animation: isInView ? 'pulseGlow 3s ease-in-out infinite' : 'none',
          }}
        >
          <Icon className="w-7 h-7 md:w-8 md:h-8 text-purple-400" />
        </div>
        {index < 2 && (
          <div className="w-px h-16 bg-gradient-to-b from-purple-500/30 to-transparent mt-4" />
        )}
      </div>

      {/* Content */}
      <div className="pt-2 md:pt-4">
        <span className="text-xs font-bold text-purple-400/70 uppercase tracking-widest mb-2 block">
          Step {step}
        </span>
        <h3 className="text-xl md:text-2xl font-bold text-white mb-3">{title}</h3>
        <p className="text-white/50 leading-relaxed max-w-md">{description}</p>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ════════════════════════════════════════════════════ */
export default function Home() {
  const [showVideo, setShowVideo] = useState(false);
  const [liveConversations, setLiveConversations] = useState(847);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Dynamic starting number so it changes on refresh
    setLiveConversations(Math.floor(Math.random() * 200) + 300);
    const interval = setInterval(() => {
      setLiveConversations((prev) => prev + Math.floor(Math.random() * 3) + 1);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen text-white overflow-hidden relative selection:bg-primary/30">
      {/* Background Layers */}
      <div className="fixed inset-0 bg-background">
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"
          style={{ maskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)' }}
        />
      </div>
      <StarBackground />

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            initial={{ opacity: 0, top: '110%', left: `${Math.random() * 100}%` }}
            animate={{ opacity: [0, 0.6, 0], top: '-10%' }}
            transition={{ duration: Math.random() * 12 + 10, repeat: Infinity, ease: 'linear', delay: Math.random() * 5 }}
          />
        ))}
      </div>

      {/* Navigation */}
      <Navbar />

      {/* ═══════════════════════════════════════════════════
         SECTION 1: HERO
         ═══════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col lg:flex-row items-center justify-center px-4 md:px-6 pt-28 md:pt-32 pb-12 max-w-7xl mx-auto gap-8 lg:gap-16 z-10">
        {/* Left: Copy */}
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-300 text-xs font-medium mb-8">
              <Zap className="w-3.5 h-3.5" />
              AI-Powered Instagram Automation
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40">
                Sell While
              </span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 drop-shadow-[0_0_30px_rgba(139,92,246,0.4)]"
                style={{ backgroundSize: '200% 100%', animation: 'gradientShift 4s ease infinite' }}
              >
                You Sleep.
              </span>
            </h1>

            <p className="text-base md:text-lg text-white/50 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Ghost Agent handles your Instagram DMs in any language, syncs inventory, and closes sales 24/7 — so you never miss a customer again.
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
          >
            <Link
              href="/login"
              className="relative overflow-hidden px-8 py-4 bg-primary text-white font-bold rounded-full hover:scale-[1.03] transition-transform flex items-center justify-center gap-2 group shadow-[0_0_25px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                style={{ animation: 'shimmer 3s ease-in-out infinite' }}
              />
            </Link>
            <button
              onClick={() => setShowVideo(true)}
              className="px-8 py-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors backdrop-blur-md text-white/80 hover:text-white"
            >
              ▶ Watch Demo
            </button>
          </motion.div>

          {/* Trust Micro-Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="flex items-center gap-6 justify-center lg:justify-start pt-4"
          >
            <div className="flex -space-x-2">
              {['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500'].map((color, i) => (
                <div key={i} className={`w-8 h-8 rounded-full ${color} border-2 border-background flex items-center justify-center text-[10px] font-bold`}>
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <div className="text-sm text-white/40">
              <span className="text-white font-semibold">50+</span> stores automated
            </div>
          </motion.div>
        </div>

        {/* Right: Phone Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4, duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex-1 flex items-center justify-center relative"
        >
          {/* Phone glow */}
          <div className="absolute inset-0 bg-gradient-radial from-purple-500/10 via-transparent to-transparent blur-3xl" />
          <PhoneMockup />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════
         SECTION 2: BENTO BOX FEATURES
         ═══════════════════════════════════════════════════ */}
      <section id="features" className="relative py-24 md:py-32 px-4 md:px-6 z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              Everything You Need to Scale
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              One platform. Every tool your Instagram business needs to automate, grow, and dominate.
            </p>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {/* Card 1: Smart Replies — spans 2 cols on lg */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="bento-card lg:col-span-2 group"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Smart Replies</h3>
                  <p className="text-white/45 leading-relaxed">
                    Context-aware AI that understands intent, reads tone, and replies like a human — handling questions, objections, and closing sales automatically.
                  </p>
                </div>
              </div>
              <div className="mt-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-white/30">Live: {liveConversations.toLocaleString()} conversations handled today</span>
                </div>
              </div>
            </motion.div>

            {/* Card 2: Multilingual */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="bento-card group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Multilingual AI</h3>
              <p className="text-white/45 leading-relaxed text-sm">
                Fluently switches between Arabic, English, French, Spanish and more — mid-conversation.
              </p>
            </motion.div>

            {/* Card 3: Inventory Sync */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="bento-card group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Inventory Sync</h3>
              <p className="text-white/45 leading-relaxed text-sm">
                Real-time stock levels, pricing, and availability — updated directly from your chats.
              </p>
            </motion.div>

            {/* Card 4: Sales Analytics */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="bento-card group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Sales Analytics</h3>
              <p className="text-white/45 leading-relaxed text-sm">
                Track conversions, revenue, response times, and customer sentiment with live dashboards.
              </p>
            </motion.div>

            {/* Card 5: 24/7 Autopilot */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="bento-card group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">24/7 Autopilot</h3>
              <p className="text-white/45 leading-relaxed text-sm">
                Your Ghost never sleeps. Every DM gets answered — nights, weekends, holidays — instantly.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
         SECTION 3: HOW IT WORKS
         ═══════════════════════════════════════════════════ */}
      <section id="about" className="relative py-24 md:py-32 px-4 md:px-6 z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              Live in 3 Minutes
            </h2>
            <p className="text-white/40 max-w-lg mx-auto">
              From signup to your first automated sale — faster than making coffee.
            </p>
          </motion.div>

          <div className="flex flex-col gap-8 md:gap-12">
            <StepCard
              step="01"
              title="Connect Your Account"
              description="Link your Instagram business profile with one tap. Secure OAuth — we never store your password."
              icon={Zap}
              index={0}
            />
            <StepCard
              step="02"
              title="Configure Your Agent"
              description="Set your brand voice, upload inventory, define sales rules. Your Ghost learns your business in seconds."
              icon={MessageCircle}
              index={1}
            />
            <StepCard
              step="03"
              title="Watch It Scale"
              description="Sit back as your Ghost Agent replies to DMs, handles objections, and closes deals around the clock."
              icon={BarChart3}
              index={2}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
         SECTION 4: SOCIAL PROOF
         ═══════════════════════════════════════════════════ */}
      <section className="relative py-24 md:py-32 px-4 md:px-6 z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              Loved by Sellers Everywhere
            </h2>
            <p className="text-white/40 max-w-lg mx-auto">
              Join thousands of store owners automating their Instagram sales.
            </p>
          </motion.div>

          {/* Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-16">
            {[
              { value: '50+', label: 'Stores' },
              { value: '25,000+', label: 'Messages Handled' },
              { value: '99.9%', label: 'Uptime' },
              { value: '< 2s', label: 'Avg. Response' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-frosted rounded-2xl p-5 md:p-6 text-center"
              >
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-xs md:text-sm text-white/40">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Testimonial Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                name: 'Sarah M.',
                handle: '@s***boutique',
                avatar: 'S',
                color: 'bg-pink-500',
                quote: 'Ghost Agent tripled my response rate overnight. My DMs used to be a nightmare — now they close sales while I sleep.',
                stars: 5,
              },
              {
                name: 'Ahmad K.',
                handle: '@a***_tech',
                avatar: 'A',
                color: 'bg-blue-500',
                quote: 'The multilingual support is insane. It handles Arabic and English seamlessly. My customers in Lebanon love it.',
                stars: 5,
              },
              {
                name: 'Maria L.',
                handle: '@m***.fashion',
                avatar: 'M',
                color: 'bg-purple-500',
                quote: 'Set it up in 5 minutes, inventory syncs perfectly, and my conversion rate jumped 40% in the first week.',
                stars: 5,
              },
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="glass-frosted rounded-2xl p-6 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full ${testimonial.color} flex items-center justify-center font-bold text-sm text-white`}>
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                    <p className="text-xs text-white/30">{testimonial.handle}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {[...Array(testimonial.stars)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <Quote className="w-5 h-5 text-white/10 mb-2" />
                <p className="text-white/50 text-sm leading-relaxed flex-1">{testimonial.quote}</p>
              </motion.div>
            ))}
          </div>


        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
         SECTION 5: PRICING
         ═══════════════════════════════════════════════════ */}
      <section id="pricing" className="relative py-24 md:py-32 px-4 md:px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              Simple, Transparent Pricing
            </h2>
            <p className="text-white/40 max-w-lg mx-auto">
              Start free. Upgrade when you&apos;re ready to dominate.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Starter */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="pricing-card"
            >
              <h3 className="text-lg font-bold text-white/70 mb-2">Starter</h3>
              <div className="mb-6">
                <span className="text-5xl font-black text-white">$0</span>
                <span className="text-white/30 text-sm ml-1">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['50 Auto-Replies / day', 'Basic Analytics', 'Community Support', '1 Instagram Account'].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-white/50">
                    <Check className="w-4 h-4 text-white/20 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block w-full py-3.5 rounded-xl border border-white/10 text-center font-semibold text-white/70 hover:bg-white/5 hover:text-white transition-all"
              >
                Start Free Trial
              </Link>
            </motion.div>

            {/* Pro — Popular */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="pricing-card pricing-popular md:-translate-y-4"
            >
              <div className="absolute -top-px left-1/2 -translate-x-1/2 px-4 py-1 rounded-b-lg bg-gradient-to-r from-purple-500 to-blue-500 text-[11px] font-bold uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-lg font-bold text-purple-300 mb-2 mt-4">Pro Agent</h3>
              <div className="mb-6">
                <span className="text-5xl font-black text-white">$49</span>
                <span className="text-white/30 text-sm ml-1">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Unlimited Replies', 'Inventory Sync', 'Sales Analytics', 'Multilingual AI', 'Priority Support'].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-white/70">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block w-full py-3.5 rounded-xl bg-primary text-white text-center font-bold hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all"
              >
                Get Pro
              </Link>
            </motion.div>

            {/* Empire */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="pricing-card"
            >
              <h3 className="text-lg font-bold text-white/70 mb-2">Empire</h3>
              <div className="mb-6">
                <span className="text-5xl font-black text-white">$199</span>
                <span className="text-white/30 text-sm ml-1">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Everything in Pro', 'Multiple Accounts', 'Custom AI Model', 'API Access', 'Dedicated Account Mgr'].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-white/50">
                    <Check className="w-4 h-4 text-white/20 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block w-full py-3.5 rounded-xl border border-white/10 text-center font-semibold text-white/70 hover:bg-white/5 hover:text-white transition-all"
              >
                Contact Sales
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA STRIP ═══ */}
      <section className="relative py-20 px-4 md:px-6 z-10 border-t border-white/5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
            Ready to Automate Your Sales?
          </h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            Join 50+ store owners already using Ghost Agent. Set up in under 3 minutes.
          </p>
          <Link
            href="/login"
            className="relative overflow-hidden inline-flex items-center gap-2 px-10 py-4 bg-primary text-white font-bold rounded-full hover:scale-[1.03] transition-transform shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_50px_rgba(139,92,246,0.5)]"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </span>
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              style={{ animation: 'shimmer 3s ease-in-out infinite' }}
            />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <Footer />

      <VideoModal isOpen={showVideo} onClose={() => setShowVideo(false)} />
    </main>
  );
}
