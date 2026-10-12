const logger = require('../utils/logger');
const marketSession = require('../services/marketSession');

// ==========================================
// ⚙️ SCANNER CONFIGURATION
// Fully mutable via API — no code edits needed
// ==========================================
const DEFAULT_CONFIG = {
  // Market Segment
  marketSegment: 'BOTH', // 'CASH', 'FNO', 'BOTH'

  // Scan Controls
  scanEnabled: true,
  scanStartTime: '09:00',
  scanEndTime: '15:30',
  timeFilterEnabled: true,

  // Price Change
  priceChangeEnabled: true,
  MIN_PCT_CHANGE: 0.5,
  MAX_PCT_CHANGE: 20.0,

  // Previous Day High/Low
  prevDayHighEnabled: false,
  prevDayLowEnabled: false,
  REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS: true,
  REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS: true,

  // Previous Month High/Low
  prevMonthHighEnabled: false,
  prevMonthLowEnabled: false,

  // Market Cap
  marketCapEnabled: false,
  minMarketCap: 0,
  maxMarketCap: 999999999,
  marketCapUnit: 'crore', // 'crore' or 'lakh_crore'

  // OI Filter
  oiFilterEnabled: false,
  MIN_OI_CHANGE_PCT: 5.0,
  MAX_OI_CHANGE_PCT: 500.0,
  oiPositiveOnly: false,
  oiNegativeOnly: false,
  minAbsoluteOI: 0,
  maxAbsoluteOI: 999999999,

  // Volume
  volumeFilterEnabled: false,
  minVolume: 0,

  // LTP
  ltpFilterEnabled: false,
  minLtp: 0,
  maxLtp: 999999,

  // Advance/Decline thresholds
  advDeclineEnabled: false,
  minAdvancing: 0,
  minDeclining: 0,
  advDeclineRatioThreshold: 0,

  // Sentiment thresholds
  sentimentEnabled: true,
  sentimentPositiveThreshold: 10,
  sentimentNegativeThreshold: -10,
  sentimentMinCoverage: 50,
};

let SCANNER_CONFIG = { ...DEFAULT_CONFIG };

// Load from env on startup
function loadConfigFromEnv() {
  const envMap = {
    MIN_PCT_CHANGE: parseFloat,
    MAX_PCT_CHANGE: parseFloat,
    MIN_OI_CHANGE_PCT: parseFloat,
    MAX_OI_CHANGE_PCT: parseFloat,
  };

  for (const [key, parser] of Object.entries(envMap)) {
    if (process.env[key] !== undefined) {
      SCANNER_CONFIG[key] = parser(process.env[key]);
    }
  }

  if (process.env.REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS !== undefined) {
    SCANNER_CONFIG.REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS = process.env.REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS !== 'false';
  }
  if (process.env.REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS !== undefined) {
    SCANNER_CONFIG.REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS = process.env.REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS !== 'false';
  }
}

loadConfigFromEnv();

// ==========================================

class MarketState {
  constructor() {
    // Universes
    this.universe = [];
    this.fnoUniverse = [];
    this.cashUniverse = [];
    this.indicesUniverse = [];

    // Market Data Maps keyed by instrument_key (token)
    this.ltpMap = {};
    this.closeMap = {};       // Previous day close (for % change)
    this.openMap = {};        // Today's open
    this.highMap = {};        // Today's high
    this.lowMap = {};         // Today's low
    this.volumeMap = {};
    this.oiMap = {};          // Current OI
    this.oiRefMap = {};       // Reference OI (previous session close)
    this.oiChangeMap = {};    // OI change %
    this.pcMap = {};          // Price change %
    this.marketCapMap = {};   // Market cap (if available)

    // Previous day/month data
    this.pdhData = {};        // { high, low, close, date }
    this.pmhData = {};        // { high, low, month }

    // Scanner Results
    this.topGainers = [];
    this.topLosers = [];
    this.allScanned = [];     // Full list after filters
    this.indicesData = [];

    // Market Breadth
    this.breadth = {
      advancing: 0,
      declining: 0,
      unchanged: 0,
      total: 0,
      evaluated: 0,
      unavailable: 0,
      advDeclineRatio: 0,
      netBreadthPct: 0,
    };

    // Market Sentiment
    this.sentiment = {
      label: 'INSUFFICIENT_DATA',
      netBreadthPct: 0,
      rule: '',
      advancing: 0,
      declining: 0,
    };

    // Connection & Status
    this.connectionStatus = 'DISCONNECTED';
    this.dataMode = 'UNAVAILABLE';  // 'LIVE', 'PREVIOUS_CLOSE', 'CACHED', 'UNAVAILABLE'
    this.sessionDate = null;
    this.sessionDateDisplay = null;
    this.lastUpdated = null;
    this.isScanning = false;
    this.tickCount = 0;
  }

