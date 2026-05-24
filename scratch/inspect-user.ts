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
        
        console.log('--- Fetching User Details ---');
        const res = await client.query(`
            SELECT id, email, plan_tier, trial_ends_at, current_period_end
            FROM users
            WHERE id = 'a91ad903-67af-4977-951b-ab7735b34625';
        `);
        console.log(res.rows[0]);

        await client.end();
    } catch (err: any) {
        console.error('❌ Failed:', err.message);
    }
}

main().catch(console.error);
