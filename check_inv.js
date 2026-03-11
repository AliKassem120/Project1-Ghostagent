const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from('inventory').select('*').limit(1);
    if (error) {
        console.error(error);
    } else if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
    } else {
        console.log("No data in inventory table");
        // Try to get column names from information_schema
        const { data: cols } = await supabase.rpc('get_table_columns', { table_name: 'inventory' });
        console.log(cols);
    }
}
check();
