import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
    // Skip auth for public API routes
    const { pathname } = request.nextUrl;
    if (
        pathname.startsWith('/api/webhook') ||   // /api/webhook/* and /api/webhooks/*
        pathname === '/api/contact'               // Public contact form
    ) {
        return NextResponse.next();
    }

    // 1. Handle Auth
    const response = await updateSession(request);

    // 2. FORCE SECURITY HEADERS (Allow Everything)
    response.headers.set('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';");

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
