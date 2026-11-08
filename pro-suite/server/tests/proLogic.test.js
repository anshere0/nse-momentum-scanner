const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { 
  calculateConfidenceScore, 
  calculateRvolConfidence, 
  calculateSectorConfidence 
} = require('../utils/confidenceEngine');
const { computeVwapMetrics } = require('../utils/vwapCalc');
const { computeOrbMetrics } = require('../utils/orbCalc');
const { computeRvolMetrics } = require('../utils/rvolCalc');
const { computeSectorMetrics } = require('../utils/sectorEngine');
const { planTrade } = require('../utils/riskEngine');
const { classifyVix, calculatePcr, computeStockDerivativesEdge } = require('../utils/derivativesCalc');
const { generateIntradayCandles } = require('../services/candleService');

describe('Pro-Suite Phase 2: Quantitative Calculations & Accuracy', () => {
  // Test Feature 1: Quadrants & Confidence Scoring
  describe('F&O 4-Quadrant & Confidence Engine', () => {
    it('should classify Long Buildup with high confidence when price and OI are up and above VWAP', () => {
      const stock = {
        ltp: 2750,
        pChange: 2.5,
        oiChange: 8.5,
        vwap: 2730,
        pdh: 2740,
        volume: 850000
      };
      const result = calculateConfidenceScore(stock);
      assert.equal(result.quadrant, 'LONG_BUILDUP');
      assert.ok(result.score >= 75, `Expected score >= 75, got ${result.score}`);
      assert.ok(result.reasoning.includes('institutional') || result.reasoning.includes('OI'), 'Reasoning should mention institutional or OI');
      assert.ok(Array.isArray(result.factors));
    });

    it('should classify Short Buildup with strong conviction when price is down and OI is up', () => {
      const stock = {
        ltp: 1520,
        pChange: -3.2,
        oiChange: 12.0,
        vwap: 1540,
        pdl: 1530,
        volume: 920000
      };
      const result = calculateConfidenceScore(stock);
      assert.equal(result.quadrant, 'SHORT_BUILDUP');
      assert.ok(result.score >= 75, `Expected score >= 75, got ${result.score}`);
      assert.ok(result.reasoning.length > 10, 'Reasoning statement should be present');
    });

    it('should penalize Short Covering as a counter-trend move with lower confidence', () => {
      const stock = {
        ltp: 850,
        pChange: 2.8,
        oiChange: -9.5,
        vwap: 845
      };
      const result = calculateConfidenceScore(stock);
      assert.equal(result.quadrant, 'SHORT_COVERING');
      assert.ok(result.warnings.some(w => w.includes('Short Covering') || w.includes('sellers closing')), 'Should contain Short Covering warning');
    });
  });

  // Test Feature 2: VWAP Distance Filter
  describe('Intraday VWAP Distance Calculation', () => {
    it('should identify sweet spot entry zone within 0.5% - 1.2% of VWAP', () => {
      const stock = { ltp: 1008, vwap: 1000, high: 1012, low: 998, open: 1000 };
      const vwap = computeVwapMetrics(stock);
      assert.equal(vwap.distancePct, 0.8);
      assert.equal(vwap.isAboveVwap, true);
      assert.equal(vwap.status, 'SWEET_SPOT_LONG');
    });

    it('should trigger overextended warning when distance exceeds 3.0%', () => {
      const stock = { ltp: 1045, vwap: 1000, high: 1050, low: 995, open: 1000 };
      const vwap = computeVwapMetrics(stock);
      assert.ok(vwap.distancePct >= 3.0);
      assert.equal(vwap.status, 'OVEREXTENDED_LONG');
    });
  });

  // Test Feature 3: Opening Range Breakout (ORB)
  describe('15m/30m Opening Range Breakout (ORB)', () => {
    it('should detect Breakout Up when LTP > ORB High', () => {
      const stock = { ltp: 520, orbHigh: 512, orbLow: 495, open: 500 };
      const orb = computeOrbMetrics(stock);
      assert.equal(orb.status, 'BREAKOUT_UP');
      assert.ok(orb.breakoutDistancePct > 0);
    });

    it('should detect Breakdown Down when LTP < ORB Low', () => {
      const stock = { ltp: 490, orbHigh: 512, orbLow: 495, open: 500 };
      const orb = computeOrbMetrics(stock);
      assert.equal(orb.status, 'BREAKDOWN_DOWN');
    });

    it('should detect Inside Range when LTP is between ORB High and Low', () => {
      const stock = { ltp: 505, orbHigh: 512, orbLow: 495, open: 500 };
      const orb = computeOrbMetrics(stock);
      assert.equal(orb.status, 'INSIDE_RANGE');
    });
  });
});

