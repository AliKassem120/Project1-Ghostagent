'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import GhostLogo from '@/components/GhostLogo';
import DemoVideoModal from '@/components/demo/DemoVideoModal';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Zap, Instagram, MessageCircle } from 'lucide-react';

/* ════════════════════════════════════════════════════
   CHAT MESSAGES — Multilingual DM Demo
   ════════════════════════════════════════════════════ */
const chatMessages = [
  { type: 'user', text: 'Hi! How does Ghost Agent work? Can it run on WhatsApp too?', delay: 0.5 },
  { type: 'bot', text: 'Hey! 👋 Yes! We automate both Instagram and WhatsApp 24/7. It syncs your live inventory, auto-books calendar meetings, and uses smart memory compression to remember past chats. Want to see our plans?', delay: 3.5 },
  { type: 'user', text: 'Yes, what do the Pro and Empire plans include?', delay: 9.0 },
  { type: 'bot', text: 'Pro ($49/mo) offers 1,000 replies/mo, Instagram + WhatsApp, auto-reply to comments, and live agent handoff. Empire ($149/mo) gives 10,000 replies across 3 brands. Ready to set it up?', delay: 12.0 },
  { type: 'user', text: "Pro is perfect, let's do it!", delay: 17.5 },
  { type: 'bot', text: 'Awesome! 🚀 I just sent you the setup link to connect your channels. Welcome aboard!', delay: 19.5 },
];

function PhoneMockup() {
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [showTyping, setShowTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const startCycle = () => {
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
    };

    startCycle();

    // Reset after full cycle
    const resetTimeout = setTimeout(() => {
      setVisibleMessages([]);
      setShowTyping(false);
      // Re-trigger after a pause
      const restartTimeout = setTimeout(() => {
        startCycle();
      }, 1000);
      timeouts.push(restartTimeout);
    }, 23000);
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
    <div className="phone-frame max-w-[280px] sm:max-w-[320px] mx-auto relative shadow-2xl" style={{ animation: 'float 6s ease-in-out infinite' }}>
      <div className="phone-notch" />
      <div className="phone-screen aspect-[9/19] h-[500px] sm:h-[580px] bg-background">
        {/* Instagram DM Header */}
        <div className="flex items-center gap-3 px-4 pt-10 pb-3 border-b border-border bg-surface-0/50 backdrop-blur-md z-10 relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
            <GhostLogo iconOnly className="w-4 h-4" />
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
                dir="ltr"
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

export default function HeroSection() {
  const [showVideo, setShowVideo] = useState(false);
  const tHero = useTranslations('Hero');

  return (
    <section className="relative min-h-[90dvh] lg:min-h-[100dvh] flex flex-col lg:flex-row items-center justify-center px-5 md:px-6 pt-24 md:pt-32 pb-16 max-w-7xl mx-auto gap-12 lg:gap-16 z-10">
      {/* Left: Copy */}
      <div className="flex-1 space-y-6 sm:space-y-8 text-center lg:text-left flex flex-col items-center lg:items-start w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full flex flex-col items-center lg:items-start"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-6 sm:mb-8 shadow-sm">
            <Zap className="w-3.5 h-3.5" />
            {tHero('badge')}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-[1.05] sm:leading-[0.95] mb-5 sm:mb-6 text-foreground">
            <span className="inline-block mb-1 sm:mb-2">{tHero('title1')}</span><br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-500 to-primary bg-[size:200%_100%] animate-[gradientShift_4s_ease_infinite]">
              {tHero('title2')}
            </span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg lg:text-[1.15rem] text-muted-foreground max-w-lg leading-relaxed font-medium">
            {tHero('description')}
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center lg:justify-start"
        >
          <Link
            href="/register"
            className="relative overflow-x-clip px-8 py-4 bg-primary text-primary-foreground font-bold rounded-full hover:scale-[1.03] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 group shadow-[0_0_25px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] min-h-[48px]"
          >
            <span className="relative z-10 flex items-center gap-2">
              {tHero('cta')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
              style={{ animation: 'shimmer 3s ease-in-out infinite' }}
            />
          </Link>
          
          <button
            onClick={() => setShowVideo(true)}
            className="px-8 py-4 bg-foreground/5 border border-border rounded-full hover:bg-foreground/10 active:bg-foreground/15 transition-colors backdrop-blur-md text-foreground font-semibold flex items-center justify-center gap-2 min-h-[48px]"
          >
            <span>▶</span> {tHero('watchDemo')}
          </button>
        </motion.div>

        {/* Subtle Metric Strip */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.5 }}
          className="text-xs font-semibold text-muted-foreground tracking-wide select-none"
        >
          2,000+ replies sent &bull; 500+ bookings automated &bull; 24/7 uptime
        </motion.p>

        {/* Multi-Platform Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-wrap items-center gap-3 sm:gap-4 justify-center lg:justify-start pt-2"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-1 border border-border shadow-sm">
            <Instagram className="w-4 h-4 text-pink-500" />
            <span className="text-xs font-semibold">{tHero('instagram')}</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 ml-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-500 text-[9px] font-bold uppercase tracking-wider">{tHero('live')}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-1 border border-border shadow-sm">
            <MessageCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs font-semibold">{tHero('whatsapp')}</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 ml-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-500 text-[9px] font-bold uppercase tracking-wider">{tHero('live')}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right: Phone Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.3, duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex-1 flex items-center justify-center relative w-full scale-90 sm:scale-100 lg:scale-100"
      >
        {/* Phone glow */}
        <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent blur-3xl opacity-60 dark:opacity-100" />
        <div className="w-full max-w-[280px] sm:max-w-none flex justify-center">
          <PhoneMockup />
        </div>
      </motion.div>

      {/* Video Modal */}
      <DemoVideoModal
        isOpen={showVideo}
        onClose={() => setShowVideo(false)}
        videoSrc="/demo/ghostagent-demo.webm"
        posterSrc="/demo/ghostagent-demo-poster.png"
      />
    </section>
  );
}
