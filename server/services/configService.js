const fs = require('fs');
const path = require('path');

let config = null;
let automationDir = null;

function loadConfig(dir) {
    automationDir = dir;
    const configPath = path.join(dir, 'dashboard.config.json');

    if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found at ${configPath}`);
    }

    try {
        const raw = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(raw);
        console.log(`[Config] Loaded configuration: ${config.projectName}`);
        return config;
    } catch (err) {
        throw new Error(`Failed to parse config file: ${err.message}`);
    }
}

function getConfig() {
    if (!config) throw new Error('Config not loaded');
    return config;
}

function getAutomationDir() {
    return automationDir;
}

module.exports = {
    loadConfig,
    getConfig,
    getAutomationDir
};
