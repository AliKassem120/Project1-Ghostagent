import { z } from 'zod';
import { tool } from 'ai';

const schema = z.object({
    date: z.string(),
    time: z.string(),
    service_name: z.string(),
}).passthrough();

const myTool = tool({
    description: 'test',
    parameters: schema,
    execute: async () => 'ok'
});

console.log(JSON.stringify(myTool.parameters, null, 2));
