'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { PLANS } from '@/lib/plans';

export default function PricingPlans() {
    return (
        <section id="pricing" className="relative py-24 md:py-32 px-4 md:px-6 z-10 pt-32">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-20"
                >
                    <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="text-muted-foreground max-w-lg mx-auto text-lg font-medium">
                        Start free. Upgrade when your DMs start rolling in.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-center">
                    {PLANS.map((plan, i) => {
                        const isHighlighted = plan.highlight;
                        return (
                            <motion.div
                                key={plan.tier}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1, duration: 0.6 }}
                                className={
                                    isHighlighted
                                        ? 'pricing-card bg-surface-0 border border-primary/30 rounded-2xl p-8 shadow-[0_0_50px_rgba(139,92,246,0.1)] relative transform md:scale-105 z-10 flex flex-col'
                                        : 'pricing-card bg-surface-1 rounded-2xl p-8 border border-border shadow-sm flex flex-col'
                                }
                            >
                                {isHighlighted && (
                                    <div className="absolute -top-px left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-b-lg bg-primary text-foreground text-[11px] font-bold uppercase tracking-wider shadow-sm">
                                        Most Popular
                                    </div>
                                )}

                                {/* Plan Header */}
                                <div className="mb-2">
                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3 ${plan.bg} ${plan.color}`}>
                                        <plan.icon className="w-3.5 h-3.5" />
                                        {plan.name}
                                    </div>
                                    <p className="text-xs text-muted-foreground font-medium">{plan.description}</p>
                                </div>

                                {/* Price */}
                                <div className={`mb-6 flex items-baseline ${isHighlighted ? 'mt-4' : ''}`}>
                                    <span className="text-5xl font-black text-foreground">${plan.price}</span>
                                    <span className="text-muted-foreground text-sm ml-1 font-medium">/month</span>
                                </div>

                                {/* DM Limit Badge */}
                                <div className={`mb-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold self-start ${isHighlighted ? 'bg-primary/15 text-primary' : 'bg-surface-2 text-muted-foreground'}`}>
                                    {plan.dmLimit === null
                                        ? '∞ Unlimited Replies'
                                        : `${plan.dmLimit.toLocaleString()} AI Replies / month`}
                                </div>

                                {/* Features */}
                                <ul className="space-y-3 mb-8 flex-1">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className={`flex items-start gap-3 text-sm font-medium ${isHighlighted ? 'text-foreground' : 'text-foreground/80'}`}>
                                            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${isHighlighted ? 'text-primary' : 'text-muted-foreground'}`} />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <Link
                                    href={plan.ctaLink}
                                    className={
                                        isHighlighted
                                            ? 'block w-full py-4 rounded-xl bg-primary text-primary-foreground text-center font-bold hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] mt-auto'
                                            : 'block w-full py-3.5 rounded-xl border border-border bg-surface-2 text-center font-bold text-foreground hover:bg-surface-3 transition-colors mt-auto'
                                    }
                                >
                                    {plan.cta}
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Fine print */}
                <p className="text-center text-xs text-muted-foreground mt-10 font-medium">
                    No contracts. Cancel anytime. Prices in USD.
                </p>
            </div>
        </section>
    );
}
