import { NextResponse } from 'next/server';
import { GOD_MODE_COOKIE } from '@/lib/god-mode/auth';

/**
 * POST /api/admin/logout
 * Clears the God Mode session cookie.
 */
export async function POST() {
    const response = NextResponse.json({ success: true, message: 'Logged out from God Mode' });
    
    // Clear the session cookie
    response.cookies.set(GOD_MODE_COOKIE, '', {
        path: '/',
        expires: new Date(0),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });

    return response;
}
