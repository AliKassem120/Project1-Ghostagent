import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    console.log('Checking if conversation_summaries table exists...');
    const { data, error } = await supabase
        .from('conversation_summaries')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching from conversation_summaries:', error);
    } else {
        console.log('Successfully connected to conversation_summaries table!', data);
    }
}

main().catch(console.error);
