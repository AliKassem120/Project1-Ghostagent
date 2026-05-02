/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Fallback Templates
 * ═══════════════════════════════════════════════════════════════
 * Only used for edge-case fallbacks when the agent can't reply.
 * The agent generates all replies natively — these are safety nets.
 */

export const SAFE_FALLBACK = "Something went wrong — try again in a sec?";

export function applyTemplate(
    template: string,
    data: Record<string, string | number | undefined | null>
): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        result = result.replaceAll(`{${key}}`, value != null ? String(value) : '');
    }
    return result.replace(/\{[a-zA-Z_]+\}/g, '').replace(/\s{2,}/g, ' ').trim();
}
