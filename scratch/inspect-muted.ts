import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    console.log('Fetching conversation state for chat_id: 1433718888490869');
    const { data: state, error: stateError } = await supabase
        .from('conversation_states')
        .select('*')
        .eq('chat_id', '1433718888490869');

    if (stateError) {
        console.error('Error fetching conversation state:', stateError);
    } else {
        console.log('Conversation state records:', JSON.stringify(state, null, 2));
    }

    console.log('\nFetching customer profiles for chat_id: 1433718888490869');
    const { data: profiles, error: profileError } = await supabase
        .from('customers')
        .select('*')
        .eq('chat_id', '1433718888490869');

    if (profileError) {
        console.error('Error fetching customers:', profileError);
    } else {
        console.log('Customer records:', JSON.stringify(profiles, null, 2));
    }
}

main().catch(console.error);
