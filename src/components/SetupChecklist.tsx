import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ArrowRight, Instagram, Package, Bot, MessageSquare } from 'lucide-react';
import Link from 'next/link';

type BusinessCategory =
    | 'ecommerce'
    | 'appointments'
    | string;

// Only these types need inventory
const INVENTORY_BUSINESS_TYPES: BusinessCategory[] = ['ecommerce'];

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
    hasAiSettings,
    businessType,
}: {
    hasInstagram: boolean;
    hasInventory: boolean;
    hasAiSettings: boolean;
    businessType?: BusinessCategory;
}) {
    const needsInventory = !businessType || INVENTORY_BUSINESS_TYPES.includes(businessType);

    const steps: SetupStep[] = [
        {
            id: 'instagram',
            title: 'Connect Instagram',
            description: 'Link your business account so GhostAgent can read DMs and comments',
            icon: Instagram,
            href: '/dashboard/settings?tab=connections',
            isComplete: hasInstagram,
        },
        // Inventory step is only shown for product-based businesses
        ...(needsInventory ? [{
            id: 'inventory',
            title: 'Add a product',
            description: 'GhostAgent needs to know what to sell so the AI never makes things up',
            icon: Package,
            href: '/dashboard/inventory',
            isComplete: hasInventory,
        }] : []),
        {
            id: 'ai',
            title: 'Configure AI Voice',
            description: 'Tell it how to sound — tone, language, and any custom rules',
            icon: Bot,
            href: '/dashboard/settings',
            isComplete: hasAiSettings,
        },
        {
            id: 'test',
            title: 'Send a test DM',
            description: 'Message your Instagram from another account and watch the agent reply',
            icon: MessageSquare,
            href: '#',
            isComplete: false,
        }
    ];

    const totalTracked = steps.filter(s => s.id !== 'test').length;
    const completedCount = steps.filter(s => s.isComplete).length;
    const pct = totalTracked > 0 ? Math.round((completedCount / totalTracked) * 100) : 0;

    // Hide if all tracked steps are complete
    const allComplete = steps.filter(s => s.id !== 'test').every(s => s.isComplete);
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
                    <p className="text-sm text-muted-foreground mt-0.5">Complete these steps to activate your AI agent.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-primary">{pct}% Complete</div>
                    <div className="w-24 h-2 bg-surface-3 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
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
                            className={`flex items-center gap-4 p-5 transition-colors hover:bg-surface-2/50 ${isNextOpenStep ? 'bg-primary/5' : ''}`}
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
