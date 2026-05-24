import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\ali\\.gemini\\antigravity\\brain';
const targetId = '1433718888490869';

async function main() {
    console.log(`Scanning transcript logs under ${brainDir} for ${targetId}...`);
    if (!fs.existsSync(brainDir)) {
        console.error('Brain directory does not exist');
        return;
    }

    const items = fs.readdirSync(brainDir);
    for (const item of items) {
        const itemPath = path.join(brainDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
            const logPath = path.join(itemPath, '.system_generated', 'logs', 'transcript.jsonl');
            if (fs.existsSync(logPath)) {
                const content = fs.readFileSync(logPath, 'utf8');
                if (content.includes(targetId)) {
                    console.log(`\nMatch found in conversation: ${item}`);
                    // Find lines containing the targetId
                    const lines = content.split('\n');
                    lines.forEach((line, idx) => {
                        if (line.includes(targetId)) {
                            try {
                                const parsed = JSON.parse(line);
                                console.log(`  Line ${idx + 1}: [Type: ${parsed.type || parsed.source}] ${parsed.content ? parsed.content.substring(0, 150) : '(no content)'}`);
                            } catch {
                                console.log(`  Line ${idx + 1}: ${line.substring(0, 150)}`);
                            }
                        }
                    });
                }
            }
        }
    }
}

main().catch(console.error);
