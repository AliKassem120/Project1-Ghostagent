'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

interface AutopilotContextType {
    autopilot: boolean;
    setAutopilot: (value: boolean) => void;
}

const AutopilotContext = createContext<AutopilotContextType | undefined>(undefined);

export function AutopilotProvider({ children }: { children: React.ReactNode }) {
    // Initialize state from localStorage if available (client-side only)
    const [autopilot, setAutopilotState] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('ghost_autopilot');
            return saved !== null ? saved === 'true' : true;
        }
        return true;
    });
    const [mounted, setMounted] = useState(false);

    // Mark as mounted after first render
    useEffect(() => {
        setMounted(true);
    }, []);

    const setAutopilot = useMemo(() => (value: boolean) => {
        setAutopilotState(value);
        if (typeof window !== 'undefined') {
            localStorage.setItem('ghost_autopilot', String(value));
        }
    }, []);

    // Return null or a skeleton during hydration to prevent mismatch
    if (!mounted) return null;

    return (
        <AutopilotContext.Provider value={{ autopilot, setAutopilot }}>
            {children}
        </AutopilotContext.Provider>
    );
}

export function useAutopilot() {
    const context = useContext(AutopilotContext);
    if (context === undefined) {
        throw new Error('useAutopilot must be used within an AutopilotProvider');
    }
    return context;
}
