'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

interface UseRealtimeOptions<T> {
    /** Column to order by (default: 'created_at') */
    orderBy?: keyof T | string;
    /** Order direction (default: 'desc') */
    orderDirection?: 'asc' | 'desc';
    /** Maximum number of items to keep (default: 100) */
    limit?: number;
    /** Optional filter: { column: 'user_id', value: 'abc123' } */
    filter?: { column: string; value: string };
    /** Callback when new item is inserted */
    onInsert?: (item: T) => void;
    /** Callback when item is updated */
    onUpdate?: (item: T) => void;
    /** Callback when item is deleted */
    onDelete?: (item: T) => void;
    /** Whether to enable realtime (default: true) */
    enabled?: boolean;
}

interface UseRealtimeReturn<T> {
    data: T[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * useRealtime - A hook for live-updating data from Supabase
 * 
 * @param tableName - The Supabase table to subscribe to
 * @param selectQuery - The columns to select (default: '*')
 * @param options - Configuration options
 * @returns { data, loading, error, refetch }
 * 
 * @example
 * const { data: products, loading } = useRealtime<Product>('inventory', '*', {
 *   filter: { column: 'user_id', value: userId },
 *   orderBy: 'created_at',
 *   onInsert: (item) => toast.success(`New product: ${item.name}`)
 * });
 */
export function useRealtime<T extends { id: string | number }>(
    tableName: string,
    selectQuery: string = '*',
    options: UseRealtimeOptions<T> = {}
): UseRealtimeReturn<T> {
    const {
        orderBy = 'created_at',
        orderDirection = 'desc',
        limit = 100,
        filter,
        onInsert,
        onUpdate,
        onDelete,
        enabled = true,
    } = options;

    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const supabase = createClient();
    const channelRef = useRef<RealtimeChannel | null>(null);
    const isMountedRef = useRef(true);

    // Deduplicate and sort data
    const processData = useCallback((items: T[]): T[] => {
        // Deduplicate by id
        const uniqueMap = new Map<string | number, T>();
        items.forEach(item => uniqueMap.set(item.id, item));

        // Convert back to array and sort
        const uniqueItems = Array.from(uniqueMap.values());

        // Sort by orderBy column
        uniqueItems.sort((a, b) => {
            const aVal = (a as any)[orderBy];
            const bVal = (b as any)[orderBy];

            if (aVal === undefined || bVal === undefined) return 0;

            // Handle date strings
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const aDate = new Date(aVal).getTime();
                const bDate = new Date(bVal).getTime();
                if (!isNaN(aDate) && !isNaN(bDate)) {
                    return orderDirection === 'desc' ? bDate - aDate : aDate - bDate;
                }
                return orderDirection === 'desc'
                    ? bVal.localeCompare(aVal)
                    : aVal.localeCompare(bVal);
            }

            // Handle numbers
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return orderDirection === 'desc' ? bVal - aVal : aVal - bVal;
            }

            return 0;
        });

        // Apply limit
        return uniqueItems.slice(0, limit);
    }, [orderBy, orderDirection, limit]);

    // Initial fetch
    const fetchData = useCallback(async () => {
        if (!enabled) return;

        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from(tableName)
                .select(selectQuery)
                .order(orderBy as string, { ascending: orderDirection === 'asc' })
                .limit(limit);

            if (filter) {
                query = query.eq(filter.column, filter.value);
            }

            const { data: fetchedData, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            if (isMountedRef.current) {
                setData(processData((fetchedData || []) as unknown as T[]));
            }
        } catch (err) {
            console.error(`[useRealtime] Error fetching ${tableName}:`, err);
            if (isMountedRef.current) {
                setError(err as Error);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [tableName, selectQuery, orderBy, orderDirection, limit, filter, enabled, processData]);

    // Handle realtime events
    const handleRealtimeEvent = useCallback((
        eventType: RealtimeEvent,
        payload: { new: T; old: T }
    ) => {
        if (!isMountedRef.current) return;

        setData(currentData => {
            let newData = [...currentData];

            switch (eventType) {
                case 'INSERT': {
                    const newItem = payload.new;
                    // Check if we should include this item (filter check)
                    if (filter && (newItem as any)[filter.column] !== filter.value) {
                        return currentData;
                    }
                    // Add to beginning (will be sorted properly)
                    newData = [newItem, ...currentData];
                    onInsert?.(newItem);
                    break;
                }
                case 'UPDATE': {
                    const updatedItem = payload.new;
                    const index = newData.findIndex(item => item.id === updatedItem.id);
                    if (index !== -1) {
                        newData[index] = updatedItem;
                    }
                    onUpdate?.(updatedItem);
                    break;
                }
                case 'DELETE': {
                    const deletedItem = payload.old;
                    newData = newData.filter(item => item.id !== deletedItem.id);
                    onDelete?.(deletedItem);
                    break;
                }
            }

            return processData(newData);
        });
    }, [filter, onInsert, onUpdate, onDelete, processData]);

    // Setup realtime subscription
    useEffect(() => {
        isMountedRef.current = true;

        if (!enabled) {
            setLoading(false);
            return;
        }

        // Initial fetch
        fetchData();

        // Create unique channel name
        const channelName = `realtime-${tableName}-${filter?.value || 'global'}-${Date.now()}`;

        // Build filter string for realtime
        const realtimeFilter = filter
            ? `${filter.column}=eq.${filter.value}`
            : undefined;

        // Subscribe to realtime changes
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events
                    schema: 'public',
                    table: tableName,
                    filter: realtimeFilter,
                },
                (payload) => {
                    console.log(`[useRealtime] ${tableName} ${payload.eventType}:`, payload);
                    handleRealtimeEvent(
                        payload.eventType as RealtimeEvent,
                        { new: payload.new as T, old: payload.old as T }
                    );
                }
            )
            .subscribe((status) => {
                console.log(`[useRealtime] ${tableName} subscription status:`, status);
            });

        channelRef.current = channel;

        // Cleanup
        return () => {
            isMountedRef.current = false;
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [tableName, filter?.column, filter?.value, enabled]);

    return {
        data,
        loading,
        error,
        refetch: fetchData,
    };
}

/**
 * useRealtimeCount - Get a live count of rows in a table
 */
export function useRealtimeCount(
    tableName: string,
    filter?: { column: string; value: string }
): { count: number; loading: boolean } {
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchCount = async () => {
            let query = supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true });

            if (filter) {
                query = query.eq(filter.column, filter.value);
            }

            const { count: rowCount } = await query;
            setCount(rowCount || 0);
            setLoading(false);
        };

        fetchCount();

        // Subscribe to changes to update count
        const channel = supabase
            .channel(`count-${tableName}-${Date.now()}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: tableName,
                    filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
                },
                () => {
                    fetchCount(); // Refetch count on any change
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tableName, filter?.column, filter?.value]);

    return { count, loading };
}

export default useRealtime;
