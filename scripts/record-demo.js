const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function record() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    
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
    
    console.log('Navigating to http://localhost:3000/demo-recording?recording=1...');
    // We don't wait for networkidle because we want to start recording immediately
    await page.goto('http://localhost:3000/demo-recording?recording=1');

    console.log('Waiting for [data-demo-ready="true"] marker...');
    await page.waitForSelector('[data-demo-ready="true"]');

    console.log('Marker found! Recording for exactly 52 seconds...');
    
    // Wait 2.5 seconds, then take a screenshot for the poster
    await page.waitForTimeout(2500);
    const posterPath = path.join(videosDir, 'ghostagent-demo-poster.png');
    await page.screenshot({ path: posterPath });
    console.log(`Poster image saved to: ${posterPath}`);

    // Wait the remaining 49.5 seconds
    await page.waitForTimeout(49500);

    console.log('Closing page...');
    const videoPath = await page.video().path();
    await page.close();
    await context.close();
    await browser.close();

    console.log(`Video saved to temporary path: ${videoPath}`);
    
    const finalPath = path.join(videosDir, 'ghostagent-demo.webm');
    if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
    }
    fs.renameSync(videoPath, finalPath);
    console.log(`Successfully moved to: ${finalPath}`);
}

record().catch(console.error);
