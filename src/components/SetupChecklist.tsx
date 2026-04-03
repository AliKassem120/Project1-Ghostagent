import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ArrowRight, Instagram, Package, Bot, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface SetupStep {
    id: string;
    title: string;
    description: string;
    icon: typeof Instagram;
    href: string;
    isComplete: boolean;
}

export default function SetupChecklist({
    hasInstagram,
    hasInventory,
    hasAiSettings
}: {
    hasInstagram: boolean;
    hasInventory: boolean;
    hasAiSettings: boolean;
}) {
    const steps: SetupStep[] = [
        {
            id: 'instagram',
            title: 'Connect Instagram',
            description: 'Link your professional account so GhostAgent can read DMs',
            icon: Instagram,
            href: '/dashboard/settings?tab=connection',
            isComplete: hasInstagram,
        },
        {
            id: 'inventory',
            title: 'Add a product',
            description: 'GhostAgent needs to know what to sell',
            icon: Package,
            href: '/dashboard/inventory',
            isComplete: hasInventory,
        },
        {
            id: 'ai',
            title: 'Configure AI Voice',
            description: 'Tell it how to sound when talking to customers',
            icon: Bot,
            href: '/dashboard/settings',
            isComplete: hasAiSettings,
        },
        {
            id: 'test',
            title: 'Send a test DM',
            description: 'Message your store from a personal account to see it work',
            icon: MessageSquare,
            href: '#',
            isComplete: false, // We don't strictly track this yet, acts as final mental step
        }
    ];

    const completedCount = steps.filter(s => s.isComplete).length;
    const allComplete = hasInstagram && hasInventory && hasAiSettings;

    if (allComplete) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-surface-1 border border-border rounded-2xl overflow-hidden shadow-sm"
        >
            <div className="p-5 border-b border-border bg-surface-2/50 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">Onboarding Checklist</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Let&apos;s get GhostAgent ready to sell.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-primary">{Math.round((completedCount / 3) * 100)}% Complete</div>
                    <div className="w-24 h-2 bg-surface-3 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${(completedCount / 3) * 100}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>
            </div>

            <div className="divide-y divide-border/50">
                {steps.map((step, index) => {
                    const isNextOpenStep = !step.isComplete && steps.slice(0, index).every(s => s.isComplete);

                    return (
                        <Link
                            key={step.id}
                            href={step.href}
                            className={`flex items-center gap-4 p-5 transition-colors hover:bg-surface-2/50 ${isNextOpenStep ? 'bg-primary/5' : ''
                                }`}
                        >
                            <div className="shrink-0 pt-0.5">
                                {step.isComplete ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <Circle className="w-5 h-5 text-muted-foreground/30" />
                                )}
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <step.icon className={`w-4 h-4 ${step.isComplete ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                                    <h3 className={`font-semibold ${step.isComplete ? 'text-muted-foreground line-through decoration-muted-foreground/50' : 'text-foreground'}`}>
                                        {step.title}
                                    </h3>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                            </div>

                            {!step.isComplete && (
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </motion.div>
    );
}
