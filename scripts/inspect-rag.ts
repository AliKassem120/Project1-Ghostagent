import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    const { data: trainingData } = await supabase
        .from('business_training_data')
        .select('*');
    
    console.log('Training Data Count:', trainingData?.length);
    for (const row of trainingData || []) {
        if (row.owner_reply?.includes('50') || row.owner_reply?.toLowerCase().includes('ll') || row.owner_reply?.toLowerCase().includes('lbp') || row.owner_reply?.toLowerCase().includes('haircut')) {
            console.log(`Matched RAG Row:`, JSON.stringify(row));
        }
    }
}

main().catch(console.error);
