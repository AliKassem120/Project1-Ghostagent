'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import GhostLogo from '@/components/GhostLogo';
import Navbar from '@/components/Navbar';
import StarBackground from '@/components/StarBackground';
import PricingPlans from '@/components/PricingPlans';
import DemoVideoModal from '@/components/demo/DemoVideoModal';
import Footer from '@/components/Footer';
import EcommerceHeroAnimation from '@/components/landing/EcommerceHeroAnimation';
import AppointmentsHeroAnimation from '@/components/landing/AppointmentsHeroAnimation';
import { Link } from '@/i18n/navigation';
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

/* ════════════════════════════════════════════════════
   SCROLL-TRIGGERED STEP COMPONENT
   ════════════════════════════════════════════════════ */
function StepItem({
  index,
  title,
  description,
  icon: Icon,
  isActive,
  onInView
}: {
  index: number;
  title: string;
  description: string;
  icon: any;
  isActive: boolean;
  onInView: () => void;
}) {
  const isMobile = useIsMobile();
  
  return (
    <div className="relative">
      {/* Invisible trigger element to handle scroll detection without layout shift interference */}
      <motion.div 
        className="absolute top-0 h-full w-full pointer-events-none"
        viewport={{ 
          once: false, 
          amount: isMobile ? 0.2 : 0.4,
          margin: isMobile ? "-45% 0px -45% 0px" : "-10% 0px -10% 0px" 
        }}
        onViewportEnter={onInView}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={clsx(
          "relative pl-12 md:pl-20 py-12 md:py-16 transition-all duration-500",
          isMobile && "min-h-[350px] flex flex-col justify-center",
          isActive ? "opacity-100 scale-100" : "opacity-40 scale-[0.98]"
        )}
      >
        {/* Icon Container */}
        <div className="absolute left-0 top-8 md:top-12 z-20">
          <div className={clsx(
            "w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center transition-all duration-500 border shadow-lg",
            isActive 
              ? "bg-primary border-primary/50 shadow-primary/20 scale-110" 
              : "bg-surface-2 border-border shadow-black/20"
          )}>
            <Icon className={clsx(
              "w-6 h-6 md:w-8 h-8 transition-colors duration-500",
              isActive ? "text-white" : "text-muted-foreground"
            )} />
          </div>
        </div>

        <div className="space-y-4">
          <span className={clsx(
            "text-xs font-black uppercase tracking-[0.2em] transition-colors duration-500",
            isActive ? "text-primary" : "text-muted-foreground"
          )}>
            Step 0{index + 1}
          </span>
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{title}</h3>
          <p className="text-lg text-muted-foreground font-medium leading-relaxed max-w-md">
            {description}
          </p>
        </div>

        {/* Mobile Preview - Only visible on small screens when active */}
        {isActive && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="lg:hidden mt-8 overflow-hidden"
          >
            <div className="scale-90 origin-top">
              <PreviewPanel step={index} />
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function PreviewPanel({ step }: { step: number }) {
  const isMobile = useIsMobile();
  return (
    <div className={clsx("w-full h-full relative flex items-center justify-center", isMobile ? "min-h-[300px]" : "min-h-[500px]")}>
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="w-full max-w-sm aspect-square glass-frosted rounded-[2.5rem] p-8 border border-border shadow-2xl flex flex-col items-center justify-center gap-8"
          >
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-surface-2 border border-border flex items-center justify-center shadow-inner">
                <Instagram className="w-12 h-12 text-pink-500" />
              </div>
              <motion.div 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-green-500 border-4 border-surface-1 flex items-center justify-center shadow-lg"
              >
                <Check className="w-5 h-5 text-white stroke-[3px]" />
              </motion.div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-bold text-foreground">Instagram Connected</p>
              <p className="text-sm text-muted-foreground">@yourbusiness is live</p>
            </div>
            <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="h-full bg-primary"
                />
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="w-full max-w-sm aspect-square glass-frosted rounded-[2.5rem] p-8 border border-border shadow-2xl flex flex-col gap-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Workspace Setup</span>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="w-1.5 h-1.5 rounded-full bg-surface-3" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30 flex flex-col gap-3">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                  <span className="text-xs font-bold">E-Commerce</span>
                  <div className="w-full h-1 bg-primary rounded-full" />
               </div>
               <div className="p-4 rounded-2xl bg-surface-2 border border-border flex flex-col gap-3 opacity-50">
                  <Calendar className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs font-bold">Services</span>
                  <div className="w-full h-1 bg-border rounded-full" />
               </div>
            </div>

            <div className="space-y-3 pt-2">
               {[
                 { label: "Inventory Synced", icon: RefreshCcw },
                 { label: "Brand Tone: Professional", icon: Bot },
                 { label: "Sales Rules Active", icon: Shield }
               ].map((item, i) => (
                 <motion.div 
                   key={i}
                   initial={{ x: -20, opacity: 0 }}
                   animate={{ x: 0, opacity: 1 }}
                   transition={{ delay: 0.3 + (i * 0.1) }}
                   className="flex items-center gap-3 p-3 rounded-xl bg-surface-2/50 border border-border/50"
                 >
                    <item.icon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold">{item.label}</span>
                 </motion.div>
               ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="w-full max-w-sm aspect-square glass-frosted rounded-[2.5rem] p-6 border border-border shadow-2xl flex flex-col"
          >
            <div className="flex-1 flex flex-col gap-4 overflow-hidden pt-4">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-surface-3 p-3 rounded-2xl rounded-bl-sm self-start max-w-[80%] text-xs font-medium border border-border/50"
              >
                Is the blue hoodie in XL available? 👕
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.5 }}
                className="bg-primary text-white p-3 rounded-2xl rounded-br-sm self-end max-w-[80%] text-xs font-semibold shadow-md"
              >
                Checking... Yes! We have 3 left in XL. Want the checkout link?
              </motion.div>
            </div>

            <div className="mt-6 pt-6 border-t border-border flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                   <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Live Performance</span>
                   <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-primary">1,248</span>
                      <span className="text-[10px] font-bold text-green-500">+12%</span>
                   </div>
                </div>
                <div className="w-24 h-10 bg-surface-2 rounded-xl border border-border relative overflow-hidden flex items-end">
                   {[40, 70, 45, 90, 65, 80, 55, 95].map((h, i) => (
                     <motion.div 
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: 2 + i * 0.1, duration: 1 }}
                        className="flex-1 bg-primary/20 border-t border-primary/50"
                     />
                   ))}
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative Glow */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent -z-10 blur-3xl" />
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [showVideo, setShowVideo] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<'ecom' | 'appointments'>('ecom');
  const [activeStep, setActiveStep] = useState(0);
  const tHero = useTranslations('Hero');
  const tWork = useTranslations('Workspaces');
  const tFeat = useTranslations('Features');
  const tHow = useTranslations('HowItWorks');
  const tTest = useTranslations('Testimonials');
  const tFaq = useTranslations('FAQ');
  const tCta = useTranslations('CTA');

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
              {tHero('badge')}
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.95] mb-6 text-foreground">
              <span className="inline-block mb-2">{tHero('title1')}</span><br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-500 to-primary" style={{ backgroundSize: '200% 100%', animation: 'gradientShift 4s ease infinite' }}>
                {tHero('title2')}
              </span>
            </h1>

            <p className="text-base md:text-[1.15rem] text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed font-medium">
              {tHero('description')}
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
                {tHero('cta')}
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
              <span>▶</span> {tHero('watchDemo')}
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
                <span className="text-xs font-semibold">{tHero('instagram')}</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-500 text-[9px] font-bold uppercase tracking-wider">{tHero('live')}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-1/50 border border-border/50 shadow-sm opacity-80 relative group">
                <MessageCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold">{tHero('whatsapp')}</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 ml-1 relative">
                    <span className="text-yellow-500 text-[9px] font-bold uppercase tracking-wider relative z-10 w-full drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{tHero('comingSoon')}</span>
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
              {tWork('title')}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto font-medium">
              {tWork('description')}
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
                    {tWork('ecommerce')}
                </button>
                <button
                    onClick={() => setActiveWorkspace('appointments')}
                    className={`relative z-10 py-3 rounded-full text-xs sm:text-sm font-bold transition-colors ${
                        activeWorkspace === 'appointments' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {tWork('appointments')}
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
                                <ShoppingBag className="w-3.5 h-3.5" /> {tWork('ecommerce')}
                            </div>
                            <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                                {tWork('ecomTitle')}
                            </h3>
                            <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                                {tWork('ecomDesc')}
                            </p>
                            <ul className="space-y-4 pt-2">
                                {[
                                    tWork('ecomFeature1'),
                                    tWork('ecomFeature2'),
                                    tWork('ecomFeature3')
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
                                <Calendar className="w-3.5 h-3.5" /> {tWork('appointments')}
                            </div>
                            <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                                {tWork('apptTitle')}
                            </h3>
                            <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                                {tWork('apptDesc')}
                            </p>
                            <ul className="space-y-4 pt-2">
                                {[
                                    tWork('apptFeature1'),
                                    tWork('apptFeature2'),
                                    tWork('apptFeature3')
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
            <span className="text-primary font-bold tracking-[0.2em] text-xs uppercase mb-4 block">{tFeat('label')}</span>
            <h2 className="text-3xl md:text-5xl font-black mb-4 text-foreground tracking-tighter">
              {tFeat('title')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl font-medium leading-relaxed">
              {tFeat('description')}
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
                <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">{tFeat('smartReplies')}</h3>
                <p className="text-muted-foreground leading-relaxed font-medium mb-6">
                  {tFeat('smartRepliesDesc')}
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold text-green-500">{tFeat('responseTime')}</span>
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
                <div className="absolute top-4 right-4 text-[10px] font-bold text-muted-foreground/50 tracking-widest uppercase">{tFeat('livePreview')}</div>
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
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">{tFeat('multilingual')}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium mb-6">
                  {tFeat('multilingualDesc')}
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
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">{tFeat('liveSync')}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  {tFeat('liveSyncDesc')}
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
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">{tFeat('analytics')}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  {tFeat('analyticsDesc')}
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
                <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">{tFeat('autopilot')}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                  {tFeat('autopilotDesc')}
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
                  <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">{tFeat('workflow')}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                    {tFeat('workflowDesc')}
                  </p>
                </div>
                
                {/* Tiny Workflow Row Animation */}
                <div className="flex-1 lg:flex-[1.4] flex items-center justify-between gap-2 lg:gap-8 p-4 lg:p-12 bg-surface-2/50 rounded-2xl lg:rounded-[2.5rem] border border-border/50 relative overflow-hidden">
                   {[
                     { label: tFeat('dmReceived'), icon: MessageCircle },
                     { label: tFeat('dataChecked'), icon: RefreshCcw },
                     { label: tFeat('replySent'), icon: Zap },
                     { label: tFeat('captured'), icon: CheckCircle2 }
                   ].map((step, i) => (
                     <div key={i} className="flex flex-col items-center gap-2 lg:gap-4 relative z-10">
                        <motion.div 
                          initial={{ scale: 0.8, opacity: 0.5 }}
                          animate={{ scale: [0.8, 1.1, 1], opacity: [0.5, 1, 1] }}
                          transition={{ repeat: Infinity, repeatDelay: 4, duration: 0.5, delay: i * 0.8 }}
                          className="w-10 h-10 lg:w-20 lg:h-20 rounded-xl lg:rounded-[1.5rem] bg-surface-3 flex items-center justify-center text-primary border border-border shadow-sm"
                        >
                           <step.icon className="w-5 h-5 lg:w-10 lg:h-10" />
                        </motion.div>
                        <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">{step.label}</span>
                     </div>
                   ))}
                   {/* Connectors */}
                   <div className="absolute top-9 lg:top-[5.5rem] left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-border to-transparent -z-0 opacity-30" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════
         SECTION 3: HOW IT WORKS
         ═══════════════════════════════════════════════════ */}
      <section id="about" className="relative py-24 md:py-32 px-4 md:px-6 z-10 border-t border-border overflow-visible scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 md:mb-24"
          >
            <span className="text-primary font-bold tracking-[0.2em] text-xs uppercase mb-4 block underline decoration-primary/30 underline-offset-8">{tHow('label')}</span>
            <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter text-foreground">
              {tHow('title')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl font-medium leading-relaxed">
              {tHow('description')}
            </p>
            
            {/* Debug label - only visible in dev if needed */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 inline-block px-3 py-1 bg-primary/20 rounded-full text-[10px] font-bold text-primary">
                Active Step: {activeStep + 1}
              </div>
            )}
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Left Side: Steps with Timeline */}
            <div className="relative">
              {/* Vertical Timeline Line */}
              <div className="absolute left-6 md:left-8 top-12 bottom-12 w-0.5 bg-border z-0">
                 <motion.div 
                    className="absolute top-0 left-0 w-full bg-gradient-to-b from-primary via-blue-500 to-primary/20 shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                    style={{ 
                        height: activeStep === 0 ? "10%" : activeStep === 1 ? "50%" : "100%",
                        transition: "height 0.8s cubic-bezier(0.25, 1, 0.5, 1)"
                    }}
                 />
                 {/* Moving Pulse Dot */}
                 <motion.div 
                    className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_15px_rgba(139,92,246,0.8)] z-10"
                    animate={{ 
                        top: activeStep === 0 ? "10%" : activeStep === 1 ? "50%" : "95%",
                        opacity: [0.5, 1, 0.5]
                    }}
                    transition={{ 
                        top: { duration: 0.8, ease: "easeInOut" },
                        opacity: { duration: 2, repeat: Infinity }
                    }}
                 />
              </div>

              {/* Steps */}
              <div className="relative z-10">
                <StepItem 
                   index={0}
                   title={tHow('step1Title')}
                   description={tHow('step1Desc')}
                   icon={Instagram}
                   isActive={activeStep === 0}
                   onInView={() => setActiveStep(0)}
                />
                <StepItem 
                   index={1}
                   title={tHow('step2Title')}
                   description={tHow('step2Desc')}
                   icon={RefreshCcw}
                   isActive={activeStep === 1}
                   onInView={() => setActiveStep(1)}
                />
                <StepItem 
                   index={2}
                   title={tHow('step3Title')}
                   description={tHow('step3Desc')}
                   icon={Bot}
                   isActive={activeStep === 2}
                   onInView={() => setActiveStep(2)}
                />
              </div>

              {/* Final CTA in Step Column */}
              <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="pl-12 md:pl-20 mt-8 flex flex-wrap gap-4"
              >
                <Link
                  href="/register"
                  className="px-8 py-3.5 bg-primary text-primary-foreground font-bold rounded-full hover:scale-105 transition-all shadow-lg text-sm"
                >
                  {tHow('getStarted')}
                </Link>
                <button
                  onClick={() => setShowVideo(true)}
                  className="px-8 py-3.5 bg-surface-2 border border-border text-foreground font-bold rounded-full hover:bg-surface-3 transition-all text-sm"
                >
                  {tHow('watchDemo')}
                </button>
              </motion.div>
            </div>

            {/* Right Side: Sticky Preview Panel (Desktop Only) */}
            <div className="hidden lg:block lg:sticky lg:top-32 h-fit">
               <PreviewPanel step={activeStep} />
               
               {/* Connection Trails */}
               <div className="absolute -left-12 top-1/2 -translate-y-1/2 pointer-events-none">
                  {[...Array(3)].map((_, i) => (
                    <motion.div 
                      key={i}
                      className="h-px bg-gradient-to-r from-primary/30 to-transparent mb-8"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ 
                        width: activeStep === i ? 60 : 0,
                        opacity: activeStep === i ? 1 : 0
                      }}
                      transition={{ duration: 0.5 }}
                    />
                  ))}
               </div>
            </div>
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
              {tTest('title')}
            </h2>
            <p className="text-muted-foreground text-lg font-medium max-w-2xl mx-auto leading-relaxed">
              {tTest('description')}
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
                  {tTest('proofBar')}
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
              {tFaq('title')}
            </h2>
            <p className="text-muted-foreground text-lg font-medium">
              {tFaq('description')}
            </p>
          </motion.div>

          <div className="space-y-3">
            {[
              { q: tFaq('q1'), a: tFaq('a1') },
              { q: tFaq('q2'), a: tFaq('a2') },
              { q: tFaq('q3'), a: tFaq('a3') },
              { q: tFaq('q4'), a: tFaq('a4') },
              { q: tFaq('q5'), a: tFaq('a5') },
              { q: tFaq('q6'), a: tFaq('a6') },
              { q: tFaq('q7'), a: tFaq('a7') },
              { q: tFaq('q8'), a: tFaq('a8') },
              { q: tFaq('q9'), a: tFaq('a9') },
              { q: tFaq('q10'), a: tFaq('a10') },
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
                    {tCta('title')} <span className="text-primary">{tCta('sales')}</span> {tCta('and')} <span className="text-blue-500">{tCta('bookings')}</span>
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground mb-12 font-medium leading-relaxed">
                    {tCta('description')}
                </p>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
                    <Link
                        href="/register"
                        className="w-full sm:w-auto relative overflow-x-clip px-10 py-5 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-full hover:scale-[1.03] transition-all shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_50px_rgba(139,92,246,0.5)] text-sm"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            {tCta('getStarted')}
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
                        ▶ {tCta('watchDemo')}
                    </button>
                </div>

                {/* Trust Row */}
                <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3">
                    {[
                        tCta('noCreditCard'),
                        tCta('freePlan'),
                        tCta('cancelAnytime')
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
