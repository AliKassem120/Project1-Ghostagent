import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        // Fallback to NEXT_PUBLIC_SITE_URL or origin
        const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin;

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${origin}/api/calendar/callback`
        );

        // Access type offline and prompt consent force google to return a refresh token
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['https://www.googleapis.com/auth/calendar'],
        });

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error('Error generating Google OAuth URL:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
