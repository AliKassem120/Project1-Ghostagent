# GHOST AGENT — PHASE 2 HOTFIX PROMPT

Fix 6 integration and safety issues in the Phase 2 V3 orchestrator code. Do NOT rewrite architecture — only patch these specific bugs.

---

## ISSUE 1: ORCHESTRATOR ROUTING MISSES EDGE CASES

**Problem:** The ~200-line orchestrator may miss routing for: scoped cancel ("cancel the second order"), post-context reuse ("same info"), post-context modify ("change address to Hamra"), CTA accept ("yeah" after "Want one?").

**Current risk:** These messages may fall through to LLM instead of hitting deterministic handlers.

**Fix in `orchestrator.ts`:**

Add explicit routing checks BEFORE the general classifier:

```typescript
// ── ROUTING PRIORITY (highest to lowest) ─────────────────
// 1. Rate limit check
// 2. Session timeout / fresh greeting
// 3. Global interrupts (handoff, frustration_stop)
// 4. Active FSM continuation (with loop detection)
// 5. Post-context handlers (MUST check before classifier)
// 6. Scoped cancel (MUST check before classifier)
// 7. Intent classification → deterministic / FSM / LLM

// Step 5: Post-context (highest priority for idle state)
if (session.state === 'idle' && session.postContext) {
    const pcResult = classifyPostContext(message);
    if (pcResult.intent !== 'unrelated') {
        const handler = await import('./handlers/post-context');
        const result = await handler.handlePostContextIntent(
            input, config, replyLang, session.postContext, 
            pcResult.intent, pcResult.extractedValue
        );
        if (result) {
            await saveSession(..., session, platform);
            return result;
        }
    }
}

// Step 6: Scoped cancel (detect before classifier)
const cancelScope = detectCancelScope(message);
if (cancelScope.scope !== 'latest' || /\b(cancel|el8e|la8e|cancelled)\b/i.test(message)) {
    // User explicitly mentioned cancel — route to cancel handler
    const classification = classifyIntent(message);
    if (classification.intent === 'cancel_order' || classification.intent === 'cancel_appointment') {
        const handler = await import('./handlers/deterministic');
        return await handler.handleCancel(input, config, replyLang, cancelScope);
    }
}
```

**Fix in `handlers/post-context.ts`:**
Ensure ALL post-context intents are handled:
- `cancel_latest` → cancel order/appointment
- `order_status` → lookup status
- `modify_order` → update variant/address
- `reschedule` → ask for new date/time
- `accept_offer` → enter FSM with pre-filled data
- `reject_offer` → clear context
- `reuse_details` → pre-fill customer info in FSM

**Fix in `handlers/deterministic.ts`:**
Add `handleCancel()` that routes to existing cancel logic:
```typescript
export async function handleCancel(
    input: AutomationInput,
    config: WorkspaceConfig,
    lang: string,
    scope: DetectedCancelScope
): Promise<AutomationResult> {
    if (input.workspaceType === 'ecommerce') {
        const result = await cancelOrdersForChat({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            scope: scope.scope as any,
            count: scope.count,
            ordinal: scope.ordinal as any,
            product: scope.product,
        });
        return cancelOrderReply(result, lang);
    }
    // appointments...
}
```

---

## ISSUE 2: RESPONSE GENERATOR MISSING OLD PROMPT CONTENT

**Problem:** The new `response-generator.ts` system prompt may be missing content from the old `agent.ts` `buildPrompt()`:
- Discount rules (max discount, min order threshold)
- Tool instructions per workspace type
- Business info, location, contact, shipping
- Lebanese vocabulary for Franco
- Emoji rules per workspace config

**Fix:**

In `response-generator.ts`, build the system prompt using ALL workspace config fields:

