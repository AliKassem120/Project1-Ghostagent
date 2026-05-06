'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';


interface AutopilotContextType {
    autopilot: boolean | null;
    setAutopilot: (value: boolean) => Promise<void>;
    isLoading: boolean;
}

const AutopilotContext = createContext<AutopilotContextType | undefined>(undefined);

export function AutopilotProvider({ children }: { children: React.ReactNode }) {
    const [autopilot, setAutopilotState] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const { activeWorkspaceId } = useWorkspace();
    const supabase = createClient();
    const toast = useToast();
    const latestWorkspaceIdRef = useRef(activeWorkspaceId);
    latestWorkspaceIdRef.current = activeWorkspaceId;

    const fetchAutopilotStatus = useCallback(async (isSilent = false) => {
        try {
            if (!activeWorkspaceId) return;
            if (!isSilent) setIsLoading(true);

            const { data, error } = await supabase
                .from('ai_settings')
                .select('is_autopilot_enabled')
                .eq('id', activeWorkspaceId)
                .single();

            if (latestWorkspaceIdRef.current !== activeWorkspaceId) return;

            if (data) {
                setAutopilotState(data.is_autopilot_enabled ?? true);
            }
        } catch (err) {
            console.error('Failed to fetch autopilot status:', err);
        } finally {
            if (latestWorkspaceIdRef.current === activeWorkspaceId) {
                setIsLoading(false);
                setIsInitialLoad(false);
            }
        }
    }, [supabase, activeWorkspaceId]);

    useEffect(() => {
        if (!activeWorkspaceId) {
            setAutopilotState(null);
            setIsLoading(false);
            setIsInitialLoad(false);
            return;
        }

        setAutopilotState(null);
        setIsLoading(true);
        fetchAutopilotStatus();
    }, [activeWorkspaceId, fetchAutopilotStatus]);

    // Sync on window focus
    useEffect(() => {
        const handleFocus = () => fetchAutopilotStatus(true);
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchAutopilotStatus]);

    const setAutopilot = async (value: boolean) => {
        if (!activeWorkspaceId) return;
        const previousValue = autopilot;
        setAutopilotState(value);

        try {
            const { error } = await supabase
                .from('ai_settings')
                .update({ is_autopilot_enabled: value })
                .eq('id', activeWorkspaceId);

            if (error) throw error;

            toast.success(value ? "Autopilot Enabled" : "Autopilot Disabled", {
                description: value
                    ? "Replies are now sent automatically."
                    : "Replies will now require manual approval."
            });

        } catch (err) {
            console.error('Failed to update autopilot:', err);
            setAutopilotState(previousValue);
            toast.error("Failed to update autopilot status");
        }
    };

    return (
        <AutopilotContext.Provider value={{ autopilot, setAutopilot, isLoading: isLoading || isInitialLoad }}>
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
