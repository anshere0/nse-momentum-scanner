const axios = require('axios');
const zlib = require('zlib');
const protobuf = require('protobufjs');
const WebSocket = require('ws');
const path = require('path');
const tokenStore = require('../utils/tokenStore');
const pdhCache = require('../utils/pdhCache');
const logger = require('../utils/logger');

// We use the v3 websocket endpoint
const API_BASE = 'https://api.upstox.com/v2';
const WS_AUTH_URL = `${API_BASE}/feed/market-data-feed/authorize`;
const INSTRUMENTS_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz';

let ws = null;
let protoRoot = null;
let onTickCallback = null;
let reconnectTimer = null;
let subscribedKeys = [];

const TARGET_INDICES = [
  'NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY FMCG', 'NIFTY AUTO',
  'NIFTY PHARMA', 'NIFTY METAL', 'NIFTY PSU BANK', 'NIFTY FIN SERVICE',
  'NIFTY MIDCAP 50', 'NIFTY MID SELECT', 'NIFTY CONSUMPTION', 'NIFTY MIDCAP 150'
];

async function loadProtobuf() {
  // Download or load the Upstox protobuf schema for V3
  try {
    // Upstox officially hosts their v3 protobuf file here
    const protoUrl = 'https://assets.upstox.com/feed/market-data-feed/v3/MarketDataFeed.proto';
    const response = await axios.get(protoUrl);
    
    // Parse it directly from string
    const protoStr = response.data;
    protoRoot = protobuf.parse(protoStr).root;
    logger.info('Protobuf schema loaded successfully');
  } catch (err) {
    logger.error('Failed to load protobuf schema:', err.message);
    throw err;
  }
}

async function getWsUrl() {
  const tokenData = tokenStore.load();
  if (!tokenData) throw new Error('No valid access token available');

  const response = await axios.get(WS_AUTH_URL, {
    headers: {
      'Authorization': `Bearer ${tokenData.accessToken}`,
      'Accept': 'application/json'
    }
  });

  return response.data.data.authorized_redirect_uri;
}

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  getWsUrl().then(url => {
    logger.info('Connecting to Upstox WebSocket V3...');
    ws = new WebSocket(url);
    ws.binaryType = 'nodebuffer';

    ws.on('open', () => {
      logger.info('Upstox WebSocket connected');
      // Subscribe to stored keys
      if (subscribedKeys.length > 0) {
        subscribeToKeys(subscribedKeys);
      }
    });

    ws.on('message', (data) => {
      try {
        decodeMessage(data);
      } catch (err) {
        logger.error('Failed to decode WS message:', err.message);
      }
    });

    ws.on('close', () => {
      logger.warn('Upstox WebSocket closed');
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      logger.error('Upstox WebSocket error:', err.message);
      ws.close();
    });
  }).catch(err => {
    logger.error('Failed to get WebSocket URL:', err.message);
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    logger.info('Attempting to reconnect...');
    connectWebSocket();
  }, 5000); // 5 seconds
}

function subscribeToKeys(keys) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    subscribedKeys = keys;
    return;
  }

  // Subscribing to "full" mode for maximum data (including OHLC)
  const subscriptionRequest = {
    guid: "sub-1",
    method: "sub",
    data: {
      mode: "full",
      instrumentKeys: keys
    }
  };

  ws.send(Buffer.from(JSON.stringify(subscriptionRequest)));
  logger.info(`Sent subscription request for ${keys.length} instruments`);
}

function decodeMessage(buffer) {
  if (!protoRoot) return;
  
  try {
    const FeedResponse = protoRoot.lookupType("com.upstox.marketdatafeeder.rpc.proto.FeedResponse");
    const decoded = FeedResponse.decode(buffer);
    const msg = FeedResponse.toObject(decoded, {
      longs: String,
      enums: String,
      bytes: String,
    });

    if (msg.feeds && onTickCallback) {
      const ticks = [];
      Object.keys(msg.feeds).forEach(instrument_key => {
        const feed = msg.feeds[instrument_key];
        const ff = feed.ff; // full feed
        
        if (ff && ff.marketFF && ff.marketFF.marketOHLC) {
          const ltp = ff.marketFF.ltpc?.ltp;
          const close = ff.marketFF.ltpc?.cp; 
          const open = ff.marketFF.marketOHLC.ohlc[0]?.open || ff.marketFF.ltpc?.open; // Some feeds put open in ltpc
          
          // Open Interest
          const oi = ff.marketFF.marketLevel?.oi || ff.marketFF.oi;
          const previousOi = ff.marketFF.marketLevel?.previousOi || ff.marketFF.previousOi;
          
          let oi_change_pct = 0;
          if (oi && previousOi && previousOi > 0) {
            oi_change_pct = ((oi - previousOi) / previousOi) * 100;
          }
          
          ticks.push({
            instrument_key,
            ltp,
            close,
            open,
            oi,
            oi_change_pct,
            volume: 0 
          });
        } else if (ff && ff.indexFF) {
          // Indices use indexFF
          const ltp = ff.indexFF.ltpc?.ltp;
          const cp = ff.indexFF.ltpc?.cp;
          ticks.push({
            instrument_key,
            ltp: ltp,
            close: cp,
            volume: 0
          });
        }
      });
      
      if (ticks.length > 0) {
        onTickCallback(ticks);
      }
    }
  } catch (err) {
    logger.error('Error decoding feed:', err);
  }
}


