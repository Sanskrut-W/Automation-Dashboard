const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Every batch run gets its own folder under Dashboard/reports/.
// One multi-region run => one folder => one PDF per region inside it.
const REPORTS_ROOT = path.resolve(__dirname, '../../reports');

function ensureReportsRoot() {
    if (!fs.existsSync(REPORTS_ROOT)) fs.mkdirSync(REPORTS_ROOT, { recursive: true });
    return REPORTS_ROOT;
}

function sanitize(value) {
    return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

function stamp(date = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
        + `_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}

// Folder name carries the regions it covers, e.g. Run_2026-10-16_14-30-05_ZA-GH-MW
// so that a run across several regions is identifiable without opening it.
function createBatchFolder({ projectId, regions = [], suiteType, environment }) {
    ensureReportsRoot();

    const realRegions = regions.filter(Boolean);
    const label = realRegions.length
        ? realRegions.map(sanitize).join('-')
        : sanitize(environment || 'default');

    let dirName = `Run_${stamp()}_${label}`;
    let dirPath = path.join(REPORTS_ROOT, dirName);
    let suffix = 2;
    while (fs.existsSync(dirPath)) {
        dirName = `Run_${stamp()}_${label}_${suffix++}`;
        dirPath = path.join(REPORTS_ROOT, dirName);
    }

    fs.mkdirSync(dirPath, { recursive: true });
    return { dirName, dirPath, projectId, suiteType, environment, regions: realRegions };
}

// <REGION>_Report.pdf — the region name is part of the file name too, so the PDFs
// stay identifiable once they are copied out of the folder.
function batchPdfPath(dirPath, region, fallback = 'Report') {
    const base = sanitize(region || fallback) + '_Report';
    let file = `${base}.pdf`;
    let n = 2;
    while (fs.existsSync(path.join(dirPath, file))) file = `${base}_${n++}.pdf`;
    return path.join(dirPath, file);
}

function writeBatchSummary(dirPath, summary) {
    try {
        fs.writeFileSync(path.join(dirPath, 'summary.json'), JSON.stringify(summary, null, 2));
    } catch (e) {
        console.error('Failed to write batch summary:', e.message);
    }
}

// A batch that never produced a PDF (everything skipped, or stopped straight away)
// would otherwise leave an empty folder behind on every press of Run.
function removeIfNoPdfs(dirPath) {
    try {
        const files = fs.readdirSync(dirPath);
        if (files.some(f => f.toLowerCase().endsWith('.pdf'))) return false;
        fs.rmSync(dirPath, { recursive: true, force: true });
        return true;
    } catch (e) {
        return false;
    }
}

// Resolve a folder name coming from the client, refusing anything outside REPORTS_ROOT.
function resolveBatchDir(name) {
    if (!name || name.includes('/') || name.includes('\\')) return null;
    const dirPath = path.resolve(REPORTS_ROOT, name);
    if (!dirPath.startsWith(path.resolve(REPORTS_ROOT) + path.sep)) return null;
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return null;
    return dirPath;
}

function listBatches(projectId) {
    ensureReportsRoot();
    return fs.readdirSync(REPORTS_ROOT)
        .filter(name => {
            try { return fs.statSync(path.join(REPORTS_ROOT, name)).isDirectory(); }
            catch (e) { return false; }
        })
        .map(name => {
            const dirPath = path.join(REPORTS_ROOT, name);
            let summary = null;
            try {
                const file = path.join(dirPath, 'summary.json');
                if (fs.existsSync(file)) summary = JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch (e) { /* folder predates summaries, or is mid-write */ }

            const files = fs.readdirSync(dirPath)
                .filter(f => f.toLowerCase().endsWith('.pdf'))
                .map(f => {
                    const stats = fs.statSync(path.join(dirPath, f));
                    return { file: f, size: stats.size, region: f.split('_')[0] };
                });

            return {
                name,
                path: dirPath,
                createdAt: summary?.startedAt || fs.statSync(dirPath).birthtime,
                project: summary?.project || null,
                suiteType: summary?.suiteType || null,
                regions: summary?.regions || files.map(f => f.region),
                scripts: summary?.scripts || [],
                results: summary?.results || [],
                files,
            };
        })
        .filter(b => !projectId || !b.project || b.project === projectId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function zipBatch(dirPath, zipPath) {
    return new Promise((resolve, reject) => {
        if (process.platform === 'win32') {
            const psCommand = `Compress-Archive -Path "${dirPath}\\*" -DestinationPath "${zipPath}" -Force`;
            const child = spawn('powershell.exe', ['-NoProfile', '-Command', psCommand]);
            child.on('close', code => code === 0 ? resolve(zipPath) : reject(new Error('Compress-Archive failed')));
            child.on('error', reject);
        } else {
            const child = spawn('zip', ['-r', zipPath, '.'], { cwd: dirPath });
            child.on('close', code => code === 0 ? resolve(zipPath) : reject(new Error('zip failed')));
            child.on('error', reject);
        }
    });
}

function openBatchFolder(dirPath) {
    if (process.platform === 'win32') spawn('explorer.exe', [dirPath], { detached: true }).unref();
    else if (process.platform === 'darwin') spawn('open', [dirPath], { detached: true }).unref();
    else spawn('xdg-open', [dirPath], { detached: true }).unref();
}

module.exports = {
    REPORTS_ROOT,
    ensureReportsRoot,
    createBatchFolder,
    batchPdfPath,
    writeBatchSummary,
    removeIfNoPdfs,
    resolveBatchDir,
    listBatches,
    zipBatch,
    openBatchFolder,
};
