'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import StarBackground from '@/components/StarBackground';
import { useEffect, useState } from 'react';

export default function AuthCodeErrorPage() {
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        // Safe robust way to get query params without breaking Next.js layout SSR
        const params = new URLSearchParams(window.location.search);
        if (params.get('message')) {
            setErrorMessage(params.get('message'));
        }
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
            <StarBackground />

            <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="glass-dark p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl text-center">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-red-500/20 rounded-full">
                            <AlertTriangle className="w-12 h-12 text-red-400" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
                    <p className="text-white/60 mb-4">
                        There was a problem exchanging your authentication code for a session. This can happen if the link expired or was already used.
                    </p>

                    {errorMessage && (
                        <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono break-words text-left">
                            <p className="font-bold mb-1 uppercase text-red-500 tracking-wider">Exact Error:</p>
                            {errorMessage}
                        </div>
                    )}

                    <div className="space-y-4 pt-2">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 bg-primary text-black font-bold py-3 px-8 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all w-full justify-center"
                        >
                            Return to Login
                        </Link>

                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
