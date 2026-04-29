import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip everything for API routes and webhooks
    if (
        pathname.startsWith('/api/webhook') ||
        pathname === '/api/contact' ||
        pathname.startsWith('/api/')
    ) {
        return NextResponse.next();
    }

    // 1. Run next-intl middleware (locale detection + routing)
    const intlResponse = intlMiddleware(request);

    // If intlMiddleware returns a redirect, return it immediately
    if (intlResponse.headers.get('location')) {
        return intlResponse;
    }

    // 2. Handle Auth (Supabase session refresh)
    const response = await updateSession(request);

    // 3. Copy next-intl cookies to auth response
    for (const cookie of intlResponse.cookies.getAll()) {
        response.cookies.set(cookie.name, cookie.value, cookie);
    }

    // 4. Copy next-intl headers
    intlResponse.headers.forEach((value, key) => {
        if (!key.startsWith('set-cookie')) {
            response.headers.set(key, value);
        }
    });

    // 5. FORCE SECURITY HEADERS
    response.headers.set('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';");

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webm|mp4|ico)$).*)',
    ],
};
