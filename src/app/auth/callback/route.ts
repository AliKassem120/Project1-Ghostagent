import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    let origin = requestUrl.origin

    if (process.env.NEXTAUTH_URL) {
        origin = process.env.NEXTAUTH_URL
    } else if (process.env.VERCEL_URL) {
        origin = `https://${process.env.VERCEL_URL}`
    }

    const next = requestUrl.searchParams.get('next') ?? '/dashboard'

    console.log('Auth Handshake Started:', {
        hasCode: !!code,
        origin,
        next
    })

    if (code) {
        const supabase = await createClient()

        try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            if (!error) {
                console.log('Auth Handshake Successful for:', data.user?.email)

                // VERY IMPORTANT:
                // We use the LOCAL original origin if development so cookies don't break.
                // We use NEXTAUTH_URL equivalent if in production.
                const isLocal = request.url.includes('localhost') || request.url.includes('127.0.0.1');
                const finalOrigin = isLocal ? requestUrl.origin : origin;

                return NextResponse.redirect(`${finalOrigin}${next}`)
            } else {
                console.error('Auth Handshake Exchange Error:', error.message)
                return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?message=${encodeURIComponent(error.message)}`)
            }
        } catch (err: any) {
            console.error('Auth Handshake Unexpected Error:', err.message || err)
            return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?message=${encodeURIComponent(err.message || 'Unknown server error')}`)
        }
    }

    const errorParam = requestUrl.searchParams.get('error');
    const errorDescription = requestUrl.searchParams.get('error_description');

    if (errorParam || errorDescription) {
        console.error('Auth Handshake received OAuth error:', errorParam, errorDescription);
        return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?message=${encodeURIComponent(errorDescription || errorParam || 'Unknown OAuth Error')}`);
    }

    console.log('Auth Handshake Failed, Redirecting to Error Page (No Code or Error found. Full URL:', requestUrl.toString(), ')');
    return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?message=No_Code_Provided`)
}
