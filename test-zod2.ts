import { z } from 'zod';

const schema = z.object({
    date: z.string().describe('YYYY-MM-DD'),
    time: z.string().describe('HH:mm 24h'),
    service_name: z.string().describe('Service name'),
    name: z.string().describe('Optional. Leave empty if unknown'),
    phone: z.string().describe('Optional. Leave empty if unknown'),
    address: z.string().describe('Optional. Leave empty if unknown'),
});

const result = schema.safeParse({ date: '2026-05-13', time: '12:00', service: 'Haircut' });
console.log(JSON.stringify(result, null, 2));
