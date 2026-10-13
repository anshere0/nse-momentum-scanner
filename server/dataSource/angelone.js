const axios = require('axios');
const WebSocket = require('ws');
const angelAuth = require('../services/angeloneAuth');
const instrumentMaster = require('../services/instrumentMaster');
const marketSession = require('../services/marketSession');
const tokenStore = require('../utils/tokenStore');
const pdhCache = require('../utils/pdhCache');
const oiCache = require('../utils/oiCache');
const logger = require('../utils/logger');

const API_BASE = angelAuth.API_BASE;
const WS_URL = 'wss://smartapisocket.angelone.in/smart-stream';
const QUOTE_URL = `${API_BASE}/rest/secure/angelbroking/market/v1/quote/`;
const HISTORICAL_URL = `${API_BASE}/rest/secure/angelbroking/historical/v1/getCandleData`;

// State
let ws = null;
let onTickCallback = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let quotePollingInterval = null;
let connectionStatus = 'DISCONNECTED'; // CONNECTED, DISCONNECTED, CONNECTING, ERROR, SESSION_EXPIRED
let authData = null; // { jwtToken, feedToken, refreshToken, apiKey, clientCode }
let universeList = [];
let wsHeartbeatInterval = null;

const MAX_RECONNECT_DELAY = 120000;
const QUOTE_BATCH_SIZE = 50; // Angel One allows up to 50 tokens per quote request
const QUOTE_POLL_INTERVAL = 10000; // 10 seconds

/**
 * Initialize: authenticate + load instrument master
 */
async function init() {
  logger.info('Initializing Angel One data source...');

  // Step 1: Authenticate
  const apiKey = process.env.ANGEL_API_KEY;
  const clientCode = process.env.ANGEL_CLIENT_CODE;
  const pin = process.env.ANGEL_PIN;
  const totpSecret = process.env.ANGEL_TOTP_SECRET;

  if (!apiKey || !clientCode || !pin || !totpSecret) {
    logger.warn('Angel One credentials not fully configured. Some features will be unavailable.');
    connectionStatus = 'ERROR';
  } else {
    try {
      const loginResult = await angelAuth.login(apiKey, clientCode, pin, totpSecret);
      authData = {
        ...loginResult,
        apiKey,
        clientCode
      };
      tokenStore.save({
        jwtToken: authData.jwtToken,
        refreshToken: authData.refreshToken,
        feedToken: authData.feedToken,
        clientCode: authData.clientCode,
        expiresAt: authData.expiresAt,
        loginTime: authData.loginTime
      });
      connectionStatus = 'CONNECTED';
    } catch (err) {
      logger.error('Angel One authentication failed:', err.message);
      connectionStatus = 'ERROR';
      // Try to use saved token
      const saved = tokenStore.load();
      if (saved && saved.jwtToken) {
        logger.info('Attempting to use saved token...');
        authData = { ...saved, apiKey, clientCode };
        connectionStatus = 'CONNECTED';
      }
    }
  }

  // Step 2: Load instrument master
  await instrumentMaster.initialize();
  logger.info('Angel One data source initialized');
  return true;
}

/**
 * Re-authenticate (for manual reconnect or session refresh)
 */
async function reconnect() {
  const apiKey = process.env.ANGEL_API_KEY;
  const clientCode = process.env.ANGEL_CLIENT_CODE;
  const pin = process.env.ANGEL_PIN;
  const totpSecret = process.env.ANGEL_TOTP_SECRET;

  if (!apiKey || !clientCode || !pin || !totpSecret) {
    throw new Error('Cannot reconnect: credentials not configured');
  }

  connectionStatus = 'CONNECTING';
  const loginResult = await angelAuth.login(apiKey, clientCode, pin, totpSecret);
  authData = { ...loginResult, apiKey, clientCode };
  tokenStore.save({
    jwtToken: authData.jwtToken,
    refreshToken: authData.refreshToken,
    feedToken: authData.feedToken,
    clientCode: authData.clientCode,
    expiresAt: authData.expiresAt,
    loginTime: authData.loginTime
  });
  connectionStatus = 'CONNECTED';

  // Reconnect WebSocket if it was previously connected
  if (onTickCallback) {
    connectWebSocket();
  }
}

/**
 * Get F&O universe
 */
async function getFnoUniverse() {
  const universe = instrumentMaster.getFnoUniverse();
  const indices = instrumentMaster.getIndices();
  universeList = [...universe, ...indices];
  return universeList;
}

