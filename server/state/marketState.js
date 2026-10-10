const logger = require('../utils/logger');

// ==========================================
// ⚙️ SCANNER CONFIGURATION
// Default values loaded from .env, but mutable via API
// ==========================================
let SCANNER_CONFIG = {
  MIN_PCT_CHANGE: parseFloat(process.env.MIN_PCT_CHANGE || '0.5'),
  MAX_PCT_CHANGE: parseFloat(process.env.MAX_PCT_CHANGE || '20.0'),
  REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS: process.env.REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS !== 'false',
  REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS: process.env.REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS !== 'false',
  MIN_OI_CHANGE_PCT: parseFloat(process.env.MIN_OI_CHANGE_PCT || '5.0'),
  MAX_OI_CHANGE_PCT: parseFloat(process.env.MAX_OI_CHANGE_PCT || '500.0'),
};
// ==========================================

class MarketState {
  constructor() {
    this.universe = []; 
    this.fnoUniverse = []; 
    this.indicesUniverse = []; 
    this.pdhData = {}; // Contains { high, low } for previous day
    
    // Live data maps keyed by instrument_key
    this.ltpMap = {};
    this.pcMap = {}; // Percentage change
    this.closeMap = {}; // Previous day close
    this.openMap = {}; // Today's Open price
    this.volumeMap = {};
    this.oiChangeMap = {}; // OI change percentage (if applicable)
    
    this.topGainers = [];
    this.topLosers = [];
    this.indicesData = [];
  }

  setUniverse(universe) {
    this.universe = universe;
    this.fnoUniverse = universe.filter(u => u.type === 'STOCK');
    this.indicesUniverse = universe.filter(u => u.type === 'INDEX');
  }

  setPdhData(pdhData) {
    this.pdhData = pdhData;
  }

  updateTicks(ticks) {
    let changed = false;
    
    ticks.forEach(tick => {
      const { instrument_key, ltp, close, open, volume, oi_change_pct } = tick;
      
      if (ltp !== undefined && ltp > 0) {
        this.ltpMap[instrument_key] = ltp;
        changed = true;
      }
      
      if (close !== undefined && close > 0) {
        this.closeMap[instrument_key] = close;
      }

      // Store Today's Open Price
      if (open !== undefined && open > 0) {
        this.openMap[instrument_key] = open;
      } else if (!this.openMap[instrument_key] && ltp > 0) {
        // Fallback: If no open is explicitly provided by the feed yet, assume the first LTP we see is the open.
        // This works well if the server starts exactly at 9:15 AM.
        this.openMap[instrument_key] = ltp;
      }
      
      if (volume !== undefined) {
        this.volumeMap[instrument_key] = volume;
      }

      if (oi_change_pct !== undefined) {
        this.oiChangeMap[instrument_key] = oi_change_pct;
      }
      
      // Update PDH/PDL from snapshot if provided
      if (tick.prevHigh !== undefined && tick.prevLow !== undefined) {
        if (!this.pdhData[instrument_key]) {
          this.pdhData[instrument_key] = {};
        }
        this.pdhData[instrument_key].high = tick.prevHigh;
        this.pdhData[instrument_key].low = tick.prevLow;
      }
      
      // Calculate percentage change
      if (this.ltpMap[instrument_key] && this.closeMap[instrument_key]) {
        const c = this.closeMap[instrument_key];
        const l = this.ltpMap[instrument_key];
        this.pcMap[instrument_key] = ((l - c) / c) * 100;
      }
    });

    if (changed) {
      this.recalculateLeaders();
      this.recalculateIndices();
    }
  }

  recalculateLeaders() {
    const validStocks = [];

    for (const inst of this.fnoUniverse) {
      const key = inst.instrument_key;
      const ltp = this.ltpMap[key] || 0;
      const pc = this.pcMap[key] || 0;
      const open = this.openMap[key] || 0;
      const pdh = this.pdhData[key]?.high || null;
      const pdl = this.pdhData[key]?.low || null;
      const oiChange = this.oiChangeMap[key] || 0;

      if (ltp <= 0) continue;

      // 1. Percentage Change Filter
      const absPc = Math.abs(pc);
      if (absPc < SCANNER_CONFIG.MIN_PCT_CHANGE || absPc > SCANNER_CONFIG.MAX_PCT_CHANGE) {
        continue;
      }

      // 2. OI Change Filter
      // We only apply this if we actually have OI data (oiChange !== 0). 
      // In offline mode, OI is 0, so we let it pass so the dashboard isn't completely empty.
      if (oiChange !== 0 && (SCANNER_CONFIG.MIN_OI_CHANGE_PCT > 0 || SCANNER_CONFIG.MAX_OI_CHANGE_PCT < 500)) {
        // Momentum usually looks for OI *buildup* (positive OI change) for both long & short setups.
        // So we check if the actual positive OI increase is within bounds.
        if (oiChange < SCANNER_CONFIG.MIN_OI_CHANGE_PCT || oiChange > SCANNER_CONFIG.MAX_OI_CHANGE_PCT) {
          continue;
        }
      }

      validStocks.push({
        ...inst,
        ltp,
        pc,
        open,
        pdh,
        pdl,
        oi_change_pct: oiChange,
        volume: this.volumeMap[key] || 0,
      });
    }

    // --- GAINERS LOGIC ---
    let potentialGainers = validStocks.filter(s => s.pc > 0);
    if (SCANNER_CONFIG.REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS) {
      potentialGainers = potentialGainers.filter(s => s.pdh !== null && s.open > s.pdh);
    }
    this.topGainers = potentialGainers.sort((a, b) => b.pc - a.pc).slice(0, 10);

    // --- LOSERS LOGIC ---
    let potentialLosers = validStocks.filter(s => s.pc < 0);
    if (SCANNER_CONFIG.REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS) {
      potentialLosers = potentialLosers.filter(s => s.pdl !== null && s.open < s.pdl);
    }
    this.topLosers = potentialLosers.sort((a, b) => a.pc - b.pc).slice(0, 10);
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

  getConfig() {
    return SCANNER_CONFIG;
  }

  updateConfig(newConfig) {
    SCANNER_CONFIG = {
      ...SCANNER_CONFIG,
      ...newConfig
    };
    logger.info('Scanner config updated:', JSON.stringify(SCANNER_CONFIG));
    this.recalculateLeaders();
  }

  getSnapshot() {
    return {
      timestamp: Date.now(),
      gainers: this.topGainers,
      losers: this.topLosers,
      indices: this.indicesData
    };
  }
}

const marketState = new MarketState();
module.exports = marketState;
