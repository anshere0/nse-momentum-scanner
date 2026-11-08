/**
 * 15-minute and 30-minute Opening Range Breakout (ORB) Utilities
 */

function computeOrbMetrics(stock, settings = {}) {
  const ltp = Number(stock.ltp) || 0;
  const open = Number(stock.open) || ltp;
  const high = Number(stock.high) || ltp;
  const low = Number(stock.low) || ltp;
  const volume = Number(stock.volume) || 0;

  // Window: 15 min or 30 min (settings.windowMinutes, default 15)
  const windowMinutes = settings.windowMinutes || 15;
  const windowFactor = windowMinutes === 30 ? 0.75 : 0.60;

  // Calculate or retrieve ORB high & low
  let orbHigh = Number(stock.orbHigh);
  let orbLow = Number(stock.orbLow);

  if (!orbHigh || orbHigh <= 0) {
    const rangeUp = Math.max(0, high - open);
    orbHigh = Math.round((open + rangeUp * windowFactor) * 100) / 100;
  }
  if (!orbLow || orbLow <= 0) {
    const rangeDown = Math.max(0, open - low);
    orbLow = Math.round((open - rangeDown * windowFactor) * 100) / 100;
  }

  // Determine Breakout Status
  let status = 'INSIDE_RANGE';
  let statusText = 'Inside Opening Range';
  let badgeClass = 'bg-gray-800 text-gray-300';
  let breakoutDistancePct = 0;

  if (ltp > orbHigh) {
    status = 'BREAKOUT_UP';
    breakoutDistancePct = Math.round((((ltp - orbHigh) / orbHigh) * 100) * 100) / 100;
    statusText = `Breakout Up (+${breakoutDistancePct.toFixed(2)}%)`;
    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (ltp < orbLow) {
    status = 'BREAKDOWN_DOWN';
    breakoutDistancePct = Math.round((((ltp - orbLow) / orbLow) * 100) * 100) / 100;
    statusText = `Breakdown Down (${breakoutDistancePct.toFixed(2)}%)`;
    badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else {
    // Inside range distance to high
    breakoutDistancePct = Math.round((((orbHigh - ltp) / orbHigh) * 100) * 100) / 100;
  }

  const rangeSpanPct = orbLow > 0 ? Math.round((((orbHigh - orbLow) / orbLow) * 100) * 100) / 100 : 0;

  return {
    windowMinutes,
    orbHigh,
    orbLow,
    rangeSpanPct,
    status,
    statusText,
    badgeClass,
    breakoutDistancePct
  };
}

module.exports = {
  computeOrbMetrics
};
