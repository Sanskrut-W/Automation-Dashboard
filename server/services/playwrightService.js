const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { addHistoryEntry } = require('../config/db');
const { parsePlaywrightJSON, parsePlaywrightResults } = require('./parserService');

let currentExecution = null;

// ---------- Script Discovery ----------

const SUITE_FOLDER_ORDER = ['smoke', 'modules', 'regression'];

function findScriptsInDir(dir) {
    if (!fs.existsSync(dir)) return [];
    const scripts = [];
    try {
        fs.readdirSync(dir).forEach(item => {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                const files = fs.readdirSync(itemPath);
                if (files.some(f => f.endsWith('.spec.ts'))) {
                    scripts.push(item);
                }
            }
        });
    } catch (e) {
        console.error('Error reading scripts:', e.message);
    }
    return scripts;
}

function getAvailableScripts(project, region, suiteType) {
    if (project.type === 'flat') {
        const testsDir = path.join(project.dir, 'tests');
        if (!fs.existsSync(testsDir)) return [];
        return fs.readdirSync(testsDir)
            .filter(f => f.endsWith('.spec.ts'))
            .map(f => f.replace('.spec.ts', ''));
    }

    // Regional (Betway / JPC): try preferred folder, then all others, then root
    const preferred = suiteType === 'regression' ? 'modules' : 'smoke';
    const testsBase = path.join(project.dir, `src/regions/${region}/tests`);

    // Try preferred first, then rotate through alternatives
    const searchOrder = [preferred, ...SUITE_FOLDER_ORDER.filter(f => f !== preferred), ''];
    for (const folder of searchOrder) {
        const dir = folder ? path.join(testsBase, folder) : testsBase;
        const scripts = findScriptsInDir(dir);
        if (scripts.length > 0) return scripts;
    }
    return [];
}

// ---------- Path Builder ----------

function buildScriptPaths(project, scripts, region, suiteType) {
    if (project.type === 'flat') {
        return scripts.map(s => `tests/${s}.spec.ts`);
    }

    const preferred = suiteType === 'regression' ? 'modules' : 'smoke';
    const searchOrder = [preferred, ...SUITE_FOLDER_ORDER.filter(f => f !== preferred), ''];

    return scripts.map(script => {
        for (const folder of searchOrder) {
            const rel = folder
                ? `src/regions/${region}/tests/${folder}/${script}/${script}.spec.ts`
                : `src/regions/${region}/tests/${script}/${script}.spec.ts`;
            if (fs.existsSync(path.join(project.dir, rel))) return rel;
        }
        // Best guess fallback
        return `src/regions/${region}/tests/${preferred}/${script}/${script}.spec.ts`;
    });
}

// ---------- Execution ----------

