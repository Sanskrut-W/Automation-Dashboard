const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { addHistoryEntry } = require('../config/db');
const { parsePlaywrightJSON } = require('./parserService');
const { getConfig, getAutomationDir } = require('./configService');

let currentExecution = null;

// Helper: Replace placeholders like {region} with values from inputs
// Helper: Replace placeholders like {region} with values from inputs
function resolveTemplate(template, inputs) {
    let result = template;
    for (const [key, value] of Object.entries(inputs)) {
        if (value !== undefined && value !== null) {
            result = result.replace(new RegExp(`{${key}}`, 'g'), value);
        }
    }
    return result;
}

function getAvailableScripts(inputs) {
    const config = getConfig();
    const automationDir = getAutomationDir();
    const discovery = config.discovery;

    // Apply Mappings first (Value Transformation)
    const variables = { ...inputs };
    if (discovery.pathMappings) {
        for (const [key, mapping] of Object.entries(discovery.pathMappings)) {
            if (inputs[key] && mapping[inputs[key]]) {
                variables[key] = mapping[inputs[key]];
            }
        }
    }

    let resolvedPath = resolveTemplate(discovery.lookupPath, variables);
    const fullPath = path.join(automationDir, resolvedPath);
    const scripts = [];

    if (fs.existsSync(fullPath)) {
        if (discovery.grouping === 'directory') {
            try {
                const items = fs.readdirSync(fullPath);
                items.forEach(item => {
                    const itemPath = path.join(fullPath, item);
                    if (fs.statSync(itemPath).isDirectory()) {
                        scripts.push(item);
                    }
                });
            } catch (e) {
                console.error(`Failed to read scripts from ${fullPath}`, e);
            }
        } else if (discovery.grouping === 'file') {
            const pattern = discovery.filePattern || '.spec.ts';
            try {
                const items = fs.readdirSync(fullPath);
                items.forEach(item => {
                    if (item.endsWith(pattern)) {
                        scripts.push(item.slice(0, -pattern.length));
                    }
                });
            } catch (e) {
                console.error(`Failed to read scripts from ${fullPath}`, e);
            }
        }
    } else {
        console.warn(`Script directory not found: ${fullPath}`);
    }

    return scripts;
}


function executeTests(req, res, io) {
    const config = getConfig();
    const automationDir = getAutomationDir();
    const execution = config.execution;
    const inputs = req.body;
    const selectedScripts = inputs.scripts || [];

    if (selectedScripts.length === 0) {
        return res.status(400).json({ error: 'No scripts selected' });
    }

    const runId = Date.now().toString();
    const timestamp = new Date().toISOString();

    // 1. Resolve Variables (Transform inputs based on mappings)
    const variables = { ...inputs, runId };
    if (config.discovery.pathMappings) {
        for (const [key, mapping] of Object.entries(config.discovery.pathMappings)) {
            if (inputs[key] && mapping[inputs[key]]) {
                variables[key] = mapping[inputs[key]];
            }
        }
    }

    // 2. Build Script Paths
    const scriptPathPattern = config.execution.scriptPathPattern || "src/regions/{region}/tests/{suiteType}/{script}/{script}.spec.ts";
    const realScriptPaths = selectedScripts.map(script => {
        const scriptVars = { ...variables, script };
        return resolveTemplate(scriptPathPattern, scriptVars);
    });
    variables.scriptPaths = realScriptPaths.join(' ');

    // 3. Build Command
    // Ensure Windows compatibility for 'npx'
    let commandCmd = execution.command;
    if (process.platform === 'win32' && commandCmd.startsWith('npx')) {
        commandCmd = commandCmd.replace(/^npx/, 'npx.cmd');
    }

    const parts = commandCmd.split(' ');
    const executable = parts[0];
    const initialArgs = parts.slice(1);

    // Resolve Args
    const finalArgs = execution.args.map(arg => resolveTemplate(arg, variables));
    const allArgs = [...initialArgs, ...finalArgs];

    // 4. Prepare Env
    // Force color off: the dashboard log panel renders raw text with no ANSI stripping,
    // so a colored reporter would leak escape codes into the UI instead of just being cosmetic.
    const childEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };
    if (execution.env) {
        for (const [key, value] of Object.entries(execution.env)) {
            childEnv[key] = resolveTemplate(value, variables);
        }
    }

    // 5. Pre-Run Cleanup
    if (config.reporting.artifacts && config.reporting.artifacts.allure) {
        const allureCfg = config.reporting.artifacts.allure;
        if (allureCfg.enabled && allureCfg.cleanBeforeRun) {
            const rawDir = path.join(automationDir, resolveTemplate(allureCfg.rawDir, variables));
            try {
                if (fs.existsSync(rawDir)) {
                    fs.rmSync(rawDir, { recursive: true, force: true });
                }
            } catch (e) { console.error('Cleanup failed', e); }
        }
    }

    console.log(`[${runId}] Executing in ${automationDir}: ${executable} ${allArgs.join(' ')}`);

    const child = spawn(executable, allArgs, {
        cwd: automationDir,
        env: childEnv,
        shell: true
    });

    currentExecution = { child, runId, startTime: Date.now() };

    res.json({ runId, status: 'started' });
    io.emit('execution:start', { runId, timestamp, ...inputs });

    child.stdout.on('data', data => io.emit('execution:log', { runId, type: 'stdout', data: data.toString() }));
    child.stderr.on('data', data => io.emit('execution:log', { runId, type: 'stderr', data: data.toString() }));

    child.on('error', (err) => {
        console.error(`[${runId}] Spawn error:`, err);
        io.emit('execution:stopped', { runId, message: `Spawn error: ${err.message}` });
    });

    child.on('close', code => {
        handleCompletion(code, runId, variables, io, automationDir, config, inputs);
    });
}

