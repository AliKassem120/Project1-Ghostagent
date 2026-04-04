const { tool } = require('ai');
const { z } = require('zod');

const myTool = tool({
    description: "test",
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => {
        console.log("Internal Name:", name);
        return "success";
    }
});

console.log("Type of myTool.execute:", typeof myTool.execute);
console.log("Function signature:", myTool.execute.toString());

myTool.execute({ name: "World" }).then(res => {
    console.log("Result 1:", res);
}).catch(err => {
    console.log("Error 1:", err.message);
});

myTool.execute("World").then(res => {
    console.log("Result 2:", res);
}).catch(err => {
    console.log("Error 2:", err.message);
});
