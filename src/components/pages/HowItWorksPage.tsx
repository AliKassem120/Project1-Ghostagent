'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import GhostLogo from '@/components/GhostLogo';
import { Link } from '@/i18n/navigation';
import { 
  ArrowRight, 
  MessageCircle, 
  ShoppingBag, 
  Calendar, 
  CheckCircle2, 
  Database,
  Shield,
  Code2,
  BrainCircuit,
  Bot,
  Smartphone,
  Megaphone,
  RefreshCw,
  Instagram
} from 'lucide-react';
import clsx from 'clsx';

export default function HowItWorksPage() {
  const [activeFlowStep, setActiveFlowStep] = useState(0);

  // Auto-play message flow
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFlowStep((prev) => (prev + 1) % 6);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

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

      <Navbar />

      <div className="relative z-10 pt-32 pb-24 px-4 md:px-6">
        <div className="max-w-7xl mx-auto space-y-32">
          {/* HERO SECTION */}
          <section className="text-center space-y-8 max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-6">
                How GhostAgent Works
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto">
                From customer message to smart reply — GhostAgent helps businesses handle Instagram and WhatsApp conversations automatically, accurately, and professionally.
              </p>
            </motion.div>
          </section>

          {/* 3-STEP OVERVIEW */}
          <section>
            <div className="grid md:grid-cols-3 gap-6">
               <motion.div 
                 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                 className="bento-card flex flex-col items-center text-center gap-4"
               >
                 <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                   <MessageCircle className="w-8 h-8 text-primary" />
                 </div>
                 <h3 className="text-xl font-bold">1. Connect</h3>
                 <p className="text-muted-foreground font-medium">Connect Instagram or WhatsApp and set up your business in minutes.</p>
               </motion.div>
               <motion.div 
                 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                 className="bento-card flex flex-col items-center text-center gap-4"
               >
                 <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                   <BrainCircuit className="w-8 h-8 text-blue-500" />
                 </div>
                 <h3 className="text-xl font-bold">2. Configure</h3>
                 <p className="text-muted-foreground font-medium">Add products or services, choose your AI tone, and define response rules.</p>
               </motion.div>
               <motion.div 
                 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                 className="bento-card flex flex-col items-center text-center gap-4"
               >
                 <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
                   <Bot className="w-8 h-8 text-green-500" />
                 </div>
                 <h3 className="text-xl font-bold">3. Automate</h3>
                 <p className="text-muted-foreground font-medium">GhostAgent answers questions, captures orders, and books appointments 24/7.</p>
               </motion.div>
            </div>
          </section>
          {/* THE CORE PRINCIPLE */}
          <section className="space-y-12">
            <div className="text-center">
              <h2 className="text-3xl md:text-5xl font-black mb-6">The Brain Behind GhostAgent</h2>
              <p className="text-muted-foreground font-medium max-w-2xl mx-auto text-lg">
                We built GhostAgent on a strict architecture to ensure reliability. It never guesses inventory or makes up prices.
              </p>
            </div>

            <div className="glass-frosted rounded-[2.5rem] p-8 md:p-12 overflow-hidden relative">
              <div className="grid md:grid-cols-4 gap-8 relative z-10">
                {[
                  { icon: MessageCircle, title: "LLM Understands", desc: "The AI understands customer intent, even with messy wording, Arabizi, or mixed-language messages." },
                  { icon: Code2, title: "Code Acts", desc: "GhostAgent uses reliable business logic to decide what should happen next based on your setup." },
                  { icon: Database, title: "Database Proves", desc: "Orders and appointments are only confirmed when the system actually saves them." },
                  { icon: Shield, title: "Guard Protects", desc: "A final safety layer prevents false confirmations or misleading replies from ever reaching the customer." }
                ].map((step, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                    className="relative text-center flex flex-col items-center gap-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-surface-2 border border-border flex items-center justify-center mb-2 z-10 relative shadow-sm">
                      <step.icon className="w-8 h-8 text-primary" />
                    </div>
                    <h4 className="font-bold text-lg">{step.title}</h4>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                    
                    {/* Connector line */}
                    {idx < 3 && (
                      <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-border/50 -z-10">
                        <motion.div 
                          className="h-full bg-primary/30"
                          initial={{ width: 0 }} whileInView={{ width: "100%" }} transition={{ duration: 1, delay: 0.5 + (idx * 0.2) }}
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* MESSAGE FLOW */}
          <section className="space-y-12">
            <div className="text-center">
              <h2 className="text-3xl md:text-5xl font-black mb-6">The Message Flow</h2>
              <p className="text-muted-foreground font-medium max-w-2xl mx-auto text-lg">
                Every customer message goes through a strict pipeline before GhostAgent replies.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* STEPS LIST */}
              <div className="space-y-4 order-2 lg:order-1">
                {[
                  { step: "01", title: "Message Received", desc: "Customer sends a DM on Instagram or WhatsApp." },
                  { step: "02", title: "Context Loaded", desc: "System checks the conversation history and workspace rules." },
                  { step: "03", title: "Intent Understood", desc: "The classifier detects if it's a greeting, product question, or order cancellation." },
                  { step: "04", title: "Action Selected", desc: "The correct business logic handles the request." },
                  { step: "05", title: "Result Verified", desc: "Database confirms the stock exists or the calendar is open." },
                  { step: "06", title: "Reply Sent", desc: "A natural, accurate response is sent to the customer." }
                ].map((flow, idx) => {
                  const isActive = activeFlowStep === idx;
                  return (
                    <motion.div 
                      key={idx}
                      onClick={() => setActiveFlowStep(idx)}
                      initial={{ opacity: 0, x: -20 }} 
                      whileInView={{ opacity: 1, x: 0 }} 
                      viewport={{ once: true }} 
                      transition={{ delay: idx * 0.1 }}
                      className={clsx(
                        "flex items-center gap-4 md:gap-6 rounded-2xl p-4 cursor-pointer transition-all duration-300",
                        isActive 
                          ? "bg-surface-2 border-primary/50 border shadow-[0_0_30px_rgba(139,92,246,0.1)] md:scale-[1.02]" 
                          : "bg-surface-1 border border-border hover:border-primary/30 opacity-70 hover:opacity-100"
                      )}
                    >
                      <div className={clsx(
                        "text-xl md:text-2xl font-black shrink-0 w-8 md:w-12 transition-colors",
                        isActive ? "text-primary" : "text-primary/20"
                      )}>
                        {flow.step}
                      </div>
                      <div className="flex-1">
                        <h4 className={clsx(
                          "font-bold text-base md:text-lg transition-colors",
                          isActive ? "text-primary" : "text-foreground"
                        )}>
                          {flow.title}
                        </h4>
                        <p className="text-xs md:text-sm text-muted-foreground font-medium">{flow.desc}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* DYNAMIC VISUALIZER */}
              <div className="order-1 lg:order-2 bg-surface-1 border border-border rounded-[2.5rem] p-8 aspect-square md:aspect-video lg:aspect-square flex flex-col items-center justify-center relative overflow-hidden shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFlowStep}
                    initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center text-center gap-6 z-10"
                  >
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-surface-2 border border-border flex items-center justify-center shadow-[0_0_50px_rgba(139,92,246,0.15)] relative">
                      {activeFlowStep === 0 && <MessageCircle className="w-12 h-12 md:w-16 md:h-16 text-blue-500" />}
                      {activeFlowStep === 1 && <Database className="w-12 h-12 md:w-16 md:h-16 text-purple-500" />}
                      {activeFlowStep === 2 && <BrainCircuit className="w-12 h-12 md:w-16 md:h-16 text-pink-500" />}
                      {activeFlowStep === 3 && <Code2 className="w-12 h-12 md:w-16 md:h-16 text-orange-500" />}
                      {activeFlowStep === 4 && <Shield className="w-12 h-12 md:w-16 md:h-16 text-green-500" />}
                      {activeFlowStep === 5 && <Bot className="w-12 h-12 md:w-16 md:h-16 text-primary" />}
                      
                      {/* Pulse Ring */}
                      <motion.div 
                        className="absolute inset-0 rounded-full border-2 border-primary/30"
                        animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-black tracking-widest uppercase text-primary/50 mb-2">Step 0{activeFlowStep + 1}</div>
                      <div className="text-xl md:text-2xl font-bold text-foreground">
                        {
                          ["Message Received", "Context Loaded", "Intent Understood", "Action Selected", "Result Verified", "Reply Sent"][activeFlowStep]
                        }
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </section>
          {/* ECOMMERCE WORKFLOW */}
          <section className="pt-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full text-xs font-bold uppercase tracking-widest">
                  <ShoppingBag className="w-3.5 h-3.5" /> Built for Ecommerce
                </div>
                <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Never miss a sale in the DMs.
                </h3>
                <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                  GhostAgent handles the entire checkout flow directly inside the conversation, checking live inventory and confirming orders.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  {[
                    "Answers product questions",
                    "Checks live availability",
                    "Handles variants (size/color)",
                    "Collects name & address",
                    "Captures the order",
                    "Handles cash on delivery"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="text-sm font-semibold">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Ecommerce Chat Demo */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                className="bg-surface-1 border border-border rounded-[2rem] p-6 shadow-xl"
              >
                <div className="flex flex-col gap-4 max-w-sm mx-auto">
                  <div className="chat-bubble chat-bubble-user">Do you have the crewneck?</div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.5 }} className="chat-bubble chat-bubble-bot">Yes — it's available for $25. Want one?</motion.div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 1 }} className="chat-bubble chat-bubble-user">Yes</motion.div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 1.5 }} className="chat-bubble chat-bubble-bot">Please send your name, phone number, and address.</motion.div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 2 }} className="chat-bubble chat-bubble-user">Sarah, 03 123456, Beirut Gemmayze</motion.div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 2.5 }} className="chat-bubble chat-bubble-bot">Perfect — confirm your order?</motion.div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 3 }} className="chat-bubble chat-bubble-user">Yes</motion.div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 3.5 }} className="chat-bubble chat-bubble-bot border-green-500/30 bg-green-500/5">Order confirmed! Your total is $25 on delivery.</motion.div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* APPOINTMENTS WORKFLOW */}
          <section className="pt-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Appointment Chat Demo */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                className="bg-surface-1 border border-border rounded-[2rem] p-6 shadow-xl order-2 lg:order-1"
              >
                <div className="flex flex-col gap-4 max-w-sm mx-auto">
                  <div className="chat-bubble chat-bubble-user">I want to book an appointment</div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.5 }} className="chat-bubble chat-bubble-bot">Sure! What service would you like to book?</motion.div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 1 }} className="chat-bubble chat-bubble-user">Haircut tomorrow</motion.div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 1.5 }} className="chat-bubble chat-bubble-bot">I have openings tomorrow at 2:00 PM or 4:00 PM. What works best?</motion.div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 2 }} className="chat-bubble chat-bubble-user">2 PM please</motion.div>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 2.5 }} className="chat-bubble chat-bubble-bot border-green-500/30 bg-green-500/5">Haircut confirmed for tomorrow at 2:00 PM. See you then!</motion.div>
                </div>
              </motion.div>

              <div className="space-y-6 order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full text-xs font-bold uppercase tracking-widest">
                  <Calendar className="w-3.5 h-3.5" /> Perfect for Services
                </div>
                <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Your automated receptionist.
                </h3>
                <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                  GhostAgent checks your calendar, finds available slots, and secures bookings without double-booking.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  {[
                    "Answers service questions",
                    "Checks live calendar availability",
                    "Secures booking slots",
                    "Handles rescheduling",
                    "Manages cancellations",
                    "Collects customer details"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
                      <span className="text-sm font-semibold">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* WHATSAPP PREMIUM FEATURES */}
          <section className="space-y-12 pt-12">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-xs font-bold tracking-wide mb-6 shadow-sm uppercase">
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp Features
              </div>
              <h2 className="text-3xl md:text-5xl font-black mb-6">WhatsApp Premium Features</h2>
              <p className="text-muted-foreground font-medium max-w-2xl mx-auto text-lg">
                Go beyond basic messaging. GhostAgent brings native flows, marketing broadcasts, and smart fallback logic to WhatsApp.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* WhatsApp Native Booking Flows */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="bg-surface-1 border border-border rounded-[2rem] p-8 flex flex-col gap-4 hover:border-emerald-500/30 transition-colors group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <Smartphone className="w-7 h-7 text-emerald-500" />
                  </div>
                  <h4 className="font-bold text-lg">Native Booking Flows</h4>
                  <p className="text-sm text-muted-foreground font-medium">Collect appointments and orders with native popup forms inside WhatsApp — no links, no redirects. Customers fill structured forms without leaving the chat.</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {['V3 Flows', 'In-Chat Forms', 'Zero Friction'].map((tag) => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-500 uppercase tracking-wider">{tag}</span>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Marketing Broadcasts */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                className="bg-surface-1 border border-border rounded-[2rem] p-8 flex flex-col gap-4 hover:border-violet-500/30 transition-colors group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                    <Megaphone className="w-7 h-7 text-violet-500" />
                  </div>
                  <h4 className="font-bold text-lg">Marketing Broadcasts</h4>
                  <p className="text-sm text-muted-foreground font-medium">Send targeted promotional blasts to your WhatsApp customer base. Launch campaigns, announce sales, and re-engage past buyers with approved templates.</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {['Promo Blasts', 'Approved Templates', 'Re-engage'].map((tag) => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] font-black text-violet-500 uppercase tracking-wider">{tag}</span>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Smart Fallback Logic */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                className="bg-surface-1 border border-border rounded-[2rem] p-8 flex flex-col gap-4 hover:border-orange-500/30 transition-colors group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                    <RefreshCw className="w-7 h-7 text-orange-500" />
                  </div>
                  <h4 className="font-bold text-lg">Smart Fallback Logic</h4>
                  <p className="text-sm text-muted-foreground font-medium">If WhatsApp delivery fails, GhostAgent auto-retries with draft mode and alerts the manager. No message is ever silently lost — your business stays responsive.</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {['Auto-Retry', 'Draft Mode', 'Manager Alerts'].map((tag) => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[10px] font-black text-orange-500 uppercase tracking-wider">{tag}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* RELIABILITY / TRUST */}
          <section className="space-y-12 pt-12">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-black mb-6">Why Businesses Can Trust It</h2>
              <p className="text-muted-foreground font-medium text-lg">
                GhostAgent does not blindly guess. It verifies actions before confirming them.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { title: "Verified Confirmations", desc: "Never tells a customer an order is placed unless the database confirms it.", icon: Shield },
                { title: "Smart Conversation Memory", desc: "Remembers what the customer said 5 messages ago.", icon: BrainCircuit },
                { title: "Cross-Platform Sync", desc: "Instagram and WhatsApp share the exact same AI brain, inventory, services, and business rules — configure once, deploy everywhere.", icon: Database }
              ].map((item, i) => (
                <div key={i} className="bg-surface-1 border border-border rounded-[2rem] p-8 text-center flex flex-col items-center gap-4 hover:border-primary/30 transition-colors">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h4 className="font-bold text-lg">{item.title}</h4>
                  <p className="text-sm text-muted-foreground font-medium">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* DASHBOARD CONNECTION */}
          <section className="bg-surface-2 border border-border rounded-[2.5rem] p-8 md:p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
                  Everything stays organized.
                </h2>
                <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                  GhostAgent doesn't just reply to messages — it acts as your operating system. Every captured order, booked appointment, and conversation is neatly organized in your dashboard.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-4">
                   {['Inbox', 'Orders', 'Appointments', 'Inventory', 'Services', 'Analytics'].map((item) => (
                      <div key={item} className="bg-surface-1 border border-border rounded-xl p-3 text-center text-sm font-bold shadow-sm">
                         {item}
                      </div>
                   ))}
                </div>
              </div>
              <div className="relative aspect-square lg:aspect-auto lg:h-[400px] w-full bg-surface-3 rounded-[2rem] border border-border overflow-hidden flex flex-col p-6 shadow-inner">
                 <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
                    <div className="font-bold">Dashboard</div>
                    <div className="w-8 h-8 rounded-full bg-primary/20" />
                 </div>
                 <div className="flex-1 flex gap-4">
                    <div className="w-1/3 bg-surface-1 rounded-xl border border-border p-4 flex flex-col gap-3">
                       {[0.2, 0.4, 0.6, 0.8].map((delay, i) => (
                         <motion.div 
                           key={i}
                           className="w-full h-8 bg-surface-2 rounded-lg" 
                           animate={{ opacity: [0.5, 1, 0.5] }}
                           transition={{ duration: 2, repeat: Infinity, delay }}
                         />
                       ))}
                    </div>
                    <div className="w-2/3 bg-surface-1 rounded-xl border border-border flex flex-col p-4 gap-4">
                       <div className="flex justify-between items-center">
                          <motion.div 
                            className="h-6 bg-surface-2 rounded-md" 
                            animate={{ width: ["40%", "60%", "40%"] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                          />
                          <motion.div 
                            className="w-16 h-6 bg-green-500/20 rounded-full flex items-center justify-center"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                             <div className="w-2 h-2 rounded-full bg-green-500" />
                          </motion.div>
                       </div>
                       <div className="w-full h-px bg-border/50" />
                       <div className="w-full flex-1 bg-surface-2 rounded-lg relative overflow-hidden flex items-end p-2 gap-2">
                          {/* Animated Chart Bars */}
                          {[40, 70, 45, 90, 60, 85].map((height, i) => (
                             <motion.div
                               key={i}
                               className="flex-1 bg-primary/40 rounded-t-sm"
                               initial={{ height: "10%" }}
                               animate={{ height: `${height}%` }}
                               transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", delay: i * 0.2 }}
                             />
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          {/* FAQ SECTION */}
          <section className="max-w-3xl mx-auto space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-black mb-4">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-4">
              {[
                { q: "Does GhostAgent work with Instagram and WhatsApp?", a: "Yes, and they share the exact same brain and business logic." },
                { q: "Can it understand Arabizi?", a: "Yes, the AI classifier understands English, Arabic, Franco-Arabic, French, and mixed languages perfectly." },
                { q: "What if I want to jump in and reply myself?", a: "You can pause the autopilot at any time directly from the dashboard and take over the conversation." }
              ].map((faq, i) => (
                <details key={i} className="group bg-surface-1 border border-border rounded-2xl p-6 hover:border-primary/30 transition-colors [&_summary::-webkit-details-marker]:hidden">
                  <summary className="font-bold text-lg cursor-pointer flex justify-between items-center outline-none">
                    {faq.q}
                    <span className="text-primary group-open:rotate-45 transition-transform text-2xl">+</span>
                  </summary>
                  <p className="mt-4 text-muted-foreground font-medium text-sm leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* FINAL CTA */}
          <section className="text-center py-12 pb-24">
            <h2 className="text-4xl md:text-5xl font-black mb-6">Ready to automate your customer conversations?</h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-full hover:scale-[1.03] transition-transform shadow-[0_0_25px_rgba(139,92,246,0.3)]"
              >
                Get Started Free
              </Link>
              <Link
                href="/#pricing"
                className="px-8 py-4 bg-surface-2 border border-border rounded-full font-bold hover:bg-surface-3 transition-colors"
              >
                See Pricing
              </Link>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
