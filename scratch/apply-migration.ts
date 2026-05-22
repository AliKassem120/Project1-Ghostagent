import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function main() {
    const migrationFile = path.join(__dirname, '../supabase/migrations/20260523_conversation_summaries.sql');
    console.log(`Reading migration from: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf8');

    // Let's try direct connection first (supports IPv6)
    const client = new Client({
        host: 'db.kysrcsqkgngigvjvwlat.supabase.co',
        user: 'postgres',
        password: 'Tkbh2kvweAjQfysq',
        database: 'postgres',
        port: 5432,
        ssl: { rejectUnauthorized: false }
    });

    console.log('Connecting to direct database host...');
    let directClient: Client | null = null;
    try {
        directClient = new Client({
            host: 'db.kysrcsqkgngigvjvwlat.supabase.co',
            user: 'postgres',
            password: 'Tkbh2kvweAjQfysq',
            database: 'postgres',
            port: 5432,
            ssl: { rejectUnauthorized: false }
        });
        await directClient.connect();
        console.log('Connected! Executing migration queries...');
        await directClient.query(sql);
        console.log('🎉 Migration applied successfully!');
    } catch (err: any) {
        console.error('❌ Failed to connect or execute via direct host:', err.message);
        console.log('Let us try connecting via the aws-1 connection pooler...');
        
        let poolerClient: Client | null = null;
        try {
            poolerClient = new Client({
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
            await poolerClient.connect();
            console.log('Connected to aws-1 pooler! Executing migration...');
            await poolerClient.query(sql);
            console.log('🎉 Migration applied successfully!');
        } catch (poolerErr: any) {
            console.error('❌ Failed to connect via aws-1 pooler:', poolerErr.message);
            
            console.log('Let us try connecting via the aws-0 connection pooler...');
            let poolerClient0: Client | null = null;
            try {
                poolerClient0 = new Client({
                    host: 'aws-0-ap-south-1.pooler.supabase.com',
                    user: 'postgres.kysrcsqkgngigvjvwlat',
                    password: 'Tkbh2kvweAjQfysq',
                    database: 'postgres',
                    port: 6543,
                    ssl: { 
                        rejectUnauthorized: false,
                        servername: 'db.kysrcsqkgngigvjvwlat.supabase.co'
                    }
                });
                await poolerClient0.connect();
                console.log('Connected to aws-0 pooler! Executing migration...');
                await poolerClient0.query(sql);
                console.log('🎉 Migration applied successfully!');
            } catch (poolerErr0: any) {
                console.error('❌ Failed to connect via aws-0 pooler:', poolerErr0.message);
                process.exit(1);
            } finally {
                if (poolerClient0) await poolerClient0.end().catch(() => {});
            }
        } finally {
            if (poolerClient) await poolerClient.end().catch(() => {});
        }
    } finally {
        if (directClient) await directClient.end().catch(() => {});
    }
}

main().catch(console.error);