/**
 * Get Cash equity universe (defaults to F&O-eligible cash equities for speed & quality)
 */
async function getCashUniverse(fnoOnly = true) {
  return instrumentMaster.getCashUniverse(fnoOnly);
}

/**
 * Get combined universe based on segment filter
 */
async function getUniverse(segment = 'BOTH') {
  const indices = instrumentMaster.getIndices();
  const fno = instrumentMaster.getFnoUniverse();
  const cash = instrumentMaster.getCashUniverse(true); // F&O eligible cash stocks

  if (segment === 'CASH') {
    universeList = [...cash, ...indices];
  } else if (segment === 'FNO') {
    universeList = [...fno, ...indices];
  } else {
    // BOTH - include both F&O futures and Cash equities
    universeList = [...fno, ...cash, ...indices];
  }

  return universeList;
}

/**
 * Get authenticated headers
 */
function getHeaders() {
  if (!authData) throw new Error('Not authenticated');
  return angelAuth.getAuthHeaders(authData.apiKey, authData.jwtToken);
}

/**
 * Fetch market quotes via REST API
 * @param {Array} instruments - Array of { instrument_key, exchange, exchangeType }
 * @param {string} mode - 'LTP', 'OHLC', or 'FULL'
 */
async function getMarketQuotes(instruments, mode = 'FULL') {
  if (!authData) {
    logger.warn('Cannot fetch quotes: not authenticated');
    return [];
  }

  // Group tokens by exchange
  const exchangeTokens = {};
  for (const inst of instruments) {
    const exchange = inst.exchange || 'NSE';
    if (!exchangeTokens[exchange]) exchangeTokens[exchange] = [];
    exchangeTokens[exchange].push(inst.instrument_key);
  }

  // Batch by QUOTE_BATCH_SIZE per exchange
  const allResults = [];

  for (const [exchange, tokens] of Object.entries(exchangeTokens)) {
    for (let i = 0; i < tokens.length; i += QUOTE_BATCH_SIZE) {
      const batch = tokens.slice(i, i + QUOTE_BATCH_SIZE);

      try {
        const response = await axios.post(QUOTE_URL, {
          mode,
          exchangeTokens: { [exchange]: batch }
        }, {
          headers: getHeaders(),
          timeout: 15000
        });

        if (response.data?.status && response.data?.data?.fetched) {
          allResults.push(...response.data.data.fetched);
        }
      } catch (err) {
        if (err.response?.status === 401) {
          connectionStatus = 'SESSION_EXPIRED';
          logger.error('Session expired during quote fetch');
        } else {
          logger.error(`Quote fetch error (${exchange} batch ${i}):`, err.message);
        }
      }

      // Rate limit delay between batches
      if (i + QUOTE_BATCH_SIZE < tokens.length) {
        await sleep(200);
      }
    }
  }

  return allResults;
}

let historicalApiSupported = true;

/**
 * Fetch historical candle data
 */
async function getHistoricalCandles(symboltoken, exchange, interval, fromdate, todate) {
  if (!authData || !historicalApiSupported) {
    return [];
  }

  try {
    const response = await axios.post(HISTORICAL_URL, {
      exchange,
      symboltoken,
      interval,
      fromdate,
      todate
    }, {
      headers: getHeaders(),
      timeout: 15000
    });

    if (response.data?.status && response.data?.data) {
      return response.data.data; // Array of [timestamp, open, high, low, close, volume]
    }
    return [];
  } catch (err) {
    if (err.response?.status === 401) {
      connectionStatus = 'SESSION_EXPIRED';
    } else if (err.response?.status === 403) {
      if (historicalApiSupported) {
        logger.info('Angel One Historical API requires separate add-on subscription (HTTP 403). Skipping historical candle queries.');
        historicalApiSupported = false;
      }
    } else {
      logger.error(`Historical fetch error (${symboltoken}):`, err.response?.data?.message || err.message);
    }
    return [];
  }
}

/**
 * Get previous day high/low for the universe
 */
