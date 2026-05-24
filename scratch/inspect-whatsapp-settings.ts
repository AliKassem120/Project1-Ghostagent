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
        
        console.log('--- Fetching WhatsApp Settings ---');
        const res = await client.query(`
            SELECT id, name, user_id, whatsapp_phone_number_id, whatsapp_business_account_id, whatsapp_access_token, emergency_whatsapp
            FROM ai_settings
            WHERE user_id = 'a91ad903-67af-4977-951b-ab7735b34625';
        `);
        console.log(JSON.stringify(res.rows, null, 2));

        await client.end();
    } catch (err: any) {
        console.error('❌ Failed:', err.message);
    }
}

main().catch(console.error);
