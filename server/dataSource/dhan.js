const axios = require('axios');
const csv = require('csv-parser');
const { DhanFeed, NSE_FNO, IDX, Quote, NSE } = require('dhanhq');
const pdhCache = require('../utils/pdhCache');
const logger = require('../utils/logger');

let dhanFeed = null;
let onTickCallback = null;
let subscribedInstruments = [];
let universeListGlobal = [];

// Track previous close/OI since it comes in different packets
const prevDataMap = {};

// Reconnection state
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 120000; // 2 minutes max

const TARGET_INDICES = [
  'NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY FMCG', 'NIFTY AUTO',
  'NIFTY PHARMA', 'NIFTY METAL', 'NIFTY PSU BANK', 'NIFTY FIN SERVICE',
  'NIFTY MIDCAP 50', 'NIFTY MID SELECT', 'NIFTY CONSUMPTION', 'NIFTY MIDCAP 150'
];

// Helper: get Yahoo Finance client (v3 requires constructor)
let _yfInstance = null;
function getYahooFinance() {
  if (!_yfInstance) {
    const YahooFinance = require('yahoo-finance2').default;
    _yfInstance = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });
  }
  return _yfInstance;
}

module.exports = {
  init: async () => {
    logger.info('Dhan API initialized');
    return true;
  },

  getFnoUniverse: async () => {
    logger.info('Downloading Dhan API scrip master...');
    try {
      const response = await axios({
        url: 'https://images.dhan.co/api-data/api-scrip-master.csv',
        method: 'GET',
        responseType: 'stream'
      });

      const allInstruments = [];
      await new Promise((resolve, reject) => {
        response.data
          .pipe(csv())
          .on('data', (data) => allInstruments.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      logger.info(`Total instruments downloaded: ${allInstruments.length}`);

      const universe = [];

      // Group futures by underlying symbol
      // In Dhan CSV: SEM_EXM_EXCH_ID = 'NSE', SEM_INSTRUMENT_NAME = 'FUTSTK'
      const futureGroups = {};
      allInstruments.forEach(inst => {
        if (inst.SEM_EXM_EXCH_ID === 'NSE' && inst.SEM_INSTRUMENT_NAME === 'FUTSTK') {
          const tradingSymbol = inst.SEM_TRADING_SYMBOL || '';
          const cleanUnderlying = tradingSymbol.split('-')[0];
          
          // Filter out test instruments
          if (cleanUnderlying && !cleanUnderlying.includes('TEST') && /^[A-Z]/.test(cleanUnderlying)) {
            if (!futureGroups[cleanUnderlying]) {
              futureGroups[cleanUnderlying] = [];
            }
            futureGroups[cleanUnderlying].push(inst);
          }
        }
      });

      // Find nearest expiry for each underlying
      for (const symbol in futureGroups) {
        const futures = futureGroups[symbol];
        const validFutures = futures.filter(f => f.SEM_EXPIRY_DATE);

        if (validFutures.length > 0) {
          validFutures.sort((a, b) => new Date(a.SEM_EXPIRY_DATE) - new Date(b.SEM_EXPIRY_DATE));
          const currentMonthFuture = validFutures[0];
          
          universe.push({
            instrument_key: currentMonthFuture.SEM_SMST_SECURITY_ID,
            tradingsymbol: currentMonthFuture.SEM_TRADING_SYMBOL,
            name: symbol,
            underlying: symbol,
            type: 'STOCK',
            exchangeSegment: NSE_FNO
          });
        }
      }

      // Add indices
      allInstruments.forEach(inst => {
        if (inst.SEM_EXM_EXCH_ID === 'NSE' && inst.SEM_INSTRUMENT_NAME === 'INDEX' && TARGET_INDICES.includes(inst.SM_SYMBOL_NAME.toUpperCase())) {
          universe.push({
            instrument_key: inst.SEM_SMST_SECURITY_ID,
            tradingsymbol: inst.SEM_TRADING_SYMBOL,
            name: inst.SM_SYMBOL_NAME,
            type: 'INDEX',
            exchangeSegment: IDX
          });
        }
      });

      universeListGlobal = universe;
      const stockCount = universe.filter(u => u.type === 'STOCK').length;
      const indexCount = universe.filter(u => u.type === 'INDEX').length;
      logger.info(`F&O Universe prepared: ${universe.length} symbols (${stockCount} stocks, ${indexCount} indices)`);
      return universe;
    } catch (err) {
      logger.error('Failed to get F&O universe from Dhan:', err.message);
      return [];
    }
  },

  getPrevDayHL: async (universeList) => {
    try {
      const yf = getYahooFinance();
      const pdhData = {};
      
      logger.info(`Fetching PDH/PDL for ${universeList.length} symbols using Yahoo Finance...`);
      
      const chunks = [];
      for (let i = 0; i < universeList.length; i += 20) {
        chunks.push(universeList.slice(i, i + 20));
      }

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const today = new Date();

      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (u) => {
          try {
            let yfSymbol = '';
            if (u.type === 'STOCK') {
              yfSymbol = `${u.underlying}.NS`;
            } else if (u.type === 'INDEX') {
              if (u.name === 'NIFTY 50') yfSymbol = '^NSEI';
              else if (u.name === 'NIFTY BANK') yfSymbol = '^NSEBANK';
              else return;
            } else {
              return;
            }

            const result = await yf.historical(yfSymbol, {
              period1: oneWeekAgo,
              period2: today,
              interval: '1d'
            });
            
            if (result && result.length > 0) {
              // Get the PREVIOUS trading day's candle (not today's)
              let prevDayCandle = result[result.length - 1];
              const lastCandleDate = new Date(prevDayCandle.date);
              if (lastCandleDate.getDate() === today.getDate() && lastCandleDate.getMonth() === today.getMonth()) {
                 if (result.length > 1) {
                   prevDayCandle = result[result.length - 2];
                 }
              }
              
              pdhData[u.instrument_key] = {
                high: prevDayCandle.high,
                low: prevDayCandle.low
              };
            }
          } catch (e) {
            // Silently ignore individual failures
          }
        }));
        await new Promise(r => setTimeout(r, 500));
      }

      logger.info('PDH/PDL fetching complete');
      return pdhData;
    } catch (err) {
      logger.error('Failed to get PDH/PDL:', err.message);
      const fallback = {};
      universeList.forEach(u => fallback[u.instrument_key] = { high: null, low: null });
      return fallback;
    }
  },

  // NEW: Load last trading day's closing data for offline display
  getLastDaySnapshot: async (universeList) => {
    try {
      const yf = getYahooFinance();
      const snapshot = [];

      logger.info('Loading last trading day snapshot from Yahoo Finance...');

      const chunks = [];
      for (let i = 0; i < universeList.length; i += 20) {
        chunks.push(universeList.slice(i, i + 20));
      }

      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const today = new Date();

      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (u) => {
          try {
            let yfSymbol = '';
            if (u.type === 'STOCK') {
              yfSymbol = `${u.underlying}.NS`;
            } else if (u.type === 'INDEX') {
              if (u.name === 'NIFTY 50') yfSymbol = '^NSEI';
              else if (u.name === 'NIFTY BANK') yfSymbol = '^NSEBANK';
              else return;
            } else {
              return;
            }

            const result = await yf.historical(yfSymbol, {
              period1: twoWeeksAgo,
              period2: today,
              interval: '1d'
            });

            if (result && result.length >= 2) {
              // Last candle = today/most recent close
              // Second-to-last = previous day close (for % change calculation)
              const lastCandle = result[result.length - 1];
              const prevCandle = result[result.length - 2];

              snapshot.push({
                instrument_key: u.instrument_key,
                ltp: lastCandle.close,
                close: prevCandle.close,  // previous day close (for % change calc)
                open: lastCandle.open,
                volume: lastCandle.volume || 0,
                high: lastCandle.high,
                low: lastCandle.low,
                prevHigh: prevCandle.high,
                prevLow: prevCandle.low,
              });
            }
          } catch (e) {
            // skip failed symbols
          }
        }));
        await new Promise(r => setTimeout(r, 500));
      }

      logger.info(`Last day snapshot loaded for ${snapshot.length} symbols`);
      return snapshot;
    } catch (err) {
      logger.error('Failed to load last day snapshot:', err.message);
      return [];
    }
  },

  subscribeLive: (onTick) => {
    onTickCallback = onTick;

    const clientId = process.env.DHAN_CLIENT_ID;
    const accessToken = process.env.DHAN_ACCESS_TOKEN;

    if (!clientId || !accessToken) {
      logger.error('DHAN_CLIENT_ID or DHAN_ACCESS_TOKEN not found in environment');
      return;
    }

    subscribedInstruments = universeListGlobal.map(u => [u.exchangeSegment, u.instrument_key]);

    logger.info(`Connecting to Dhan Websocket for ${subscribedInstruments.length} instruments`);

    // Create DhanFeed instance to reuse its binary packet parsers
    dhanFeed = new DhanFeed(
      clientId,
      accessToken,
      subscribedInstruments,
      Quote,
      null, null, null
    );

    reconnectAttempts = 0;
    connectNativeWs(clientId, accessToken);
  }
};

