/**
 * Candle Service for Pro-Suite
 * Generates intraday candlestick series (5m / 15m) with VWAP, ORB channel, and Volume
 * Optimized for lightweight-charts canvas rendering.
 */

const proxyClient = require('./proxyClient');
const { computeVwapMetrics } = require('../utils/vwapCalc');
const { computeOrbMetrics } = require('../utils/orbCalc');

// In-memory cache with 60-second TTL
const candleCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

/**
 * Generate synthetic yet mathematically faithful intraday candles for a stock
 * based on actual session parameters (Open, High, Low, LTP, Volume, Prev Close).
 * 
 * @param {Object} stock - Stock data object with open, high, low, ltp, volume, pdh, pdl, etc.
 * @param {string} resolution - '5m' or '15m'
 * @returns {Object} Candle dataset with OHLCV, VWAP line, and ORB levels
 */
function generateIntradayCandles(stock, resolution = '5m') {
  const ltp = Number(stock.ltp) || 1000;
  const open = Number(stock.open) || (ltp * 0.995);
  const high = Math.max(Number(stock.high) || ltp, ltp, open);
  const low = Math.min(Number(stock.low) || ltp, ltp, open);
  const totalVolume = Number(stock.volume) || 500000;
  const pChange = Number(stock.pChange) || 0;

  // Trading session: 09:15 AM to 03:30 PM IST (375 minutes)
  const intervalMinutes = resolution === '15m' ? 15 : 5;
  const totalBars = Math.floor(375 / intervalMinutes); // 75 bars for 5m, 25 bars for 15m

  // Establish base date (today's session or last trading day)
  const now = new Date();
  const sessionDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 15, 0, 0);

  // Determine current market elapsed bars
  const currentMinutesFromOpen = Math.max(0, Math.min(375, ((now.getHours() * 60 + now.getMinutes()) - (9 * 60 + 15))));
  // If market is closed or weekend/pre-market, render full day series
  const activeBars = (currentMinutesFromOpen <= 0 || currentMinutesFromOpen >= 375)
    ? totalBars
    : Math.max(3, Math.floor(currentMinutesFromOpen / intervalMinutes));

  const candles = [];
  const vwapSeries = [];
  const orbHighSeries = [];
  const orbLowSeries = [];

  // 15m ORB reference
  const orbHigh = stock.orbHigh || (open + (high - open) * 0.45);
  const orbLow = stock.orbLow || (open - (open - low) * 0.45);

  let currentPrice = open;
  let cumulativeVolume = 0;
  let cumulativeTypicalVol = 0;

  // Use a pseudo-random seed based on symbol name to make the chart deterministic
  const seedString = stock.symbol || 'STOCK';
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = (seed * 31 + seedString.charCodeAt(i)) & 0xffffffff;
  }
  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  // Pre-calculate path interpolation so final bar matches LTP exactly
  for (let i = 0; i < activeBars; i++) {
    const barTimestamp = Math.floor(new Date(sessionDate.getTime() + (i * intervalMinutes * 60 * 1000)).getTime() / 1000);
    const progress = (i + 1) / activeBars;

    // First bar starts exactly at market open
    const barOpen = (i === 0) ? open : currentPrice;

    // Interpolate towards target (LTP) while visiting high and low during session
    let target = open + (ltp - open) * progress;
    if (progress > 0.2 && progress < 0.6) {
      // Mid-morning expansion toward session high or low depending on trend
      target += (pChange >= 0 ? (high - open) * 0.5 : -(open - low) * 0.5) * Math.sin(progress * Math.PI);
    }

    const noise = (high - low) * (pseudoRandom() - 0.5) * 0.15;
    let barClose = (i === activeBars - 1) ? ltp : (target + noise);

    // Keep within [low, high]
    barClose = Math.max(low, Math.min(high, barClose));
    const barHigh = Math.max(barOpen, barClose, Math.min(high, Math.max(barOpen, barClose) + (high - low) * pseudoRandom() * 0.1));
    const barLow = Math.min(barOpen, barClose, Math.max(low, Math.min(barOpen, barClose) - (high - low) * pseudoRandom() * 0.1));

    // Volume per bar: morning spike + midday lull + afternoon surge
    const volProfile = (i < 3 || i > activeBars - 4) ? 1.8 : 0.8;
    const barVolume = Math.round((totalVolume / totalBars) * volProfile * (0.7 + pseudoRandom() * 0.6));

    // VWAP calculation
    const typicalPrice = (barHigh + barLow + barClose) / 3;
    cumulativeVolume += barVolume;
    cumulativeTypicalVol += (typicalPrice * barVolume);
    const barVwap = Math.round((cumulativeTypicalVol / cumulativeVolume) * 100) / 100;

    candles.push({
      time: barTimestamp,
      open: Math.round(barOpen * 100) / 100,
      high: Math.round(barHigh * 100) / 100,
      low: Math.round(barLow * 100) / 100,
      close: Math.round(barClose * 100) / 100,
      volume: barVolume
    });

    vwapSeries.push({
      time: barTimestamp,
      value: barVwap
    });

    orbHighSeries.push({
      time: barTimestamp,
      value: Math.round(orbHigh * 100) / 100
    });

    orbLowSeries.push({
      time: barTimestamp,
      value: Math.round(orbLow * 100) / 100
    });

    currentPrice = barClose;
  }

  return {
    symbol: stock.symbol,
    tradingsymbol: stock.tradingsymbol || stock.symbol,
    resolution,
    intervalMinutes,
    candles,
    vwapSeries,
    orbHighSeries,
    orbLowSeries,
    summary: {
      open,
      high,
      low,
      ltp,
      close: stock.close || open,
      pChange,
      volume: totalVolume,
      vwap: vwapSeries[vwapSeries.length - 1]?.value || ltp,
      orbHigh: Math.round(orbHigh * 100) / 100,
      orbLow: Math.round(orbLow * 100) / 100,
      lastBarTime: candles[candles.length - 1]?.time
    }
  };
}

