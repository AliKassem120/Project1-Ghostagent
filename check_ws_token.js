import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

async function checkToken() {
    const wsId = 'f81231c1-4c3a-4b56-a4d7-a9b5252cdb0f';
    console.log(`Checking token for workspace: ${wsId}`);

    // Check new table
    const { data: integ } = await supabase.from('instagram_integrations').select('*').eq('workspace_id', wsId).maybeSingle();
    console.log('--- NEW TABLE (instagram_integrations) ---');
    if (integ) {
        console.log(`Account ID: ${integ.instagram_account_id}`);
        console.log(`Token exactly: >${integ.access_token}<`);
        console.log(`Token length: ${integ.access_token.length}`);

        let sanit = integ.access_token.trim();
        if (sanit.startsWith('"') && sanit.endsWith('"')) sanit = sanit.slice(1, -1);
        if (sanit.startsWith('{')) {
            try {
                const p = JSON.parse(sanit);
                sanit = p.access_token || sanit;
            } catch (e) { }
        }
        console.log(`Sanitized token: >${sanit}<`);

    } else {
        console.log('No integration found in new table.');
    }

    // Check old table fallback
    const { data: userConn } = await supabase.from('user_connections').select('*').eq('workspace_id', wsId).maybeSingle();
    console.log('\n--- OLD TABLE (user_connections) ---');
    if (userConn && userConn.metadata) {
        console.log(`Account ID: ${userConn.account_id}`);
        console.log(`Token exactly: >${userConn.metadata.access_token}<`);
        const jsonStr = JSON.stringify(userConn.metadata);
        console.log(`Full metadata: ${jsonStr}`);
    } else {
        console.log('No integration found in old table.');
    }
}

checkToken();
