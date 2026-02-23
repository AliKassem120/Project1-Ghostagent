'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StarBackground from '@/components/StarBackground';
import { Shield } from 'lucide-react';

const sections = [
    {
        title: '1. Introduction',
        content: `Welcome to GhostAgent ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and shield your information when you use our automated Instagram DM service.`,
    },
    {
        title: '2. Integration with Meta Platform Technologies',
        content: `Our service integrates directly with Meta Platform Technologies (specifically Instagram and Facebook Graph APIs) to read and reply to direct messages on your behalf. By using GhostAgent, you acknowledge that your data is processed in accordance with Meta's Platform Terms and Developer Policies. We only access the data necessary to perform the automated response function.`,
    },
    {
        title: '3. Data Storage and Processing',
        content: `We use industry-standard providers to facilitate our service:`,
        list: [
            '<strong>Supabase:</strong> We use Supabase securely to store user account information, authentication data, and activity logs.',
            '<strong>AI Processing:</strong> Incoming messages are processed by advanced AI models (such as OpenAI or Groq) to generate relevant responses. These third-party AI providers do not use your data for training their models without your explicit consent.',
        ],
    },
    {
        title: '4. Data Collection',
        content: 'We collect the following types of information:',
        list: [
            '<strong>Account Information:</strong> Your email address and authentication tokens required to link your Instagram account.',
            '<strong>Communication Data:</strong> Logs of incoming messages and outgoing AI-generated replies for the purpose of maintaining conversation history and improving service quality.',
        ],
    },
    {
        title: '6. Contact Us',
        content: 'If you have questions about this Privacy Policy, please contact us at support@ghostagent.qzz.io.',
    },
];

export default function PrivacyPolicy() {
    return (
        <main className="min-h-screen text-white overflow-hidden relative selection:bg-primary/30">
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
                                <Shield className="w-10 h-10 text-purple-400" />
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                            Privacy Policy
                        </h1>
                        <p className="text-white/35 text-sm">
                            Last updated: February 2026
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
                            className="glass-frosted rounded-2xl p-6 md:p-8"
                        >
                            <h2 className="text-xl font-bold text-white mb-4">{section.title}</h2>
                            <p className="text-white/45 leading-relaxed">{section.content}</p>
                            {section.list && (
                                <ul className="mt-4 space-y-3">
                                    {section.list.map((item, j) => (
                                        <li key={j} className="flex gap-3 text-white/45 leading-relaxed text-sm">
                                            <span className="text-purple-400 mt-1 shrink-0">•</span>
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
                        className="glass-frosted rounded-2xl p-6 md:p-8 border-purple-500/20"
                        style={{ borderColor: 'rgba(139,92,246,0.2)' }}
                    >
                        <h2 className="text-xl font-bold text-white mb-4">5. Data Deletion Instructions</h2>
                        <p className="text-white/45 leading-relaxed mb-4">
                            You have the right to request the complete deletion of your personal data stored on our servers at any time. To exercise this right:
                        </p>
                        <ol className="space-y-3">
                            {[
                                <>Send an email to <strong className="text-primary">support@ghostagent.qzz.io</strong> with the subject line &quot;Data Deletion Request&quot;.</>,
                                'Include your registered email address and your connected Instagram handle.',
                                'We will process your request within 30 days and permanently delete your account, authentication tokens, and all associated chat logs from our database.',
                            ].map((step, j) => (
                                <li key={j} className="flex gap-3 text-white/45 leading-relaxed text-sm">
                                    <span className="text-purple-400 font-bold shrink-0">{j + 1}.</span>
                                    <span>{step}</span>
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
