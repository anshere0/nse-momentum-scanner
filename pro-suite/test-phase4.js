const assert = require('assert');
const { classifyVix, calculatePcr, computeStockDerivativesEdge } = require('./server/utils/derivativesCalc');
const { generateIntradayCandles } = require('./server/services/candleService');

console.log('Testing Phase 4 Utilities...');

// Test 1: VIX Regimes
const vixCalm = classifyVix(11.8);
assert.strictEqual(vixCalm.regime, 'CALM');
const vixNormal = classifyVix(15.2);
assert.strictEqual(vixNormal.regime, 'NORMAL');
const vixElevated = classifyVix(21.5);
assert.strictEqual(vixElevated.regime, 'ELEVATED');
const vixExtreme = classifyVix(28.0);
assert.strictEqual(vixExtreme.regime, 'EXTREME');
console.log('✓ classifyVix tests passed');

// Test 2: PCR Calculation
const pcrOversold = calculatePcr(50000, 100000); // 0.50
assert.strictEqual(pcrOversold.status, 'OVERSOLD');
const pcrOverbought = calculatePcr(150000, 100000); // 1.50
assert.strictEqual(pcrOverbought.status, 'OVERBOUGHT');
const pcrBalanced = calculatePcr(100000, 100000); // 1.00
assert.strictEqual(pcrBalanced.status, 'BALANCED');
console.log('✓ calculatePcr tests passed');

// Test 3: Stock Derivatives Edge
const sampleStock = {
  symbol: 'RELIANCE',
  ltp: 2950,
  oi: 2500000,
  oiChange: 3.5,
  pChange: 1.2
};
const deriv = computeStockDerivativesEdge(sampleStock);
assert.ok(deriv.callWallStrike > deriv.ltp, 'Call Wall must be above LTP');
assert.ok(deriv.putWallStrike < deriv.ltp, 'Put Wall must be below LTP');
assert.ok(deriv.maxPainStrike > 0, 'Max Pain strike must be valid');
assert.ok(deriv.pcr > 0, 'PCR must be positive');
console.log('✓ computeStockDerivativesEdge tests passed (Call Wall:', deriv.callWallStrike, 'Put Wall:', deriv.putWallStrike, 'Max Pain:', deriv.maxPainStrike, ')');

// Test 4: Candlestick Generation
const candleData = generateIntradayCandles(sampleStock, '5m');
assert.ok(candleData.candles.length > 0, 'Candles must not be empty');
assert.ok(candleData.vwapSeries.length === candleData.candles.length, 'VWAP count must match candle count');
assert.ok(candleData.orbHighSeries.length === candleData.candles.length, 'ORB High count must match candle count');

// Verify timestamps are strictly ascending
for (let i = 1; i < candleData.candles.length; i++) {
  assert.ok(candleData.candles[i].time > candleData.candles[i - 1].time, `Timestamp at index ${i} must be greater than ${i - 1}`);
  const bar = candleData.candles[i];
  assert.ok(bar.high >= bar.low, 'High must be >= low');
  assert.ok(bar.high >= bar.open, 'High must be >= open');
  assert.ok(bar.high >= bar.close, 'High must be >= close');
  assert.ok(bar.low <= bar.open, 'Low must be <= open');
  assert.ok(bar.low <= bar.close, 'Low must be <= close');
}
console.log('✓ generateIntradayCandles tests passed (' + candleData.candles.length + ' bars generated)');

console.log('All Phase 4 unit tests PASSED successfully!');
