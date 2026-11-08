import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, RefreshCw, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, BarChart2 } from 'lucide-react';
import InfoBox from '../common/InfoBox';
import ConfidenceBadge from '../common/ConfidenceBadge';

export default function VwapCard({ settings = {}, onSaveSettings, onOpenChart }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('vwapDistance');
  const [sortDir, setSortDir] = useState('desc');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [counts, setCounts] = useState({ aboveVwap: 0, belowVwap: 0, sweetSpotLong: 0, overextended: 0 });

  const fetchVwapData = async () => {
    try {
      const params = new URLSearchParams({
        statusFilter: filter,
        search,
        sortField,
        sortDir
      });
      const res = await fetch(`/api/pro/vwap?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStocks(data.stocks || []);
        if (data.counts) {
          setCounts({
            aboveVwap: data.counts.aboveVwap || 0,
            belowVwap: data.counts.belowVwap || 0,
            sweetSpotLong: data.counts.sweetSpotLong || 0,
            overextended: (data.counts.overextendedLong || 0) + (data.counts.overextendedShort || 0)
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch vwap data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVwapData();
  }, [filter, search, sortField, sortDir]);

  useEffect(() => {
    const t = setInterval(fetchVwapData, 12000);
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

  return (
    <div className="space-y-5">
      {/* "ⓘ What is this?" Box */}
      <InfoBox
        title="Intraday VWAP (Volume-Weighted Average Price) & Distance %"
        what="VWAP is the institutional fair-value benchmark for intraday trading. Institutions buy above VWAP and sell below VWAP. Distance % identifies whether a stock is at an ideal entry zone or dangerous to chase."
        calculation="VWAP Distance % = ((LTP - VWAP) / VWAP) * 100"
        example="A breakout occurring within 0.5% – 1.0% of VWAP offers a high R:R trade. When Distance % exceeds +3.0%, the stock is overextended and susceptible to mean-reversion pullbacks."
        defaultOpen={true}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilter('SWEET_SPOT_LONG')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'SWEET_SPOT_LONG' ? 'bg-emerald-950/30 border-emerald-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-emerald-400 font-semibold uppercase">Ideal Long Entries</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.sweetSpotLong}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Sweet Spot (+0.5% to +1.2%)</div>
        </div>

        <div
          onClick={() => setFilter('ABOVE_VWAP')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'ABOVE_VWAP' ? 'bg-blue-950/30 border-blue-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-blue-400 font-semibold uppercase">Above VWAP</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.aboveVwap}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Bullish Control</div>
        </div>

        <div
          onClick={() => setFilter('BELOW_VWAP')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'BELOW_VWAP' ? 'bg-purple-950/30 border-purple-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-purple-400 font-semibold uppercase">Below VWAP</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.belowVwap}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Bearish Control</div>
        </div>

        <div
          onClick={() => setFilter('OVEREXTENDED_LONG')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'OVEREXTENDED_LONG' ? 'bg-amber-950/30 border-amber-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-amber-400 font-semibold uppercase">Overextended (&gt;3%)</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.overextended}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Do Not Chase</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="glass-card rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between border border-gray-800">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search F&O stock..."
            className="w-full pl-10 pr-3 py-2 bg-[#0a0d14] border border-gray-700 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: 'All Stocks' },
            { id: 'SWEET_SPOT_LONG', label: '🎯 Ideal Long Entry' },
            { id: 'ABOVE_VWAP', label: 'Above VWAP' },
            { id: 'BELOW_VWAP', label: 'Below VWAP' },
            { id: 'OVEREXTENDED_LONG', label: '⚠️ Overextended' }
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

      {/* Main Table */}
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
                <th className="py-3.5 px-4 text-right">
                  Intraday VWAP
                </th>
                <th onClick={() => handleSort('vwapDistance')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white select-none">
                  VWAP Distance %
                </th>
                <th className="py-3.5 px-4 text-center">
                  Entry Quality & Status
                </th>
                <th className="py-3.5 px-4 text-center">
                  Confidence Score & Reasoning
                </th>
                <th className="py-3.5 px-4 text-center">
                  Trade Suggestion
                </th>
                <th className="py-3.5 px-4 text-right">
                  Chart
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-800/60 font-mono text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-gray-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    Computing Intraday VWAP Benchmarks...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-gray-400">
                    No stocks matching the selected VWAP criteria.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const dist = stock.vwapData?.distancePct || 0;
                  const isPositive = dist > 0;

                  return (
                    <tr key={stock.token || stock.symbol} className="hover:bg-[#161b29] transition-colors">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-white text-sm sm:text-base">{stock.symbol}</div>
                        <div className="text-[11px] text-gray-500 font-mono">Lot: {stock.lotSize}</div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-gray-100">
                        ₹{Number(stock.ltp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right text-gray-300">
                        ₹{Number(stock.vwap).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isPositive ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                        }`}>
                          {isPositive ? '+' : ''}{dist.toFixed(2)}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-sans">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${stock.vwapData?.badgeClass || 'bg-gray-800 text-gray-300'}`}>
                          {stock.vwapData?.statusText || 'Neutral'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-sans">
                        <ConfidenceBadge
                          score={stock.confidenceScore}
                          grade={stock.confidenceGrade}
                          data={stock.confidenceData}
                        />
                      </td>

                      <td className="py-3.5 px-4 text-center text-xs font-sans text-gray-300">
                        {stock.vwapData?.status === 'SWEET_SPOT_LONG' ? (
                          <span className="text-emerald-400 font-semibold">Buy on breakout with tight SL at VWAP</span>
                        ) : stock.vwapData?.status === 'OVEREXTENDED_LONG' ? (
                          <span className="text-amber-400 font-semibold">Do not chase; wait for pullback to VWAP</span>
                        ) : stock.vwapData?.status === 'SWEET_SPOT_SHORT' ? (
                          <span className="text-rose-400 font-semibold">Short on breakdown with SL at VWAP</span>
                        ) : (
                          <span className="text-gray-500">Wait for VWAP touch or breakout</span>
                        )}
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
        <VwapSettingsModal
          currentSettings={settings.vwap || {}}
          onClose={() => setShowSettingsModal(false)}
          onSave={(newSettings) => {
            onSaveSettings({ vwap: newSettings });
            setShowSettingsModal(false);
            fetchVwapData();
          }}
        />
      )}
    </div>
  );
}

