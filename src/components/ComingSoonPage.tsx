'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface ComingSoonPageProps {
    title: string;
    subtitle: string;
    description: string;
    icon: LucideIcon;
    iconColor?: string;
    iconBg?: string;
    whatItWillDo?: string[];
    settingsLink?: boolean;
}

export default function ComingSoonPage({
    title,
    subtitle,
    description,
    icon: Icon,
    iconColor = 'text-violet-400',
    iconBg = 'bg-violet-500/10',
    whatItWillDo = [],
    settingsLink = false,
}: ComingSoonPageProps) {
    return (
        <div className="min-h-[80vh] flex flex-col relative w-full pb-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-surface-1 border border-border shadow-sm rounded-2xl flex flex-col items-center justify-center p-12 text-center relative overflow-x-clip"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent pointer-events-none" />

                <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center mb-6 relative z-10`}>
                    <Icon className={`w-8 h-8 ${iconColor}`} />
                </div>

                <h2 className="text-xl font-bold text-foreground mb-3 tracking-tight relative z-10">
                    {description}
                </h2>

                {whatItWillDo.length > 0 && (
                    <ul className="text-sm text-muted-foreground space-y-2 mb-8 max-w-sm mx-auto text-left relative z-10">
                        {whatItWillDo.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                                <span className="text-violet-400 mt-0.5 shrink-0">→</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-3 relative z-10">
                    <div className="px-4 py-2 rounded-xl bg-surface-2 border border-border text-xs font-mono text-violet-400">
                        In Development
                    </div>
                    {settingsLink && (
                        <Link
                            href="/dashboard/settings"
                            className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                        >
                            Configure AI Agent →
                        </Link>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
