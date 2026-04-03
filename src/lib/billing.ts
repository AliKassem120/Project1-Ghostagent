import { createClient } from '@supabase/supabase-js';
import { getReplyLimit } from '@/lib/plans';

// Use Admin client for checking limits to bypass any RLS issues
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function checkUserLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
        // 1. Fetch user's plan, trial info, and billing period
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('plan_tier, trial_ends_at, current_period_end')
            .eq('id', userId)
            .single();

        if (error || !user) {
            console.error('Error fetching user plan:', error);
            return { allowed: false, reason: 'Failed to retrieve plan information.' };
        }

        const plan = user.plan_tier || 'free_trial';
        const planLower = plan.toLowerCase();

        // 2. Empire = unlimited, no checks needed
        if (planLower === 'empire') {
            return { allowed: true };
        }

        // 3. All plans share the same monthly usage check (count AI replies this month)
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { count, error: countError } = await supabaseAdmin
            .from('activity_log')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .in('event_type', ['AI_REPLY', 'COMMENT_REPLY'])
            .gte('timestamp', firstDayOfMonth);

        if (countError) {
            console.error('Error fetching usage count:', countError);
        }

        const currentUsage = count || 0;

        // 4. Pro plan — 1,000 DMs/month cap
        const isPro = planLower === 'pro' || planLower === 'pro agent' || planLower === 'starter';

        if (planLower === 'pro' || planLower === 'pro agent') {
            // Verify subscription not expired
            const periodEnd = user.current_period_end ? new Date(user.current_period_end) : new Date(Date.now() + 86400000);
            if (periodEnd < new Date()) {
                return { allowed: false, reason: 'Your Pro subscription has expired. Please renew to continue.' };
            }
            const PRO_LIMIT = getReplyLimit('pro') ?? 1000;
            if (currentUsage >= PRO_LIMIT) {
                return { allowed: false, reason: `You've used all ${PRO_LIMIT.toLocaleString()} AI replies for this month. Upgrade to Empire for unlimited replies.` };
            }
            return { allowed: true };
        }

        // 5. Starter paid plan (if it ever becomes paid)
        if (planLower === 'starter') {
            const periodEnd = user.current_period_end ? new Date(user.current_period_end) : new Date(Date.now() + 86400000);
            if (periodEnd < new Date()) {
                return { allowed: false, reason: 'Your subscription has expired.' };
            }
            const STARTER_LIMIT = getReplyLimit('starter') ?? 50;
            if (currentUsage >= STARTER_LIMIT) {
                return { allowed: false, reason: `You've reached the ${STARTER_LIMIT}-reply limit this month. Upgrade to Pro for 1,000 replies/month.` };
            }
            return { allowed: true };
        }

        // 6. Free Trial — time-based + 50-reply cap
        if (plan === 'free_trial') {
            const trialEnd = new Date(user.trial_ends_at || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
            if (trialEnd < new Date()) {
                return { allowed: false, reason: 'Your free trial has expired. Upgrade to keep your AI agent running.' };
            }

            const FREE_LIMIT = getReplyLimit('starter') ?? 50;
            if (currentUsage >= FREE_LIMIT) {
                return { allowed: false, reason: `You've used all ${FREE_LIMIT} free replies this month. Upgrade to Pro to continue without interruption.` };
            }

            return { allowed: true };
        }

        return { allowed: false, reason: 'Unknown plan tier.' };
    } catch (e) {
        console.error('Subscription check failed:', e);
        return { allowed: true }; // Fail open on error to avoid blocking legit users
    }
}