function VwapSettingsModal({ currentSettings, onClose, onSave }) {
  const [idealMin, setIdealMin] = useState(currentSettings.idealDistanceMinPct ?? 0.5);
  const [idealMax, setIdealMax] = useState(currentSettings.idealDistanceMaxPct ?? 1.2);
  const [overextendedLimit, setOverextendedLimit] = useState(currentSettings.overextendedLimitPct ?? 3.0);

  const handleReset = () => {
    setIdealMin(0.5);
    setIdealMax(1.2);
    setOverextendedLimit(3.0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121622] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 text-left">
        <h3 className="text-lg font-bold text-white mb-2">⚙ VWAP Distance Settings</h3>
        <p className="text-xs text-gray-400 mb-5">
          Define the boundaries for the ideal entry zone and overextension warnings.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-300 font-semibold block mb-1">Ideal Distance Min %</label>
              <input
                type="number"
                step="0.1"
                value={idealMin}
                onChange={(e) => setIdealMin(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0a0d14] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-300 font-semibold block mb-1">Ideal Distance Max %</label>
              <input
                type="number"
                step="0.1"
                value={idealMax}
                onChange={(e) => setIdealMax(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0a0d14] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-300 font-semibold block mb-1">
              Overextended Limit % (Default: 3.0%)
            </label>
            <input
              type="number"
              step="0.5"
              value={overextendedLimit}
              onChange={(e) => setOverextendedLimit(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0a0d14] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-sm"
            />
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
              onClick={() => onSave({ idealDistanceMinPct: idealMin, idealDistanceMaxPct: idealMax, overextendedLimitPct: overextendedLimit })}
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
