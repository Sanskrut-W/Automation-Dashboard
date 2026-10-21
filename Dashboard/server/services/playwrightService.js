const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { addHistoryEntry } = require('../config/db');
const { parsePlaywrightJSON, parsePlaywrightResults } = require('./parserService');
const { renderReportPdf, reportUrlFor } = require('./fileService');
const {
    createBatchFolder,
    batchPdfPath,
    writeBatchSummary,
    removeIfNoPdfs,
} = require('./reportArchiveService');

// A batch is one press of "Run Tests". It holds a queue of regions that are executed
// strictly one after another — a headed Playwright run can only own the screen once.
let currentBatch = null;

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

// hiddenScripts can be an array (hidden in every region) or an object:
// { ALL: [...], ZA: [...], BW: [...] } — ALL applies everywhere, region keys only there.
function isHidden(project, script, region) {
    const cfg = project.hiddenScripts;
    if (!cfg) return false;
    const list = Array.isArray(cfg)
        ? cfg
        : [...(cfg.ALL || []), ...((region && cfg[region]) || [])];
    return list.some(h => h.toLowerCase() === script.toLowerCase());
}

function getAvailableScripts(project, region, suiteType) {
    if (project.type === 'flat') {
        const testsDir = path.join(project.dir, 'tests');
        if (!fs.existsSync(testsDir)) return [];
        return fs.readdirSync(testsDir)
            .filter(f => f.endsWith('.spec.ts'))
            .map(f => f.replace('.spec.ts', ''))
            .filter(s => !isHidden(project, s, region));
    }

    // Regional (Betway / JPC): try preferred folder, then all others, then root
    const preferred = suiteType === 'regression' ? 'modules' : 'smoke';
    const testsBase = path.join(project.dir, `src/regions/${region}/tests`);

    // Try preferred first, then rotate through alternatives
    const searchOrder = [preferred, ...SUITE_FOLDER_ORDER.filter(f => f !== preferred), ''];
    for (const folder of searchOrder) {
        const dir = folder ? path.join(testsBase, folder) : testsBase;
        const scripts = findScriptsInDir(dir).filter(s => !isHidden(project, s, region));
        if (scripts.length > 0) return scripts;
    }
    return [];
}

// Union of the scripts available across several regions — what the picker should offer
// when more than one region is selected.
function getAvailableScriptsForRegions(project, regions, suiteType) {
    if (project.type === 'flat' || !regions || regions.length === 0) {
        return getAvailableScripts(project, regions && regions[0], suiteType);
    }
    const seen = [];
    regions.forEach(region => {
        getAvailableScripts(project, region, suiteType).forEach(script => {
            if (!seen.includes(script)) seen.push(script);
        });
    });
    return seen;
}

// ---------- Path Builder ----------

// Regions don't all carry the same modules (MW/MZ/TZ/ZM have no gamingLobby, BW has no
// betslip, ...). When a batch spans regions we resolve per region and drop what isn't
// there — otherwise Playwright aborts the whole region over one missing spec file.
function resolveScriptsForRegion(project, scripts, region, suiteType) {
    const found = [], missing = [], paths = [];

    if (project.type === 'flat') {
        scripts.forEach(s => {
            const rel = `tests/${s}.spec.ts`;
            if (fs.existsSync(path.join(project.dir, rel))) { found.push(s); paths.push(rel); }
            else missing.push(s);
        });
        return { found, missing, paths };
    }

    const preferred = suiteType === 'regression' ? 'modules' : 'smoke';
    const searchOrder = [preferred, ...SUITE_FOLDER_ORDER.filter(f => f !== preferred), ''];

    scripts.forEach(script => {
        let match = null;
        for (const folder of searchOrder) {
            const rel = folder
                ? `src/regions/${region}/tests/${folder}/${script}/${script}.spec.ts`
                : `src/regions/${region}/tests/${script}/${script}.spec.ts`;
            if (fs.existsSync(path.join(project.dir, rel))) { match = rel; break; }
        }
        if (match) { found.push(script); paths.push(match); }
        else missing.push(script);
    });

    return { found, missing, paths };
}

function buildScriptPaths(project, scripts, region, suiteType) {
    return resolveScriptsForRegion(project, scripts, region, suiteType).paths;
}

// ---------- Single region run ----------

