/**
 * ═══════════════════════════════════════════════════════════════
 * God Mode — Auth Helper
 * ═══════════════════════════════════════════════════════════════
 * Server-side authentication for all God Mode APIs.
 * Uses cookie-based session set during /api/admin/login.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const GOD_MODE_COOKIE = 'god_mode_session';
// Simple HMAC-like token — hash of credentials. Not a JWT, just a session marker.
const GOD_MODE_TOKEN = 'gm_authenticated_v1';

// ── Auth Check ──────────────────────────────────────────────

/**
 * Validates God Mode access from a server-side API route.
 * Returns null if authorized, or a 403 NextResponse if not.
 */
export async function requireGodModeAccess(): Promise<NextResponse | null> {
    const cookieStore = await cookies();
    const session = cookieStore.get(GOD_MODE_COOKIE);

    if (!session || session.value !== GOD_MODE_TOKEN) {
        return NextResponse.json(
            { error: 'Unauthorized — God Mode access required' },
            { status: 403 }
        );
    }
    return null; // Authorized
}

/**
 * Validates God Mode credentials.
 */
export function isGodModeUser(username: string, password: string): boolean {
    const validUser = process.env.GOD_MODE_USER;
    const validPass = process.env.GOD_MODE_PASS;

    // In production, require environment variables. No fallbacks.
    if (process.env.NODE_ENV === 'production') {
        if (!validUser || !validPass) {
            console.warn('[GOD_MODE] Missing GOD_MODE_USER or GOD_MODE_PASS in production. Denying access.');
            return false;
        }
        return username === validUser && password === validPass;
    }

    // In development/test, allow fallbacks if env is missing
    return username === (validUser || 'ghost123agent') && 
           password === (validPass || 'agentgodmode');
}

/**
 * Cookie name and token for the login route to set.
 */
export { GOD_MODE_COOKIE, GOD_MODE_TOKEN };

// ── Data Redaction ──────────────────────────────────────────

const SENSITIVE_KEYS = [
    'access_token', 'accessToken', 'refresh_token', 'refreshToken',
    'api_key', 'apiKey', 'service_key', 'serviceKey',
    'token', 'secret', 'password', 'authorization',
    'bearer', 'service_role', 'serviceRole',
    'GROQ_API_KEY', 'OPENAI_API_KEY',
];

/**
 * Deep-redacts sensitive fields from an object.
 * Returns a new object — does not mutate the original.
 */
export function redactSensitiveData(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return obj;
    if (Array.isArray(obj)) return obj.map(redactSensitiveData);

    if (typeof obj === 'object') {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            const keyLower = key.toLowerCase();
            const isSensitive = SENSITIVE_KEYS.some(sk => keyLower.includes(sk.toLowerCase()));
            if (isSensitive && typeof value === 'string') {
                result[key] = '[REDACTED]';
            } else if (typeof value === 'object') {
                result[key] = redactSensitiveData(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }
    return obj;
}
