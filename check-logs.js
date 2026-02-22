const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkLogs() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    console.log("Fetching last 5 activity logs...");
    const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    data.forEach(log => {
        console.log(`[${log.event_type}] ${log.description} | Time: ${log.timestamp}`);
        if (log.metadata?.error) console.log(`   Error: ${log.metadata.error}`);
    });
}

checkLogs();
