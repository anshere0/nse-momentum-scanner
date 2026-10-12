const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const INSTRUMENT_MASTER_URL = 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';
const CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'instrument_master.json');
const CACHE_META_FILE = path.join(__dirname, '..', '..', 'data', 'instrument_master_meta.json');

// Target indices to track
const TARGET_INDICES = [
  'Nifty 50', 'Nifty Bank', 'Nifty IT', 'Nifty FMCG', 'NIFTY AUTO',
  'NIFTY PHARMA', 'NIFTY METAL', 'Nifty Psu Bank', 'NIFTY FIN SERVICE',
  'NIFTY MIDCAP 50', 'NIFTY MID SELECT', 'NIFTY MIDCAP 150'
];

// Normalized names for display
const INDEX_DISPLAY_NAMES = {
  'NIFTY 50': 'NIFTY 50',
  'NIFTY BANK': 'NIFTY BANK',
  'NIFTY IT': 'NIFTY IT',
  'NIFTY FMCG': 'NIFTY FMCG',
  'NIFTY AUTO': 'NIFTY AUTO',
  'NIFTY PHARMA': 'NIFTY PHARMA',
  'NIFTY METAL': 'NIFTY METAL',
  'NIFTY PSU BANK': 'NIFTY PSU BANK',
  'NIFTY FIN SERVICE': 'NIFTY FIN SERVICE',
  'NIFTY MIDCAP 50': 'NIFTY MIDCAP 50',
  'NIFTY MID SELECT': 'NIFTY MID SELECT',
  'NIFTY MIDCAP 150': 'NIFTY MIDCAP 150',
  'NIFTY CONSUMPTION': 'NIFTY CONSUMPTION',
};

let instrumentsCache = null;
let tokenIndex = {};      // token -> instrument
let symbolIndex = {};     // symbol -> instrument (for cash equities)
let fnoSymbols = new Set(); // Set of symbols that have F&O contracts

/**
 * Download instrument master from Angel One
 */
async function downloadInstrumentMaster() {
  logger.info('Downloading Angel One instrument master...');

  try {
    const response = await axios.get(INSTRUMENT_MASTER_URL, {
      timeout: 60000,
      maxContentLength: 100 * 1024 * 1024 // 100MB max
    });

    const instruments = response.data;
    logger.info(`Instrument master downloaded: ${instruments.length} instruments`);

    // Save to cache
    const dataDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(instruments));
    fs.writeFileSync(CACHE_META_FILE, JSON.stringify({
      downloadedAt: new Date().toISOString(),
      count: instruments.length
    }));

    return instruments;
  } catch (err) {
    logger.error('Failed to download instrument master:', err.message);

    // Try loading from cache
    if (fs.existsSync(CACHE_FILE)) {
      logger.info('Loading instrument master from cache...');
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const meta = fs.existsSync(CACHE_META_FILE)
        ? JSON.parse(fs.readFileSync(CACHE_META_FILE, 'utf8'))
        : {};
      logger.warn(`Using cached instrument master from ${meta.downloadedAt || 'unknown date'}`);
      return cached;
    }

    throw new Error('Cannot load instrument master: download failed and no cache available');
  }
}

/**
 * Parse and index instrument master data
 */
function parseInstrumentMaster(instruments) {
  instrumentsCache = instruments;
  tokenIndex = {};
  symbolIndex = {};
  fnoSymbols = new Set();

  for (const inst of instruments) {
    // Index by token + exchange for fast lookups
    const key = `${inst.exch_seg}:${inst.token}`;
    tokenIndex[key] = inst;

    // Index cash equities by symbol
    if (inst.exch_seg === 'NSE' && inst.symbol && inst.instrumenttype === '') {
      symbolIndex[inst.symbol.replace('-EQ', '')] = inst;
    }

    // Track F&O eligible symbols
    if (inst.exch_seg === 'NFO' && inst.instrumenttype === 'FUTSTK') {
      const underlying = inst.name || inst.symbol?.split(/\d/)[0];
      if (underlying) {
        fnoSymbols.add(underlying);
      }
    }
  }

  logger.info(`Instrument master indexed: ${Object.keys(tokenIndex).length} tokens, ${Object.keys(symbolIndex).length} cash equities, ${fnoSymbols.size} F&O underlyings`);
}

/**
 * Get the F&O universe - returns near-month futures for all F&O eligible stocks
 */
function getFnoUniverse() {
  if (!instrumentsCache) return [];

  const futureGroups = {};
  const now = new Date();

  for (const inst of instrumentsCache) {
    if (inst.exch_seg === 'NFO' && inst.instrumenttype === 'FUTSTK' && inst.expiry) {
      const underlying = inst.name || '';
      if (!underlying || underlying.includes('TEST')) continue;

      if (!futureGroups[underlying]) {
        futureGroups[underlying] = [];
      }
      futureGroups[underlying].push(inst);
    }
  }

  const universe = [];
  for (const symbol in futureGroups) {
    const futures = futureGroups[symbol];

    // Filter out expired contracts and sort by expiry
    const validFutures = futures
      .filter(f => {
        try {
          const expDate = parseAngelExpiry(f.expiry);
          return expDate >= now;
        } catch {
          return false;
        }
      })
      .sort((a, b) => parseAngelExpiry(a.expiry) - parseAngelExpiry(b.expiry));

    if (validFutures.length > 0) {
      const nearMonth = validFutures[0];

      // Find the corresponding cash equity token
      const cashInst = symbolIndex[symbol];
      const cashToken = cashInst ? cashInst.token : null;

      universe.push({
        instrument_key: nearMonth.token,
        tradingsymbol: nearMonth.symbol,
        name: symbol,
        underlying: symbol,
        type: 'STOCK',
        category: 'F&O',
        isFno: true,
        exchange: 'NFO',
        exchangeType: 2, // NSE_FO
        instrumentType: 'FUTSTK',
        expiry: nearMonth.expiry,
        lotSize: parseInt(nearMonth.lotsize) || 1,
        cashToken: cashToken,
        cashExchange: 'NSE',
        cashExchangeType: 1 // NSE_CM
      });
    }
  }

  logger.info(`F&O universe built: ${universe.length} stocks with near-month futures`);
  return universe;
}

