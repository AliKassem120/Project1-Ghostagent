'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import StarBackground from '@/components/StarBackground';
import Link from 'next/link';

function GoogleCallbackLogic() {
    const router = useRouter();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const handleGoogleResponse = async () => {
            try {
                // Google Implicit Flow places the response in the URL hash fragment
                const hash = window.location.hash;
                if (!hash || hash === '') {
                    // Check if there's an error in query params instead
                    const queryParams = new URLSearchParams(window.location.search);
                    if (queryParams.get('error')) {
                        throw new Error(queryParams.get('error_description') || queryParams.get('error') || 'OAuth request failed');
                    }
                    throw new Error("No token received from Google. Are you sure you completed the sign in?");
                }

                // Parse the hash parameters
                const params = new URLSearchParams(hash.substring(1));

                const error = params.get("error");
                const errorDescription = params.get("error_description");
                if (error) {
                    throw new Error(errorDescription || error);
                }

                const idToken = params.get("id_token");
                if (!idToken) {
                    throw new Error("No ID Token found in response.");
                }

                // Verify the nonce we stored before redirecting
                const storedNonce = localStorage.getItem("google_oauth_nonce") || undefined;

                const supabase = createClient();
                const { data, error: signInError } = await supabase.auth.signInWithIdToken({
                    provider: "google",
                    token: idToken,
                    nonce: storedNonce,
                });

                if (signInError) {
                    throw signInError;
                }

                // Cleanup security nonce
                localStorage.removeItem("google_oauth_nonce");

                // Success! Redirect to dashboard immediately
                window.location.href = "/dashboard";
            } catch (err: any) {
                console.error("Google Auth OIDC Error:", err);
                setErrorMsg(err.message || "An unknown error occurred during authentication.");
            }
        };

        handleGoogleResponse();
    }, [router]);

    if (errorMsg) {
        return (
            <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="glass-dark p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl text-center">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-red-500/20 rounded-full">
                            <AlertTriangle className="w-12 h-12 text-red-400" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
                    <p className="text-white/60 mb-4 text-sm">
                        There was a problem verifying your Google ID token.
                    </p>
                    <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono break-words text-left">
                        <p className="font-bold mb-1 uppercase text-red-500 tracking-wider">Exact Error:</p>
                        {errorMsg}
                    </div>
                    <div className="space-y-4 pt-2">
                        <Link href="/login" className="inline-flex items-center gap-2 bg-primary text-black font-bold py-3 px-8 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all w-full justify-center">
                            Return to Login
                        </Link>
                        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
                            <ArrowLeft className="w-4 h-4" /> Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="glass-dark p-8 rounded-3xl border border-white/10 shadow-2xl text-center flex flex-col items-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <h1 className="text-xl font-bold text-white mb-2">Verifying Google Sign-In</h1>
                <p className="text-sm text-white/50">Securing your session securely...</p>
            </div>
        </div>
    );
}

export default function GoogleCallbackPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-background">
            <StarBackground />
            <Suspense fallback={null}>
                <GoogleCallbackLogic />
            </Suspense>
        </div>
    );
}
