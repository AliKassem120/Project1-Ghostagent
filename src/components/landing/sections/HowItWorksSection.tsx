'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Instagram, RefreshCcw, Bot, Check, ShoppingBag, Calendar, Shield, Zap, CheckCircle2 } from 'lucide-react';
import DemoVideoModal from '@/components/demo/DemoVideoModal';
import clsx from 'clsx';

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

function PreviewPanel({ step }: { step: number }) {
  const isMobile = useIsMobile();
  const tHow = useTranslations('HowItWorks');

  return (
    <div className={clsx("w-full h-full relative flex items-center justify-center", isMobile ? "min-h-[260px] py-4" : "min-h-[500px]")}>
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="w-full max-w-sm aspect-square glass-frosted rounded-[2rem] p-6 border border-border shadow-2xl flex flex-col items-center justify-center gap-6"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-surface-2 border border-border flex items-center justify-center shadow-inner">
                <Instagram className="w-10 h-10 text-pink-500" />
              </div>
              <motion.div 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-green-500 border-4 border-surface-1 flex items-center justify-center shadow-lg"
              >
                <Check className="w-4 h-4 text-white stroke-[3px]" />
              </motion.div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-bold text-foreground">{tHow('instagramConnected')}</p>
              <p className="text-xs text-muted-foreground">{tHow('isLive')}</p>
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
            className="w-full max-w-sm aspect-square glass-frosted rounded-[2rem] p-6 border border-border shadow-2xl flex flex-col gap-5"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{tHow('workspaceSetup')}</span>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="w-1.5 h-1.5 rounded-full bg-surface-3" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex flex-col gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider">E-Commerce</span>
                <div className="w-full h-1 bg-primary rounded-full" />
              </div>
              <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-col gap-2 opacity-50">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{tHow('services')}</span>
                <div className="w-full h-1 bg-border rounded-full" />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {[
                { label: tHow('inventorySynced'), icon: RefreshCcw },
                { label: tHow('brandTone'), icon: Bot },
                { label: tHow('salesRulesActive'), icon: Shield }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + (i * 0.1) }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2/50 border border-border/50"
                >
                  <item.icon className="w-3.5 h-3.5 text-primary" />
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
            className="w-full max-w-sm aspect-square glass-frosted rounded-[2rem] p-6 border border-border shadow-2xl flex flex-col"
          >
            <div className="flex-1 flex flex-col gap-3 overflow-hidden pt-2">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-surface-3 p-3 rounded-xl rounded-bl-sm self-start max-w-[80%] text-xs font-medium border border-border/50"
              >
                Is the blue hoodie in XL available? 👕
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.5 }}
                className="bg-primary text-white p-3 rounded-xl rounded-br-sm self-end max-w-[80%] text-xs font-semibold shadow-md"
              >
                Checking... Yes! We have 3 left in XL. Want the checkout link?
              </motion.div>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{tHow('livePerformance')}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-primary">1,248</span>
                  <span className="text-[9px] font-bold text-green-500">+12%</span>
                </div>
              </div>
              <div className="w-24 h-8 bg-surface-2 rounded-lg border border-border relative overflow-hidden flex items-end">
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
      <motion.div 
        className="absolute top-0 h-full w-full pointer-events-none"
        viewport={{ 
          once: false, 
          amount: 0.1,
          margin: isMobile ? "-45% 0px -45% 0px" : "-40% 0px -40% 0px" 
        }}
        onViewportEnter={onInView}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={clsx(
          "relative pl-12 md:pl-20 py-8 md:py-12 transition-all duration-500",
          isMobile && "min-h-[220px] flex flex-col justify-center",
          isActive ? "opacity-100 scale-100" : "opacity-40 scale-[0.98]"
        )}
      >
        {/* Icon Container */}
        <div className="absolute left-0 top-4 md:top-8 z-20">
          <div className={clsx(
            "w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-500 border shadow-lg",
            isActive 
              ? "bg-primary border-primary/50 shadow-primary/20 scale-110" 
              : "bg-surface-2 border-border shadow-black/20"
          )}>
            <Icon className={clsx(
              "w-5 h-5 md:w-8 h-8 transition-colors duration-500",
              isActive ? "text-white" : "text-muted-foreground"
            )} />
          </div>
        </div>

        <div className="space-y-2.5">
          <span className={clsx(
            "text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-500",
            isActive ? "text-primary" : "text-muted-foreground"
          )}>
            Step 0{index + 1}
          </span>
          <h3 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">{title}</h3>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground font-medium leading-relaxed max-w-md">
            {description}
          </p>
        </div>

        {/* Mobile Preview - Only visible on small screens when active to avoid layout shift */}
        {isActive && isMobile && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="lg:hidden mt-6 overflow-hidden"
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

export default function HowItWorksSection() {
  const [showVideo, setShowVideo] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const tHow = useTranslations('HowItWorks');

  return (
    <section id="about" className="relative py-16 md:py-24 px-5 md:px-6 z-10 border-t border-border overflow-visible scroll-mt-24">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 md:mb-16"
        >
          <span className="text-primary font-bold tracking-[0.2em] text-xs uppercase mb-3 block underline decoration-primary/30 underline-offset-8">
            {tHow('label')}
          </span>
          <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter text-foreground">
            {tHow('title')}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
            {tHow('description')}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 items-start">
          {/* Left Side: Steps with Timeline */}
          <div className="relative">
            {/* Vertical Timeline Line */}
            <div className="absolute left-5 md:left-8 top-8 bottom-8 w-0.5 bg-border z-0">
              <motion.div 
                className="absolute top-0 left-0 w-full bg-gradient-to-b from-primary via-blue-500 to-primary/20 shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                style={{ 
                  height: activeStep === 0 ? "10%" : activeStep === 1 ? "50%" : "100%",
                  transition: "height 0.8s cubic-bezier(0.25, 1, 0.5, 1)"
                }}
              />
              <motion.div 
                className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_15px_rgba(139,92,246,0.8)] z-10"
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

            {/* Final CTA Buttons inside Step Column */}
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="pl-12 md:pl-20 mt-8 flex flex-col sm:flex-row gap-4"
            >
              <Link
                href="/register"
                className="px-8 py-3.5 bg-primary text-primary-foreground font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg text-sm text-center min-h-[48px] flex items-center justify-center"
              >
                {tHow('getStarted')}
              </Link>
              <button
                onClick={() => setShowVideo(true)}
                className="px-8 py-3.5 bg-surface-2 border border-border text-foreground font-bold rounded-full hover:bg-surface-3 active:bg-surface-4 transition-all text-sm text-center min-h-[48px] flex items-center justify-center"
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

      {/* Demo Video Modal */}
      <DemoVideoModal
        isOpen={showVideo}
        onClose={() => setShowVideo(false)}
        videoSrc="/demo/ghostagent-demo.webm"
        posterSrc="/demo/ghostagent-demo-poster.png"
      />
    </section>
  );
}
