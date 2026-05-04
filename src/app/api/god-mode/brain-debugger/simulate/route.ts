import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGodModeAccess } from '@/lib/god-mode/auth';
import { handleAutomationMessage } from '@/lib/automation-v2';
import { loadConversationState } from '@/lib/automation-v2/state/store';
import { classifyIntent } from '@/lib/automation-v2/classify/intent-classifier';
import { classifyPostContext } from '@/lib/automation-v2/classify/post-context-classifier';
import { detectLanguage } from '@/lib/automation-v2/language';
import { extractAvailabilityCandidate } from '@/lib/automation-v2/ecommerce/extract-product';
import { extractProductCandidate } from '@/lib/automation-v2/ecommerce/extract-product';
import { searchProducts, findBestProductMatch } from '@/lib/automation-v2/ecommerce/products';
import { validateReply } from '@/lib/automation-v2/validation/reply-validator';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const sb = getAdmin();
    const body = await req.json();
    const { workspaceId, message, platform = 'instagram', mode = 'fresh', chatId: replayChatId } = body;

    if (!workspaceId || !message) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    try {
        // Fetch workspace settings
        const { data: settings } = await sb
            .from('ai_settings')
            .select('business_type, user_id, business_name, language')
            .eq('id', workspaceId)
            .maybeSingle();

        if (!settings) {
            return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
        }

        const workspaceType = settings.business_type as 'appointments' | 'ecommerce' | 'saas_support';

        // ── Pre-flight analysis (deterministic, no side effects) ────
        const detectedLanguage = detectLanguage(message);
        const intentClassification = classifyIntent(message);
        const availabilityCandidate = extractAvailabilityCandidate(message);
        const purchaseCandidate = extractProductCandidate(message);

        // Product matching (read-only)
        let productMatch = null;
        if (availabilityCandidate || purchaseCandidate.productCandidate) {
            const query = availabilityCandidate || purchaseCandidate.productCandidate;
            const products = await searchProducts({
                supabase: sb,
                workspaceId,
                query,
                limit: 10,
            });
            productMatch = findBestProductMatch(products, query);
        }

        // ── Mode-specific setup ─────────────────────────────────────
        let effectiveChatId: string;
        let preState: any = null;
        let prePostContext: any = null;
        let latestOrder: any = null;
        let latestAppointment: any = null;

        if (mode === 'replay' && replayChatId) {
            // EXISTING CHAT REPLAY — use real chatId, load real state
            effectiveChatId = replayChatId;

            // Load existing conversation state
            const stateResult = await loadConversationState(
                sb, settings.user_id, workspaceId, replayChatId, workspaceType
            );
            preState = { stage: stateResult.stage, data: stateResult.data };
            prePostContext = stateResult.postContext;

            // Load latest order (if ecommerce)
            if (workspaceType === 'ecommerce') {
                const { data: order } = await sb
                    .from('orders')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .or(`metadata->>chat_id.eq.${replayChatId},metadata->>chatId.eq.${replayChatId}`)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                latestOrder = order;
            }

            // Load latest appointment (if appointments)
            if (workspaceType === 'appointments') {
                const { data: appt } = await sb
                    .from('appointments')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .or(`metadata->>chat_id.eq.${replayChatId},metadata->>chatId.eq.${replayChatId}`)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                latestAppointment = appt;
            }

            // Post-context classification
            let postContextClassification = null;
            if (prePostContext) {
                postContextClassification = classifyPostContext(message);
            }

            // Run through actual engine with real chatId
            const result = await handleAutomationMessage({
                workspaceId,
                workspaceType,
                chatId: replayChatId,
                message,
                platform,
                supabase: sb,
                userId: settings.user_id,
            });

            // Validate the reply
            const validationResult = result.replyText
                ? validateReply(result.replyText, {
                    isConfirmed: result.debug.dbWriteSuccess,
                    language: detectedLanguage === 'arabizi' ? 'arabizi' : 'english',
                })
                : null;

            // Load state AFTER processing
            const postState = await loadConversationState(
                sb, settings.user_id, workspaceId, replayChatId, workspaceType
            );

            return NextResponse.json({
                success: true,
                mode: 'replay',
                chatId: replayChatId,
                preflight: {
                    detectedLanguage,
                    intentClassification,
                    availabilityCandidate: availabilityCandidate || null,
                    purchaseCandidate: purchaseCandidate.productCandidate || null,
                    purchaseQuantity: purchaseCandidate.quantity,
                    productMatch: productMatch ? { itemName: productMatch.itemName, price: productMatch.price, stockLevel: productMatch.stockLevel } : null,
                    postContextClassification,
                },
                stateBefore: preState,
                postContextBefore: prePostContext,
                latestOrder,
                latestAppointment,
                result: {
                    shouldReply: result.shouldReply,
                    replyText: result.replyText,
                    actions: result.actions,
                    stateBefore: result.stateBefore,
                    stateAfter: result.stateAfter,
                    debug: result.debug,
                    error: result.error,
                },
                validation: validationResult,
                stateAfter: { stage: postState.stage, data: postState.data },
                postContextAfter: postState.postContext,
            });

        } else {
            // FRESH SIMULATION — dummy chatId, isolated from real data
            effectiveChatId = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            const result = await handleAutomationMessage({
                workspaceId,
                workspaceType,
                chatId: effectiveChatId,
                message,
                platform,
                supabase: sb,
                userId: settings.user_id,
            });

            // Validate the reply
            const validationResult = result.replyText
                ? validateReply(result.replyText, {
                    isConfirmed: result.debug.dbWriteSuccess,
                    language: detectedLanguage === 'arabizi' ? 'arabizi' : 'english',
                })
                : null;

            // Fetch sim state
            const { data: stateData } = await sb
                .from('conversation_states')
                .select('*')
                .eq('chat_id', effectiveChatId)
                .maybeSingle();

            return NextResponse.json({
                success: true,
                mode: 'fresh',
                simChatId: effectiveChatId,
                preflight: {
                    detectedLanguage,
                    intentClassification,
                    availabilityCandidate: availabilityCandidate || null,
                    purchaseCandidate: purchaseCandidate.productCandidate || null,
                    purchaseQuantity: purchaseCandidate.quantity,
                    productMatch: productMatch ? { itemName: productMatch.itemName, price: productMatch.price, stockLevel: productMatch.stockLevel } : null,
                },
                result: {
                    shouldReply: result.shouldReply,
                    replyText: result.replyText,
                    actions: result.actions,
                    stateBefore: result.stateBefore,
                    stateAfter: result.stateAfter,
                    debug: result.debug,
                    error: result.error,
                },
                validation: validationResult,
                stateAfter: stateData || null,
            });
        }
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
