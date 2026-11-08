import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, RefreshCw, RotateCcw, Check, ArrowUpDown, ArrowUp, ArrowDown, BarChart2 } from 'lucide-react';
import InfoBox from '../common/InfoBox';
import ConfidenceBadge from '../common/ConfidenceBadge';

export default function QuadrantCard({ settings = {}, onSaveSettings, onOpenChart }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('confidenceScore');
  const [sortDir, setSortDir] = useState('desc');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [counts, setCounts] = useState({ longBuildup: 0, shortBuildup: 0, shortCovering: 0, longUnwinding: 0 });

  const fetchQuadrantData = async () => {
    try {
      const params = new URLSearchParams({
        quadrantFilter: filter,
        search,
        sortField,
        sortDir
      });
      const res = await fetch(`/api/pro/quadrant?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStocks(data.stocks || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch (err) {
      console.error('Failed to fetch quadrant data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuadrantData();
  }, [filter, search, sortField, sortDir]);

  // Periodic polling every 12s
  useEffect(() => {
    const t = setInterval(fetchQuadrantData, 12000);
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

  const getQuadrantBadge = (q) => {
    switch (q) {
      case 'LONG_BUILDUP':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            🟢 Long Buildup
          </span>
        );
      case 'SHORT_BUILDUP':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            🔴 Short Buildup
          </span>
        );
      case 'SHORT_COVERING':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            🟡 Short Covering
          </span>
        );
      case 'LONG_UNWINDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
            🟠 Long Unwinding
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400">
            Neutral
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* "ⓘ What is this?" Box */}
      <InfoBox
        title="F&O 4-Quadrant Interpretation & Confidence Score"
        what="Categorizes stock derivatives into 4 distinct institutional phases by pairing Price Change with Open Interest (OI) Change. A quantitative Confidence Score (0-100) confirms whether institutions are truly accumulating or if the move is a retail trap."
        calculation="Long Buildup (Price ↑ + OI ↑) | Short Buildup (Price ↓ + OI ↑) | Short Covering (Price ↑ + OI ↓) | Long Unwinding (Price ↓ + OI ↓)"
        example="If a stock jumps +3% but OI drops -8%, it is a Short Covering rally (sellers covering), NOT institutional buying. High risk of reversal. A high confidence setup requires Price ↑ + OI ↑ + Trading above VWAP."
        defaultOpen={true}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilter('LONG_BUILDUP')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'LONG_BUILDUP' ? 'bg-emerald-950/30 border-emerald-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-emerald-400 font-semibold uppercase">Long Buildup</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.longBuildup}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Strong Buying</div>
        </div>

        <div
          onClick={() => setFilter('SHORT_BUILDUP')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'SHORT_BUILDUP' ? 'bg-rose-950/30 border-rose-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-rose-400 font-semibold uppercase">Short Buildup</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.shortBuildup}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Strong Selling</div>
        </div>

        <div
          onClick={() => setFilter('SHORT_COVERING')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'SHORT_COVERING' ? 'bg-amber-950/30 border-amber-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-amber-400 font-semibold uppercase">Short Covering</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.shortCovering}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Weak Bounce</div>
        </div>

        <div
          onClick={() => setFilter('LONG_UNWINDING')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'LONG_UNWINDING' ? 'bg-orange-950/30 border-orange-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-orange-400 font-semibold uppercase">Long Unwinding</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.longUnwinding}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Profit Booking</div>
        </div>
      </div>

      {/* Control Bar: Filter Pills + Search + Settings */}
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
          {['ALL', 'LONG_BUILDUP', 'SHORT_BUILDUP', 'SHORT_COVERING', 'LONG_UNWINDING'].map(q => (
            <button
              key={q}
              onClick={() => setFilter(q)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filter === q ? 'bg-blue-600 text-white shadow' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {q === 'ALL' ? 'All F&O' : q.replace('_', ' ')}
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
                <th onClick={() => handleSort('pChange')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white select-none">
                  % Change
                </th>
                <th onClick={() => handleSort('oi')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white select-none">
                  Open Interest (OI)
                </th>
                <th onClick={() => handleSort('oiChange')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white select-none">
                  OI Change %
                </th>
                <th className="py-3.5 px-4 text-center">
                  Quadrant Phase
                </th>
                <th onClick={() => handleSort('confidenceScore')} className="py-3.5 px-4 text-center cursor-pointer hover:text-white select-none">
                  Confidence Score & Reasoning
                </th>
                <th className="py-3.5 px-4 text-center">
                  Institutional Meaning
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
                    Calculating 4-Quadrant Institutional Buildups...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-gray-400">
                    No stocks matching the selected quadrant.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const isPositive = stock.pChange > 0;
                  const isNegative = stock.pChange < 0;
                  const oiPos = stock.oiChange > 0;

                  return (
                    <tr key={stock.token || stock.symbol} className="hover:bg-[#161b29] transition-colors">
                      {/* Symbol */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-white text-sm sm:text-base">{stock.symbol}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {stock.tradingsymbol} • Lot: {stock.lotSize}
                        </div>
                      </td>

                      {/* LTP */}
                      <td className="py-3.5 px-4 text-right font-bold text-gray-100">
                        ₹{Number(stock.ltp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* % Change */}
                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isPositive ? 'text-emerald-400 bg-emerald-500/10' : isNegative ? 'text-rose-400 bg-rose-500/10' : 'text-gray-300'
                        }`}>
                          {isPositive ? '+' : ''}{Number(stock.pChange).toFixed(2)}%
                        </span>
                      </td>

                      {/* Absolute OI */}
                      <td className="py-3.5 px-4 text-right text-purple-200">
                        {Number(stock.oi).toLocaleString('en-IN')}
                      </td>

                      {/* OI Change % */}
                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          oiPos ? 'text-purple-300 bg-purple-500/20' : 'text-amber-300 bg-amber-500/20'
                        }`}>
                          {oiPos ? '+' : ''}{Number(stock.oiChange).toFixed(2)}%
                        </span>
                      </td>

                      {/* Quadrant Badge */}
                      <td className="py-3.5 px-4 text-center font-sans">
                        {getQuadrantBadge(stock.quadrant)}
                      </td>

                      {/* Confidence Score Badge */}
                      <td className="py-3.5 px-4 text-center font-sans">
                        <ConfidenceBadge
                          score={stock.confidenceScore}
                          grade={stock.confidenceGrade}
                          data={stock.confidenceData}
                        />
                      </td>

                      {/* Meaning */}
                      <td className="py-3.5 px-4 text-center text-xs font-sans text-gray-300">
                        {stock.confidenceData?.quadrantMeaning || '-'}
                      </td>

                      {/* Action: Open Chart */}
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
        <QuadrantSettingsModal
          currentSettings={settings.quadrant || {}}
          onClose={() => setShowSettingsModal(false)}
          onSave={(newSettings) => {
            onSaveSettings({ quadrant: newSettings });
            setShowSettingsModal(false);
            fetchQuadrantData();
          }}
        />
      )}
    </div>
  );
}

function QuadrantSettingsModal({ currentSettings, onClose, onSave }) {
  const [minPriceChangePct, setMinPriceChangePct] = useState(currentSettings.minPriceChangePct ?? 0.5);
  const [minOiChangePct, setMinOiChangePct] = useState(currentSettings.minOiChangePct ?? 3.0);

  const handleReset = () => {
    setMinPriceChangePct(0.5);
    setMinOiChangePct(3.0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121622] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 text-left">
        <h3 className="text-lg font-bold text-white mb-2">⚙ F&O Quadrant Settings</h3>
        <p className="text-xs text-gray-400 mb-5">
          Adjust the minimum threshold required for a stock to qualify for Long/Short Buildup.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-300 font-semibold block mb-1">
              Minimum Price Change % (Default: 0.5%)
            </label>
            <input
              type="number"
              step="0.1"
              value={minPriceChangePct}
              onChange={(e) => setMinPriceChangePct(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0a0d14] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-300 font-semibold block mb-1">
              Minimum Open Interest (OI) Change % (Default: 3.0%)
            </label>
            <input
              type="number"
              step="0.5"
              value={minOiChangePct}
              onChange={(e) => setMinOiChangePct(parseFloat(e.target.value) || 0)}
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
              onClick={() => onSave({ minPriceChangePct, minOiChangePct })}
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