function executeTests(req, res, io, project) {
    const { region, scripts, env, suiteType, environment } = req.body;

    if (!scripts || scripts.length === 0) {
        return res.status(400).json({ error: 'At least one script is required.' });
    }
    if (project.type === 'regional' && !region) {
        return res.status(400).json({ error: 'Region is required for this project.' });
    }

    if (currentExecution) {
        return res.status(409).json({ error: 'Another execution is already running.' });
    }

    const runId = Date.now().toString();
    const timestamp = new Date().toISOString();
    const automationDir = project.dir;

    const scriptPaths = buildScriptPaths(project, scripts, region, suiteType);

    let configFile, childEnv;

    if (project.type === 'flat') {
        const envName = environment || project.defaultEnv || 'dev';
        configFile = 'playwright.config.ts';
        childEnv = { ...process.env, ...(env || {}), ENV: envName };
    } else {
        configFile = `playwright.${region}.config.ts`;
        childEnv = {
            ...process.env,
            ...(env || {}),
            REGION: region,
            PLAYWRIGHT_JSON_OUTPUT_NAME: `test-results-${runId}.json`
        };
        // Clean allure-results before run
        const allureResultsDir = path.join(automationDir, `src/regions/${region}/reports/allure-results`);
        if (fs.existsSync(allureResultsDir)) {
            try { fs.rmSync(allureResultsDir, { recursive: true, force: true }); } catch (e) { }
        }
    }

    const command = 'npx';
    const args = ['playwright', 'test', ...scriptPaths, `--config=${configFile}`, '--headed'];

    console.log(`[${runId}] Starting: ${command} ${args.join(' ')}`);
    console.log(`[${runId}] Project: ${project.id} | CWD: ${automationDir}`);

    const child = spawn(command, args, { cwd: automationDir, env: childEnv, shell: true });
    currentExecution = { child, runId };

    res.json({ runId, status: 'started', command: `${command} ${args.join(' ')}` });
    io.emit('execution:start', { runId, timestamp, region, scripts, project: project.id });

    let outputLog = '';

    child.stdout.on('data', (data) => {
        const line = data.toString();
        outputLog += line;

        const shouldHide = (line.includes('Running') && line.includes('using')) ||
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
        if (line.includes('Error') || line.includes('FAIL')) {
            io.emit('execution:log', { runId, type: 'stderr', data: line });
        }
    });

    child.on('close', (code) => handleComplete(code));
    child.on('exit', (code) => {
        if (currentExecution && currentExecution.runId === runId) {
            handleComplete(code);
        }
    });

    function handleComplete(code) {
        if (!currentExecution || currentExecution.runId !== runId) return;

        setTimeout(() => {
            const status = code === 0 ? 'Passed' : 'Failed';
            const duration = Date.now() - parseInt(runId);

            let perScriptResults = [];

            if (project.type === 'regional') {
                const reportPath = path.join(
                    automationDir,
                    `src/regions/${region}/reports/test-results-${runId}.json`
                );
                try {
                    if (fs.existsSync(reportPath)) {
                        const jsonReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                        perScriptResults = parsePlaywrightJSON(jsonReport, scripts);
                    } else {
                        console.warn(`[${runId}] JSON report not found, falling back to stdout parse`);
                        perScriptResults = parsePlaywrightResults(outputLog, scripts);
                    }
                } catch (e) {
                    console.error(`[${runId}] Error parsing results:`, e.message);
                    perScriptResults = parsePlaywrightResults(outputLog, scripts);
                }
            } else {
                perScriptResults = parsePlaywrightResults(outputLog, scripts);
            }

            const totalTests = perScriptResults.reduce((s, r) => s + r.totalTests, 0);
            const totalPassed = perScriptResults.reduce((s, r) => s + r.passed, 0);
            const totalFailed = perScriptResults.reduce((s, r) => s + r.failed, 0);
            const successRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

            const historyEntry = {
                runId,
                timestamp,
                project: project.id,
                region: region || null,
                environment: project.type === 'flat' ? (environment || project.defaultEnv) : null,
                scripts,
                suiteType: suiteType || null,
                status,
                duration,
                triggeredBy: 'User',
                perScriptResults,
                totalTests,
                totalPassed,
                totalFailed,
                successRate
            };

            addHistoryEntry(historyEntry);
            currentExecution = null;

            console.log(`[${runId}] Execution complete — ${status}`);
            io.emit('execution:end', { runId, status, code, results: historyEntry });

            // Generate Allure report for regional projects
            if (project.type === 'regional') {
                const allureResultsDir = path.join(
                    automationDir,
                    `src/regions/${region}/reports/allure-results`
                );
                if (fs.existsSync(allureResultsDir)) {
                    const allureCmd = `npx allure generate src/regions/${region}/reports/allure-results --clean -o src/regions/${region}/reports/allure-reports/${runId}`;
                    const reportGen = spawn(allureCmd, [], { cwd: automationDir, shell: true });
                    reportGen.on('close', (genCode) => {
                        if (genCode === 0) console.log(`[${runId}] Allure report generated`);
                    });
                }
            }
        }, 2000);
    }
}

// ---------- Stop ----------

function stopExecution(req, res, io) {
    if (!currentExecution) {
        return res.status(400).json({ error: 'No execution is currently running' });
    }

    try {
        const { runId, child } = currentExecution;
        console.log(`[${runId}] Stopping execution (PID: ${child.pid})`);

        if (process.platform === 'win32') {
            const { exec } = require('child_process');
            exec(`taskkill /pid ${child.pid} /T /F`, (err) => {
                if (err) console.error('Error killing process tree:', err);
            });
        } else {
            child.kill('SIGKILL');
        }

        currentExecution = null;
        io.emit('execution:stopped', { runId, message: 'Execution stopped by user' });
        res.json({ success: true, message: 'Execution stopped', runId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to stop execution: ' + err.message });
    }
}

module.exports = { getAvailableScripts, executeTests, stopExecution };
