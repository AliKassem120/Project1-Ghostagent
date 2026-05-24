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
        const res = await client.query(`
            SELECT 
                conname AS constraint_name, 
                pg_get_constraintdef(c.oid) AS constraint_def
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'public.conversation_states'::regclass;
        `);
        console.log('Constraints on conversation_states:');
        console.log(res.rows);
        await client.end();
    } catch (err: any) {
        console.error('❌ Failed to inspect constraints:', err.message);
    }
}

main().catch(console.error);