  setUniverse(universe) {
    this.universe = universe;
    this.fnoUniverse = universe.filter(u => u.type === 'STOCK');
    this.indicesUniverse = universe.filter(u => u.type === 'INDEX');
  }

  setCashUniverse(cashUniverse) {
    this.cashUniverse = cashUniverse;
  }

  setPdhData(pdhData) {
    this.pdhData = pdhData;

    // Also populate oiRefMap from PDH data if close is provided
    for (const [key, data] of Object.entries(pdhData)) {
      if (data && data.close) {
        // This close can be used as reference for % change when no live close is available
      }
    }
  }

  setPmhData(pmhData) {
    this.pmhData = pmhData;
  }

  setConnectionStatus(status) {
    this.connectionStatus = status;
  }

  setDataMode(mode, sessionDate = null) {
    this.dataMode = mode;
    if (sessionDate) {
      this.sessionDate = sessionDate;
      try {
        const d = new Date(sessionDate + 'T00:00:00+05:30');
        this.sessionDateDisplay = marketSession.formatDateDisplay(d);
      } catch {
        this.sessionDateDisplay = sessionDate;
      }
    }
  }

  setScanning(isScanning) {
    this.isScanning = !!isScanning;
  }

  updateTicks(ticks) {
    let changed = false;

    for (const tick of ticks) {
      const { instrument_key } = tick;
      if (!instrument_key) continue;

      if (tick.ltp !== undefined && tick.ltp > 0) {
        this.ltpMap[instrument_key] = tick.ltp;
        changed = true;
        this.tickCount++;
      }

      if (tick.close !== undefined && tick.close > 0) {
        this.closeMap[instrument_key] = tick.close;
      }

      if (tick.open !== undefined && tick.open > 0) {
        this.openMap[instrument_key] = tick.open;
      } else if (!this.openMap[instrument_key] && tick.ltp > 0) {
        this.openMap[instrument_key] = tick.ltp;
      }

      if (tick.high !== undefined && tick.high > 0) {
        this.highMap[instrument_key] = tick.high;
      }

      if (tick.low !== undefined && tick.low > 0) {
        this.lowMap[instrument_key] = tick.low;
      }

      if (tick.volume !== undefined) {
        this.volumeMap[instrument_key] = tick.volume;
      }

      // OI data
      if (tick.previousOi !== undefined && tick.previousOi > 0) {
        this.oiRefMap[instrument_key] = tick.previousOi;
      }

      if (tick.oi !== undefined && tick.oi > 0) {
        const prevOi = this.oiRefMap[instrument_key];
        this.oiMap[instrument_key] = tick.oi;

        // Calculate OI change % if we have a valid previous reference
        if (prevOi && prevOi > 0 && prevOi !== tick.oi) {
          this.oiChangeMap[instrument_key] = ((tick.oi - prevOi) / prevOi) * 100;
        } else if (this.oiChangeMap[instrument_key] === undefined) {
          this.oiChangeMap[instrument_key] = 0;
        }
      }

      if (tick.oi_change_pct !== undefined && tick.oi_change_pct !== 0) {
        this.oiChangeMap[instrument_key] = tick.oi_change_pct;
      }

      // Update PDH/PDL from snapshot if provided
      if (tick.prevHigh !== undefined && tick.prevLow !== undefined) {
        if (!this.pdhData[instrument_key]) {
          this.pdhData[instrument_key] = {};
        }
        this.pdhData[instrument_key].high = tick.prevHigh;
        this.pdhData[instrument_key].low = tick.prevLow;
      }

      if (tick.sessionDate) {
        this.setDataMode('PREVIOUS_CLOSE', tick.sessionDate);
      }

      // Calculate percentage change
      const ltp = this.ltpMap[instrument_key];
      const close = this.closeMap[instrument_key] || this.pdhData[instrument_key]?.close;
      if (ltp && close && close > 0) {
        this.pcMap[instrument_key] = ((ltp - close) / close) * 100;
      }
    }

    if (changed) {
      this.lastUpdated = Date.now();
      this.recalculateLeaders();
      this.recalculateIndices();
      this.recalculateBreadth();
      this.recalculateSentiment();
    }
  }

