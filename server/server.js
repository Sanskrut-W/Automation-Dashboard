const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const createApiRouter = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- Configuration ---
const AUTOMATION_DIR = path.resolve(__dirname, '../../Betway-Automation');
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Routes ---
// Mount API routes, injecting dependencies (io, automationDir)
app.use('/api', createApiRouter(io, AUTOMATION_DIR));

// Serve Playwright Reports
app.use('/report', express.static(path.join(AUTOMATION_DIR, 'playwright-report')));

// Serve Frontend (Built React App from client2)
app.use(express.static(path.join(__dirname, '../client2/dist')));

// Fallback to index.html for React Router
app.use((req, res) => {
    // Check if request is for API, ignore (let 404 propagate if not matched above)
    // Actually, if it didn't match /api above, it hits here.
    if (req.path.startsWith('/api') || req.path.startsWith('/report')) {
        return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(__dirname, '../client2/dist/index.html'));
});

// --- Start Server ---
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Automation Directory: ${AUTOMATION_DIR}`);
});