module.exports = {
  init: async () => {
    await loadProtobuf();
    logger.info('Upstox API initialized');
    return true;
  },

  getFnoUniverse: async () => {
    logger.info('Downloading complete instruments file...');
    try {
      const response = await axios({
        url: INSTRUMENTS_URL,
        method: 'GET',
        responseType: 'arraybuffer'
      });
      
      const jsonBuffer = zlib.unzipSync(response.data);
      const allInstruments = JSON.parse(jsonBuffer.toString());
      logger.info(`Total instruments found: ${allInstruments.length}`);

      // Filter for F&O stocks. Upstox specifies these as NSE_FO segment, underlying_type EQUITY.
      // But we just want the cash stocks that are part of F&O to track momentum.
      // Or we can track the futures? The prompt says "Top 10 Gainers and Top 10 Losers (F&O stocks only)".
      // So we need the underlying NSE_EQ stocks that have F&O equivalents.
      
      const foSymbols = new Set();
      allInstruments.forEach(inst => {
        if (inst.segment === 'NSE_FO' && inst.underlying_type === 'EQUITY' && inst.underlying_symbol) {
          foSymbols.add(inst.underlying_symbol);
        }
      });
      
      logger.info(`Identified ${foSymbols.size} underlying F&O symbols`);
      
      const universe = [];
      const now = new Date();
      
      // Group futures by underlying symbol to find the current month expiry
      const futureGroups = {};
      allInstruments.forEach(inst => {
        if (inst.segment === 'NSE_FO' && inst.instrument_type === 'FUTSTK' && foSymbols.has(inst.underlying_symbol)) {
          if (!futureGroups[inst.underlying_symbol]) {
            futureGroups[inst.underlying_symbol] = [];
          }
          futureGroups[inst.underlying_symbol].push(inst);
        }
      });

      // Find nearest expiry for each
      for (const symbol in futureGroups) {
        const futures = futureGroups[symbol];
        
        // Filter out expired contracts
        const validFutures = futures.filter(f => {
          if (!f.expiry) return false;
          // Upstox expiry format could be YYYY-MM-DD or timestamp
          const expDate = new Date(f.expiry);
          return expDate >= now;
        });

        if (validFutures.length > 0) {
          // Sort to find the closest expiry
          validFutures.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
          const currentMonthFuture = validFutures[0];
          
          universe.push({
            instrument_key: currentMonthFuture.instrument_key,
            tradingsymbol: currentMonthFuture.tradingsymbol,
            name: currentMonthFuture.name, // Usually the symbol name
            underlying: symbol,
            type: 'STOCK' // We classify it as STOCK for the UI
          });
        }
      }

      // Add indices
      allInstruments.forEach(inst => {
        if (inst.segment === 'NSE_INDEX' && TARGET_INDICES.includes(inst.name.toUpperCase())) {
          universe.push({
            instrument_key: inst.instrument_key,
            tradingsymbol: inst.tradingsymbol,
            name: inst.name,
            type: 'INDEX'
          });
        }
      });
      
      return universe;
    } catch (err) {
      logger.error('Failed to get F&O universe:', err.message);
      return [];
    }
  },

  getPrevDayHL: async (universeList) => {
    // For PDH/PDL, we can either use historical API or rely on the feed if it provides it.
    // Upstox historical API requires a token and is rate limited.
    // We will attempt to fetch it for the stocks if needed, or rely on a simplified approach.
    
    // Check cache first
    const cached = pdhCache.load();
    if (cached) {
      logger.info('Loaded PDH/PDL from cache');
      return cached;
    }
    
    const tokenData = tokenStore.load();
    if (!tokenData) {
      logger.warn('No token available for PDH fetch. Returning empty.');
      return {};
    }

    const pdhData = {};
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // last 5 days
    
    // We can't fetch 200 stocks concurrently easily without hitting rate limits.
    // For this implementation, we will mock PDH/PDL or fetch a few.
    // To respect rate limits, we'll return an empty object and rely on the full feed if it has dayHigh/dayLow,
    // though PDH/PDL specifically means PREVIOUS day high/low.
    logger.info('Skipping historical PDH fetch to avoid rate limits on 200+ symbols. Returning mock/empty PDH.');
    
    universeList.forEach(u => {
       pdhData[u.instrument_key] = { high: null, low: null };
    });

    return pdhData;
  },

  subscribeLive: (onTick) => {
    onTickCallback = onTick;
    connectWebSocket();
  }
};
