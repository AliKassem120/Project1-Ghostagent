import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/workspace-readiness?workspaceId=xxx
 *
 * Checks whether a workspace is ready to enable Autopilot.
 * Returns { autopilotAllowed, checks[], summary }.
 */
export async function GET(req: NextRequest) {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');

    if (!workspaceId) {
        return NextResponse.json(
            { autopilotAllowed: false, summary: 'Missing workspaceId', checks: [] },
            { status: 400 }
        );
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const checks: { label: string; passed: boolean; severity: 'critical' | 'warning'; detail?: string }[] = [];

    // ── Check 1: Workspace exists in ai_settings ─────────────
    const { data: ws, error: wsErr } = await supabase
        .from('ai_settings')
        .select('id, user_id, name, business_type, system_instructions, whatsapp_phone_number_id')
        .eq('id', workspaceId)
        .maybeSingle();

    checks.push({
        label: 'Workspace exists',
        passed: !!ws && !wsErr,
        severity: 'critical',
        detail: !ws ? 'Workspace not found in ai_settings.' : undefined,
    });

    if (!ws) {
        return NextResponse.json({
            autopilotAllowed: false,
            summary: 'Workspace not found.',
            checks,
        });
    }

    // ── Check 2: At least one channel connected ──────────────
    const { data: igIntegration } = await supabase
        .from('instagram_integrations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .limit(1);

    const { count: waCount } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ws.user_id)
        .in('provider', ['whatsapp', 'WHATSAPP']);

    const hasChannel = (igIntegration && igIntegration.length > 0) || (waCount ?? 0) > 0 || !!ws.whatsapp_phone_number_id;

    checks.push({
        label: 'Channel connected',
        passed: hasChannel,
        severity: 'critical',
        detail: !hasChannel ? 'Connect Instagram or WhatsApp first.' : undefined,
    });

    // ── Check 3: Business type set ───────────────────────────
    checks.push({
        label: 'Business type configured',
        passed: !!ws.business_type,
        severity: 'warning',
        detail: !ws.business_type ? 'Set your business type in Settings.' : undefined,
    });

    // ── Result ───────────────────────────────────────────────
    const criticalFailing = checks.filter(c => c.severity === 'critical' && !c.passed);
    const autopilotAllowed = criticalFailing.length === 0;

    const summary = autopilotAllowed
        ? 'Workspace is ready for Autopilot.'
        : criticalFailing.map(c => c.detail || c.label).join('. ');

    return NextResponse.json({ autopilotAllowed, checks, summary });
}
