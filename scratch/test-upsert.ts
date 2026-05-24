import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !key.startsWith('#')) process.env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
    const payload = {
        user_id: '5e10d723-17ec-42d9-83fa-5fe5520d4b70',
        workspace_id: '4a4a768c-9f8d-4b49-b625-5e6292bb7a7a',
        workspace_type: 'appointments',
        chat_id: 'test_upsert_chat_id_123',
        external_chat_id: 'test_upsert_chat_id_123',
        stage: 'idle',
        platform: 'WHATSAPP',
        data: {},
        updated_at: new Date().toISOString()
    };

    console.log('Testing onConflict: workspace_id,external_chat_id...');
    const r1 = await supabase
        .from('conversation_states')
        .upsert(payload, { onConflict: 'workspace_id,external_chat_id' });
    console.log('Result r1:', r1.error ? r1.error : 'SUCCESS');

    console.log('\nTesting onConflict: workspace_id,chat_id...');
    const r2 = await supabase
        .from('conversation_states')
        .upsert(payload, { onConflict: 'workspace_id,chat_id' });
    console.log('Result r2:', r2.error ? r2.error : 'SUCCESS');

    console.log('\nTesting onConflict: user_id,workspace_id,chat_id,workspace_type...');
    const r3 = await supabase
        .from('conversation_states')
        .upsert(payload, { onConflict: 'user_id,workspace_id,chat_id,workspace_type' });
    console.log('Result r3:', r3.error ? r3.error : 'SUCCESS');
}

test().catch(console.error);
