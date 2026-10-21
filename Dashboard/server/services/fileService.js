const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PRINT_SCRIPT = path.resolve(__dirname, '../print-pdf.js');

// Renders a served HTML report to a PDF on disk. Used both by the "Save as PDF"
// button and by the batch runner, which archives one PDF per region.
function renderReportPdf(reportUrl, outputPath) {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        const child = spawn('node', [PRINT_SCRIPT, reportUrl, outputPath], {
            cwd: path.resolve(__dirname, '..')
        });

        let stderr = '';
        child.stdout.on('data', d => console.log(`PDF: ${d}`));
        child.stderr.on('data', d => { stderr += d; console.error(`PDF Error: ${d}`); });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputPath)) return resolve(outputPath);
            reject(new Error(stderr.trim() || `print-pdf exited with code ${code}`));
        });
    });
}

function reportUrlFor(projectId, port) {
    return `http://localhost:${port}/report/${projectId}/index.html`;
}

function generatePdfReport(req, res, port) {
    const projectId = req.query.project || 'synapse';
    const outputPath = path.resolve(__dirname, `../report-${Date.now()}.pdf`);

    renderReportPdf(reportUrlFor(projectId, port), outputPath)
        .then(() => {
            const dateStr = new Date().toISOString().split('T')[0];
            res.download(outputPath, `TestReport_${dateStr}.pdf`, (err) => {
                if (err) console.error(err);
                try { fs.unlinkSync(outputPath); } catch (e) { }
            });
        })
        .catch(err => {
            console.error('PDF generation failed:', err.message);
            if (!res.headersSent) res.status(500).send('Failed to generate PDF');
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
    renderReportPdf,
    reportUrlFor,
    generatePdfReport,
    downloadFailedScreenshots
};
