import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin;

        if (!code) {
            return NextResponse.redirect(`${origin}/dashboard/calendar?error=no_code`);
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${origin}/api/calendar/callback`
        );

        // Exchange authorization code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        // Get the logged in user using Supabase server client
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('User not authenticated during calendar callback');
            return NextResponse.redirect(`${origin}/dashboard?error=unauthorized`);
        }

        // Only update if Google returned a refresh token 
        // We requested access_type: 'offline' and prompt: 'consent', so we should get one.
        if (tokens.refresh_token) {
            const { error: updateError } = await supabase
                .from('users')
                .update({ google_refresh_token: tokens.refresh_token })
                .eq('id', user.id);

            if (updateError) {
                console.error('Error updating user with google refresh token:', updateError);
                return NextResponse.redirect(`${origin}/dashboard/calendar?error=database_error`);
            }
        }

        // Redirect back to calendar success state
        return NextResponse.redirect(`${origin}/dashboard/calendar?success=true`);
    } catch (error) {
        console.error('Error in Google Calendar callback:', error);

        const url = new URL(req.url);
        const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin;
        return NextResponse.redirect(`${origin}/dashboard/calendar?error=exchange_failed`);
    }
}
