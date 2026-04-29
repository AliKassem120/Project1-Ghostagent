'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StarBackground from '@/components/StarBackground';
import PricingPlans from '@/components/PricingPlans';

export default function PricingPage() {
    return (
        <main className="min-h-[100dvh] text-foreground overflow-x-clip relative selection:bg-primary/30">
            {/* Background */}
            <div className="fixed inset-0 bg-background">
                <div
                    className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"
                    style={{ maskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)' }}
                />
            </div>
            <StarBackground />

            <Navbar />

            {/* Content */}
            <div className="pt-20 pb-20">
                <PricingPlans />
            </div>

            <Footer />
        </main>
    );
}
