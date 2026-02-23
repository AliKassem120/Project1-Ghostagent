'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
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
    const pathname = usePathname();
    const supabase = createClient();

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Check if we are returning from OAuth (Google sends tokens in hash)
                if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
                    console.log('OAuth return detected, waiting for session...');
                    return; // Keep loading=true, let onAuthStateChange handle the redirect
                }

                // Check active session
                const { data: { session } } = await supabase.auth.getSession();
                setUser(session?.user ?? null);

                // If we have a session and we're on a public page, redirect to dashboard
                // This handles the "Double Login" - if we land on /login with a valid session
                if (session?.user && (pathname === '/login' || pathname === '/register')) {
                    router.replace('/dashboard');
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                // Only stop loading if we didn't detect an OAuth hash
                if (typeof window === 'undefined' || !window.location.hash.includes('access_token')) {
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state change:', event);

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                setUser(session?.user ?? null);
                setLoading(false);

                // Only redirect on SIGNED_IN if user is on a public auth page (actual login)
                // Do NOT redirect if user is already on a dashboard page (token refresh)
                if (event === 'SIGNED_IN') {
                    const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/';
                    if (isAuthPage) {
                        router.replace('/dashboard');
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setLoading(false);
                router.replace('/');
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router, pathname, supabase]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0E14] text-white">
                <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                        <div className="relative p-4 rounded-2xl bg-[#151921] border border-white/5 shadow-2xl">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <h2 className="text-lg font-medium tracking-tight">Syncing Session</h2>
                        <p className="text-sm text-white/40">Connecting to Ghost Agent...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
