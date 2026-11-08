import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Activity, ArrowUpRight, ArrowDownRight, 
  HelpCircle, Sliders, RefreshCw, Search, CheckCircle2, 
  AlertTriangle, Filter, BarChart2, Info, ChevronRight 
} from 'lucide-react';
import ChartModal from './ChartModal';

export default function DerivativesCard({ onOpenChart }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters & State
  const [pcrFilter, setPcrFilter] = useState('ALL');
  const [wallAlertOnly, setWallAlertOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('pcr');
  const [sortDir, setSortDir] = useState('desc');

  // Educational Box Toggle
  const [showGuide, setShowGuide] = useState(true);

  // Settings Modal
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    pcrOverbought: 1.35,
    pcrOversold: 0.65
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Quick Chart Modal state
  const [selectedChartStock, setSelectedChartStock] = useState(null);

  // Load Settings
  useEffect(() => {
    fetch('/api/pro/settings')
      .then(res => res.json())
      .then(s => {
        if (s.derivatives) {
          setSettings({
            pcrOverbought: s.derivatives.pcrOverbought || 1.35,
            pcrOversold: s.derivatives.pcrOversold || 0.65
          });
        }
      })
      .catch(err => console.error('Failed to load settings:', err));
  }, []);

  // Fetch Derivatives Data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        pcrFilter,
        wallAlertOnly: wallAlertOnly ? 'true' : 'false',
        search,
        sortField,
        sortDir
      });
      const res = await fetch(`/api/pro/derivatives?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch derivatives edge:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pcrFilter, wallAlertOnly, search, sortField, sortDir]);

  // Save Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/pro/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          derivatives: {
            pcrOverbought: Number(settings.pcrOverbought),
            pcrOversold: Number(settings.pcrOversold)
          }
        })
      });
      if (res.ok) {
        setShowSettings(false);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const counts = data?.counts || {
    total: 0,
    overbought: 0,
    oversold: 0,
    balanced: 0,
    nearCallWall: 0,
    nearPutWall: 0,
    wallAlerts: 0
  };

  const vix = data?.vix || { value: 14.2, regime: 'NORMAL', text: 'Normal Volatility', description: 'Standard market conditions.' };
  const marketPcr = data?.marketPcr || { pcr: 1.0, statusText: 'Balanced' };
  const stocks = data?.stocks || [];

  return (
    <div className="space-y-6">
      {/* Top Banner: India VIX Regime & Aggregate PCR Meter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* India VIX Regime Card */}
        <div className="bg-[#0b1222] border border-gray-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">India VIX Volatility Regime</h3>
                <span className="text-xs text-gray-400">Market-Wide Volatility Gauge</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-white tracking-tight">
                {vix.value.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border ${vix.badgeClass}`}>
              <span className="w-2 h-2 rounded-full bg-current"></span>
              {vix.text}
            </span>
            <p className="text-xs text-gray-400 mt-2.5 leading-relaxed">
              {vix.description}
            </p>
          </div>
        </div>

        {/* Market-Wide PCR Sentiment Meter */}
        <div className="bg-[#0b1222] border border-gray-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">F&O Market Aggregate PCR</h3>
                <span className="text-xs text-gray-400">Total Put OI ÷ Total Call OI</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-white tracking-tight">
                {marketPcr.pcr.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border ${marketPcr.badgeClass}`}>
              {marketPcr.statusText}
            </span>
            <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
              <span>🟢 Oversold (&lt;0.65)</span>
              <span>⚖️ Balanced (0.65 - 1.35)</span>
              <span>🔴 Overbought (&gt;1.35)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Global Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => { setPcrFilter('ALL'); setWallAlertOnly(false); }}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            pcrFilter === 'ALL' && !wallAlertOnly
              ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
              : 'bg-[#0a0f1d] border-gray-800/80 hover:border-gray-700 text-gray-400'
          }`}
        >
          <div className="text-xs font-medium">Total F&O Universe</div>
          <div className="text-xl font-bold text-white mt-1">{counts.total}</div>
        </div>

        <div 
          onClick={() => { setPcrFilter('OVERBOUGHT'); setWallAlertOnly(false); }}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            pcrFilter === 'OVERBOUGHT' 
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              : 'bg-[#0a0f1d] border-gray-800/80 hover:border-gray-700 text-gray-400'
          }`}
        >
          <div className="text-xs font-medium">Overbought (&gt;1.35)</div>
          <div className="text-xl font-bold text-rose-400 mt-1">{counts.overbought}</div>
        </div>

        <div 
          onClick={() => { setPcrFilter('OVERSOLD'); setWallAlertOnly(false); }}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            pcrFilter === 'OVERSOLD'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-[#0a0f1d] border-gray-800/80 hover:border-gray-700 text-gray-400'
          }`}
        >
          <div className="text-xs font-medium">Oversold (&lt;0.65)</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{counts.oversold}</div>
        </div>

        <div 
          onClick={() => { setPcrFilter('BALANCED'); setWallAlertOnly(false); }}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            pcrFilter === 'BALANCED'
              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : 'bg-[#0a0f1d] border-gray-800/80 hover:border-gray-700 text-gray-400'
          }`}
        >
          <div className="text-xs font-medium">Balanced PCR</div>
          <div className="text-xl font-bold text-blue-400 mt-1">{counts.balanced}</div>
        </div>

        <div 
          onClick={() => { setWallAlertOnly(true); }}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            wallAlertOnly
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-[#0a0f1d] border-gray-800/80 hover:border-gray-700 text-gray-400'
          }`}
        >
          <div className="text-xs font-medium">Near Call Wall (≤1%)</div>
          <div className="text-xl font-bold text-amber-400 mt-1">{counts.nearCallWall}</div>
        </div>

        <div 
          onClick={() => { setWallAlertOnly(true); }}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            wallAlertOnly
              ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
              : 'bg-[#0a0f1d] border-gray-800/80 hover:border-gray-700 text-gray-400'
          }`}
        >
          <div className="text-xs font-medium">Near Put Wall (≤1%)</div>
          <div className="text-xl font-bold text-teal-400 mt-1">{counts.nearPutWall}</div>
        </div>
      </div>

      {/* Search, Filter Toolbar & Settings */}
      <div className="bg-[#0b1222] border border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search symbol..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Wall Proximity Filter Checkbox */}
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer bg-gray-900/80 border border-gray-700 px-3 py-1.5 rounded-lg select-none">
            <input
              type="checkbox"
              checked={wallAlertOnly}
              onChange={e => setWallAlertOnly(e.target.checked)}
              className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
            />
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Wall Proximity Alerts Only
            </span>
          </label>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Settings Modal Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white flex items-center gap-1.5 transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>PCR Settings</span>
          </button>

          {/* Guide Toggle */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 transition ${
              showGuide
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Guide</span>
          </button>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Prominent Educational Guide Box (Plain English Explanation) */}
      {showGuide && (
        <div className="p-5 bg-[#090e1a] border border-blue-900/40 rounded-xl text-xs text-gray-300 shadow-xl">
          <div className="flex items-center gap-2 mb-3 text-blue-400 font-semibold text-sm">
            <Info className="w-4 h-4" />
            <span>📘 What is Derivatives Edge & How To Trade With It (Plain English)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/60 border border-gray-800/80 rounded-lg p-3">
              <h5 className="font-semibold text-blue-300 mb-1">1. Put-Call Ratio (PCR)</h5>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                Compares the total number of Put options traded versus Call options.
                <br />• <strong>PCR &lt; 0.65 (Oversold):</strong> Extreme pessimism. Often signals a contrarian bullish bounce.
                <br />• <strong>PCR &gt; 1.35 (Overbought):</strong> Extreme optimism. Market is vulnerable to a sharp pullback.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800/80 rounded-lg p-3">
              <h5 className="font-semibold text-rose-300 mb-1">2. Call Wall (Resistance)</h5>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                The exact strike price with the <strong>largest Call Open Interest</strong>. Institutional option sellers have written massive call positions here and will aggressively defend this level from being crossed.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800/80 rounded-lg p-3">
              <h5 className="font-semibold text-emerald-300 mb-1">3. Put Wall (Support)</h5>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                The exact strike price with the <strong>largest Put Open Interest</strong>. Serves as a major institutional floor where option writers absorb sell pressure.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800/80 rounded-lg p-3">
              <h5 className="font-semibold text-purple-300 mb-1">4. Max Pain Strike</h5>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                The strike price where option buyers collectively suffer the greatest financial loss at expiry. Stock prices have a strong mathematical pull towards Max Pain into settlement.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Stock Table */}
      <div className="bg-[#0b1222] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0d1629] text-gray-400 uppercase font-semibold text-[11px]">
                <th className="py-3 px-4">Symbol / Stock</th>
                <th 
                  onClick={() => handleSort('ltp')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition"
                >
                  LTP / % Change
                </th>
                <th 
                  onClick={() => handleSort('pcr')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition"
                >
                  PCR Ratio
                </th>
                <th 
                  onClick={() => handleSort('distToCallWall')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition"
                >
                  Call Wall (Resistance)
                </th>
                <th 
                  onClick={() => handleSort('distToPutWall')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition"
                >
                  Put Wall (Support)
                </th>
                <th className="py-3 px-3">Max Pain</th>
                <th className="py-3 px-3">Wall Warning Alert</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-800/60">
              {stocks.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-gray-500">
                    {loading ? 'Evaluating options derivatives chain...' : 'No stocks matched your active filters.'}
                  </td>
                </tr>
              ) : (
                stocks.map(stock => {
                  const d = stock.derivativesData || {};
                  const isBull = stock.pChange >= 0;

                  return (
                    <tr key={stock.symbol} className="hover:bg-gray-800/30 transition">
                      {/* Symbol */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white tracking-wide">{stock.symbol}</div>
                        <div className="text-[11px] text-gray-500">{stock.name || 'F&O Contract'}</div>
                      </td>

                      {/* LTP & % Change */}
                      <td className="py-3 px-3 font-mono">
                        <div className="text-white font-medium">₹{stock.ltp?.toFixed(2)}</div>
                        <div className={`text-[11px] flex items-center gap-0.5 ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isBull ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isBull ? '+' : ''}{stock.pChange?.toFixed(2)}%
                        </div>
                      </td>

                      {/* PCR */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${d.pcrBadgeClass || 'bg-gray-800 text-gray-300'}`}>
                          {d.pcr?.toFixed(2)}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-0.5 font-medium">
                          {d.pcrStatusText}
                        </div>
                      </td>

                      {/* Call Wall Strike (Resistance) */}
                      <td className="py-3 px-3 font-mono">
                        <div className="text-rose-400 font-semibold">₹{d.callWallStrike}</div>
                        <div className="text-[10px] text-gray-400">
                          {d.distToCallWallPct >= 0 ? `+${d.distToCallWallPct}% away` : `${d.distToCallWallPct}% away`}
                        </div>
                      </td>

                      {/* Put Wall Strike (Support) */}
                      <td className="py-3 px-3 font-mono">
                        <div className="text-emerald-400 font-semibold">₹{d.putWallStrike}</div>
                        <div className="text-[10px] text-gray-400">
                          {d.distToPutWallPct >= 0 ? `-${d.distToPutWallPct}% away` : `${d.distToPutWallPct}% away`}
                        </div>
                      </td>

                      {/* Max Pain */}
                      <td className="py-3 px-3 font-mono">
                        <span className="text-gray-300 font-medium">₹{d.maxPainStrike}</span>
                      </td>

                      {/* Wall Alert */}
                      <td className="py-3 px-3">
                        {d.wallWarning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            {d.wallWarning}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">Safe Range</span>
                        )}
                      </td>

                      {/* Actions: Quick Chart */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            if (onOpenChart) {
                              onOpenChart(stock.symbol);
                            } else {
                              setSelectedChartStock(stock.symbol);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 hover:text-white font-medium text-xs flex items-center gap-1.5 ml-auto transition"
                          title={`Open ${stock.symbol} Candlestick Chart`}
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

      {/* Internal Chart Modal fallback */}
      {selectedChartStock && (
        <ChartModal
          isOpen={Boolean(selectedChartStock)}
          symbol={selectedChartStock}
          onClose={() => setSelectedChartStock(null)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0b1222] border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              Configure PCR Thresholds
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Set custom sensitivity thresholds for Put-Call Ratio classification.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Overbought Threshold (Default: 1.35)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={settings.pcrOverbought}
                  onChange={e => setSettings({ ...settings, pcrOverbought: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Oversold Threshold (Default: 0.65)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={settings.pcrOversold}
                  onChange={e => setSettings({ ...settings, pcrOversold: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Thresholds'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
