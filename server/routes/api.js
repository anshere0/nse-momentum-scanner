const express = require('express');
const marketState = require('../state/marketState');
const marketSession = require('../services/marketSession');
const tokenStore = require('../utils/tokenStore');
const logger = require('../utils/logger');

const apiRoutes = express.Router();

// Current active data source reference (set by server/index.js)
let activeDataSource = null;

function setDataSource(ds) {
  activeDataSource = ds;
}

/**
 * GET /api/snapshot
 * Comprehensive live market state snapshot
 */
apiRoutes.get('/snapshot', (req, res) => {
  res.json(marketState.getSnapshot());
});

/**
 * GET /api/universe
 * Current tracked universe
 */
apiRoutes.get('/universe', (req, res) => {
  const segment = req.query.segment || 'BOTH';
  res.json({
    segment,
    fno: marketState.fnoUniverse.map(u => ({
      key: u.instrument_key,
      symbol: u.tradingsymbol,
      name: u.name,
      type: u.type,
      lotSize: u.lotsize || 1
    })),
    cash: (marketState.cashUniverse || []).map(u => ({
      key: u.instrument_key,
      symbol: u.tradingsymbol,
      name: u.name,
      type: u.type
    })),
    indices: marketState.indicesUniverse.map(u => ({
      key: u.instrument_key,
      symbol: u.tradingsymbol,
      name: u.name
    }))
  });
});

/**
 * GET /api/config
 * Current scanner configuration
 */
apiRoutes.get('/config', (req, res) => {
  res.json(marketState.getConfig());
});

/**
 * POST /api/config
 * Update scanner configuration with validation
 */
apiRoutes.post('/config', (req, res) => {
  try {
    const newConfig = req.body;
    marketState.updateConfig(newConfig);
    res.json({ success: true, config: marketState.getConfig() });
  } catch (err) {
    logger.error('Failed to update config:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/config/reset
 * Reset scanner configuration to default values
 */
apiRoutes.post('/config/reset', (req, res) => {
  marketState.resetConfig();
  res.json({ success: true, config: marketState.getConfig() });
});

/**
 * GET /api/breadth
 * Market breadth analysis
 */
apiRoutes.get('/breadth', (req, res) => {
  res.json(marketState.breadth);
});

/**
 * GET /api/sentiment
 * Market sentiment classification
 */
apiRoutes.get('/sentiment', (req, res) => {
  res.json(marketState.sentiment);
});

/**
 * GET /api/session
 * Market session & IST calendar details
 */
apiRoutes.get('/session', (req, res) => {
  const status = marketSession.getMarketStatus();
  const lastTradingDay = marketSession.getLastCompletedTradingDay();
  const prevMonth = marketSession.getPreviousCompletedMonth();

  res.json({
    status,
    lastCompletedTradingDay: lastTradingDay,
    previousCompletedMonth: prevMonth,
    timezone: 'Asia/Kolkata'
  });
});

/**
 * GET /api/health
 * Public health & diagnostics endpoint (strictly without exposing credentials)
 */
apiRoutes.get('/health', (req, res) => {
  const token = tokenStore.load();
  const uptimeSeconds = process.uptime();
  const memoryUsage = process.memoryUsage();
  const status = marketSession.getMarketStatus();

  res.json({
    status: 'OK',
    uptime: Math.floor(uptimeSeconds),
    memory: {
      rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024)
    },
    scanner: {
      connection: marketState.connectionStatus,
      dataMode: marketState.dataMode,
      isScanning: marketState.isScanning,
      tickCount: marketState.tickCount,
      lastUpdated: marketState.lastUpdated
    },
    auth: {
      authenticated: !!token?.jwtToken,
      hasFeedToken: !!token?.feedToken,
      expiresAt: token?.expiresAt ? new Date(token.expiresAt).toISOString() : null
    },
    market: status
  });
});

/**
 * POST /api/scan/start
 * Manual start scan control
 */
apiRoutes.post('/scan/start', (req, res) => {
  marketState.setScanning(true);
  marketState.updateConfig({ scanEnabled: true });
  res.json({ success: true, isScanning: true, message: 'Scan started' });
});

/**
 * POST /api/scan/stop
 * Manual stop scan control
 */
apiRoutes.post('/scan/stop', (req, res) => {
  marketState.setScanning(false);
  marketState.updateConfig({ scanEnabled: false });
  res.json({ success: true, isScanning: false, message: 'Scan stopped' });
});

/**
 * POST /api/refresh
 * Manual data refresh trigger
 */
apiRoutes.post('/refresh', async (req, res) => {
  try {
    if (activeDataSource && activeDataSource.getLastDaySnapshot) {
      const universe = marketState.fnoUniverse;
      const snapshot = await activeDataSource.getLastDaySnapshot(universe);
      if (snapshot.length > 0) {
        marketState.updateTicks(snapshot);
      }
    }
    res.json({ success: true, message: 'Data refreshed', timestamp: Date.now() });
  } catch (err) {
    logger.error('Data refresh error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = {
  apiRoutes,
  setDataSource
};
