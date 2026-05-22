import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function main() {
    const migrationFile = path.join(__dirname, '../supabase/migrations/20260523_customer_notes.sql');
    console.log(`Reading migration from: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf8');

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
        console.log('Connected! Executing customer_notes migration...');
        await client.query(sql);
        console.log('🎉 customer_notes migration applied successfully!');
        await client.end();
    } catch (err: any) {
        console.error('❌ Failed:', err.message);
        
        // Try direct host
        const directClient = new Client({
            host: 'db.kysrcsqkgngigvjvwlat.supabase.co',
            user: 'postgres',
            password: 'Tkbh2kvweAjQfysq',
            database: 'postgres',
            port: 5432,
            ssl: { rejectUnauthorized: false }
        });
        
        try {
            await directClient.connect();
            console.log('Connected via direct host! Executing migration...');
            await directClient.query(sql);
            console.log('🎉 customer_notes migration applied successfully!');
            await directClient.end();
        } catch (err2: any) {
            console.error('❌ Direct also failed:', err2.message);
        }
    }
}

main().catch(console.error);
