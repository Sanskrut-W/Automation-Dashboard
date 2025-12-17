const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { addHistoryEntry } = require('../config/db');
const { parsePlaywrightJSON, parsePlaywrightResults } = require('./parserService');

let currentExecution = null; // { child, runId }

function getAvailableScripts(automationDir, region = 'ZA', suiteType = 'smoke') {
    // Scan the tests directory to find spec files
    // local path mapping: smoke -> smoke, regression -> modules
    const folderName = suiteType === 'regression' ? 'modules' : 'smoke';
    const testsDir = path.join(automationDir, `src/regions/${region}/tests/${folderName}`);
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

function executeTests(req, res, io, automationDir) {
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
    const jsonReportPath = path.join(automationDir, `test-results-${runId}.json`);
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
        cwd: automationDir,
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
            return;
        }

        // Wait a moment for file system to settle (Windows fix)
        setTimeout(() => {
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
                const reportPath = path.join(automationDir, `test-results-${runId}.json`);

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

                    // Cleanup report file ? No, keeping it for now as per previous debug session
                    // try { fs.unlinkSync(reportPath); } catch (e) { console.error("Error deleting report:", e); }
                    console.log(`[DEBUG] Preserving JSON report for inspection: ${reportPath}`);
                } else {
                    console.warn(`[${runId}] JSON report file not found at ${reportPath}, falling back to regex`);
                    perScriptResults = parsePlaywrightResults(outputLog, scripts);
                    totalTests = perScriptResults.reduce((sum, s) => sum + s.totalTests, 0);
                    totalPassed = perScriptResults.reduce((sum, s) => sum + s.passed, 0);
                    totalFailed = perScriptResults.reduce((sum, s) => sum + s.failed, 0);
                }
            } catch (err) {
                console.error(`[${runId}] Error parsing results:`, err);
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
                config: { region, scripts, env },
                perScriptResults,
                totalTests,
                totalPassed,
                totalFailed,
                successRate
            };

            addHistoryEntry(historyEntry);

            // Clear current execution BEFORE emitting event
            currentExecution = null;

            console.log(`[${runId}] Execution complete.`);

            // Emit execution end event
            io.emit('execution:end', { runId, status, code, results: historyEntry });

        }, 2000); // 2 second delay
    }
}

function stopExecution(req, res, io) {
    if (!currentExecution) {
        return res.status(400).json({ error: 'No execution is currently running' });
    }

    try {
        const runId = currentExecution.runId;
        const pid = currentExecution.child.pid;

        console.log(`[${runId}] Stopping execution (PID: ${pid})`);

        if (process.platform === 'win32') {
            const { exec } = require('child_process');
            exec(`taskkill /pid ${pid} /T /F`, (error) => {
                if (error) console.error(`Error killing process tree: ${error}`);
            });
        } else {
            currentExecution.child.kill('SIGKILL');
        }

        currentExecution = null;
        io.emit('execution:stopped', { runId, message: 'Execution stopped by user' });
        res.json({ success: true, message: 'Execution stopped', runId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to stop execution: ' + err.message });
    }
}

module.exports = {
    getAvailableScripts,
    executeTests,
    stopExecution
};
