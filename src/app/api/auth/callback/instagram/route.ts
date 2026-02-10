import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = request.nextUrl; // Use dynamic origin
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const errorReason = searchParams.get("error_reason");
    const errorDescription = searchParams.get("error_description");

    const appUrl = origin; // e.g. http://localhost:3000 or https://myapp.com

    if (errorParam) {
        console.error('Instagram Auth Error:', errorParam, errorReason, errorDescription);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?error=${errorParam}&details=${encodeURIComponent(errorDescription || '')}`);
    }

    if (!code) {
        return NextResponse.redirect(`${appUrl}/dashboard/settings?error=no_code`);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(`${appUrl}/login?error=unauthorized`);
    }

    try {
        // 1. Exchange Code for Access Token
        // CRITICAL: The redirect_uri here MUST match exactly what was used on the client side login button.
        // We use the request origin to ensure consistency.
        const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}&redirect_uri=${appUrl}/api/auth/callback/instagram&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${code}`;

        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error('FB Token Error:', tokenData.error);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?error=token_exchange_failed&details=${encodeURIComponent(tokenData.error.message)}`);
        }

        const accessToken = tokenData.access_token;

        // 2. Fetch User Pages to find Linked Instagram Account
        // We use v21.0 as requested for most up-to-date fields
        const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`;
        const pagesRes = await fetch(pagesUrl);
        const pagesData = await pagesRes.json();

        let targetAccountId = '';
        let targetUsername = '';
        let targetToken = accessToken; // Will switch to Page Token if possible

        console.log(`[Instagram Callback] Found ${pagesData.data?.length || 0} pages.`);

        if (pagesData.data && Array.isArray(pagesData.data)) {
            for (const page of pagesData.data) {
                // Check if IG ID is already present from initial fetch
                let instagramId = page.instagram_business_account?.id;

                // Verification: If missing, try explicit fetch as per rigorous standard (v21.0)
                // This handles edge cases where the field might be omitted in the list view
                if (!instagramId && page.id && page.access_token) {
                    try {
                        const igRes = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
                        const igData = await igRes.json();
                        instagramId = igData.instagram_business_account?.id;
                        console.log(`[Instagram Callback] Explicit fetch for Page ${page.id}: Found IG ${instagramId}`);
                    } catch (err) {
                        console.error(`Failed to check IG for page ${page.id}:`, err);
                    }
                }

                if (instagramId) {
                    console.log(`✅ Found Instagram Account ${instagramId} linked to Page ${page.name}`);
                    targetAccountId = instagramId;
                    targetUsername = page.name;
                    targetToken = page.access_token; // Use Page Token for future operations (sending messages)
                    break; // Stop at the first valid one
                }
            }
        }

        if (!targetAccountId) {
            console.error('❌ No Instagram Business Account found linked to any page.');
            // Robust Error Handling: Redirect back with explicit error
            return NextResponse.redirect(`${origin}/dashboard/settings?error=no_instagram_business_account_linked`);
        }

        // 3. Store Connection in DB
        // We store the INSTAGRAM ACCOUNT ID as the account_id, so webhooks match.
        const connectionData = {
            access_token: targetToken, // Page Token
            provider: 'instagram_graph_api',
            connected_at: new Date().toISOString(),
            token_type: 'page_access_token',
            pages: pagesData.data || [],
            instagram_account_id: targetAccountId
        };

        const { error: dbError } = await supabase.from('user_connections').upsert({
            user_id: user.id,
            provider: 'INSTAGRAM',
            account_id: targetAccountId, // Allows webhook to match recipient.id (178...)
            account_username: targetUsername,
            metadata: connectionData
        }, { onConflict: 'account_id' });

        if (dbError) {
            console.error('DB Error:', dbError);
            return NextResponse.redirect(`${origin}/dashboard/settings?error=db_save_failed`);
        }

        return NextResponse.redirect(`${origin}/dashboard/settings?success=instagram_connected`);
    } catch (error) {
        console.error('Callback Error:', error);
        return NextResponse.redirect(`${origin}/dashboard/settings?error=server_error`);
    }
}
