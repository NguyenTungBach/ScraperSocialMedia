// Load environment variables first (before requiring other modules)
require('dotenv').config();

const app = require('./app');
const http = require('http');
const SettingsCache = require('./app/Services/SettingsCache');
const logger = require('./app/Logging/logger');

// Get port from environment variables (support both APP_PORT and PORT)
// Read directly from process.env to ensure .env is loaded
const PORT = Number(process.env.APP_PORT) || Number(process.env.PORT) || 3000;

const server = http.createServer(app);

async function start() {
    try {
        await SettingsCache.load();
    } catch (error) {
        logger.warn('SettingsCache load failed at boot (tables may be missing)', {
            error: error.message,
        });
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT} (listening on 0.0.0.0)`);
    });
}

start();
