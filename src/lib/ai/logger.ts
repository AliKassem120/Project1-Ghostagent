/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Structured Logger
 * ═══════════════════════════════════════════════════════════════
 * All V2 logging goes through here. Provides structured, 
 * prefixed logs that are easy to filter in production.
 *
 * NEVER logs: API keys, access tokens, service role keys,
 * full private customer histories.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
    prefix: string;
    message: string;
    data?: Record<string, any>;
}

function sanitize(data: Record<string, any> | undefined): Record<string, any> | undefined {
    if (!data) return undefined;
    const sanitized = { ...data };
    const sensitiveKeys = ['access_token', 'accessToken', 'api_key', 'apiKey', 'service_key', 'serviceKey', 'token', 'secret', 'password'];
    for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
            sanitized[key] = '[REDACTED]';
        }
    }
    return sanitized;
}

function formatLog(level: LogLevel, entry: LogEntry): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${entry.prefix}]`;
    return `${timestamp} [${level.toUpperCase()}] ${prefix} ${entry.message}`;
}

function log(level: LogLevel, entry: LogEntry) {
    const msg = formatLog(level, entry);
    const safeData = sanitize(entry.data);
    
    switch (level) {
        case 'error':
            safeData ? console.error(msg, safeData) : console.error(msg);
            break;
        case 'warn':
            safeData ? console.warn(msg, safeData) : console.warn(msg);
            break;
        case 'debug':
            safeData ? console.debug(msg, safeData) : console.debug(msg);
            break;
        default:
            safeData ? console.log(msg, safeData) : console.log(msg);
    }
}

// ── Public API ───────────────────────────────────────────────

export const v2log = {
    // General
    info: (prefix: string, message: string, data?: Record<string, any>) =>
        log('info', { prefix, message, data }),
    warn: (prefix: string, message: string, data?: Record<string, any>) =>
        log('warn', { prefix, message, data }),
    error: (prefix: string, message: string, data?: Record<string, any>) =>
        log('error', { prefix, message, data }),
    debug: (prefix: string, message: string, data?: Record<string, any>) =>
        log('debug', { prefix, message, data }),

    // Appointment-specific
    appointment: {
        context: (data: Record<string, any>) =>
            log('info', { prefix: 'APPOINTMENT_V2_CONTEXT', message: 'Loaded context', data }),
        availability: (data: Record<string, any>) =>
            log('info', { prefix: 'APPOINTMENT_V2_AVAILABILITY', message: 'Checked availability', data }),
        insertAttempt: (data: Record<string, any>) =>
            log('info', { prefix: 'APPOINTMENT_V2_INSERT_ATTEMPT', message: 'Attempting appointment insert', data }),
        insertSuccess: (data: Record<string, any>) =>
            log('info', { prefix: 'APPOINTMENT_V2_INSERT_SUCCESS', message: 'Appointment inserted successfully', data }),
        insertError: (data: Record<string, any>) =>
            log('error', { prefix: 'APPOINTMENT_V2_INSERT_ERROR', message: 'Appointment insert failed', data }),
        calendarVisibility: (data: Record<string, any>) =>
            log('info', { prefix: 'APPOINTMENT_V2_CALENDAR_VISIBILITY', message: 'Calendar visibility check', data }),
    },

    // E-Commerce specific
    ecommerce: {
        context: (data: Record<string, any>) =>
            log('info', { prefix: 'ECOMMERCE_V2_CONTEXT', message: 'Loaded context', data }),
        productMatch: (data: Record<string, any>) =>
            log('info', { prefix: 'ECOMMERCE_V2_PRODUCT_MATCH', message: 'Product search result', data }),
        stockCheck: (data: Record<string, any>) =>
            log('info', { prefix: 'ECOMMERCE_V2_STOCK_CHECK', message: 'Stock check result', data }),
        orderAttempt: (data: Record<string, any>) =>
            log('info', { prefix: 'ECOMMERCE_V2_ORDER_ATTEMPT', message: 'Attempting order insert', data }),
        orderSuccess: (data: Record<string, any>) =>
            log('info', { prefix: 'ECOMMERCE_V2_ORDER_SUCCESS', message: 'Order inserted successfully', data }),
        orderError: (data: Record<string, any>) =>
            log('error', { prefix: 'ECOMMERCE_V2_ORDER_ERROR', message: 'Order insert failed', data }),
    },

    // Webhook outcome (logged at the end of every request)
    webhookOutcome: (data: {
        requestId: string;
        workspaceId: string;
        workspaceType: string;
        chatId: string;
        engineVersion: string;
        language: string;
        stateBefore: string;
        intent?: string;
        actions: string[];
        stateAfter: string;
        appointmentInsertSuccess?: boolean;
        appointmentUpdateSuccess?: boolean;
        appointmentCancelSuccess?: boolean;
        orderInsertSuccess?: boolean;
        orderUpdateSuccess?: boolean;
        orderCancelSuccess?: boolean;
        sentReply: string | null;
        error?: string;
    }) => log('info', { prefix: 'INSTAGRAM_WEBHOOK_OUTCOME', message: 'Request completed', data }),
};
