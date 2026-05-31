'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowRight, CheckCircle2, MessageCircle, Calendar, ShoppingBag } from 'lucide-react';
import DemoVideoModal from '@/components/demo/DemoVideoModal';

export default function FinalCTASection() {
  const [showVideo, setShowVideo] = useState(false);
  const tCta = useTranslations('CTA');

  return (
    <section className="relative py-20 md:py-32 px-5 md:px-6 z-10 border-t border-border overflow-hidden">
      {/* Abstract Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-surface-1/50 to-background -z-10 pointer-events-none" />
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[200px] sm:h-[400px] bg-primary/20 blur-[80px] sm:blur-[120px] rounded-full -z-10 animate-pulse pointer-events-none" 
        style={{ animationDuration: '8s' }} 
      />
      <div className="absolute top-1/4 right-1/4 w-[150px] sm:w-[300px] h-[150px] sm:h-[300px] bg-blue-500/10 blur-[60px] sm:blur-[100px] rounded-full -z-10 pointer-events-none" />
      
      {/* Floating Decorative Elements (Subtle, Hidden on mobile) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden hidden lg:block">
        <motion.div 
          animate={{ y: [0, -10, 0] }} 
          transition={{ duration: 4, repeat: Infinity }} 
          className="absolute top-[20%] left-[15%] p-3 bg-surface-2/40 border border-border/50 rounded-2xl backdrop-blur-md shadow-xl"
        >
          <MessageCircle className="w-5 h-5 text-primary" />
        </motion.div>
        
        <motion.div 
          animate={{ y: [0, 10, 0] }} 
          transition={{ duration: 5, repeat: Infinity, delay: 1 }} 
          className="absolute bottom-[25%] right-[12%] p-3 bg-surface-2/40 border border-border/50 rounded-2xl backdrop-blur-md shadow-xl"
        >
          <Calendar className="w-5 h-5 text-rose-500" />
        </motion.div>
        
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }} 
          transition={{ duration: 6, repeat: Infinity }} 
          className="absolute top-[35%] right-[18%] p-2 bg-surface-2/30 border border-border/30 rounded-xl backdrop-blur-sm shadow-lg"
        >
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
        <div className="relative glass-frosted border border-primary/20 rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-14 md:p-20 text-center shadow-2xl overflow-hidden group">
          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-5 tracking-tighter text-foreground leading-[1.15] sm:leading-[1.1]">
              {tCta('title')} <span className="text-primary">{tCta('sales')}</span> {tCta('and')} <span className="text-blue-500">{tCta('bookings')}</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-8 sm:mb-10 md:mb-12 font-medium leading-relaxed">
              {tCta('description')}
            </p>
            
            {/* CTA Buttons - Ensuring Stacked on mobile & min height >= 48px */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 sm:mb-10 w-full sm:w-auto">
              <Link
                href="/register"
                className="w-full sm:w-auto relative overflow-x-clip px-8 py-4 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-full hover:scale-[1.03] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_50px_rgba(139,92,246,0.5)] text-xs sm:text-sm min-h-[48px] flex items-center justify-center"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {tCta('getStarted')}
                  <ArrowRight className="w-5 h-5" />
                </span>
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none"
                  style={{ animation: 'shimmer 3s ease-in-out infinite' }}
                />
              </Link>
              
              <button
                onClick={() => setShowVideo(true)}
                className="w-full sm:w-auto px-8 py-4 bg-surface-2 border border-border rounded-full hover:bg-surface-3 active:bg-surface-4 transition-colors text-foreground font-bold flex items-center justify-center gap-2 text-xs sm:text-sm min-h-[48px]"
              >
                <span>▶</span> {tCta('watchDemo')}
              </button>
            </div>

            {/* Trust Row */}
            <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3">
              {[
                tCta('noCreditCard'),
                tCta('freePlan'),
                tCta('cancelAnytime')
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

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
