const axios = require('axios');
const zlib = require('zlib');
const logger = require('../utils/logger');
const oiCache = require('../utils/oiCache');
const pdhCache = require('../utils/pdhCache');

/**
 * Download and parse official NSE F&O Bhavcopy for a given trading date.
 * Extracts:
 * 1. Previous Day Closing Open Interest (OI reference baseline)
 * 2. Previous Day High (PDH) and Low (PDL) for F&O contracts
 *
 * @param {string} dateStr - YYYY-MM-DD format (e.g. '2026-10-09')
 * @param {Array} universe - List of instruments to map token keys
 * @returns {Promise<{ oiMap: Object, pdhMap: Object }>}
 */
async function fetchFoBhavcopy(dateStr, universe = []) {
  // Check if we already have fresh cached data for this session date
  const cachedOi = oiCache.load();
  const cachedPdh = pdhCache.load();

  if (cachedOi && cachedOi.date === dateStr && cachedOi.data && Object.keys(cachedOi.data).length > 50) {
    logger.info(`Loaded OI reference baseline from cache for ${dateStr} (${Object.keys(cachedOi.data).length} items)`);
    return {
      oiMap: cachedOi.data,
      pdhMap: cachedPdh || {}
    };
  }

  const yyyymmdd = dateStr.replace(/-/g, '');
  const url = `https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_${yyyymmdd}_F_0000.csv.zip`;

  logger.info(`Fetching official NSE F&O Bhavcopy for ${dateStr}...`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.nseindia.com/'
      },
      responseType: 'arraybuffer',
      timeout: 15000
    });

    const buf = Buffer.from(response.data);
    if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) {
      throw new Error('Invalid ZIP file header returned by NSE archives');
    }

    // Pure Node ZIP deflation
    const fnLen = buf.readUInt16LE(26);
    const extraLen = buf.readUInt16LE(28);
    const dataOffset = 30 + fnLen + extraLen;
    const compSize = buf.readUInt32LE(18);
    const compData = buf.subarray(dataOffset, dataOffset + compSize);
    const csvContent = zlib.inflateRawSync(compData).toString('utf8');

    const oiBySymbol = {};
    const pdhBySymbol = {};
    const lines = csvContent.split(/\r?\n/);

    if (lines.length < 2) {
      throw new Error('Bhavcopy CSV is empty');
    }

    const currentMonthPrefix = dateStr.slice(0, 7);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.split(',');

      // FinInstrmTp: 'STF' (Stock Futures) or 'IDF' (Index Futures)
      const instType = parts[4];
      if (instType === 'STF' || instType === 'IDF') {
        const symbol = parts[7]?.trim().toUpperCase();
        const expiry = parts[9]?.trim();
        const high = parseFloat(parts[15]) || null;
        const low = parseFloat(parts[16]) || null;
        const close = parseFloat(parts[17]) || null;
        const oi = parseInt(parts[22]) || 0;

        if (!symbol || !expiry) continue;

        // Near-month contract
        const isNearMonth = expiry.startsWith(currentMonthPrefix);
        if (isNearMonth || !oiBySymbol[symbol]) {
          oiBySymbol[symbol] = oi;
          pdhBySymbol[symbol] = { high, low, close };
        }
      }
    }

    // Map both by underlying symbol AND by instrument_key token
    const combinedOiMap = { ...oiBySymbol };
    const combinedPdhMap = { ...pdhBySymbol };

    if (universe && universe.length > 0) {
      for (const u of universe) {
        const sym = (u.underlying || u.name || u.tradingsymbol || '').toUpperCase();
        if (sym && oiBySymbol[sym]) {
          combinedOiMap[u.instrument_key] = oiBySymbol[sym];
        }
        if (sym && pdhBySymbol[sym]) {
          combinedPdhMap[u.instrument_key] = pdhBySymbol[sym];
        }
      }
    }

    const count = Object.keys(oiBySymbol).length;
    logger.info(`Successfully parsed NSE F&O Bhavcopy: ${count} underlyings indexed with closing OI and PDH/PDL`);

    // Persist to disk
    oiCache.save(combinedOiMap, dateStr);
    pdhCache.save(combinedPdhMap);

    return { oiMap: combinedOiMap, pdhMap: combinedPdhMap };
  } catch (err) {
    logger.warn(`Could not download NSE F&O Bhavcopy for ${dateStr} (${err.message}). Falling back to cached data.`);
    return {
      oiMap: cachedOi?.data || {},
      pdhMap: cachedPdh || {}
    };
  }
}

module.exports = {
  fetchFoBhavcopy
};