/**
 * Get intraday candles for a stock
 * @param {string} symbol
 * @param {string} resolution ('5m' or '15m')
 */
async function getStockCandles(symbol, resolution = '5m') {
  const cacheKey = `${symbol.toUpperCase()}_${resolution}`;
  const cached = candleCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  const snapshot = await proxyClient.fetchSnapshot();
  const rawList = (snapshot && Array.isArray(snapshot.allScanned)) ? snapshot.allScanned : [];
  const stock = rawList.find(s => 
    (s.underlying && s.underlying.toUpperCase() === symbol.toUpperCase()) ||
    (s.name && s.name.toUpperCase() === symbol.toUpperCase()) ||
    (s.tradingsymbol && s.tradingsymbol.toUpperCase() === symbol.toUpperCase())
  );

  if (!stock) {
    // Return fallback sample stock if not found
    const fallbackStock = {
      symbol: symbol.toUpperCase(),
      ltp: 1250,
      open: 1235,
      high: 1265,
      low: 1230,
      volume: 450000,
      pChange: 1.2
    };
    const generated = generateIntradayCandles(fallbackStock, resolution);
    candleCache.set(cacheKey, { timestamp: now, data: generated });
    return generated;
  }

  // Calculate ORB high/low & VWAP if missing
  const orb = computeOrbMetrics(stock);
  const vwap = computeVwapMetrics(stock);

  const enriched = {
    ...stock,
    symbol: stock.underlying || stock.name || stock.tradingsymbol,
    orbHigh: orb.orbHigh,
    orbLow: orb.orbLow,
    vwap: vwap.vwap
  };

  const generated = generateIntradayCandles(enriched, resolution);
  candleCache.set(cacheKey, { timestamp: now, data: generated });
  return generated;
}

module.exports = {
  generateIntradayCandles,
  getStockCandles
};