```typescript
function buildSystemPrompt(config: WorkspaceConfig, timeCtx: any, languageScript: string): string {
    const isFranco = languageScript === 'franco' || languageScript === 'mixed';
    
    // ── Discount block ─────────────────────────────────────
    let discountBlock = '';
    if (config.maxDiscount && config.maxDiscount > 0) {
        discountBlock = `DISCOUNTS:
- Max discount: ${config.maxDiscount}%${config.minOrderForDiscount ? ` (only on orders above $${config.minOrderForDiscount})` : ''}
- Only offer if they ASK. Never volunteer a discount.
- If they want more than ${config.maxDiscount}%: "Sorry, best price."`;
    } else {
        discountBlock = `DISCOUNTS: None. Prices are fixed.`;
    }

    // ── Tool block per workspace type ──────────────────────
    const toolBlock = config.businessType === 'appointments'
        ? `TOOLS:
- Use check_slot BEFORE confirming any booking.
- Use lookup_customer to check if they've been here before.
- Use book_appointment ONLY after explicit customer confirmation.
- NEVER say "booked" unless book_appointment returned success.`
        : `TOOLS:
- Use search_products for ANY question about products, prices, or stock.
- Use lookup_customer to check past orders.
- Use place_order ONLY after explicit confirmation.
- NEVER say "ordered" unless place_order returned success.`;

    // ── Language block ─────────────────────────────────────
    let languageBlock: string;
    if (isFranco) {
        languageBlock = `LANGUAGE: Reply in Lebanese Arabizi (Latin + numbers 3,7,5,2).
Use this vocabulary naturally:
${LEBANESE_VOCABULARY}`;
    } else if (languageScript === 'arabic') {
        languageBlock = `LANGUAGE: Reply in Arabic script (العربية).`;
    } else {
        languageBlock = `LANGUAGE: Reply in English.`;
    }

    // ── Tone ───────────────────────────────────────────────
    const toneMap: Record<string, string> = {
        'Casual': 'Casual & friendly — like a cool employee texting a friend.',
        'Professional': 'Professional & polished — courteous, precise.',
        'Luxury': 'Luxury & premium — elegant, refined.',
        'Sarcastic': 'Sarcastic & witty — helpful but with dry humor. Never rude.',
    };

    // ── Emoji ──────────────────────────────────────────────
    const emojiRule = config.useEmojis
        ? 'You may use up to 1 emoji per message, only when natural.'
        : 'Do NOT use any emojis. Zero.';

    return `You are the DM manager of "${config.businessName}".
Date: ${timeCtx.dayName}, ${timeCtx.isoDate} at ${timeCtx.isoTime}.

RULES:
1. Keep replies short: 1-3 sentences for WhatsApp, 1 sentence for quick replies.
2. ${toneMap[config.tone] || toneMap['Professional']}
3. ${emojiRule}
4. NEVER echo back what the customer said.
5. NEVER make up prices, stock, or availability. Use tools only.
6. For greetings: warm, short, natural. No tools needed.
7. ONLY use [HANDOFF] if user explicitly asks for human agent.
8. You are HUMAN. Never say you're an AI or bot.
9. NEVER retry a failed tool call.

${languageBlock}

${toolBlock}
${discountBlock}

${config.systemInstructions ? `BUSINESS INFO:\n${config.systemInstructions}` : ''}
${config.storeLocation ? `LOCATION: ${config.storeLocation}` : ''}
${config.contactInfo ? `CONTACT: ${config.contactInfo}` : ''}
${config.businessType === 'ecommerce' && config.shippingRules ? `SHIPPING: ${config.shippingRules}` : ''}`;
}
```

**Verification:** Compare the generated prompt byte-for-byte against the old `buildPrompt()` output for the same workspace config. Every field must be present.

---

## ISSUE 3: CLASSIFIER REGEX ACCURACY

**Problem:** Regex classifier may be too aggressive (misclassifies) or too passive (unnecessary 8b calls). Example: "I want to book a haircut" → regex might return `purchase_intent` instead of `booking_intent`.

**Fix in `intent-classifier-v3.ts`:**

