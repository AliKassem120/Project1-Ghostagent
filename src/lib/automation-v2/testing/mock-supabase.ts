/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Mock Supabase for Testing
 * ═══════════════════════════════════════════════════════════════
 * Configurable mock that intercepts Supabase query chains and
 * returns fixture data. Tracks insert/update calls for assertion.
 */

import { vi } from 'vitest';

export interface MockSupabaseConfig {
    /** Rows returned by table name + filter combo */
    tables: Record<string, any[]>;
    /** Track all insert calls */
    insertLog: { table: string; row: any }[];
    /** Track all update calls */
    updateLog: { table: string; filter: Record<string, any>; data: any }[];
    /** Force errors on specific tables */
    errorTables?: Record<string, { message: string; code?: string }>;
}

export function createMockSupabase(config?: Partial<MockSupabaseConfig>) {
    const state: MockSupabaseConfig = {
        tables: config?.tables || {},
        insertLog: config?.insertLog || [],
        updateLog: config?.updateLog || [],
        errorTables: config?.errorTables || {},
    };

    // Track current chain context
    let currentTable = '';
    let currentFilters: Record<string, any> = {};

    function buildChain(): any {
        const chain: any = {
            select: vi.fn().mockImplementation(() => {
                return chain;
            }),
            eq: vi.fn().mockImplementation((col: string, val: any) => {
                currentFilters[col] = val;
                return chain;
            }),
            neq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockImplementation(() => {
                const tableData = state.tables[currentTable] || [];
                const err = state.errorTables?.[currentTable];
                if (err) {
                    return Promise.resolve({ data: null, error: err });
                }
                return Promise.resolve({ data: tableData, error: null });
            }),
            single: vi.fn().mockImplementation(() => {
                const tableData = state.tables[currentTable] || [];
                const err = state.errorTables?.[currentTable];
                if (err) {
                    return Promise.resolve({ data: null, error: err });
                }
                const first = tableData[0] || null;
                return Promise.resolve({
                    data: first,
                    error: first ? null : { message: 'No rows found', code: 'PGRST116' },
                });
            }),
            maybeSingle: vi.fn().mockImplementation(() => {
                const tableData = state.tables[currentTable] || [];
                const err = state.errorTables?.[currentTable];
                if (err) {
                    return Promise.resolve({ data: null, error: err });
                }
                return Promise.resolve({ data: tableData[0] || null, error: null });
            }),
            insert: vi.fn().mockImplementation((row: any) => {
                state.insertLog.push({ table: currentTable, row });
                const err = state.errorTables?.[currentTable];
                if (err) {
                    return Promise.resolve({ data: null, error: err });
                }
                return Promise.resolve({ data: row, error: null });
            }),
            update: vi.fn().mockImplementation((data: any) => {
                state.updateLog.push({ table: currentTable, filter: { ...currentFilters }, data });
                const updateChain: any = {
                    eq: vi.fn().mockReturnThis(),
                    match: vi.fn().mockReturnThis(),
                    then: (resolve: any) => resolve({ data, error: null }),
                };
                // Make it thenable
                return Object.assign(Promise.resolve({ data, error: null }), updateChain);
            }),
            upsert: vi.fn().mockImplementation((row: any) => {
                state.insertLog.push({ table: currentTable, row });
                return Promise.resolve({ data: row, error: null });
            }),
            delete: vi.fn().mockReturnThis(),
        };
        return chain;
    }

    const mock = {
        from: vi.fn().mockImplementation((table: string) => {
            currentTable = table;
            currentFilters = {};
            return buildChain();
        }),
        /** Access internal state for assertions */
        _state: state,
    };

    return mock as any;
}

/**
 * Pre-built fixture sets for common test scenarios.
 */
export const FIXTURES = {
    ecommerceInventory: [
        {
            id: 'prod-1',
            item_name: 'Heavyweight Hoodie',
            price: 45,
            stock_level: 10,
            description: 'Premium cotton hoodie',
            variants: JSON.stringify([
                { label: 'Black / M', stock: 5 },
                { label: 'Black / L', stock: 3 },
                { label: 'White / M', stock: 2 },
            ]),
        },
        {
            id: 'prod-2',
            item_name: 'Classic Cotton Tee',
            price: 25,
            stock_level: 20,
            description: 'Everyday cotton t-shirt',
            variants: JSON.stringify([
                { label: 'Black / S', stock: 8 },
                { label: 'White / M', stock: 12 },
            ]),
        },
        {
            id: 'prod-3',
            item_name: 'Winter Jacket',
            price: 120,
            stock_level: 0,
            description: 'Warm winter jacket',
            variants: JSON.stringify([]),
        },
    ],

    appointmentServices: [
        {
            id: 'svc-1',
            name: 'Haircut',
            description: 'Standard haircut',
            price: 30,
            duration_minutes: 30,
            is_active: true,
            aliases: JSON.stringify(['hair', 'cut', 'trim']),
            category: 'Hair',
            buffer_before: 0,
            buffer_after: 10,
        },
        {
            id: 'svc-2',
            name: 'Beard Trim',
            description: 'Beard grooming',
            price: 15,
            duration_minutes: 15,
            is_active: true,
            aliases: JSON.stringify(['beard', 'shave']),
            category: 'Grooming',
            buffer_before: 0,
            buffer_after: 5,
        },
    ],

    businessHours: [
        { day_of_week: 0, is_open: false, open_time: null, close_time: null },
        { day_of_week: 1, is_open: true, open_time: '09:00', close_time: '18:00' },
        { day_of_week: 2, is_open: true, open_time: '09:00', close_time: '18:00' },
        { day_of_week: 3, is_open: true, open_time: '09:00', close_time: '18:00' },
        { day_of_week: 4, is_open: true, open_time: '09:00', close_time: '18:00' },
        { day_of_week: 5, is_open: true, open_time: '09:00', close_time: '18:00' },
        { day_of_week: 6, is_open: false, open_time: null, close_time: null },
    ],

    saasKnowledge: [
        {
            id: 'kb-1',
            title: 'GhostAgent Overview',
            content: 'GhostAgent is an AI assistant for Instagram and WhatsApp that automates customer conversations.',
            source_type: 'manual',
            visibility: 'public',
        },
        {
            id: 'kb-2',
            title: 'Pricing',
            content: 'Starter: $29/mo, Pro: $79/mo, Empire: $199/mo',
            source_type: 'manual',
            visibility: 'public',
        },
    ],

    defaultAiSettings: {
        id: 'ws-test-123',
        user_id: 'user-test-456',
        business_name: 'Test Store',
        business_type: 'ecommerce',
        tone: 'Friendly',
        system_instructions: null,
        language: 'Auto-Detect',
        timezone: 'Asia/Beirut',
        use_emojis: true,
        handoff_keywords: [],
        store_location: null,
        contact_info: null,
        shipping_rules: null,
        max_discount: null,
        min_order_for_discount: null,
        slot_duration_minutes: 60,
    },
};
