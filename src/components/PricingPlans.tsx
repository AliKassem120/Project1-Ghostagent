'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';

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
                        Start free. Upgrade when you&apos;re ready to dominate.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-center">
                    {/* Starter */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="pricing-card bg-surface-1 rounded-2xl p-8 border border-border shadow-sm flex flex-col"
                    >
                        <h3 className="text-xl font-bold text-muted-foreground mb-2">Starter</h3>
                        <div className="mb-6 flex items-baseline">
                            <span className="text-5xl font-black text-foreground">$0</span>
                            <span className="text-muted-foreground text-sm ml-1 font-medium">/month</span>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            {['50 Auto-Replies / day', 'Basic Analytics', 'Community Support', '1 Instagram Account'].map((feature) => (
                                <li key={feature} className="flex items-start gap-3 text-sm text-foreground/80 font-medium">
                                    <Check className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <Link
                            href="/login"
                            className="block w-full py-3.5 rounded-xl border border-border bg-surface-2 text-center font-bold text-foreground hover:bg-surface-3 transition-colors mt-auto"
                        >
                            Start Free Trial
                        </Link>
                    </motion.div>

                    {/* Pro — Popular */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1, duration: 0.6 }}
                        className="pricing-card bg-surface-0 border border-primary/30 rounded-2xl p-8 shadow-[0_0_50px_rgba(139,92,246,0.1)] relative transform md:scale-105 z-10 flex flex-col"
                    >
                        <div className="absolute -top-px left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-b-lg bg-primary text-foreground text-[11px] font-bold uppercase tracking-wider shadow-sm">
                            Most Popular
                        </div>
                        <h3 className="text-xl font-bold text-primary mb-2 mt-4">Pro Agent</h3>
                        <div className="mb-6 flex items-baseline">
                            <span className="text-5xl font-black text-foreground">$49</span>
                            <span className="text-muted-foreground text-sm ml-1 font-medium">/month</span>
                        </div>
                        <ul className="space-y-4 mb-10 flex-1">
                            {['Unlimited Replies', 'Inventory Sync', 'Sales Analytics', 'Multilingual AI', 'Priority Support'].map((feature) => (
                                <li key={feature} className="flex items-start gap-3 text-sm text-foreground font-medium">
                                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <Link
                            href="/login"
                            className="block w-full py-4 rounded-xl bg-primary text-primary-foreground text-center font-bold hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] mt-auto"
                        >
                            Get Pro
                        </Link>
                    </motion.div>

                    {/* Empire */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="pricing-card bg-surface-1 rounded-2xl p-8 border border-border shadow-sm flex flex-col"
                    >
                        <h3 className="text-xl font-bold text-muted-foreground mb-2">Empire</h3>
                        <div className="mb-6 flex items-baseline">
                            <span className="text-5xl font-black text-foreground">$199</span>
                            <span className="text-muted-foreground text-sm ml-1 font-medium">/month</span>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            {['Everything in Pro', 'Multiple Accounts', 'Custom AI Model', 'API Access', 'Dedicated Account Mgr'].map((feature) => (
                                <li key={feature} className="flex items-start gap-3 text-sm text-foreground/80 font-medium">
                                    <Check className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <Link
                            href="/contact"
                            className="block w-full py-3.5 rounded-xl border border-border bg-surface-2 text-center font-bold text-foreground hover:bg-surface-3 transition-colors mt-auto"
                        >
                            Contact Sales
                        </Link>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
