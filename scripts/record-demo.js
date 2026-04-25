const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function record() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    
    // Create videos directory if it doesn't exist
    const videosDir = path.join(__dirname, '..', 'public', 'demo');
    if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
    }

    console.log('Creating context with recording enabled...');
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: {
            dir: videosDir,
            size: { width: 1920, height: 1080 }
        }
    });

    const page = await context.newPage();
    
    console.log('Navigating to http://localhost:3000/demo-recording...');
    await page.goto('http://localhost:3000/demo-recording', { waitUntil: 'networkidle' });

    console.log('Recording for 62 seconds...');
    await page.waitForTimeout(62000);

    console.log('Closing page...');
    const videoPath = await page.video().path();
    await page.close();
    await context.close();
    await browser.close();

    console.log(`Video saved to temporary path: ${videoPath}`);
    
    // Rename to ghostagent-demo.webm
    const finalPath = path.join(videosDir, 'ghostagent-demo.webm');
    if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
    }
    fs.renameSync(videoPath, finalPath);
    console.log(`Successfully moved to: ${finalPath}`);
}

record().catch(console.error);
