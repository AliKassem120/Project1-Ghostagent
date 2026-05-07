/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Live DB Smoke Test
 * ═══════════════════════════════════════════════════════════════
 * Verifies actual Postgres schema constraints by inserting and
 * updating real rows in a live Supabase instance.
 *
 * This does NOT run in normal CI. It requires:
 *   RUN_DB_SMOKE_TEST=true
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DB_SMOKE_TEST_WORKSPACE_ID
 *
 * The script auto-discovers user_id from ai_settings.
 *
 * Usage:
 *   RUN_DB_SMOKE_TEST=true npm run test:db-smoke
 *
 * All test rows are cleaned up at the end (even on failure).
 *
 * Unit tests cannot prove DB CHECK constraints.
 * This verifies live Supabase schema.
 */

import { createClient } from '@supabase/supabase-js';

// ── Gate ─────────────────────────────────────────────────────
if (process.env.RUN_DB_SMOKE_TEST !== 'true') {
    console.log('⏭️  DB smoke test skipped. Set RUN_DB_SMOKE_TEST=true to run.');
    process.exit(0);
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKSPACE_ID = process.env.DB_SMOKE_TEST_WORKSPACE_ID;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
if (!WORKSPACE_ID) {
    console.error('❌ Missing DB_SMOKE_TEST_WORKSPACE_ID');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Test state ───────────────────────────────────────────────
const SMOKE_PREFIX = '__smoke_test__';
const CHAT_ID = `${SMOKE_PREFIX}${Date.now()}`;
let passed = 0;
let failed = 0;
const cleanupIds: { table: string; id: string }[] = [];

function ok(label: string) {
    passed++;
    console.log(`  ✅ ${label}`);
}

function fail(label: string, err: any) {
    failed++;
    console.error(`  ❌ ${label}:`, err?.message || err);
}

// ── Tests ────────────────────────────────────────────────────

async function resolveUserId(): Promise<string> {
    const { data, error } = await supabase
        .from('ai_settings')
        .select('user_id')
        .eq('id', WORKSPACE_ID)
        .single();

    if (error || !data?.user_id) {
        console.error(`❌ Cannot resolve user_id from ai_settings for workspace ${WORKSPACE_ID}:`, error?.message);
        process.exit(1);
    }
    return data.user_id;
}

async function testConversationStates(userId: string) {
    console.log('\n📋 conversation_states');

    // Uses the same select-then-insert/update pattern as store.ts
    for (const wsType of ['ecommerce', 'appointments', 'saas_support'] as const) {
        const chatId = `${CHAT_ID}_${wsType}`;

        const { data: inserted, error } = await supabase
            .from('conversation_states')
            .insert({
                user_id: userId,
                workspace_id: WORKSPACE_ID,
                chat_id: chatId,
                external_chat_id: chatId,
                workspace_type: wsType,
                platform: 'instagram',
                stage: 'idle',
                data: { _smoke: true },
            })
            .select('id')
            .single();

        if (error) {
            fail(`Insert workspace_type=${wsType}`, error);
        } else {
            ok(`Insert workspace_type=${wsType}`);
            if (inserted?.id) cleanupIds.push({ table: 'conversation_states', id: inserted.id });
        }
    }

    // Verify platform and external_chat_id are present
    const chatId = `${CHAT_ID}_ecommerce`;
    const { data: row, error: readErr } = await supabase
        .from('conversation_states')
        .select('platform, external_chat_id')
        .eq('chat_id', chatId)
        .eq('workspace_id', WORKSPACE_ID)
        .maybeSingle();

    if (readErr || !row) {
        fail('Read platform + external_chat_id', readErr);
    } else if (row.platform === 'instagram' && row.external_chat_id === chatId) {
        ok('platform and external_chat_id accepted');
    } else {
        fail('platform/external_chat_id values mismatch', {
            expected: { platform: 'instagram', external_chat_id: chatId },
            got: row,
        });
    }
}

async function testOrders(userId: string) {
    console.log('\n📦 orders');

    // Matches real column names from ecommerce/orders.ts
    const { data: order, error: insertErr } = await supabase
        .from('orders')
        .insert({
            user_id: userId,
            workspace_id: WORKSPACE_ID,
            platform: 'instagram',
            chat_id: CHAT_ID,
            instagram_user_id: CHAT_ID,
            instagram_handle: SMOKE_PREFIX,
            customer_name: SMOKE_PREFIX,
            customer_phone: '0000000000',
            customer_address: 'Smoke Test Address',
            item_requested: `${SMOKE_PREFIX} Item x1`,
            variant_label: null,
            quantity: 1,
            unit_price: 0,
            status: 'Pending',
            raw_message: JSON.stringify({ _smoke: true }),
        })
        .select('id')
        .single();

    if (insertErr || !order) {
        fail('Insert order (Pending)', insertErr);
        return;
    }
    ok('Insert order (Pending)');
    cleanupIds.push({ table: 'orders', id: order.id });

    // Update Pending → Cancelled
    const { error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'Cancelled' })
        .eq('id', order.id);

    if (updateErr) {
        fail('Update order Pending → Cancelled', updateErr);
    } else {
        ok('Update order Pending → Cancelled');
    }
}

async function testAppointments(userId: string) {
    console.log('\n📅 appointments');

    // Matches real column names from appointments/create-appointment.ts
    const { data: appt, error: insertErr } = await supabase
        .from('appointments')
        .insert({
            user_id: userId,
            workspace_id: WORKSPACE_ID,
            platform: 'instagram',
            chat_id: CHAT_ID,
            instagram_user_id: CHAT_ID,
            instagram_handle: SMOKE_PREFIX,
            customer_name: SMOKE_PREFIX,
            customer_phone: '0000000000',
            service: 'Smoke Test Service',
            appointment_date: '2099-12-31',
            start_time: '09:00',
            end_time: '10:00',
            duration_minutes: 60,
            status: 'confirmed',
            notes: 'DB smoke test — will be deleted',
        })
        .select('id')
        .single();

    if (insertErr || !appt) {
        fail('Insert appointment (confirmed)', insertErr);
        return;
    }
    ok('Insert appointment (confirmed)');
    cleanupIds.push({ table: 'appointments', id: appt.id });

    // Update confirmed → cancelled
    const { error: updateErr } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appt.id);

    if (updateErr) {
        fail('Update appointment confirmed → cancelled', updateErr);
    } else {
        ok('Update appointment confirmed → cancelled');
    }
}

