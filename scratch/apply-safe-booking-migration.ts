// @ts-nocheck
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function main() {
    const migrationFile = path.join(__dirname, '../supabase/migrations/20260531_safe_booking_rpc.sql');
    console.log(`Reading migration from: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf8');

    const poolerClient = new Client({
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
        await poolerClient.connect();
        console.log('Connected via aws-1 pooler! Executing migration...');
        await poolerClient.query(sql);
        console.log('🎉 Migration applied successfully via pooler!');
    } catch (poolerErr: any) {
        console.error('❌ Failed via pooler:', poolerErr.message);
        process.exit(1);
    } finally {
        await poolerClient.end().catch(() => {});
    }
}

main().catch(console.error);
