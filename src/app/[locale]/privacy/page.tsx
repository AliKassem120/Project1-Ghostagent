'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StarBackground from '@/components/StarBackground';
import { Shield } from 'lucide-react';

import { useTranslations } from 'next-intl';

export default function PrivacyPolicy() {
    const t = useTranslations('Privacy');

    const sections = [
        {
            title: t('s1t'),
            content: t('s1c'),
        },
        {
            title: t('s2t'),
            content: t('s2c'),
        },
        {
            title: t('s3t'),
            content: t('s3c'),
            list: [
                t('s3l1'),
                t('s3l2'),
            ],
        },
        {
            title: t('s4t'),
            content: t('s4c'),
            list: [
                t('s4l1'),
                t('s4l2'),
            ],
        },
        {
            title: t('s6t'),
            content: t('s6c'),
        },
    ];

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

            {/* Hero */}
            <section className="relative z-10 pt-32 pb-16 px-4 md:px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="flex justify-center mb-6">
                            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                                <Shield className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
                            {t('title')}
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium">
                            {t('lastUpdated')}
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Content */}
            <section className="relative z-10 pb-24 px-4 md:px-6">
                <div className="max-w-3xl mx-auto space-y-5">
                    {sections.map((section, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08, duration: 0.5 }}
                            className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 md:p-8"
                        >
                            <h2 className="text-xl font-bold text-foreground mb-4">{section.title}</h2>
                            <p className="text-muted-foreground leading-relaxed font-medium">{section.content}</p>
                            {section.list && (
                                <ul className="mt-4 space-y-3">
                                    {section.list.map((item, j) => (
                                        <li key={j} className="flex gap-3 text-muted-foreground leading-relaxed text-sm font-medium">
                                            <span className="text-primary mt-1 shrink-0">•</span>
                                            <span dangerouslySetInnerHTML={{ __html: item }} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </motion.div>
                    ))}

                    {/* Data Deletion — highlighted */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                        id="deletion"
                        className="bg-surface-1 border border-primary/20 shadow-sm rounded-2xl p-6 md:p-8"
                        style={{ borderColor: 'rgba(139,92,246,0.2)' }}
                    >
                        <h2 className="text-xl font-bold text-foreground mb-4">{t('delTitle')}</h2>
                        <p className="text-muted-foreground leading-relaxed mb-4 font-medium">
                            {t('delDesc')}
                        </p>
                        <ol className="space-y-3">
                            {[
                                t('del1'),
                                t('del2'),
                                t('del3'),
                            ].map((step, j) => (
                                <li key={j} className="flex gap-3 text-muted-foreground leading-relaxed text-sm font-medium">
                                    <span className="text-primary font-bold shrink-0">{j + 1}.</span>
                                    <span dangerouslySetInnerHTML={{ __html: step }} />
                                </li>
                            ))}
                        </ol>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