async function testBusinessKnowledge(userId: string) {
    console.log('\n📚 business_knowledge');

    // UNIQUE(user_id, workspace_id) means only one row per workspace.
    // Instead of inserting, verify existing knowledge has user_id set.
    const { data: existing, error: readErr } = await supabase
        .from('business_knowledge')
        .select('id, user_id, visibility')
        .eq('workspace_id', WORKSPACE_ID)
        .limit(1)
        .maybeSingle();

    if (readErr) {
        fail('Read business_knowledge', readErr);
        return;
    }

    if (!existing) {
        // No knowledge exists for this workspace — test insert with user_id
        const { data: kb, error: insertErr } = await supabase
            .from('business_knowledge')
            .insert({
                user_id: userId,
                workspace_id: WORKSPACE_ID,
                title: `${SMOKE_PREFIX} ${Date.now()}`,
                content: 'This is a smoke test entry.',
                source_type: 'manual',
                visibility: 'public',
                file_name: `${SMOKE_PREFIX}${Date.now()}.txt`,
            })
            .select('id')
            .single();

        if (insertErr || !kb) {
            fail('Insert business_knowledge with user_id', insertErr);
            return;
        }
        ok('Insert business_knowledge with user_id');
        cleanupIds.push({ table: 'business_knowledge', id: kb.id });
    } else {
        // Verify existing row has user_id
        if (existing.user_id === userId) {
            ok('Existing business_knowledge has correct user_id');
        } else if (existing.user_id) {
            ok(`Existing business_knowledge has user_id (${existing.user_id})`);
        } else {
            fail('Existing business_knowledge has NULL user_id', { row: existing });
        }
    }

    // Verify visibility column exists and is readable
    if (existing && existing.visibility) {
        ok(`business_knowledge visibility column exists (value: ${existing.visibility})`);
    } else if (existing) {
        fail('business_knowledge missing visibility column', { row: existing });
    }
}

// ── Cleanup ──────────────────────────────────────────────────

async function cleanup() {
    console.log('\n🧹 Cleanup');
    for (const { table, id } of cleanupIds) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) {
            console.warn(`  ⚠️  Failed to clean ${table}/${id}: ${error.message}`);
        } else {
            console.log(`  🗑️  Deleted ${table}/${id}`);
        }
    }
}

// ── Run ──────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log(' GhostAgent — Live DB Smoke Test');
    console.log('═══════════════════════════════════════════');
    console.log(`Supabase:    ${SUPABASE_URL}`);
    console.log(`Workspace:   ${WORKSPACE_ID}`);

    const userId = await resolveUserId();
    console.log(`User:        ${userId}`);
    console.log(`Chat prefix: ${CHAT_ID}`);

    try {
        await testConversationStates(userId);
        await testOrders(userId);
        await testAppointments(userId);
        await testBusinessKnowledge(userId);
    } finally {
        await cleanup();
    }

    console.log('\n═══════════════════════════════════════════');
    console.log(` Results: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════');

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('💥 Unexpected error:', err);
    cleanup().finally(() => process.exit(1));
});
