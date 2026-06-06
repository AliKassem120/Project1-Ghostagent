'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import StarBackground from '@/components/StarBackground';
import Footer from '@/components/Footer';
import PricingPlans from '@/components/PricingPlans';

// Section Components
import HeroSection from '@/components/landing/sections/HeroSection';
import TrustedByBar from '@/components/landing/sections/TrustedByBar';
import WorkspaceShowcase from '@/components/landing/sections/WorkspaceShowcase';
import MultiChannelSection from '@/components/landing/sections/MultiChannelSection';
import AllFeaturesGrid from '@/components/landing/sections/AllFeaturesGrid';
import HowItWorksSection from '@/components/landing/sections/HowItWorksSection';
import BusinessValueSection from '@/components/landing/sections/BusinessValueSection';
import TestimonialsSection from '@/components/landing/sections/TestimonialsSection';
import FAQSection from '@/components/landing/sections/FAQSection';
import FinalCTASection from '@/components/landing/sections/FinalCTASection';

// Pre-compute particle positions to avoid hydration mismatches from Math.random() in render
const PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  left: ((i * 7.3 + 11) % 100).toFixed(1),
  duration: 10 + (i * 1.7) % 12,
  delay: (i * 0.83) % 5,
}));

export default function LandingPage() {
  const particles = useMemo(() => PARTICLES, []);

  return (
    <main className="min-h-[100dvh] text-foreground overflow-x-clip relative selection:bg-primary/30">
      {/* Background Layers */}
      <div className="fixed inset-0 bg-background">
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"
          style={{ maskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)' }}
        />
      </div>
      <StarBackground />

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            initial={{ opacity: 0, top: '110%', left: `${p.left}%` }}
            animate={{ opacity: [0, 0.6, 0], top: '-10%' }}
            transition={{ duration: p.duration, repeat: Infinity, ease: 'linear', delay: p.delay }}
          />
        ))}
      </div>

      {/* Navigation */}
      <Navbar />

      {/* Sections */}
      <HeroSection />
      <TrustedByBar />
      <WorkspaceShowcase />
      <MultiChannelSection />
      <AllFeaturesGrid />
      <HowItWorksSection />
      <BusinessValueSection />
      <TestimonialsSection />
      <PricingPlans />
      <FAQSection />
      <FinalCTASection />

      {/* Footer */}
      <Footer />
    </main>
  );
}
