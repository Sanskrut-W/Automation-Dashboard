const express = require('express');
const { getAvailableScripts, executeTests, stopExecution } = require('../services/automationService'); // CHANGED: Generic Service
const { getConfig } = require('../services/configService'); // CHANGED: Config Access
const { readHistory } = require('../config/db');
const { generatePdfReport, downloadFailedScreenshots } = require('../services/fileService');

// We export a function that accepts dependencies and returns the router
module.exports = function createApiRouter(io, automationDir) {
    const router = express.Router();

    // -- Configuration (NEW) --
    // Frontend will call this first to know what inputs to render
    router.get('/config', (req, res) => {
        try {
            res.json(getConfig());
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // -- Scripts (Dynamic) --
    router.get('/scripts', (req, res) => {
        // Receives query params like ?region=ZA&suite=smoke
        // Passed directly to generic service
        try {
            const scripts = getAvailableScripts(req.query);
            res.json({ scripts });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // -- Metadata (Legacy Support / Deprecated) --
    // The frontend should eventually use /config + /scripts
    router.get('/metadata', (req, res) => {
        const { region, suiteType } = req.query;
        // Map legacy query to new generic inputs if possible, or just pass through
        const scripts = getAvailableScripts({ region: region || 'ZA', suiteType: suiteType || 'smoke' });
        // The old regions list is now in config, but for backward compat we return generic config input options?
        // Let's just return what the old frontend expects for now BUT sourced from config?
        // Actually simplest is to return empty regions to force migration or read from config if specific ID exists.
        const config = getConfig();
        const regionInput = config.inputs.find(i => i.id === 'region');
        const regions = regionInput ? regionInput.options : [];

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
        // req.body contains { region: 'ZA', suite: 'smoke', scripts: [] }
        executeTests(req, res, io);
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

        // Pass the original configuration directly to executeTests
        // logic should handle { region, scripts } etc in req.body
        req.body = originalRun.config || {};
        executeTests(req, res, io);
    });

    // -- Reports --
    router.get('/report/pdf', (req, res) => {
        // Need to pass PORT or complete URL to service?
        // Service expects (req, res, port).
        // Let's assume port 3000 or pass it.
        // req.get('host') gives "localhost:3000"
        const host = req.get('host');
        const port = host.split(':')[1] || 3000;
        const region = req.query.region;
        generatePdfReport(req, res, port, region, automationDir);
    });

    router.get('/report/screenshots', (req, res) => {
        downloadFailedScreenshots(req, res, automationDir);
    });

    return router;
};
