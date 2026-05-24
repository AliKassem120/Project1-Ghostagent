import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    console.log('Fetching all activity logs for chat_id: 1433718888490869');
    
    // Querying logs where chat_id matches in metadata
    const { data: logs, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('timestamp', { ascending: true });

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    const filtered = logs?.filter(log => {
        const metaStr = JSON.stringify(log.metadata || {});
        return metaStr.includes('1433718888490869') || log.description?.includes('1433718888490869');
    });

    console.log(`Found ${filtered?.length || 0} log entries.`);
    filtered?.forEach(log => {
        console.log(`[${log.timestamp}] [WS: ${log.workspace_id}] ${log.event_type} - ${log.description}`);
        if (log.metadata && Object.keys(log.metadata).length > 0) {
            console.log(`   Metadata: ${JSON.stringify(log.metadata)}`);
        }
    });
}

main().catch(console.error);