async function getPrevDayHL(universeListParam) {
  // Check cache first
  const cached = pdhCache.load();
  if (cached) {
    logger.info('Loaded PDH/PDL from cache');
    return cached;
  }

  if (!authData) {
    logger.warn('No auth available for PDH fetch');
    const empty = {};
    universeListParam.forEach(u => { empty[u.instrument_key] = { high: null, low: null }; });
    return empty;
  }

  const pdhData = {};
  const lastTradingDay = marketSession.getLastCompletedTradingDay();
  const prevDays = marketSession.getPreviousTradingDays(lastTradingDay, 1);
  const prevDay = prevDays[0] || lastTradingDay;

  // We need data from 5 days ago to ensure we capture the previous trading day
  const fromDate = marketSession.getPreviousTradingDays(lastTradingDay, 5).pop() || lastTradingDay;

  logger.info(`Fetching PDH/PDL via historical API (from ${fromDate} to ${lastTradingDay})...`);

  const stocks = universeListParam.filter(u => u.type === 'STOCK');

  // Process in batches with rate limiting
  for (let i = 0; i < stocks.length; i++) {
    if (!historicalApiSupported) {
      break;
    }
    const u = stocks[i];
    try {
      // Use cash token if available, otherwise use the F&O token
      const token = u.cashToken || u.instrument_key;
      const exchange = u.cashToken ? 'NSE' : (u.exchange || 'NSE');

      const candles = await getHistoricalCandles(
        token,
        exchange,
        'ONE_DAY',
        `${fromDate} 09:15`,
        `${lastTradingDay} 15:30`
      );

      if (candles && candles.length >= 1) {
        // candles format: [[timestamp, open, high, low, close, volume], ...]
        // Get the last candle (most recent trading day's completed candle)
        const lastCandle = candles[candles.length - 1];
        // If we have at least 2, the previous day is second to last
        const prevCandle = candles.length >= 2 ? candles[candles.length - 2] : lastCandle;

        pdhData[u.instrument_key] = {
          high: prevCandle[2],   // high
          low: prevCandle[3],    // low
          close: prevCandle[4],  // close (for % change reference)
          date: prevCandle[0]    // timestamp
        };
      } else {
        pdhData[u.instrument_key] = { high: null, low: null };
      }
    } catch (err) {
      pdhData[u.instrument_key] = { high: null, low: null };
    }

    // Rate limit: 3 requests per second for historical
    if ((i + 1) % 3 === 0) {
      await sleep(1100);
    }
  }

  logger.info(`PDH/PDL fetched for ${Object.keys(pdhData).length} symbols`);
  return pdhData;
}

/**
 * Get previous month high/low
 */
async function getPrevMonthHL(universeListParam) {
  if (!authData) {
    logger.warn('No auth available for PMH fetch');
    return {};
  }

  const pmhData = {};
  const prevMonth = marketSession.getPreviousCompletedMonth();
  logger.info(`Fetching PMH/PML for ${prevMonth.label} (${prevMonth.firstDay} to ${prevMonth.lastDay})...`);

  const stocks = universeListParam.filter(u => u.type === 'STOCK');

  for (let i = 0; i < stocks.length; i++) {
    if (!historicalApiSupported) {
      break;
    }
    const u = stocks[i];
    try {
      const token = u.cashToken || u.instrument_key;
      const exchange = u.cashToken ? 'NSE' : (u.exchange || 'NSE');

      const candles = await getHistoricalCandles(
        token,
        exchange,
        'ONE_DAY',
        `${prevMonth.firstDay} 09:15`,
        `${prevMonth.lastDay} 15:30`
      );

      if (candles && candles.length > 0) {
        let monthHigh = -Infinity;
        let monthLow = Infinity;
        for (const c of candles) {
          if (c[2] > monthHigh) monthHigh = c[2];
          if (c[3] < monthLow) monthLow = c[3];
        }
        pmhData[u.instrument_key] = {
          high: monthHigh,
          low: monthLow,
          month: prevMonth.label
        };
      }
    } catch (err) {
      // skip
    }

    if ((i + 1) % 3 === 0) {
      await sleep(1100);
    }
  }

  logger.info(`PMH/PML fetched for ${Object.keys(pmhData).length} symbols`);
  return pmhData;
}

/**
 * Get last trading day snapshot (for display when market is closed)
 */
