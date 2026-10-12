const logger = require('../utils/logger');
const marketSession = require('../services/marketSession');

// Mock data generator for local development & automated offline testing
const mockFnoSymbols = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BAJFINANCE',
  'BHARTIARTL', 'KOTAKBANK', 'ITC', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI',
  'SUNPHARMA', 'HCLTECH', 'TITAN', 'ULTRACEMCO', 'WIPRO', 'TATASTEEL'
];

const mockIndices = [
  'NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY FMCG', 'NIFTY AUTO',
  'NIFTY PHARMA', 'NIFTY METAL', 'NIFTY PSU BANK', 'NIFTY FIN SERVICE',
  'NIFTY MIDCAP 50'
];

let onTickCallback = null;
let mockInterval = null;

const universe = [
  ...mockFnoSymbols.map((sym, idx) => ({
    instrument_key: String(1000 + idx),
    tradingsymbol: sym,
    name: sym,
    type: 'STOCK',
    exchange: 'NSE',
    exchangeType: 1,
    lotsize: 250,
    segment: 'NSE_EQ',
    cashToken: String(1000 + idx)
  })),
  ...mockIndices.map((sym, idx) => ({
    instrument_key: String(2000 + idx),
    tradingsymbol: sym,
    name: sym,
    type: 'INDEX',
    exchange: 'NSE',
    exchangeType: 1,
    lotsize: 1,
    segment: 'NSE_EQ'
  }))
];

// Initial mock base prices
const mockData = {};
universe.forEach(inst => {
  const isIndex = inst.type === 'INDEX';
  const basePrice = isIndex ? 20000 + Math.random() * 5000 : 200 + Math.random() * 2800;
  mockData[inst.instrument_key] = {
    close: Math.round(basePrice * 100) / 100,
    ltp: Math.round(basePrice * (1 + (Math.random() - 0.5) * 0.04) * 100) / 100,
    oi: 500000 + Math.floor(Math.random() * 2000000),
    previousOi: 500000 + Math.floor(Math.random() * 2000000)
  };
});

module.exports = {
  init: async () => {
    logger.info('Mock Data Source initialized');
    return true;
  },

  reconnect: async () => {
    logger.info('Mock Data Source reconnected');
    return true;
  },

  getFnoUniverse: async () => {
    return universe.filter(u => u.type === 'STOCK');
  },

  getCashUniverse: async () => {
    return universe.filter(u => u.type === 'STOCK');
  },

  getUniverse: async (segment = 'BOTH') => {
    return universe;
  },

  getIndices: () => {
    return universe.filter(u => u.type === 'INDEX');
  },

  getPrevDayHL: async (universeList) => {
    const pdhData = {};
    const lastTradingDay = marketSession.getLastCompletedTradingDay();

    universeList.forEach(inst => {
      const data = mockData[inst.instrument_key];
      if (data) {
        pdhData[inst.instrument_key] = {
          high: Math.round(data.close * 1.015 * 100) / 100,
          low: Math.round(data.close * 0.985 * 100) / 100,
          close: data.close,
          date: lastTradingDay
        };
      }
    });
    return pdhData;
  },

  getPrevMonthHL: async (universeList) => {
    const pmhData = {};
    const prevMonth = marketSession.getPreviousCompletedMonth();

    universeList.forEach(inst => {
      const data = mockData[inst.instrument_key];
      if (data) {
        pmhData[inst.instrument_key] = {
          high: Math.round(data.close * 1.05 * 100) / 100,
          low: Math.round(data.close * 0.92 * 100) / 100,
          month: prevMonth.label
        };
      }
    });
    return pmhData;
  },

  getLastDaySnapshot: async (universeList) => {
    const lastTradingDay = marketSession.getLastCompletedTradingDay();
    const snapshot = [];

    universeList.forEach((inst, index) => {
      const data = mockData[inst.instrument_key];
      if (!data) return;

      const pdh = Math.round(data.close * 1.01 * 100) / 100;
      const pdl = Math.round(data.close * 0.99 * 100) / 100;

      let ltp, open, oiChangePct;
      if (index < 5) {
        // Guaranteed gainer
        open = pdh * 1.005;
        ltp = open * 1.02;
        oiChangePct = 7.5;
      } else if (index < 10) {
        // Guaranteed loser
        open = pdl * 0.995;
        ltp = open * 0.98;
        oiChangePct = 6.2;
      } else {
        open = data.close;
        ltp = data.ltp;
        oiChangePct = ((data.oi - data.previousOi) / data.previousOi) * 100;
      }

      snapshot.push({
        instrument_key: inst.instrument_key,
        ltp: Math.round(ltp * 100) / 100,
        close: data.close,
        open: Math.round(open * 100) / 100,
        high: Math.round(Math.max(ltp, open, pdh) * 100) / 100,
        low: Math.round(Math.min(ltp, open, pdl) * 100) / 100,
        volume: 250000 + Math.floor(Math.random() * 500000),
        oi: data.oi,
        previousOi: data.previousOi,
        oi_change_pct: Math.round(oiChangePct * 100) / 100,
        prevHigh: pdh,
        prevLow: pdl,
        sessionDate: lastTradingDay
      });
    });

    return snapshot;
  },

  subscribeLive: (onTick) => {
    onTickCallback = onTick;

    // Initial push
    const initialTicks = universe.map((inst, index) => {
      const data = mockData[inst.instrument_key];
      const pdh = data.close * 1.01;
      const pdl = data.close * 0.99;

      let mockOpen, mockLtp, mockOiPct;

      if (index < 5) {
        mockOpen = pdh * 1.005;
        mockLtp = mockOpen * 1.02;
        mockOiPct = 6.0 + Math.random() * 4;
      } else if (index < 10) {
        mockOpen = pdl * 0.995;
        mockLtp = mockOpen * 0.98;
        mockOiPct = 6.0 + Math.random() * 4;
      } else {
        const isUp = Math.random() > 0.5;
        mockOpen = isUp ? pdh * 1.002 : pdl * 0.998;
        mockLtp = data.ltp;
        mockOiPct = (Math.random() * 16) - 6;
      }

      data.ltp = mockLtp;

      return {
        instrument_key: inst.instrument_key,
        ltp: Math.round(mockLtp * 100) / 100,
        close: data.close,
        open: Math.round(mockOpen * 100) / 100,
        oi: data.oi,
        previousOi: data.previousOi,
        oi_change_pct: Math.round(mockOiPct * 100) / 100,
        volume: Math.floor(Math.random() * 1000000)
      };
    });

    onTick(initialTicks);

    // Simulate tick updates
    if (mockInterval) clearInterval(mockInterval);

    mockInterval = setInterval(() => {
      const updates = [];
      for (let i = 0; i < 3; i++) {
        const idx = Math.floor(Math.random() * universe.length);
        const inst = universe[idx];
        const data = mockData[inst.instrument_key];

        const change = data.ltp * (Math.random() - 0.5) * 0.002;
        data.ltp = Math.round((data.ltp + change) * 100) / 100;

        let mockOiPct = (Math.random() * 16) - 6;
        if (idx < 5 || (idx >= 5 && idx < 10)) {
          mockOiPct = 6.5 + Math.random() * 3;
        }

        updates.push({
          instrument_key: inst.instrument_key,
          ltp: data.ltp,
          close: data.close,
          oi_change_pct: Math.round(mockOiPct * 100) / 100,
          volume: Math.floor(Math.random() * 10000)
        });
      }

      if (onTickCallback) {
        onTickCallback(updates);
      }
    }, 2000);
  }
};
