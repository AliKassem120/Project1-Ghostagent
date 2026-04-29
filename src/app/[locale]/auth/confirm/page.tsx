'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2 } from 'lucide-react';
import StarBackground from '@/components/StarBackground';

function ConfirmAuthLogic() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const handleAuth = async () => {
            const supabase = createClient();

            // 1. Check for explicit OAuth errors in URL
            const errorParam = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');
            if (errorParam || errorDescription) {
                const msg = errorDescription || errorParam || 'Unknown OAuth Error';
                router.push('/auth/auth-code-error?message=' + encodeURIComponent(msg));
                return;
            }

            // 2. Try to exchange PKCE code if it exists
            const code = searchParams.get('code');
            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    router.push('/auth/auth-code-error?message=' + encodeURIComponent(error.message));
                    return;
                }
            }

            // 3. Wait for Supabase to parse hash fragments or use the newly acquired session
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                router.push('/auth/auth-code-error?message=' + encodeURIComponent(error.message));
            } else if (session) {
                // Add a tiny delay to ensure cookies are flushed
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 500);
            } else {
                // If it fails immediately, it might be parsing the hash still, 
                // but usually getSession() is synchronised.
                // Let's add an explicit observer just in case.
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
                    if (newSession) {
                        window.location.href = '/dashboard';
                    }
                });

                // Set a timeout to fail if no session is found after 3 seconds
                setTimeout(() => {
                    subscription.unsubscribe();
                    if (!window.location.href.includes('/dashboard')) {
                        router.push('/auth/auth-code-error?message=No_Session_Or_Code_Found_After_Delay');
                    }
                }, 3000);
            }
        };

        handleAuth();
    }, [router, searchParams]);

    return null;
}

export default function ConfirmAuthPage() {
    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-6 relative overflow-x-clip bg-background">
            <StarBackground />
            <div className="w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="glass-dark p-8 rounded-3xl border border-white/10 shadow-2xl text-center flex flex-col items-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                    <h1 className="text-xl font-bold text-white mb-2">Verifying Login</h1>
                    <p className="text-sm text-white/50">Securing your session, please wait...</p>
                </div>
            </div>
            <Suspense fallback={null}>
                <ConfirmAuthLogic />
            </Suspense>
        </div>
    );
}
