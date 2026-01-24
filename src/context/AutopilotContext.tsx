'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AutopilotContextType {
    autopilot: boolean;
    setAutopilot: (value: boolean) => void;
}

const AutopilotContext = createContext<AutopilotContextType | undefined>(undefined);

export function AutopilotProvider({ children }: { children: React.ReactNode }) {
    const [autopilot, setAutopilotState] = useState(true);
    const [mounted, setMounted] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('ghost_autopilot');
        if (saved !== null) {
            setAutopilotState(saved === 'true');
        }
    }, []);

    const setAutopilot = (value: boolean) => {
        setAutopilotState(value);
        localStorage.setItem('ghost_autopilot', String(value));
    };

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