Add workspace-type-aware regex patterns:

```typescript
// If workspace is appointments, boost booking-related intents
const APPOINTMENT_BOOST_WORDS = ['book', 'appointment', 'haircut', 'massage', 'reservation', 'maw3ed', '7ajez', '7ejz'];
const ECOMMERCE_BOOST_WORDS = ['order', 'buy', 'product', 'price', 'stock', 'ship', 'delivery', 'tlob', 'shtre', 'se3er'];

export function classifyIntent(message: string, workspaceType?: string): IntentClassification {
    const normalized = normalizeText(message);
    
    // Base regex classification
    let result = baseClassify(normalized);
    
    // Workspace-type boost
    if (workspaceType === 'appointments' && result.intent === 'purchase_intent') {
        if (APPOINTMENT_BOOST_WORDS.some(w => normalized.includes(w))) {
            result.intent = 'booking_intent';
            result.confidence = Math.min(result.confidence + 0.2, 0.95);
            result.source = 'regex_boosted';
        }
    }
    
    if (workspaceType === 'ecommerce' && result.intent === 'booking_intent') {
        if (ECOMMERCE_BOOST_WORDS.some(w => normalized.includes(w))) {
            result.intent = 'purchase_intent';
            result.confidence = Math.min(result.confidence + 0.2, 0.95);
            result.source = 'regex_boosted';
        }
    }
    
    return result;
}
```

**Add accuracy logging:**
```typescript
// Log every classification for later analysis
v2log.info('CLASSIFIER', `${result.intent} (${result.confidence})`, {
    source: result.source,
    messagePreview: message.slice(0, 40),
    workspaceType,
});
```

---

## ISSUE 4: METRICS DB WRITES CAUSE LATENCY

**Problem:** `metrics.ts` writes to Supabase on every message. At 1000 msg/hour, that's 1000 extra DB writes.

**Fix:** Batch metrics. Only write to stdout (Vercel captures). Flush to DB asynchronously.

```typescript
// metrics.ts
const METRIC_BATCH: Array<{metric: string, value: number, tags: Record<string, string>, timestamp: number}> = [];
const BATCH_SIZE = 100;
const BATCH_FLUSH_MS = 10000;

export function emitMetric(metric: string, value: number, tags: Record<string, string>): void {
    // Always log to stdout (Vercel/Datadog captures this)
    console.log(JSON.stringify({
        type: 'metric',
        metric,
        value,
        tags,
        timestamp: Date.now(),
    }));
    
    // Batch for DB write
    METRIC_BATCH.push({ metric, value, tags, timestamp: Date.now() });
    
    if (METRIC_BATCH.length >= BATCH_SIZE) {
        flushMetrics();
    }
}

let flushTimeout: NodeJS.Timeout | null = null;

function flushMetrics() {
    if (flushTimeout) clearTimeout(flushTimeout);
    
    const batch = METRIC_BATCH.splice(0, METRIC_BATCH.length);
    if (batch.length === 0) return;
    
    // Fire-and-forget DB write (don't await, don't block response)
    supabase.from('metrics').insert(batch.map(m => ({
        workspace_id: m.tags.workspace_id,
        metric: m.metric,
        value: m.value,
        tags: m.tags,
        timestamp: new Date(m.timestamp).toISOString(),
    }))).then(({ error }) => {
        if (error) console.error('Metrics flush failed:', error);
    });
    
    flushTimeout = null;
}

// Auto-flush every 10 seconds
if (!flushTimeout) {
    flushTimeout = setTimeout(flushMetrics, BATCH_FLUSH_MS);
}
```

**Key change:** `emitMetric` is now **synchronous** (no await). DB write happens in background. Response time unaffected.

---

## ISSUE 5: GHOST-BRAIN FALLBACK ON PARTIAL DB WRITES

**Problem:** If V3 crashes AFTER writing to DB but BEFORE sending reply, V2 fallback loads partial state and behaves unexpectedly.

