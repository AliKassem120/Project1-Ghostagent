import type { V3BusinessContext, V3ConversationMemory, V3Decision } from './schema';

function norm(value?: string | null): string {
    return (value || '').toLowerCase().trim();
}

export function mergeMemory(current: V3ConversationMemory, patch?: V3Decision['memoryPatch'] | null): V3ConversationMemory {
    if (!patch) return current || {};
    const next: V3ConversationMemory = { ...(current || {}) };
    for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined && value !== null && value !== '') {
            (next as any)[key] = value;
        }
    }
    return next;
}

export function findProduct(ctx: V3BusinessContext, name?: string | null) {
    const q = norm(name);
    if (!q) return null;
    return ctx.products.find(p => norm(p.name) === q)
        || ctx.products.find(p => norm(p.name).includes(q) || q.includes(norm(p.name)))
        || null;
}

export function findService(ctx: V3BusinessContext, name?: string | null) {
    const q = norm(name);
    if (!q) return null;
    return ctx.services.find(s => norm(s.name) === q)
        || ctx.services.find(s => norm(s.name).includes(q) || q.includes(norm(s.name)))
        || null;
}

export function validateV3Action(ctx: V3BusinessContext, decision: V3Decision, memory: V3ConversationMemory): {
    allowed: boolean;
    reason?: string;
    missing?: string[];
} {
    if (!decision.action) return { allowed: true };

    if (decision.action.type === 'handoff') return { allowed: true };

    if (decision.action.type === 'create_order') {
        const product = findProduct(ctx, memory.productName);
        const missing: string[] = [];
        if (!product) missing.push('product');
        if (!memory.customerName) missing.push('name');
        if (!memory.customerPhone) missing.push('phone');
        if (!memory.customerAddress) missing.push('address');
        if (!memory.confirmed) missing.push('confirmation');
        if (product && product.stock <= 0) return { allowed: false, reason: 'out_of_stock' };
        return missing.length ? { allowed: false, missing } : { allowed: true };
    }

    if (decision.action.type === 'create_appointment') {
        const service = findService(ctx, memory.serviceName);
        const missing: string[] = [];
        if (!service) missing.push('service');
        if (!memory.dateText) missing.push('date');
        if (!memory.timeText) missing.push('time');
        if (!memory.customerName) missing.push('name');
        if (!memory.customerPhone) missing.push('phone');
        if (!memory.confirmed) missing.push('confirmation');
        return missing.length ? { allowed: false, missing } : { allowed: true };
    }

    return { allowed: false, reason: 'unknown_action' };
}
