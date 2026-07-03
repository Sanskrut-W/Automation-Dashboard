const express = require('express');
const { getAvailableScripts, executeTests, stopExecution } = require('../services/playwrightService');
const { readHistory } = require('../config/db');
const { generatePdfReport, downloadFailedScreenshots } = require('../services/fileService');

module.exports = function createApiRouter(io, projects) {
    const router = express.Router();

    // -- Projects --
    router.get('/projects', (req, res) => {
        const list = Object.values(projects).map(p => ({
            id: p.id,
            name: p.name,
            type: p.type,
            regions: p.regions || null,
            defaultRegion: p.defaultRegion || null,
            environments: p.environments || null,
            defaultEnv: p.defaultEnv || null,
            suiteTypes: p.suiteTypes || null,
        }));
        res.json(list);
    });

    // -- Metadata (scripts list) --
    router.get('/metadata', (req, res) => {
        const { project: projectId, region, suiteType } = req.query;
        const project = projects[projectId] || projects.synapse;
        const scripts = getAvailableScripts(
            project,
            region || project.defaultRegion || 'ZA',
            suiteType || 'smoke'
        );
        res.json({
            scripts,
            regions: project.regions || null,
            environments: project.environments || null,
        });
    });

    // -- History --
    router.get('/history', (req, res) => {
        const { project } = req.query;
        const data = readHistory();
        const list = project
            ? data.history.filter(h => (h.project || 'synapse') === project)
            : data.history;
        res.json(list);
    });

    router.get('/runs/latest', (req, res) => {
        const { project } = req.query;
        const data = readHistory();
        const list = project
            ? data.history.filter(h => (h.project || 'synapse') === project)
            : data.history;
        if (list.length === 0) return res.status(404).json({ error: 'No runs found' });
        res.json(list[0]);
    });

    router.get('/runs/:id', (req, res) => {
        const data = readHistory();
        const run = data.history.find(r => r.runId === req.params.id);
        if (!run) return res.status(404).json({ error: 'Run not found' });
        res.json(run);
    });

    // -- Execution --
    router.post('/execute', (req, res) => {
        const projectId = req.body.project || 'synapse';
        const project = projects[projectId] || projects.synapse;
        executeTests(req, res, io, project);
    });

    router.post('/stop', (req, res) => {
        stopExecution(req, res, io);
    });

    router.post('/runs/:id/rerun', (req, res) => {
        const data = readHistory();
        const original = data.history.find(r => r.runId === req.params.id);
        if (!original) return res.status(404).json({ error: 'Run not found' });

        const projectId = original.project || 'synapse';
        const project = projects[projectId] || projects.synapse;
        req.body = {
            project: projectId,
            region: original.region,
            scripts: original.scripts,
            suiteType: original.suiteType,
            environment: original.environment,
            env: {}
        };
        executeTests(req, res, io, project);
    });

    // -- Reports --
    router.get('/report/pdf', (req, res) => {
        const host = req.get('host');
        const port = host.split(':')[1] || 3000;
        generatePdfReport(req, res, port);
    });

    router.get('/report/screenshots', (req, res) => {
        const projectId = req.query.project || 'synapse';
        const project = projects[projectId] || projects.synapse;
        downloadFailedScreenshots(req, res, project.dir);
    });

    return router;
};
