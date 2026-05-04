import { NextResponse } from 'next/server';
import { requireGodModeAccess } from '@/lib/god-mode/auth';
import { classifyIntent } from '@/lib/automation-v2/classify/intent-classifier';
import { classifyPostContext } from '@/lib/automation-v2/classify/post-context-classifier';
import { detectLanguage } from '@/lib/automation-v2/language';

export async function POST(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const body = await req.json();
    const { message, workspaceType = 'ecommerce', currentState = 'idle' } = body;

    if (!message) {
        return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    try {
        const language = detectLanguage(message);
        
        // Run Intent Classifier
        const intentClassification = classifyIntent(message);

        // Run Post-Context Classifier (if state is provided)
        let postContextClassification = null;
        if (currentState !== 'idle') {
            postContextClassification = classifyPostContext(message);
        }

        return NextResponse.json({ 
            success: true, 
            results: {
                language,
                intentClassification,
                postContextClassification
            }
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
