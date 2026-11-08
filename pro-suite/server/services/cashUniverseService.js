const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const proxyClient = require('./proxyClient');

const EXISTING_MASTER_FILE = path.join(__dirname, '..', '..', '..', 'data', 'instrument_master.json');
const LOCAL_MASTER_FILE = path.join(__dirname, '..', '..', 'data', 'cash_universe.json');
const INSTRUMENT_MASTER_URL = 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';

let cashUniverse = []; // Array of { token, symbol, name, exchange: 'NSE' }
let quotesMap = {};     // token -> { ltp, open, high, low, close, change, pChange, pdh, pdl, volume, lastUpdated }
let isInitialized = false;
let pollerInterval = null;

/**
 * Initialize NSE Cash Universe
 */
async function initializeCashUniverse() {
  if (isInitialized) return cashUniverse;

  logger.info('Initializing NSE Cash Equity Universe...');

  try {
    let rawInstruments = null;

    if (fs.existsSync(EXISTING_MASTER_FILE)) {
      logger.info('Loading cash universe from existing instrument master cache...');
      const fileData = fs.readFileSync(EXISTING_MASTER_FILE, 'utf8');
      rawInstruments = JSON.parse(fileData);
    } else if (fs.existsSync(LOCAL_MASTER_FILE)) {
      logger.info('Loading cash universe from local pro-suite cache...');
      const fileData = fs.readFileSync(LOCAL_MASTER_FILE, 'utf8');
      cashUniverse = JSON.parse(fileData);
      seedInitialQuotes();
      isInitialized = true;
      startQuotePoller();
      return cashUniverse;
    } else {
      logger.info('Downloading instrument master from Angel One...');
      const response = await axios.get(INSTRUMENT_MASTER_URL, { timeout: 45000 });
      rawInstruments = response.data;
    }

    if (Array.isArray(rawInstruments)) {
      const parsed = [];
      const seenSymbols = new Set();

      for (const inst of rawInstruments) {
        if (inst.exch_seg === 'NSE' && inst.instrumenttype === '' && inst.symbol) {
          if (!inst.symbol.endsWith('-EQ')) continue;

          const cleanSymbol = inst.symbol.replace('-EQ', '').trim();
          if (!cleanSymbol || cleanSymbol.includes('TEST') || !/^[A-Z0-9]/.test(cleanSymbol)) continue;
          if (seenSymbols.has(cleanSymbol)) continue;

          seenSymbols.add(cleanSymbol);
          parsed.push({
            token: String(inst.token),
            symbol: cleanSymbol,
            tradingsymbol: inst.symbol,
            name: inst.name || cleanSymbol,
            lotSize: parseInt(inst.lotsize) || 1,
            exchange: 'NSE'
          });
        }
      }

      parsed.sort((a, b) => a.symbol.localeCompare(b.symbol));
      cashUniverse = parsed;
      logger.info(`Loaded ${cashUniverse.length} NSE cash equity stocks`);

      const dataDir = path.dirname(LOCAL_MASTER_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(LOCAL_MASTER_FILE, JSON.stringify(cashUniverse));
    }
  } catch (err) {
    logger.error('Failed to load instrument master:', err.message);
    if (cashUniverse.length === 0) {
      seedFallbackUniverse();
    }
  }

  seedInitialQuotes();
  isInitialized = true;
  startQuotePoller();
  return cashUniverse;
}

function seedFallbackUniverse() {
  const popular = [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
    'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA', 'TITAN', 'BAJFINANCE', 'TATAMOTORS', 'ULTRACEMCO'
  ];

  cashUniverse = popular.map((sym, idx) => ({
    token: String(1000 + idx),
    symbol: sym,
    tradingsymbol: `${sym}-EQ`,
    name: sym,
    lotSize: 1,
    exchange: 'NSE'
  }));
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function seedInitialQuotes() {
  // Clear any stale fake quotes; quotes are exclusively populated from real Angel One market data
}

function startQuotePoller() {
  if (pollerInterval) return;

  const pollIntervalMs = parseInt(process.env.CASH_POLL_INTERVAL_MS) || 15000;

  const updateQuotesFromSnapshot = async () => {
    try {
      const snapshot = await proxyClient.fetchSnapshot();
      if (snapshot && Array.isArray(snapshot.cashStocks) && snapshot.cashStocks.length > 0) {
        const now = Date.now();
        for (const item of snapshot.cashStocks) {
          const key = String(item.instrument_key || item.token);
          if (key && item.ltp > 0) {
            quotesMap[key] = {
              ltp: item.ltp,
              open: item.open || item.ltp,
              close: item.close || item.ltp,
              change: item.change || 0,
              pChange: item.pChange !== undefined ? item.pChange : (item.pc || 0),
              high: item.high || item.ltp,
              low: item.low || item.ltp,
              pdh: item.pdh || null,
              pdl: item.pdl || null,
              volume: item.volume || 0,
              lastUpdated: now
            };
          }
        }
      }
    } catch (err) {
      // Background poll failure is non-fatal
    }
  };

  // Immediate poll on start
  updateQuotesFromSnapshot();

  pollerInterval = setInterval(updateQuotesFromSnapshot, pollIntervalMs);

  if (pollerInterval && pollerInterval.unref) {
    pollerInterval.unref();
  }
}

/**
 * Unified Query: Supports both 'CASH' and 'FNO' segments with full editable filters
 */
async function getStocks({
  segment = 'CASH', // 'CASH' or 'FNO' (strictly separate)
  search = '',
  filter = 'ALL', // 'ALL' | 'GAINERS' | 'LOSERS' | 'PDH_BO' | 'PDL_BD' | 'HIGH_OI' | 'OI_BUILDUP' | 'OI_UNWINDING'
  sortField = 'pChange',
  sortDir = 'desc',
  page = 1,
  limit = 50,
  // Editable filter options (defaulting to disabled / no filters)
  priceChangeEnabled = false,
  minPriceChange = 0.5,
  maxPriceChange = 20.0,
  ltpFilterEnabled = false,
  minLtp = 0,
  maxLtp = 999999,
  volumeFilterEnabled = false,
  minVolume = 0,
  pdhFilterEnabled = false,
  pdlFilterEnabled = false,
  oiFilterEnabled = false,
  minOiChangePct = 5.0,
  maxOiChangePct = 500.0,
  oiPositiveOnly = false,
  oiNegativeOnly = false
} = {}) {
  let list = [];

  if (segment === 'FNO') {
    // Read F&O contracts from port 3000 live snapshot (prefer unfiltered fnoStocks)
    const snapshot = await proxyClient.fetchSnapshot();
    const sourceList = (snapshot && Array.isArray(snapshot.fnoStocks) && snapshot.fnoStocks.length > 0)
      ? snapshot.fnoStocks
      : (snapshot && Array.isArray(snapshot.allScanned))
        ? snapshot.allScanned.filter(s => s.isFno !== false)
        : [];

    list = sourceList.map(item => {
      const ltp = item.ltp || 0;
      const close = item.close || item.pdhClose || (ltp - (ltp * (item.pc || 0) / 100));
      const change = Math.round((ltp - close) * 100) / 100;
      const pChange = Math.round((item.pc || 0) * 100) / 100;
      const oiChange = Math.round((item.oi_change_pct || item.oiChange || 0) * 100) / 100;
      const oi = item.oi || 0;
      const pdh = item.pdh || null;
      const pdl = item.pdl || null;

      const signals = [];
      if (pdh && ltp >= pdh) signals.push('PDH B/O');
      if (pdl && ltp <= pdl) signals.push('PDL B/D');
      if (oiChange >= 5) signals.push('OI Buildup');
      if (oiChange <= -5) signals.push('OI Unwinding');

      return {
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
        change,
        pChange,
        pdh,
        pdl,
        pmh: item.pmh || null,
        pml: item.pml || null,
        oi,
        oiChange,
        volume: item.volume || 0,
        signals,
        signalStr: signals.join(', ') || '-',
        lastUpdated: snapshot?.timestamp || Date.now()
      };
    });
  } else {
    // CASH Market - verify quotes against live port 3000 snapshot if quotesMap is empty
    if (Object.keys(quotesMap).length === 0) {
      try {
        const snapshot = await proxyClient.fetchSnapshot();
        if (snapshot && Array.isArray(snapshot.cashStocks)) {
          const now = Date.now();
          for (const item of snapshot.cashStocks) {
            const key = String(item.instrument_key || item.token);
            if (key && item.ltp > 0) {
              quotesMap[key] = {
                ltp: item.ltp,
                open: item.open || item.ltp,
                close: item.close || item.ltp,
                change: item.change || 0,
                pChange: item.pChange !== undefined ? item.pChange : (item.pc || 0),
                high: item.high || item.ltp,
                low: item.low || item.ltp,
                pdh: item.pdh || null,
                pdl: item.pdl || null,
                volume: item.volume || 0,
                lastUpdated: now
              };
            }
          }
        }
      } catch {}
    }

    list = cashUniverse.map(stock => {
      const q = quotesMap[stock.token] || { ltp: 0, open: 0, high: 0, low: 0, close: 0, change: 0, pChange: 0, pdh: null, pdl: null, volume: 0, lastUpdated: 0 };
      const signals = [];
      if (q.pdh && q.ltp >= q.pdh) signals.push('PDH B/O');
      if (q.pdl && q.ltp <= q.pdl) signals.push('PDL B/D');

      return {
        symbol: stock.symbol,
        tradingsymbol: stock.tradingsymbol,
        name: stock.name,
        token: stock.token,
        segment: 'CASH',
        isFno: false,
        expiry: null,
        lotSize: stock.lotSize || 1,
        ltp: q.ltp,
        open: q.open || q.ltp,
        high: q.high || q.ltp,
        low: q.low || q.ltp,
        close: q.close,
        change: q.change,
        pChange: q.pChange,
        pdh: q.pdh,
        pdl: q.pdl,
        pmh: null,
        pml: null,
        oi: null,          // Cash has no Open Interest
        oiChange: null,    // Cash has no OI change
        volume: q.volume,
        signals,
        signalStr: signals.join(', ') || '-',
        lastUpdated: q.lastUpdated
      };
    });
  }

  // --- FILTERS ---
  // 1. Search filter
  if (search) {
    const term = search.trim().toUpperCase();
    list = list.filter(s => s.symbol.toUpperCase().includes(term) || (s.tradingsymbol && s.tradingsymbol.toUpperCase().includes(term)) || (s.name && s.name.toUpperCase().includes(term)));
  }

  // 2. Quick signal pill filters
  if (filter === 'GAINERS') {
    list = list.filter(s => s.pChange > 0);
  } else if (filter === 'LOSERS') {
    list = list.filter(s => s.pChange < 0);
  } else if (filter === 'PDH_BO') {
    list = list.filter(s => s.pdh && s.ltp >= s.pdh);
  } else if (filter === 'PDL_BD') {
    list = list.filter(s => s.pdl && s.ltp <= s.pdl);
  } else if (filter === 'HIGH_OI') {
    list = list.filter(s => s.oiChange !== null && Math.abs(s.oiChange) >= 5);
  } else if (filter === 'OI_BUILDUP') {
    list = list.filter(s => s.oiChange !== null && s.oiChange >= 5);
  } else if (filter === 'OI_UNWINDING') {
    list = list.filter(s => s.oiChange !== null && s.oiChange <= -5);
  }

  // 3. Price Change filter (if enabled)
  if (priceChangeEnabled) {
    list = list.filter(s => {
      const absPc = Math.abs(s.pChange);
      return absPc >= Number(minPriceChange) && absPc <= Number(maxPriceChange);
    });
  }

  // 4. LTP filter (if enabled)
  if (ltpFilterEnabled) {
    list = list.filter(s => s.ltp >= Number(minLtp) && s.ltp <= Number(maxLtp));
  }

  // 5. Volume filter (if enabled)
  if (volumeFilterEnabled && Number(minVolume) > 0) {
    list = list.filter(s => (s.volume || 0) >= Number(minVolume));
  }

  // 6. PDH filter (if enabled)
  if (pdhFilterEnabled) {
    list = list.filter(s => s.pdh && s.ltp >= s.pdh);
  }

  // 7. PDL filter (if enabled)
  if (pdlFilterEnabled) {
    list = list.filter(s => s.pdl && s.ltp <= s.pdl);
  }

  // 8. OI filter (if enabled and FNO segment)
  if (oiFilterEnabled && segment === 'FNO') {
    list = list.filter(s => {
      if (s.oiChange === null) return false;
      if (oiPositiveOnly && s.oiChange <= 0) return false;
      if (oiNegativeOnly && s.oiChange >= 0) return false;
      const absOi = Math.abs(s.oiChange);
      return absOi >= Number(minOiChangePct) && absOi <= Number(maxOiChangePct);
    });
  }

  // Sort
  list.sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    aVal = aVal === null || aVal === undefined ? -Infinity : aVal;
    bVal = bVal === null || bVal === undefined ? -Infinity : bVal;
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const total = list.length;
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(500, Math.max(10, parseInt(limit) || 50));
  const startIndex = (p - 1) * l;
  const paginated = list.slice(startIndex, startIndex + l);

  // For CASH segment: on-demand fetch real Angel One quotes for any unquoted stocks in the current view
  if (segment === 'CASH') {
    const missing = paginated.filter(s => s.ltp === 0 || !quotesMap[s.token]);
    if (missing.length > 0) {
      const tokensToFetch = missing.slice(0, 50).map(s => s.token);
      try {
        const qRes = await axios.post(`${process.env.PRIMARY_SCANNER_URL || 'http://localhost:3000'}/api/quotes`, {
          exchange: 'NSE',
          tokens: tokensToFetch
        }, { timeout: 3500 });
        if (qRes.data?.success && Array.isArray(qRes.data.quotes)) {
          const now = Date.now();
          for (const q of qRes.data.quotes) {
            const key = String(q.symbolToken);
            const ltp = parseFloat(q.ltp) || 0;
            if (ltp > 0) {
              const close = parseFloat(q.close) || ltp;
              const change = Math.round((ltp - close) * 100) / 100;
              const pChange = close > 0 ? Math.round(((change / close) * 100) * 100) / 100 : 0;
              quotesMap[key] = {
                ltp,
                open: parseFloat(q.open) || ltp,
                high: parseFloat(q.high) || ltp,
                low: parseFloat(q.low) || ltp,
                close,
                change,
                pChange,
                pdh: parseFloat(q.high) || null,
                pdl: parseFloat(q.low) || null,
                volume: parseInt(q.tradeVolume) || 0,
                lastUpdated: now
              };
            }
          }
          // Refresh the paginated view with updated real quotes
          for (const s of paginated) {
            const updated = quotesMap[s.token];
            if (updated && updated.ltp > 0) {
              s.ltp = updated.ltp;
              s.open = updated.open;
              s.high = updated.high;
              s.low = updated.low;
              s.close = updated.close;
              s.change = updated.change;
              s.pChange = updated.pChange;
              s.volume = updated.volume;
              s.pdh = updated.pdh;
              s.pdl = updated.pdl;
              s.lastUpdated = updated.lastUpdated;
            }
          }
        }
      } catch (err) {}
    }
  }

  return {
    segment,
    stocks: paginated,
    total,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l) || 1,
    lastUpdated: Date.now()
  };
}

module.exports = {
  initializeCashUniverse,
  getStocks,
  quotesMap
};
