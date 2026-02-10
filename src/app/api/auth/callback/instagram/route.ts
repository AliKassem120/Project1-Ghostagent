import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // 1. Handle OAuth Errors
    if (error) {
        return NextResponse.redirect(new URL(`/dashboard/settings?error=${error}`, request.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL('/dashboard/settings?error=no_code', request.url));
    }

    try {
        // 2. Verify Session
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // 3. Exchange Code for Token
        const clientId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
        const clientSecret = process.env.FACEBOOK_APP_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET env vars');
        }

        const redirectUri = `${new URL(request.url).origin}/api/auth/callback/instagram`;
        const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${clientId}&redirect_uri=${redirectUri}&client_secret=${clientSecret}&code=${code}`;

        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            throw new Error(tokenData.error.message);
        }

        const accessToken = tokenData.access_token;
        const longLivedToken = accessToken; // In production, exchange for long-lived token here if needed.

        // 4. Fetch User Pages with Instagram Details
        const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`;
        const pagesRes = await fetch(pagesUrl);
        const pagesData = await pagesRes.json();

        // Find the first page that has a connected Instagram Business Account
        let targetAccountId = '';
        let targetUsername = '';
        let targetToken = accessToken; // Default to user token

        const connectedPage = pagesData.data?.find((p: any) => p.instagram_business_account?.id);

        if (connectedPage) {
            targetAccountId = connectedPage.instagram_business_account.id;
            targetUsername = connectedPage.name; // Page name (proxy for IG handle usually)
            // Ideally we'd also get the page access token if needed, but user token works for some calls.
            // Using User Token is safer for "managing" multiple assets.
        } else {
            // Fallback: Use the User ID or First Page ID
            // If no IG account is linked, this connection might be useless for the bot, but we store it anyway.
            const userProfileRes = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);
            const userProfile = await userProfileRes.json();
            targetAccountId = userProfile.id;
            targetUsername = userProfile.name || 'Facebook User';
        }

        // 5. Store Token in DB
        const connectionData = {
            access_token: targetToken,
            provider: 'instagram_graph_api',
            connected_at: new Date().toISOString(),
            token_type: 'user_access_token',
            pages: pagesData.data || [],
            instagram_account_id: targetAccountId
        };

        const { error: dbError } = await supabase.from('user_connections').upsert({
            user_id: user.id,
            provider: 'INSTAGRAM',
            account_id: targetAccountId, // Allows webhook to match recipient.id
            account_username: targetUsername,
            metadata: connectionData
        }, { onConflict: 'account_id' });

        if (dbError) throw dbError;

        // 6. Redirect Success
        return NextResponse.redirect(new URL('/dashboard/settings?success=true', request.url));

    } catch (err: any) {
        console.error('Instagram Callback Error:', err);
        return NextResponse.redirect(new URL(`/dashboard/settings?error=${encodeURIComponent(err.message)}`, request.url));
    }
}