  recalculateLeaders() {
    const config = SCANNER_CONFIG;
    const validStocks = [];

    // Determine universe pool based on configured market segment
    let universePool = [];
    const segment = config.marketSegment || 'BOTH';
    if (segment === 'CASH') {
      universePool = this.cashUniverse || [];
    } else if (segment === 'FNO') {
      universePool = this.fnoUniverse || [];
    } else {
      // BOTH: combine F&O and Cash universes
      universePool = [...(this.fnoUniverse || []), ...(this.cashUniverse || [])];
    }

    for (const inst of universePool) {
      const key = inst.instrument_key;
      const ltp = this.ltpMap[key] || 0;
      const pc = this.pcMap[key] || 0;
      const open = this.openMap[key] || 0;
      const pdh = this.pdhData[key]?.high || null;
      const pdl = this.pdhData[key]?.low || null;
      const pdhClose = this.pdhData[key]?.close || null;
      const pmh = this.pmhData[key]?.high || null;
      const pml = this.pmhData[key]?.low || null;
      const oiChange = this.oiChangeMap[key] || 0;
      const oi = this.oiMap[key] || 0;
      const volume = this.volumeMap[key] || 0;
      const marketCap = this.marketCapMap[key] || null;

      if (ltp <= 0) continue;

      const isFno = inst.isFno ?? (inst.exchange === 'NFO' || inst.instrumentType === 'FUTSTK' || inst.category === 'F&O');
      const category = inst.category || (isFno ? 'F&O' : 'Cash');

      // --- FILTERS ---

      // Price Change Filter
      if (config.priceChangeEnabled) {
        const absPc = Math.abs(pc);
        if (absPc < config.MIN_PCT_CHANGE || absPc > config.MAX_PCT_CHANGE) continue;
      }

      // LTP Filter
      if (config.ltpFilterEnabled) {
        if (ltp < config.minLtp || ltp > config.maxLtp) continue;
      }

      // Volume Filter
      if (config.volumeFilterEnabled && config.minVolume > 0) {
        if (volume < config.minVolume) continue;
      }

      // Market Cap Filter
      if (config.marketCapEnabled && marketCap !== null) {
        const mcValue = config.marketCapUnit === 'lakh_crore'
          ? marketCap / 100000  // convert crore to lakh crore
          : marketCap;
        if (mcValue < config.minMarketCap || mcValue > config.maxMarketCap) continue;
      }

      // OI Change Filter (only applies to derivatives; cash stocks don't carry contract OI)
      if (config.oiFilterEnabled) {
        if (!isFno) {
          if (segment === 'BOTH' || segment === 'CASH') continue;
        } else {
          if (config.oiPositiveOnly && oiChange <= 0) continue;
          if (config.oiNegativeOnly && oiChange >= 0) continue;
          const absOiChange = Math.abs(oiChange);
          if (absOiChange < config.MIN_OI_CHANGE_PCT || absOiChange > config.MAX_OI_CHANGE_PCT) continue;
          if (config.minAbsoluteOI > 0 && oi < config.minAbsoluteOI) continue;
        }
      }

      // Previous Month High/Low Filter
      if (config.prevMonthHighEnabled && pmh !== null) {
        if (ltp < pmh) continue; // Price must be above previous month high
      }
      if (config.prevMonthLowEnabled && pml !== null) {
        if (ltp > pml) continue; // Price must be below previous month low
      }

      // Build signals list
      const signals = [];
      if (pdh && ltp >= pdh) signals.push('PDH B/O');
      if (pdl && ltp <= pdl) signals.push('PDL B/D');
      if (pmh && ltp >= pmh) signals.push('PMH B/O');
      if (pml && ltp <= pml) signals.push('PML B/D');
      if (isFno && oiChange >= 5) signals.push('OI Buildup');
      if (isFno && oiChange <= -5) signals.push('OI Unwinding');

      validStocks.push({
        ...inst,
        category,
        isFno,
        segment: isFno ? 'FNO' : 'CASH',
        ltp,
        pc,
        open,
        pdh,
        pdl,
        pmh,
        pml,
        oi: isFno ? oi : 0,
        oi_change_pct: isFno ? oiChange : 0,
        volume,
        marketCap,
        high: this.highMap[key] || 0,
        low: this.lowMap[key] || 0,
        signals,
        signalStr: signals.join(', ') || '-',
      });
    }

    this.allScanned = validStocks;

    // --- GAINERS ---
    let gainers = validStocks.filter(s => s.pc > 0);
    if (config.REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS && config.prevDayHighEnabled) {
      gainers = gainers.filter(s => s.pdh !== null && s.open > s.pdh);
    }
    this.topGainers = gainers.sort((a, b) => b.pc - a.pc).slice(0, 10);

    // --- LOSERS ---
    let losers = validStocks.filter(s => s.pc < 0);
    if (config.REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS && config.prevDayLowEnabled) {
      losers = losers.filter(s => s.pdl !== null && s.open < s.pdl);
    }
    this.topLosers = losers.sort((a, b) => a.pc - b.pc).slice(0, 10);
  }

