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

const combinations = [
    'user_id,workspace_id,chat_id,workspace_type,platform',
    'user_id,workspace_id,chat_id,workspace_type',
    'user_id,workspace_id,chat_id',
    'workspace_id,chat_id,workspace_type,platform',
    'workspace_id,chat_id,workspace_type',
    'workspace_id,chat_id,platform',
    'workspace_id,chat_id',
    'workspace_id,external_chat_id',
    'workspace_id,external_chat_id,platform',
    'chat_id',
    'external_chat_id'
];

async function test() {
    const payload = {
        user_id: '5e10d723-17ec-42d9-83fa-5fe5520d4b70',
        workspace_id: '4a4a768c-9f8d-4b49-b625-5e6292bb7a7a',
        workspace_type: 'appointments',
        chat_id: 'test_upsert_chat_id_temp',
        external_chat_id: 'test_upsert_chat_id_temp',
        stage: 'idle',
        platform: 'WHATSAPP',
        data: {},
        updated_at: new Date().toISOString()
    };

    for (const combo of combinations) {
        const r = await supabase
            .from('conversation_states')
            .upsert(payload, { onConflict: combo });
        console.log(`onConflict: '${combo}' -> ${r.error ? r.error.code + ' : ' + r.error.message : 'SUCCESS'}`);
    }
}

test().catch(console.error);
