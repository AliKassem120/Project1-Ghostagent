import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    console.log('--- COMPACT ACTIVITY LOGS ---');
    const { data: logs, error: logsError } = await supabase
        .from('activity_log')
        .select('timestamp, event_type, description, workspace_id')
        .order('timestamp', { ascending: false })
        .limit(200);

    if (logsError) {
        console.error('Error fetching logs:', logsError);
    } else {
        const filteredLogs = logs?.filter(log => 
            JSON.stringify(log).includes('1433718888490869') || 
            (log.description && (
                log.description.includes('Ali') ||
                log.description.includes('mute') ||
                log.description.includes('Muted') ||
                log.description.includes('Autopilot')
            ))
        );
        console.log('Filtered Activity Logs:');
        filteredLogs?.forEach(log => {
            console.log(`[${log.timestamp}] [${log.workspace_id}] ${log.event_type} - ${log.description}`);
        });
    }
}

main().catch(console.error);