let wsInstance = null;

function getExchangeSegmentStr(num) {
  if (num === NSE_FNO || num === 2) return "NSE_FNO";
  if (num === IDX || num === 0) return "IDX_I";
  if (num === NSE || num === 1) return "NSE_EQ";
  return "NSE_EQ";
}

function isMarketHours() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const day = ist.getDay();
  
  if (day === 0 || day === 6) return false;
  const timeInMinutes = hours * 60 + minutes;
  return timeInMinutes >= 540 && timeInMinutes <= 930; // 9:00 - 15:30
}

function connectNativeWs(clientId, accessToken) {
  const WebSocket = require('ws');
  const url = `wss://api-feed.dhan.co?version=2&token=${accessToken}&clientId=${clientId}&authType=2`;
  
  wsInstance = new WebSocket(url);
  
  wsInstance.on('open', async () => {
    logger.info('Dhan WebSocket connected');
    // Don't reset reconnectAttempts here — only reset when we receive actual data
    
    const chunkSize = 100;
    for (let i = 0; i < subscribedInstruments.length; i += chunkSize) {
      const chunk = subscribedInstruments.slice(i, i + chunkSize);
      
      const payload = {
        RequestCode: 21,
        InstrumentCount: chunk.length,
        InstrumentList: chunk.map(inst => ({
          ExchangeSegment: getExchangeSegmentStr(inst[0]),
          SecurityId: String(inst[1])
        }))
      };
      
      wsInstance.send(JSON.stringify(payload));
    }
    logger.info(`Subscribed to ${subscribedInstruments.length} instruments in Dhan`);
  });

  wsInstance.on('message', (data) => {
    try {
      if (!Buffer.isBuffer(data)) return;
      
      // We received actual data — connection is working, reset backoff
      reconnectAttempts = 0;
      
      const code = data.readUInt8(0);
      let parsed = null;
      
      if (code === 2) parsed = dhanFeed.processTickerPacket(data);
      else if (code === 3) parsed = dhanFeed.processMarketDepthPacket(data);
      else if (code === 4) parsed = dhanFeed.processQuotePacket(data);
      else if (code === 5) parsed = dhanFeed.processOIDataPacket(data);
      else if (code === 6) parsed = dhanFeed.processPrevClosePacket(data);
      else if (code === 7) parsed = dhanFeed.processMarketStatusPacket(data);
      else if (code === 8) parsed = dhanFeed.processQuotePacket(data);
      else if (code === 50) {
        logger.error('Dhan WS: Server disconnection packet received');
        return;
      }
      
      if (parsed) handleParsedMessage(parsed);
    } catch (err) {
      // ignore parse errors
    }
  });

  wsInstance.on('error', (err) => {
    logger.error(`Dhan WS Error: ${err.message}`);
  });

  wsInstance.on('close', (code, reason) => {
    reconnectAttempts++;
    
    let delay;
    if (!isMarketHours()) {
      // Market closed: use longer intervals (60s, 120s, max 5min)
      delay = Math.min(60000 * Math.pow(2, reconnectAttempts - 1), 300000);
      logger.warn(`Dhan WebSocket closed (code ${code}). Market is closed. Will retry in ${Math.round(delay/1000)}s...`);
    } else {
      // Market open: use shorter intervals (5s, 10s, 20s, max 2min)
      delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
      logger.warn(`Dhan WebSocket closed (code ${code}). Reconnecting in ${Math.round(delay/1000)}s (attempt ${reconnectAttempts})...`);
    }
    
    setTimeout(() => {
      connectNativeWs(clientId, accessToken);
    }, delay);
  });
}

