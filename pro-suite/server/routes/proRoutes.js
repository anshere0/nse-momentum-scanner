const express = require('express');
const proxyClient = require('../services/proxyClient');
const { 
  calculateConfidenceScore, 
  calculateRvolConfidence, 
  calculateSectorConfidence 
} = require('../utils/confidenceEngine');
const { computeVwapMetrics } = require('../utils/vwapCalc');
const { computeOrbMetrics } = require('../utils/orbCalc');
const { computeRvolMetrics } = require('../utils/rvolCalc');
const { loadSectorMap, saveSectorMap, computeSectorMetrics } = require('../utils/sectorEngine');
const { planTrade, loadBasket, saveBasket } = require('../utils/riskEngine');
const { classifyVix, calculatePcr, computeStockDerivativesEdge } = require('../utils/derivativesCalc');
const { getStockCandles } = require('../services/candleService');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const SETTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'settings.json');

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load settings:', err.message);
  }
  return {};
}

function saveSettings(settings) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Helper to fetch enriched F&O stocks with all quantitative indicators
 */
async function getEnrichedFnoStocks(customSettings = null) {
  const snapshot = await proxyClient.fetchSnapshot();
  const settings = customSettings || getSettings();
  const rawList = (snapshot && Array.isArray(snapshot.fnoStocks) && snapshot.fnoStocks.length > 0)
    ? snapshot.fnoStocks
    : (snapshot && Array.isArray(snapshot.allScanned))
      ? snapshot.allScanned.filter(s => s.isFno !== false)
      : [];
  const sectorMap = loadSectorMap();
  const indicesData = snapshot?.indices || [];

  return rawList.map(item => {
    const ltp = item.ltp || 0;
    const close = item.pdhClose || (ltp - (ltp * (item.pc || 0) / 100));
    const pChange = Math.round((item.pc || 0) * 100) / 100;
    const oiChange = Math.round((item.oi_change_pct || item.oiChange || 0) * 100) / 100;
    const oi = item.oi || 0;

    const baseStock = {
      symbol: item.underlying || item.name || item.tradingsymbol,
      tradingsymbol: item.tradingsymbol || item.symbol,
      name: item.name || item.underlying,
      token: item.instrument_key || item.token,
      segment: 'FNO',
      isFno: true,
      expiry: item.expiry || 'CURRENT',
      lotSize: item.lotSize || 1,
      ltp,
      cashLtp: item.cashLtp || null,
      cashPc: item.cashPc || null,
      basis: item.basis || null,
      open: item.open || ltp,
      high: item.high || ltp,
      low: item.low || ltp,
      close,
      change: Math.round((ltp - close) * 100) / 100,
      pChange,
      pdh: item.pdh || null,
      pdl: item.pdl || null,
      oi,
      oiChange,
      volume: item.volume || 0,
      lastUpdated: snapshot?.timestamp || Date.now()
    };

    // Calculate Feature 2: VWAP
    const vwapData = computeVwapMetrics(baseStock, settings.vwap || {});
    baseStock.vwap = vwapData.vwap;
    baseStock.vwapData = vwapData;

    // Calculate Feature 3: ORB
    const orbData = computeOrbMetrics(baseStock, settings.orb || {});
    baseStock.orbHigh = orbData.orbHigh;
    baseStock.orbLow = orbData.orbLow;
    baseStock.orbData = orbData;

    // Calculate Feature 4: Relative Volume (R-Vol)
    const rvolData = computeRvolMetrics(baseStock, settings.rvol || {});
    baseStock.rvolData = rvolData;
    baseStock.rvolMetrics = rvolData;
    baseStock.rvol = rvolData.rvol;

    // Calculate Feature 5: Sector Tailwind & RS
    const sectorData = computeSectorMetrics(baseStock, sectorMap, indicesData, settings.sector || {});
    baseStock.sectorData = sectorData;
    baseStock.sectorMetrics = sectorData;
    baseStock.parentSector = sectorData.parentSector;
    baseStock.rsScore = sectorData.rsScore;

    // Calculate Feature 1: Core 4-Quadrant & Multi-Factor Confidence Score
    const confidenceData = calculateConfidenceScore(baseStock, settings.quadrant || {});
    baseStock.confidenceData = confidenceData;
    baseStock.quadrant = confidenceData.quadrant;
    baseStock.confidenceScore = confidenceData.score;
    baseStock.confidenceGrade = confidenceData.grade;
    baseStock.reasoning = confidenceData.reasoning;

    // Calculate Feature-Specific Confidence Engines
    baseStock.rvolConfidence = calculateRvolConfidence(baseStock, rvolData, settings.rvol || {});
    baseStock.sectorConfidence = calculateSectorConfidence(baseStock, sectorData, settings.sector || {});

    // Calculate Feature 7: Derivatives Edge (PCR, OI Walls, Max Pain)
    const derivativesData = computeStockDerivativesEdge(baseStock, settings.derivatives || {});
    baseStock.derivativesData = derivativesData;
    baseStock.pcr = derivativesData.pcr;
    baseStock.pcrStatus = derivativesData.pcrStatus;
    baseStock.pcrStatusText = derivativesData.pcrStatusText;
    baseStock.callWallStrike = derivativesData.callWallStrike;
    baseStock.putWallStrike = derivativesData.putWallStrike;
    baseStock.maxPainStrike = derivativesData.maxPainStrike;
    baseStock.wallWarning = derivativesData.wallWarning;

    return baseStock;
  });
}