**Fix in `ghost-brain.ts`:**

Only fall back to V2 on **code errors**, not on **DB write errors**. If V3 wrote state, don't let V2 continue from that state.

```typescript
if (engineVersion === 'v3') {
    try {
        const result = await runV3Orchestrator(input, config);
        // Success — return immediately
        return formatResult(result);
    } catch (v3Error: any) {
        const errMsg = v3Error?.message || '';
        
        // CRITICAL: If error happened AFTER state was saved, 
        // clear the state so V2 starts fresh
        if (errMsg.includes('state_saved') || errMsg.includes('after_persist')) {
            await clearConversationState(supabase, userId, workspaceId, chatId, workspaceType);
            console.warn('[Ghost Brain] V3 partial state cleared, falling back to V2 fresh');
        }
        
        // Only fall back for code errors, not for known failure modes
        if (errMsg.includes('rate_limited') || errMsg.includes('suspended')) {
            // These are intentional blocks — don't fall back, just return empty
            return { replyText: null, skipLegacyLogging: true };
        }
        
        console.error('[Ghost Brain] V3 failed, falling back to V2:', errMsg);
        // Fall through to V2
    }
}
```

**Better fix:** Make V3 stateless until the final save. Use a "draft state" object, only persist at the very end:

```typescript
// In orchestrator.ts
let draftSession = { ...session }; // Never mutate original

// ... process message, build draftSession ...

// ONLY save at the very end, after reply is ready
await saveSession(..., draftSession, platform);
return result;
```

If crash happens before the final `saveSession`, no partial state is written.

---

## ISSUE 6: TEMPLATE COVERAGE TRACKING

**Problem:** You don't know what % of messages actually use templates vs LLM.

**Fix:** Add template coverage metric.

```typescript
// In orchestrator.ts, after routing:
if (usedTemplate) {
    emitMetric('bot.template_used', 1, {
        template_id: templateId,
        workspace_type: workspaceType,
        intent: classification.intent,
    });
} else if (usedLLM) {
    emitMetric('bot.llm_fallback', 1, {
        workspace_type: workspaceType,
        intent: classification.intent,
        reason: 'no_template',
    });
}

// Dashboard query:
// template_coverage = template_used / (template_used + llm_fallback)
```

Add a simple dashboard endpoint:
```typescript
// api/admin/template-coverage/route.ts
export async function GET(req: Request) {
    const { workspaceId, hours = 24 } = parseQuery(req);
    
    const { data: metrics } = await supabase
        .from('metrics')
        .select('metric, count(*)')
        .eq('workspace_id', workspaceId)
        .gte('timestamp', new Date(Date.now() - hours * 3600000).toISOString())
        .in('metric', ['bot.template_used', 'bot.llm_fallback'])
        .group('metric');
    
    const templateCount = metrics?.find(m => m.metric === 'bot.template_used')?.count || 0;
    const llmCount = metrics?.find(m => m.metric === 'bot.llm_fallback')?.count || 0;
    const total = templateCount + llmCount;
    
    return Response.json({
        templateCount,
        llmCount,
        total,
        coverage: total > 0 ? (templateCount / total) : 0,
        target: 0.70,
    });
}
```

---

## ACCEPTANCE CRITERIA

- [ ] "cancel the second order" → deterministic cancel handler (not LLM)
- [ ] "same info" after order → post-context reuse handler
- [ ] "change address to Hamra" → post-context modify handler
- [ ] "yeah" after "Want one?" → post-context accept handler
- [ ] Response generator prompt includes: discounts, tools, business info, location, shipping, Lebanese vocab
- [ ] Classifier logs every decision with source (regex/regex_boosted/llm)
- [ ] emitMetric is synchronous (no await), DB flush is background
- [ ] V3 crash before final save → no partial state in DB
- [ ] Template coverage metric emitted on every message
- [ ] `tsc --noEmit` passes with 0 errors