async function getLastDaySnapshot(universeListParam) {
  if (!authData) {
    logger.warn('No auth for snapshot. Using empty data.');
    return [];
  }

  const stocks = universeListParam.filter(u => u.type === 'STOCK');
  const indices = universeListParam.filter(u => u.type === 'INDEX');
  const lastTradingDay = marketSession.getLastCompletedTradingDay();

  logger.info(`Loading snapshot for ${stocks.length} stocks via Angel One market quotes...`);

  // Load cached reference OI to calculate genuine OI change %
  const cachedOiObj = oiCache.load();
  const refOiMap = (cachedOiObj && cachedOiObj.data) ? cachedOiObj.data : {};
  const currentOiMap = {};

  try {
    // Fast path: use batch market quotes (50 tokens per request) - takes ~1.5s total
    const quotes = await getMarketQuotes(stocks, 'FULL');
    if (quotes && quotes.length > 0) {
      const quoteMap = {};
      quotes.forEach(q => {
        if (q.symbolToken) quoteMap[q.symbolToken] = q;
      });

      const snapshot = [];
      stocks.forEach(u => {
        const q = quoteMap[u.instrument_key];
        if (q && q.ltp > 0) {
          const isFno = u.isFno ?? (u.exchange === 'NFO' || u.instrumentType === 'FUTSTK');
          const oiVal = isFno ? (parseInt(q.opnInterest) || 0) : 0;
          if (isFno && oiVal > 0) {
            currentOiMap[u.instrument_key] = oiVal;
          }

          // Calculate OI change % using NSE standard: ((Current OI - Prev OI) / Prev OI) * 100
          const prevOi = refOiMap[u.instrument_key] || 0;
          let oiChangePct = 0;
          if (isFno && prevOi > 0 && oiVal > 0) {
            oiChangePct = ((oiVal - prevOi) / prevOi) * 100;
          }

          snapshot.push({
            instrument_key: u.instrument_key,
            tradingsymbol: u.tradingsymbol,
            symbol: u.tradingsymbol,
            name: u.name,
            category: u.category || (isFno ? 'F&O' : 'Cash'),
            isFno,
            exchange: u.exchange,
            ltp: q.ltp,
            close: q.close || q.ltp,
            open: q.open || q.ltp,
            high: q.high || q.ltp,
            low: q.low || q.ltp,
            volume: q.tradeVolume || 0,
            oi: oiVal,
            previousOi: prevOi || oiVal,
            oi_change_pct: oiChangePct,
            prevHigh: q.high,
            prevLow: q.low,
            sessionDate: lastTradingDay
          });
        }
      });

      // If we don't have a baseline saved yet, save current OI as baseline
      if (Object.keys(currentOiMap).length > 0 && (!cachedOiObj || !cachedOiObj.data || Object.keys(cachedOiObj.data).length === 0)) {
        oiCache.save(currentOiMap, lastTradingDay);
      }

      logger.info(`Snapshot loaded: ${snapshot.length} stocks from Angel One in ~1 second`);
      return snapshot;
    }
  } catch (err) {
    logger.warn('Fast quote snapshot failed, falling back to historical:', err.message);
  }

  const snapshot = [];
  const fromDate = marketSession.getPreviousTradingDays(lastTradingDay, 5).pop() || lastTradingDay;

  for (let i = 0; i < stocks.length; i++) {
    if (!historicalApiSupported) {
      logger.info('Historical API not available (HTTP 403), skipping candle fallback');
      break;
    }
    const u = stocks[i];
    try {
      const token = u.cashToken || u.instrument_key;
      const exchange = u.cashToken ? 'NSE' : (u.exchange || 'NSE');

      const candles = await getHistoricalCandles(
        token,
        exchange,
        'ONE_DAY',
        `${fromDate} 09:15`,
        `${lastTradingDay} 15:30`
      );

      if (candles && candles.length >= 2) {
        const lastCandle = candles[candles.length - 1];
        const prevCandle = candles[candles.length - 2];

        snapshot.push({
          instrument_key: u.instrument_key,
          ltp: lastCandle[4],      // close price of last day = our "LTP"
          close: prevCandle[4],     // previous day close (for % change calc)
          open: lastCandle[1],
          high: lastCandle[2],
          low: lastCandle[3],
          volume: lastCandle[5] || 0,
          prevHigh: prevCandle[2],
          prevLow: prevCandle[3],
          sessionDate: lastTradingDay
        });
      } else if (candles && candles.length === 1) {
        const c = candles[0];
        snapshot.push({
          instrument_key: u.instrument_key,
          ltp: c[4],
          close: c[4],
          open: c[1],
          high: c[2],
          low: c[3],
          volume: c[5] || 0,
          sessionDate: lastTradingDay
        });
      }
    } catch (err) {
      // skip
    }

    if ((i + 1) % 3 === 0) {
      await sleep(1100);
    }
  }

  logger.info(`Last day snapshot loaded for ${snapshot.length} symbols via historical candles`);
  return snapshot;
}

/**
 * Subscribe to live data using WebSocket + REST polling
 */
