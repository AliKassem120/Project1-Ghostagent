/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Workspace Readiness Score
 * ═══════════════════════════════════════════════════════════════
 * Checks whether a workspace is ready for Autopilot.
 * If critical checks fail, Autopilot should not be enabled
 * and AI replies should stay as drafts.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ReadinessCheck {
    label: string;
    passed: boolean;
    severity: 'critical' | 'warning' | 'info';
    detail?: string;
}

export interface ReadinessReport {
    checks: ReadinessCheck[];
    score: number;            // 0-100
    autopilotAllowed: boolean; // false if any critical check fails
    summary: string;
}

export async function checkWorkspaceReadiness(
    supabase: SupabaseClient,
    workspaceId: string,
): Promise<ReadinessReport> {
    const checks: ReadinessCheck[] = [];

    // ── Load workspace config ────────────────────────────────
    const { data: ws, error: wsError } = await supabase
        .from('ai_settings')
        .select('id, user_id, business_name, business_type, tone, language, system_instructions, emergency_whatsapp, whatsapp_phone_number_id')
        .eq('id', workspaceId)
        .maybeSingle();

    if (wsError || !ws) {
        checks.push({
            label: 'Workspace exists',
            passed: false,
            severity: 'critical',
            detail: wsError?.message || 'Workspace not found',
        });
        return buildReport(checks);
    }

    checks.push({ label: 'Workspace exists', passed: true, severity: 'critical' });

    // ── Business name set ────────────────────────────────────
    checks.push({
        label: 'Business name configured',
        passed: !!ws.business_name && ws.business_name.trim().length > 0,
        severity: 'critical',
        detail: ws.business_name ? undefined : 'Set your business name in Settings',
    });

    // ── Business type set ────────────────────────────────────
    checks.push({
        label: 'Business type configured',
        passed: !!ws.business_type && ['ecommerce', 'appointments', 'saas_support'].includes(ws.business_type),
        severity: 'critical',
        detail: ws.business_type ? undefined : 'Set business type in Settings',
    });

    // ── Language set ─────────────────────────────────────────
    checks.push({
        label: 'Language configured',
        passed: !!ws.language,
        severity: 'warning',
        detail: ws.language ? undefined : 'Set language preference in Settings',
    });

    // ── Instagram connected ──────────────────────────────────
    const { data: igConn } = await supabase
        .from('instagram_integrations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

    checks.push({
        label: 'Instagram connected',
        passed: !!igConn,
        severity: 'critical',
        detail: igConn ? undefined : 'Connect Instagram in Settings to receive DMs',
    });

    // ── Inventory/Services (type-specific) ───────────────────
    if (ws.business_type === 'ecommerce') {
        const { data: products, error: prodErr } = await supabase
            .from('inventory')
            .select('id')
            .eq('workspace_id', workspaceId)
            .limit(1);

        const hasProducts = !prodErr && products && products.length > 0;
        checks.push({
            label: 'Products in inventory',
            passed: hasProducts,
            severity: 'critical',
            detail: hasProducts ? undefined : 'Add at least one product to Inventory',
        });
    }

    if (ws.business_type === 'appointments') {
        const { data: services, error: svcErr } = await supabase
            .from('services')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('is_active', true)
            .limit(1);

        const hasServices = !svcErr && services && services.length > 0;
        checks.push({
            label: 'Active services configured',
            passed: hasServices,
            severity: 'critical',
            detail: hasServices ? undefined : 'Add at least one active service',
        });

        const { data: hours, error: hrsErr } = await supabase
            .from('business_hours')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('is_open', true)
            .limit(1);

        const hasHours = !hrsErr && hours && hours.length > 0;
        checks.push({
            label: 'Business hours configured',
            passed: hasHours,
            severity: 'warning',
            detail: hasHours ? undefined : 'Set business hours for appointment scheduling',
        });
    }

    // ── Emergency WhatsApp (optional) ────────────────────────
    checks.push({
        label: 'Emergency WhatsApp configured',
        passed: !!ws.emergency_whatsapp && ws.emergency_whatsapp !== 'NOT SET',
        severity: 'info',
        detail: ws.emergency_whatsapp ? undefined : 'Optional: Set emergency WhatsApp for handoff alerts',
    });

    // ── System instructions (optional but recommended) ───────
    checks.push({
        label: 'Custom AI instructions set',
        passed: !!ws.system_instructions && ws.system_instructions.trim().length > 10,
        severity: 'info',
        detail: ws.system_instructions ? undefined : 'Optional: Add custom instructions to guide the AI',
    });

    return buildReport(checks);
}

function buildReport(checks: ReadinessCheck[]): ReadinessReport {
    const criticalCount = checks.filter(c => c.severity === 'critical').length;
    const criticalPassed = checks.filter(c => c.severity === 'critical' && c.passed).length;
    const totalCount = checks.length;
    const totalPassed = checks.filter(c => c.passed).length;

    const autopilotAllowed = criticalCount > 0 ? criticalPassed === criticalCount : true;
    const score = totalCount > 0 ? Math.round((totalPassed / totalCount) * 100) : 0;

    let summary: string;
    if (autopilotAllowed && score >= 80) {
        summary = 'Workspace is ready for Autopilot.';
    } else if (autopilotAllowed) {
        summary = 'Autopilot can be enabled, but some recommended checks are incomplete.';
    } else {
        const failing = checks.filter(c => c.severity === 'critical' && !c.passed).map(c => c.label);
        summary = `Autopilot blocked: ${failing.join(', ')}. Fix these before enabling Autopilot.`;
    }

    return { checks, score, autopilotAllowed, summary };
}
