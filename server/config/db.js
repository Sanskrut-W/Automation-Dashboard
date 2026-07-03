const fs = require('fs');
const path = require('path');

// Using a simple JSON file for history
// Placed in the parent directory (server root) to maintain compatibility
const dbFile = path.join(__dirname, '../history.json');
const defaultData = { history: [] };

function readHistory() {
    if (!fs.existsSync(dbFile)) {
        fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    return JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
}

function writeHistory(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

function addHistoryEntry(entry) {
    const data = readHistory();
    data.history.unshift(entry);
    // Keep last 100 entries
    if (data.history.length > 100) data.history = data.history.slice(0, 100);
    writeHistory(data);
}

module.exports = {
    readHistory,
    writeHistory,
    addHistoryEntry
};
