'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import { toggleAutopilotAction } from '@/app/actions/settings';

interface AutopilotContextType {
    autopilot: boolean;
    setAutopilot: (value: boolean) => Promise<void>;
    isLoading: boolean;
}

const AutopilotContext = createContext<AutopilotContextType | undefined>(undefined);

export function AutopilotProvider({ children }: { children: React.ReactNode }) {
    const [autopilot, setAutopilotState] = useState(true); // Default robust fallback
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();
    const toast = useToast();

    const fetchAutopilotStatus = useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('users')
                .select('is_autopilot_enabled')
                .eq('id', user.id)
                .single();

            if (data) {
                setAutopilotState(data.is_autopilot_enabled ?? true);
            }
        } catch (err) {
            console.error('Failed to fetch autopilot status:', err);
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchAutopilotStatus();
    }, [fetchAutopilotStatus]);

    // Sync on window focus
    useEffect(() => {
        const handleFocus = () => fetchAutopilotStatus(true);
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchAutopilotStatus]);

    const setAutopilot = async (value: boolean) => {
        // Optimistic update
        const previousValue = autopilot;
        setAutopilotState(value);

        try {
            await toggleAutopilotAction(value);

            toast.success(value ? "Autopilot Enabled" : "Autopilot Disabled", {
                description: value
                    ? "Replies are now sent automatically."
                    : "Replies will now require manual approval."
            });

        } catch (err) {
            console.error('Failed to update autopilot:', err);
            setAutopilotState(previousValue); // Revert on error
            toast.error("Failed to update autopilot status");
        }
    };

    return (
        <AutopilotContext.Provider value={{ autopilot, setAutopilot, isLoading }}>
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
