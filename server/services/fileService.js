const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function generatePdfReport(req, res, port) {
    const reportUrl = `http://localhost:${port}/report/index.html`;
    const outputPath = path.join(__dirname, `../../report-${Date.now()}.pdf`); // Save to server root temporarily? Or use temp dir.
    // Actually server.js logical root was server directory. fileService is in server/services.
    // So __dirname is server/services.
    // We want to run print-pdf.js which is in server/
    const scriptPath = path.resolve(__dirname, '../print-pdf.js');

    // Adjust output path to be in server root for easy cleanup logic
    const safeOutputPath = path.resolve(__dirname, `../report-${Date.now()}.pdf`);

    const child = spawn('node', [scriptPath, reportUrl, safeOutputPath], {
        cwd: path.resolve(__dirname, '..') // Run from server root
    });

    child.stdout.on('data', (data) => console.log(`PDF: ${data}`));
    child.stderr.on('data', (data) => console.error(`PDF Error: ${data}`));

    child.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).send('Failed to generate PDF');
        }
        const dateStr = new Date().toISOString().split('T')[0];
        res.download(safeOutputPath, `TestReport_${dateStr}.pdf`, (err) => {
            if (err) console.error(err);
            // Cleanup
            try { fs.unlinkSync(safeOutputPath); } catch (e) { }
        });
    });
}

function downloadFailedScreenshots(req, res, automationDir) {
    const testResultsDir = path.join(automationDir, 'test-results');
    const tempDir = path.join(__dirname, '../temp-screenshots-' + Date.now());
    const zipPath = tempDir + '.zip';

    if (!fs.existsSync(testResultsDir)) {
        return res.status(404).send('No test results found');
    }

    try {
        fs.mkdirSync(tempDir);

        const getFiles = (dir, files = []) => {
            const fileList = fs.readdirSync(dir);
            for (const file of fileList) {
                const name = `${dir}/${file}`;
                if (fs.statSync(name).isDirectory()) {
                    getFiles(name, files);
                } else {
                    if (name.endsWith('.png') && name.includes('failed')) {
                        files.push(name);
                    }
                }
            }
            return files;
        };

        const allScreenshots = getFiles(testResultsDir);

        if (allScreenshots.length === 0) {
            fs.rmdirSync(tempDir);
            return res.status(404).json({ error: 'No screenshots found' });
        }

        allScreenshots.forEach((file) => {
            const filename = path.basename(file);
            const parentDir = path.basename(path.dirname(file));
            const dest = path.join(tempDir, `${parentDir}-${filename}`);
            fs.copyFileSync(file, dest);
        });

        const psCommand = `Compress-Archive -Path "${tempDir}\\*" -DestinationPath "${zipPath}"`;
        const child = spawn('powershell.exe', ['-Command', psCommand]);

        child.on('close', (code) => {
            if (code !== 0) {
                try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) { }
                return res.status(500).send('Failed to zip screenshots');
            }

            const dateStr = new Date().toISOString().split('T')[0];
            res.download(zipPath, `FailedScreenshots_${dateStr}.zip`, (err) => {
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                    fs.unlinkSync(zipPath);
                } catch (e) { console.error("Cleanup error:", e); }
            });
        });

    } catch (err) {
        console.error("Screenshot error:", err);
        res.status(500).send(err.message);
    }
}

module.exports = {
    generatePdfReport,
    downloadFailedScreenshots
};
