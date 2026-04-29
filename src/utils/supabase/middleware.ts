import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Strip locale prefix to check routes correctly
    const cleanPath = request.nextUrl.pathname.replace(/^\/(en|ar|fr|es)/, '') || '/';
    
    const isPublicRoute = 
        cleanPath === '/' ||
        cleanPath.startsWith('/login') ||
        cleanPath.startsWith('/auth') ||
        cleanPath.startsWith('/register') ||
        cleanPath.startsWith('/forgot-password') ||
        cleanPath.startsWith('/privacy') ||
        cleanPath.startsWith('/terms') ||
        cleanPath.startsWith('/contact') ||
        cleanPath.startsWith('/about') ||
        cleanPath.startsWith('/demo-recording') ||
        cleanPath.startsWith('/demo');

    if (!user && !isPublicRoute) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
