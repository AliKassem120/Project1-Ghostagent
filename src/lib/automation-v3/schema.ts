import { z } from 'zod';

export const V3MemoryPatchSchema = z.object({
    mode: z.enum(['browse', 'ordering', 'booking', 'handoff']).optional().nullable(),
    productName: z.string().optional().nullable(),
    serviceName: z.string().optional().nullable(),
    customerName: z.string().optional().nullable(),
    customerPhone: z.string().optional().nullable(),
    customerAddress: z.string().optional().nullable(),
    dateText: z.string().optional().nullable(),
    timeText: z.string().optional().nullable(),
    confirmed: z.boolean().optional().nullable(),
});

export const V3ActionSchema = z.object({
    type: z.enum(['create_order', 'create_appointment', 'handoff']),
    payload: z.record(z.any()).optional().default({}),
}).optional().nullable();

export const V3DecisionSchema = z.object({
    reply: z.string().min(1).max(500),
    intent: z.enum([
        'general',
        'product_question',
        'service_question',
        'order_request',
        'booking_request',
        'business_question',
        'handoff',
    ]),
    memoryPatch: V3MemoryPatchSchema.optional().nullable(),
    action: V3ActionSchema,
});

export type V3Decision = z.infer<typeof V3DecisionSchema>;

export interface V3ConversationMemory {
    mode?: 'browse' | 'ordering' | 'booking' | 'handoff';
    productName?: string | null;
    serviceName?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    customerAddress?: string | null;
    dateText?: string | null;
    timeText?: string | null;
    confirmed?: boolean | null;
}

export interface V3BusinessContext {
    workspaceId: string;
    userId: string;
    workspaceType: 'ecommerce' | 'appointments';
    businessName: string;
    tone: string;
    language: string;
    timezone: string;
    useEmojis: boolean;
    useLocalSlang: boolean;
    systemInstructions: string | null;
    storeLocation: string | null;
    contactInfo: string | null;
    shippingRules: string | null;
    products: Array<{
        id: string;
        name: string;
        price: number;
        stock: number;
        description?: string | null;
    }>;
    services: Array<{
        id: string;
        name: string;
        price: number;
        durationMinutes: number;
        description?: string | null;
    }>;
    hoursSummary: string;
    memory: V3ConversationMemory;
}