describe('Pro-Suite Phase 3: Advanced Quantitative Engines', () => {
  // Test Feature 4: Relative Volume (R-Vol)
  describe('Feature 4: Relative Volume (R-Vol) Calculation & Confidence', () => {
    it('should detect Very High R-Vol when volume exceeds 3x baseline', () => {
      const stock = {
        symbol: 'TATAMOTORS',
        volume: 3500000,
        baselineVolume: 1000000
      };
      const rvol = computeRvolMetrics(stock);
      assert.ok(rvol.rvol >= 3.0, `Expected rvol >= 3.0, got ${rvol.rvol}`);
      assert.equal(rvol.badge, 'VERY_HIGH');
      assert.ok(rvol.badgeText.includes('Ultra High'));
    });

    it('should detect Low R-Vol when volume is dry (< 0.7x)', () => {
      const stock = {
        symbol: 'INFY',
        volume: 150000,
        baselineVolume: 500000
      };
      const rvol = computeRvolMetrics(stock);
      assert.ok(rvol.rvol < 0.7);
      assert.equal(rvol.badge, 'LOW');
    });

    it('should evaluate high confidence for R-Vol surge backed by price breakout and Long OI', () => {
      const stock = {
        symbol: 'RBLBANK',
        ltp: 390,
        vwap: 385,
        pChange: 3.5,
        oiChange: 12.0,
        quadrant: 'LONG_BUILDUP'
      };
      const rvolData = { rvol: 4.5 };
      const conf = calculateRvolConfidence(stock, rvolData);
      assert.ok(conf.score >= 80, `Expected R-Vol confidence >= 80, got ${conf.score}`);
      assert.equal(conf.grade, 'VERY HIGH');
      assert.ok(conf.reasoning.includes('volume') || conf.reasoning.includes('breakout'));
    });

    it('should penalize high volume when price is flat (churn / absorption warning)', () => {
      const stock = {
        symbol: 'HDFCBANK',
        ltp: 1600,
        vwap: 1600,
        pChange: 0.1, // Flat price with huge volume!
        oiChange: 1.0,
        quadrant: 'NEUTRAL'
      };
      const rvolData = { rvol: 3.8 };
      const conf = calculateRvolConfidence(stock, rvolData);
      assert.ok(conf.score < 65, 'Should not have high conviction for volume churn');
      assert.ok(conf.warnings.some(w => w.includes('churn') || w.includes('absorption') || w.includes('without price movement')));
    });
  });

  // Test Feature 5: Sector Alignment & RS Score
  describe('Feature 5: Sector Tailwind & Relative Strength', () => {
    const mockSectorMap = {
      'NIFTY BANK': ['HDFCBANK', 'ICICIBANK', 'SBIN'],
      'NIFTY IT': ['TCS', 'INFY', 'WIPRO']
    };
    const mockIndices = [
      { name: 'NIFTY 50', pc: 0.8 },
      { name: 'NIFTY BANK', pc: 1.5 },
      { name: 'NIFTY IT', pc: -0.6 }
    ];

    it('should classify bullish alignment and RS Leader when stock and sector outperform Nifty 50', () => {
      const stock = { symbol: 'HDFCBANK', pChange: 2.2 };
      const sector = computeSectorMetrics(stock, mockSectorMap, mockIndices);
      assert.equal(sector.parentSector, 'NIFTY BANK');
      assert.equal(sector.isAligned, true);
      assert.equal(sector.alignmentStatus, 'ALIGNED_BULLISH');
      assert.equal(sector.rsScore, 1.4); // 2.2 - 0.8
      assert.equal(sector.rsBadge, 'RS_LEADER');
    });

    it('should evaluate high sector confidence for RS Leader with powerful sectoral tailwind', () => {
      const stock = { symbol: 'ICICIBANK', pChange: 2.5, ltp: 1200, vwap: 1190 };
      const sectorData = {
        parentSector: 'NIFTY BANK',
        sectorChange: 1.8,
        rsScore: 1.7,
        isAligned: true
      };
      const conf = calculateSectorConfidence(stock, sectorData);
      assert.ok(conf.score >= 80, `Expected sector confidence >= 80, got ${conf.score}`);
      assert.ok(conf.reasoning.includes('Sector') || conf.reasoning.includes('tailwind'));
    });

    it('should penalize sector confidence when stock moves contrary to parent sector', () => {
      const stock = { symbol: 'TCS', pChange: 1.0, ltp: 3100, vwap: 3105 };
      const sectorData = {
        parentSector: 'NIFTY IT',
        sectorChange: -1.2,
        rsScore: 0.2,
        isAligned: false
      };
      const conf = calculateSectorConfidence(stock, sectorData);
      assert.ok(conf.score < 50, 'Confidence should be penalized when moving against sector');
      assert.ok(conf.warnings.some(w => w.includes('contrary') || w.includes('sector')));
    });
  });

  // Test Feature 6: Risk Management & Lot Sizing Engine
  describe('Feature 6: Built-in Risk Management & Trade Planning Engine', () => {
    it('should correctly predict Smart Stop-Loss below VWAP for Long setup', () => {
      const stock = {
        symbol: 'RELIANCE',
        ltp: 2500,
        vwap: 2480,
        high: 2510,
        low: 2470,
        lotSize: 250
      };
      const plan = planTrade({
        stock,
        direction: 'LONG',
        slMethod: 'SMART_PREDICTED',
        capital: 200000,
        riskAmount: 5000
      });

      assert.equal(plan.direction, 'LONG');
      assert.ok(plan.stopLoss < 2500, 'Stop loss must be below entry');
      assert.ok(plan.stopLoss <= 2480, 'Smart SL should anchor below VWAP 2480');
      assert.ok(plan.slReasoning.includes('VWAP') || plan.slReasoning.includes('Smart SL'));
      assert.ok(plan.target1 > 2500);
      assert.ok(plan.recommendedShares > 0);
    });

    it('should support Custom Manual Stop-Loss price', () => {
      const stock = {
        symbol: 'INFY',
        ltp: 1800,
        lotSize: 400
      };
      const plan = planTrade({
        stock,
        direction: 'LONG',
        slMethod: 'MANUAL',
        manualSlPrice: 1785, // Exact manual SL ₹15 below entry
        capital: 100000,
        riskAmount: 3000
      });

      assert.equal(plan.stopLoss, 1785);
      assert.equal(plan.riskPerShare, 15);
      assert.equal(plan.recommendedShares, 200); // 3000 / 15 = 200 shares
      assert.ok(plan.slReasoning.includes('custom') || plan.slReasoning.includes('manually'));
    });

    it('should warn when risk budget allows fewer shares than 1 full F&O lot', () => {
      const stock = {
        symbol: 'BAJFINANCE',
        ltp: 7000,
        vwap: 6850,
        lotSize: 125
      };
      const plan = planTrade({
        stock,
        direction: 'LONG',
        slMethod: 'SMART_PREDICTED',
        capital: 100000,
        riskAmount: 1000
      });

      assert.equal(plan.recommendedLots, 0);
      assert.ok(plan.warnings.some(w => w.includes('F&O lot') || w.includes('Cash')));
    });

    it('should correctly calculate Short SL and Targets', () => {
      const stock = {
        symbol: 'TCS',
        ltp: 3000,
        vwap: 3050,
        lotSize: 175
      };
      const plan = planTrade({
        stock,
        direction: 'SHORT',
        slMethod: 'SMART_PREDICTED',
        capital: 200000,
        riskAmount: 4000
      });

      assert.equal(plan.direction, 'SHORT');
      assert.ok(plan.stopLoss > 3000, 'Short SL must be above entry price');
      assert.ok(plan.target1 < 3000, 'Short Target 1 must be below entry price');
    });
  });

  // Test Feature 7 & 8: Derivatives Edge & Candlestick Charts
  describe('Feature 7 & 8: Derivatives Edge & Interactive Charts', () => {
    it('should classify India VIX regimes accurately', () => {
      assert.equal(classifyVix(11.5).regime, 'CALM');
      assert.equal(classifyVix(15.5).regime, 'NORMAL');
      assert.equal(classifyVix(21.0).regime, 'ELEVATED');
      assert.equal(classifyVix(27.0).regime, 'EXTREME');
    });

    it('should calculate Put-Call Ratio (PCR) and detect Overbought/Oversold thresholds', () => {
      const oversold = calculatePcr(40000, 100000);
      assert.equal(oversold.status, 'OVERSOLD');
      assert.equal(oversold.pcr, 0.4);

      const overbought = calculatePcr(160000, 100000);
      assert.equal(overbought.status, 'OVERBOUGHT');
      assert.equal(overbought.pcr, 1.6);

      const balanced = calculatePcr(100000, 100000);
      assert.equal(balanced.status, 'BALANCED');
      assert.equal(balanced.pcr, 1.0);
    });

    it('should compute Call Wall resistance and Put Wall support strikes', () => {
      const stock = {
        symbol: 'TCS',
        ltp: 3500,
        oi: 1500000,
        oiChange: 2.0,
        pChange: 1.5
      };
      const edge = computeStockDerivativesEdge(stock);
      assert.ok(edge.callWallStrike > 3500, 'Call Wall must be above LTP');
      assert.ok(edge.putWallStrike < 3500, 'Put Wall must be below LTP');
      assert.equal(edge.maxPainStrike, 3500);
      assert.ok(edge.callWallOi > 0);
      assert.ok(edge.putWallOi > 0);
    });

    it('should generate valid 5m and 15m candlestick datasets with ascending timestamps and valid VWAP', () => {
      const stock = {
        symbol: 'INFY',
        ltp: 1850,
        open: 1840,
        high: 1865,
        low: 1835,
        volume: 600000,
        pChange: 0.8
      };
      const res5m = generateIntradayCandles(stock, '5m');
      assert.ok(res5m.candles.length > 0);
      assert.equal(res5m.candles.length, res5m.vwapSeries.length);
      assert.equal(res5m.candles.length, res5m.orbHighSeries.length);

      for (let i = 1; i < res5m.candles.length; i++) {
        assert.ok(res5m.candles[i].time > res5m.candles[i - 1].time);
      }
    });
  });
});



