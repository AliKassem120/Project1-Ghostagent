'use client';

import { useEffect } from 'react';
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

export default function LandingPage() {
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
      <StarBackground />

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
