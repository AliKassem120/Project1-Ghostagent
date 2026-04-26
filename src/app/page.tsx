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
  Calendar,
  RefreshCcw,
  Bot,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import clsx from 'clsx';

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
              posterSrc="/demo/ghostagent-demo-poster.png"
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
      <section id="features" className="relative pt-28 md:pt-32 pb-24 md:pb-32 px-4 md:px-6 z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14 md:mb-16"
          >
            <span className="text-primary font-bold tracking-[0.2em] text-xs uppercase mb-4 block">FEATURES</span>
            <h2 className="text-3xl md:text-5xl font-black mb-4 text-foreground tracking-tighter">
              Everything You Need to Scale
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl font-medium leading-relaxed">
              Automate replies, capture orders, book appointments, and manage customer conversations from one AI-powered workspace.
            </p>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {/* Card 1: Smart Replies — spans 2 cols on lg */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="glass-frosted border border-border rounded-[2.5rem] p-8 lg:col-span-2 group flex flex-col md:flex-row gap-8 relative overflow-hidden"
            >
              <div className="flex-1 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <MessageCircle className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">Smart Replies</h3>
                <p className="text-muted-foreground leading-relaxed font-medium mb-6">
                  GhostAgent understands customer intent, reads context, and replies naturally — from product questions to appointment requests.
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold text-green-500">Average response time: &lt; 1 second</span>
                </div>
              </div>

              {/* Animated DM Preview */}
              <div className="flex-1 bg-surface-2/50 border border-border/50 rounded-2xl p-6 relative min-h-[220px] flex flex-col justify-end gap-4 overflow-hidden">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ repeat: Infinity, repeatDelay: 5, duration: 0.5, delay: 1 }}
                  className="bg-surface-3 border border-border/50 p-3 rounded-2xl rounded-bl-sm self-start max-w-[85%] text-sm font-medium shadow-sm"
                >
                  Do you have this in medium? 🤔
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ repeat: Infinity, repeatDelay: 5, duration: 0.5, delay: 3 }}
                  className="bg-primary text-white p-3 rounded-2xl rounded-br-sm self-end max-w-[85%] text-sm font-semibold shadow-md"
                >
                  Yes — medium is in stock. Want me to reserve it?
                </motion.div>
                <div className="absolute top-4 right-4 text-[10px] font-bold text-muted-foreground/50 tracking-widest uppercase">Live Preview</div>
              </div>
            </motion.div>

            {/* Card 2: Multilingual AI */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="glass-frosted border border-border rounded-[2.5rem] p-8 group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                  <Globe className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">Multilingual AI</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium mb-6">
                  Reply naturally in English, Arabic, French, Spanish, and mixed-language conversations without breaking flow.
                </p>
              </div>
              <div className="flex gap-2">
                {['EN', 'AR', 'FR', 'ES'].map(lang => (
                  <span key={lang} className="px-2.5 py-1 rounded-lg bg-surface-2 border border-border text-[10px] font-black text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-colors">{lang}</span>
                ))}
              </div>
            </motion.div>

            {/* Card 3: Live System Sync */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="glass-frosted border border-border rounded-[2.5rem] p-8 group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-colors">
                  <RefreshCcw className="w-6 h-6 text-cyan-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">Live System Sync</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  Connect inventory, services, calendar availability, and order data so replies are based on facts — not guesses.
                </p>
              </div>
            </motion.div>

            {/* Card 4: Sales & Booking Analytics */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="glass-frosted border border-border rounded-[2.5rem] p-8 group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-6 group-hover:bg-orange-500/20 transition-colors">
                  <BarChart3 className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">Sales & Booking Analytics</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  Track conversations, captured orders, booked appointments, response times, and automation performance from one dashboard.
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
              className="glass-frosted border border-border rounded-[2.5rem] p-8 group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-6 group-hover:bg-rose-500/20 transition-colors">
                  <Bot className="w-6 h-6 text-rose-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">24/7 Autopilot</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  Answer customers instantly during nights, weekends, holidays, and busy work hours — without losing control.
                </p>
              </div>
            </motion.div>

            {/* Card 6: Workflow Automation — Wide card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="glass-frosted border border-border rounded-[2.5rem] p-8 lg:col-span-2 group flex flex-col justify-between overflow-hidden relative"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:bg-indigo-500/20 transition-colors">
                    <Zap className="w-6 h-6 text-indigo-500" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">Workflow Automation</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                    GhostAgent can guide customers through checkout, collect required details, check appointment slots, and hand off when a human is needed.
                  </p>
                </div>
                
                {/* Tiny Workflow Row Animation */}
                <div className="flex-1 flex items-center justify-between gap-2 p-4 bg-surface-2/50 rounded-2xl border border-border/50 relative overflow-hidden">
                   {[
                     { label: "DM Received", icon: MessageCircle },
                     { label: "Data Checked", icon: RefreshCcw },
                     { label: "Reply Sent", icon: Zap },
                     { label: "Captured", icon: CheckCircle2 }
                   ].map((step, i) => (
                     <div key={i} className="flex flex-col items-center gap-2 relative z-10">
                        <motion.div 
                          initial={{ scale: 0.8, opacity: 0.5 }}
                          animate={{ scale: [0.8, 1.1, 1], opacity: [0.5, 1, 1] }}
                          transition={{ repeat: Infinity, repeatDelay: 4, duration: 0.5, delay: i * 0.8 }}
                          className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center text-primary border border-border shadow-sm"
                        >
                           <step.icon className="w-5 h-5" />
                        </motion.div>
                        <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/60">{step.label}</span>
                     </div>
                   ))}
                   {/* Connectors */}
                   <div className="absolute top-9 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-border to-transparent -z-0 opacity-30" />
                </div>
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
         SECTION 5: FAQ
         ═══════════════════════════════════════════════════ */}
      <section id="faq" className="relative py-24 md:py-32 px-4 md:px-6 z-10 border-t border-border bg-surface-0/20">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter text-foreground">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground text-lg font-medium">
              Everything you need to know about GhostAgent, automation, and billing.
            </p>
          </motion.div>

          <div className="space-y-3">
            {[
              { 
                q: 'Does GhostAgent handle both physical products and services?', 
                a: 'Yes. GhostAgent supports both E-Commerce and Service/Appointments workspaces. You can automate product questions, inventory checks, orders, service questions, availability, and bookings.' 
              },
              { 
                q: 'What counts as an AI reply?', 
                a: 'Each automated message GhostAgent sends to a customer counts as one AI reply. Customer messages and manual replies do not count.' 
              },
              { 
                q: 'Can I use both E-Commerce and Appointments?', 
                a: 'Yes. Pro and Empire support both workspace types. Starter lets you test one workspace type.' 
              },
              { 
                q: 'How does appointment booking work?', 
                a: 'GhostAgent checks your working hours, service duration, and calendar availability before asking for required details like name and phone number. It only confirms after the booking is saved.' 
              },
              { 
                q: 'How does E-Commerce automation work?', 
                a: 'GhostAgent checks your products, variants, stock, and order settings before replying. It can answer product questions, collect customer details, and create orders when everything is valid.' 
              },
              { 
                q: 'Will my account get banned for using a bot?', 
                a: 'GhostAgent is designed for responsible business automation. You stay in control, can pause autopilot, and can reply manually anytime. Avoid spammy outreach and use it for real customer conversations.' 
              },
              { 
                q: 'Can it speak my local dialect?', 
                a: 'Yes. GhostAgent can handle English, Arabic, Franco Arabic, French, Spanish, and mixed-language conversations depending on your setup.' 
              },
              { 
                q: 'Can I jump in and reply manually?', 
                a: 'Yes. You can pause autopilot or manually reply whenever needed. GhostAgent should support your team, not lock you out.' 
              },
              { 
                q: 'Can I upgrade later?', 
                a: 'Yes. You can start free and upgrade when your DM volume grows.' 
              },
              { 
                q: 'Do I need a credit card to start?', 
                a: 'No. The Starter plan is free to try.' 
              },
            ].map((faq, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className={clsx(
                    "border rounded-2xl transition-all duration-300",
                    openFaq === idx ? "border-primary/30 bg-surface-1 shadow-sm" : "border-border bg-surface-1/40 hover:bg-surface-1"
                )}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="flex items-center justify-between w-full px-6 py-5 text-left focus:outline-none group"
                >
                  <span className={clsx(
                      "font-bold transition-colors",
                      openFaq === idx ? "text-primary" : "text-foreground group-hover:text-primary"
                  )}>{faq.q}</span>
                  <div className={clsx(
                      "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                      openFaq === idx ? "bg-primary text-white rotate-180" : "bg-surface-2 text-muted-foreground"
                  )}>
                    <Plus className={clsx("w-3.5 h-3.5 transition-transform", openFaq === idx && "hidden")} />
                    <Minus className={clsx("w-3.5 h-3.5 transition-transform", openFaq !== idx && "hidden")} />
                  </div>
                </button>
                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-6 text-muted-foreground font-medium text-sm leading-relaxed border-t border-border/10 pt-4">
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
      <section className="relative py-28 md:py-40 px-4 md:px-6 z-10 border-t border-border overflow-hidden">
        {/* Abstract Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-surface-1/50 to-background -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/20 blur-[120px] rounded-full -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full -z-10" />
        
        {/* Floating Decorative Elements (Subtle) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden hidden lg:block">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-[20%] left-[15%] p-3 bg-surface-2/40 border border-border/50 rounded-2xl backdrop-blur-md shadow-xl">
                <MessageCircle className="w-5 h-5 text-primary" />
            </motion.div>
            <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, delay: 1 }} className="absolute bottom-[25%] right-[12%] p-3 bg-surface-2/40 border border-border/50 rounded-2xl backdrop-blur-md shadow-xl">
                <Calendar className="w-5 h-5 text-rose-500" />
            </motion.div>
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 6, repeat: Infinity }} className="absolute top-[35%] right-[18%] p-2 bg-surface-2/30 border border-border/30 rounded-xl backdrop-blur-sm shadow-lg">
                <ShoppingBag className="w-4 h-4 text-blue-500" />
            </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          {/* Glass Card Container */}
          <div className="relative glass-frosted border border-primary/20 rounded-[3rem] p-10 md:p-20 text-center shadow-2xl overflow-hidden group">
            {/* Subtle Inner Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative z-10 max-w-3xl mx-auto">
                <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter text-foreground leading-[1.1]">
                    Ready to turn DMs into <span className="text-primary">sales</span> and <span className="text-blue-500">bookings?</span>
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground mb-12 font-medium leading-relaxed">
                    Launch your AI business agent in minutes. Automate replies, capture orders, book appointments, and stay in control from one workspace.
                </p>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
                    <Link
                        href="/register"
                        className="w-full sm:w-auto relative overflow-x-clip px-10 py-5 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-full hover:scale-[1.03] transition-all shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_50px_rgba(139,92,246,0.5)] text-sm"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            Get Started Free
                            <ArrowRight className="w-5 h-5" />
                        </span>
                        <div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                            style={{ animation: 'shimmer 3s ease-in-out infinite' }}
                        />
                    </Link>
                    <button
                        onClick={() => setShowVideo(true)}
                        className="w-full sm:w-auto px-10 py-5 bg-surface-2 border border-border rounded-full hover:bg-surface-3 transition-colors text-foreground font-bold flex items-center justify-center gap-2 text-sm"
                    >
                        ▶ Watch Demo
                    </button>
                </div>

                {/* Trust Row */}
                <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3">
                    {[
                        "No credit card required",
                        "Free Starter plan",
                        "Cancel anytime"
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{item}</span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
