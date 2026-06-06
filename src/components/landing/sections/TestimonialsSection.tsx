'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Star, BadgeCheck, Quote } from 'lucide-react';

export default function TestimonialsSection() {
  const tTest = useTranslations('Testimonials');

  const testimonials = [
    {
      name: tTest('t1Name'),
      businessType: tTest('t1Biz'),
      handle: '@elena_g***',
      image: 'https://randomuser.me/api/portraits/women/44.jpg',
      metric: tTest('t1Metric'),
      quote: tTest('t1Quote'),
      stars: 5,
    },
    {
      name: tTest('t2Name'),
      businessType: tTest('t2Biz'),
      handle: '@cortez_a***',
      image: 'https://randomuser.me/api/portraits/men/32.jpg',
      metric: tTest('t2Metric'),
      quote: tTest('t2Quote'),
      stars: 5,
    },
    {
      name: tTest('t3Name'),
      businessType: tTest('t3Biz'),
      handle: '@amira.s***',
      image: 'https://randomuser.me/api/portraits/women/68.jpg',
      metric: tTest('t3Metric'),
      quote: tTest('t3Quote'),
      stars: 5,
    },
  ];

  return (
    <section className="relative py-16 md:py-24 px-5 md:px-6 z-10 border-t border-border bg-surface-0/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground tracking-tight">
            {tTest('title')}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
            {tTest('description')}
          </p>
        </motion.div>

        {/* Testimonials - Swiper/Carousel on Mobile, Grid on Desktop */}
        <div className="flex md:grid md:grid-cols-3 gap-6 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-6 md:pb-0 relative z-10">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="min-w-[280px] sm:min-w-[340px] md:min-w-0 snap-center relative group flex-1"
            >
              {/* Subtle Glow on hover */}
              <div className="absolute -inset-2 bg-primary/10 blur-xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
              
              <div className="glass-frosted bg-surface-1/60 rounded-[2rem] p-6 md:p-8 flex flex-col h-full border border-border group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)] transition-all duration-300 relative z-10">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-border/50 shadow-sm shrink-0 relative bg-surface-2">
                    <img src={testimonial.image} alt={testimonial.name} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-bold text-foreground tracking-tight">{testimonial.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded font-black uppercase tracking-wider">
                        {testimonial.businessType}
                      </span>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold">{testimonial.handle}</p>
                      <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.stars)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                
                <p className="text-foreground/95 font-medium text-sm sm:text-base leading-relaxed flex-1 italic relative z-10">
                  "{testimonial.quote}"
                </p>
                
                <div className="mt-6 pt-5 border-t border-border/50">
                  <div className="inline-flex items-center px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
                    <span className="text-[10px] sm:text-xs font-bold text-primary tracking-wide">{testimonial.metric}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Proof Bar */}
        <div className="mt-12 md:mt-16 text-center px-4">
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest max-w-3xl mx-auto leading-relaxed">
            {tTest('proofBar')}
          </p>
        </div>
      </div>
    </section>
  );
}
