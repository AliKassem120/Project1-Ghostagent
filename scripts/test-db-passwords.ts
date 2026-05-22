import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const host = 'aws-0-ap-south-1.pooler.supabase.com';
const database = 'postgres';
const port = 6543;

const usersToTry = [
    'postgres.kysrcsqkgngigvjvwlat',
    'postgres'
];

const passwordsToTry = [
    'agentgodmode',
    'ghost123agent',
    'ghost_supabase_webhook_secret_2024',
    'sktTFNY76frE',
    'CdYBfJk5munx',
    'ghostagent',
    'ghostagent123',
    'ghost_agent',
    'ali123',
    'aliSalon',
    'alisalon'
];

async function tryConnect(user: string, password: string): Promise<boolean> {
    const client = new Client({
        host,
        user,
        password,
        database,
        port,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log(`\n✅ Success! User: ${user}, Password: ${password}`);
        
        const res = await client.query('SELECT version();');
        console.log('Postgres version:', res.rows[0].version);
        
        await client.end();
        return true;
    } catch (err: any) {
        console.log(`❌ Failed: User=${user}, Password=${password} (${err.message})`);
        return false;
    }
}

async function main() {
    console.log('Testing passwords to connect to Supabase Pooler...');
    for (const user of usersToTry) {
        for (const pwd of passwordsToTry) {
            const success = await tryConnect(user, pwd);
            if (success) {
                console.log('Found working database connection!');
                process.exit(0);
            }
        }
    }
    console.log('None of the tested credentials worked.');
}

main().catch(console.error);
