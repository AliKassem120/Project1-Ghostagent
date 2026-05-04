import { NextResponse } from 'next/server';
import { isGodModeUser, GOD_MODE_COOKIE, GOD_MODE_TOKEN } from '@/lib/god-mode/auth';

/**
 * God Mode Admin Login API
 * Validates credentials and sets a session cookie.
 */
export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        if (isGodModeUser(username, password)) {
            const response = NextResponse.json({ success: true });
            response.cookies.set(GOD_MODE_COOKIE, GOD_MODE_TOKEN, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24, // 24 hours
            });
            return response;
        }

        return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    } catch {
        return NextResponse.json({ success: false, error: 'Bad request' }, { status: 400 });
    }
}