  recalculateIndices() {
    this.indicesData = this.indicesUniverse.map(inst => {
      const key = inst.instrument_key;
      return {
        ...inst,
        ltp: this.ltpMap[key] || 0,
        pc: this.pcMap[key] || 0
      };
    }).filter(idx => idx.ltp > 0)
      .sort((a, b) => b.pc - a.pc);
  }

  recalculateBreadth() {
    // Calculate using cash/FnO universe (stocks only, not indices)
    const stocks = this.fnoUniverse;
    let advancing = 0;
    let declining = 0;
    let unchanged = 0;
    let evaluated = 0;

    for (const inst of stocks) {
      const pc = this.pcMap[inst.instrument_key];
      if (pc === undefined) continue;

      evaluated++;
      if (pc > 0.01) advancing++;
      else if (pc < -0.01) declining++;
      else unchanged++;
    }

    const total = stocks.length;
    const advDeclineRatio = declining > 0 ? (advancing / declining) : (advancing > 0 ? Infinity : 0);
    const netBreadthPct = evaluated > 0
      ? ((advancing - declining) / evaluated) * 100
      : 0;

    this.breadth = {
      advancing,
      declining,
      unchanged,
      total,
      evaluated,
      unavailable: total - evaluated,
      advDeclineRatio: isFinite(advDeclineRatio) ? advDeclineRatio : 999,
      netBreadthPct: Math.round(netBreadthPct * 100) / 100,
    };
  }

