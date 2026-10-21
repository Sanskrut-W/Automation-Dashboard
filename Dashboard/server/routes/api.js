const express = require('express');
const path = require('path');
const fs = require('fs');
const {
    getAvailableScripts,
    getAvailableScriptsForRegions,
    executeTests,
    stopExecution,
} = require('../services/playwrightService');
const { readHistory } = require('../config/db');
const { generatePdfReport, downloadFailedScreenshots } = require('../services/fileService');
const {
    listBatches,
    resolveBatchDir,
    zipBatch,
    openBatchFolder,
} = require('../services/reportArchiveService');

module.exports = function createApiRouter(io, projects) {
    const router = express.Router();

    // `synapse` is commented out in the project config, so never fall back to it blindly.
    const fallbackProject = () => projects.synapseV2 || Object.values(projects)[0];
    const resolveProject = (id) => projects[id] || fallbackProject();

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
    // `regions` (comma separated) returns the union across those regions, so a
    // multi-region selection can still offer every script it might run.
    router.get('/metadata', (req, res) => {
        const { project: projectId, region, regions, suiteType } = req.query;
        const p = resolveProject(projectId);

        const regionList = (regions ? String(regions).split(',') : [region])
            .map(r => (r || '').trim())
            .filter(Boolean);

        const scripts = regionList.length > 1
            ? getAvailableScriptsForRegions(p, regionList, suiteType || 'smoke')
            : getAvailableScripts(p, regionList[0] || p.defaultRegion || 'ZA', suiteType || 'smoke');

        res.json({
            scripts,
            regions: p.regions || null,
            environments: p.environments || null,
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
        const project = resolveProject(req.body.project);
        executeTests(req, res, io, project);
    });

    router.post('/stop', (req, res) => {
        stopExecution(req, res, io);
    });

    router.post('/runs/:id/rerun', (req, res) => {
        const data = readHistory();
        const original = data.history.find(r => r.runId === req.params.id);
        if (!original) return res.status(404).json({ error: 'Run not found' });

        const project = resolveProject(original.project);
        req.body = {
            project: project.id,
            regions: original.region ? [original.region] : [],
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
        req.query.project = resolveProject(req.query.project).id;
        generatePdfReport(req, res, port);
    });

    router.get('/report/screenshots', (req, res) => {
        const project = resolveProject(req.query.project);
        downloadFailedScreenshots(req, res, project.dir);
    });

    // -- Archived report folders (one folder per batch run) --
    router.get('/report-batches', (req, res) => {
        try {
            res.json(listBatches(req.query.project));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/report-batches/:name/download', async (req, res) => {
        const dirPath = resolveBatchDir(req.params.name);
        if (!dirPath) return res.status(404).json({ error: 'Report folder not found' });

        const zipPath = path.join(require('os').tmpdir(), `${req.params.name}-${Date.now()}.zip`);
        try {
            await zipBatch(dirPath, zipPath);
            res.download(zipPath, `${req.params.name}.zip`, () => {
                try { fs.unlinkSync(zipPath); } catch (e) { }
            });
        } catch (err) {
            res.status(500).json({ error: 'Failed to zip report folder: ' + err.message });
        }
    });

    router.post('/report-batches/:name/open', (req, res) => {
        const dirPath = resolveBatchDir(req.params.name);
        if (!dirPath) return res.status(404).json({ error: 'Report folder not found' });
        try {
            openBatchFolder(dirPath);
            res.json({ success: true, path: dirPath });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/report-batches/:name/files/:file', (req, res) => {
        const dirPath = resolveBatchDir(req.params.name);
        if (!dirPath) return res.status(404).json({ error: 'Report folder not found' });

        const file = path.basename(req.params.file);
        const filePath = path.join(dirPath, file);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

        if (file.toLowerCase().endsWith('.pdf')) res.type('application/pdf');
        res.sendFile(filePath);
    });

    return router;
};
