import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDashboardOverviewMetrics } from '@/lib/dashboard/metrics';

export async function GET(request: NextRequest) {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId');

    if (!workspaceId) {
        return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const metrics = await getDashboardOverviewMetrics(supabase, workspaceId);
        return NextResponse.json(metrics);
    } catch (err) {
        console.error('[DASHBOARD_OVERVIEW] Error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch metrics' },
            { status: 500 }
        );
    }
}
