const marketSession = require('./marketSession');
const instrumentMaster = require('./instrumentMaster');
const logger = require('../utils/logger');

// Supported Intervals Mapping
const ANGEL_INTERVAL_MAP = {
  '1m': 'ONE_MINUTE',
  '3m': 'THREE_MINUTE',
  '5m': 'FIVE_MINUTE',
  '10m': 'TEN_MINUTE',
  '15m': 'FIFTEEN_MINUTE',
  '30m': 'THIRTY_MINUTE',
  '45m': 'FIFTEEN_MINUTE', // Aggregated 3x
  '1h': 'ONE_HOUR',
  '2h': 'ONE_HOUR',       // Aggregated 2x
  '4h': 'ONE_HOUR',       // Aggregated 4x
  '1d': 'ONE_DAY',
  '1w': 'ONE_DAY',        // Aggregated weekly
  '1M': 'ONE_DAY'         // Aggregated monthly
};

const DEFAULT_BREAKOUT_CONFIG = {
  // Lookback duration
  lookbackValue: 20,
  lookbackUnit: 'DAYS', // 'MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS'

  // Candle timeframe
  timeframe: '15m', // '1m', '3m', '5m', '10m', '15m', '30m', '45m', '1h', '2h', '4h', '1d', '1w', '1M'

  // Volume
  minVolumeMultiplier: 2.0, // 2.0x
  volumeMode: 'TIME_ADJUSTED', // 'STANDARD' | 'TIME_ADJUSTED'

  // Signal type & display
  signalType: 'BOTH', // 'BREAKOUT' | 'BREAKDOWN' | 'BOTH'
  signalDisplay: 'BOTH', // 'LIVE' | 'CONFIRMED' | 'BOTH'

  // Universe
  marketUniverse: 'BOTH', // 'STOCKS' | 'INDICES' | 'BOTH'

  // Index Volume Source
  indexVolumeSource: 'FUTURES', // 'FUTURES' | 'PRICE_ONLY'

  // Scanner status
  enabled: true,
  autoScanIntervalMs: 10000 // 10 seconds
};

class BreakoutEngine {
  constructor() {
    this.config = { ...DEFAULT_BREAKOUT_CONFIG };
    this.dataSource = null;

    // Cache historical levels: token -> { resistance, support, avgVolume, candlesCount, fromDate, toDate, cachedAt }
    this.historicalCache = {};

    // Live forming candles: token -> { open, high, low, close, volume, startTime, endTime }
    this.currentCandles = {};

    // Signals map: signalId -> signalObj
    this.signals = new Map();

    // Scan metrics
    this.lastScanTime = null;
    this.isScanning = false;
    this.totalScannedCount = 0;
    this.scanTimer = null;
  }

