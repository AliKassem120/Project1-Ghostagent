'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import GhostLogo from '@/components/GhostLogo';
import Navbar from '@/components/Navbar';
import StarBackground from '@/components/StarBackground';
import PricingPlans from '@/components/PricingPlans';
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
  Plus,
  Minus
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
        <div className="flex items-center gap-3 px-4 pt-10 pb-3 border-b border-border bg-surface-0/50 backdrop-blur-md z-10 relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
            <GhostLogo className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-foreground text-xs font-semibold tracking-tight">Ghost Agent</p>
            <p className="text-muted-foreground text-[10px] font-medium">Active now</p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-500 text-[9px] font-bold uppercase tracking-wider">AI</span>
          </div>
        </div>

        {/* Chat Messages */}
        <div
          ref={chatContainerRef}
          className="flex flex-col gap-3 p-4 overflow-y-auto"
          style={{ height: 'calc(100% - 60px)', scrollBehavior: 'smooth' }}
        >
          {visibleMessages.map((msgIndex) => {
            const msg = chatMessages[msgIndex];
            return (
              <div
                key={`msg-${msgIndex}`}
                className={`chat-bubble shadow-sm ${msg.type === 'user' ? 'chat-bubble-user text-white' : 'chat-bubble-bot'}`}
                style={{ animationDelay: '0s' }}
              >
                {msg.text}
              </div>
            );
          })}

          {showTyping && (
            <div className="chat-bubble chat-bubble-bot shadow-sm" style={{ opacity: 1, transform: 'none', width: 'fit-content' }}>
              <div className="chat-typing" style={{ opacity: 1, transform: 'none', padding: '8px 12px' }}>
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
      className="flex items-start gap-6 md:gap-8 group"
    >
      {/* Step Number */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center relative shadow-sm border border-border bg-surface-1"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(59,130,246,0.05) 100%)',
            animation: isInView ? 'pulseGlow 3s ease-in-out infinite' : 'none',
          }}
        >
          <Icon className="w-7 h-7 md:w-8 md:h-8 text-primary group-hover:scale-110 transition-transform duration-300" />
        </div>
        {index < 2 && (
          <div className="w-px h-16 bg-gradient-to-b from-primary/30 to-transparent mt-4" />
        )}
      </div>

      {/* Content */}
      <div className="pt-2 md:pt-4">
        <span className="text-xs font-bold text-primary uppercase tracking-widest mb-2 block">
          Step {step}
        </span>
        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3 tracking-tight">{title}</h3>
        <p className="text-muted-foreground leading-relaxed max-w-md font-medium">{description}</p>
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
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
    <main className="min-h-[100dvh] text-foreground overflow-x-clip relative selection:bg-primary/30">
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
      <section className="relative min-h-[100dvh] flex flex-col lg:flex-row items-center justify-center px-4 md:px-6 pt-28 md:pt-32 pb-12 max-w-7xl mx-auto gap-8 lg:gap-16 z-10">
        {/* Left: Copy */}
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-8 shadow-sm">
              <Zap className="w-3.5 h-3.5" />
              AI-Powered Instagram Automation
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.95] mb-6 text-foreground">
              {/* "Sell While" fades in first */}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="inline-block"
              >
                Sell While
              </motion.span>
              <br />
              {/* "You Sleep." — ghost reveals gradient from left to right */}
              <span className="relative inline-block whitespace-nowrap overflow-visible" style={{ lineHeight: 1.15 }}>
                {/* Base: invisible until gradient paints over */}
                <span className="text-foreground" style={{ opacity: 0 }}>You Sleep.</span>

                {/* Gradient text layer — revealed by clipPath synced to ghost */}
                <motion.span
                  className="absolute left-0 top-0 w-full h-full bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-500 to-primary"
                  style={{ backgroundSize: '200% 100%', animation: 'gradientShift 4s ease 2.8s infinite' }}
                  initial={{ clipPath: "inset(-15% 100% -15% 0)" }}
                  animate={{ clipPath: "inset(-15% -5% -15% 0)" }}
                  transition={{ duration: 2.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.6 }}
                >
                  You Sleep.
                </motion.span>

                {/* Ghost gliding across — synced to the same timing */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none"
                  initial={{ left: "-20%", opacity: 0 }}
                  animate={{ left: "105%", opacity: [0, 1, 1, 0.9] }}
                  transition={{ duration: 2.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.6 }}
                >
                  <motion.div
                    animate={{ y: [-3, 3, -3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <GhostLogo className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 text-primary drop-shadow-[0_0_20px_rgba(139,92,246,0.5)]" />
                  </motion.div>
                </motion.div>
              </span>
            </h1>

            <p className="text-base md:text-[1.15rem] text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed font-medium">
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
              className="relative overflow-x-clip px-8 py-4 bg-primary text-primary-foreground font-bold rounded-full hover:scale-[1.03] transition-transform flex items-center justify-center gap-2 group shadow-[0_0_25px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{ animation: 'shimmer 3s ease-in-out infinite' }}
              />
            </Link>
            <button
              onClick={() => setShowVideo(true)}
              className="px-8 py-4 bg-foreground/5 border border-border rounded-full hover:bg-foreground/10 transition-colors backdrop-blur-md text-foreground font-semibold flex items-center justify-center gap-2"
            >
              <span>▶</span> Watch Demo
            </button>
          </motion.div>

          {/* Trust Micro-Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="flex items-center gap-5 justify-center lg:justify-start pt-6"
          >
            <div className="flex -space-x-3">
              {[
                'https://i.pravatar.cc/150?img=1',
                'https://i.pravatar.cc/150?img=2',
                'https://i.pravatar.cc/150?img=3',
                'https://i.pravatar.cc/150?img=4'
              ].map((url, i) => (
                <img key={i} src={url} alt="User Avatar" className="w-10 h-10 rounded-full border-2 border-background object-cover grayscale hover:grayscale-0 transition-all" />
              ))}
            </div>
            <div className="flex flex-col">
              <div className="flex gap-1 text-yellow-400 mb-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-3.5 h-3.5 fill-current" />
                ))}
              </div>
              <p className="text-xs text-muted-foreground font-medium">Over <span className="text-foreground font-bold">50+ stores</span> automated</p>
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
          <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent blur-3xl opacity-60 dark:opacity-100" />
          <PhoneMockup />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════
         NARRATIVE: PROBLEM / SOLUTION
         ═══════════════════════════════════════════════════ */}
      <section className="relative py-20 md:py-32 px-4 md:px-6 z-10 border-t border-border/50 bg-surface-0/30">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-foreground tracking-tight">
              Stop losing customers in your DMs.
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
              Every unanswered question is a lost sale. Ghost Agent gives modern brands the superpower to reply instantly, build trust, and check out customers directly within Instagram.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-8 md:gap-16 pt-8 border-t border-border/50"
          >
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-black text-primary mb-2">3x</p>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">More Conversions</p>
            </div>
            <div className="hidden sm:block w-px h-16 bg-border" />
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-black text-primary mb-2">&lt; 1s</p>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Response Time</p>
            </div>
          </motion.div>
        </div>
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
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground tracking-tight">
              Everything You Need to Scale
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg font-medium">
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
              <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-7 h-7 text-primary" />
                </div>
                <div className="mt-1">
                  <h3 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Smart Replies</h3>
                  <p className="text-muted-foreground leading-relaxed font-medium">
                    Context-aware AI that understands intent, reads tone, and replies like a human — handling questions, objections, and closing sales automatically.
                  </p>
                </div>
              </div>
              <div className="mt-6 p-4 rounded-2xl bg-surface-2 border border-border">
                <div className="flex items-center gap-3 text-sm font-semibold">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-muted-foreground">Live: <span className="text-foreground">{liveConversations.toLocaleString()}</span> conversations handled today</span>
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
              className="bento-card group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Globe className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">Multilingual AI</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  Fluently switches between Arabic, English, French, Spanish and more — mid-conversation.
                </p>
              </div>
            </motion.div>

            {/* Card 3: Inventory Sync */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="bento-card group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ShoppingBag className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">Inventory Sync</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  Real-time stock levels, pricing, and availability — updated directly from your chats.
                </p>
              </div>
            </motion.div>

            {/* Card 4: Sales Analytics */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="bento-card group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">Sales Analytics</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  Track conversions, revenue, response times, and customer sentiment with live dashboards.
                </p>
              </div>
            </motion.div>

            {/* Card 5: 24/7 Autopilot */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="bento-card group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">24/7 Autopilot</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  Your Ghost never sleeps. Every DM gets answered — nights, weekends, holidays — instantly.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
         SECTION 3: HOW IT WORKS
         ═══════════════════════════════════════════════════ */}
      <section id="about" className="relative py-24 md:py-32 px-4 md:px-6 z-10 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-24"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
              Live in 3 Minutes
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-lg font-medium">
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
      <section className="relative py-24 md:py-32 px-4 md:px-6 z-10 border-t border-border bg-surface-0/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground tracking-tight">
              Loved by Sellers Everywhere
            </h2>
            <p className="text-muted-foreground text-lg font-medium max-w-lg mx-auto">
              Join thousands of store owners automating their Instagram sales.
            </p>
          </motion.div>

          {/* Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-20">
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
                className="glass-frosted rounded-2xl p-6 md:p-8 text-center"
              >
                <div className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tighter mb-2">{stat.value}</div>
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">{stat.label}</div>
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
                className="glass-frosted rounded-2xl p-6 flex flex-col hover:-translate-y-1 transition-transform duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-full ${testimonial.color} flex items-center justify-center font-bold text-sm text-white shadow-md`}>
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground tracking-tight">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.handle}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(testimonial.stars)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-foreground/80 font-medium text-sm leading-relaxed flex-1 italic relative z-10">"{testimonial.quote}"</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
         SECTION 5: PRICING
         ═══════════════════════════════════════════════════ */}
      <PricingPlans />

      {/* ═══════════════════════════════════════════════════
         NEW SECTION: FAQ
         ═══════════════════════════════════════════════════ */}
      <section className="relative py-24 md:py-32 px-4 md:px-6 z-10 border-t border-border bg-surface-0/20">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground text-lg font-medium">
              Everything you need to know about the product and billing.
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              { q: 'Does Ghost Agent reply to comments too?', a: 'Yes! Ghost Agent can be configured to automatically reply to story replies, post comments, and direct messages, smoothly transitioning public comments into private sales conversations.' },
              { q: 'Will my account get banned for using a bot?', a: 'No. Ghost Agent uses the official Instagram and Facebook Graph APIs. We are fully compliant with Meta’s terms of service and rate limits.' },
              { q: 'Can it speak my local dialect?', a: 'Ghost Agent powered by advanced LLMs is natively multilingual. It understands and responds fluently in Lebanese Franco, Gulf Arabic, English, French, Spanish, and many more, matching your customer’s tone.' },
              { q: 'How does it know my inventory?', a: 'During setup, you can connect your Shopify, WooCommerce, or manually upload a simple CSV. Ghost Agent will sync stock levels in real-time and never sell items you don’t have.' },
              { q: 'Can I jump in and reply manually?', a: 'Absolutely. The AI automatically pauses if it detects you typing or sending a manual message, handing control securely back to you or your human agents.' },
            ].map((faq, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="border border-border rounded-2xl bg-surface-1 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="flex items-center justify-between w-full px-6 py-5 text-left focus:outline-none"
                >
                  <span className="font-semibold text-foreground pr-8">{faq.q}</span>
                  {openFaq === idx ? (
                    <Minus className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <Plus className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                </button>
                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-6 text-muted-foreground font-medium leading-relaxed border-t border-border/50 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA STRIP ═══ */}
      <section className="relative py-24 md:py-32 px-4 md:px-6 z-10 border-t border-border bg-gradient-to-b from-surface-1 to-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-foreground">
            Ready to Automate Your Sales?
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto font-medium leading-relaxed">
            Join 50+ store owners already using Ghost Agent. Set up in under 3 minutes.
          </p>
          <Link
            href="/login"
            className="relative overflow-x-clip inline-flex items-center gap-3 px-12 py-5 bg-primary text-primary-foreground font-bold rounded-full hover:scale-[1.03] transition-transform shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_50px_rgba(139,92,246,0.5)] text-lg"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start Your Free Trial
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
