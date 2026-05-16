import { NextResponse } from 'next/server';
import { requireGodModeAccess } from '@/lib/god-mode/auth';
import { classifyIntent } from '@/lib/ai/classify/intent-classifier';
import { classifyPostContext } from '@/lib/ai/classify/post-context-classifier';
import { detectLanguage } from '@/lib/ai/language';
import { validateReply } from '@/lib/ai/validation/reply-validator';

export async function POST(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const body = await req.json();
    const { action = 'classify', message, workspaceType = 'ecommerce', currentState = 'idle' } = body;

    try {
        // ── Action: classify (test classifiers) ─────────────────
        if (action === 'classify') {
            if (!message) {
                return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
            }

            const language = detectLanguage(message);
            const intentClassification = classifyIntent(message);

            let postContextClassification = null;
            if (currentState !== 'idle') {
                postContextClassification = classifyPostContext(message);
            }

            return NextResponse.json({
                success: true,
                action: 'classify',
                results: {
                    language,
                    intentClassification,
                    postContextClassification,
                },
            });
        }

        // ── Action: validate (test validateReply) ───────────────
        if (action === 'validate') {
            const { reply, isConfirmed = false, language = 'english' } = body;

            if (!reply) {
                return NextResponse.json({ success: false, error: 'Reply text is required for validation' }, { status: 400 });
            }

            const result = validateReply(reply, {
                isConfirmed,
                language,
            });

            return NextResponse.json({
                success: true,
                action: 'validate',
                input: { reply, isConfirmed, language },
                result,
            });
        }

        return NextResponse.json({ success: false, error: 'Invalid action. Use "classify" or "validate".' }, { status: 400 });

    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
