const path = require('path');

// Base = C:\Users\HT67091\Downloads\Synapse Dashboard
const SYNAPSE_ROOT = path.resolve(__dirname, '../../../..');

module.exports = {
    synapse: {
        id: 'synapse',
        name: 'Synapse (Betway)',
        type: 'regional',
        dir: path.join(SYNAPSE_ROOT, 'Betway-Automation-main', 'Betway-Automation-main'),
        regions: ['ZA', 'GH', 'MW', 'MZ', 'BW', 'TZ', 'NG', 'ZM'],
        defaultRegion: 'ZA',
        suiteTypes: ['smoke', 'regression'],
        reportDir: 'playwright-report',
        screenshotsDir: 'test-results',
    },
    jpc: {
        id: 'jpc',
        name: 'JPC',
        type: 'regional',
        dir: path.join(SYNAPSE_ROOT, 'JPC-Automation-main'),
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
        dir: path.join(SYNAPSE_ROOT, 'Pure-Vantage-Automation-main'),
        environments: ['dev', 'staging', 'prod'],
        defaultEnv: 'dev',
        reportDir: 'reports/playwright-report',
        screenshotsDir: 'reports/screenshots',
    }
};
