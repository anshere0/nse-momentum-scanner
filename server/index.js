require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { getDataSource } = require('./dataSource');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const sseRoutes = require('./routes/sse');
const tokenStore = require('./utils/tokenStore');
const marketState = require('./state/marketState');
const pdhCache = require('./utils/pdhCache');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    }
  }
}));

const allowedOrigins = process.env.PUBLIC_BASE_URL ? [process.env.PUBLIC_BASE_URL] : ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({ origin: allowedOrigins }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/admin', authRoutes.adminRoutes);
app.use('/auth', authRoutes.authRoutes);
app.use('/api', apiRoutes);
app.use('/sse', sseRoutes);

// Serve static React build
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.use((req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('F&O Momentum Scanner - Client not built yet. Run: npm run build');
    }
  });
});

// === Startup ===
async function startApp() {
  logger.info('=== F&O Momentum Scanner Starting ===');
  
  // Ensure data dir exists
  const fs = require('fs');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Load saved token
  const savedToken = tokenStore.load();
  if (savedToken) {
    logger.info(`Loaded saved token (expires: ${new Date(savedToken.expiresAt).toISOString()})`);
  }

  // Get the data source (upstox or mock)
  const sourceName = process.env.DATA_SOURCE || 'mock';
  const dataSource = getDataSource(sourceName);
  logger.info(`Data source: ${sourceName}`);

  try {
    // Initialize data source
    await dataSource.init();
    
    // Get F&O universe
    const fnoUniverse = await dataSource.getFnoUniverse();
    logger.info(`F&O Universe loaded: ${fnoUniverse.length} stocks`);
    marketState.setUniverse(fnoUniverse);

    // Load PDH/PDL data
    const pdhData = await dataSource.getPrevDayHL(fnoUniverse);
    logger.info(`PDH/PDL data loaded for ${Object.keys(pdhData).length} symbols`);
    marketState.setPdhData(pdhData);
    pdhCache.save(pdhData);

    // Subscribe to live data
    dataSource.subscribeLive((ticks) => {
      marketState.updateTicks(ticks);
    });

    // If market is closed, load last trading day's data so the dashboard isn't empty
    if (dataSource.getLastDaySnapshot) {
      const now = new Date();
      const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const hours = ist.getHours();
      const minutes = ist.getMinutes();
      const day = ist.getDay();
      const timeInMinutes = hours * 60 + minutes;
      const isMarketOpen = day > 0 && day < 6 && timeInMinutes >= 540 && timeInMinutes <= 930;

      if (!isMarketOpen) {
        logger.info('Market is closed — loading last trading day snapshot...');
        try {
          const snapshot = await dataSource.getLastDaySnapshot(fnoUniverse);
          if (snapshot.length > 0) {
            // Feed the historical ticks into marketState so it shows data
            marketState.updateTicks(snapshot);
            logger.info(`Loaded ${snapshot.length} symbols from last trading day`);
          }
        } catch (snapErr) {
          logger.warn('Could not load last day snapshot:', snapErr.message);
        }
      }
    }

    // Start SSE broadcast (1 per second)
    startBroadcast();

    logger.info('Data source initialized successfully');
  } catch (err) {
    logger.error('Failed to initialize data source:', err.message);
    logger.info('Server will start but show stale/empty data. Admin login may be required.');
  }

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Dashboard: ${process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`}`);
  });
}

// SSE broadcast interval
function startBroadcast() {
  setInterval(() => {
    const snapshot = marketState.getSnapshot();
    sseRoutes.broadcast(snapshot);
  }, 1000);
}

startApp().catch(err => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
