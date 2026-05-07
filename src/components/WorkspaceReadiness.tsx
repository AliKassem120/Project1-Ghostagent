import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ArrowRight, Instagram, Package, Bot, MessageSquare, AlertTriangle, Wifi, CalendarCheck, X, Phone } from 'lucide-react';
import Link from 'next/link';

type BusinessCategory = 'ecommerce' | 'appointments' | string;

// ── Types ────────────────────────────────────────────────────

interface SetupStep {
    id: string;
    title: string;
    description: string;
    icon: typeof Instagram;
    href: string;
    isComplete: boolean | null; // null = loading
}

export interface WorkspaceReadinessProps {
    /** Channel connection flags */
    hasInstagram: boolean | null;
    hasWhatsApp: boolean | null;
    /** Content readiness */
    hasInventory: boolean | null; // products for ecommerce
    hasServices: boolean | null;  // services for appointments
    hasBusinessHours: boolean | null;
    hasAiSettings: boolean | null;
    /** Workspace metadata */
    businessType?: BusinessCategory;
    /** First-time onboarding tracking */
    setupCompletedAt: string | null;  // ISO timestamp or null
    setupDismissedAt: string | null;
    /** Callback when user completes or dismisses setup */
    onCompleteSetup?: () => void;
    onDismissSetup?: () => void;
}

// ── Component ────────────────────────────────────────────────

