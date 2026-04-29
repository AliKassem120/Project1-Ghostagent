'use client';

import { motion, Variants } from 'framer-motion';
import { ArrowRight, MessageCircle, Clock, Zap, Target, ShieldCheck, HeartHandshake, Box, CalendarDays, CheckCircle2, ChevronRight, MessageSquare, Briefcase } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StarBackground from '@/components/StarBackground';
import DemoVideoModal from '@/components/demo/DemoVideoModal';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

// Animations
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

export default function AboutPage() {
  const [showVideo, setShowVideo] = useState(false);
  const t = useTranslations('About');
  const tNavbar = useTranslations('Navbar');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-[100dvh] bg-background text-foreground overflow-x-clip relative selection:bg-primary/30">
      <Navbar />

      {/* Background Layers */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"
          style={{ maskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, #000 70%, transparent 100%)' }}
        />
        <StarBackground />
      </div>

      {/* 1. HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4 md:px-6 max-w-7xl mx-auto z-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        <motion.div 
          className="flex-1 text-center lg:text-left"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-6">
            <MessageSquare className="w-4 h-4" /> {t('badge')}
          </motion.div>
          
          <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.05] mb-6 whitespace-pre-line">
            {t('title')}
          </motion.h1>
          
          <motion.p variants={fadeInUp} className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium mb-10">
            {t('desc')}
          </motion.p>
          
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <Link
              href="/register"
              className="w-full sm:w-auto relative overflow-x-clip px-8 py-4 bg-primary text-primary-foreground font-bold rounded-full hover:scale-[1.03] transition-transform flex items-center justify-center gap-2 group shadow-[0_0_25px_rgba(139,92,246,0.3)]"
            >
              {tNavbar('getStarted')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              onClick={() => setShowVideo(true)}
              className="w-full sm:w-auto px-8 py-4 bg-surface-2 border border-border rounded-full hover:bg-surface-3 transition-colors text-foreground font-semibold flex items-center justify-center gap-2"
            >
              <span>▶</span> Watch Demo
            </button>
          </motion.div>
        </motion.div>

        {/* Hero Visual: Mockup Graphic */}
        <motion.div 
          className="flex-1 w-full max-w-lg lg:max-w-none relative"
          initial={{ opacity: 0, scale: 0.9, rotateY: 15 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full -z-10" />
          <div className="glass-frosted rounded-3xl border border-border shadow-2xl p-6 bg-surface-1/50 overflow-hidden relative">
             <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <div className="ml-2 font-mono text-xs text-muted-foreground">ghostagent_dashboard</div>
             </div>
             <div className="space-y-4">
                 <div className="bg-surface-2 p-4 rounded-xl border border-border max-w-[80%] mr-auto animate-pulse">
                     <div className="h-4 bg-surface-3 rounded w-3/4 mb-2" />
                     <div className="h-4 bg-surface-3 rounded w-1/2" />
                 </div>
                 <div className="bg-primary/20 border border-primary/30 p-4 rounded-xl max-w-[85%] ml-auto flex flex-col gap-3">
                     <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
                         <Zap className="w-4 h-4" /> Checked Inventory
                     </div>
                     <div className="h-4 bg-primary/40 rounded w-full" />
                     <div className="h-4 bg-primary/40 rounded w-2/3" />
                 </div>
             </div>
          </div>
        </motion.div>
      </section>

      {/* 2. MISSION SECTION */}
      <section className="py-24 px-4 md:px-6 relative z-10 border-t border-border/50 bg-surface-0/30">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            className="text-3xl md:text-5xl font-bold tracking-tight mb-8"
          >
            {t('missionTitle')} <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">{t('missionHighlight')}</span>
          </motion.h2>
          <motion.p 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            className="text-lg md:text-2xl text-muted-foreground leading-relaxed font-medium"
          >
            {t('missionDesc')}
          </motion.p>
        </div>
      </section>

      {/* 3. PROBLEM SECTION */}
      <section className="py-24 px-4 md:px-6 max-w-7xl mx-auto relative z-10">
        <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
        >
            {[
                { icon: Clock, title: t('p1Title'), desc: t('p1Desc') },
                { icon: MessageCircle, title: t('p2Title'), desc: t('p2Desc') },
                { icon: ShieldCheck, title: t('p3Title'), desc: t('p3Desc') }
            ].map((item, i) => (
                <motion.div key={i} variants={fadeInUp} className="bg-surface-1/50 border border-border p-8 rounded-3xl flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-primary mb-2 shadow-sm">
                        <item.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="text-muted-foreground font-medium">{item.desc}</p>
                </motion.div>
            ))}
        </motion.div>
      </section>

      {/* 4. WHAT MAKES IT DIFFERENT */}
      <section className="py-24 px-4 md:px-6 relative z-10 border-t border-border/50 bg-gradient-to-b from-surface-0 to-background">
        <div className="max-w-7xl mx-auto">
            <div className="mb-16">
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">{t('diffTitle')}</h2>
                <p className="text-xl text-muted-foreground max-w-3xl">{t('diffDesc')}</p>
            </div>
            
            <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
            >
                {[
                    { icon: MessageSquare, title: t('d1Title'), desc: t('d1Desc') },
                    { icon: Box, title: t('d2Title'), desc: t('d2Desc') },
                    { icon: CalendarDays, title: t('d3Title'), desc: t('d3Desc') },
                    { icon: HeartHandshake, title: t('d4Title'), desc: t('d4Desc') }
                ].map((item, i) => (
                    <motion.div key={i} variants={fadeInUp} className="group glass-frosted bg-surface-1/60 border border-border p-8 rounded-3xl flex items-start gap-6 hover:border-primary/40 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                            <item.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                            <p className="text-muted-foreground">{item.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
      </section>

      {/* 5. FOUNDER NOTE */}
      <section className="py-24 px-4 md:px-6 relative z-10">
          <div className="max-w-4xl mx-auto">
              <motion.div 
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
                  className="glass-frosted border border-border p-8 md:p-12 rounded-[2.5rem] relative overflow-hidden"
              >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
                  
                  <div className="flex items-center gap-4 mb-8 relative z-10">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg border border-white/10 shrink-0">
                          <span className="text-white font-bold tracking-widest text-lg">AK</span>
                      </div>
                      <div>
                          <h2 className="text-2xl font-bold">{t('founderNote')}</h2>
                      </div>
                  </div>

                  <div className="relative z-10 text-lg md:text-xl text-foreground/90 font-medium leading-relaxed italic space-y-6">
                      <p>
                        {t('founderP1')}
                      </p>
                      <p>
                        {t('founderP2')}
                      </p>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-border/50 relative z-10">
                      <p className="font-bold text-primary">{t('founderName')}</p>
                  </div>
              </motion.div>
          </div>
      </section>

      {/* 6. WHO IT IS FOR */}
      <section className="py-24 px-4 md:px-6 relative z-10 bg-surface-0/30 border-t border-border/50">
          <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{t('whoTitle')}</h2>
                  <p className="text-xl text-muted-foreground">{t('whoDesc')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                  <motion.div 
                      initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                      className="bg-surface-1/50 border border-border p-10 rounded-3xl"
                  >
                      <div className="flex items-center gap-3 mb-8">
                          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500"><Box className="w-6 h-6" /></div>
                          <h3 className="text-2xl font-bold">{t('ecomTitle')}</h3>
                      </div>
                      <ul className="space-y-4">
                          {[t('ecom1'), t('ecom2'), t('ecom3'), t('ecom4'), t('ecom5')].map((item, i) => (
                              <li key={i} className="flex items-center gap-3 text-lg font-medium">
                                  <CheckCircle2 className="w-5 h-5 text-blue-500" /> {item}
                              </li>
                          ))}
                      </ul>
                  </motion.div>

                  <motion.div 
                      initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                      className="bg-surface-1/50 border border-border p-10 rounded-3xl"
                  >
                      <div className="flex items-center gap-3 mb-8">
                          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500"><CalendarDays className="w-6 h-6" /></div>
                          <h3 className="text-2xl font-bold">{t('apptTitle')}</h3>
                      </div>
                      <ul className="space-y-4">
                          {[t('appt1'), t('appt2'), t('appt3'), t('appt4'), t('appt5'), t('appt6')].map((item, i) => (
                              <li key={i} className="flex items-center gap-3 text-lg font-medium">
                                  <CheckCircle2 className="w-5 h-5 text-rose-500" /> {item}
                              </li>
                          ))}
                      </ul>
                  </motion.div>
              </div>
          </div>
      </section>

      {/* 7. VALUES SECTION */}
      <section className="py-24 px-4 md:px-6 relative z-10">
          <div className="max-w-7xl mx-auto">
              <motion.div 
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
              >
                  {[
                      { title: t('val1Title'), desc: t('val1Desc') },
                      { title: t('val2Title'), desc: t('val2Desc') },
                      { title: t('val3Title'), desc: t('val3Desc') },
                      { title: t('val4Title'), desc: t('val4Desc') }
                  ].map((item, i) => (
                      <motion.div key={i} variants={fadeInUp} className="text-center p-6">
                          <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center text-primary mx-auto mb-4 shadow-sm">
                              <Target className="w-6 h-6" />
                          </div>
                          <h4 className="text-lg font-bold mb-2">{item.title}</h4>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </motion.div>
                  ))}
              </motion.div>
          </div>
      </section>

      {/* 8. FINAL CTA */}
      <section className="py-32 px-4 md:px-6 relative z-10 border-t border-border bg-gradient-to-t from-primary/10 to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black tracking-tight mb-6"
          >
            {t('ctaTitle')}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            {t('ctaDesc')}
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/register"
              className="w-full sm:w-auto px-10 py-5 bg-primary text-white font-bold rounded-full hover:scale-105 transition-transform flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.4)]"
            >
              {tNavbar('getStarted')}
            </Link>
            <Link
              href="/contact"
              className="w-full sm:w-auto px-10 py-5 bg-surface-2 border border-border text-foreground font-bold rounded-full hover:bg-surface-3 transition-colors flex items-center justify-center"
            >
              {t('contactUs')}
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
      
      <DemoVideoModal
        isOpen={showVideo}
        onClose={() => setShowVideo(false)}
        videoSrc="/demo/ghostagent-demo.webm"
        posterSrc="/demo/ghostagent-demo-poster.png"
      />
    </main>
  );
}
