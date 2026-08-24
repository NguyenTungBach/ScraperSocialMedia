// Load environment variables first (before requiring other modules)
require('dotenv').config();

const app = require('./app');
const http = require('http');

// Get port from environment variables (support both APP_PORT and PORT)
// Read directly from process.env to ensure .env is loaded
const PORT = Number(process.env.APP_PORT) || Number(process.env.PORT) || 3000;

const server = http.createServer(app);

// Listen on all interfaces (0.0.0.0) to allow connections from WSL
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} (listening on 0.0.0.0)`);
});
