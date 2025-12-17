const express = require('express');
const { getAvailableScripts, executeTests, stopExecution } = require('../services/playwrightService');
const { readHistory } = require('../config/db');
const { generatePdfReport, downloadFailedScreenshots } = require('../services/fileService');

// We export a function that accepts dependencies and returns the router
module.exports = function createApiRouter(io, automationDir) {
    const router = express.Router();

    // -- Metadata --
    router.get('/metadata', (req, res) => {
        const { region, suiteType } = req.query;
        const scripts = getAvailableScripts(automationDir, region || 'ZA', suiteType || 'smoke');
        const regions = ['ZA', 'GH', 'MW', 'MZ', 'BW', 'TZ', 'NG', 'ZM'];
        res.json({ regions, scripts });
    });

    // -- History --
    router.get('/history', (req, res) => {
        const data = readHistory();
        res.json(data.history);
    });

    router.get('/runs/latest', (req, res) => {
        const data = readHistory();
        if (data.history.length === 0) {
            return res.status(404).json({ error: 'No runs found' });
        }
        res.json(data.history[0]);
    });

    router.get('/runs/:id', (req, res) => {
        const data = readHistory();
        const run = data.history.find(r => r.runId === req.params.id);
        if (!run) return res.status(404).json({ error: 'Run not found' });
        res.json(run);
    });

    // -- Execution --
    router.post('/execute', (req, res) => {
        executeTests(req, res, io, automationDir);
    });

    router.post('/stop', (req, res) => {
        stopExecution(req, res, io);
    });

    router.post('/runs/:id/rerun', (req, res) => {
        const data = readHistory();
        const originalRun = data.history.find(r => r.runId === req.params.id);

        if (!originalRun) {
            return res.status(404).json({ error: 'Run not found' });
        }

        const { region, scripts, env } = originalRun.config || { region: originalRun.region, scripts: originalRun.scripts, env: {} };
        req.body = { region, scripts, env };
        executeTests(req, res, io, automationDir);
    });

    // -- Reports --
    router.get('/report/pdf', (req, res) => {
        // Need to pass PORT or complete URL to service?
        // Service expects (req, res, port).
        // Let's assume port 3000 or pass it.
        // req.get('host') gives "localhost:3000"
        const host = req.get('host');
        const port = host.split(':')[1] || 3000;
        generatePdfReport(req, res, port);
    });

    router.get('/report/screenshots', (req, res) => {
        downloadFailedScreenshots(req, res, automationDir);
    });

    return router;
};
