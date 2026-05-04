import { NextResponse } from 'next/server';

/**
 * God Mode Admin Login API
 * Validates credentials against env vars.
 * No Supabase auth needed — standalone admin gate.
 */
export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        const validUser = process.env.GOD_MODE_USER || 'ghost123agent';
        const validPass = process.env.GOD_MODE_PASS || 'agentgodmode';

        if (username === validUser && password === validPass) {
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    } catch {
        return NextResponse.json({ success: false, error: 'Bad request' }, { status: 400 });
    }
}
