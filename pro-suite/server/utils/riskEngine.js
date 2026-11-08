const fs = require('fs');
const path = require('path');

const BASKET_FILE = path.join(__dirname, '..', '..', 'data', 'basket.json');

function loadBasket() {
  try {
    if (fs.existsSync(BASKET_FILE)) {
      return JSON.parse(fs.readFileSync(BASKET_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load basket file:', err.message);
  }
  return { trades: [], lastSaved: null };
}

function saveBasket(basketData) {
  const dir = path.dirname(BASKET_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BASKET_FILE, JSON.stringify(basketData, null, 2), 'utf8');
}

/**
 * Plan Stop-Loss, Targets, and Position Sizing for a Trade Setup
 * Supports:
 * - SMART_PREDICTED (Algorithmic Multi-Factor invalidation)
 * - MANUAL (User-specified custom stop-loss price)
 * - VWAP, ORB, DAY_EXTREME, PDH_PDL, ATR, PERCENT_1, PERCENT_2
 */
function planTrade({
  stock,
  direction = 'LONG', // 'LONG' or 'SHORT'
  slMethod = 'SMART_PREDICTED', // 'SMART_PREDICTED' | 'MANUAL' | 'VWAP' | 'ORB' | 'DAY_EXTREME' | 'PDH_PDL' | 'ATR' | 'PERCENT_1'
  manualSlPrice = null,
  capital = 100000,
  riskAmount = 2000,
  target1Multiplier = 1.5,
  target2Multiplier = 2.0
}) {
  const ltp = Number(stock.ltp) || 1000;
  const vwap = Number(stock.vwap) || ltp;
  const orbHigh = Number(stock.orbHigh) || (ltp * 1.01);
  const orbLow = Number(stock.orbLow) || (ltp * 0.99);
  const dayHigh = Number(stock.high) || ltp;
  const dayLow = Number(stock.low) || ltp;
  const pdh = Number(stock.pdh) || (ltp * 1.015);
  const pdl = Number(stock.pdl) || (ltp * 0.985);
  const lotSize = Number(stock.lotSize) || 1;

  let sl = 0;
  let slReasoning = '';
  const isLong = direction === 'LONG';

  // 1. Calculate Stop-Loss level based on selected strategy
  if (slMethod === 'MANUAL' && manualSlPrice && Number(manualSlPrice) > 0) {
    sl = Math.round(Number(manualSlPrice) * 100) / 100;
    slReasoning = `User-defined custom stop loss set manually at ₹${sl.toFixed(2)}.`;
  } else if (slMethod === 'SMART_PREDICTED') {
    // Algorithmic Multi-Factor Prediction:
    // Picks the most resilient technical invalidation level (VWAP, ORB, Day Low/High, or ATR buffer)
    if (isLong) {
      const vwapDist = ((ltp - vwap) / vwap) * 100;
      const orbDist = ((ltp - orbLow) / orbLow) * 100;
      const dayLowDist = ((ltp - dayLow) / dayLow) * 100;

      if (vwap < ltp && vwapDist >= 0.3 && vwapDist <= 2.2) {
        // Nearest dynamic institutional anchor
        sl = Math.round((vwap * 0.997) * 100) / 100;
        slReasoning = `Smart SL placed at ₹${sl.toFixed(2)} (0.3% below Intraday VWAP ₹${vwap.toFixed(2)}), providing optimal support protection.`;
      } else if (orbLow < ltp && orbDist >= 0.4 && orbDist <= 2.5) {
        sl = Math.round((orbLow * 0.998) * 100) / 100;
        slReasoning = `Smart SL placed at ₹${sl.toFixed(2)} (below 15m Opening Range Low ₹${orbLow.toFixed(2)}).`;
      } else if (dayLow < ltp && dayLowDist >= 0.3 && dayLowDist <= 2.5) {
        sl = Math.round((dayLow * 0.998) * 100) / 100;
        slReasoning = `Smart SL placed at ₹${sl.toFixed(2)} (below today's session low ₹${dayLow.toFixed(2)}).`;
      } else {
        // Volatility ATR buffer
        sl = Math.round((ltp * 0.988) * 100) / 100;
        slReasoning = `Smart SL placed at ₹${sl.toFixed(2)} (1.2% volatility buffer below entry price).`;
      }
    } else {
      // SHORT
      const vwapDist = ((vwap - ltp) / ltp) * 100;
      const orbDist = ((orbHigh - ltp) / ltp) * 100;
      const dayHighDist = ((dayHigh - ltp) / ltp) * 100;

      if (vwap > ltp && vwapDist >= 0.3 && vwapDist <= 2.2) {
        sl = Math.round((vwap * 1.003) * 100) / 100;
        slReasoning = `Smart SL placed at ₹${sl.toFixed(2)} (0.3% above Intraday VWAP ₹${vwap.toFixed(2)}), providing optimal overhead resistance.`;
      } else if (orbHigh > ltp && orbDist >= 0.4 && orbDist <= 2.5) {
        sl = Math.round((orbHigh * 1.002) * 100) / 100;
        slReasoning = `Smart SL placed at ₹${sl.toFixed(2)} (above 15m Opening Range High ₹${orbHigh.toFixed(2)}).`;
      } else if (dayHigh > ltp && dayHighDist >= 0.3 && dayHighDist <= 2.5) {
        sl = Math.round((dayHigh * 1.002) * 100) / 100;
        slReasoning = `Smart SL placed at ₹${sl.toFixed(2)} (above today's session high ₹${dayHigh.toFixed(2)}).`;
      } else {
        sl = Math.round((ltp * 1.012) * 100) / 100;
        slReasoning = `Smart SL placed at ₹${sl.toFixed(2)} (1.2% volatility buffer above entry price).`;
      }
    }
  } else if (slMethod === 'VWAP') {
    if (isLong) {
      sl = Math.round((Math.min(ltp * 0.995, vwap * 0.997)) * 100) / 100;
      slReasoning = `Placed 0.3% below Intraday VWAP (₹${vwap.toFixed(2)}).`;
    } else {
      sl = Math.round((Math.max(ltp * 1.005, vwap * 1.003)) * 100) / 100;
      slReasoning = `Placed 0.3% above Intraday VWAP (₹${vwap.toFixed(2)}).`;
    }
  } else if (slMethod === 'ORB') {
    if (isLong) {
      sl = Math.round((orbLow * 0.998) * 100) / 100;
      slReasoning = `Placed below 15m Opening Range Low (₹${orbLow.toFixed(2)}).`;
    } else {
      sl = Math.round((orbHigh * 1.002) * 100) / 100;
      slReasoning = `Placed above 15m Opening Range High (₹${orbHigh.toFixed(2)}).`;
    }
  } else if (slMethod === 'DAY_EXTREME') {
    if (isLong) {
      sl = Math.round((dayLow * 0.998) * 100) / 100;
      slReasoning = `Placed below today's Day Low (₹${dayLow.toFixed(2)}).`;
    } else {
      sl = Math.round((dayHigh * 1.002) * 100) / 100;
      slReasoning = `Placed above today's Day High (₹${dayHigh.toFixed(2)}).`;
    }
  } else if (slMethod === 'PDH_PDL') {
    if (isLong) {
      sl = Math.round((pdl * 0.998) * 100) / 100;
      slReasoning = `Placed below Previous Day Low (₹${pdl.toFixed(2)}).`;
    } else {
      sl = Math.round((pdh * 1.002) * 100) / 100;
      slReasoning = `Placed above Previous Day High (₹${pdh.toFixed(2)}).`;
    }
  } else if (slMethod === 'PERCENT_1') {
    sl = isLong ? Math.round((ltp * 0.99) * 100) / 100 : Math.round((ltp * 1.01) * 100) / 100;
    slReasoning = `Fixed 1.0% stop-loss buffer from entry price.`;
  } else {
    // Default ATR 1.2%
    sl = isLong ? Math.round((ltp * 0.988) * 100) / 100 : Math.round((ltp * 1.012) * 100) / 100;
    slReasoning = `Fixed 1.2% volatility buffer from entry price.`;
  }

  // Safety clamps
  if (isLong && sl >= ltp) {
    sl = Math.round((ltp * 0.99) * 100) / 100;
    slReasoning = `Stop loss clamped to 1.0% below entry for safety.`;
  }
  if (!isLong && sl <= ltp) {
    sl = Math.round((ltp * 1.01) * 100) / 100;
    slReasoning = `Stop loss clamped to 1.0% above entry for safety.`;
  }

  const riskPerShare = Math.round(Math.abs(ltp - sl) * 100) / 100;
  const riskPct = Math.round(((riskPerShare / ltp) * 100) * 100) / 100;

  // 2. Targets based on R:R multiples
  const t1Distance = riskPerShare * target1Multiplier;
  const t2Distance = riskPerShare * target2Multiplier;

  const target1 = isLong
    ? Math.round((ltp + t1Distance) * 100) / 100
    : Math.round((ltp - t1Distance) * 100) / 100;

  const target2 = isLong
    ? Math.round((ltp + t2Distance) * 100) / 100
    : Math.round((ltp - t2Distance) * 100) / 100;

  // 3. Position Sizing
  const rawShares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
  const lots = lotSize > 1 ? Math.floor(rawShares / lotSize) : rawShares;
  const fnoShares = lotSize > 1 ? lots * lotSize : rawShares;

  // Margin & Capital Checks
  const oneLotContractValue = Math.round(ltp * lotSize);
  const approxFnoMarginPerLot = Math.round(oneLotContractValue * 0.20); // ~20% NSE margin
  const totalMarginNeeded = lotSize > 1 ? approxFnoMarginPerLot * Math.max(1, lots) : ltp * rawShares;
  const cashCapitalNeeded = Math.round(ltp * rawShares);

  const potentialProfitT1 = Math.round(t1Distance * (lotSize > 1 && lots > 0 ? fnoShares : rawShares));
  const potentialProfitT2 = Math.round(t2Distance * (lotSize > 1 && lots > 0 ? fnoShares : rawShares));
  const actualRiskAmount = Math.round(riskPerShare * (lotSize > 1 && lots > 0 ? fnoShares : rawShares));

  const warnings = [];
  if (lotSize > 1 && rawShares < lotSize) {
    warnings.push(`Risk budget warning: Your ₹${riskAmount.toLocaleString('en-IN')} risk budget allows ${rawShares} shares, but 1 F&O lot is ${lotSize} shares. Taking 1 lot risks ₹${Math.round(riskPerShare * lotSize).toLocaleString('en-IN')}. Trade Cash Equity or adjust risk.`);
  }
  if (totalMarginNeeded > capital) {
    warnings.push(`Capital Warning: Required margin (₹${totalMarginNeeded.toLocaleString('en-IN')}) exceeds your account capital (₹${capital.toLocaleString('en-IN')}).`);
  }

  return {
    symbol: stock.symbol,
    direction,
    entryPrice: ltp,
    stopLoss: sl,
    slMethod,
    slReasoning,
    target1,
    target2,
    riskPerShare,
    riskPct,
    riskToReward1: `1:${target1Multiplier}`,
    riskToReward2: `1:${target2Multiplier}`,
    lotSize,
    oneLotValue: oneLotContractValue,
    approxMarginPerLot: approxFnoMarginPerLot,
    recommendedShares: rawShares,
    recommendedLots: lots,
    fnoShares,
    cashCapitalNeeded,
    totalMarginNeeded,
    actualRiskAmount,
    potentialProfitT1,
    potentialProfitT2,
    warnings
  };
}

module.exports = {
  loadBasket,
  saveBasket,
  planTrade
};