function subscribeLive(onTick) {
  onTickCallback = onTick;

  if (authData) {
    // Start WebSocket for real-time LTP updates
    connectWebSocket();

    // Start REST quote polling for full data (OHLCV, OI)
    startQuotePolling();
  } else {
    logger.warn('Cannot subscribe to live data: not authenticated');
  }
}

/**
 * Connect to Angel One WebSocket v2
 */
function connectWebSocket() {
  if (!authData || !authData.feedToken) {
    logger.warn('Cannot connect WebSocket: no feed token');
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    logger.info('WebSocket already connected');
    return;
  }

  connectionStatus = 'CONNECTING';
  logger.info('Connecting to Angel One WebSocket...');

  try {
    ws = new WebSocket(WS_URL, {
      headers: {
        'Authorization': `Bearer ${authData.jwtToken}`,
        'x-api-key': authData.apiKey,
        'x-client-code': authData.clientCode,
        'x-feed-token': authData.feedToken
      }
    });

    ws.binaryType = 'arraybuffer';

    ws.on('open', () => {
      logger.info('Angel One WebSocket connected');
      connectionStatus = 'CONNECTED';
      reconnectAttempts = 0;

      // Subscribe to instruments
      subscribeToInstruments();

      // Start heartbeat
      startHeartbeat();
    });

    let tickBatch = [];
    let tickBatchTimer = null;

    ws.on('message', (data) => {
      try {
        if (data instanceof ArrayBuffer || Buffer.isBuffer(data)) {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
          const tick = decodeBinaryPacket(buffer);
          if (tick && onTickCallback) {
            tickBatch.push(tick);
            if (!tickBatchTimer) {
              tickBatchTimer = setTimeout(() => {
                const batch = tickBatch;
                tickBatch = [];
                tickBatchTimer = null;
                if (batch.length > 0) {
                  onTickCallback(batch);
                }
              }, 50);
            }
          }
        }
      } catch (err) {
        // Silently handle parse errors to avoid log spam
      }
    });

    ws.on('close', (code, reason) => {
      if (tickBatchTimer) {
        clearTimeout(tickBatchTimer);
        tickBatchTimer = null;
      }
      tickBatch = [];
      logger.warn(`Angel One WebSocket closed (code: ${code})`);
      connectionStatus = 'DISCONNECTED';
      stopHeartbeat();
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      logger.error('Angel One WebSocket error:', err.message);
      connectionStatus = 'ERROR';
      if (ws) ws.close();
    });
  } catch (err) {
    logger.error('Failed to create WebSocket:', err.message);
    connectionStatus = 'ERROR';
    scheduleReconnect();
  }
}

/**
 * Subscribe to instruments on WebSocket
 */
function subscribeToInstruments() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  // Group tokens by exchange type
  const tokensByExchange = {};
  for (const inst of universeList) {
    const et = inst.exchangeType || 1;
    if (!tokensByExchange[et]) tokensByExchange[et] = [];
    tokensByExchange[et].push(inst.instrument_key);
  }

  const tokenList = [];
  for (const [exchangeType, tokens] of Object.entries(tokensByExchange)) {
    // Split into chunks of 1000 (WebSocket limit)
    for (let i = 0; i < tokens.length; i += 1000) {
      tokenList.push({
        exchangeType: parseInt(exchangeType),
        tokens: tokens.slice(i, i + 1000)
      });
    }
  }

  if (tokenList.length === 0) return;

  const subscriptionMessage = JSON.stringify({
    correlationID: 'scanner_sub_' + Date.now(),
    action: 1, // Subscribe
    params: {
      mode: 3, // Snap Quote mode: LTP + OHLCV + Open Interest
      tokenList
    }
  });

  ws.send(subscriptionMessage);
  logger.info(`WebSocket subscription sent (Snap Quote Mode 3) for ${universeList.length} instruments`);
}

/**
 * Decode binary WebSocket packet (Angel One v2 format, Little Endian)
 */
function decodeBinaryPacket(buffer) {
  if (buffer.length < 51) return null; // Minimum LTP packet size

  try {
    const mode = buffer.readUInt8(0);
    const exchangeType = buffer.readUInt8(1);
    const token = buffer.subarray(2, 27).toString('utf8').replace(/\0/g, '').trim();

    if (!token) return null;

    const ltp = Number(buffer.readBigInt64LE(43)) / 100;
    if (ltp <= 0) return null;

    const tick = {
      instrument_key: token,
      ltp,
      exchangeType
    };

    // Quote mode (mode 2): additional OHLCV fields
    if (mode >= 2 && buffer.length >= 123) {
      tick.volume = Number(buffer.readBigInt64LE(67));
      tick.open = Number(buffer.readBigInt64LE(91)) / 100;
      tick.high = Number(buffer.readBigInt64LE(99)) / 100;
      tick.low = Number(buffer.readBigInt64LE(107)) / 100;
      tick.close = Number(buffer.readBigInt64LE(115)) / 100;
    }

    // Snap Quote mode (mode 3): OI fields
    if (mode >= 3 && buffer.length >= 147) {
      tick.oi = Number(buffer.readBigInt64LE(131));
    }

    return tick;
  } catch (err) {
    return null;
  }
}

