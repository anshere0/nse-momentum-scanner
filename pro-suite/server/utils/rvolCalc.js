/**
 * Relative Volume (R-Vol) Utility & Institutional Volume Shocker Detection
 * Quantitative market-microstructure model calibrated for NSE F&O contracts.
 */

function computeRvolMetrics(stock, settings = {}) {
  const currentVolume = Number(stock.volume) || 0;
  const highThreshold = Number(settings.highThreshold) || 2.0;
  const veryHighThreshold = Number(settings.veryHighThreshold) || 3.0;
  const baselineLots = Number(settings.baselineLots) || 2000;

  const lotSize = Number(stock.lotSize) || 250;
  const ltp = Number(stock.ltp) || 1000;

  // 1. Expected Baseline Daily Volume (in shares)
  // For NSE F&O contracts, typical average daily turnover is between 1,500 to 2,500 lots.
  // Using lot-normalized liquidity prevents price-tier distortion between ₹15 and ₹40,000 stocks.
  let baselineVolume = Number(stock.baselineVolume);
  if (!baselineVolume || baselineVolume <= 0) {
    baselineVolume = Math.round(baselineLots * lotSize);
  }

  // 2. Adjust for time-of-day progress in IST (09:15 to 15:30)
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const istMinutes = (utcHours * 60 + utcMinutes + 330) % 1440; // minutes from midnight IST

  // Market is 09:15 (555 min) to 15:30 (930 min) -> 375 trading minutes
  let progressPct = 1.0;
  if (istMinutes >= 555 && istMinutes <= 930) {
    progressPct = Math.max(0.05, Math.min(1.0, (istMinutes - 555) / 375));
  } else {
    // Market closed (pre-market or post-market analysis)
    progressPct = 1.0;
  }

  // Expected cumulative volume up to current minute
  const expectedVolumeSoFar = Math.max(100, Math.round(baselineVolume * progressPct));

  // 3. Compute R-Vol Multiplier
  const rvol = expectedVolumeSoFar > 0 
    ? Math.round((currentVolume / expectedVolumeSoFar) * 100) / 100 
    : 0;

  let badge = 'NORMAL';
  let badgeText = 'Normal';
  let badgeClass = 'bg-gray-800 text-gray-300 border-gray-700';

  if (rvol >= veryHighThreshold) {
    badge = 'VERY_HIGH';
    badgeText = `🔥 Ultra High (${rvol.toFixed(1)}x)`;
    badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/20';
  } else if (rvol >= highThreshold) {
    badge = 'HIGH';
    badgeText = `⚡ High (${rvol.toFixed(1)}x)`;
    badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/50';
  } else if (rvol >= 1.2) {
    badge = 'ABOVE_AVG';
    badgeText = `Above Avg (${rvol.toFixed(1)}x)`;
    badgeClass = 'bg-teal-500/20 text-teal-300 border-teal-500/40';
  } else if (rvol < 0.7) {
    badge = 'LOW';
    badgeText = `Dry / Low (${rvol.toFixed(1)}x)`;
    badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else {
    badgeText = `Normal (${rvol.toFixed(1)}x)`;
  }

  return {
    rvol,
    currentVolume,
    expectedVolumeSoFar,
    baselineDailyVolume: baselineVolume,
    badge,
    badgeText,
    badgeClass,
    isVolumeSpike: rvol >= highThreshold
  };
}

module.exports = {
  computeRvolMetrics
};
