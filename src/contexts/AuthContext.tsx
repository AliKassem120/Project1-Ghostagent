'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
    user: User | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                // Check if we are returning from OAuth (Google sends tokens in hash)
                if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
                    console.log('OAuth return detected, waiting for session...');
                    return; // Keep loading=true, let onAuthStateChange handle the redirect
                }

                // Check active session
                const { data: { session } } = await supabase.auth.getSession();
                if (mounted) setUser(session?.user ?? null);

                // If we have a session and we're on a pure auth page, redirect
                if (session?.user && typeof window !== 'undefined') {
                    const currentPath = window.location.pathname;
                    if (currentPath === '/login' || currentPath === '/register') {
                        router.replace('/dashboard');
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                // Only stop loading if we didn't detect an OAuth hash
                if (mounted && (typeof window === 'undefined' || !window.location.hash.includes('access_token'))) {
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state change:', event);

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                if (mounted) {
                    setUser(session?.user ?? null);
                    setLoading(false);
                }

                // Only redirect on SIGNED_IN if user is on an auth page
                if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
                    const currentPath = window.location.pathname;
                    if (currentPath === '/login' || currentPath === '/register') {
                        router.replace('/dashboard');
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                if (mounted) {
                    setUser(null);
                    setLoading(false);
                }
                router.replace('/');
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [supabase, router]);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
