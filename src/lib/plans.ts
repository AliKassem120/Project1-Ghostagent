import { Zap, Crown, Shield } from 'lucide-react';

export type PlanTier = 'starter' | 'pro' | 'empire';

export interface PlanDefinition {
    name: string;
    tier: PlanTier;
    price: number;
    description: string;
    icon: typeof Zap;
    color: string;
    bg: string;
    features: string[];
    highlight: boolean;
    cta: string;
    ctaLink: string;
}

export const PLANS: PlanDefinition[] = [
    {
        name: 'Starter',
        tier: 'starter',
        price: 0,
        description: 'For getting started',
        icon: Zap,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        features: [
            '50 Auto-Replies / month',
            'Basic Analytics',
            'Community Support',
            '1 Instagram Account',
        ],
        highlight: false,
        cta: 'Get Started Free',
        ctaLink: '/login',
    },
    {
        name: 'Pro Agent',
        tier: 'pro',
        price: 49,
        description: 'Most popular for growing stores',
        icon: Crown,
        color: 'text-primary',
        bg: 'bg-primary/10',
        features: [
            'Unlimited Replies',
            'Inventory Sync',
            'Sales Analytics',
            'Multilingual AI',
            'Priority Support',
        ],
        highlight: true,
        cta: 'Get Pro',
        ctaLink: '/login',
    },
    {
        name: 'Empire',
        tier: 'empire',
        price: 199,
        description: 'For enterprise-scale operations',
        icon: Shield,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        features: [
            'Everything in Pro',
            'Multiple Accounts',
            'Custom AI Model',
            'API Access',
            'Dedicated Account Mgr',
        ],
        highlight: false,
        cta: 'Contact Sales',
        ctaLink: '/contact',
    },
];

/** Map a database tier string to a plan definition */
export function getPlanByTier(tier: string): PlanDefinition {
    const normalized = tier.toLowerCase().replace(/\s+/g, '_');
    if (normalized === 'pro' || normalized === 'pro_agent') return PLANS[1];
    if (normalized === 'empire') return PLANS[2];
    return PLANS[0]; // starter / free_trial / unknown
}

/** Map a UI plan name to its database tier string */
export function tierFromName(name: string): PlanTier {
    if (name === 'Pro Agent') return 'pro';
    if (name === 'Empire') return 'empire';
    return 'starter';
}

/** Get the reply limit for a given tier (null = unlimited) */
export function getReplyLimit(tier: string): number | null {
    const plan = getPlanByTier(tier);
    if (plan.tier === 'starter') return 50;
    return null; // Pro and Empire are unlimited
}
