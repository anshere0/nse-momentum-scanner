/**
 * Volume-Weighted Average Price (VWAP) Calculation & Distance Utilities
 */

function computeVwapMetrics(stock, settings = {}) {
  const ltp = Number(stock.ltp) || 0;
  const high = Number(stock.high) || ltp;
  const low = Number(stock.low) || ltp;
  const open = Number(stock.open) || ltp;
  const close = Number(stock.close) || ltp;

  // Use broker average traded price (ATP) if available, otherwise typical price estimation
  let vwap = Number(stock.avgPrice || stock.atp || stock.vwap);
  if (!vwap || vwap <= 0) {
    // Weighted typical price: (High + Low + 2*LTP) / 4
    vwap = Math.round(((high + low + 2 * ltp) / 4) * 100) / 100;
  }

  const distancePct = vwap > 0 ? Math.round((((ltp - vwap) / vwap) * 100) * 100) / 100 : 0;
  const isAboveVwap = ltp >= vwap;

  const idealMin = settings.idealDistanceMinPct || 0.5;
  const idealMax = settings.idealDistanceMaxPct || 1.2;
  const overextendedLimit = settings.overextendedLimitPct || 3.0;

  let status = 'NEUTRAL';
  let statusText = 'At VWAP';
  let badgeClass = 'bg-gray-800 text-gray-300';

  if (distancePct > overextendedLimit) {
    status = 'OVEREXTENDED_LONG';
    statusText = `Overextended Long (+${distancePct.toFixed(1)}%)`;
    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  } else if (distancePct < -overextendedLimit) {
    status = 'OVEREXTENDED_SHORT';
    statusText = `Overextended Short (${distancePct.toFixed(1)}%)`;
    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  } else if (distancePct >= idealMin && distancePct <= idealMax) {
    status = 'SWEET_SPOT_LONG';
    statusText = 'Ideal Long Entry Zone';
    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (distancePct <= -idealMin && distancePct >= -idealMax) {
    status = 'SWEET_SPOT_SHORT';
    statusText = 'Ideal Short Entry Zone';
    badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else if (isAboveVwap) {
    status = 'ABOVE_VWAP';
    statusText = 'Above VWAP (Bullish)';
    badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  } else {
    status = 'BELOW_VWAP';
    statusText = 'Below VWAP (Bearish)';
    badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  }

  return {
    vwap,
    distancePct,
    isAboveVwap,
    status,
    statusText,
    badgeClass
  };
}

module.exports = {
  computeVwapMetrics
};
