const path = require('path');
const fs = require('fs');

// The dashboard server has no Playwright of its own — borrow it from whichever
// automation repo sits next to it. First one that resolves wins.
function loadChromium() {
    const roots = [
        path.resolve(__dirname, '../..'),   // Dashboard-demo/
        path.resolve(__dirname, '..'),      // Dashboard/
    ];
    const candidates = [];
    for (const root of roots) {
        let entries = [];
        try { entries = fs.readdirSync(root); } catch (e) { continue; }
        for (const entry of entries) {
            candidates.push(path.join(root, entry, 'node_modules', 'playwright'));
        }
        candidates.push(path.join(root, 'node_modules', 'playwright'));
    }
    candidates.push('playwright');

    for (const candidate of candidates) {
        try { return require(candidate).chromium; } catch (e) { /* try next */ }
    }
    throw new Error('Could not resolve Playwright. Install it in the dashboard or an automation repo.');
}

(async () => {
    const reportUrl = process.argv[2];
    const outputPath = process.argv[3];

    if (!reportUrl || !outputPath) {
        console.error('Usage: node print-pdf.js <url> <output-path>');
        process.exit(1);
    }

    let browser;
    try {
        const chromium = loadChromium();
        browser = await chromium.launch();
        const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

        console.log(`Navigating to ${reportUrl}...`);
        await page.goto(reportUrl, { waitUntil: 'networkidle' });

        // Expand failed tests so their errors land in the PDF rather than staying collapsed.
        try {
            const failedHeaders = await page.locator('.test-card.failed .card-header').all();
            for (const header of failedHeaders) {
                await header.click();
            }
            await page.waitForTimeout(1000);
        } catch (e) {
            console.log('Error expanding failed tests:', e.message);
        }

        // The Playwright report is a full-height SPA that scrolls internally; without this
        // the PDF captures only the first screen.
        try {
            await page.emulateMedia({ media: 'screen' });
            await page.addStyleTag({
                content: `html, body, #root, .htmlreport {
                    height: auto !important;
                    max-height: none !important;
                    overflow: visible !important;
                }`
            });
            await page.waitForTimeout(300);
        } catch (e) {
            console.log('Error relaxing report layout:', e.message);
        }

        console.log('Generating PDF...');
        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                bottom: '20px',
                left: '20px',
                right: '20px'
            }
        });

        await browser.close();
        console.log('PDF generated successfully.');
        process.exit(0);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        try { if (browser) await browser.close(); } catch (e) { }
        process.exit(1);
    }
})();
