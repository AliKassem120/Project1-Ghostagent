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
    dmLimit: number | null; // null = unlimited
    valueLine?: string;
}

export const PLANS: PlanDefinition[] = [
    {
        name: 'Starter',
        tier: 'starter',
        price: 0,
        description: 'Test the waters',
        icon: Zap,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        dmLimit: 100,
        features: [
            '100 AI replies / month',
            '1 Instagram account',
            'Choose E-Commerce or Appointments',
            'Basic inventory or calendar sync',
            'Customer detail capture',
            'Standard email support',
        ],
        highlight: false,
        cta: 'Get Started Free',
        ctaLink: '/register',
    },
    {
        name: 'Pro Agent',
        tier: 'pro',
        price: 49,
        description: 'Automate daily sales and bookings',
        icon: Crown,
        color: 'text-primary',
        bg: 'bg-primary/10',
        dmLimit: 1000,
        features: [
            '1,000 AI replies / month',
            '1 Instagram account',
            'Dual workspace: E-Commerce + Appointments',
            'Live inventory and calendar sync',
            'Strict checkout and booking logic',
            'Custom AI persona and tone',
            'Sales and booking analytics',
            'Priority email support',
        ],
        highlight: true,
        cta: 'Get Pro',
        ctaLink: '/register',
        valueLine: 'Best for most growing businesses',
    },
    {
        name: 'Empire',
        tier: 'empire',
        price: 199,
        description: 'Scale across brands and teams',
        icon: Shield,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        dmLimit: null, // unlimited
        features: [
            'Unlimited AI replies',
            'Up to 5 Instagram accounts',
            'Unlimited workspaces',
            'Combined sales and booking analytics',
            'Advanced automation logs',
            'Team access',
            'Priority onboarding and support',
        ],
        highlight: false,
        cta: 'Contact Sales',
        ctaLink: '/contact',
        valueLine: 'For high-volume teams',
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
    return plan.dmLimit;
}
