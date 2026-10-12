import React from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, ShieldCheck, HelpCircle } from 'lucide-react';

const MarketOverview = ({ breadth = {}, sentiment = {}, status = {} }) => {
  const advancing = breadth.advancing || 0;
  const declining = breadth.declining || 0;
  const unchanged = breadth.unchanged || 0;
  const evaluated = breadth.evaluated || (advancing + declining + unchanged);
  const ratio = breadth.advDeclineRatio !== undefined ? breadth.advDeclineRatio : (declining > 0 ? (advancing / declining).toFixed(2) : advancing > 0 ? '∞' : '0');
  const netBreadth = breadth.netBreadthPct !== undefined ? breadth.netBreadthPct : 0;

  const sentimentLabel = sentiment.label || 'INSUFFICIENT_DATA';
  const sentimentRule = sentiment.rule || '';

  const getSentimentBadge = (label) => {
    switch (label) {
      case 'POSITIVE':
        return {
          bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
          dot: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
          text: 'Bullish / Positive'
        };
      case 'NEGATIVE':
        return {
          bg: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
          dot: 'bg-rose-400 shadow-[0_0_8px_#f43f5e]',
          text: 'Bearish / Negative'
        };
      case 'SIDEWAYS':
        return {
          bg: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
          dot: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
          text: 'Neutral / Sideways'
        };
      default:
        return {
          bg: 'bg-slate-700/30 border-slate-600/40 text-slate-300',
          dot: 'bg-slate-400',
          text: 'Insufficient Data'
        };
    }
  };

  const badge = getSentimentBadge(sentimentLabel);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* Advancing Stocks */}
      <div className="glass-panel rounded-xl p-3.5 flex flex-col justify-between border-l-4 border-l-emerald-500 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
          <span>Advances</span>
          <TrendingUp size={16} className="text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-emerald-400">{advancing}</span>
          <span className="text-xs text-gray-500">stocks</span>
        </div>
        <div className="mt-1 text-[11px] text-gray-400">
          {evaluated > 0 ? `${((advancing / evaluated) * 100).toFixed(0)}% of universe` : 'Evaluating...'}
        </div>
      </div>

      {/* Declining Stocks */}
      <div className="glass-panel rounded-xl p-3.5 flex flex-col justify-between border-l-4 border-l-rose-500 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
          <span>Declines</span>
          <TrendingDown size={16} className="text-rose-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-rose-400">{declining}</span>
          <span className="text-xs text-gray-500">stocks</span>
        </div>
        <div className="mt-1 text-[11px] text-gray-400">
          {evaluated > 0 ? `${((declining / evaluated) * 100).toFixed(0)}% of universe` : 'Evaluating...'}
        </div>
      </div>

      {/* Unchanged */}
      <div className="glass-panel rounded-xl p-3.5 flex flex-col justify-between border-l-4 border-l-gray-500 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
          <span>Unchanged</span>
          <Minus size={16} className="text-gray-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-gray-300">{unchanged}</span>
          <span className="text-xs text-gray-500">stocks</span>
        </div>
        <div className="mt-1 text-[11px] text-gray-400">
          Evaluated: {evaluated}
        </div>
      </div>

      {/* Advance / Decline Ratio */}
      <div className="glass-panel rounded-xl p-3.5 flex flex-col justify-between border-l-4 border-l-sky-500 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
          <span>A/D Ratio</span>
          <Activity size={16} className="text-sky-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-sky-400">{ratio}</span>
        </div>
        <div className="mt-1 text-[11px] text-gray-400">
          Net Breadth: {typeof netBreadth === 'number' ? `${netBreadth > 0 ? '+' : ''}${netBreadth.toFixed(1)}%` : '0%'}
        </div>
      </div>

      {/* Market Sentiment */}
      <div className="glass-panel rounded-xl p-3.5 flex flex-col justify-between col-span-2 md:col-span-2 lg:col-span-2 border-l-4 border-l-purple-500 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
          <span>Market Breadth Sentiment</span>
          <ShieldCheck size={16} className="text-purple-400" />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-2 ${badge.bg}`}>
            <span className={`w-2 h-2 rounded-full ${badge.dot}`}></span>
            {badge.text}
          </div>
          <span className="text-xs font-mono text-gray-300 font-semibold">
            {typeof netBreadth === 'number' ? `${netBreadth > 0 ? '+' : ''}${netBreadth.toFixed(1)}%` : ''}
          </span>
        </div>
        <div className="mt-1.5 text-[11px] text-gray-400 truncate" title={sentimentRule || 'Based on net advancing/declining stock percentage'}>
          Rule: {sentimentRule || 'Based on configurable net breadth threshold'}
        </div>
      </div>
    </div>
  );
};

export default MarketOverview;
