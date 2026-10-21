const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const createApiRouter = require('./routes/api');
const projects = require('./config/projects');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', createApiRouter(io, projects));

// Serve Playwright / HTML reports per project
Object.values(projects).forEach(project => {
    const reportPath = path.join(project.dir, project.reportDir);
    app.use(`/report/${project.id}`, express.static(reportPath));
});

// Serve built React app
app.use(express.static(path.join(__dirname, '../client2/dist')));

// SPA fallback
app.use((req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/report')) {
        return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(__dirname, '../client2/dist/index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log('Projects loaded:', Object.keys(projects).join(', '));
});
