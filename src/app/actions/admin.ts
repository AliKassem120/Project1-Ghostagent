"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

const getAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
};

// Ali's known emails + environment variable
const ADMIN_EMAILS = [
    "alisalemkassem@gmail.com",
    "alikassem120@gmail.com",
    "alikm120@gmail.com",
    "ali_kassem120@hotmail.com",
    "contact@ghostagent.qzz.io",
];

export async function checkIsAdmin() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) return false;

    const email = user.email.toLowerCase();
    const envAdmin = process.env.ADMIN_EMAIL?.toLowerCase();

    return ADMIN_EMAILS.includes(email) || (envAdmin && email === envAdmin);
}

export async function getGodModeData() {
    // Auth is handled by /api/admin/login + sessionStorage on the client.
    // This server action trusts the client-side gate and fetches data directly.

    const adminClient = getAdminClient();

    try {
        // 1. Fetch Users Info
        // Note: Using auth.admin requires SUPABASE_SERVICE_ROLE_KEY in .env
        const { data: authData, error: authErr } = await adminClient.auth.admin.listUsers();
        if (authErr) {
             console.error("Auth admin error, missing service role key?", authErr);
        }
        
        const authUsers = authData?.users || [];

        // 2. Fetch public users data and metrics
        const [{ data: publicUsers }, { data: integrations }, { data: activities }, { data: orders }] = await Promise.all([
            adminClient.from("users").select("*"),
            adminClient.from("instagram_integrations").select("user_id, username, created_at"),
            // Only count activity per user
            adminClient.from("activity_log").select("user_id, event_type"),
            adminClient.from("orders").select("user_id, status, created_at")
        ]);

        // 3. Process & Merge Data
        let totalMRR = 0;
        let proUsers = 0;
        let empireUsers = 0;
        
        const userMap = new Map();

        // Initialize user map from auth users (if available) or public users
        (publicUsers || []).forEach(pu => {
            userMap.set(pu.id, {
                id: pu.id,
                email: "Hidden (Add Service Key)",
                name: "User",
                plan: pu.plan_tier || "free_trial",
                created_at: pu.trial_ends_at ? new Date(new Date(pu.trial_ends_at).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString() : new Date().toISOString(),
                ig_accounts: 0,
                bot_replies: 0,
                orders_processed: 0,
            });
        });

        // Merge Auth Data
        if (authUsers.length > 0) {
            authUsers.forEach(au => {
                if (!userMap.has(au.id)) {
                    userMap.set(au.id, { id: au.id, plan: 'free_trial', ig_accounts: 0, bot_replies: 0, orders_processed: 0 });
                }
                const existing = userMap.get(au.id);
                existing.email = au.email;
                existing.name = au.user_metadata?.full_name || "Unknown";
                existing.created_at = au.created_at;
            });
        }

        // Count Integrations
        (integrations || []).forEach(ig => {
            if (userMap.has(ig.user_id)) {
                userMap.get(ig.user_id).ig_accounts += 1;
            }
        });

        // Count Activity (replies)
        (activities || []).forEach(act => {
            if (userMap.has(act.user_id) && (act.event_type === 'AI_REPLY' || act.event_type === 'COMMENT_REPLY')) {
                userMap.get(act.user_id).bot_replies += 1;
            }
        });
        
        // Count Orders
        (orders || []).forEach(o => {
             if (userMap.has(o.user_id)) {
                 userMap.get(o.user_id).orders_processed += 1;
             }
        });

        const usersList = Array.from(userMap.values());

        // Calculate Stats
        usersList.forEach(u => {
            const plan = u.plan?.toLowerCase() || '';
            if (plan === 'pro' || plan === 'pro agent') {
                proUsers += 1;
                totalMRR += 49;
            } else if (plan === 'empire') {
                empireUsers += 1;
                totalMRR += 199; // Estimated
            } else if (plan === 'starter') {
                totalMRR += 9;
            }
        });

        // Sort by newest
        usersList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return {
            success: true,
            metrics: {
                totalUsers: usersList.length,
                totalMRR,
                activeBots: (integrations || []).length,
                totalReplies: (activities || []).filter(a => a.event_type?.includes('REPLY')).length,
                proUsers,
                empireUsers
            },
            users: usersList
        };

    } catch (e: any) {
        console.error("God Mode Error:", e.message);
        return { success: false, error: e.message };
    }
}
