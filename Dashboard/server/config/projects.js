const path = require('path');

// Base = C:\Users\SW115406\Desktop\Dashboard-demo
const SYNAPSE_ROOT = path.resolve(__dirname, '../../..');

module.exports = {
    // synapse: {
    //     id: 'synapse',
    //     name: 'Synapse (Betway)',
    //     type: 'regional',
    //     dir: path.join(SYNAPSE_ROOT, 'Betway-Automation'),
    //     regions: ['ZA', 'GH', 'MW', 'MZ', 'BW', 'TZ', 'NG', 'ZM'],
    //     defaultRegion: 'ZA',
    //     suiteTypes: ['smoke', 'regression'],
    //     reportDir: 'playwright-report',
    //     screenshotsDir: 'test-results',
    //     // All modules under smoke/regression are shown — nothing hidden.
    //     // To hide one again: hiddenScripts: { ALL: ['scriptName'], GH: ['scriptName'] }
    // },
    synapseV2: {
        id: 'synapseV2',
        name: 'Synapse (Betway) V2',
        type: 'regional',
        dir: path.join(SYNAPSE_ROOT, 'Betway-Automation-V2'),
        regions: ['ZA', 'GH', 'MW', 'MZ', 'BW', 'TZ', 'NG', 'ZM'],
        defaultRegion: 'ZA',
        // Only 'smoke' exists so far in the shared-core rewrite — the "regression" (modules)
        // tier hasn't been migrated yet. Add 'regression' here once that content lands.
        suiteTypes: ['smoke'],
        reportDir: 'playwright-report',
        screenshotsDir: 'test-results',
        // GH/NG have all 15 smoke modules; BW is missing 'betslip'; MW/MZ/TZ/ZM have no
        // 'gamingLobby' (no GamingLobbyPage in the old repo for those regions) — the discovery
        // logic already only lists folders that actually exist, so no hiddenScripts entry needed.
    },
    jpc: {
        id: 'jpc',
        name: 'JPC',
        type: 'regional',
        dir: path.join(SYNAPSE_ROOT, 'JPC-Automation'),
        regions: ['ZA', 'GH', 'MW', 'TZ'],
        defaultRegion: 'ZA',
        suiteTypes: ['smoke', 'regression'],
        reportDir: 'playwright-report',
        screenshotsDir: 'test-results',
    },
    purevantage: {
        id: 'purevantage',
        name: 'Pure Vantage',
        type: 'flat',
        dir: path.join(SYNAPSE_ROOT, 'PureVantage'),
        environments: ['dev', 'staging', 'prod'],
        defaultEnv: 'dev',
        reportDir: 'reports/playwright-report',
        screenshotsDir: 'reports/screenshots',
    }
};
