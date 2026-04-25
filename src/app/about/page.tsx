'use client';

import { motion, Variants } from 'framer-motion';
import { ArrowRight, MessageCircle, Clock, Zap, Target, ShieldCheck, HeartHandshake, Box, CalendarDays, CheckCircle2, ChevronRight, MessageSquare, Briefcase } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StarBackground from '@/components/StarBackground';
import DemoVideoModal from '@/components/demo/DemoVideoModal';
import { useState, useEffect } from 'react';

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
            <MessageSquare className="w-4 h-4" /> The AI Business Agent
          </motion.div>
          
          <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.05] mb-6">
            Built for businesses<br />that run on DMs.
          </motion.h1>
          
          <motion.p variants={fadeInUp} className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium mb-10">
            GhostAgent was created for the stores, salons, clinics, studios, and local brands losing sales because customer messages move faster than humans can reply.
          </motion.p>
          
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <Link
              href="/register"
              className="w-full sm:w-auto relative overflow-x-clip px-8 py-4 bg-primary text-primary-foreground font-bold rounded-full hover:scale-[1.03] transition-transform flex items-center justify-center gap-2 group shadow-[0_0_25px_rgba(139,92,246,0.3)]"
            >
              Get Started Free
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
            Our mission is simple: <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">turn missed messages into revenue.</span>
          </motion.h2>
          <motion.p 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            className="text-lg md:text-2xl text-muted-foreground leading-relaxed font-medium"
          >
            Most small businesses do not need another complicated CRM. They need someone to answer customers instantly, check the right information, and help close the sale or booking. GhostAgent gives every business a reliable AI assistant that works inside the conversations they already use.
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
                { icon: Clock, title: "Customers message after hours", desc: "Buyers expect instant answers at 2 AM. If you are asleep, they go to a competitor." },
                { icon: MessageCircle, title: "Owners miss replies while working", desc: "You are busy fulfilling orders or serving clients, leaving new leads waiting in the inbox." },
                { icon: ShieldCheck, title: "Generic chatbots guess", desc: "Basic bots hallucinate answers instead of checking real inventory or calendar data." }
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
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Why GhostAgent is different</h2>
                <p className="text-xl text-muted-foreground max-w-3xl">GhostAgent is not just a chatbot. It is a workflow system that connects AI replies with business logic like inventory, services, calendar availability, and checkout details.</p>
            </div>
            
            <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
            >
                {[
                    { icon: MessageSquare, title: "Built for Instagram DMs", desc: "Sits exactly where your customers already are. No apps to download, no links to click." },
                    { icon: Box, title: "Checks live business data", desc: "Connects to your real inventory. It never promises a product that is out of stock." },
                    { icon: CalendarDays, title: "Handles orders & appointments", desc: "Actually drives conversions. Collects names, phones, addresses, and secures the booking." },
                    { icon: HeartHandshake, title: "Speaks naturally in multiple languages", desc: "Fluently switches between Arabic, English, and French without sounding like a robot." }
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
                          <h2 className="text-2xl font-bold">A note from the founder</h2>
                      </div>
                  </div>

                  <div className="relative z-10 text-lg md:text-xl text-foreground/90 font-medium leading-relaxed italic space-y-6">
                      <p>
                        “I built GhostAgent after seeing how many businesses lose customers simply because they cannot reply fast enough.
                      </p>
                      <p>
                        The goal is not to replace the human side of business — it is to protect it. GhostAgent handles the repetitive messages, checks the facts, and keeps conversations moving so owners can focus on the work only they can do.”
                      </p>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-border/50 relative z-10">
                      <p className="font-bold text-primary">— Ali, Founder of GhostAgent</p>
                  </div>
              </motion.div>
          </div>
      </section>

      {/* 6. WHO IT IS FOR */}
      <section className="py-24 px-4 md:px-6 relative z-10 bg-surface-0/30 border-t border-border/50">
          <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Who uses GhostAgent?</h2>
                  <p className="text-xl text-muted-foreground">The ultimate tool for the DM-first economy.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                  <motion.div 
                      initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                      className="bg-surface-1/50 border border-border p-10 rounded-3xl"
                  >
                      <div className="flex items-center gap-3 mb-8">
                          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500"><Box className="w-6 h-6" /></div>
                          <h3 className="text-2xl font-bold">E-Commerce</h3>
                      </div>
                      <ul className="space-y-4">
                          {["Clothing stores", "Beauty products", "Accessories", "Local online shops", "Instagram sellers"].map((item, i) => (
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
                          <h3 className="text-2xl font-bold">Services & Appointments</h3>
                      </div>
                      <ul className="space-y-4">
                          {["Salons", "Clinics", "Barbers", "Makeup artists", "Studios", "Consultants"].map((item, i) => (
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
                      { title: "Accuracy over guessing", desc: "Deterministic routing ensures we never hallucinate prices or stock." },
                      { title: "Automation with control", desc: "You set the rules, inventory, and hours. The AI strictly follows them." },
                      { title: "Fast replies, human tone", desc: "Professional, warm, and instantaneous responses 24/7." },
                      { title: "Built for real businesses", desc: "Focused purely on driving revenue and completing bookings." }
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
            Ready to stop missing customers in your DMs?
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            Launch your AI business agent and let GhostAgent handle replies, orders, and appointments around the clock.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/register"
              className="w-full sm:w-auto px-10 py-5 bg-primary text-white font-bold rounded-full hover:scale-105 transition-transform flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.4)]"
            >
              Get Started Free
            </Link>
            <Link
              href="/contact"
              className="w-full sm:w-auto px-10 py-5 bg-surface-2 border border-border text-foreground font-bold rounded-full hover:bg-surface-3 transition-colors flex items-center justify-center"
            >
              Contact Us
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