// Resolves once the run has finished and its history entry has been written.
// Never rejects — one bad region must not sink the rest of the queue.
function runRegion({ project, region, scripts, suiteType, environment, env, io, batchId }) {
    return new Promise((resolve) => {
        const runId = Date.now().toString();
        const timestamp = new Date().toISOString();
        const automationDir = project.dir;
        const label = region || project.id;

        const { found, missing, paths } = resolveScriptsForRegion(project, scripts, region, suiteType);

        if (paths.length === 0) {
            console.warn(`[${batchId}] ${label}: none of the selected scripts exist — skipping`);
            io.emit('execution:log', {
                runId, type: 'info',
                data: `[${label}] Skipped — none of the selected scripts exist here.\n`
            });
            return resolve({ region, runId, status: 'Skipped', skipped: true, missing, scripts: [] });
        }

        if (missing.length > 0) {
            io.emit('execution:log', {
                runId, type: 'info',
                data: `[${label}] Not available here, skipping: ${missing.join(', ')}\n`
            });
        }

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
        const args = ['playwright', 'test', ...paths, `--config=${configFile}`, '--headed'];

        console.log(`[${runId}] Starting: ${command} ${args.join(' ')}`);
        console.log(`[${runId}] Project: ${project.id} | Region: ${label} | CWD: ${automationDir}`);

        const child = spawn(command, args, { cwd: automationDir, env: childEnv, shell: true });
        if (currentBatch) {
            currentBatch.child = child;
            currentBatch.runId = runId;
        }

        io.emit('execution:start', { runId, batchId, timestamp, region, scripts: found, project: project.id });

        let outputLog = '';
        let settled = false;

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

        child.on('error', (err) => {
            console.error(`[${runId}] Spawn error:`, err.message);
            handleComplete(1);
        });
        child.on('close', (code) => handleComplete(code));
        child.on('exit', (code) => handleComplete(code));

        function handleComplete(code) {
            if (settled) return;
            settled = true;

            // Give Playwright's reporters a moment to flush JSON / HTML to disk.
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
                            perScriptResults = parsePlaywrightJSON(jsonReport, found);
                        } else {
                            console.warn(`[${runId}] JSON report not found, falling back to stdout parse`);
                            perScriptResults = parsePlaywrightResults(outputLog, found);
                        }
                    } catch (e) {
                        console.error(`[${runId}] Error parsing results:`, e.message);
                        perScriptResults = parsePlaywrightResults(outputLog, found);
                    }
                } else {
                    perScriptResults = parsePlaywrightResults(outputLog, found);
                }

                const totalTests = perScriptResults.reduce((s, r) => s + r.totalTests, 0);
                const totalPassed = perScriptResults.reduce((s, r) => s + r.passed, 0);
                const totalFailed = perScriptResults.reduce((s, r) => s + r.failed, 0);
                const successRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

                const historyEntry = {
                    runId,
                    batchId,
                    timestamp,
                    project: project.id,
                    region: region || null,
                    environment: project.type === 'flat' ? (environment || project.defaultEnv) : null,
                    scripts: found,
                    skippedScripts: missing,
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

                console.log(`[${runId}] Execution complete — ${status}`);
                io.emit('execution:end', { runId, batchId, status, code, results: historyEntry });

                // Generate Allure report for regional projects. Fire and forget — each region
                // writes to its own results dir, so these never collide with the next run.
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
                        reportGen.on('error', () => { });
                    }
                }

                resolve({
                    region,
                    runId,
                    status,
                    skipped: false,
                    missing,
                    scripts: found,
                    duration,
                    totalTests,
                    totalPassed,
                    totalFailed,
                    successRate,
                });
            }, 2000);
        }
    });
}

// ---------- Batch execution ----------

