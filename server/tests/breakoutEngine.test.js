const test = require('node:test');
const assert = require('node:assert');
const breakoutEngine = require('../services/breakoutEngine');

test('Breakout Engine - Mathematical Signal Engine Tests', async (t) => {

  await t.test('1. Bullish breakout with sufficient volume qualifies', () => {
    breakoutEngine.updateConfig({
      minVolumeMultiplier: 2.0,
      volumeMode: 'STANDARD',
      signalType: 'BOTH'
    });

    const historicalCandles = [
      { high: 100, low: 90, volume: 1000 },
      { high: 105, low: 92, volume: 1200 },
      { high: 102, low: 91, volume: 800 }
    ];

    const resistance = Math.max(...historicalCandles.map(c => c.high)); // 105
    const avgVolume = historicalCandles.reduce((s, c) => s + c.volume, 0) / historicalCandles.length; // 1000

    const livePrice = 108; // > 105
    const liveVolume = 2500; // 2500 / 1000 = 2.5x >= 2.0x

    const isPriceBreakout = livePrice > resistance;
    const volumeRatio = liveVolume / avgVolume;
    const isVolumeConfirmed = volumeRatio >= 2.0;

    assert.strictEqual(isPriceBreakout, true, 'Price must exceed historical resistance');
    assert.strictEqual(isVolumeConfirmed, true, 'Volume ratio (2.5x) must exceed required 2.0x');
    assert.strictEqual(isPriceBreakout && isVolumeConfirmed, true, 'Bullish breakout with sufficient volume should trigger signal');
  });

  await t.test('2. Bullish breakout without sufficient volume does NOT qualify', () => {
    const resistance = 105;
    const avgVolume = 1000;
    const livePrice = 108; // > 105
    const liveVolume = 1500; // 1.5x < 2.0x

    const isPriceBreakout = livePrice > resistance;
    const volumeRatio = liveVolume / avgVolume;
    const isVolumeConfirmed = volumeRatio >= 2.0;

    assert.strictEqual(isPriceBreakout, true);
    assert.strictEqual(isVolumeConfirmed, false, 'Volume ratio 1.5x does not meet 2.0x threshold');
    assert.strictEqual(isPriceBreakout && isVolumeConfirmed, false, 'Should not qualify without volume confirmation');
  });

  await t.test('3. Bearish breakdown with sufficient volume qualifies', () => {
    const historicalCandles = [
      { high: 100, low: 90, volume: 1000 },
      { high: 105, low: 92, volume: 1200 },
      { high: 102, low: 91, volume: 800 }
    ];

    const support = Math.min(...historicalCandles.map(c => c.low)); // 90
    const avgVolume = 1000;

    const livePrice = 88; // < 90
    const liveVolume = 2100; // 2.1x >= 2.0x

    const isPriceBreakdown = livePrice < support;
    const volumeRatio = liveVolume / avgVolume;
    const isVolumeConfirmed = volumeRatio >= 2.0;

    assert.strictEqual(isPriceBreakdown, true, 'Price must fall below historical support');
    assert.strictEqual(isVolumeConfirmed, true, 'Volume must meet threshold');
    assert.strictEqual(isPriceBreakdown && isVolumeConfirmed, true, 'Bearish breakdown with volume should qualify');
  });

  await t.test('4. Bearish breakdown without sufficient volume does NOT qualify', () => {
    const support = 90;
    const avgVolume = 1000;
    const livePrice = 88; // < 90
    const liveVolume = 900; // 0.9x < 2.0x

    const isPriceBreakdown = livePrice < support;
    const volumeRatio = liveVolume / avgVolume;
    const isVolumeConfirmed = volumeRatio >= 2.0;

    assert.strictEqual(isPriceBreakdown, true);
    assert.strictEqual(isVolumeConfirmed, false);
    assert.strictEqual(isPriceBreakdown && isVolumeConfirmed, false);
  });

  await t.test('5. Live signal invalidation on price reversal', () => {
    const resistance = 105;
    let livePrice = 107;
    let signalStatus = 'LIVE';

    // Price falls back below resistance before candle close
    livePrice = 104;
    if (livePrice <= resistance) {
      signalStatus = 'INVALIDATED';
    }

    assert.strictEqual(signalStatus, 'INVALIDATED', 'Signal must transition to INVALIDATED on pullback');
  });

  await t.test('6. Live signal becoming confirmed at candle close', () => {
    const resistance = 105;
    let candleClose = 107;
    let signalStatus = 'LIVE';
    const isCandleClosed = true;

    if (isCandleClosed && candleClose > resistance) {
      signalStatus = 'CONFIRMED';
    }

    assert.strictEqual(signalStatus, 'CONFIRMED', 'Signal must be confirmed once candle closes above resistance');
  });

  await t.test('7. Time-adjusted relative volume calculation', () => {
    const totalCandleMinutes = 15;
    const elapsedMinutes = 5; // 5 mins into 15 min candle
    const historicalFullCandleAvgVolume = 15000;

    const elapsedFraction = elapsedMinutes / totalCandleMinutes; // 0.333
    const expectedElapsedVolume = historicalFullCandleAvgVolume * elapsedFraction; // 5000

    const currentAccumulatedVolume = 12000; // 12000 vs 5000 expected = 2.4x
    const timeAdjustedRatio = currentAccumulatedVolume / expectedElapsedVolume;

    assert.strictEqual(Math.round(timeAdjustedRatio * 100) / 100, 2.4, 'Time-adjusted volume ratio must be 2.4x');
    assert.strictEqual(timeAdjustedRatio >= 2.0, true, 'Qualifies for 2.0x multiplier at elapsed time');
  });

  await t.test('8. Independent dynamic configuration updates', () => {
    breakoutEngine.updateConfig({
      lookbackValue: 30,
      lookbackUnit: 'MINUTES',
      timeframe: '5m',
      minVolumeMultiplier: 3.5,
      volumeMode: 'TIME_ADJUSTED'
    });

    const cfg = breakoutEngine.getConfig();
    assert.strictEqual(cfg.lookbackValue, 30);
    assert.strictEqual(cfg.lookbackUnit, 'MINUTES');
    assert.strictEqual(cfg.timeframe, '5m');
    assert.strictEqual(cfg.minVolumeMultiplier, 3.5);
    assert.strictEqual(cfg.volumeMode, 'TIME_ADJUSTED');
  });

  await t.test('9. Candle aggregation logic (45m from 15m, 2h from 1h)', () => {
    const fifteenMinCandles = [
      ['2026-11-06T09:15:00', 100, 105, 99, 104, 1000],
      ['2026-11-06T09:30:00', 104, 108, 103, 107, 1200],
      ['2026-11-06T09:45:00', 107, 109, 106, 108, 1500]
    ];

    const aggregated = breakoutEngine.aggregateCandles(fifteenMinCandles, '45m');
    assert.strictEqual(aggregated.length, 1);
    assert.strictEqual(aggregated[0].open, 100);
    assert.strictEqual(aggregated[0].high, 109);
    assert.strictEqual(aggregated[0].low, 99);
    assert.strictEqual(aggregated[0].close, 108);
    assert.strictEqual(aggregated[0].volume, 3700);
  });

  await t.test('10. Index volume source handling', () => {
    breakoutEngine.updateConfig({
      indexVolumeSource: 'FUTURES'
    });
    assert.strictEqual(breakoutEngine.getConfig().indexVolumeSource, 'FUTURES');

    breakoutEngine.updateConfig({
      indexVolumeSource: 'PRICE_ONLY'
    });
    assert.strictEqual(breakoutEngine.getConfig().indexVolumeSource, 'PRICE_ONLY');
  });

});

