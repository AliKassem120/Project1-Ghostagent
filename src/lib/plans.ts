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
}

export const PLANS: PlanDefinition[] = [
    {
        name: 'Starter',
        tier: 'starter',
        price: 0,
        description: 'Test the waters — zero risk',
        icon: Zap,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        dmLimit: 100, // increased to 100
        features: [
            '100 AI Replies / month',
            '1 Instagram Account',
            'Automated DM Responses',
            'Basic Product Information',
            'Standard Email Support',
        ],
        highlight: false,
        cta: 'Get Started Free',
        ctaLink: '/register',
    },
    {
        name: 'Pro Agent',
        tier: 'pro',
        price: 49,
        description: 'For stores with real DM volume',
        icon: Crown,
        color: 'text-primary',
        bg: 'bg-primary/10',
        dmLimit: 1000,
        features: [
            '1,000 AI Replies / month',
            '1 Instagram Account',
            'Comment & DM Auto-Reply',
            'Order Lead Capture & Checkout',
            'Human Takeover (Mute AI)',
            'Custom AI Persona & Tone',
            'Priority Email Support',
        ],
        highlight: true,
        cta: 'Get Pro',
        ctaLink: '/register',
    },
    {
        name: 'Empire',
        tier: 'empire',
        price: 199,
        description: 'For agencies & multi-brand operators',
        icon: Shield,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        dmLimit: null, // unlimited
        features: [
            'Unlimited AI Replies',
            'Up to 5 Instagram Accounts',
            'Multiple Workspaces',
            'Advanced Sales Analytics',
            'Priority Onboarding & Support',
        ],
        highlight: false,
        cta: 'Get Empire',
        ctaLink: '/register',
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
