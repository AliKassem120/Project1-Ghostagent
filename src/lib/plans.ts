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
            'Instagram OR WhatsApp (pick one)',
            'E-Commerce or Appointments',
            'Live inventory & calendar sync',
            'Automated order & lead capture',
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
            'Instagram + WhatsApp (both channels)',
            'Auto-reply to Instagram comments',
            'Reply delay — feels human, not robotic',
            'Conversation handoff (take over from AI)',
            'Manager alerts to your WhatsApp',
            'Sales & booking analytics',
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
        price: 149,
        description: 'Scale across brands and teams',
        icon: Shield,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        dmLimit: 10000,
        features: [
            '10,000 AI replies / month',
            'Up to 3 workspaces (brands/clients)',
            'Instagram + WhatsApp on every workspace',
            'Team access — invite staff members',
            'Advanced analytics with revenue attribution',
            'Priority onboarding and support',
        ],
        highlight: false,
        cta: 'Get Empire',
        ctaLink: '/register',
        valueLine: 'For agencies and high-volume teams',
    },
];


/** Map a database tier string to a plan definition */
export function getPlanByTier(tier: string): PlanDefinition {
    const normalized = tier.toLowerCase().replace(/\s+/g, '_');
    if (normalized === 'pro' || normalized === 'pro_agent') return PLANS[1];
    if (normalized === 'empire') return PLANS[2];
    return PLANS[0]; // starter / unknown
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
