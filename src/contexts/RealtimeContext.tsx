'use client';

import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeContextType {
    isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType>({ isConnected: false });

export function useRealtimeContext() {
    return useContext(RealtimeContext);
}

interface RealtimeProviderProps {
    children: ReactNode;
    userId?: string;
}

/**
 * RealtimeProvider - Global realtime event handler
 * 
 * This provider listens to global events and shows toast notifications
 * for important activities happening in the background.
 */
export function RealtimeProvider({ children, userId }: RealtimeProviderProps) {
    const toast = useToast();
    const supabase = createClient();
    const channelRef = useRef<RealtimeChannel | null>(null);
    const isConnectedRef = useRef(false);

    useEffect(() => {
        if (!userId) return;

        // Subscribe to activity_log for global notifications
        const channel = supabase
            .channel(`global-notifications-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_log',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const activity = payload.new as any;

                    // Show toast based on event type
                    switch (activity.event_type) {
                        case 'NEW_ORDER':
                            toast.success('New Order!', {
                                description: activity.description || 'A new order has come in.',
                            });
                            break;
                        case 'IG_SALE':
                            toast.success('Sale Made! 💰', {
                                description: activity.description,
                            });
                            break;
                        case 'AI_REPLY':
                            // Silent - too many of these
                            break;
                        case 'MANAGER_ALERT':
                            toast.error('Manager Alert', {
                                description: activity.description,
                            });
                            break;
                        case 'SAFETY_TRIGGER':
                            toast.error('Safety Shield Triggered', {
                                description: activity.description,
                            });
                            break;
                        case 'INVENTORY_LOW':
                            toast.info('Low Stock Alert', {
                                description: activity.description,
                            });
                            break;
                        case 'INVENTORY_ADD':
                            toast.ghost('Inventory Updated', {
                                description: activity.description,
                            });
                            break;
                        default:
                            // Don't show toast for every event
                            break;
                    }
                }
            )
            .subscribe((status) => {
                isConnectedRef.current = status === 'SUBSCRIBED';
                console.log('[RealtimeProvider] Connection status:', status);
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [userId, toast]);

    return (
        <RealtimeContext.Provider value={{ isConnected: isConnectedRef.current }}>
            {children}
        </RealtimeContext.Provider>
    );
}

export default RealtimeProvider;
