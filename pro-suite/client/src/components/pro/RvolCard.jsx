import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, RefreshCw, RotateCcw, ArrowUpDown, Flame, Zap, BarChart2 } from 'lucide-react';
import InfoBox from '../common/InfoBox';
import ConfidenceBadge from '../common/ConfidenceBadge';

export default function RvolCard({ settings = {}, onSaveSettings, onOpenChart }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('rvol');
  const [sortDir, setSortDir] = useState('desc');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [counts, setCounts] = useState({ veryHigh: 0, high: 0, aboveAvg: 0, low: 0 });

  const fetchRvolData = async () => {
    try {
      const params = new URLSearchParams({
        badgeFilter: filter,
        search,
        sortField,
        sortDir
      });
      const res = await fetch(`/api/pro/rvol?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStocks(data.stocks || []);
        if (data.counts) {
          setCounts({
            veryHigh: data.counts.veryHigh || 0,
            high: data.counts.high || 0,
            aboveAvg: data.counts.aboveAvg || 0,
            low: data.counts.low || 0
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch rvol data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRvolData();
  }, [filter, search, sortField, sortDir]);

  useEffect(() => {
    const t = setInterval(fetchRvolData, 12000);
    return () => clearInterval(t);
  }, [filter, search, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const formatVolume = (val) => {
    if (!val) return '0';
    if (val >= 10000000) return (val / 10000000).toFixed(2) + ' Cr';
    if (val >= 100000) return (val / 100000).toFixed(2) + ' L';
    return Number(val).toLocaleString('en-IN');
  };

  return (
    <div className="space-y-5">
      {/* "ⓘ What is this?" Box */}
      <InfoBox
        title="Relative Volume (R-Vol) & Institutional Volume Shockers"
        what="Relative Volume (R-Vol) compares today's cumulative volume to what is normally traded up to this exact time of day over the past 10 trading sessions. It instantly separates aggressive institutional buying from retail churning."
        calculation="R-Vol = Current Traded Volume / 10-Day Expected Volume at this minute"
        example="A breakout with R-Vol > 3.0x indicates an institutional volume blast. A breakout with R-Vol < 0.7x is a dry, low-conviction move prone to failure. Combine R-Vol > 2.0x with Long Buildup for the highest win rate."
        defaultOpen={true}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilter('VERY_HIGH')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'VERY_HIGH' ? 'bg-purple-950/30 border-purple-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-purple-400 font-semibold uppercase">
            <span>Ultra R-Vol (&gt;3x)</span>
            <Flame className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.veryHigh}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Institutional Volume Blast</div>
        </div>

        <div
          onClick={() => setFilter('HIGH')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'HIGH' ? 'bg-blue-950/30 border-blue-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-blue-400 font-semibold uppercase">
            <span>High R-Vol (&gt;2x)</span>
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.high}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Heavy Institutional Flow</div>
        </div>

        <div
          onClick={() => setFilter('ABOVE_AVG')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'ABOVE_AVG' ? 'bg-teal-950/30 border-teal-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-teal-400 font-semibold uppercase">
            <span>Above Avg (1.2-2x)</span>
            <BarChart2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.aboveAvg}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Healthy Participation</div>
        </div>

        <div
          onClick={() => setFilter('LOW')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'LOW' ? 'bg-rose-950/30 border-rose-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-400 font-semibold uppercase">
            <span>Dry / Low (&lt;0.7x)</span>
            <span className="text-xs">⚠️</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.low}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Lack of Volume (Beware)</div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="glass-card rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between border border-gray-800">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search F&O symbol..."
            className="w-full pl-10 pr-3 py-2 bg-[#0a0d14] border border-gray-700 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: 'All Stocks' },
            { id: 'VERY_HIGH', label: '🔥 Ultra High (>3x)' },
            { id: 'HIGH', label: '⚡ High (>2x)' },
            { id: 'ABOVE_AVG', label: 'Above Average' },
            { id: 'LOW', label: 'Low (<0.7x)' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filter === p.id ? 'bg-blue-600 text-white shadow' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSettingsModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold cursor-pointer border border-gray-700"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
          <span>⚙ Settings</span>
        </button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden shadow-2xl border border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#121622] border-b border-gray-800 text-gray-400 uppercase text-[11px] font-semibold tracking-wider">
                <th onClick={() => handleSort('symbol')} className="py-3.5 px-4 cursor-pointer hover:text-white select-none">
                  Symbol / Contract
                </th>
                <th onClick={() => handleSort('ltp')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white select-none">
                  Price (LTP)
                </th>
                <th onClick={() => handleSort('pChange')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white select-none">
                  % Change
                </th>
                <th onClick={() => handleSort('rvol')} className="py-3.5 px-4 text-right cursor-pointer hover:text-purple-300 select-none bg-purple-950/20">
                  Relative Volume (R-Vol)
                </th>
                <th className="py-3.5 px-4 text-right">
                  Traded Volume
                </th>
                <th className="py-3.5 px-4 text-right text-gray-500">
                  Expected Baseline
                </th>
                <th className="py-3.5 px-4 text-center">
                  R-Vol Badge
                </th>
                <th className="py-3.5 px-4 text-center">
                  Confidence Score & Reasoning
                </th>
                <th className="py-3.5 px-4 text-right">
                  Chart
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-800/60 font-mono text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-gray-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    Calculating 10-day time-of-day Relative Volume...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-gray-400">
                    No stocks matching the selected R-Vol filter.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const rvolData = stock.rvolData || {};
                  const isPositive = stock.pChange > 0;

                  return (
                    <tr key={stock.token || stock.symbol} className="hover:bg-[#161b29] transition-colors">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-white text-sm sm:text-base">{stock.symbol}</div>
                        <div className="text-[11px] text-gray-500 font-mono">Lot: {stock.lotSize}</div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-gray-100">
                        ₹{Number(stock.ltp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isPositive ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                        }`}>
                          {isPositive ? '+' : ''}{Number(stock.pChange).toFixed(2)}%
                        </span>
                      </td>

                      {/* R-Vol */}
                      <td className="py-3.5 px-4 text-right font-bold bg-purple-950/10">
                        <span className={`text-base font-bold font-mono ${
                          rvolData.rvol >= 2.5 ? 'text-purple-300' : rvolData.rvol >= 1.5 ? 'text-blue-300' : 'text-gray-300'
                        }`}>
                          {rvolData.rvol ? `${rvolData.rvol.toFixed(2)}x` : '-'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right text-gray-300 font-sans text-xs">
                        {formatVolume(stock.volume)}
                      </td>

                      <td className="py-3.5 px-4 text-right text-gray-500 font-sans text-xs">
                        {formatVolume(rvolData.expectedVolumeSoFar)}
                      </td>

                      <td className="py-3.5 px-4 text-center font-sans">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${rvolData.badgeClass || 'bg-gray-800 text-gray-300'}`}>
                          {rvolData.badgeText || 'Normal'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-sans">
                        <ConfidenceBadge
                          score={stock.rvolConfidence?.score ?? stock.confidenceScore}
                          grade={stock.rvolConfidence?.grade ?? stock.confidenceGrade}
                          data={stock.rvolConfidence ?? stock.confidenceData}
                        />
                      </td>

                      <td className="py-3.5 px-4 text-right font-sans">
                        <button
                          onClick={() => onOpenChart && onOpenChart(stock.symbol)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-white font-medium text-xs inline-flex items-center gap-1.5 transition"
                          title={`View ${stock.symbol} Candlestick Chart`}
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                          <span>📈 Chart</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <RvolSettingsModal
          currentSettings={settings.rvol || {}}
          onClose={() => setShowSettingsModal(false)}
          onSave={(newSettings) => {
            onSaveSettings({ rvol: newSettings });
            setShowSettingsModal(false);
            fetchRvolData();
          }}
        />
      )}
    </div>
  );
}

function RvolSettingsModal({ currentSettings, onClose, onSave }) {
  const [highThreshold, setHighThreshold] = useState(currentSettings.highThreshold ?? 2.0);
  const [veryHighThreshold, setVeryHighThreshold] = useState(currentSettings.veryHighThreshold ?? 3.0);
  const [baselineLots, setBaselineLots] = useState(currentSettings.baselineLots ?? 2000);

  const handleReset = () => {
    setHighThreshold(2.0);
    setVeryHighThreshold(3.0);
    setBaselineLots(2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121622] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 text-left">
        <h3 className="text-lg font-bold text-white mb-2">⚙ Relative Volume (R-Vol) Settings</h3>
        <p className="text-xs text-gray-400 mb-5">
          Tune institutional volume multiplier thresholds and daily lot baseline.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-300 font-semibold block mb-1">
              High R-Vol Multiplier (Default: 2.0x)
            </label>
            <input
              type="number"
              step="0.1"
              value={highThreshold}
              onChange={(e) => setHighThreshold(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0a0d14] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-300 font-semibold block mb-1">
              Ultra-High R-Vol Multiplier (Default: 3.0x)
            </label>
            <input
              type="number"
              step="0.1"
              value={veryHighThreshold}
              onChange={(e) => setVeryHighThreshold(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0a0d14] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-300 font-semibold block mb-1">
              Baseline Liquidity Lots (Default: 2,000 Lots)
            </label>
            <input
              type="number"
              step="250"
              value={baselineLots}
              onChange={(e) => setBaselineLots(parseInt(e.target.value) || 2000)}
              className="w-full bg-[#0a0d14] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-sm"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Average turnover across NSE F&O contracts. Multiplied by stock lot size to normalize liquidity across all price tiers.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-gray-800 pt-4">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 text-gray-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave({ highThreshold, veryHighThreshold, baselineLots })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