export default function WorkspaceReadiness({
    hasInstagram,
    hasWhatsApp,
    hasInventory,
    hasServices,
    hasBusinessHours,
    hasAiSettings,
    businessType,
    setupCompletedAt,
    setupDismissedAt,
    onCompleteSetup,
    onDismissSetup,
}: WorkspaceReadinessProps) {
    // ── Loading gate ─────────────────────────────────────────
    // Don't render until all critical statuses are loaded
    const isLoading =
        hasInstagram === null ||
        hasAiSettings === null ||
        (businessType === 'ecommerce' && hasInventory === null) ||
        (businessType === 'appointments' && (hasServices === null || hasBusinessHours === null));

    if (isLoading) return null;

    const hasAnyChannel = (hasInstagram === true) || (hasWhatsApp === true);

    // ── Build steps based on business type ───────────────────
    const steps = buildSteps({
        businessType,
        hasInstagram,
        hasWhatsApp,
        hasAnyChannel,
        hasInventory,
        hasServices,
        hasBusinessHours,
        hasAiSettings,
    });

    const requiredSteps = steps.filter(s => s.id !== 'test');
    const completedCount = requiredSteps.filter(s => s.isComplete).length;
    const allRequiredComplete = requiredSteps.every(s => s.isComplete);
    const pct = requiredSteps.length > 0 ? Math.round((completedCount / requiredSteps.length) * 100) : 0;

    // ── Auto-complete setup when all required steps pass ─────
    if (allRequiredComplete && !setupCompletedAt && onCompleteSetup) {
        // Fire once — parent will persist setup_completed_at
        onCompleteSetup();
    }

    // ── Returning user with broken integration → compact banner ──
    const wasCompletedBefore = !!setupCompletedAt;
    const wasDismissed = !!setupDismissedAt;

    if (wasCompletedBefore || wasDismissed) {
        // Setup was done before. Only show a compact warning if something broke.
        const brokenItems = getBrokenItems({ hasAnyChannel, hasInstagram, hasWhatsApp, hasInventory, hasServices, hasBusinessHours, hasAiSettings, businessType });

        if (brokenItems.length === 0) return null; // everything fine

        return (
            <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-center gap-4 px-5 py-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl"
            >
                <div className="p-2 rounded-xl bg-amber-500/10 shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                        Agent Setup Issue
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {brokenItems.map(b => b.message).join(' ')}
                    </p>
                </div>
                {brokenItems[0]?.href && (
                    <Link
                        href={brokenItems[0].href}
                        className="shrink-0 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                    >
                        {brokenItems[0].action}
                    </Link>
                )}
            </motion.div>
        );
    }

    // ── First-time onboarding: full checklist ────────────────
    if (allRequiredComplete) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-surface-1 border border-border rounded-2xl overflow-hidden shadow-sm"
        >
            {/* Header */}
            <div className="p-5 border-b border-border bg-surface-2/50 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">Agent Setup</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Complete these steps to activate your AI agent.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-primary">{pct}%</div>
                    <div className="w-24 h-2 bg-surface-3 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                    {onDismissSetup && (
                        <button
                            onClick={onDismissSetup}
                            className="p-1.5 rounded-lg hover:bg-surface-3 transition-colors text-muted-foreground hover:text-foreground"
                            title="Dismiss checklist"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Steps */}
            <div className="divide-y divide-border/50">
                {steps.map((step, index) => {
                    const isNextOpen = !step.isComplete && steps.slice(0, index).every(s => s.isComplete);
                    const isDisabled = step.id === 'test' && !hasAnyChannel;

                    return (
                        <Link
                            key={step.id}
                            href={isDisabled ? '#' : step.href}
                            className={`flex items-center gap-4 p-5 transition-colors
                                ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-2/50'}
                                ${isNextOpen ? 'bg-primary/5' : ''}`}
                            onClick={isDisabled ? (e: React.MouseEvent) => e.preventDefault() : undefined}
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

                            {!step.isComplete && !isDisabled && (
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </motion.div>
    );
}

// ── Step builder ─────────────────────────────────────────────

function buildSteps(ctx: {
    businessType?: string;
    hasInstagram: boolean | null;
    hasWhatsApp: boolean | null;
    hasAnyChannel: boolean;
    hasInventory: boolean | null;
    hasServices: boolean | null;
    hasBusinessHours: boolean | null;
    hasAiSettings: boolean | null;
}): SetupStep[] {
    const steps: SetupStep[] = [];

    // 1. Connect a channel
    steps.push({
        id: 'channel',
        title: 'Connect a channel',
        description: 'Link Instagram or WhatsApp so your agent can receive and reply to messages',
        icon: Wifi,
        href: '/dashboard/settings?tab=connections',
        isComplete: ctx.hasAnyChannel,
    });

    // 2. Content (type-specific)
    if (ctx.businessType === 'ecommerce') {
        steps.push({
            id: 'inventory',
            title: 'Add a product',
            description: 'Your agent needs products to sell — add at least one to Inventory',
            icon: Package,
            href: '/dashboard/inventory',
            isComplete: !!ctx.hasInventory,
        });
    }

    if (ctx.businessType === 'appointments') {
        steps.push({
            id: 'services',
            title: 'Add a service',
            description: 'Define at least one service so customers can book appointments',
            icon: CalendarCheck,
            href: '/dashboard/services',
            isComplete: !!ctx.hasServices,
        });
        steps.push({
            id: 'hours',
            title: 'Set working hours',
            description: "Tell the agent when you're available for bookings",
            icon: CalendarCheck,
            href: '/dashboard/settings',
            isComplete: !!ctx.hasBusinessHours,
        });
    }

    // 3. AI settings
    steps.push({
        id: 'ai',
        title: 'Configure AI voice',
        description: 'Set your agent\'s tone, language, and custom instructions',
        icon: Bot,
        href: '/dashboard/settings',
        isComplete: !!ctx.hasAiSettings,
    });

    // 4. Test message (optional, not counted in %)
    steps.push({
        id: 'test',
        title: 'Send a test message',
        description: ctx.hasAnyChannel
            ? 'Message your account from another device and watch the agent reply'
            : 'Connect a channel first to test your agent',
        icon: MessageSquare,
        href: '#',
        isComplete: false,
    });

    return steps;
}

// ── Broken items for compact banner ──────────────────────────

interface BrokenItem {
    message: string;
    href: string;
    action: string;
}

function getBrokenItems(ctx: {
    hasAnyChannel: boolean;
    hasInstagram: boolean | null;
    hasWhatsApp: boolean | null;
    hasInventory: boolean | null;
    hasServices: boolean | null;
    hasBusinessHours: boolean | null;
    hasAiSettings: boolean | null;
    businessType?: string;
}): BrokenItem[] {
    const items: BrokenItem[] = [];

    if (!ctx.hasAnyChannel) {
        items.push({
            message: 'No messaging channel connected. Your agent cannot receive or reply to messages.',
            href: '/dashboard/settings?tab=connections',
            action: 'Reconnect',
        });
    }

    if (ctx.businessType === 'ecommerce' && ctx.hasInventory === false) {
        items.push({
            message: 'Inventory is empty. Your agent has nothing to sell.',
            href: '/dashboard/inventory',
            action: 'Add Products',
        });
    }

    if (ctx.businessType === 'appointments' && ctx.hasServices === false) {
        items.push({
            message: 'No active services configured.',
            href: '/dashboard/services',
            action: 'Add Services',
        });
    }

    return items;
}