function handleParsedMessage(parsed) {
  if (!parsed) return;

  if (parsed.type === 'Quote Packet') {
    const key = String(parsed.securityId);
    const tick = {
      instrument_key: key,
      ltp: parsed.ltp,
      close: parsed.closePrice,
      open: parsed.openPrice,
      volume: parsed.volume || 0,
    };
    if (prevDataMap[key] && prevDataMap[key].prevOpenInterest) {
       tick.previousOi = prevDataMap[key].prevOpenInterest;
    }
    if (onTickCallback) onTickCallback([tick]);
  }
  else if (parsed.type === 'Prev Close Packet') {
    const key = String(parsed.securityId);
    if (!prevDataMap[key]) prevDataMap[key] = {};
    prevDataMap[key].prevClosePrice = parsed.prevClosePrice;
    prevDataMap[key].prevOpenInterest = parsed.prevOpenInterest;
  }
  else if (parsed.type === 'OI Data Packet') {
    const key = String(parsed.securityId);
    let oi_change_pct = 0;
    const oi = parsed.openInterest;
    const prevOi = prevDataMap[key] ? prevDataMap[key].prevOpenInterest : 0;
    if (oi && prevOi && prevOi > 0) {
       oi_change_pct = ((oi - prevOi) / prevOi) * 100;
    }
    if (onTickCallback) {
      onTickCallback([{
        instrument_key: key,
        oi: oi,
        oi_change_pct: oi_change_pct
      }]);
    }
  }
}
