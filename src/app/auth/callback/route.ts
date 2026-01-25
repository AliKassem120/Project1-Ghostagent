import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    // Robust origin detection for production
    let origin = requestUrl.origin
    if (process.env.VERCEL_URL) {
        origin = `https://${process.env.VERCEL_URL}`
    }

    const next = requestUrl.searchParams.get('next') ?? '/dashboard'

    console.log('Auth Handshake Started:', {
        hasCode: !!code,
        origin,
        next
    })

    if (code) {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value, ...options })
                        } catch (error) {
                            console.warn('Cookie set failure (likely SSR):', error)
                        }
                    },
                    remove(name: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value: '', ...options })
                        } catch (error) {
                            console.warn('Cookie remove failure (likely SSR):', error)
                        }
                    },
                },
            }
        )

        try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            if (!error) {
                console.log('Auth Handshake Successful for:', data.user?.email)
                return NextResponse.redirect(`${origin}${next}`)
            } else {
                console.error('Auth Handshake Exchange Error:', error.message)
            }
        } catch (err) {
            console.error('Auth Handshake Unexpected Error:', err)
        }
    }

    console.log('Auth Handshake Failed, Redirecting to Error Page')
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