function executeTests(req, res, io, project) {
    const { region, regions, scripts, env, suiteType, environment } = req.body;

    if (!scripts || scripts.length === 0) {
        return res.status(400).json({ error: 'At least one script is required.' });
    }

    // `regions` (array) is the current contract; `region` (string) is still accepted so
    // the rerun endpoint and any older caller keep working.
    let queue;
    if (project.type === 'regional') {
        queue = Array.isArray(regions) && regions.length
            ? [...new Set(regions.filter(Boolean))]
            : (region ? [region] : []);
        if (queue.length === 0) {
            return res.status(400).json({ error: 'At least one region is required for this project.' });
        }
    } else {
        queue = [null];
    }

    if (currentBatch) {
        return res.status(409).json({ error: 'Another execution is already running.' });
    }

    const batchId = Date.now().toString();
    const startedAt = new Date().toISOString();
    const batch = createBatchFolder({
        projectId: project.id,
        regions: queue,
        suiteType,
        environment,
    });

    currentBatch = { batchId, stopped: false, child: null, runId: null };

    // Written up front so an in-progress folder is already identifiable, then
    // overwritten with the results once the queue drains.
    const summaryBase = {
        batchId,
        project: project.id,
        projectName: project.name,
        suiteType: suiteType || null,
        environment: environment || null,
        regions: queue,
        scripts,
        startedAt,
    };
    writeBatchSummary(batch.dirPath, { ...summaryBase, finishedAt: null, stopped: false, results: [] });

    res.json({
        batchId,
        status: 'started',
        regions: queue,
        reportFolder: batch.dirName,
    });

    io.emit('batch:start', {
        batchId,
        project: project.id,
        regions: queue,
        total: queue.length,
        suiteType: suiteType || null,
        reportFolder: batch.dirName,
        startedAt,
    });

    runQueue();

    async function runQueue() {
        const port = process.env.PORT || 3000;
        const results = [];

        for (let i = 0; i < queue.length; i++) {
            if (!currentBatch || currentBatch.stopped) break;

            const target = queue[i];
            const label = target || project.id;

            io.emit('batch:progress', {
                batchId, region: target, index: i, total: queue.length, phase: 'running'
            });
            io.emit('execution:log', {
                runId: batchId, type: 'info',
                data: `\n=== [${i + 1}/${queue.length}] ${label} — starting ===\n`
            });

            const result = await runRegion({
                project, region: target, scripts, suiteType, environment, env, io, batchId
            });

            if (!currentBatch || currentBatch.stopped) {
                results.push({ ...result, status: 'Stopped' });
                break;
            }

            // Every region overwrites the shared playwright-report folder, so the PDF has
            // to be taken now — before the next region starts and clobbers it.
            if (!result.skipped) {
                io.emit('batch:progress', {
                    batchId, region: target, index: i, total: queue.length, phase: 'report'
                });
                try {
                    const outputPath = batchPdfPath(batch.dirPath, target, project.id);
                    await renderReportPdf(reportUrlFor(project.id, port), outputPath);
                    result.pdf = path.basename(outputPath);
                    io.emit('execution:log', {
                        runId: batchId, type: 'info',
                        data: `[${label}] Report saved -> reports/${batch.dirName}/${result.pdf}\n`
                    });
                } catch (e) {
                    console.error(`[${batchId}] PDF failed for ${label}:`, e.message);
                    result.pdfError = e.message;
                    io.emit('execution:log', {
                        runId: batchId, type: 'stderr',
                        data: `[${label}] Could not save PDF report: ${e.message}\n`
                    });
                }
            }

            results.push(result);
            io.emit('batch:progress', {
                batchId, region: target, index: i, total: queue.length,
                phase: 'done', status: result.status, pdf: result.pdf || null
            });
        }

        const stopped = !currentBatch || currentBatch.stopped;

        writeBatchSummary(batch.dirPath, {
            ...summaryBase,
            finishedAt: new Date().toISOString(),
            stopped,
            results,
        });

        const discarded = removeIfNoPdfs(batch.dirPath);

        currentBatch = null;

        io.emit('batch:end', {
            batchId,
            stopped,
            reportFolder: discarded ? null : batch.dirName,
            results,
        });
        io.emit('execution:log', {
            runId: batchId, type: 'info',
            data: discarded
                ? `\n=== Batch ${stopped ? 'stopped' : 'complete'} — no reports produced ===\n`
                : `\n=== Batch ${stopped ? 'stopped' : 'complete'} — reports in reports/${batch.dirName} ===\n`
        });
    }
}

// ---------- Stop ----------

function stopExecution(req, res, io) {
    if (!currentBatch) {
        return res.status(400).json({ error: 'No execution is currently running' });
    }

    try {
        const { batchId, runId, child } = currentBatch;
        // Flag first — the queue checks it before moving on to the next region.
        currentBatch.stopped = true;
        console.log(`[${batchId}] Stopping batch (current run ${runId}, PID: ${child && child.pid})`);

        if (child && child.pid) {
            if (process.platform === 'win32') {
                const { exec } = require('child_process');
                exec(`taskkill /pid ${child.pid} /T /F`, (err) => {
                    if (err) console.error('Error killing process tree:', err);
                });
            } else {
                child.kill('SIGKILL');
            }
        }

        io.emit('execution:stopped', { runId, batchId, message: 'Execution stopped by user' });
        res.json({ success: true, message: 'Execution stopped', runId, batchId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to stop execution: ' + err.message });
    }
}

module.exports = {
    getAvailableScripts,
    getAvailableScriptsForRegions,
    buildScriptPaths,
    executeTests,
    stopExecution,
};
