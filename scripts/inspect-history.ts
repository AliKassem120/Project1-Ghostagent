import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    console.log('--- DB INSPECTION START ---');

    // 1. Find the workspace for "Ali" or containing "ali"
    const { data: workspaces, error: wsErr } = await supabase
        .from('workspaces')
        .select('*');

    if (wsErr) {
        console.error('Error fetching workspaces:', wsErr);
        return;
    }

    console.log('Workspaces list:');
    for (const ws of workspaces) {
        console.log(`Workspace:`, JSON.stringify(ws));
    }

    // Load AI settings for all workspaces
    const { data: aiSettings } = await supabase
        .from('ai_settings')
        .select('*');
    
    console.log('\nAI Settings:');
    for (const set of aiSettings || []) {
        console.log(`AI Settings Row:`, JSON.stringify(set));
    }

    const aliSalonWorkspace = aiSettings?.find(s => s.business_name?.toLowerCase().includes('ali') || s.system_instructions?.toLowerCase().includes('ali'))?.id || workspaces[0]?.id;
    console.log(`\nAssumed Ali Salon Workspace: ${aliSalonWorkspace}`);

    if (!aliSalonWorkspace) {
        console.log('No workspace found.');
        return;
    }

    // 2. Load services for this workspace
    const { data: services } = await supabase
        .from('services')
        .select('*')
        .eq('workspace_id', aliSalonWorkspace);
    console.log('\nServices:');
    for (const s of services || []) {
        console.log(`Name: ${s.name}, Price: ${s.price}, Duration: ${s.duration_minutes} min, Aliases: ${JSON.stringify(s.aliases)}, Active: ${s.is_active}`);
    }

    // 3. Search for customer records matching '78820707'
    console.log('\nSearching for customers / profiles matching phone containing "78820707" or "78820707":');
    
    const { data: customers } = await supabase
        .from('customers')
        .select('*');
    
    const matchedCustomers = customers?.filter(c => 
        c.phone?.includes('78820707') || 
        c.chat_id?.includes('78820707') ||
        c.name?.toLowerCase().includes('ali')
    );
    console.log('Matched Customers in customers table:');
    console.log(JSON.stringify(matchedCustomers, null, 2));

    const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('*');
    
    const matchedProfiles = profiles?.filter(p => 
        p.phone?.includes('78820707') || 
        p.instagram_chat_id?.includes('78820707') ||
        p.whatsapp_chat_id?.includes('78820707') ||
        p.name?.toLowerCase().includes('ali')
    );
    console.log('\nMatched Customer Profiles in customer_profiles table:');
    console.log(JSON.stringify(matchedProfiles, null, 2));

    // 4. Check conversation states
    const { data: convStates } = await supabase
        .from('conversation_states')
        .select('*');
    console.log('\nActive Conversation States:');
    console.log(JSON.stringify(convStates, null, 2));

    // 5. Look at recent appointments
    const { data: appts } = await supabase
        .from('appointments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    console.log('\nRecent Appointments:');
    for (const a of appts || []) {
        console.log(`Name: ${a.customer_name}, Phone: ${a.customer_phone}, Service: ${a.service}, Date: ${a.appointment_date}, Time: ${a.start_time}, Status: ${a.status}`);
    }

    // 6. Look at activity_log
    const { data: activityLogs } = await supabase
        .from('activity_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);
    
    console.log('\nRecent Activity Log:');
    for (const log of activityLogs || []) {
        console.log(`[${log.timestamp}] ${log.event_type} - ${log.description}`);
        if (log.metadata) {
            console.log(`  Metadata: ${JSON.stringify(log.metadata)}`);
        }
    }
}

main().catch(console.error);