  recalculateSentiment() {
    const config = SCANNER_CONFIG;
    const b = this.breadth;

    if (!config.sentimentEnabled) {
      this.sentiment = { label: 'DISABLED', netBreadthPct: 0, rule: 'Sentiment analysis disabled', advancing: 0, declining: 0 };
      return;
    }

    const coveragePct = b.total > 0 ? (b.evaluated / b.total) * 100 : 0;

    if (coveragePct < config.sentimentMinCoverage) {
      this.sentiment = {
        label: 'INSUFFICIENT_DATA',
        netBreadthPct: b.netBreadthPct,
        rule: `Coverage ${coveragePct.toFixed(0)}% < required ${config.sentimentMinCoverage}%`,
        advancing: b.advancing,
        declining: b.declining,
      };
      return;
    }

    let label;
    let rule;

    if (b.netBreadthPct >= config.sentimentPositiveThreshold) {
      label = 'POSITIVE';
      rule = `Net breadth ${b.netBreadthPct.toFixed(1)}% ≥ +${config.sentimentPositiveThreshold}%`;
    } else if (b.netBreadthPct <= config.sentimentNegativeThreshold) {
      label = 'NEGATIVE';
      rule = `Net breadth ${b.netBreadthPct.toFixed(1)}% ≤ ${config.sentimentNegativeThreshold}%`;
    } else {
      label = 'SIDEWAYS';
      rule = `Net breadth ${b.netBreadthPct.toFixed(1)}% between ${config.sentimentNegativeThreshold}% and +${config.sentimentPositiveThreshold}%`;
    }

    this.sentiment = {
      label,
      netBreadthPct: b.netBreadthPct,
      rule,
      advancing: b.advancing,
      declining: b.declining,
    };
  }

  getConfig() {
    return { ...SCANNER_CONFIG };
  }

  updateConfig(newConfig) {
    // Validate and parse numerical fields
    const numericFields = [
      'MIN_PCT_CHANGE', 'MAX_PCT_CHANGE', 'MIN_OI_CHANGE_PCT', 'MAX_OI_CHANGE_PCT',
      'minMarketCap', 'maxMarketCap', 'minVolume', 'minLtp', 'maxLtp',
      'minAdvancing', 'minDeclining', 'advDeclineRatioThreshold',
      'sentimentPositiveThreshold', 'sentimentNegativeThreshold', 'sentimentMinCoverage',
      'minAbsoluteOI', 'maxAbsoluteOI'
    ];

    for (const field of numericFields) {
      if (newConfig[field] !== undefined) {
        newConfig[field] = parseFloat(newConfig[field]);
        if (isNaN(newConfig[field])) delete newConfig[field];
      }
    }

    // Boolean fields
    const boolFields = [
      'scanEnabled', 'timeFilterEnabled', 'priceChangeEnabled',
      'prevDayHighEnabled', 'prevDayLowEnabled', 'prevMonthHighEnabled', 'prevMonthLowEnabled',
      'REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS', 'REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS',
      'marketCapEnabled', 'oiFilterEnabled', 'oiPositiveOnly', 'oiNegativeOnly',
      'volumeFilterEnabled', 'ltpFilterEnabled',
      'advDeclineEnabled', 'sentimentEnabled'
    ];

    for (const field of boolFields) {
      if (newConfig[field] !== undefined && typeof newConfig[field] === 'string') {
        newConfig[field] = newConfig[field] === 'true';
      }
    }

    SCANNER_CONFIG = {
      ...SCANNER_CONFIG,
      ...newConfig
    };
    logger.info('Scanner config updated');
    this.recalculateLeaders();
    this.recalculateBreadth();
    this.recalculateSentiment();
  }

  resetConfig() {
    SCANNER_CONFIG = { ...DEFAULT_CONFIG };
    loadConfigFromEnv();
    logger.info('Scanner config reset to defaults');
    this.recalculateLeaders();
    this.recalculateBreadth();
    this.recalculateSentiment();
  }

  getSnapshot() {
    const ms = marketSession.getMarketStatus();
    return {
      timestamp: Date.now(),
      gainers: this.topGainers,
      losers: this.topLosers,
      indices: this.indicesData,
      allScanned: this.allScanned,
      breadth: this.breadth,
      sentiment: this.sentiment,
      status: {
        connection: this.connectionStatus,
        dataMode: this.dataMode,
        sessionDate: this.sessionDate,
        sessionDateDisplay: this.sessionDateDisplay,
        lastUpdated: this.lastUpdated,
        isScanning: this.isScanning,
        tickCount: this.tickCount,
        market: ms
      }
    };
  }
}

const marketState = new MarketState();
module.exports = marketState;
