'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Smartphone, Megaphone, BrainCircuit, Inbox, Zap, Instagram } from 'lucide-react';

export default function MultiChannelSection() {
  return (
    <section className="relative py-16 md:py-24 px-5 md:px-6 z-10 border-t border-border/50 bg-background/20">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-xs font-semibold tracking-wide mb-6 shadow-sm">
            <MessageCircle className="w-3.5 h-3.5" />
            Multi-Channel Power
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-5 text-foreground tracking-tighter">
            One AI Brain.
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-green-500"> Two Channels.</span>
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto font-medium">
            Instagram and WhatsApp share the same intelligent core — your products, services, tone, and rules work seamlessly across both platforms.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: WhatsApp Native Flows */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            whileHover={{ y: -4 }}
            className="glass-frosted border border-border rounded-[2rem] p-6 md:p-8 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 transition-colors">
                  <Smartphone className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 tracking-tight flex flex-wrap items-center gap-2">WhatsApp Native Flows <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-black rounded-full border border-emerald-500/20 uppercase tracking-widest whitespace-nowrap">Coming Soon</span></h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-medium mb-6">
                  Collect orders and book appointments with native popup forms inside WhatsApp — no links, no redirects. Customers fill structured forms without leaving the chat.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Booking Forms', 'Order Capture', 'In-Chat Popups'].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Card 2: Marketing Broadcasts */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
            whileHover={{ y: -4 }}
            className="glass-frosted border border-border rounded-[2rem] p-6 md:p-8 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-6 group-hover:bg-violet-500/20 transition-colors">
                  <Megaphone className="w-7 h-7 text-violet-500" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 tracking-tight">Marketing Broadcasts</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-medium mb-6">
                  Send targeted promotional blasts to your WhatsApp customer base. Launch campaigns, announce sales, and re-engage past buyers with approved templates.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Promotional Blasts', 'Approved Templates', 'Re-engagement'].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-bold text-violet-500 uppercase tracking-wider">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Card 3: Multi-Channel AI Brain */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
            whileHover={{ y: -4 }}
            className="glass-frosted border border-border rounded-[2rem] p-6 md:p-8 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                  <BrainCircuit className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 tracking-tight">Shared AI Brain</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-medium mb-6">
                  Configure once, deploy everywhere. Your inventory, services, business rules, and AI personality sync across Instagram and WhatsApp in real time.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20">
                  <Instagram className="w-3 h-3 text-pink-500" />
                  <span className="text-[10px] font-bold text-pink-500">Instagram</span>
                </div>
                <div className="w-6 h-px bg-border" />
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Zap className="w-3 h-3 text-primary" />
                </div>
                <div className="w-6 h-px bg-border" />
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <MessageCircle className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-500">WhatsApp</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 4: Unified Inbox */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            whileHover={{ y: -4 }}
            className="glass-frosted border border-border rounded-[2rem] p-6 md:p-8 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-colors">
                  <Inbox className="w-7 h-7 text-cyan-500" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 tracking-tight">Unified Inbox</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-medium mb-6">
                  Every Instagram DM and WhatsApp message in one place. Toggle Autopilot on or off per conversation, and get Manager Alerts when a human needs to step in.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Autopilot Toggle', 'Manager Alerts', 'Human Escalation'].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold text-cyan-500 uppercase tracking-wider">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
