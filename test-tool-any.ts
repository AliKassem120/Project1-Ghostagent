import { z } from 'zod';
import { tool } from 'ai';

const check_slot = {
    description: 'test',
    parameters: z.object({
        date: z.string().describe('YYYY-MM-DD'),
        time: z.string().describe('HH:mm 24h'),
        service_name: z.string().describe('Service name'),
    }),
    execute: async () => 'ok'
};

const wrappedTools = Object.fromEntries(
    Object.entries({ check_slot }).map(([name, def]) => [name, tool(def as any)])
);

console.log(JSON.stringify(wrappedTools.check_slot.parameters, null, 2));
