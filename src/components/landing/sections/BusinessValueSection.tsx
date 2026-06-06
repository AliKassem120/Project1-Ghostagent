'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Clock, Timer, Users, TrendingUp } from 'lucide-react';

export default function BusinessValueSection() {
  const tValue = useTranslations('BusinessValue');

  const values = [
    {
      icon: Clock,
      title: tValue('neverMissSaleTitle'),
      desc: tValue('neverMissSaleDesc'),
      metric: '24/7 Response',
      color: 'text-primary bg-primary/10 border-primary/20',
    },
    {
      icon: Timer,
      title: tValue('saveHoursTitle'),
      desc: tValue('saveHoursDesc'),
      metric: 'Save 20+ hrs/wk',
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    },
    {
      icon: TrendingUp,
      title: tValue('growWithoutHiringTitle'),
      desc: tValue('growWithoutHiringDesc'),
      metric: '3x Efficiency',
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <section className="relative py-16 md:py-24 px-5 md:px-6 z-10 border-t border-border/50 bg-surface-0/25">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="text-primary font-bold tracking-[0.2em] text-xs uppercase mb-3 block">
            Why GhostAgent
          </span>
          <h2 className="text-3xl md:text-5xl font-black mb-4 text-foreground tracking-tighter">
            Automate the Work. Keep the Revenue.
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
            Stop losing leads to slow response times. Let AI respond in seconds, check inventory, and handle client calendars instantly.
          </p>
        </motion.div>

        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {values.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className="glass-frosted border border-border rounded-3xl p-6 md:p-8 flex flex-col justify-between hover:border-primary/30 transition-colors"
            >
              <div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-foreground mb-3 tracking-tight">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium mb-6">
                  {item.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-border/50">
                <span className="text-xs font-black uppercase text-primary tracking-widest bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                  {item.metric}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
