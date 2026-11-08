require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const healthRoutes = require('./routes/healthRoutes');
const simpleRoutes = require('./routes/simpleRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const cashUniverseService = require('./services/cashUniverseService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security & Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "*"],
      upgradeInsecureRequests: null,
    }
  },
  hsts: false
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Rate Limiting (generous 180 req/min for smooth UI updates)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const proRoutes = require('./routes/proRoutes');

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/simple', simpleRoutes);
app.use('/api/pro/settings', settingsRoutes);
app.use('/api/pro', proRoutes);

// Serve built React client
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA Fallback
app.use((req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Pro-Suite</title></head>
          <body style="font-family: sans-serif; background: #0a0d14; color: #fff; padding: 2rem;">
            <h2>Pro-Suite Running on Port ${PORT}</h2>
            <p>API is active. Client build is loading or running in dev mode.</p>
            <p><a href="/api/health" style="color: #60a5fa;">Check /api/health</a></p>
            <p><a href="/api/simple/stocks" style="color: #60a5fa;">Check /api/simple/stocks</a></p>
          </body>
        </html>
      `);
    }
  });
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`Pro-Suite server online on port ${PORT}`);
  logger.info(`Health endpoint: http://localhost:${PORT}/api/health`);
  logger.info(`Simple stocks endpoint: http://localhost:${PORT}/api/simple/stocks`);

  // Initialize Cash Universe in background without blocking server startup
  cashUniverseService.initializeCashUniverse().catch(err => {
    logger.error('Background universe initialization failed:', err.message);
  });
});

// Graceful Shutdown
function shutdown() {
  logger.info('Shutting down Pro-Suite gracefully...');
  server.close(() => {
    logger.info('Pro-Suite closed.');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { app, server };
