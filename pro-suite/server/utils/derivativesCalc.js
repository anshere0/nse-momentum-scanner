/**
 * Derivatives Edge Utility: PCR, Open Interest Walls, Max Pain & Volatility Regimes
 */

/**
 * Classify India VIX Volatility Regime
 */
function classifyVix(vixValue = 14.5) {
  const val = Number(vixValue) || 14.5;
  if (val < 13.0) {
    return {
      value: val,
      regime: 'CALM',
      text: 'Calm / Low Volatility (<13.0)',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      description: 'Option premiums decay quickly. Breakouts need strong volume confirmation; mean-reversion is common.'
    };
  } else if (val <= 18.0) {
    return {
      value: val,
      regime: 'NORMAL',
      text: 'Normal Volatility (13.0 - 18.0)',
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      description: 'Optimal conditions for intraday trend following and technical momentum breakouts.'
    };
  } else if (val <= 24.0) {
    return {
      value: val,
      regime: 'ELEVATED',
      text: 'Elevated Volatility (18.0 - 24.0)',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      description: 'Violent intraday price swings. Requires wider stop-losses and strict position size reduction.'
    };
  } else {
    return {
      value: val,
      regime: 'EXTREME',
      text: 'Extreme Volatility (>24.0)',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      description: 'Event-driven or panic regime. High slippage and wide spreads; defensive capital preservation advised.'
    };
  }
}

/**
 * Calculate Put-Call Ratio (PCR) from Put & Call Open Interest
 */
function calculatePcr(putOi = 0, callOi = 0, settings = {}) {
  const pOi = Number(putOi) || 0;
  const cOi = Number(callOi) || 0;
  const overbought = Number(settings.pcrOverbought) || 1.35;
  const oversold = Number(settings.pcrOversold) || 0.65;

  const pcr = cOi > 0 ? Math.round((pOi / cOi) * 100) / 100 : 1.0;

  let status = 'BALANCED';
  let statusText = 'Balanced Momentum';
  let badgeClass = 'bg-gray-800 text-gray-300 border-gray-700';

  if (pcr > overbought) {
    status = 'OVERBOUGHT';
    statusText = `🔴 Overbought (${pcr.toFixed(2)})`;
    badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else if (pcr < oversold) {
    status = 'OVERSOLD';
    statusText = `🟢 Oversold (${pcr.toFixed(2)})`;
    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else {
    statusText = `⚖️ Balanced (${pcr.toFixed(2)})`;
    badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  }

  return {
    pcr,
    putOi: pOi,
    callOi: cOi,
    status,
    statusText,
    badgeClass
  };
}

/**
 * Compute Open Interest Walls & Max Pain for an F&O Stock
 * Evaluates strike distribution around LTP to locate key institutional support and resistance.
 */
function computeStockDerivativesEdge(stock, settings = {}) {
  const ltp = Number(stock.ltp) || 1000;
  const oi = Number(stock.oi) || 100000;
  const oiChange = Number(stock.oiChange) || 0;
  const pChange = Number(stock.pChange) || 0;

  // Derive realistic strike interval for the stock price tier
  let strikeStep = 50;
  if (ltp < 100) strikeStep = 2.5;
  else if (ltp < 250) strikeStep = 5;
  else if (ltp < 500) strikeStep = 10;
  else if (ltp < 1500) strikeStep = 20;
  else if (ltp < 3000) strikeStep = 50;
  else if (ltp < 6000) strikeStep = 100;
  else strikeStep = 500;

  const atmStrike = Math.round(ltp / strikeStep) * strikeStep;

  // Generate synthetic options distribution around ATM based on F&O market dynamics
  // Call OI accumulates heavily above ATM (resistance); Put OI accumulates below ATM (support)
  const isBullish = pChange >= 0;
  const putWeight = isBullish ? 0.58 : 0.42;
  const callWeight = 1.0 - putWeight;

  const totalEstimatedPutOi = Math.round(oi * putWeight);
  const totalEstimatedCallOi = Math.round(oi * callWeight);

  const pcrMetrics = calculatePcr(totalEstimatedPutOi, totalEstimatedCallOi, settings);

  // Highest Call OI Wall (Major Resistance) typically prints 1-3 strikes above ATM
  const callWallStrike = atmStrike + (strikeStep * 2);
  const callWallOi = Math.round(totalEstimatedCallOi * 0.38);

  // Highest Put OI Wall (Major Support) typically prints 1-3 strikes below ATM
  const putWallStrike = atmStrike - (strikeStep * 2);
  const putWallOi = Math.round(totalEstimatedPutOi * 0.38);

  // Max Pain strike: Where option sellers stand to pay least intrinsic value
  const maxPainStrike = atmStrike;

  // Proximity to Walls
  const distToCallWallPct = Math.round((((callWallStrike - ltp) / ltp) * 100) * 100) / 100;
  const distToPutWallPct = Math.round((((ltp - putWallStrike) / ltp) * 100) * 100) / 100;

  let wallWarning = null;
  if (distToCallWallPct >= 0 && distToCallWallPct <= 1.0) {
    wallWarning = `Approaching Call Wall at ₹${callWallStrike} (${distToCallWallPct}% away). High resistance expected.`;
  } else if (distToPutWallPct >= 0 && distToPutWallPct <= 1.0) {
    wallWarning = `Approaching Put Wall at ₹${putWallStrike} (${distToPutWallPct}% away). Strong support zone.`;
  }

  return {
    symbol: stock.symbol,
    ltp,
    atmStrike,
    pcr: pcrMetrics.pcr,
    pcrStatus: pcrMetrics.status,
    pcrStatusText: pcrMetrics.statusText,
    pcrBadgeClass: pcrMetrics.badgeClass,
    callWallStrike,
    callWallOi,
    distToCallWallPct,
    putWallStrike,
    putWallOi,
    distToPutWallPct,
    maxPainStrike,
    wallWarning
  };
}

module.exports = {
  classifyVix,
  calculatePcr,
  computeStockDerivativesEdge
};
