/**
 * Run migration SQL statements against Supabase using the
 * postgres connection string via the 'pg' package.
 */
const { Client } = require('pg');

// Supabase direct connection (from Dashboard > Settings > Database > Connection string)
// Format: postgresql://postgres.[ref]:[password]@[host]:5432/postgres
const connectionString = `postgresql://postgres.kysrcsqkgngigvjvwlat:${process.argv[2]}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;

const statements = [
    // 1. Drop FK on customers.workspace_id
    `ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_workspace_id_fkey;`,
    
    // 2. Ensure unique constraint on customers(workspace_id, chat_id)
    `DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'customers_workspace_id_chat_id_key'
              AND conrelid = 'customers'::regclass
        ) THEN
            ALTER TABLE customers
                ADD CONSTRAINT customers_workspace_id_chat_id_key
                UNIQUE (workspace_id, chat_id);
        END IF;
    END $$;`,

    // 3. Add UNIQUE constraints on customer_profiles
    `ALTER TABLE customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_ws_ig_unique;`,
    `ALTER TABLE customer_profiles ADD CONSTRAINT customer_profiles_ws_ig_unique UNIQUE (workspace_id, instagram_chat_id);`,
    `ALTER TABLE customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_ws_wa_unique;`,
    `ALTER TABLE customer_profiles ADD CONSTRAINT customer_profiles_ws_wa_unique UNIQUE (workspace_id, whatsapp_chat_id);`,
];

async function run() {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('Connected to Supabase Postgres');

    for (let i = 0; i < statements.length; i++) {
        try {
            await client.query(statements[i]);
            console.log(`✅ Statement ${i + 1}/${statements.length} succeeded`);
        } catch (err) {
            console.error(`❌ Statement ${i + 1}/${statements.length} failed:`, err.message);
        }
    }

    await client.end();
    console.log('Done!');
}

run().catch(err => { console.error('Connection failed:', err.message); process.exit(1); });
