"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { createClient } from "@/utils/supabase/client";

// Extending the Window interface to include google
declare global {
    interface Window {
        google?: any;
    }
}

interface GoogleSignInButtonProps {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

export default function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const buttonRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();
    const [isSigniningIn, setIsSigniningIn] = useState(false);

    useEffect(() => {
        // Check if the script is already loaded
        if (typeof window !== "undefined" && window.google) {
            setIsScriptLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!isScriptLoaded || !buttonRef.current || !window.google) return;

        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

        if (!clientId) {
            console.error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable.");
            // We'll let the UI handle showing the error
            return;
        }

        // Callback that handles the response from Google
        const handleCredentialResponse = async (response: any) => {
            try {
                setIsSigniningIn(true);
                // Exchange the ID token with Supabase
                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: "google",
                    token: response.credential,
                });

                if (error) throw error;

                // Optionally, handle successful sign-in
                if (onSuccess) onSuccess();
            } catch (error: any) {
                console.error("Error signing in with Google ID token:", error);
                if (onError) onError(error);
            } finally {
                setIsSigniningIn(false);
            }
        };

        // Initialize Google Identity Services
        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            // You can add context if needed (e.g., "signin", "signup", "use")
            context: "signin",
            // Optional: Cancel on tap outside for one-tap
            cancel_on_tap_outside: false,
        });

        // Render the Google Sign-In button
        // You can customize the theme, size, shape, logo_alignment, etc.
        window.google.accounts.id.renderButton(buttonRef.current, {
            theme: "outline",
            size: "large",
            type: "standard",
            text: "signin_with",
            shape: "rectangular",
        });

        // Optional: display prompt for One Tap
        // window.google.accounts.id.prompt();

    }, [isScriptLoaded, supabase, onSuccess, onError]);

    return (
        <div className="flex flex-col items-center justify-center w-full">
            {/* Load Google Identity Services Script */}
            <Script
                src="https://accounts.google.com/gsi/client"
                strategy="afterInteractive"
                onLoad={() => setIsScriptLoaded(true)}
                onError={() => console.error("Failed to load Google Identity Services API")}
            />

            <div
                ref={buttonRef}
                className="w-full flex items-center justify-center"
            >
                {!isScriptLoaded && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                    <p className="text-sm text-gray-400">Loading Google Sign-In...</p>
                )}
                {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                        Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local<br />
                        (Please restart your dev server if you just added it)
                    </div>
                )}
            </div>

            {isSigniningIn && (
                <p className="mt-2 text-sm text-gray-500 animate-pulse">
                    Signing in...
                </p>
            )}
        </div>
    );
}
