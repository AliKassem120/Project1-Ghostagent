import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    console.log('--- FETCHING HANDOFF QUEUE FOR CHAT_ID: 1433718888490869 ---');
    const { data: handoffs, error: err } = await supabase
        .from('handoff_queue')
        .select('*')
        .eq('chat_id', '1433718888490869');

    if (err) {
        console.error('Error fetching handoff_queue:', err);
    } else {
        console.log('Handoff Queue entries:', JSON.stringify(handoffs, null, 2));
    }
}

main().catch(console.error);
