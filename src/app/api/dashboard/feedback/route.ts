import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/dashboard/feedback
 * Flags an AI reply as bad for review and improvement.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, chatId, platform, replyText, customerMessage, reason, note } = body;

    if (!workspaceId || !chatId || !replyText) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );

    const { error } = await supabase.from('reply_feedback').insert({
      workspace_id: workspaceId,
      chat_id: chatId,
      platform: platform || 'instagram',
      reply_text: replyText,
      customer_message: customerMessage || null,
      reason: reason || 'other',
      note: note || null,
    });

    if (error) {
      console.error('[Feedback] Insert failed:', error);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Feedback] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * GET /api/dashboard/feedback?workspaceId=xxx
 * Lists flagged replies for a workspace.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId');
  const unresolved = url.searchParams.get('unresolved') === 'true';

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );

  let query = supabase.from('reply_feedback').select('*').eq('workspace_id', workspaceId);
  if (unresolved) query = query.eq('resolved', false);
  query = query.order('created_at', { ascending: false }).limit(50);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }

  return NextResponse.json({ feedback: data || [] });
}
