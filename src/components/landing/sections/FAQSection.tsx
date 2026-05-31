'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { HelpCircle, Plus, Minus } from 'lucide-react';
import clsx from 'clsx';

export default function FAQSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const tFaq = useTranslations('FAQ');

  const faqs = [
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
  ];

  return (
    <section id="faq" className="relative py-16 md:py-24 px-5 md:px-6 z-10 border-t border-border bg-surface-0/20 scroll-mt-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter text-foreground">
            {tFaq('title')}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium">
            {tFaq('description')}
          </p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
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
                className="flex items-center justify-between w-full px-5 py-4 sm:px-6 sm:py-5 text-left focus:outline-none group min-h-[48px]"
              >
                <span className={clsx(
                  "font-bold text-sm sm:text-base transition-colors pr-4",
                  openFaq === idx ? "text-primary" : "text-foreground group-hover:text-primary"
                )}>
                  {faq.q}
                </span>
                <div className={clsx(
                  "w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0",
                  openFaq === idx ? "bg-primary text-white rotate-180" : "bg-surface-2 text-muted-foreground"
                )}>
                  {openFaq === idx ? (
                    <Minus className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>
              
              <AnimatePresence initial={false}>
                {openFaq === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-muted-foreground font-medium text-xs sm:text-sm leading-relaxed border-t border-border/10 pt-4">
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
  );
}
