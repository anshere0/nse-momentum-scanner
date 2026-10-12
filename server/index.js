require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { getDataSource } = require('./dataSource');
const authRoutes = require('./routes/auth');
const { apiRoutes, setDataSource } = require('./routes/api');
const sseRoutes = require('./routes/sse');
const tokenStore = require('./utils/tokenStore');
const marketState = require('./state/marketState');
const marketSession = require('./services/marketSession');
const pdhCache = require('./utils/pdhCache');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "*", "https://*.loca.lt", "wss://*.loca.lt", "https://*.angelone.in", "wss://*.angelone.in"],
      upgradeInsecureRequests: null,
    }
  },
  hsts: false,
}));

const defaultOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];
const allowedOrigins = process.env.PUBLIC_BASE_URL
  ? [process.env.PUBLIC_BASE_URL, ...defaultOrigins]
  : defaultOrigins;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.loca.lt') || origin.includes('localhost')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

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

// Serve static React client build
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.use((req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('F&O Momentum Scanner - Client build ready or running via Vite');
    }
  });
});

// Startup Flow
async function startApp() {
  logger.info('=== Indian Stock Market Scanner (Angel One SmartAPI) Starting ===');

  // Ensure data dir exists
  const fs = require('fs');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Get data source
  const sourceName = process.env.DATA_SOURCE || 'angelone';
  const dataSource = getDataSource(sourceName);
  setDataSource(dataSource);
  logger.info(`Data source selected: ${sourceName}`);

  // Market session check
  const marketStatus = marketSession.getMarketStatus();
  const lastTradingDay = marketSession.getLastCompletedTradingDay();
  logger.info(`Market Status: ${marketStatus.sessionType} (Market Open: ${marketStatus.isMarketOpen})`);
  logger.info(`Last Completed Trading Session: ${lastTradingDay}`);

  try {
    // Initialize data source (auth + instrument master)
    await dataSource.init();

    // Load Universe
    const fnoUniverse = await dataSource.getFnoUniverse();
    logger.info(`Loaded F&O Universe: ${fnoUniverse.length} instruments`);
    marketState.setUniverse(fnoUniverse);

    let cashUniverse = [];
    if (dataSource.getCashUniverse) {
      cashUniverse = await dataSource.getCashUniverse(true);
      marketState.setCashUniverse(cashUniverse);
      logger.info(`Loaded Cash Universe: ${cashUniverse.length} instruments`);
    }

    const fullUniverse = [...fnoUniverse, ...cashUniverse];

    // Load Baseline OI reference and PDH/PDL from official NSE Bhavcopy
    try {
      const bhavcopyService = require('./services/bhavcopyService');
      const bhavData = await bhavcopyService.fetchFoBhavcopy(lastTradingDay, fnoUniverse);
      if (bhavData && bhavData.oiMap && Object.keys(bhavData.oiMap).length > 0) {
        marketState.setOiRefMap(bhavData.oiMap);
        logger.info(`OI reference baseline loaded for ${Object.keys(bhavData.oiMap).length} instruments from NSE Bhavcopy`);
      }
      if (bhavData && bhavData.pdhMap && Object.keys(bhavData.pdhMap).length > 0) {
        marketState.setPdhData(bhavData.pdhMap);
        pdhCache.save(bhavData.pdhMap);
        logger.info(`PDH/PDL reference loaded for ${Object.keys(bhavData.pdhMap).length} instruments from NSE Bhavcopy`);
      }
    } catch (bhavErr) {
      logger.warn('Could not load Bhavcopy baseline:', bhavErr.message);
      // Fallback to data source PDH if available
      try {
        const pdhData = await dataSource.getPrevDayHL(fnoUniverse);
        marketState.setPdhData(pdhData);
      } catch {}
    }

    // Load PMH / PML asynchronously in background so startup is instant
    if (dataSource.getPrevMonthHL) {
      dataSource.getPrevMonthHL(fnoUniverse).then(pmhData => {
        marketState.setPmhData(pmhData);
        logger.info(`PMH/PML data loaded for ${Object.keys(pmhData).length} instruments`);
      }).catch(pmhErr => {
        logger.warn('Could not load PMH/PML data:', pmhErr.message);
      });
    }

    // Check if market is closed — if so, load the last completed trading day's snapshot!
    if (!marketStatus.isMarketOpen && dataSource.getLastDaySnapshot) {
      logger.info(`Market is closed. Loading last trading day snapshot (${lastTradingDay})...`);
      try {
        const snapshot = await dataSource.getLastDaySnapshot(fullUniverse);
        if (snapshot && snapshot.length > 0) {
          marketState.updateTicks(snapshot);
          marketState.setDataMode('PREVIOUS_CLOSE', lastTradingDay);
          logger.info(`Successfully loaded previous close data for ${snapshot.length} instruments`);
        } else {
          marketState.setDataMode('UNAVAILABLE');
        }
      } catch (snapErr) {
        logger.warn('Could not load last day snapshot:', snapErr.message);
        marketState.setDataMode('UNAVAILABLE');
      }
    } else if (marketStatus.isMarketOpen) {
      marketState.setDataMode('LIVE', marketStatus.currentDate);
    }

    // Subscribe to live feed
    dataSource.subscribeLive((ticks) => {
      marketState.updateTicks(ticks);
      const currentStatus = marketSession.getMarketStatus();
      if (currentStatus.isMarketOpen) {
        marketState.setDataMode('LIVE', currentStatus.currentDate);
      }
    });

    marketState.setConnectionStatus('CONNECTED');
    marketState.setScanning(true);

    // Start SSE broadcast (1 per second)
    startBroadcast();
    logger.info('Data source initialized and broadcast started successfully');
  } catch (err) {
    logger.error('Failed to fully initialize data source:', err.message);
    marketState.setConnectionStatus('ERROR');
    marketState.setDataMode('UNAVAILABLE');
    startBroadcast();
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Dashboard: ${process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// SSE broadcast interval
function startBroadcast() {
  setInterval(() => {
    const currentStatus = marketSession.getMarketStatus();
    if (currentStatus.isMarketOpen && marketState.dataMode !== 'LIVE') {
      marketState.setDataMode('LIVE', currentStatus.currentDate);
    }
    const snapshot = marketState.getSnapshot();
    sseRoutes.broadcast(snapshot);
  }, 1000);
}

startApp().catch(err => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
