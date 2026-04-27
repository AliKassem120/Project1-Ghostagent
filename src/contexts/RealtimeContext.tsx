import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeContextType {
    isConnected: boolean;
    lastUpdate: number; // Timestamp of the last significant change
}

const RealtimeContext = createContext<RealtimeContextType>({ isConnected: false, lastUpdate: 0 });

export function useRealtime() {
    return useContext(RealtimeContext);
}

interface RealtimeProviderProps {
    children: ReactNode;
    userId?: string;
}

export function RealtimeProvider({ children, userId }: RealtimeProviderProps) {
    const toast = useToast();
    const supabase = createClient();
    const channelRef = useRef<RealtimeChannel | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(0);

    const triggerUpdate = () => setLastUpdate(Date.now());

    useEffect(() => {
        if (!userId) return;

        // Subscribe to global notifications and table changes
        const channel = supabase
            .channel(`dashboard-realtime-${userId}`)
            // 1. Listen to Activity Log (for toasts)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'activity_log',
                filter: `user_id=eq.${userId}`,
            }, (payload) => {
                const activity = payload.new as any;
                triggerUpdate(); // Any activity should trigger a UI refresh attempt

                switch (activity.event_type) {
                    case 'NEW_ORDER':
                        toast.success('New Order! 🛍️', { description: activity.description || 'A new order has come in.' });
                        break;
                    case 'NEW_APPOINTMENT':
                        toast.success('New Booking! 📅', { description: activity.description || 'A new appointment was scheduled.' });
                        break;
                    case 'MANAGER_ALERT':
                        toast.error('Manager Alert 🚨', { description: activity.description });
                        break;
                }
            })
            // 2. Listen to Appointments directly
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments',
                filter: `user_id=eq.${userId}`,
            }, () => {
                console.log('[Realtime] Appointment change detected');
                triggerUpdate();
            })
            // 3. Listen to Orders directly
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `user_id=eq.${userId}`,
            }, () => {
                console.log('[Realtime] Order change detected');
                triggerUpdate();
            })
            .subscribe((status) => {
                setIsConnected(status === 'SUBSCRIBED');
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
        <RealtimeContext.Provider value={{ isConnected, lastUpdate }}>
            {children}
        </RealtimeContext.Provider>
    );
}

export default RealtimeProvider;
