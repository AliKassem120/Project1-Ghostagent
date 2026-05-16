import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkWorkspaceReadiness } from '@/lib/ai/readiness/workspace-readiness';

export async function GET(request: NextRequest) {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId');

    if (!workspaceId) {
        return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const report = await checkWorkspaceReadiness(supabase, workspaceId);

    return NextResponse.json(report);
}
