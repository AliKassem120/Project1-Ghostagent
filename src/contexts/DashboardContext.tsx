'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface DashboardContextType {
    version: number;
    refreshDashboard: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
    const [version, setVersion] = useState(0);

    // Call this function whenever you modify data (add item, send message)
    // to notify all listeners to re-fetch.
    const refreshDashboard = useCallback(() => {
        console.log('[DashboardContext] Triggering refresh (Version: ' + (version + 1) + ')');
        setVersion(v => v + 1);
    }, [version]);

    return (
        <DashboardContext.Provider value={{ version, refreshDashboard }}>
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
}
