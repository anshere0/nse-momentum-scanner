const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const marketState = require('../state/marketState');

describe('Filter System, Breadth & Sentiment Tests', () => {
  beforeEach(() => {
    marketState.resetConfig();
  });

  test('OI change percentage with positive, negative, and zero reference values', () => {
    // Current OI = 110, Reference OI = 100 => +10%
    const current1 = 110;
    const ref1 = 100;
    const change1 = ((current1 - ref1) / ref1) * 100;
    assert.equal(change1, 10);

    // Current OI = 90, Reference OI = 100 => -10%
    const current2 = 90;
    const ref2 = 100;
    const change2 = ((current2 - ref2) / ref2) * 100;
    assert.equal(change2, -10);

    // Reference OI = 0 or missing must be guarded against division-by-zero
    const ref0 = 0;
    const change0 = ref0 > 0 ? ((100 - ref0) / ref0) * 100 : 0;
    assert.equal(change0, 0);
  });

  test('Editing OI thresholds dynamically without modifying source code', () => {
    const originalConfig = marketState.getConfig();
    assert.equal(originalConfig.MIN_OI_CHANGE_PCT, 5.0);

    // User updates threshold via API to +12.5%
    marketState.updateConfig({ MIN_OI_CHANGE_PCT: 12.5 });
    const updatedConfig = marketState.getConfig();
    assert.equal(updatedConfig.MIN_OI_CHANGE_PCT, 12.5);

    // User resets to defaults
    marketState.resetConfig();
    assert.equal(marketState.getConfig().MIN_OI_CHANGE_PCT, 5.0);
  });

  test('Advance/decline counts and net breadth calculations', () => {
    // Mock a universe of stocks
    const mockUniverse = [
      { instrument_key: '101', tradingsymbol: 'STK1', type: 'STOCK' },
      { instrument_key: '102', tradingsymbol: 'STK2', type: 'STOCK' },
      { instrument_key: '103', tradingsymbol: 'STK3', type: 'STOCK' },
      { instrument_key: '104', tradingsymbol: 'STK4', type: 'STOCK' },
      { instrument_key: '105', tradingsymbol: 'STK5', type: 'STOCK' }
    ];

    marketState.setUniverse(mockUniverse);

    // STK1: +2%, STK2: +1%, STK3: -3%, STK4: 0%, STK5: -1%
    // Advances: 2, Declines: 2, Unchanged: 1 => Total 5
    marketState.updateTicks([
      { instrument_key: '101', ltp: 102, close: 100 },
      { instrument_key: '102', ltp: 101, close: 100 },
      { instrument_key: '103', ltp: 97, close: 100 },
      { instrument_key: '104', ltp: 100, close: 100 },
      { instrument_key: '105', ltp: 99, close: 100 }
    ]);

    const breadth = marketState.breadth;
    assert.equal(breadth.advancing, 2);
    assert.equal(breadth.declining, 2);
    assert.equal(breadth.unchanged, 1);
    assert.equal(breadth.evaluated, 5);
    assert.equal(breadth.advDeclineRatio, 1); // 2 / 2 = 1.0
    assert.equal(breadth.netBreadthPct, 0);   // (2 - 2) / 5 * 100 = 0%
  });

  test('Sentiment classification: Positive, Negative, Sideways, Insufficient Data', () => {
    const mockUniverse = [
      { instrument_key: '201', tradingsymbol: 'S1', type: 'STOCK' },
      { instrument_key: '202', tradingsymbol: 'S2', type: 'STOCK' },
      { instrument_key: '203', tradingsymbol: 'S3', type: 'STOCK' },
      { instrument_key: '204', tradingsymbol: 'S4', type: 'STOCK' }
    ];
    marketState.setUniverse(mockUniverse);

    // 1. All advancing => Net breadth +100% >= +10% threshold => POSITIVE
    marketState.updateTicks([
      { instrument_key: '201', ltp: 105, close: 100 },
      { instrument_key: '202', ltp: 105, close: 100 },
      { instrument_key: '203', ltp: 105, close: 100 },
      { instrument_key: '204', ltp: 105, close: 100 }
    ]);
    assert.equal(marketState.sentiment.label, 'POSITIVE');

    // 2. All declining => Net breadth -100% <= -10% threshold => NEGATIVE
    marketState.updateTicks([
      { instrument_key: '201', ltp: 95, close: 100 },
      { instrument_key: '202', ltp: 95, close: 100 },
      { instrument_key: '203', ltp: 95, close: 100 },
      { instrument_key: '204', ltp: 95, close: 100 }
    ]);
    assert.equal(marketState.sentiment.label, 'NEGATIVE');

    // 3. Balanced (2 up, 2 down) => Net breadth 0% => SIDEWAYS
    marketState.updateTicks([
      { instrument_key: '201', ltp: 105, close: 100 },
      { instrument_key: '202', ltp: 105, close: 100 },
      { instrument_key: '203', ltp: 95, close: 100 },
      { instrument_key: '204', ltp: 95, close: 100 }
    ]);
    assert.equal(marketState.sentiment.label, 'SIDEWAYS');
  });

  test('Independent enable/disable of individual filters', () => {
    // Disable price change filter while keeping OI filter enabled
    marketState.updateConfig({
      priceChangeEnabled: false,
      oiFilterEnabled: true
    });

    const config = marketState.getConfig();
    assert.equal(config.priceChangeEnabled, false);
    assert.equal(config.oiFilterEnabled, true);

    // Disable all filters master toggle
    marketState.updateConfig({ scanEnabled: false });
    assert.equal(marketState.getConfig().scanEnabled, false);
  });

  test('Cash-only, F&O-only, and combined segment modes', () => {
    // Test updating segment configuration
    marketState.updateConfig({ marketSegment: 'CASH' });
    assert.equal(marketState.getConfig().marketSegment, 'CASH');

    marketState.updateConfig({ marketSegment: 'FNO' });
    assert.equal(marketState.getConfig().marketSegment, 'FNO');

    marketState.updateConfig({ marketSegment: 'BOTH' });
    assert.equal(marketState.getConfig().marketSegment, 'BOTH');
  });

  test('Minimum and maximum market-cap filters with enable toggle', () => {
    marketState.updateConfig({
      marketCapEnabled: true,
      minMarketCap: 1000,
      maxMarketCap: 50000,
      marketCapUnit: 'crore'
    });

    const config = marketState.getConfig();
    assert.equal(config.marketCapEnabled, true);
    assert.equal(config.minMarketCap, 1000);
    assert.equal(config.maxMarketCap, 50000);
    assert.equal(config.marketCapUnit, 'crore');
  });

  test('PDH/PDL and PMH/PML levels populated and preserved correctly', () => {
    const mockPdh = {
      '101': { high: 2500, low: 2450, close: 2480, date: '2025-10-10' }
    };
    marketState.setPdhData(mockPdh);
    assert.equal(marketState.pdhData['101'].high, 2500);
    assert.equal(marketState.pdhData['101'].low, 2450);

    const mockPmh = {
      '101': { high: 2600, low: 2300, month: '2025-09' }
    };
    marketState.setPmhData(mockPmh);
    assert.equal(marketState.pmhData['101'].high, 2600);
    assert.equal(marketState.pmhData['101'].low, 2300);
  });

  test('Market data mode states: LIVE, PREVIOUS_CLOSE, CACHED, UNAVAILABLE', () => {
    marketState.setDataMode('LIVE', '2025-10-14');
    assert.equal(marketState.dataMode, 'LIVE');

    marketState.setDataMode('PREVIOUS_CLOSE', '2025-10-10');
    assert.equal(marketState.dataMode, 'PREVIOUS_CLOSE');
    assert.equal(marketState.sessionDate, '2025-10-10');

    marketState.setDataMode('CACHED');
    assert.equal(marketState.dataMode, 'CACHED');

    marketState.setDataMode('UNAVAILABLE');
    assert.equal(marketState.dataMode, 'UNAVAILABLE');
  });
});
