'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import GhostLogo from '@/components/GhostLogo';
import Navbar from '@/components/Navbar';
import StarBackground from '@/components/StarBackground';
import PricingPlans from '@/components/PricingPlans';
import DemoVideoModal from '@/components/demo/DemoVideoModal';
import Footer from '@/components/Footer';
import EcommerceHeroAnimation from '@/components/landing/EcommerceHeroAnimation';
import AppointmentsHeroAnimation from '@/components/landing/AppointmentsHeroAnimation';
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
  Minus,
  Instagram,
  BadgeCheck,
  Calendar
} from 'lucide-react';

/* ════════════════════════════════════════════════════
   CHAT MESSAGES — Multilingual DM Demo
   ════════════════════════════════════════════════════ */
const chatMessages = [
  { type: 'user', text: 'Hi! How does Ghost Agent actually work?', delay: 0.5 },
  { type: 'bot', text: 'Hey! 👋 We connect to your Instagram to automatically answer DMs and comments 24/7. It learns your inventory and replies in any language. Want to see pricing?', delay: 3.0 },
  { type: 'user', text: 'Yeah, how much is the Pro plan?', delay: 5.5 },
  { type: 'bot', text: 'Pro is $49/mo — up to 1,000 AI replies/month, inventory sync, and sales analytics. Should I send you the setup link? 🚀', delay: 8.5 },
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
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<'ecom' | 'appointments'>('ecom');

  useEffect(() => {
    window.scrollTo(0, 0);
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
              <span className="inline-block mb-2">Sell While You Sleep.</span><br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-500 to-primary" style={{ backgroundSize: '200% 100%', animation: 'gradientShift 4s ease infinite' }}>
                Book While You Work.
              </span>
            </h1>

            <p className="text-base md:text-[1.15rem] text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed font-medium">
              AI-powered automation that handles your DMs, syncs inventory, and schedules clients 24/7.
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
              href="/register"
              className="relative overflow-x-clip px-8 py-4 bg-primary text-primary-foreground font-bold rounded-full hover:scale-[1.03] transition-transform flex items-center justify-center gap-2 group shadow-[0_0_25px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{ animation: 'shimmer 3s ease-in-out infinite' }}
              />
            </Link>
            <DemoVideoModal
              isOpen={showVideo}
              onClose={() => setShowVideo(false)}
              videoSrc="/demo/ghostagent-demo.webm"
            />
            <button
              onClick={() => setShowVideo(true)}
              className="px-8 py-4 bg-foreground/5 border border-border rounded-full hover:bg-foreground/10 transition-colors backdrop-blur-md text-foreground font-semibold flex items-center justify-center gap-2"
            >
              <span>▶</span> Watch Demo
            </button>
          </motion.div>

          {/* Multi-Platform Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex flex-wrap items-center gap-4 justify-center lg:justify-start pt-6"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-1 border border-border shadow-sm">
                <Instagram className="w-4 h-4 text-pink-500" />
                <span className="text-xs font-semibold">Instagram</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-500 text-[9px] font-bold uppercase tracking-wider">Live</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-1/50 border border-border/50 shadow-sm opacity-80 relative group">
                <MessageCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold">WhatsApp</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 ml-1 relative">
                    <span className="text-yellow-500 text-[9px] font-bold uppercase tracking-wider relative z-10 w-full drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">Coming Soon</span>
                </div>
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
         SECTION 2: DUAL WORKSPACE SHOWCASE (NEW)
         ═══════════════════════════════════════════════════ */}
      <section className="relative py-20 md:py-32 px-4 md:px-6 z-10 border-t border-border/50 bg-surface-0/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-foreground tracking-tight">
              One Agent. Two Core Workspaces.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto font-medium">
              Choose the brain that powers your business. From physical products to service bookings, GhostAgent handles the heavy lifting.
            </p>
          </motion.div>

          {/* Toggle Tabs */}
          <div className="flex justify-center mb-12 px-2">
            <div className="relative grid grid-cols-2 bg-surface-2 p-1.5 rounded-full border border-border shadow-sm w-full max-w-[340px] sm:max-w-md">
                <button
                    onClick={() => setActiveWorkspace('ecom')}
                    className={`relative z-10 py-3 rounded-full text-xs sm:text-sm font-bold transition-colors ${
                        activeWorkspace === 'ecom' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    E-Commerce
                </button>
                <button
                    onClick={() => setActiveWorkspace('appointments')}
                    className={`relative z-10 py-3 rounded-full text-xs sm:text-sm font-bold transition-colors ${
                        activeWorkspace === 'appointments' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    Service & Appointments
                </button>
                {/* Active Indicator Slider */}
                <div
                    className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] bg-primary rounded-full shadow-md transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                        activeWorkspace === 'ecom' ? 'translate-x-0' : 'translate-x-full'
                    }`}
                />
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-surface-1 border border-border rounded-[2rem] p-6 md:p-10 shadow-xl overflow-visible lg:overflow-hidden relative h-auto">
            <AnimatePresence mode="wait">
                {activeWorkspace === 'ecom' && (
                    <motion.div
                        key="ecom"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="grid lg:grid-cols-2 gap-10 items-center"
                    >
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full text-xs font-bold uppercase tracking-widest">
                                <ShoppingBag className="w-3.5 h-3.5" /> E-Commerce
                            </div>
                            <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                                Multilingual automated replies & real-time inventory syncing.
                            </h3>
                            <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                                Never sell an out-of-stock item again. GhostAgent checks your live inventory, answers product questions fluently in any language, and checks out customers directly in the DM.
                            </p>
                            <ul className="space-y-4 pt-2">
                                {[
                                    'Checks live inventory numbers before replying',
                                    'Sends strict checkout links and tracks orders',
                                    'Handles size, color, and shipping inquiries naturally'
                                ].map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <Check className="w-3.5 h-3.5 text-primary" />
                                        </div>
                                        <span className="font-semibold text-foreground/90">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative w-full min-h-[420px] sm:min-h-[480px] lg:h-[560px] rounded-2xl flex items-center justify-center overflow-visible lg:overflow-hidden group">
                           <EcommerceHeroAnimation />
                        </div>
                    </motion.div>
                )}

                {activeWorkspace === 'appointments' && (
                    <motion.div
                        key="appointments"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="grid lg:grid-cols-2 gap-10 items-center"
                    >
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full text-xs font-bold uppercase tracking-widest">
                                <Calendar className="w-3.5 h-3.5" /> Appointments
                            </div>
                            <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                                Smart scheduling and strict calendar management.
                            </h3>
                            <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                                Your automated receptionist. GhostAgent books specific service slots, double-checks your calendar availability, and handles strict overlapping appointment logic.
                            </p>
                            <ul className="space-y-4 pt-2">
                                {[
                                    'Smart calendar block checks inside the DM',
                                    'Mandatory name & phone capture before booking',
                                    'Strict service duration calculation'
                                ].map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <Check className="w-3.5 h-3.5 text-primary" />
                                        </div>
                                        <span className="font-semibold text-foreground/90">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative w-full min-h-[420px] sm:min-h-[480px] lg:h-[560px] rounded-2xl flex items-center justify-center overflow-visible lg:overflow-hidden group">
                           <AppointmentsHeroAnimation />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
          </div>
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
                  <span className="text-muted-foreground">Average response time: <span className="text-foreground">&lt; 1 second</span></span>
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

            {/* Card 3: Inventory & Appointments */}
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
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">Syncs Systems</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  Real-time stock syncing for E-Commerce and live calendar availability checking for Service Appointments.
                </p>
              </div>
            </motion.div>

            {/* Card 4: Actionable Analytics */}
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
                  Track orders, booked appointments, response times, and customer sentiment all from one live unified dashboard.
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
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground tracking-tight">
              Trusted by Businesses That Run on DMs
            </h2>
            <p className="text-muted-foreground text-lg font-medium max-w-2xl mx-auto leading-relaxed">
              From online stores to appointment-based businesses, GhostAgent helps teams reply faster, capture more customers, and stop missing revenue.
            </p>
          </motion.div>

          {/* Testimonial Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative z-10">
            {[
              {
                name: 'Elena Rostova',
                businessType: 'Beauty Clinic',
                handle: '@elena_glowup',
                initials: 'ER',
                color: 'from-pink-500 to-rose-400',
                metric: '21 bookings captured this month',
                quote: 'GhostAgent handles our late-night appointment requests, checks availability, and collects names and phone numbers before confirming. We stopped double-booking clients.',
                stars: 5,
              },
              {
                name: 'Julian Cortez',
                businessType: 'Apparel Store',
                handle: '@cortez_apparel',
                initials: 'JC',
                color: 'from-blue-600 to-cyan-400',
                metric: '38 orders captured',
                quote: 'Inventory sync changed everything. Customers ask about size or color, GhostAgent checks stock, replies instantly, and helps complete the order inside the DM.',
                stars: 5,
              },
              {
                name: 'Amira Hassan',
                businessType: 'Makeup Studio',
                handle: '@amira.studios',
                initials: 'AH',
                color: 'from-purple-600 to-fuchsia-500',
                metric: 'Arabic + English replies',
                quote: 'It switches naturally between Arabic and English, answers service questions, and books clients without me being glued to my phone.',
                stars: 5,
              },
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="relative group"
              >
                {/* Center card subtle glow */}
                {i === 1 && (
                    <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                )}
                
                <div className="glass-frosted bg-surface-1/60 rounded-3xl p-6 md:p-8 flex flex-col h-full border border-border group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)] transition-all duration-300 relative z-10">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-2 border border-border/50 shadow-sm shrink-0 relative">
                         <div className={`absolute inset-0 bg-gradient-to-br ${testimonial.color} flex items-center justify-center`}>
                             <span className="text-sm font-bold text-white tracking-wider">{testimonial.initials}</span>
                         </div>
                      </div>
                      <div>
                        <p className="text-base font-bold text-foreground tracking-tight">{testimonial.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs text-muted-foreground font-semibold">{testimonial.businessType} <span className="opacity-50">•</span> {testimonial.handle}</p>
                            <BadgeCheck className="w-4 h-4 text-blue-500 drop-shadow-[0_0_3px_rgba(59,130,246,0.4)] group-hover:animate-pulse" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-1 mb-4">
                      {[...Array(testimonial.stars)].map((_, j) => (
                        <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                    
                    <p className="text-foreground/90 font-medium text-[15px] leading-relaxed flex-1 italic relative z-10">
                        "{testimonial.quote}"
                    </p>
                    
                    <div className="mt-6 pt-5 border-t border-border/50">
                        <div className="inline-flex items-center px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
                            <span className="text-xs font-bold text-primary tracking-wide">{testimonial.metric}</span>
                        </div>
                    </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Proof Bar */}
          <div className="mt-16 text-center">
              <p className="text-xs md:text-sm font-bold text-muted-foreground uppercase tracking-widest max-w-3xl mx-auto">
                  Automating DMs for e-commerce stores, salons, clinics, studios, and local service businesses.
              </p>
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
              { q: 'Does Ghost Agent handle both physical products and services?', a: 'Yes! Ghost Agent is built with dual workspaces. It can sync physical inventory to check out e-com customers, OR it can sync with your calendar to strictly manage service appointments.' },
              { q: 'Will my account get banned for using a bot?', a: 'No. Ghost Agent uses the official Instagram and Facebook Graph APIs. We are fully compliant with Meta’s terms of service and rate limits.' },
              { q: 'Can it speak my local dialect?', a: 'Ghost Agent powered by advanced LLMs is natively multilingual. It understands and responds fluently in Lebanese Franco, Gulf Arabic, English, French, Spanish, and many more, matching your customer’s tone.' },
              { q: 'How does the Appointments booking work?', a: 'You set your services and durations. Ghost Agent chats with the client, collects mandatory data (Name, Phone), securely queries your live availability, and blocks the slot instantly—preventing double-bookings.' },
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
    </main>
  );
}
