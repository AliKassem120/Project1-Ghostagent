import { z } from 'zod';
import { tool } from 'ai';

const mySchema = z.object({
    name: z.string().describe('Optional. Leave empty if unknown'),
    phone: z.string().describe('Optional. Leave empty if unknown'),
    address: z.string().describe('Optional. Leave empty if unknown'),
});

const myTool = tool({
    description: 'test',
    parameters: mySchema,
    execute: async () => 'ok'
});

console.log(JSON.stringify(mySchema, null, 2));

// Simulate what happens internally when parsing arguments
const result = mySchema.safeParse({ name: 'ali', phone: '123' });
console.log(result);