  setDataSource(ds) {
    this.dataSource = ds;
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(newConfig) {
    let needsRecalculation = false;

    if (newConfig.lookbackValue !== undefined) {
      const val = parseInt(newConfig.lookbackValue);
      if (!isNaN(val) && val > 0 && val !== this.config.lookbackValue) {
        this.config.lookbackValue = val;
        needsRecalculation = true;
      }
    }

    if (newConfig.lookbackUnit !== undefined && newConfig.lookbackUnit !== this.config.lookbackUnit) {
      this.config.lookbackUnit = String(newConfig.lookbackUnit).toUpperCase();
      needsRecalculation = true;
    }

    if (newConfig.timeframe !== undefined && newConfig.timeframe !== this.config.timeframe) {
      this.config.timeframe = String(newConfig.timeframe);
      needsRecalculation = true;
    }

    if (newConfig.minVolumeMultiplier !== undefined) {
      const mult = parseFloat(newConfig.minVolumeMultiplier);
      if (!isNaN(mult) && mult > 0) {
        this.config.minVolumeMultiplier = mult;
      }
    }

    if (newConfig.volumeMode !== undefined) {
      this.config.volumeMode = String(newConfig.volumeMode).toUpperCase();
    }

    if (newConfig.signalType !== undefined) {
      this.config.signalType = String(newConfig.signalType).toUpperCase();
    }

    if (newConfig.signalDisplay !== undefined) {
      this.config.signalDisplay = String(newConfig.signalDisplay).toUpperCase();
    }

    if (newConfig.marketUniverse !== undefined) {
      if (this.config.marketUniverse !== newConfig.marketUniverse) {
        needsRecalculation = true;
      }
      this.config.marketUniverse = String(newConfig.marketUniverse).toUpperCase();
    }

    if (newConfig.indexVolumeSource !== undefined) {
      this.config.indexVolumeSource = String(newConfig.indexVolumeSource).toUpperCase();
    }

    if (newConfig.enabled !== undefined) {
      this.config.enabled = !!newConfig.enabled;
    }

    logger.info(`BreakoutEngine config updated. Recalculate historical cache: ${needsRecalculation}`);

    if (needsRecalculation) {
      this.historicalCache = {};
      this.signals.clear();
      this.runScanCycle(true);
    }
  }

  /**
   * Calculate historical window boundaries (excluding the current incomplete candle)
   */
  getHistoricalTimeWindow() {
    const { lookbackValue, lookbackUnit, timeframe } = this.config;
    const now = new Date();
    const lastCompletedTradingDay = marketSession.getLastCompletedTradingDay();
    const isMarketOpen = marketSession.isMarketOpen();

    let fromDateStr = '';
    let toDateStr = '';

    // End date/time: right before current forming candle
    if (isMarketOpen) {
      const istTime = marketSession.getISTTime();
      const currentCandleStart = this.getCurrentCandleBoundary(now, timeframe);
      toDateStr = this.formatDateAngel(currentCandleStart.startTime);
    } else {
      toDateStr = `${lastCompletedTradingDay} 15:30`;
    }

    // Start date/time based on unit
    switch (lookbackUnit) {
      case 'MINUTES': {
        const ms = lookbackValue * 60 * 1000;
        const from = new Date(now.getTime() - ms);
        fromDateStr = this.formatDateAngel(from);
        break;
      }
      case 'HOURS': {
        const ms = lookbackValue * 60 * 60 * 1000;
        const from = new Date(now.getTime() - ms);
        fromDateStr = this.formatDateAngel(from);
        break;
      }
      case 'WEEKS': {
        // ~5 trading sessions per week
        const tradingDays = marketSession.getPreviousTradingDays(lastCompletedTradingDay, lookbackValue * 5);
        const startDay = tradingDays[0] || lastCompletedTradingDay;
        fromDateStr = `${startDay} 09:15`;
        break;
      }
      case 'MONTHS': {
        // ~21 trading sessions per month
        const tradingDays = marketSession.getPreviousTradingDays(lastCompletedTradingDay, lookbackValue * 21);
        const startDay = tradingDays[0] || lastCompletedTradingDay;
        fromDateStr = `${startDay} 09:15`;
        break;
      }
      case 'DAYS':
      default: {
        const tradingDays = marketSession.getPreviousTradingDays(lastCompletedTradingDay, lookbackValue);
        const startDay = tradingDays[0] || lastCompletedTradingDay;
        fromDateStr = `${startDay} 09:15`;
        break;
      }
    }

    return { fromDateStr, toDateStr };
  }

  getCurrentCandleBoundary(date, timeframe) {
    const d = new Date(date);
    const ms = d.getTime();

    // Timeframe minutes
    let tfMinutes = 15;
    if (timeframe.endsWith('m')) tfMinutes = parseInt(timeframe);
    else if (timeframe.endsWith('h')) tfMinutes = parseInt(timeframe) * 60;
    else if (timeframe === '1d') tfMinutes = 375; // trading session length

    const tfMs = tfMinutes * 60 * 1000;
    const startTimeMs = Math.floor(ms / tfMs) * tfMs;
    const endTimeMs = startTimeMs + tfMs;

    return {
      startTime: new Date(startTimeMs),
      endTime: new Date(endTimeMs),
      totalMinutes: tfMinutes,
      elapsedMinutes: Math.max(1, (ms - startTimeMs) / (60 * 1000))
    };
  }

  formatDateAngel(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  /**
   * Aggregate candles if requested timeframe is a multiple of an Angel native interval
   */
  aggregateCandles(rawCandles, timeframe) {
    if (!rawCandles || rawCandles.length === 0) return [];

    let factor = 1;
    if (timeframe === '45m') factor = 3;  // 3 x 15m
    else if (timeframe === '2h') factor = 2; // 2 x 1h
    else if (timeframe === '4h') factor = 4; // 4 x 1h
    else if (timeframe === '1w') factor = 5; // 5 x 1d

    if (factor === 1) {
      return rawCandles.map(c => ({
        timestamp: c[0],
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5] || 0
      }));
    }

    const aggregated = [];
    for (let i = 0; i < rawCandles.length; i += factor) {
      const chunk = rawCandles.slice(i, i + factor);
      if (chunk.length === 0) continue;

      const open = chunk[0][1];
      const close = chunk[chunk.length - 1][4];
      let high = -Infinity;
      let low = Infinity;
      let volume = 0;

      for (const c of chunk) {
        if (c[2] > high) high = c[2];
        if (c[3] < low) low = c[3];
        volume += (c[5] || 0);
      }

      aggregated.push({
        timestamp: chunk[0][0],
        open,
        high,
        low,
        close,
        volume
      });
    }

    return aggregated;
  }

  /**
   * Get target scanning universe based on config
   */
  getTargetUniverse() {
    const universe = [];
    const fnoStocks = instrumentMaster.getCashUniverse(true); // Underlying equity instruments for stocks
    const fnoContracts = instrumentMaster.getFnoUniverse();
    const indices = instrumentMaster.getIndices();

    const fnoMap = {};
    for (const f of fnoContracts) {
      fnoMap[f.name] = f;
    }

    if (this.config.marketUniverse === 'STOCKS' || this.config.marketUniverse === 'BOTH') {
      for (const s of fnoStocks) {
        const matchingFut = fnoMap[s.name];
        universe.push({
          token: s.instrument_key,
          symbol: s.symbol,
          tradingsymbol: s.tradingsymbol,
          name: s.name,
          exchange: 'NSE',
          exchangeType: 1,
          type: 'STOCK',
          isIndex: false,
          futuresToken: matchingFut ? matchingFut.instrument_key : null,
          futuresSymbol: matchingFut ? matchingFut.tradingsymbol : null
        });
      }
    }

    if (this.config.marketUniverse === 'INDICES' || this.config.marketUniverse === 'BOTH') {
      for (const idx of indices) {
        universe.push({
          token: idx.instrument_key,
          symbol: idx.name,
          tradingsymbol: idx.tradingsymbol,
          name: idx.name,
          exchange: 'NSE',
          exchangeType: 1,
          type: 'INDEX',
          isIndex: true,
          futuresToken: idx.futuresToken || null,
          futuresSymbol: idx.futuresSymbol || null
        });
      }
    }

    return universe;
  }

  /**
   * Fetch historical candles and calculate reference levels
   */
  async getOrFetchHistoricalLevels(inst) {
    const { fromDateStr, toDateStr } = this.getHistoricalTimeWindow();
    const cacheKey = `${inst.token}_${this.config.timeframe}_${fromDateStr}_${toDateStr}`;

    // Return cached if fresh (valid for 5 minutes)
    if (this.historicalCache[cacheKey] && (Date.now() - this.historicalCache[cacheKey].cachedAt < 300000)) {
      return this.historicalCache[cacheKey];
    }

    if (!this.dataSource || !this.dataSource.getHistoricalCandles) {
      return null;
    }

    const angelInterval = ANGEL_INTERVAL_MAP[this.config.timeframe] || 'FIFTEEN_MINUTE';

    try {
      const rawCandles = await this.dataSource.getHistoricalCandles(
        inst.token,
        inst.exchange,
        angelInterval,
        fromDateStr,
        toDateStr
      );

      if (!rawCandles || rawCandles.length === 0) {
        return null;
      }

      const candles = this.aggregateCandles(rawCandles, this.config.timeframe);
      if (candles.length === 0) return null;

      let resistance = -Infinity;
      let support = Infinity;
      let totalVolume = 0;

      for (const c of candles) {
        if (c.high > resistance) resistance = c.high;
        if (c.low < support) support = c.low;
        totalVolume += c.volume;
      }

      const avgVolume = Math.round(totalVolume / candles.length);

      const levelData = {
        resistance: Math.round(resistance * 100) / 100,
        support: Math.round(support * 100) / 100,
        avgVolume,
        candlesCount: candles.length,
        candles,
        fromDate: fromDateStr,
        toDate: toDateStr,
        cachedAt: Date.now()
      };

      this.historicalCache[cacheKey] = levelData;
      return levelData;
    } catch (err) {
      logger.error(`BreakoutEngine candle fetch failed for ${inst.symbol} (${inst.token}):`, err.message);
      return null;
    }
  }

  /**
   * Run one complete scan cycle across eligible universe
   */
  async runScanCycle(force = false) {
    if (this.isScanning && !force) return;
    if (!this.config.enabled) return;
    if (!this.dataSource || !this.dataSource.getMarketQuotes) return;

    this.isScanning = true;
    const startTime = Date.now();
    const universe = this.getTargetUniverse();
    this.totalScannedCount = universe.length;

    try {
      // 1. Fetch current live market quotes for all instruments in universe
      const quoteInstruments = universe.map(u => ({
        instrument_key: u.token,
        exchange: u.exchange
      }));

      // If futures volume is requested for indices, include their futures contracts
      const futTokens = [];
      if (this.config.indexVolumeSource === 'FUTURES') {
        for (const u of universe) {
          if (u.isIndex && u.futuresToken) {
            futTokens.push({ instrument_key: u.futuresToken, exchange: 'NFO' });
          }
        }
      }

      const allToFetch = [...quoteInstruments, ...futTokens];
      const quotes = await this.dataSource.getMarketQuotes(allToFetch, 'FULL');
      const quoteMap = {};
      for (const q of quotes) {
        if (q.symbolToken) quoteMap[q.symbolToken] = q;
      }

      // 2. Evaluate breakout / breakdown for each instrument
      for (const inst of universe) {
        const q = quoteMap[inst.token];
        if (!q || !q.ltp || q.ltp <= 0) continue;

        const livePrice = parseFloat(q.ltp);
        const prevClose = parseFloat(q.close) || livePrice;
        const priceChangePct = prevClose > 0 ? Math.round(((livePrice - prevClose) / prevClose) * 10000) / 100 : 0;

        // Determine current candle volume
        let currentCandleVolume = parseInt(q.tradeVolume) || 0;
        let volumeSourceLabel = inst.isIndex ? 'Spot (Simulated)' : 'Cash Underlying';

        if (inst.isIndex) {
          if (this.config.indexVolumeSource === 'FUTURES' && inst.futuresToken && quoteMap[inst.futuresToken]) {
            currentCandleVolume = parseInt(quoteMap[inst.futuresToken].tradeVolume) || 0;
            volumeSourceLabel = `Futures Volume (${inst.futuresSymbol || 'Active FUT'})`;
          } else {
            volumeSourceLabel = 'Price-Only (Volume Disabled)';
          }
        }

        // Fetch / compute historical resistance, support, and average volume
        const histLevels = await this.getOrFetchHistoricalLevels(inst);
        if (!histLevels || histLevels.resistance <= 0) continue;

        const { resistance, support, avgVolume } = histLevels;

        // Calculate Volume Ratio
        let effectiveAvgVol = avgVolume;
        if (this.config.volumeMode === 'TIME_ADJUSTED') {
          const boundary = this.getCurrentCandleBoundary(new Date(), this.config.timeframe);
          const elapsedFraction = Math.max(0.08, Math.min(1.0, boundary.elapsedMinutes / boundary.totalMinutes));
          effectiveAvgVol = Math.max(1, Math.round(avgVolume * elapsedFraction));
        }

        const volumeRatio = effectiveAvgVol > 0 ? Math.round((currentCandleVolume / effectiveAvgVol) * 100) / 100 : 0;
        const volumeConfirmed = inst.isIndex && this.config.indexVolumeSource === 'PRICE_ONLY' 
          ? true 
          : volumeRatio >= this.config.minVolumeMultiplier;

        // Signal ID format
        const signalId = `${inst.token}_${this.config.timeframe}`;
        const existingSignal = this.signals.get(signalId);

        // A. BULLISH BREAKOUT Check
        const isPriceBreakout = livePrice > resistance;
        const isBullishQualified = (this.config.signalType === 'BREAKOUT' || this.config.signalType === 'BOTH') && isPriceBreakout;

        // B. BEARISH BREAKDOWN Check
        const isPriceBreakdown = livePrice < support;
        const isBearishQualified = (this.config.signalType === 'BREAKDOWN' || this.config.signalType === 'BOTH') && isPriceBreakdown;

        const nowTs = Date.now();

        if (isBullishQualified && volumeConfirmed) {
          const distancePct = Math.round(((livePrice - resistance) / resistance) * 10000) / 100;
          this.signals.set(signalId, {
            id: signalId,
            symbol: inst.symbol,
            tradingsymbol: inst.tradingsymbol,
            name: inst.name,
            instrumentType: inst.type,
            exchange: inst.exchange,
            token: inst.token,
            signalType: 'BULLISH_BREAKOUT',
            signalStatus: marketSession.isMarketOpen() ? 'LIVE' : 'CONFIRMED',
            livePrice,
            breakoutLevel: resistance,
            supportLevel: support,
            distancePct,
            currentVolume: currentCandleVolume,
            avgVolume,
            effectiveAvgVol,
            volumeRatio,
            minMultiplierRequired: this.config.minVolumeMultiplier,
            volumeMode: this.config.volumeMode,
            volumeSourceLabel,
            priceChangePct,
            timeframe: this.config.timeframe,
            lookbackValue: this.config.lookbackValue,
            lookbackUnit: this.config.lookbackUnit,
            detectedAt: existingSignal?.detectedAt || nowTs,
            lastUpdatedAt: nowTs
          });
        } else if (isBearishQualified && volumeConfirmed) {
          const distancePct = Math.round(((support - livePrice) / support) * 10000) / 100;
          this.signals.set(signalId, {
            id: signalId,
            symbol: inst.symbol,
            tradingsymbol: inst.tradingsymbol,
            name: inst.name,
            instrumentType: inst.type,
            exchange: inst.exchange,
            token: inst.token,
            signalType: 'BEARISH_BREAKDOWN',
            signalStatus: marketSession.isMarketOpen() ? 'LIVE' : 'CONFIRMED',
            livePrice,
            breakoutLevel: resistance,
            supportLevel: support,
            distancePct: -distancePct,
            currentVolume: currentCandleVolume,
            avgVolume,
            effectiveAvgVol,
            volumeRatio,
            minMultiplierRequired: this.config.minVolumeMultiplier,
            volumeMode: this.config.volumeMode,
            volumeSourceLabel,
            priceChangePct,
            timeframe: this.config.timeframe,
            lookbackValue: this.config.lookbackValue,
            lookbackUnit: this.config.lookbackUnit,
            detectedAt: existingSignal?.detectedAt || nowTs,
            lastUpdatedAt: nowTs
          });
        } else if (existingSignal && existingSignal.signalStatus === 'LIVE') {
          // If price pulled back before candle close, mark as INVALIDATED
          if ((existingSignal.signalType === 'BULLISH_BREAKOUT' && livePrice <= resistance) ||
              (existingSignal.signalType === 'BEARISH_BREAKDOWN' && livePrice >= support)) {
            existingSignal.signalStatus = 'INVALIDATED';
            existingSignal.invalidatedAt = nowTs;
            existingSignal.livePrice = livePrice;
            existingSignal.lastUpdatedAt = nowTs;
          }
        }
      }

      this.lastScanTime = Date.now();
    } catch (err) {
      logger.error('Breakout scan cycle error:', err.message);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Get all signals filtered according to user settings
   */
  getSignals(filterTab = 'ALL') {
    const list = Array.from(this.signals.values());

    let liveBreakouts = 0;
    let liveBreakdowns = 0;
    let confirmedBreakouts = 0;
    let confirmedBreakdowns = 0;

    for (const s of list) {
      if (s.signalType === 'BULLISH_BREAKOUT') {
        if (s.signalStatus === 'LIVE') liveBreakouts++;
        else if (s.signalStatus === 'CONFIRMED') confirmedBreakouts++;
      } else if (s.signalType === 'BEARISH_BREAKDOWN') {
        if (s.signalStatus === 'LIVE') liveBreakdowns++;
        else if (s.signalStatus === 'CONFIRMED') confirmedBreakdowns++;
      }
    }

    // Filter by tab
    let filtered = list;
    if (filterTab === 'LIVE_BREAKOUTS') {
      filtered = list.filter(s => s.signalType === 'BULLISH_BREAKOUT' && s.signalStatus === 'LIVE');
    } else if (filterTab === 'LIVE_BREAKDOWNS') {
      filtered = list.filter(s => s.signalType === 'BEARISH_BREAKDOWN' && s.signalStatus === 'LIVE');
    } else if (filterTab === 'CONFIRMED_BREAKOUTS') {
      filtered = list.filter(s => s.signalType === 'BULLISH_BREAKOUT' && s.signalStatus === 'CONFIRMED');
    } else if (filterTab === 'CONFIRMED_BREAKDOWNS') {
      filtered = list.filter(s => s.signalType === 'BEARISH_BREAKDOWN' && s.signalStatus === 'CONFIRMED');
    }

    // Filter by signalDisplay config
    if (this.config.signalDisplay === 'LIVE') {
      filtered = filtered.filter(s => s.signalStatus === 'LIVE');
    } else if (this.config.signalDisplay === 'CONFIRMED') {
      filtered = filtered.filter(s => s.signalStatus === 'CONFIRMED');
    }

    // Sort by volume ratio desc by default
    filtered.sort((a, b) => b.volumeRatio - a.volumeRatio);

    return {
      stats: {
        totalScanned: this.totalScannedCount,
        liveBreakouts,
        liveBreakdowns,
        confirmedBreakouts,
        confirmedBreakdowns,
        totalSignals: list.length,
        lastScanTime: this.lastScanTime,
        isScanning: this.isScanning,
        connectionStatus: this.dataSource?.getConnectionStatus ? this.dataSource.getConnectionStatus() : 'CONNECTED'
      },
      config: this.getConfig(),
      signals: filtered
    };
  }

  /**
   * Start auto scanning background loop
   */
  startAutoScan() {
    if (this.scanTimer) return;
    this.runScanCycle(true);
    this.scanTimer = setInterval(() => {
      this.runScanCycle(false);
    }, this.config.autoScanIntervalMs);
  }

  stopAutoScan() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }
}

const breakoutEngine = new BreakoutEngine();
module.exports = breakoutEngine;
