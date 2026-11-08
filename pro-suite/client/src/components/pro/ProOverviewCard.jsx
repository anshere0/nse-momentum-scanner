import React, { useState, useEffect } from 'react';
import { ShieldCheck, TrendingUp, TrendingDown, Target, Zap, Activity, RefreshCw, BarChart2, Layers } from 'lucide-react';
import ConfidenceBadge from '../common/ConfidenceBadge';
import InfoBox from '../common/InfoBox';

export default function ProOverviewCard({ onSelectTab, onOpenChart }) {
  const [data, setData] = useState({ counts: {}, topPicks: [] });
  const [loading, setLoading] = useState(true);

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/pro/overview');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch overview', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const t = setInterval(fetchOverview, 10000);
    return () => clearInterval(t);
  }, []);

  const counts = data.counts || {};
  const topPicks = data.topPicks || [];

  return (
    <div className="space-y-6">
      {/* Educational Guide Box */}
      <InfoBox
        title="Pro Quantitative Suite Overview"
        what="Consolidates real-time institutional signals across 8 quantitative modules: F&O Open Interest Buildup, VWAP Benchmarks, 15m Opening Range Breakouts, Relative Volume (R-Vol), Sector Alignment, Risk Management, Derivatives Edge (PCR & OI Walls), and Interactive Candlestick Charts."
        calculation="Multi-Factor Confluence: Confidence Score (0-100) rewards stocks simultaneously displaying heavy OI accumulation, trade above VWAP, active sector tailwind, and volume confirmation."
        example="Look for Grade A setups (>80% score) in the Top Picks section. Click 📈 Chart on any stock to visually inspect its 5m candles, intraday VWAP line, and 15m ORB channel."
        defaultOpen={true}
      />
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div
          onClick={() => onSelectTab('quadrant')}
          className="glass-card p-4 rounded-xl border border-emerald-500/30 hover:border-emerald-500/60 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-400 font-semibold uppercase">Long Buildup</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1.5">{counts.longBuildup || 0}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Institutions buying contracts</p>
        </div>

        <div
          onClick={() => onSelectTab('quadrant')}
          className="glass-card p-4 rounded-xl border border-rose-500/30 hover:border-rose-500/60 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-rose-400 font-semibold uppercase">Short Buildup</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1.5">{counts.shortBuildup || 0}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Institutions shorting contracts</p>
        </div>

        <div
          onClick={() => onSelectTab('vwap')}
          className="glass-card p-4 rounded-xl border border-blue-500/30 hover:border-blue-500/60 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-400 font-semibold uppercase">Above VWAP</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1.5">{counts.aboveVwap || 0}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Bullish intraday momentum</p>
        </div>

        <div
          onClick={() => onSelectTab('orb')}
          className="glass-card p-4 rounded-xl border border-purple-500/30 hover:border-purple-500/60 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-400 font-semibold uppercase">ORB Breakouts</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1.5">{counts.orbBreakoutUp || 0}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Trading above 15m high</p>
        </div>

        <div
          onClick={() => onSelectTab('derivatives')}
          className="glass-card p-4 rounded-xl border border-teal-500/30 hover:border-teal-500/60 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-teal-400 font-semibold uppercase">Derivatives Edge</span>
            <Target className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1.5">{counts.pcrOverbought + counts.pcrOversold || 0}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">PCR alerts & OI walls</p>
        </div>

        <div
          onClick={() => onSelectTab('charts')}
          className="glass-card p-4 rounded-xl border border-cyan-500/30 hover:border-cyan-500/60 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-cyan-400 font-semibold uppercase">Interactive Charts</span>
            <BarChart2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1.5">5m / 15m</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Candlesticks + VWAP</p>
        </div>
      </div>

      {/* Top 5 High-Conviction Institutional Setups */}
      <div className="glass-card rounded-2xl p-5 border border-gray-800 shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Top High-Confidence Setups (Multi-Factor Confluence)
              </h2>
              <p className="text-xs text-gray-400">
                Ranked by institutional conviction: Pairs OI accumulation with VWAP alignment and technical breakouts.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            {topPicks.length} High Conviction Setups
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
            Evaluating multi-factor confidence algorithms...
          </div>
        ) : topPicks.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No active setups currently exceed the 75% confidence threshold. Market may be sideways or awaiting fresh triggers.
          </div>
        ) : (
          <div className="space-y-3">
            {topPicks.map((stock) => (
              <div
                key={stock.token || stock.symbol}
                className="p-4 rounded-xl bg-[#0a0d14] border border-gray-800 hover:border-gray-700 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Left Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-white text-base">{stock.symbol}</span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold font-mono bg-blue-500/10 text-blue-300">
                      ₹{Number(stock.ltp).toFixed(2)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold font-mono ${
                      stock.pChange >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {stock.pChange >= 0 ? '+' : ''}{Number(stock.pChange).toFixed(2)}%
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                      stock.quadrant === 'LONG_BUILDUP'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {stock.quadrant === 'LONG_BUILDUP' ? '🟢 Long Buildup' : '🔴 Short Buildup'}
                    </span>
                  </div>

                  {/* Quantitative Reasoning Statement */}
                  <p className="text-xs text-gray-300 leading-relaxed font-sans max-w-2xl">
                    <strong className="text-blue-400 font-semibold">Institutional Reasoning: </strong>
                    {stock.reasoning}
                  </p>
                </div>

                {/* Right Confidence Badge & Metrics */}
                <div className="flex items-center gap-4 self-end md:self-auto shrink-0">
                  <div className="text-right text-xs font-mono hidden sm:block">
                    <div className="text-gray-400">OI: <span className="text-purple-300 font-bold">{stock.oiChange > 0 ? '+' : ''}{stock.oiChange}%</span></div>
                    <div className="text-gray-400">VWAP Dist: <span className="text-gray-200">{stock.vwapData?.distancePct}%</span></div>
                  </div>
                  <ConfidenceBadge
                    score={stock.confidenceScore}
                    grade={stock.confidenceGrade}
                    data={stock.confidenceData}
                  />
                  <button
                    onClick={() => onOpenChart && onOpenChart(stock.symbol)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-white font-medium text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                    title={`View ${stock.symbol} Candlestick Chart`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>📈 Chart</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
