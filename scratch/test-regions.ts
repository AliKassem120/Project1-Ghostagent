import { Client } from 'pg';

const regions = [
    'ap-south-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'sa-east-1',
    'ca-central-1'
];

async function checkRegion(region: string) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const client = new Client({
        host,
        user: 'postgres.kysrcsqkgngigvjvwlat',
        password: 'Tkbh2kvweAjQfysq',
        database: 'postgres',
        port: 6543,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();
        console.log(`\n🎉 SUCCESS in region ${region}! Host: ${host}`);
        await client.end();
        return true;
    } catch (err: any) {
        console.log(`Region ${region}: ${err.message}`);
        return false;
    }
}

async function main() {
    console.log('Testing regions...');
    for (const region of regions) {
        const ok = await checkRegion(region);
        if (ok) {
            console.log(`Found working region: ${region}`);
            break;
        }
    }
}

main().catch(console.error);
