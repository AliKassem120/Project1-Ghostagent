import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function auditWorkspace(workspaceId: string) {
    console.log(`\n🔍 Auditing Workspace: ${workspaceId}`);

    // 1. AI Settings
    const { data: settings, error: settingsError } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle();

    if (settingsError) console.error('❌ AI Settings Error:', settingsError.message);
    else if (!settings) console.error('❌ AI Settings: NOT FOUND');
    else console.log('✅ AI Settings: FOUND');

    // 2. Business Hours
    const { data: hours, error: hoursError } = await supabase
        .from('business_hours')
        .select('id')
        .eq('workspace_id', workspaceId);

    if (hoursError) console.error('❌ Business Hours Error:', hoursError.message);
    else console.log(`✅ Business Hours: ${hours?.length || 0} rows`);

    // 3. Services
    const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id')
        .eq('workspace_id', workspaceId);

    if (servicesError) console.error('❌ Services Error:', servicesError.message);
    else console.log(`✅ Services: ${services?.length || 0} rows`);

    // 4. Inventory
    const { data: inventory, error: inventoryError } = await supabase
        .from('inventory')
        .select('id')
        .eq('workspace_id', workspaceId);

    if (inventoryError) console.error('❌ Inventory Error:', inventoryError.message);
    else console.log(`✅ Inventory (DB): ${inventory?.length || 0} rows`);

    // 5. Business Knowledge (CSV)
    const { data: knowledge, error: knowledgeError } = await supabase
        .from('business_knowledge')
        .select('file_name')
        .eq('workspace_id', workspaceId);

    if (knowledgeError) console.error('❌ Business Knowledge Error:', knowledgeError.message);
    else console.log(`✅ Business Knowledge (CSV): ${knowledge?.length || 0} files (${knowledge?.map(k => k.file_name).join(', ') || 'none'})`);

    console.log('\nAudit Complete.\n');
}

const workspaceId = process.argv[2];
if (!workspaceId) {
    console.error('Usage: npx ts-node scripts/audit-automation-connections.ts <workspace_id>');
    process.exit(1);
}

auditWorkspace(workspaceId);
