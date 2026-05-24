import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/callback/whatsapp
// Called from the client after Meta Embedded Signup completes successfully.
// Receives: { code, workspaceId }
// Exchanges code → system user token → WABA + phone number ID
// Saves credentials to ai_settings for the workspace.
// ──────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify Pro+ plan
    const { data: userData } = await supabase.from('users').select('plan_tier').eq('id', user.id).single();
    const plan = (userData?.plan_tier || 'starter').toLowerCase();
    if (plan !== 'pro' && plan !== 'empire' && plan !== 'free_trial') {
        return NextResponse.json({ error: 'WhatsApp requires Pro or Empire plan.' }, { status: 403 });
    }

    const { code, workspaceId } = await req.json();
    if (!code || !workspaceId) {
        return NextResponse.json({ error: 'Missing code or workspaceId' }, { status: 400 });
    }

    // Verify workspace belongs to this user
    const { data: ws } = await supabase.from('ai_settings').select('id').eq('id', workspaceId).eq('user_id', user.id).single();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    try {
        // Step 1: Exchange code for a user access token
        const appId = process.env.FACEBOOK_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
        const appSecret = process.env.FACEBOOK_APP_SECRET;
        const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/whatsapp`;

        const tokenRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`,
            { method: 'GET' }
        );
        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.error('[WA Signup] Token exchange failed:', tokenData);
            return NextResponse.json({ error: 'Failed to exchange code for token' }, { status: 500 });
        }

        const userAccessToken = tokenData.access_token;

        // Step 2: Get the WABA and phone number ID from the token's businesses
        const wabaRes = await fetch(
            `https://graph.facebook.com/v19.0/debug_token?input_token=${userAccessToken}&access_token=${appId}|${appSecret}`
        );
        const wabaData = await wabaRes.json();
        console.log('[WA Signup] Token debug:', JSON.stringify(wabaData));

        // Step 3: Get WhatsApp Business Accounts linked to this token
        const accountsRes = await fetch(
            `https://graph.facebook.com/v19.0/me/businesses?fields=id,name,whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number}}&access_token=${userAccessToken}`
        );
        const accountsData = await accountsRes.json();
        console.log('[WA Signup] Businesses:', JSON.stringify(accountsData));

        // Extract first WABA and phone number
        const business = accountsData?.data?.[0];
        const waba = business?.whatsapp_business_accounts?.data?.[0];
        const phone = waba?.phone_numbers?.data?.[0];

        if (!waba || !phone) {
            return NextResponse.json({
                error: 'No WhatsApp Business Account found. Make sure you completed the embedded signup and selected a phone number.',
                debug: accountsData
            }, { status: 400 });
        }

        const wabaId = waba.id;
        const phoneNumberId = phone.id;
        const displayPhone = phone.display_phone_number;

        // Step 4: Save credentials to ai_settings
        const { error: saveErr } = await supabase.from('ai_settings').update({
            whatsapp_business_account_id: wabaId,
            whatsapp_phone_number_id: phoneNumberId,
            whatsapp_access_token: userAccessToken,
            updated_at: new Date().toISOString(),
        }).eq('id', workspaceId);

        if (saveErr) {
            console.error('[WA Signup] Save error:', saveErr);
            return NextResponse.json({ error: 'Failed to save WhatsApp credentials' }, { status: 500 });
        }

        // Step 5: Auto-provision WhatsApp message templates
        try {
            const { provisionAllTemplates } = await import('@/lib/whatsapp/templates');
            const templateResults = await provisionAllTemplates(wabaId, userAccessToken);
            console.log('[WA Signup] Templates provisioned:', JSON.stringify(templateResults));
        } catch (templateErr) {
            // Non-fatal — templates can be provisioned later
            console.error('[WA Signup] Template provisioning failed (non-fatal):', templateErr);
        }

        return NextResponse.json({
            success: true,
            waba_id: wabaId,
            phone_number_id: phoneNumberId,
            display_phone: displayPhone,
        });

    } catch (err: any) {
        console.error('[WA Signup] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
