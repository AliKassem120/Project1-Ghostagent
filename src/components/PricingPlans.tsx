'use client';

import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { PLANS } from '@/lib/plans';

export default function PricingPlans() {

    return (
        <section id="pricing" className="relative pt-28 md:pt-32 pb-24 md:pb-32 px-4 md:px-6 z-10">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter text-foreground leading-[1.1]">
                        Simple pricing for growing DM businesses
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl font-medium leading-relaxed">
                        Start free, then upgrade when your automated replies, orders, and bookings start scaling.
                    </p>
                </motion.div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch mb-20">
                    {PLANS.map((plan, i) => {
                        const displayPrice = plan.price;

                        return (
                            <motion.div
                                key={plan.tier}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1, duration: 0.6 }}
                                whileHover={{ y: -5 }}
                                className={`group relative flex flex-col glass-frosted border rounded-[2.5rem] p-8 md:p-10 transition-all duration-300 ${
                                    plan.highlight 
                                    ? 'border-primary/40 shadow-[0_0_50px_rgba(139,92,246,0.15)] ring-1 ring-primary/20 bg-surface-0/50' 
                                    : 'border-border bg-surface-1/40 hover:border-border-hover'
                                }`}
                            >
                                {plan.highlight && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-2 rounded-full bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(139,92,246,0.4)] z-20">
                                        Most Popular
                                    </div>
                                )}

                                {/* Card Header */}
                                <div className="mb-8">
                                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider mb-4 ${plan.bg} ${plan.color}`}>
                                        <plan.icon className="w-3.5 h-3.5" />
                                        {plan.name}
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">{plan.description}</h3>
                                    {plan.valueLine && (
                                        <p className="text-primary text-xs font-bold uppercase tracking-wide opacity-80">{plan.valueLine}</p>
                                    )}
                                </div>

                                {/* Price Section */}
                                <div className="mb-8">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-black tracking-tighter text-foreground">${displayPrice}</span>
                                        <span className="text-muted-foreground font-bold">/month</span>
                                    </div>
                                </div>

                                {/* Limit Pill */}
                                <div className={`mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black shadow-sm ${
                                    plan.highlight ? 'bg-primary text-white' : 'bg-surface-2 text-muted-foreground'
                                }`}>
                                    {plan.dmLimit === null ? '∞ Unlimited AI Replies' : `${plan.dmLimit.toLocaleString()} AI Replies / month`}
                                </div>

                                {/* Features List */}
                                <div className="flex-1 space-y-4 mb-10">
                                    {plan.features.map((feature, idx) => (
                                        <div key={idx} className="flex items-start gap-3">
                                            <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                                plan.highlight ? 'bg-primary/20 text-primary' : 'bg-surface-3 text-muted-foreground'
                                            }`}>
                                                <Check className="w-3 h-3" />
                                            </div>
                                            <span className="text-sm font-medium text-foreground/90 leading-tight">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA Button */}
                                <div>
                                    <Link
                                        href={plan.ctaLink}
                                        className={`block w-full py-5 rounded-[1.5rem] text-center font-black uppercase tracking-widest text-sm transition-all shadow-lg active:scale-95 ${
                                            plan.highlight 
                                            ? 'bg-primary text-white hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:scale-[1.02]' 
                                            : plan.tier === 'empire'
                                                ? 'bg-foreground text-background hover:bg-foreground/90 hover:scale-[1.02]'
                                                : 'bg-surface-2 text-foreground border border-border hover:bg-surface-3 hover:scale-[1.02]'
                                        }`}
                                    >
                                        {plan.cta}
                                    </Link>
                                    {plan.tier === 'starter' && (
                                        <p className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-4">No credit card required</p>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Trust Row */}
                <motion.div 
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-20 border-b border-border/50"
                >
                    {[
                        "Cancel anytime",
                        "No setup fee",
                        "Works for E-Com & Booking",
                        "Upgrade when you need"
                    ].map((text, i) => (
                        <div key={i} className="flex items-center justify-center gap-2 text-muted-foreground font-bold text-[10px] md:text-xs uppercase tracking-widest">
                            <Check className="w-3 h-3 text-primary" /> {text}
                        </div>
                    ))}
                </motion.div>

            </div>
        </section>
    );
}
