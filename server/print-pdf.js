const { chromium } = require('../../Betway-Automation/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    const reportUrl = process.argv[2];
    const outputPath = process.argv[3];

    if (!reportUrl || !outputPath) {
        console.error('Usage: node print-pdf.js <url> <output-path>');
        process.exit(1);
    }

    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();

        console.log(`Navigating to ${reportUrl}...`);
        await page.goto(reportUrl, { waitUntil: 'networkidle' });

        // Expand failed tests if any (try to click locators that usually expand details)
        // Playwright HTML report usually puts failed items in a list. We want to ensure details are visible.
        // The standard report has 'expanded' classes or similar. 
        // We'll try to click everything that looks like a failed test header to expand it.
        // This is a best-effort approach for standard Playwright reports.
        try {
            // Select all failed test headers or similar expanders
            // In standard report: .test-card.failed .card-header
            const failedHeaders = await page.locator('.test-card.failed .card-header').all();
            for (const header of failedHeaders) {
                await header.click();
            }
            // Give a moment for animations
            await page.waitForTimeout(1000);
        } catch (e) {
            console.log('Error expanding failed tests:', e.message);
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
        process.exit(1);
    }
})();
