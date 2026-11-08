import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, RefreshCw, RotateCcw, Compass, ArrowUpDown, TrendingUp, BarChart2 } from 'lucide-react';
import InfoBox from '../common/InfoBox';
import ConfidenceBadge from '../common/ConfidenceBadge';

export default function SectorCard({ settings = {}, onSaveSettings, onOpenChart }) {
  const [stocks, setStocks] = useState([]);
  const [sectorsSummary, setSectorsSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [onlyAligned, setOnlyAligned] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('rsScore');
  const [sortDir, setSortDir] = useState('desc');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const fetchSectorData = async () => {
    try {
      const params = new URLSearchParams({
        sectorFilter: selectedSector,
        onlyAligned: String(onlyAligned),
        search,
        sortField,
        sortDir
      });
      const res = await fetch(`/api/pro/sector?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStocks(data.stocks || []);
        setSectorsSummary(data.sectorsSummary || []);
      }
    } catch (err) {
      console.error('Failed to fetch sector data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSectorData();
  }, [selectedSector, onlyAligned, search, sortField, sortDir]);

  useEffect(() => {
    const t = setInterval(fetchSectorData, 12000);
    return () => clearInterval(t);
  }, [selectedSector, onlyAligned, search, sortField, sortDir]);

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
        title="Sector Tailwind & Relative Strength (RS Score vs Nifty 50)"
        what="Institutions trade sectors in baskets. If an entire sector has capital inflow (tailwind), individual stock breakouts inside that sector have dramatically higher hit-rates. RS Score reveals which stocks are outperforming the broader Nifty 50 benchmark."
        calculation="RS Score = Stock % Change - Nifty 50 % Change | Alignment = Stock Direction matches Parent Sector Direction"
        example="If Nifty Auto surges +2.1%, buying Tata Motors on a breakout has massive institutional tailwind. If Nifty IT is tumbling -1.5%, taking a long trade in TCS is high-risk because the entire sector tide is dragging it down."
        defaultOpen={true}
      />

      {/* Sector Performance Horizontal Cards */}
      <div className="glass-card rounded-xl p-4 border border-gray-800">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span>Parent Sector Indices Performance</span>
          <span className="text-[11px] text-gray-500 font-mono">Click a sector to filter stocks</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedSector('ALL')}
            className={`px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer border ${
              selectedSector === 'ALL'
                ? 'bg-blue-600 text-white border-blue-400'
                : 'bg-[#0a0d14] text-gray-300 border-gray-800 hover:border-gray-700'
            }`}
          >
            All Sectors ({sectorsSummary.reduce((acc, s) => acc + s.stockCount, 0)})
          </button>
          {sectorsSummary.map(sec => {
            const isPos = sec.change > 0;
            const isNeg = sec.change < 0;
            return (
              <button
                key={sec.name}
                onClick={() => setSelectedSector(sec.name)}
                className={`px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer border flex items-center gap-2 ${
                  selectedSector === sec.name
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-[#0a0d14] text-gray-300 border-gray-800 hover:border-gray-700'
                }`}
              >
                <span>{sec.name.replace('NIFTY ', '')}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  isPos ? 'bg-emerald-500/20 text-emerald-300' : isNeg ? 'bg-rose-500/20 text-rose-300' : 'bg-gray-800 text-gray-400'
                }`}>
                  {isPos ? '+' : ''}{sec.change.toFixed(1)}%
                </span>
              </button>
            );
          })}
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
            placeholder="Search F&O stock..."
            className="w-full pl-10 pr-3 py-2 bg-[#0a0d14] border border-gray-700 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0d14] border border-gray-750 text-xs text-gray-300 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={onlyAligned}
              onChange={(e) => setOnlyAligned(e.target.checked)}
              className="rounded text-blue-600 w-4 h-4 cursor-pointer"
            />
            <span>🟢 Only Show Aligned With Sector</span>
          </label>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold cursor-pointer border border-gray-700"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
            <span>⚙ Settings</span>
          </button>
        </div>
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
                <th className="py-3.5 px-4">
                  Parent Sector
                </th>
                <th className="py-3.5 px-4 text-right">
                  Sector % Chg
                </th>
                <th onClick={() => handleSort('ltp')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white select-none">
                  Price (LTP)
                </th>
                <th onClick={() => handleSort('pChange')} className="py-3.5 px-4 text-right cursor-pointer hover:text-white select-none">
                  Stock % Chg
                </th>
                <th className="py-3.5 px-4 text-center">
                  Sector Alignment
                </th>
                <th onClick={() => handleSort('rsScore')} className="py-3.5 px-4 text-center cursor-pointer hover:text-white select-none bg-blue-950/20">
                  RS Score vs Nifty 50
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
                    Correlating sector tides and Relative Strength scores...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-gray-400">
                    No stocks matching the selected sector criteria.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const sec = stock.sectorData || {};
                  const isStockPos = stock.pChange > 0;
                  const isSecPos = sec.sectorChange > 0;

                  return (
                    <tr key={stock.token || stock.symbol} className="hover:bg-[#161b29] transition-colors">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-white text-sm sm:text-base">{stock.symbol}</div>
                        <div className="text-[11px] text-gray-500 font-mono">Lot: {stock.lotSize}</div>
                      </td>

                      <td className="py-3.5 px-4 font-sans font-semibold text-gray-300">
                        {sec.parentSector || 'OTHER'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isSecPos ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                        }`}>
                          {isSecPos ? '+' : ''}{Number(sec.sectorChange).toFixed(2)}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-gray-100">
                        ₹{Number(stock.ltp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isStockPos ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                        }`}>
                          {isStockPos ? '+' : ''}{Number(stock.pChange).toFixed(2)}%
                        </span>
                      </td>

                      {/* Alignment Badge */}
                      <td className="py-3.5 px-4 text-center font-sans">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${sec.alignmentBadge || 'bg-gray-800 text-gray-300'}`}>
                          {sec.alignmentText || 'Neutral'}
                        </span>
                      </td>

                      {/* RS Score vs Nifty 50 */}
                      <td className="py-3.5 px-4 text-center font-sans bg-blue-950/10">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${sec.rsBadgeClass || 'bg-gray-800 text-gray-300'}`}>
                          {sec.rsText || 'Neutral'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-sans">
                        <ConfidenceBadge
                          score={stock.sectorConfidence?.score ?? stock.confidenceScore}
                          grade={stock.sectorConfidence?.grade ?? stock.confidenceGrade}
                          data={stock.sectorConfidence ?? stock.confidenceData}
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
        <SectorSettingsModal
          currentSettings={settings.sector || {}}
          onClose={() => setShowSettingsModal(false)}
          onSave={(newSettings) => {
            onSaveSettings({ sector: newSettings });
            setShowSettingsModal(false);
            fetchSectorData();
          }}
        />
      )}
    </div>
  );
}

function SectorSettingsModal({ currentSettings, onClose, onSave }) {
  const [rsThreshold, setRsThreshold] = useState(currentSettings.rsThreshold ?? 0.75);

  const handleReset = () => {
    setRsThreshold(0.75);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121622] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 text-left">
        <h3 className="text-lg font-bold text-white mb-2">⚙ Sector & Relative Strength Settings</h3>
        <p className="text-xs text-gray-400 mb-5">
          Define the RS Score threshold (+% difference vs Nifty 50) to classify stocks as RS Leaders.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-300 font-semibold block mb-1">
              RS Leader Threshold % (Default: 0.75%)
            </label>
            <input
              type="number"
              step="0.25"
              value={rsThreshold}
              onChange={(e) => setRsThreshold(parseFloat(e.target.value) || 0)}
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
              onClick={() => onSave({ rsThreshold })}
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
