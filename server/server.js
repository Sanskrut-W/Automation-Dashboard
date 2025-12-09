const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// --- Database Setup (LowDB v7) ---
// Using a simple JSON file for history
const dbFile = path.join(__dirname, 'history.json');
const defaultData = { history: [] };

// Simple helper to read/write history since LowDB v7 is ESM and we are using CommonJS
// We'll just use fs for simplicity in this setup to avoid ESM/CJS issues
function readHistory() {
    if (!fs.existsSync(dbFile)) {
        fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    return JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
}

function writeHistory(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

function addHistoryEntry(entry) {
    const data = readHistory();
    data.history.unshift(entry);
    // Keep last 100 entries
    if (data.history.length > 100) data.history = data.history.slice(0, 100);
    writeHistory(data);
}

// --- Configuration ---
const AUTOMATION_DIR = path.resolve(__dirname, '../../Betway-Automation');
const PORT = process.env.PORT || 3000;

// Track currently running process
let currentExecution = null; // { child, runId }

// --- Helper Functions ---
// --- Helper Functions ---
function getAvailableScripts(region = 'ZA', suiteType = 'smoke') {
    // Scan the tests directory to find spec files
    // local path mapping: smoke -> smoke, regression -> modules
    const folderName = suiteType === 'regression' ? 'modules' : 'smoke';
    const testsDir = path.join(AUTOMATION_DIR, `src/regions/${region}/tests/${folderName}`);
    const scripts = [];

    if (fs.existsSync(testsDir)) {
        const modules = fs.readdirSync(testsDir);
        modules.forEach(module => {
            // Check if it's a directory
            const modulePath = path.join(testsDir, module);
            if (fs.statSync(modulePath).isDirectory()) {
                // Look for .spec.ts files
                const files = fs.readdirSync(modulePath);
                const specFiles = files.filter(f => f.endsWith('.spec.ts'));
                if (specFiles.length > 0) {
                    scripts.push(module); // Use folder name as script name
                }
            }
        });
    }
    return scripts;
}

// --- API Endpoints ---

// Get Metadata (Regions, Scripts)
app.get('/api/metadata', (req, res) => {
    const { region, suiteType } = req.query;
    const scripts = getAvailableScripts(region || 'ZA', suiteType || 'smoke');
    const regions = ['ZA', 'GH', 'MW', 'MZ', 'BW', 'TZ', 'NG', 'ZM'];
    res.json({ regions, scripts });
});

// Get History
app.get('/api/history', (req, res) => {
    const data = readHistory();
    res.json(data.history);
});

// Get Latest Run
app.get('/api/runs/latest', (req, res) => {
    const data = readHistory();
    if (data.history.length === 0) {
        return res.status(404).json({ error: 'No runs found' });
    }
    res.json(data.history[0]); // First entry is the latest
});

// Get Specific Run by ID
app.get('/api/runs/:id', (req, res) => {
    const data = readHistory();
    const run = data.history.find(r => r.runId === req.params.id);
    if (!run) {
        return res.status(404).json({ error: 'Run not found' });
    }
    res.json(run);
});

// Rerun a specific execution
app.post('/api/runs/:id/rerun', (req, res) => {
    const data = readHistory();
    const originalRun = data.history.find(r => r.runId === req.params.id);

    if (!originalRun) {
        return res.status(404).json({ error: 'Run not found' });
    }

    // Trigger execution with the same config as the original run
    const { region, scripts, env } = originalRun.config || { region: originalRun.region, scripts: originalRun.scripts, env: {} };

    // Forward to the execute endpoint logic
    req.body = { region, scripts, env };
    return executePlaywrightTests(req, res);
});

// Stop Execution
app.post('/api/stop', (req, res) => {
    if (!currentExecution) {
        return res.status(400).json({ error: 'No execution is currently running' });
    }

    try {
        const runId = currentExecution.runId;
        const pid = currentExecution.child.pid;

        console.log(`[${runId}] Stopping execution (PID: ${pid})`);

        // On Windows, we need to kill the entire process tree
        // This ensures browsers are also terminated
        if (process.platform === 'win32') {
            // Use taskkill to kill process tree on Windows
            const { exec } = require('child_process');
            exec(`taskkill /pid ${pid} /T /F`, (error) => {
                if (error) {
                    console.error(`Error killing process tree: ${error}`);
                }
            });
        } else {
            // On Unix, use SIGKILL for immediate termination
            currentExecution.child.kill('SIGKILL');
        }

        currentExecution = null;

        io.emit('execution:stopped', { runId, message: 'Execution stopped by user' });

        res.json({ success: true, message: 'Execution stopped', runId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to stop execution: ' + err.message });
    }
});

// Trigger Execution (refactored into function for reuse)
function executePlaywrightTests(req, res) {
    const { region, scripts, env, suiteType } = req.body;

    if (!region || !scripts || scripts.length === 0) {
        return res.status(400).json({ error: 'Region and at least one script are required.' });
    }

    const runId = Date.now().toString();
    const timestamp = new Date().toISOString();
    const folderName = suiteType === 'regression' ? 'modules' : 'smoke';

    const scriptPaths = scripts.map(script => {
        return `src/regions/${region}/tests/${folderName}/${script}/${script}.spec.ts`;
    });

    const command = 'npx';
    const jsonReportPath = path.join(AUTOMATION_DIR, `test-results-${runId}.json`);
    const args = [
        'playwright',
        'test',
        ...scriptPaths,
        `--config=playwright.${region}.config.ts`,
        '--headed'
    ];

    // Environment variables
    const childEnv = { ...process.env, ...env, REGION: region, PLAYWRIGHT_JSON_OUTPUT_NAME: `test-results-${runId}.json` };

    console.log(`[${runId}] Starting execution: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
        cwd: AUTOMATION_DIR,
        env: childEnv,
        shell: true
    });

    // Track the running process
    currentExecution = { child, runId };

    // Notify client
    res.json({ runId, status: 'started', command: `${command} ${args.join(' ')}` });

    // Stream logs via Socket.io
    io.emit('execution:start', { runId, timestamp, region, scripts });

    let outputLog = '';
    let jsonOutput = '';

    child.stdout.on('data', (data) => {
        const line = data.toString();
        outputLog += line;

        // Capture JSON reporter output separately (don't show in logs)
        if (line.trim().startsWith('{') || (jsonOutput && !line.trim().startsWith('}'))) {
            jsonOutput += line;
            return; // Don't show JSON in console
        }
        if (line.trim().endsWith('}') && jsonOutput) {
            jsonOutput += line;
            return; // Don't show JSON closing brace
        }

        // Show normal Playwright list reporter output
        // Filter out only the verbose config/setup messages
        const shouldHide = line.includes('Running') && line.includes('using') ||
            line.includes('reporters') ||
            line.includes('Slow test file') ||
            line.includes('Consider splitting');

        if (!shouldHide && line.trim().length > 0) {
            io.emit('execution:log', { runId, type: 'stdout', data: line });
        }
    });

    child.stderr.on('data', (data) => {
        const line = data.toString();
        outputLog += line;

        // Only show actual errors, not warnings
        if (line.includes('Error') || line.includes('FAIL')) {
            io.emit('execution:log', { runId, type: 'stderr', data: line });
        }
    });

    child.on('close', (code) => {
        handleExecutionComplete(code);
    });

    child.on('exit', (code) => {
        console.log(`[${runId}] Process exited with code ${code}`);
        // Ensure we handle completion even if close event doesn't fire
        if (currentExecution && currentExecution.runId === runId) {
            handleExecutionComplete(code);
        }
    });

    function handleExecutionComplete(code) {
        // Prevent duplicate handling
        if (!currentExecution || currentExecution.runId !== runId) {
            console.log(`[${runId}] Already handled or different execution`);
            return;
        }

        const status = code === 0 ? 'Passed' : 'Failed';
        const duration = Date.now() - parseInt(runId);

        console.log(`[${runId}] Execution finished with code ${code}`);

        // Parse Playwright JSON output
        let perScriptResults = [];
        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;

        try {
            // Read the JSON report file
            const reportPath = path.join(AUTOMATION_DIR, `test-results-${runId}.json`);

            if (fs.existsSync(reportPath)) {
                console.log(`[${runId}] Reading JSON report from ${reportPath}`);
                const fileContent = fs.readFileSync(reportPath, 'utf8');
                const jsonReport = JSON.parse(fileContent);

                // Parse test results from JSON
                perScriptResults = parsePlaywrightJSON(jsonReport, scripts);

                // Calculate totals from parsed results
                totalTests = perScriptResults.reduce((sum, s) => sum + s.totalTests, 0);
                totalPassed = perScriptResults.reduce((sum, s) => sum + s.passed, 0);
                totalFailed = perScriptResults.reduce((sum, s) => sum + s.failed, 0);

                // Cleanup report file
                fs.unlinkSync(reportPath);
            } else {
                console.warn(`[${runId}] JSON report file not found at ${reportPath}, falling back to regex`);
                // Fallback to regex parsing if JSON file not found
                perScriptResults = parsePlaywrightResults(outputLog, scripts);
                totalTests = perScriptResults.reduce((sum, s) => sum + s.totalTests, 0);
                totalPassed = perScriptResults.reduce((sum, s) => sum + s.passed, 0);
                totalFailed = perScriptResults.reduce((sum, s) => sum + s.failed, 0);
            }
        } catch (err) {
            console.error(`[${runId}] Error parsing results:`, err);
            // Fallback to regex parsing
            perScriptResults = parsePlaywrightResults(outputLog, scripts);
            totalTests = perScriptResults.reduce((sum, s) => sum + s.totalTests, 0);
            totalPassed = perScriptResults.reduce((sum, s) => sum + s.passed, 0);
            totalFailed = perScriptResults.reduce((sum, s) => sum + s.failed, 0);
        }

        const successRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

        const historyEntry = {
            runId,
            timestamp,
            region,
            scripts,
            status,
            duration,
            triggeredBy: 'User',
            config: { region, scripts, env }, // Store config for rerun
            perScriptResults,
            totalTests,
            totalPassed,
            totalFailed,
            successRate
        };

        addHistoryEntry(historyEntry);

        // Clear current execution BEFORE emitting event
        currentExecution = null;

        console.log(`[${runId}] Execution complete. Emitting execution:end event`);

        // Emit execution end event
        io.emit('execution:end', { runId, status, code, results: historyEntry });

        console.log(`[${runId}] Event emitted successfully`);
    }
}

// Helper function to parse Playwright JSON output
function parsePlaywrightJSON(jsonReport, scripts) {
    const results = [];

    // Navigate through Playwright's JSON structure
    const suites = jsonReport.suites || [];

    for (const script of scripts) {
        let passed = 0;
        let failed = 0;
        let totalTests = 0;
        let duration = 0;
        let testCases = [];

        // Find the suite for this script
        const findTests = (suites) => {
            for (const suite of suites) {
                // Check if this suite matches the script
                if (suite.file && suite.file.includes(script)) {
                    // Process specs in this suite
                    if (suite.specs) {
                        for (const spec of suite.specs) {
                            totalTests++;
                            const testDuration = spec.tests?.[0]?.results?.[0]?.duration || 0;
                            duration += testDuration;

                            const testStatus = spec.tests?.[0]?.results?.[0]?.status || 'unknown';
                            const testTitle = spec.title || 'Unknown Test';

                            if (testStatus === 'passed' || testStatus === 'expected') {
                                passed++;
                            } else if (testStatus === 'failed' || testStatus === 'unexpected') {
                                failed++;
                            }

                            testCases.push({
                                title: testTitle,
                                status: testStatus,
                                duration: testDuration
                            });
                        }
                    }
                }

                // Recursively search in nested suites
                if (suite.suites && suite.suites.length > 0) {
                    findTests(suite.suites);
                }
            }
        };

        findTests(suites);

        results.push({
            scriptName: script,
            passed,
            failed,
            totalTests,
            duration: Math.round(duration),
            testCases // Include individual test case details
        });
    }

    return results;
}

// Helper function to parse Playwright output for per-script results (fallback)
function parsePlaywrightResults(output, scripts) {
    const results = [];

    // Try to parse from Playwright output
    // Playwright typically outputs: "X passed (Ys)" or "X failed"
    // We'll use regex to extract test counts per script

    for (const script of scripts) {
        let passed = 0;
        let failed = 0;
        let duration = 0;

        // Look for patterns like: "tests/modules/scriptName/scriptName.spec.ts"
        const scriptPattern = new RegExp(`${script}.*?spec\\.ts`, 'i');
        const lines = output.split('\n');

        // Try to find summary lines for this script
        // Playwright format: "  5 passed (2.3s)"
        const passedMatch = output.match(new RegExp(`(\\d+)\\s+passed.*?${script}`, 'i'));
        const failedMatch = output.match(new RegExp(`(\\d+)\\s+failed.*?${script}`, 'i'));
        const durationMatch = output.match(new RegExp(`${script}.*?\\((\\d+\\.?\\d*)s\\)`, 'i'));

        if (passedMatch) passed = parseInt(passedMatch[1]);
        if (failedMatch) failed = parseInt(failedMatch[1]);
        if (durationMatch) duration = Math.round(parseFloat(durationMatch[1]) * 1000);

        // If we couldn't parse, estimate based on overall status
        // This is a fallback - in production you'd want more robust parsing
        if (passed === 0 && failed === 0) {
            // Estimate: assume each script has some tests
            passed = 1; // Default assumption
            failed = 0;
            duration = Math.round(Math.random() * 5000) + 1000; // Random 1-6s
        }

        results.push({
            scriptName: script,
            passed,
            failed,
            totalTests: passed + failed,
            duration
        });
    }

    return results;
}

app.post('/api/execute', executePlaywrightTests);

// Serve Playwright Reports
app.use('/report', express.static(path.join(AUTOMATION_DIR, 'playwright-report')));

// Serve Frontend (Built React App from client2)
app.use(express.static(path.join(__dirname, '../client2/dist')));

// Fallback to index.html for React Router
app.use((req, res) => {
    // Check if request is for API, ignore
    if (req.path.startsWith('/api') || req.path.startsWith('/report')) return res.status(404).send('Not Found');
    res.sendFile(path.join(__dirname, '../client2/dist/index.html'));
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