function handleCompletion(code, runId, variables, io, automationDir, config, originalInputs) {
    if (!currentExecution || currentExecution.runId !== runId) return;

    // Calculate Duration
    const endTime = Date.now();
    const duration = endTime - (currentExecution.startTime || endTime);

    currentExecution = null;

    const status = code === 0 ? 'Passed' : 'Failed';

    // Parse Results
    let perScriptResults = [];
    let totalTests = 0, totalPassed = 0, totalFailed = 0;

    if (config.reporting.parser === 'playwright-json') {
        const resultFile = path.join(automationDir, resolveTemplate(config.reporting.resultsFile, variables));
        if (fs.existsSync(resultFile)) {
            try {
                const json = JSON.parse(fs.readFileSync(resultFile));
                perScriptResults = parsePlaywrightJSON(json, originalInputs.scripts || []);
                totalTests = perScriptResults.reduce((sum, s) => sum + s.totalTests, 0);
                totalPassed = perScriptResults.reduce((sum, s) => sum + s.passed, 0);
                totalFailed = perScriptResults.reduce((sum, s) => sum + s.failed, 0);
            } catch (e) { console.error('Parse error', e); }
        }
    }

    const historyEntry = {
        runId,
        timestamp: new Date().toISOString(),
        status,
        duration,
        config: originalInputs, // Store all inputs
        perScriptResults,
        totalTests,
        totalPassed,
        totalFailed,
        region: originalInputs.region, // Backwards compat for UI
        scripts: originalInputs.scripts || [] // Backwards compat for UI
    };

    addHistoryEntry(historyEntry);
    io.emit('execution:end', { runId, status, results: historyEntry });

    // Generate Allure
    if (config.reporting.artifacts && config.reporting.artifacts.allure) {
        const allureCfg = config.reporting.artifacts.allure;
        const cmd = resolveTemplate(allureCfg.generateCommand, variables);
        exec(cmd, { cwd: automationDir }, (err) => {
            if (err) console.error('Allure Gen Failed', err);
            else console.log('Allure Gen Success');
        });
    }
}

function stopExecution(req, res, io) {
    if (currentExecution) {
        // Kill logic equivalent to existing
        const pid = currentExecution.child.pid;
        if (process.platform === 'win32') {
            exec(`taskkill /pid ${pid} /T /F`);
        } else {
            currentExecution.child.kill();
        }
        currentExecution = null;
        io.emit('execution:stopped', { runId: '?', message: 'Stopped' });
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'None running' });
    }
}

module.exports = { executeTests, getAvailableScripts, stopExecution };