/**
 * GET /api/pro/settings
 */
router.get('/settings', (req, res) => {
  res.json(getSettings());
});

/**
 * POST /api/pro/settings
 */
router.post('/settings', (req, res) => {
  try {
    const current = getSettings();
    const updated = { ...current, ...req.body };
    saveSettings(updated);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings', message: err.message });
  }
});

/**
 * GET /api/pro/overview
 */
router.get('/overview', async (req, res) => {
  try {
    const list = await getEnrichedFnoStocks();
    const counts = {
      total: list.length,
      longBuildup: list.filter(s => s.quadrant === 'LONG_BUILDUP').length,
      shortBuildup: list.filter(s => s.quadrant === 'SHORT_BUILDUP').length,
      shortCovering: list.filter(s => s.quadrant === 'SHORT_COVERING').length,
      longUnwinding: list.filter(s => s.quadrant === 'LONG_UNWINDING').length,
      aboveVwap: list.filter(s => s.vwapData?.isAboveVwap).length,
      belowVwap: list.filter(s => !s.vwapData?.isAboveVwap).length,
      overextended: list.filter(s => s.vwapData?.status?.startsWith('OVEREXTENDED')).length,
      orbBreakoutUp: list.filter(s => s.orbData?.status === 'BREAKOUT_UP').length,
      orbBreakdownDown: list.filter(s => s.orbData?.status === 'BREAKDOWN_DOWN').length,
      highRvol: list.filter(s => s.rvolData?.isVolumeSpike).length,
      sectorAligned: list.filter(s => s.sectorData?.isAligned).length,
      rsLeaders: list.filter(s => s.sectorData?.rsBadge === 'RS_LEADER').length,
      highConfidence: list.filter(s => s.confidenceScore >= 75).length,
      pcrOverbought: list.filter(s => s.pcrStatus === 'OVERBOUGHT').length,
      pcrOversold: list.filter(s => s.pcrStatus === 'OVERSOLD').length,
      wallAlerts: list.filter(s => s.wallWarning).length
    };

    const topPicks = [...list]
      .filter(s => s.quadrant === 'LONG_BUILDUP' || s.quadrant === 'SHORT_BUILDUP')
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 5);

    res.json({
      counts,
      topPicks,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pro overview', message: err.message });
  }
});

/**
 * GET /api/pro/quadrant
 */
router.get('/quadrant', async (req, res) => {
  try {
    const { quadrantFilter, minScore, search, sortField = 'confidenceScore', sortDir = 'desc' } = req.query;
    const fullList = await getEnrichedFnoStocks();

    // Persistent global universe counts
    const counts = {
      total: fullList.length,
      longBuildup: fullList.filter(s => s.quadrant === 'LONG_BUILDUP').length,
      shortBuildup: fullList.filter(s => s.quadrant === 'SHORT_BUILDUP').length,
      shortCovering: fullList.filter(s => s.quadrant === 'SHORT_COVERING').length,
      longUnwinding: fullList.filter(s => s.quadrant === 'LONG_UNWINDING').length
    };

    let list = [...fullList];
    if (quadrantFilter && quadrantFilter !== 'ALL') {
      list = list.filter(s => s.quadrant === quadrantFilter);
    }
    if (minScore) {
      list = list.filter(s => s.confidenceScore >= Number(minScore));
    }
    if (search) {
      const q = search.trim().toUpperCase();
      list = list.filter(s => s.symbol.includes(q) || s.name.toUpperCase().includes(q));
    }

    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'confidenceScore') {
        aVal = a.confidenceScore;
        bVal = b.confidenceScore;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    res.json({
      total: fullList.length,
      counts,
      stocks: list,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quadrant data', message: err.message });
  }
});

/**
 * GET /api/pro/vwap
 */
router.get('/vwap', async (req, res) => {
  try {
    const { statusFilter, search, sortField = 'vwapDistance', sortDir = 'desc' } = req.query;
    const fullList = await getEnrichedFnoStocks();

    const counts = {
      total: fullList.length,
      sweetSpotLong: fullList.filter(s => s.vwapData?.status === 'SWEET_SPOT_LONG').length,
      sweetSpotShort: fullList.filter(s => s.vwapData?.status === 'SWEET_SPOT_SHORT').length,
      overextendedLong: fullList.filter(s => s.vwapData?.status === 'OVEREXTENDED_LONG').length,
      overextendedShort: fullList.filter(s => s.vwapData?.status === 'OVEREXTENDED_SHORT').length,
      aboveVwap: fullList.filter(s => s.vwapData?.isAboveVwap).length,
      belowVwap: fullList.filter(s => !s.vwapData?.isAboveVwap).length
    };

    let list = [...fullList];
    if (statusFilter && statusFilter !== 'ALL') {
      list = list.filter(s => s.vwapData?.status === statusFilter);
    }
    if (search) {
      const q = search.trim().toUpperCase();
      list = list.filter(s => s.symbol.includes(q) || s.name.toUpperCase().includes(q));
    }

    list.sort((a, b) => {
      let aVal = a.vwapData?.distancePct || 0;
      let bVal = b.vwapData?.distancePct || 0;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    res.json({
      total: fullList.length,
      counts,
      stocks: list,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vwap data', message: err.message });
  }
});

/**
 * GET /api/pro/orb
 */
router.get('/orb', async (req, res) => {
  try {
    const { statusFilter, search, sortField = 'breakoutDistance', sortDir = 'desc' } = req.query;
    const fullList = await getEnrichedFnoStocks();

    const counts = {
      total: fullList.length,
      breakoutUp: fullList.filter(s => s.orbData?.status === 'BREAKOUT_UP').length,
      breakdownDown: fullList.filter(s => s.orbData?.status === 'BREAKDOWN_DOWN').length,
      insideRange: fullList.filter(s => s.orbData?.status === 'INSIDE_RANGE').length
    };

    let list = [...fullList];
    if (statusFilter && statusFilter !== 'ALL') {
      list = list.filter(s => s.orbData?.status === statusFilter);
    }
    if (search) {
      const q = search.trim().toUpperCase();
      list = list.filter(s => s.symbol.includes(q) || s.name.toUpperCase().includes(q));
    }

    list.sort((a, b) => {
      let aVal = a.orbData?.breakoutDistancePct || 0;
      let bVal = b.orbData?.breakoutDistancePct || 0;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    res.json({
      total: fullList.length,
      counts,
      stocks: list,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orb data', message: err.message });
  }
});

/**
 * GET /api/pro/rvol (Feature 4: Relative Volume)
 */
router.get('/rvol', async (req, res) => {
  try {
    const { badgeFilter, search, sortField = 'rvol', sortDir = 'desc' } = req.query;
    const fullList = await getEnrichedFnoStocks();

    // Persistent global counts across whole universe
    const counts = {
      total: fullList.length,
      veryHigh: fullList.filter(s => s.rvolData?.badge === 'VERY_HIGH').length,
      high: fullList.filter(s => s.rvolData?.badge === 'HIGH').length,
      aboveAvg: fullList.filter(s => s.rvolData?.badge === 'ABOVE_AVG').length,
      low: fullList.filter(s => s.rvolData?.badge === 'LOW').length,
      normal: fullList.filter(s => s.rvolData?.badge === 'NORMAL').length
    };

    let list = [...fullList];
    if (badgeFilter && badgeFilter !== 'ALL') {
      list = list.filter(s => s.rvolData?.badge === badgeFilter);
    }
    if (search) {
      const q = search.trim().toUpperCase();
      list = list.filter(s => s.symbol.includes(q) || s.name.toUpperCase().includes(q));
    }

    list.sort((a, b) => {
      let aVal = a.rvolData?.rvol || 0;
      let bVal = b.rvolData?.rvol || 0;
      if (sortField === 'rvolConfidence') {
        aVal = a.rvolConfidence?.score || 0;
        bVal = b.rvolConfidence?.score || 0;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    res.json({
      total: fullList.length,
      counts,
      stocks: list,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rvol data', message: err.message });
  }
});

/**
 * GET /api/pro/sector (Feature 5: Sector Tailwind & RS)
 */
router.get('/sector', async (req, res) => {
  try {
    const { sectorFilter, onlyAligned, search, sortField = 'rsScore', sortDir = 'desc' } = req.query;
    const fullList = await getEnrichedFnoStocks();
    const snapshot = await proxyClient.fetchSnapshot();
    const sectorMap = loadSectorMap();

    const counts = {
      total: fullList.length,
      alignedBullish: fullList.filter(s => s.sectorData?.alignmentStatus === 'ALIGNED_BULLISH').length,
      alignedBearish: fullList.filter(s => s.sectorData?.alignmentStatus === 'ALIGNED_BEARISH').length,
      againstSector: fullList.filter(s => s.sectorData?.alignmentStatus === 'AGAINST_SECTOR').length,
      rsLeaders: fullList.filter(s => s.sectorData?.rsBadge === 'RS_LEADER').length,
      rsLaggards: fullList.filter(s => s.sectorData?.rsBadge === 'RS_LAGGARD').length
    };

    let list = [...fullList];
    if (sectorFilter && sectorFilter !== 'ALL') {
      list = list.filter(s => s.sectorData?.parentSector === sectorFilter);
    }
    if (onlyAligned === 'true') {
      list = list.filter(s => s.sectorData?.isAligned);
    }
    if (search) {
      const q = search.trim().toUpperCase();
      list = list.filter(s => s.symbol.includes(q) || s.name.toUpperCase().includes(q));
    }

    list.sort((a, b) => {
      let aVal = a.sectorData?.rsScore || 0;
      let bVal = b.sectorData?.rsScore || 0;
      if (sortField === 'sectorConfidence') {
        aVal = a.sectorConfidence?.score || 0;
        bVal = b.sectorConfidence?.score || 0;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Group sectors with performance
    const sectorsSummary = Object.keys(sectorMap).map(sectorName => {
      const idx = (snapshot?.indices || []).find(i => (i.name || '').toUpperCase().includes(sectorName.replace('NIFTY ', '')));
      return {
        name: sectorName,
        change: idx ? Number(idx.pc || 0) : 0,
        stockCount: fullList.filter(s => s.sectorData?.parentSector === sectorName).length
      };
    });

    res.json({
      total: fullList.length,
      counts,
      stocks: list,
      sectorsSummary,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sector data', message: err.message });
  }
});

/**
 * POST /api/pro/sector/map (Update Sector Map)
 */
router.post('/sector/map', (req, res) => {
  try {
    saveSectorMap(req.body);
    res.json({ success: true, message: 'Sector map updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save sector map', message: err.message });
  }
});

/**
 * POST /api/pro/risk-plan (Feature 6: Trade Planning Engine)
 */
router.post('/risk-plan', async (req, res) => {
  try {
    const { 
      symbol, 
      direction = 'LONG', 
      slMethod = 'SMART_PREDICTED', 
      manualSlPrice = null,
      capital = 100000, 
      riskAmount = 2000,
      target1Multiplier = 1.5,
      target2Multiplier = 2.0
    } = req.body;

    const list = await getEnrichedFnoStocks();
    const targetStock = list.find(s => s.symbol === symbol || s.tradingsymbol === symbol);

    if (!targetStock) {
      return res.status(404).json({ error: `Stock ${symbol} not found in F&O list` });
    }

    const plan = planTrade({
      stock: targetStock,
      direction,
      slMethod,
      manualSlPrice,
      capital: Number(capital),
      riskAmount: Number(riskAmount),
      target1Multiplier: Number(target1Multiplier) || 1.5,
      target2Multiplier: Number(target2Multiplier) || 2.0
    });

    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate risk plan', message: err.message });
  }
});

/**
 * GET /api/pro/basket (Feature 6: Basket Storage)
 */
router.get('/basket', (req, res) => {
  try {
    const basket = loadBasket();
    res.json(basket);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load basket' });
  }
});

/**
 * POST /api/pro/basket (Save Basket)
 */
router.post('/basket', (req, res) => {
  try {
    const data = {
      trades: req.body.trades || [],
      lastSaved: new Date().toISOString()
    };
    saveBasket(data);
    res.json({ success: true, basket: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save basket' });
  }
});

/**
 * GET /api/pro/derivatives (Feature 7: Derivatives Edge)
 */
router.get('/derivatives', async (req, res) => {
  try {
    const { pcrFilter = 'ALL', search = '', wallAlertOnly = 'false', sortField = 'pcr', sortDir = 'desc' } = req.query;
    const settings = getSettings();
    const fullList = await getEnrichedFnoStocks();
    const snapshot = await proxyClient.fetchSnapshot();

    // 1. Calculate India VIX Regime
    const vixItem = (snapshot?.indices || []).find(i => 
      (i.name || '').toUpperCase().includes('VIX') || (i.tradingsymbol || '').toUpperCase().includes('VIX')
    );
    const rawVixVal = vixItem ? Number(vixItem.ltp || 14.2) : 14.2;
    const vix = classifyVix(rawVixVal);

    // 2. Persistent global counts across whole universe
    const counts = {
      total: fullList.length,
      overbought: fullList.filter(s => s.pcrStatus === 'OVERBOUGHT').length,
      oversold: fullList.filter(s => s.pcrStatus === 'OVERSOLD').length,
      balanced: fullList.filter(s => s.pcrStatus === 'BALANCED').length,
      nearCallWall: fullList.filter(s => s.derivativesData?.distToCallWallPct >= 0 && s.derivativesData?.distToCallWallPct <= 1.0).length,
      nearPutWall: fullList.filter(s => s.derivativesData?.distToPutWallPct >= 0 && s.derivativesData?.distToPutWallPct <= 1.0).length,
      wallAlerts: fullList.filter(s => s.wallWarning).length
    };

    // 3. Compute aggregate market PCR
    const totalPutOi = fullList.reduce((acc, s) => acc + (s.derivativesData?.putWallOi || 0), 0);
    const totalCallOi = fullList.reduce((acc, s) => acc + (s.derivativesData?.callWallOi || 0), 0);
    const marketPcr = calculatePcr(totalPutOi, totalCallOi, settings.derivatives || {});

    // 4. Apply query filters to stock list
    let list = [...fullList];
    if (pcrFilter && pcrFilter !== 'ALL') {
      list = list.filter(s => s.pcrStatus === pcrFilter);
    }
    if (wallAlertOnly === 'true') {
      list = list.filter(s => Boolean(s.wallWarning));
    }
    if (search) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => 
        (s.symbol && s.symbol.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q))
      );
    }

    // 5. Sorting
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'distToCallWall') {
        valA = a.derivativesData?.distToCallWallPct || 999;
        valB = b.derivativesData?.distToCallWallPct || 999;
      } else if (sortField === 'distToPutWall') {
        valA = a.derivativesData?.distToPutWallPct || 999;
        valB = b.derivativesData?.distToPutWallPct || 999;
      }
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      return sortDir === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    res.json({
      vix,
      marketPcr,
      total: fullList.length,
      counts,
      stocks: list,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch derivatives edge data', message: err.message });
  }
});

/**
 * GET /api/pro/candles (Feature 8: Interactive Candlestick Charts)
 */
router.get('/candles', async (req, res) => {
  try {
    const { symbol = 'RELIANCE', resolution = '5m' } = req.query;
    const candleData = await getStockCandles(symbol, resolution);
    res.json({
      success: true,
      ...candleData,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch candle data', message: err.message });
  }
});

module.exports = router;

