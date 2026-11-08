/**
 * Quantitative Confidence & Accuracy Scoring Engine for F&O Momentum Setups
 * Computes a transparent 0-100 score and institutional reasoning based on multi-factor confluence.
 */

function calculateConfidenceScore(stock, settings = {}) {
  const ltp = stock.ltp || 0;
  const pChange = stock.pChange || 0;
  const oiChange = stock.oiChange || 0;
  const vwap = stock.vwap || stock.close || ltp;
  const pdh = stock.pdh;
  const pdl = stock.pdl;
  const orbHigh = stock.orbHigh;
  const orbLow = stock.orbLow;
  const volume = stock.volume || 0;

  // 1. Determine Quadrant
  let quadrant = 'NEUTRAL';
  let quadrantMeaning = 'Neutral / Rangebound';
  const minPc = settings.minPriceChangePct || 0.5;
  const minOi = settings.minOiChangePct || 3.0;

  if (pChange >= minPc && oiChange >= minOi) {
    quadrant = 'LONG_BUILDUP';
    quadrantMeaning = 'Strong Institutional Buying';
  } else if (pChange <= -minPc && oiChange >= minOi) {
    quadrant = 'SHORT_BUILDUP';
    quadrantMeaning = 'Aggressive Institutional Shorting';
  } else if (pChange >= minPc && oiChange <= -minOi) {
    quadrant = 'SHORT_COVERING';
    quadrantMeaning = 'Short-Covering Bounce (Counter-Trend)';
  } else if (pChange <= -minPc && oiChange <= -minOi) {
    quadrant = 'LONG_UNWINDING';
    quadrantMeaning = 'Profit Booking / Longs Closing';
  }

  // 2. Multi-factor Confluence Scoring (Max 100 points)
  let score = 30; // Baseline
  const factors = [];
  const pros = [];
  const warnings = [];

  // Factor A: Open Interest Conviction (Up to +25 points)
  const absOi = Math.abs(oiChange);
  if (absOi >= 10.0) {
    score += 25;
    factors.push({ name: 'Massive OI Accumulation', points: '+25', status: 'STRONG' });
    pros.push(`Huge OI participation (${oiChange > 0 ? '+' : ''}${oiChange.toFixed(1)}%) confirms institutional commitment.`);
  } else if (absOi >= 5.0) {
    score += 15;
    factors.push({ name: 'Solid OI Buildup', points: '+15', status: 'GOOD' });
    pros.push(`Healthy OI change (${oiChange > 0 ? '+' : ''}${oiChange.toFixed(1)}%) above significance threshold.`);
  } else {
    factors.push({ name: 'Low OI Activity', points: '+0', status: 'NEUTRAL' });
    warnings.push(`OI change is small (${oiChange.toFixed(1)}%), indicating lack of strong institutional positioning.`);
  }

  // Factor B: VWAP Alignment & Distance (Up to +25 points)
  const vwapDistancePct = vwap > 0 ? ((ltp - vwap) / vwap) * 100 : 0;
  const isAboveVwap = ltp >= vwap;

  if (quadrant === 'LONG_BUILDUP') {
    if (isAboveVwap) {
      if (vwapDistancePct >= 0.2 && vwapDistancePct <= 1.5) {
        score += 25;
        factors.push({ name: 'Optimal VWAP Sweet Spot', points: '+25', status: 'STRONG' });
        pros.push(`Price is ${vwapDistancePct.toFixed(2)}% above VWAP — ideal risk-to-reward sweet spot.`);
      } else if (vwapDistancePct > 3.0) {
        score += 5;
        factors.push({ name: 'Overextended from VWAP', points: '+5', status: 'WARNING' });
        warnings.push(`Price is overextended (+${vwapDistancePct.toFixed(1)}% above VWAP). High risk of intraday mean-reversion.`);
      } else {
        score += 15;
        factors.push({ name: 'Above VWAP', points: '+15', status: 'GOOD' });
        pros.push(`Trading above VWAP (+${vwapDistancePct.toFixed(2)}%), confirming buyers in control.`);
      }
    } else {
      score -= 15;
      factors.push({ name: 'Below VWAP Contradiction', points: '-15', status: 'DANGER' });
      warnings.push(`Price is BELOW intraday VWAP (${vwapDistancePct.toFixed(2)}%). Institutional sellers are dominant intraday.`);
    }
  } else if (quadrant === 'SHORT_BUILDUP') {
    if (!isAboveVwap) {
      if (Math.abs(vwapDistancePct) >= 0.2 && Math.abs(vwapDistancePct) <= 1.5) {
        score += 25;
        factors.push({ name: 'Optimal VWAP Short Zone', points: '+25', status: 'STRONG' });
        pros.push(`Price is ${Math.abs(vwapDistancePct).toFixed(2)}% below VWAP — ideal short entry with tight stop-loss.`);
      } else if (Math.abs(vwapDistancePct) > 3.0) {
        score += 5;
        factors.push({ name: 'Overextended Below VWAP', points: '+5', status: 'WARNING' });
        warnings.push(`Stock is oversold / stretched (-${Math.abs(vwapDistancePct).toFixed(1)}% below VWAP). Beware of short squeezes.`);
      } else {
        score += 15;
        factors.push({ name: 'Below VWAP', points: '+15', status: 'GOOD' });
        pros.push(`Trading below VWAP (-${Math.abs(vwapDistancePct).toFixed(2)}%), confirming sellers in control.`);
      }
    } else {
      score -= 15;
      factors.push({ name: 'Above VWAP Contradiction', points: '-15', status: 'DANGER' });
      warnings.push(`Price is ABOVE intraday VWAP (+${vwapDistancePct.toFixed(2)}%). Dangerous to short above VWAP.`);
    }
  } else if (quadrant === 'SHORT_COVERING') {
    score -= 10;
    factors.push({ name: 'Short Covering Rally', points: '-10', status: 'WARNING' });
    warnings.push('Price gain is driven by sellers closing shorts, NOT fresh buyers. Prone to abrupt reversal once covering finishes.');
  } else if (quadrant === 'LONG_UNWINDING') {
    score -= 10;
    factors.push({ name: 'Long Unwinding Pullback', points: '-10', status: 'WARNING' });
    warnings.push('Price drop is profit-taking by buyers, NOT heavy fresh shorting. Downside follow-through may be limited.');
  }

  // Factor C: Key Technical Breakouts (Up to +20 points)
  if (quadrant === 'LONG_BUILDUP') {
    if (pdh && ltp >= pdh) {
      score += 15;
      factors.push({ name: 'Previous Day High (PDH) Breakout', points: '+15', status: 'STRONG' });
      pros.push(`Confirmed breakout above yesterday's high (PDH: ₹${pdh.toFixed(2)}).`);
    }
    if (orbHigh && ltp >= orbHigh) {
      score += 10;
      factors.push({ name: '15m Opening Range Breakout', points: '+10', status: 'STRONG' });
      pros.push(`Breaking above 15-min Opening Range High (ORB: ₹${orbHigh.toFixed(2)}).`);
    }
  } else if (quadrant === 'SHORT_BUILDUP') {
    if (pdl && ltp <= pdl) {
      score += 15;
      factors.push({ name: 'Previous Day Low (PDL) Breakdown', points: '+15', status: 'STRONG' });
      pros.push(`Confirmed breakdown below yesterday's low (PDL: ₹${pdl.toFixed(2)}).`);
    }
    if (orbLow && ltp <= orbLow) {
      score += 10;
      factors.push({ name: '15m Opening Range Breakdown', points: '+10', status: 'STRONG' });
      pros.push(`Breaking below 15-min Opening Range Low (ORB: ₹${orbLow.toFixed(2)}).`);
    }
  }

  // Factor D: Volume Confirmation (Up to +10 points)
  if (volume >= 500000) {
    score += 10;
    factors.push({ name: 'High Volume Confirmation', points: '+10', status: 'GOOD' });
    pros.push(`Strong liquidity (${(volume / 100000).toFixed(1)} Lakhs volume) supports price action.`);
  }

  // Factor E: Relative Volume (R-Vol) Institutional Blast (Up to +15 points)
  const rvol = stock.rvolMetrics?.rvol;
  if (rvol !== undefined) {
    if (rvol >= 2.5) {
      score += 15;
      factors.push({ name: `R-Vol Blast (${rvol.toFixed(1)}x Normal)`, points: '+15', status: 'STRONG' });
      pros.push(`Exceptional relative volume (${rvol.toFixed(1)}x expected) confirms aggressive institutional entry.`);
    } else if (rvol >= 1.5) {
      score += 10;
      factors.push({ name: `Elevated R-Vol (${rvol.toFixed(1)}x Normal)`, points: '+10', status: 'GOOD' });
      pros.push(`Trading with above-average volume participation (${rvol.toFixed(1)}x normal).`);
    } else if (rvol < 0.7) {
      score -= 10;
      factors.push({ name: `Subdued R-Vol (${rvol.toFixed(1)}x Normal)`, points: '-10', status: 'WARNING' });
      warnings.push(`Low relative volume (${rvol.toFixed(1)}x). Breakout lacks institutional follow-through.`);
    }
  }

  // Factor F: Sector Alignment Tailwind (Up to +15 points)
  const sector = stock.sectorMetrics;
  if (sector) {
    if (sector.isAligned) {
      score += 15;
      factors.push({ name: `Aligned with Sector (${sector.parentSector})`, points: '+15', status: 'STRONG' });
      pros.push(`Strong sector tailwind: parent sector ${sector.parentSector} is moving in the same direction.`);
    } else if (sector.parentSector !== 'OTHER') {
      score -= 10;
      factors.push({ name: `Counter-Sector Move vs ${sector.parentSector}`, points: '-10', status: 'WARNING' });
      warnings.push(`Caution: Moving against parent sector ${sector.parentSector} (${sector.sectorChange > 0 ? '+' : ''}${sector.sectorChange}%). Risk of false breakout.`);
    }
  }

  // Clamp Score between 10 and 98 (no setup is 100% risk-free in trading)
  score = Math.max(10, Math.min(98, score));

  // Determine Confidence Grade
  let grade = 'LOW';
  let badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (score >= 80) {
    grade = 'VERY HIGH';
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (score >= 65) {
    grade = 'HIGH';
    badgeColor = 'bg-teal-500/20 text-teal-300 border-teal-500/40';
  } else if (score >= 45) {
    grade = 'MODERATE';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  }

  // Synthesize concise reasoning statement
  let reasoning = '';
  if (pros.length > 0 && warnings.length === 0) {
    reasoning = `High-conviction setup: ${pros.join(' ')}`;
  } else if (pros.length > 0 && warnings.length > 0) {
    reasoning = `Promising move with caution: ${pros[0]} ${warnings.join(' ')}`;
  } else if (warnings.length > 0) {
    reasoning = `Caution: ${warnings.join(' ')}`;
  } else {
    reasoning = 'Neutral price and OI behavior. Waiting for stronger institutional divergence or breakout.';
  }

  return {
    score,
    grade,
    badgeColor,
    quadrant,
    quadrantMeaning,
    vwapDistancePct: Math.round(vwapDistancePct * 100) / 100,
    isAboveVwap,
    factors,
    pros,
    warnings,
    reasoning
  };
}

/**
 * Feature 4: Relative Volume (R-Vol) Confidence Engine
 * Evaluates whether a volume shocker is a true institutional trend breakout vs churn/absorption.
 */
function calculateRvolConfidence(stock, rvolData = {}, settings = {}) {
  const rvol = Number(rvolData.rvol) || 0;
  const pChange = Number(stock.pChange) || 0;
  const oiChange = Number(stock.oiChange) || 0;
  const ltp = Number(stock.ltp) || 0;
  const vwap = Number(stock.vwap) || ltp;
  const isAboveVwap = stock.vwapData?.isAboveVwap ?? (ltp >= vwap);

  let score = 20;
  const factors = [];
  const pros = [];
  const warnings = [];

  // Factor 1: Volume Shock Magnitude (Up to +35 pts)
  if (rvol >= 3.0) {
    score += 35;
    factors.push({ name: 'Ultra-High Volume Blast (≥3.0x)', points: '+35', status: 'STRONG' });
    pros.push(`Exceptional institutional volume participation (${rvol.toFixed(1)}x baseline).`);
  } else if (rvol >= 2.0) {
    score += 25;
    factors.push({ name: 'High Volume Expansion (≥2.0x)', points: '+25', status: 'GOOD' });
    pros.push(`Solid volume expansion (${rvol.toFixed(1)}x baseline) confirming elevated market interest.`);
  } else if (rvol >= 1.2) {
    score += 15;
    factors.push({ name: 'Above-Average Volume', points: '+15', status: 'NEUTRAL' });
    pros.push(`Above average volume flow (${rvol.toFixed(1)}x).`);
  } else if (rvol < 0.7) {
    score -= 10;
    factors.push({ name: 'Dry / Subdued Volume (<0.7x)', points: '-10', status: 'WARNING' });
    warnings.push(`Volume is dry (${rvol.toFixed(1)}x), lacking institutional confirmation.`);
  }

  // Factor 2: Price Directional Expansion (Up to +25 pts)
  const absPriceChange = Math.abs(pChange);
  if (absPriceChange >= 2.0) {
    score += 25;
    factors.push({ name: 'Aggressive Price Expansion', points: '+25', status: 'STRONG' });
    pros.push(`Strong price momentum (${pChange >= 0 ? '+' : ''}${pChange.toFixed(1)}%) confirms buyers/sellers are moving the market.`);
  } else if (absPriceChange >= 0.8) {
    score += 15;
    factors.push({ name: 'Healthy Price Direction', points: '+15', status: 'GOOD' });
  } else if (rvol >= 2.0 && absPriceChange < 0.4) {
    // Dangerous Institutional Churn / Absorption
    score -= 15;
    factors.push({ name: 'Volume Churn / Absorption Warning', points: '-15', status: 'DANGER' });
    warnings.push(`Heavy volume without price movement (${pChange >= 0 ? '+' : ''}${pChange.toFixed(2)}%) indicates institutional absorption or battle at key levels.`);
  }

  // Factor 3: VWAP Trend Agreement (Up to +20 pts)
  const isBullish = pChange >= 0;
  if ((isBullish && isAboveVwap) || (!isBullish && !isAboveVwap)) {
    score += 20;
    factors.push({ name: 'VWAP Trend Alignment', points: '+20', status: 'STRONG' });
    pros.push(`Price is trading ${isAboveVwap ? 'above' : 'below'} VWAP, confirming intraday dominance.`);
  } else {
    score -= 15;
    factors.push({ name: 'VWAP Trend Contradiction', points: '-15', status: 'DANGER' });
    warnings.push(`Price is trading against VWAP (${isAboveVwap ? 'above' : 'below'} VWAP). High risk of false breakout.`);
  }

  // Factor 4: F&O Open Interest Buildup (Up to +20 pts)
  if (stock.quadrant === 'LONG_BUILDUP' || stock.quadrant === 'SHORT_BUILDUP') {
    score += 20;
    factors.push({ name: 'Institutional OI Buildup', points: '+20', status: 'STRONG' });
    pros.push(`Volume is backed by aggressive open interest buildup (${oiChange > 0 ? '+' : ''}${oiChange.toFixed(1)}%).`);
  } else if (stock.quadrant === 'SHORT_COVERING' || stock.quadrant === 'LONG_UNWINDING') {
    score -= 5;
    factors.push({ name: 'Unwinding / Covering Flow', points: '-5', status: 'WARNING' });
    warnings.push(`Volume spike is driven by position squaring (${stock.quadrant}), not fresh directional bets.`);
  }

  score = Math.max(10, Math.min(100, score));

  let grade = 'LOW';
  let badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (score >= 80) {
    grade = 'VERY HIGH';
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (score >= 65) {
    grade = 'HIGH';
    badgeColor = 'bg-teal-500/20 text-teal-300 border-teal-500/40';
  } else if (score >= 45) {
    grade = 'MODERATE';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  }

  let reasoning = '';
  if (pros.length > 0 && warnings.length === 0) {
    reasoning = `High-conviction volume breakout: ${pros.join(' ')}`;
  } else if (pros.length > 0 && warnings.length > 0) {
    reasoning = `${pros[0]} ${warnings.join(' ')}`;
  } else if (warnings.length > 0) {
    reasoning = `Volume alert: ${warnings.join(' ')}`;
  } else {
    reasoning = 'Volume and price action are in line with historical baseline.';
  }

  return {
    score,
    grade,
    badgeColor,
    factors,
    pros,
    warnings,
    reasoning
  };
}

/**
 * Feature 5: Sector Tailwind & Relative Strength (RS) Confidence Engine
 */
function calculateSectorConfidence(stock, sectorData = {}, settings = {}) {
  const parentSector = sectorData.parentSector || 'MARKET';
  const sectorChange = Number(sectorData.sectorChange) || 0;
  const rsScore = Number(sectorData.rsScore) || 0;
  const isAligned = Boolean(sectorData.isAligned);
  const pChange = Number(stock.pChange) || 0;
  const ltp = Number(stock.ltp) || 0;
  const vwap = Number(stock.vwap) || ltp;
  const isAboveVwap = stock.vwapData?.isAboveVwap ?? (ltp >= vwap);

  let score = 25;
  const factors = [];
  const pros = [];
  const warnings = [];

  // Factor 1: Sector Tailwind Direction (Up to +35 pts)
  if (isAligned) {
    if (Math.abs(sectorChange) >= 1.0) {
      score += 35;
      factors.push({ name: `Strong Sector Tailwind (${parentSector})`, points: '+35', status: 'STRONG' });
      pros.push(`Dominant sectoral tailwind: ${parentSector} is powering ahead (${sectorChange > 0 ? '+' : ''}${sectorChange.toFixed(2)}%).`);
    } else {
      score += 25;
      factors.push({ name: `Sector Aligned (${parentSector})`, points: '+25', status: 'GOOD' });
      pros.push(`Moving in harmony with ${parentSector} (${sectorChange > 0 ? '+' : ''}${sectorChange.toFixed(2)}%).`);
    }
  } else {
    score -= 20;
    factors.push({ name: `Moving Against ${parentSector}`, points: '-20', status: 'DANGER' });
    warnings.push(`Stock is moving contrary to parent sector ${parentSector} (${sectorChange > 0 ? '+' : ''}${sectorChange.toFixed(2)}%). High risk of sector drag.`);
  }

  // Factor 2: Relative Strength vs Nifty 50 (Up to +35 pts)
  if (rsScore >= 1.5) {
    score += 35;
    factors.push({ name: 'Dominant RS Leader vs Nifty 50', points: '+35', status: 'STRONG' });
    pros.push(`Massive outperformance: Beating Nifty 50 benchmark by +${rsScore.toFixed(2)}%.`);
  } else if (rsScore >= 0.75) {
    score += 25;
    factors.push({ name: 'Solid RS Leader', points: '+25', status: 'GOOD' });
    pros.push(`Clear relative strength advantage (+${rsScore.toFixed(2)}% vs Nifty 50).`);
  } else if (rsScore <= -1.0) {
    score -= 15;
    factors.push({ name: 'Severe RS Laggard', points: '-15', status: 'WARNING' });
    warnings.push(`Severely lagging broader market (${rsScore.toFixed(2)}% vs Nifty 50).`);
  } else {
    score += 10;
    factors.push({ name: 'Market In-Line RS', points: '+10', status: 'NEUTRAL' });
  }

  // Factor 3: Technical & VWAP Confluence (Up to +20 pts)
  const isBullish = pChange >= 0;
  if ((isBullish && isAboveVwap) || (!isBullish && !isAboveVwap)) {
    score += 15;
    factors.push({ name: 'VWAP Agreement', points: '+15', status: 'GOOD' });
  } else {
    score -= 10;
    warnings.push(`Opposing intraday VWAP.`);
  }

  score = Math.max(10, Math.min(100, score));

  let grade = 'LOW';
  let badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (score >= 80) {
    grade = 'VERY HIGH';
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (score >= 65) {
    grade = 'HIGH';
    badgeColor = 'bg-teal-500/20 text-teal-300 border-teal-500/40';
  } else if (score >= 45) {
    grade = 'MODERATE';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  }

  let reasoning = '';
  if (pros.length > 0 && warnings.length === 0) {
    reasoning = `Sector tailwind confirmed: ${pros.join(' ')}`;
  } else if (pros.length > 0 && warnings.length > 0) {
    reasoning = `${pros[0]} ${warnings.join(' ')}`;
  } else if (warnings.length > 0) {
    reasoning = `Sector drag warning: ${warnings.join(' ')}`;
  } else {
    reasoning = `Trading in line with benchmark and ${parentSector}.`;
  }

  return {
    score,
    grade,
    badgeColor,
    factors,
    pros,
    warnings,
    reasoning
  };
}

module.exports = {
  calculateConfidenceScore,
  calculateRvolConfidence,
  calculateSectorConfidence
};