/**
 * Get cash equity universe (all NSE equities or filtered by F&O eligibility)
 */
function getCashUniverse(fnoOnly = false) {
  if (!instrumentsCache) return [];

  const universe = [];
  for (const inst of instrumentsCache) {
    if (inst.exch_seg === 'NSE' && inst.instrumenttype === '' && inst.symbol) {
      const cleanSymbol = inst.symbol.replace('-EQ', '');

      // Skip test instruments and suspicious entries
      if (!cleanSymbol || cleanSymbol.includes('TEST') || !/^[A-Z]/.test(cleanSymbol)) continue;

      if (fnoOnly && !fnoSymbols.has(cleanSymbol)) continue;

      universe.push({
        instrument_key: inst.token,
        tradingsymbol: inst.symbol,
        name: cleanSymbol,
        underlying: cleanSymbol,
        type: 'STOCK',
        category: 'Cash',
        isFno: false,
        exchange: 'NSE',
        exchangeType: 1, // NSE_CM
        instrumentType: 'EQ',
        lotSize: parseInt(inst.lotsize) || 1,
        isFnO: fnoSymbols.has(cleanSymbol)
      });
    }
  }

  return universe;
}

/**
 * Get indices from instrument master
 */
function getIndices() {
  if (!instrumentsCache) return [];

  const universe = [];
  const foundIndices = new Set();

  for (const inst of instrumentsCache) {
    if (inst.exch_seg !== 'NSE') continue;

    const name = (inst.name || inst.symbol || '').toUpperCase().trim();

    for (const target of TARGET_INDICES) {
      const normalized = target.toUpperCase().trim();
      if (name === normalized || name === normalized.replace(/ /g, '')) {
        if (foundIndices.has(normalized)) continue;
        foundIndices.add(normalized);

        universe.push({
          instrument_key: inst.token,
          tradingsymbol: inst.symbol,
          name: INDEX_DISPLAY_NAMES[normalized] || normalized,
          type: 'INDEX',
          exchange: 'NSE',
          exchangeType: 1, // NSE_CM
          instrumentType: 'INDEX'
        });
        break;
      }
    }
  }

  logger.info(`Indices found: ${universe.length}`);
  return universe;
}

/**
 * Find an instrument by symbol and exchange
 */
function findInstrument(symbol, exchange = 'NSE') {
  if (!instrumentsCache) return null;

  for (const inst of instrumentsCache) {
    if (inst.exch_seg === exchange && (inst.symbol === symbol || inst.name === symbol)) {
      return inst;
    }
  }
  return null;
}

/**
 * Find instrument by token and exchange
 */
function findByToken(token, exchange = 'NSE') {
  return tokenIndex[`${exchange}:${token}`] || null;
}

/**
 * Get all F&O eligible symbols
 */
function getFnoSymbols() {
  return Array.from(fnoSymbols);
}

/**
 * Parse Angel One expiry date format
 * Formats seen: "28NOV2024", "2024-11-28", etc.
 */
function parseAngelExpiry(expiryStr) {
  if (!expiryStr) return new Date(0);

  // Try ISO format first
  if (expiryStr.includes('-')) {
    return new Date(expiryStr);
  }

  // Try DDMMMYYYY format (e.g., "28NOV2024")
  const months = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
  };

  const match = expiryStr.match(/^(\d{2})([A-Z]{3})(\d{4})$/);
  if (match) {
    const day = parseInt(match[1]);
    const month = months[match[2]];
    const year = parseInt(match[3]);
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }

  // Fallback
  return new Date(expiryStr);
}

/**
 * Check if instrument master should be refreshed
 * Returns true if cache is older than maxAge hours or doesn't exist
 */
function shouldRefresh(maxAgeHours = 12) {
  if (!fs.existsSync(CACHE_META_FILE)) return true;

  try {
    const meta = JSON.parse(fs.readFileSync(CACHE_META_FILE, 'utf8'));
    const downloadedAt = new Date(meta.downloadedAt);
    const ageMs = Date.now() - downloadedAt.getTime();
    return ageMs > maxAgeHours * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

/**
 * Initialize: download (if needed) and parse instrument master
 */
async function initialize(forceDownload = false) {
  let instruments;

  if (!forceDownload && !shouldRefresh() && fs.existsSync(CACHE_FILE)) {
    logger.info('Loading instrument master from cache (still fresh)...');
    instruments = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } else {
    instruments = await downloadInstrumentMaster();
  }

  parseInstrumentMaster(instruments);
  return instruments;
}

module.exports = {
  initialize,
  downloadInstrumentMaster,
  parseInstrumentMaster,
  getFnoUniverse,
  getCashUniverse,
  getIndices,
  findInstrument,
  findByToken,
  getFnoSymbols,
  parseAngelExpiry,
  shouldRefresh,
  TARGET_INDICES
};