/**
 * WebSocket heartbeat to keep connection alive
 */
function startHeartbeat() {
  stopHeartbeat();
  wsHeartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.ping();
      } catch {
        // ignore ping errors
      }
    }
  }, 25000); // Every 25 seconds
}

function stopHeartbeat() {
  if (wsHeartbeatInterval) {
    clearInterval(wsHeartbeatInterval);
    wsHeartbeatInterval = null;
  }
}

/**
 * Schedule WebSocket reconnection with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectAttempts++;

  const isMarketOpen = marketSession.isMarketOpen();
  let delay;

  if (!isMarketOpen) {
    delay = Math.min(60000 * Math.pow(2, reconnectAttempts - 1), 300000);
  } else {
    delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
  }

  logger.info(`WebSocket reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts})...`);

  reconnectTimer = setTimeout(() => {
    connectWebSocket();
  }, delay);
}

/**
 * REST quote polling for full market data (OHLCV, OI)
 */
function startQuotePolling() {
  stopQuotePolling();

  // Initial poll
  pollQuotes();

  quotePollingInterval = setInterval(() => {
    if (marketSession.isMarketOpen() || marketSession.isPreOpen()) {
      pollQuotes();
    }
  }, QUOTE_POLL_INTERVAL);
}

function stopQuotePolling() {
  if (quotePollingInterval) {
    clearInterval(quotePollingInterval);
    quotePollingInterval = null;
  }
}

/**
 * Poll full quotes for all instruments
 */
async function pollQuotes() {
  if (!authData || universeList.length === 0) return;

  try {
    const stocks = universeList.filter(u => u.type === 'STOCK');

    // Query each instrument using its direct instrument key and exchange
    const quoteInstruments = stocks.map(u => ({
      instrument_key: u.instrument_key,
      exchange: u.exchange || (u.instrumentType === 'FUTSTK' ? 'NFO' : 'NSE'),
      originalKey: u.instrument_key,
      isFno: u.isFno ?? (u.exchange === 'NFO' || u.instrumentType === 'FUTSTK')
    }));

    const results = await getMarketQuotes(quoteInstruments, 'FULL');

    if (results.length > 0 && onTickCallback) {
      const ticks = results.map(r => {
        const original = quoteInstruments.find(q => q.instrument_key === r.symbolToken);
        const key = original ? original.originalKey : r.symbolToken;
        const isFno = original ? original.isFno : (r.exchange === 'NFO');
        const matched = universeList.find(u => u.instrument_key === key);

        return {
          instrument_key: key,
          tradingsymbol: matched?.tradingsymbol || r.tradingSymbol,
          name: matched?.underlying || matched?.name,
          ltp: parseFloat(r.ltp) || 0,
          close: parseFloat(r.close) || 0,
          open: parseFloat(r.open) || 0,
          high: parseFloat(r.high) || 0,
          low: parseFloat(r.low) || 0,
          volume: parseInt(r.tradeVolume) || 0,
          oi: isFno ? (parseInt(r.opnInterest) || 0) : 0,
        };
      }).filter(t => t.ltp > 0);

      if (ticks.length > 0) {
        onTickCallback(ticks);
      }
    }
  } catch (err) {
    logger.error('Quote polling error:', err.message);
  }
}

/**
 * Get connection status
 */
function getConnectionStatus() {
  return connectionStatus;
}

/**
 * Stop all connections and polling
 */
function disconnect() {
  stopQuotePolling();
  stopHeartbeat();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) {
    ws.close();
    ws = null;
  }
  connectionStatus = 'DISCONNECTED';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  init,
  reconnect,
  getFnoUniverse,
  getCashUniverse,
  getUniverse,
  getPrevDayHL,
  getPrevMonthHL,
  getLastDaySnapshot,
  subscribeLive,
  getMarketQuotes,
  getHistoricalCandles,
  getConnectionStatus,
  disconnect
};
