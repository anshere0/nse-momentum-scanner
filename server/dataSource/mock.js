const logger = require('../utils/logger');

// Mock data generator for local development
const mockFnoSymbols = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBI', 'BAJFINANCE', 
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
  ...mockFnoSymbols.map(sym => ({
    instrument_key: `NSE_EQ|${sym}`,
    tradingsymbol: sym,
    name: sym,
    type: 'STOCK'
  })),
  ...mockIndices.map(sym => ({
    instrument_key: `NSE_INDEX|${sym}`,
    tradingsymbol: sym,
    name: sym,
    type: 'INDEX'
  }))
];

// Initial mock data
const mockData = {};
universe.forEach(inst => {
  const isIndex = inst.type === 'INDEX';
  const basePrice = isIndex ? 20000 + Math.random() * 5000 : 100 + Math.random() * 3000;
  mockData[inst.instrument_key] = {
    close: basePrice,
    ltp: basePrice + (Math.random() - 0.5) * (basePrice * 0.05) // +/- 2.5%
  };
});

module.exports = {
  init: async () => {
    logger.info('Mock Data Source initialized');
    return true;
  },

  getFnoUniverse: async () => {
    return universe;
  },

  getPrevDayHL: async (universeList) => {
    const pdhData = {};
    universeList.forEach(inst => {
      const data = mockData[inst.instrument_key];
      if (data) {
        // PDH is slightly lower than open for gainers so they pass the rule
        pdhData[inst.instrument_key] = {
          high: data.close * 1.01,
          low: data.close * 0.99
        };
      }
    });
    return pdhData;
  },

  subscribeLive: (onTick) => {
    onTickCallback = onTick;
    
    // Initial push
    const initialTicks = universe.map((inst, index) => {
      const data = mockData[inst.instrument_key];
      
      const pdh = data.close * 1.01;
      const pdl = data.close * 0.99;
      
      // Force first 5 stocks to be guaranteed Gainers (Open > PDH, PC > 1%, OI > 5%)
      // Force next 5 stocks to be guaranteed Losers (Open < PDL, PC < -1%, OI > 5%)
      let mockOpen, mockLtp, mockOi;
      
      if (index < 5) {
        mockOpen = pdh * 1.005; // Open above PDH
        mockLtp = mockOpen * 1.015; // Positive price change
        mockOi = 6.0 + Math.random() * 5; // OI > 5%
      } else if (index < 10) {
        mockOpen = pdl * 0.995; // Open below PDL
        mockLtp = mockOpen * 0.985; // Negative price change
        mockOi = 6.0 + Math.random() * 5; // OI > 5%
      } else {
        const isOpenAbovePdh = Math.random() > 0.5;
        mockOpen = isOpenAbovePdh ? pdh * 1.005 : pdl * 0.995;
        mockLtp = data.ltp;
        mockOi = (Math.random() * 20) - 5;
      }
      
      // Keep track of the current forced LTPs for the interval updates
      data.ltp = mockLtp;
      
      return {
        instrument_key: inst.instrument_key,
        ltp: mockLtp,
        close: data.close,
        open: mockOpen,
        oi_change_pct: mockOi,
        volume: Math.floor(Math.random() * 1000000)
      };
    });
    onTick(initialTicks);

    // Simulate live updates
    if (mockInterval) clearInterval(mockInterval);
    
    mockInterval = setInterval(() => {
      const updates = [];
      for (let i = 0; i < 2; i++) {
        const idx = Math.floor(Math.random() * universe.length);
        const inst = universe[idx];
        const data = mockData[inst.instrument_key];
        
        // Random walk: +/- 0.1%
        const change = data.ltp * (Math.random() - 0.5) * 0.002;
        data.ltp += change;
        
        let mockOi = (Math.random() * 20) - 5;
        if (idx < 10) mockOi = 6.0 + Math.random() * 5; // Keep the forced ones above 5% OI
        
        updates.push({
          instrument_key: inst.instrument_key,
          ltp: data.ltp,
          oi_change_pct: mockOi,
          volume: Math.floor(Math.random() * 10000)
        });
      }
      
      if (onTickCallback) {
        onTickCallback(updates);
      }
    }, 3000); // 3 updates per second
  }
};
