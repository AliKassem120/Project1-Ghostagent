import { createClient } from '@supabase/supabase-js';

// Use Admin client for checking limits to bypass any RLS issues
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function checkUserLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
        // 1. Fetch user's plan and trial info
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

        // 2. Check if Paid Plan (including Starter, Pro, Empire)
        const planLower = plan.toLowerCase();
        const isPaidPlan = ['pro agent', 'empire', 'pro', 'starter'].includes(planLower);

        if (isPaidPlan) {
            // If they are on a paid plan but current_period_end is null, we assume they are active
            // (e.g., grandfathered users or manual DB entries).
            const periodEnd = user.current_period_end ? new Date(user.current_period_end) : new Date(Date.now() + 86400000);

            if (periodEnd >= new Date()) {
                return { allowed: true };
            } else {
                return { allowed: false, reason: 'Your subscription has expired.' };
            }
        }

        // 3. If Free Trial
        if (plan === 'free_trial') {
            const trialEnd = new Date(user.trial_ends_at || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
            if (trialEnd < new Date()) {
                return { allowed: false, reason: 'Your free trial has expired. Please upgrade to continue.' };
            }

            // Also check usage based on activity_log
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
            const FREE_LIMIT = 50;

            if (currentUsage >= FREE_LIMIT) {
                return { allowed: false, reason: `You have reached the monthly free limit of ${FREE_LIMIT} auto-replies.` };
            }

            return { allowed: true };
        }

        return { allowed: false, reason: 'Unknown plan tier.' };
    } catch (e) {
        console.error('Subscription check failed:', e);
        return { allowed: true }; // Fail open if error
    }
}
