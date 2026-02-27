import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = request.nextUrl; // Use dynamic origin
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state"); // workspace_id passed via OAuth state
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
        // Must use form-urlencoded for the Instagram API
        const tokenDataObj = new URLSearchParams();
        tokenDataObj.append('client_id', process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID!);
        tokenDataObj.append('client_secret', process.env.INSTAGRAM_APP_SECRET!);
        tokenDataObj.append('grant_type', 'authorization_code');
        tokenDataObj.append('redirect_uri', `${appUrl}/api/auth/callback/instagram`);
        tokenDataObj.append('code', code);

        const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
            method: 'POST',
            body: tokenDataObj,
        });

        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error('FB Token Error:', tokenData.error);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?error=token_exchange_failed&details=${encodeURIComponent(tokenData.error.message)}`);
        }

        // For Instagram Business Login, this is a short-lived Instagram User Access Token
        const shortLivedToken = tokenData.access_token;
        const instagramUserId = tokenData.user_id;

        // Optionally exchange for Long-Lived Token (recommended for backend ops)
        const longLivedRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`);
        const longLivedData = await longLivedRes.json();

        const accessToken = longLivedData.access_token || shortLivedToken;

        // 2. Fetch User Profile from Instagram Graph API
        // CRITICAL: Request `user_id` because `id` is app-scoped, but webhooks use `user_id` (the Global IP ID starting with 178...)
        const profileUrl = `https://graph.instagram.com/v21.0/me?fields=id,user_id,username,name&access_token=${accessToken}`;
        const profileRes = await fetch(profileUrl);
        const profileData = await profileRes.json();

        if (profileData.error) {
            console.error('IG Profile Fetch Error:', profileData.error);
            return NextResponse.redirect(`${origin}/dashboard/settings?error=profile_fetch_failed&details=${encodeURIComponent(profileData.error.message)}`);
        }

        // We MUST use user_id if available, otherwise fallback to id.
        const targetAccountId = profileData.user_id || profileData.id;
        const targetUsername = profileData.username || profileData.name || 'Instagram User';

        // 3. Store Connection in DB
        // We store the INSTAGRAM ACCOUNT ID as the account_id, so webhooks match.
        const connectionData = {
            access_token: accessToken, // Instagram User Access Token
            provider: 'instagram_api_login',
            connected_at: new Date().toISOString(),
            token_type: 'instagram_user_access_token',
            instagram_account_id: targetAccountId,
            user_id: instagramUserId
        };

        const { error: dbError } = await supabase.from('user_connections').upsert({
            user_id: user.id,
            provider: 'INSTAGRAM',
            account_id: targetAccountId,
            account_username: targetUsername,
            workspace_id: stateParam || null, // Link to the active workspace
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
