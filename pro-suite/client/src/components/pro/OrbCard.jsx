import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, RefreshCw, RotateCcw, ArrowUpDown, BarChart2 } from 'lucide-react';
import InfoBox from '../common/InfoBox';
import ConfidenceBadge from '../common/ConfidenceBadge';

export default function OrbCard({ settings = {}, onSaveSettings, onOpenChart }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('breakoutDistance');
  const [sortDir, setSortDir] = useState('desc');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [counts, setCounts] = useState({ breakoutUp: 0, breakdownDown: 0, insideRange: 0 });

  const fetchOrbData = async () => {
    try {
      const params = new URLSearchParams({
        statusFilter: filter,
        search,
        sortField,
        sortDir
      });
      const res = await fetch(`/api/pro/orb?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStocks(data.stocks || []);
        if (data.counts) {
          setCounts({
            breakoutUp: data.counts.breakoutUp || 0,
            breakdownDown: data.counts.breakdownDown || 0,
            insideRange: data.counts.insideRange || 0
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch orb data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrbData();
  }, [filter, search, sortField, sortDir]);

  useEffect(() => {
    const t = setInterval(fetchOrbData, 12000);
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
        title="Opening Range Breakout (ORB 15-min / 30-min)"
        what="Captures the initial high and low printed during the opening price discovery period (09:15 AM - 09:30 AM IST). Breakouts beyond these boundary levels signify strong institutional opening order execution."
        calculation="Breakout Up = LTP > ORB High | Breakdown Down = LTP < ORB Low | Inside Range = ORB Low <= LTP <= ORB High"
        example="If a stock clears its 15-min high with heavy volume and trades above VWAP, it has high statistical probability of expanding trend for the rest of the morning session."
        defaultOpen={true}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => setFilter('BREAKOUT_UP')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'BREAKOUT_UP' ? 'bg-emerald-950/30 border-emerald-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-emerald-400 font-semibold uppercase">ORB Breakout Up</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.breakoutUp}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Price &gt; Opening Range High</div>
        </div>

        <div
          onClick={() => setFilter('BREAKDOWN_DOWN')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'BREAKDOWN_DOWN' ? 'bg-rose-950/30 border-rose-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-rose-400 font-semibold uppercase">ORB Breakdown Down</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.breakdownDown}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Price &lt; Opening Range Low</div>
        </div>

        <div
          onClick={() => setFilter('INSIDE_RANGE')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            filter === 'INSIDE_RANGE' ? 'bg-blue-950/30 border-blue-500' : 'glass-card border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-blue-400 font-semibold uppercase">Inside Opening Range</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{counts.insideRange}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Consolidating / Watching</div>
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
            { id: 'BREAKOUT_UP', label: '▲ Breakout Up' },
            { id: 'BREAKDOWN_DOWN', label: '▼ Breakdown Down' },
            { id: 'INSIDE_RANGE', label: 'Inside Range' }
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
                <th className="py-3.5 px-4 text-right">
                  15m ORB High
                </th>
                <th className="py-3.5 px-4 text-right">
                  15m ORB Low
                </th>
                <th className="py-3.5 px-4 text-right">
                  Range Width %
                </th>
                <th className="py-3.5 px-4 text-center">
                  Breakout Status
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
                  <td colSpan="8" className="py-16 text-center text-gray-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    Tracking Opening Range Breakouts...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-gray-400">
                    No stocks matching the selected ORB criteria.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const orb = stock.orbData || {};

                  return (
                    <tr key={stock.token || stock.symbol} className="hover:bg-[#161b29] transition-colors">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-white text-sm sm:text-base">{stock.symbol}</div>
                        <div className="text-[11px] text-gray-500 font-mono">Lot: {stock.lotSize}</div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-gray-100">
                        ₹{Number(stock.ltp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right text-emerald-400 font-bold">
                        ₹{Number(orb.orbHigh).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right text-rose-400 font-bold">
                        ₹{Number(orb.orbLow).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right text-gray-300">
                        {orb.rangeSpanPct ? `${orb.rangeSpanPct.toFixed(2)}%` : '-'}
                      </td>

                      <td className="py-3.5 px-4 text-center font-sans">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${orb.badgeClass || 'bg-gray-800 text-gray-300'}`}>
                          {orb.statusText || 'Inside Range'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-sans">
                        <ConfidenceBadge
                          score={stock.confidenceScore}
                          grade={stock.confidenceGrade}
                          data={stock.confidenceData}
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
        <OrbSettingsModal
          currentSettings={settings.orb || {}}
          onClose={() => setShowSettingsModal(false)}
          onSave={(newSettings) => {
            onSaveSettings({ orb: newSettings });
            setShowSettingsModal(false);
            fetchOrbData();
          }}
        />
      )}
    </div>
  );
}

function OrbSettingsModal({ currentSettings, onClose, onSave }) {
  const [windowMinutes, setWindowMinutes] = useState(currentSettings.windowMinutes ?? 15);
  const [requireVolume, setRequireVolume] = useState(currentSettings.requireVolumeConfirmation ?? false);

  const handleReset = () => {
    setWindowMinutes(15);
    setRequireVolume(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121622] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 text-left">
        <h3 className="text-lg font-bold text-white mb-2">⚙ Opening Range (ORB) Settings</h3>
        <p className="text-xs text-gray-400 mb-5">
          Select the opening window timeframe and volume confirmation requirements.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-300 font-semibold block mb-2">ORB Timeframe Window</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWindowMinutes(15)}
                className={`py-2 px-3 rounded-lg text-xs font-bold border cursor-pointer ${
                  windowMinutes === 15 ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-300 border-gray-700'
                }`}
              >
                15 Minutes (09:15-09:30)
              </button>
              <button
                type="button"
                onClick={() => setWindowMinutes(30)}
                className={`py-2 px-3 rounded-lg text-xs font-bold border cursor-pointer ${
                  windowMinutes === 30 ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-300 border-gray-700'
                }`}
              >
                30 Minutes (09:15-09:45)
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 p-3 rounded-lg bg-[#0a0d14] border border-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={requireVolume}
              onChange={(e) => setRequireVolume(e.target.checked)}
              className="rounded text-blue-600 w-4 h-4"
            />
            <div>
              <div className="font-bold text-white text-xs">Require Volume Surge Confirmation</div>
              <div className="text-[11px] text-gray-400">Only trigger breakout if volume &gt; 1.5x average</div>
            </div>
          </label>
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
              onClick={() => onSave({ windowMinutes, requireVolumeConfirmation: requireVolume })}
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
