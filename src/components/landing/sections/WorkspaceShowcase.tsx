'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Check, ShoppingBag, Calendar } from 'lucide-react';
import EcommerceHeroAnimation from '@/components/landing/EcommerceHeroAnimation';
import AppointmentsHeroAnimation from '@/components/landing/AppointmentsHeroAnimation';

export default function WorkspaceShowcase() {
  const [activeWorkspace, setActiveWorkspace] = useState<'ecom' | 'appointments'>('ecom');
  const tWork = useTranslations('Workspaces');

  return (
    <section className="relative py-16 md:py-24 px-5 md:px-6 z-10 border-t border-border/50 bg-surface-0/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-5 text-foreground tracking-tight">
            {tWork('title')}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto font-medium">
            {tWork('description')}
          </p>
        </motion.div>

        {/* Toggle Tabs (Ensuring Touch Targets are >= 48px height) */}
        <div className="flex justify-center mb-12 px-2">
          <div className="relative grid grid-cols-2 bg-surface-2 p-1.5 rounded-full border border-border shadow-sm w-full max-w-[340px] sm:max-w-md">
            <button
              onClick={() => setActiveWorkspace('ecom')}
              className={`relative z-10 py-3.5 rounded-full text-xs sm:text-sm font-bold transition-colors min-h-[48px] flex items-center justify-center`}
            >
              <span className={activeWorkspace === 'ecom' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}>
                {tWork('ecommerce')}
              </span>
            </button>
            <button
              onClick={() => setActiveWorkspace('appointments')}
              className={`relative z-10 py-3.5 rounded-full text-xs sm:text-sm font-bold transition-colors min-h-[48px] flex items-center justify-center`}
            >
              <span className={activeWorkspace === 'appointments' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}>
                {tWork('appointments')}
              </span>
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
            {activeWorkspace === 'ecom' ? (
              <motion.div
                key="ecom"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="grid lg:grid-cols-2 gap-10 items-center"
              >
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest w-fit">
                    <ShoppingBag className="w-3.5 h-3.5" /> {tWork('ecommerce')}
                  </div>
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                    {tWork('ecomTitle')}
                  </h3>
                  <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium leading-relaxed">
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
                        <span className="font-semibold text-sm sm:text-base text-foreground/90">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {/* Mini CTA */}
                  <div className="pt-2">
                    <a
                      href="/register"
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary hover:underline hover:translate-x-0.5 transition-transform"
                    >
                      Set up in 5 minutes &rarr;
                    </a>
                  </div>
                </div>
                <div className="relative w-full min-h-[360px] sm:min-h-[440px] lg:h-[560px] rounded-2xl flex items-center justify-center overflow-visible lg:overflow-hidden group">
                  <EcommerceHeroAnimation />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="appointments"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="grid lg:grid-cols-2 gap-10 items-center"
              >
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest w-fit">
                    <Calendar className="w-3.5 h-3.5" /> {tWork('appointments')}
                  </div>
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                    {tWork('apptTitle')}
                  </h3>
                  <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium leading-relaxed">
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
                        <span className="font-semibold text-sm sm:text-base text-foreground/90">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Mini CTA */}
                  <div className="pt-2">
                    <a
                      href="/register"
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary hover:underline hover:translate-x-0.5 transition-transform"
                    >
                      Set up in 5 minutes &rarr;
                    </a>
                  </div>
                </div>
                <div className="relative w-full min-h-[360px] sm:min-h-[440px] lg:h-[560px] rounded-2xl flex items-center justify-center overflow-visible lg:overflow-hidden group">
                  <AppointmentsHeroAnimation />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
