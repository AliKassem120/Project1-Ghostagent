import { Client } from 'pg';

async function main() {
    const client = new Client({
        host: 'aws-1-ap-south-1.pooler.supabase.com',
        user: 'postgres.kysrcsqkgngigvjvwlat',
        password: 'Tkbh2kvweAjQfysq',
        database: 'postgres',
        port: 6543,
        ssl: { 
            rejectUnauthorized: false,
            servername: 'db.kysrcsqkgngigvjvwlat.supabase.co'
        }
    });

    try {
        await client.connect();
        
        console.log('--- Fetching recent alerts/errors ---');
        const res = await client.query(`
            SELECT id, user_id, event_type, description, metadata, timestamp
            FROM activity_log
            WHERE event_type IN ('SYSTEM_ALERT', 'SYSTEM_ERROR', 'SYSTEM_WARNING') 
               OR description ILIKE '%error%' 
               OR description ILIKE '%failed%' 
               OR description ILIKE '%block%'
            ORDER BY timestamp DESC
            LIMIT 30;
        `);
        console.table(res.rows);

        await client.end();
    } catch (err: any) {
        console.error('❌ Failed:', err.message);
    }
}

main().catch(console.error);
