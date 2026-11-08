const express = require('express');
const breakoutEngine = require('../services/breakoutEngine');
const instrumentMaster = require('../services/instrumentMaster');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/breakout/signals
 * Live and confirmed breakout & breakdown signals with statistics
 */
router.get('/signals', async (req, res) => {
  try {
    const tab = req.query.tab || 'ALL';
    const result = breakoutEngine.getSignals(tab);
    res.json(result);
  } catch (err) {
    logger.error('Error fetching breakout signals:', err.message);
    res.status(500).json({ error: 'Failed to fetch breakout signals', message: err.message });
  }
});

/**
 * GET /api/breakout/config
 * Current breakout screener configuration
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    config: breakoutEngine.getConfig()
  });
});

/**
 * POST /api/breakout/config
 * Update breakout screener parameters and recalculate
 */
router.post('/config', async (req, res) => {
  try {
    const newConfig = req.body;
    breakoutEngine.updateConfig(newConfig);
    res.json({
      success: true,
      message: 'Configuration updated and scanner recalculating',
      config: breakoutEngine.getConfig()
    });
  } catch (err) {
    logger.error('Failed to update breakout config:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/breakout/scan
 * Trigger an immediate recalculation/scan cycle
 */
router.post('/scan', async (req, res) => {
  try {
    await breakoutEngine.runScanCycle(true);
    res.json({
      success: true,
      message: 'Scan cycle completed',
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/breakout/candles
 * Candlestick data for TradingView Chart view
 * Query: token, exchange, timeframe
 */
router.get('/candles', async (req, res) => {
  try {
    const { token, symbol, exchange = 'NSE', timeframe } = req.query;
    if (!token && !symbol) {
      return res.status(400).json({ error: 'token or symbol required' });
    }

    const effectiveToken = token || (instrumentMaster.findInstrument(symbol, exchange)?.token);
    if (!effectiveToken) {
      return res.status(404).json({ error: 'Instrument token not found' });
    }

    const targetInst = {
      token: effectiveToken,
      exchange,
      symbol: symbol || effectiveToken
    };

    const histData = await breakoutEngine.getOrFetchHistoricalLevels(targetInst);

    if (!histData) {
      return res.status(404).json({ error: 'Historical candle data unavailable for this instrument' });
    }

    res.json({
      success: true,
      token: effectiveToken,
      symbol: targetInst.symbol,
      timeframe: timeframe || breakoutEngine.getConfig().timeframe,
      resistance: histData.resistance,
      support: histData.support,
      avgVolume: histData.avgVolume,
      candles: histData.candles || [],
      candlesCount: histData.candlesCount,
      fromDate: histData.fromDate,
      toDate: histData.toDate
    });
  } catch (err) {
    logger.error('Error fetching candles:', err.message);
    res.status(500).json({ error: 'Failed to fetch candles', message: err.message });
  }
});

module.exports = router;

