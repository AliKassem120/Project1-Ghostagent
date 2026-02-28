"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";

interface GoogleSignInButtonProps {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

export default function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
    const [isSigningIn, setIsSigningIn] = useState(false);

    const handleGoogleLogin = () => {
        setIsSigningIn(true);
        try {
            const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
            if (!clientId) {
                throw new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable.");
            }

            // Generate a secure random nonce to prevent replay attacks
            const array = new Uint32Array(8);
            window.crypto.getRandomValues(array);
            const nonce = Array.from(array, dec => dec.toString(16).padStart(8, "0")).join("");

            // Store it to verify on the callback
            localStorage.setItem("google_oauth_nonce", nonce);

            // Our new pure domain-relative callback path!
            const redirectUri = `${window.location.origin}/auth/google-callback`;

            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: "id_token",
                scope: "openid email profile",
                nonce: nonce,
                prompt: "select_account",
            });

            const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

            // Redirect straight to Google (bypassing Supabase OAuth servers completely)
            window.location.href = googleAuthUrl;
        } catch (error: any) {
            console.error("Error setting up Google Auth URL:", error);
            if (onError) onError(error);
            setIsSigningIn(false);
        }
    };

    return (
        <button
            onClick={handleGoogleLogin}
            disabled={isSigningIn}
            className={clsx(
                "relative flex items-center justify-center gap-3 w-full sm:w-[400px] h-[52px]",
                "bg-surface-1 hover:bg-surface-2 text-foreground font-bold text-[15px]",
                "border border-border rounded-xl shadow-sm",
                "transition-all duration-300 ease-in-out",
                "hover:-translate-y-0.5 hover:shadow-md",
                "active:translate-y-0 active:shadow-none hover:scale-[1.01]",
                "disabled:opacity-70 disabled:cursor-not-allowed group overflow-hidden"
            )}
        >
            {/* Subtle glow effect behind the text */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-100/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

            {isSigningIn ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400 relative z-10" />
            ) : (
                <div className="flex items-center gap-3 relative z-10 transition-transform duration-300 group-hover:scale-105">
                    <svg className="w-[18px] h-[18px] shrink-0 drop-shadow-sm" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </div>
            )}
        </button>
    );
}
