import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, ChevronLeft, ChevronRight, 
  SlidersHorizontal, X, RotateCcw, Info, Check, Filter, Layers, Zap, Building2, HelpCircle, TrendingUp
} from 'lucide-react';

const API_BASE = '';

const DEFAULT_FILTERS = {
  priceChangeEnabled: false,
  minPriceChange: 0.5,
  maxPriceChange: 20.0,
  ltpFilterEnabled: false,
  minLtp: 10,
  maxLtp: 50000,
  volumeFilterEnabled: false,
  minVolume: 50000,
  pdhFilterEnabled: false,
  pdlFilterEnabled: false,
  oiFilterEnabled: false,
  minOiChangePct: 5.0,
  maxOiChangePct: 500.0,
  oiPositiveOnly: false,
  oiNegativeOnly: false,
};

export default function SimpleTable() {
  // Segment: Strictly separated at all times
  const [segment, setSegment] = useState('CASH'); // 'CASH' or 'FNO'
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState('ALL'); // 'ALL' | 'GAINERS' | 'LOSERS' | 'PDH_BO' | 'PDL_BD' | 'OI_BUILDUP' | 'OI_UNWINDING'
  const [sortField, setSortField] = useState('pChange');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Editable filter options (Default: ALL OFF / NO FILTERS)
  const [filterConfig, setFilterConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('pro_suite_filter_config');
      return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [summary, setSummary] = useState({ total: 0, advancing: 0, declining: 0, unchanged: 0 });

  // Count how many custom filters are currently active
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterConfig.priceChangeEnabled) count++;
    if (filterConfig.ltpFilterEnabled) count++;
    if (filterConfig.volumeFilterEnabled) count++;
    if (filterConfig.pdhFilterEnabled) count++;
    if (filterConfig.pdlFilterEnabled) count++;
    if (segment === 'FNO' && filterConfig.oiFilterEnabled) count++;
    return count;
  }, [filterConfig, segment]);

  // Fetch stocks from backend
  const fetchStocks = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const params = new URLSearchParams({
        segment,
        search,
        filter: quickFilter,
        sortField,
        sortDir,
        page: String(page),
        limit: String(pageSize),
        priceChangeEnabled: String(filterConfig.priceChangeEnabled),
        minPriceChange: String(filterConfig.minPriceChange),
        maxPriceChange: String(filterConfig.maxPriceChange),
        ltpFilterEnabled: String(filterConfig.ltpFilterEnabled),
        minLtp: String(filterConfig.minLtp),
        maxLtp: String(filterConfig.maxLtp),
        volumeFilterEnabled: String(filterConfig.volumeFilterEnabled),
        minVolume: String(filterConfig.minVolume),
        pdhFilterEnabled: String(filterConfig.pdhFilterEnabled),
        pdlFilterEnabled: String(filterConfig.pdlFilterEnabled),
        oiFilterEnabled: String(filterConfig.oiFilterEnabled),
        minOiChangePct: String(filterConfig.minOiChangePct),
        maxOiChangePct: String(filterConfig.maxOiChangePct),
        oiPositiveOnly: String(filterConfig.oiPositiveOnly),
        oiNegativeOnly: String(filterConfig.oiNegativeOnly),
      });

      const res = await fetch(`${API_BASE}/api/simple/stocks?${params.toString()}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setStocks(data.stocks || []);
      setTotal(data.total || 0);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('Could not refresh prices. Reconnecting...');
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  // Fetch summary breadth
  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/simple/summary?segment=${segment}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStocks();
    fetchSummary();
  }, [segment, search, quickFilter, sortField, sortDir, page, pageSize, filterConfig]);

  // Periodic refresh every 15s
  useEffect(() => {
    const timer = setInterval(() => {
      fetchStocks();
      fetchSummary();
    }, 15000);
    return () => clearInterval(timer);
  }, [segment, search, quickFilter, sortField, sortDir, page, pageSize, filterConfig]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilterConfig(DEFAULT_FILTERS);
    localStorage.setItem('pro_suite_filter_config', JSON.stringify(DEFAULT_FILTERS));
    setQuickFilter('ALL');
    setSearch('');
    setPage(1);
  };

  const handleSaveFilters = (updated) => {
    setFilterConfig(updated);
    localStorage.setItem('pro_suite_filter_config', JSON.stringify(updated));
    setShowFilterModal(false);
    setPage(1);
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0.00';
    return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatVolume = (val) => {
    if (!val) return '0';
    if (val >= 10000000) return (val / 10000000).toFixed(2) + ' Cr';
    if (val >= 100000) return (val / 100000).toFixed(2) + ' L';
    return Number(val).toLocaleString('en-IN');
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 inline ml-1 opacity-50" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-400 inline ml-1 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-400 inline ml-1 font-bold" />
    );
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* Top Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>NSE Market Screener</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Feed
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Real-time scanner with Previous Day High/Low Breakouts, Open Interest dynamics, and customizable filters.
          </p>
        </div>

        {/* Right side controls: Last update, Breakout link & Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-gray-400 self-start md:self-auto">
          <a
            href={typeof window !== 'undefined' ? `http://${window.location.hostname}:3000/#breakout` : 'http://localhost:3000/#breakout'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-lg shadow-purple-600/30"
            title="Open Live Volume Breakout & Breakdown Screener on Port 3000"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Volume Breakout (:3000)</span>
          </a>
          {lastUpdated && (
            <span>
              Updated: <strong className="text-gray-200">{lastUpdated.toLocaleTimeString('en-IN')}</strong>
            </span>
          )}
          <button
            onClick={() => fetchStocks(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium transition cursor-pointer"
            title="Refresh prices now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Segment Selector: STRICTLY SEPARATE CASH & F&O */}
      <div className="glass-card rounded-xl p-3 sm:p-4 mb-5 flex flex-col sm:flex-row items-center justify-between gap-3 border border-gray-800">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider mr-2 hidden sm:inline">
            Market Segment:
          </span>
          <button
            onClick={() => { setSegment('CASH'); setPage(1); }}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-sm sm:text-base font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              segment === 'CASH'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400'
                : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700 border border-transparent'
            }`}
          >
            <Building2 className="w-4 h-4 text-blue-300" />
            <span>Cash Market (NSE EQ)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/30 font-mono">2,703</span>
          </button>

          <button
            onClick={() => { setSegment('FNO'); setPage(1); }}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-sm sm:text-base font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              segment === 'FNO'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400'
                : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700 border border-transparent'
            }`}
          >
            <Zap className="w-4 h-4 text-purple-300" />
            <span>F&O Derivatives</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/30 font-mono">213</span>
          </button>
        </div>

        {/* Breadth Quick Stats for Current Segment */}
        <div className="flex items-center gap-4 text-xs sm:text-sm font-mono">
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            ▲ {summary.advancing || 0} Advancing
          </span>
          <span className="text-rose-400 font-semibold flex items-center gap-1">
            ▼ {summary.declining || 0} Declining
          </span>
          <span className="text-gray-400 hidden sm:inline">
            ● {summary.unchanged || 0} Unchanged
          </span>
        </div>
      </div>

      {/* Control Bar: Search + Quick Pills + Filter Settings Button */}
      <div className="glass-card rounded-xl p-4 sm:p-5 mb-5 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between border border-gray-800">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={`Search ${segment === 'CASH' ? 'cash stock (e.g. Reliance, SBI)...' : 'F&O symbol (e.g. NIFTY, TCS)...'}`}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0e121b] border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition font-sans"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-3 top-2.5 text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Signal Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'GAINERS', label: '▲ Gainers' },
            { id: 'LOSERS', label: '▼ Losers' },
            { id: 'PDH_BO', label: 'PDH Breakout' },
            { id: 'PDL_BD', label: 'PDL Breakdown' },
            ...(segment === 'FNO' ? [
              { id: 'HIGH_OI', label: 'High OI (±5%)' },
              { id: 'OI_BUILDUP', label: 'OI Buildup' },
              { id: 'OI_UNWINDING', label: 'OI Unwinding' },
            ] : [])
          ].map(p => (
            <button
              key={p.id}
              onClick={() => { setQuickFilter(p.id); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                quickFilter === p.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-gray-800/90 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Settings Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterModal(true)}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-2 cursor-pointer ${
              activeFilterCount > 0
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/60'
                : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>⚙️ Filter Settings</span>
            {activeFilterCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                {activeFilterCount}
              </span>
            ) : (
              <span className="text-gray-400 text-xs">(No Filters)</span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={handleResetFilters}
              title="Reset all filters to default (No Filters)"
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="glass-card rounded-xl overflow-hidden shadow-2xl border border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#121622] border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                <th
                  onClick={() => handleSort('symbol')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition select-none"
                >
                  {segment === 'CASH' ? 'Company / Symbol' : 'Contract / Underlying'} {renderSortIcon('symbol')}
                </th>

                <th
                  onClick={() => handleSort('ltp')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition select-none"
                >
                  Price (LTP) {renderSortIcon('ltp')}
                </th>

                <th
                  onClick={() => handleSort('change')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition select-none"
                >
                  Change (₹) {renderSortIcon('change')}
                </th>

                <th
                  onClick={() => handleSort('pChange')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition select-none"
                >
                  % Change {renderSortIcon('pChange')}
                </th>

                <th
                  onClick={() => handleSort('high')}
                  className="py-3.5 px-3 text-right cursor-pointer hover:text-white transition select-none hidden sm:table-cell"
                >
                  Day High {renderSortIcon('high')}
                </th>

                <th
                  onClick={() => handleSort('low')}
                  className="py-3.5 px-3 text-right cursor-pointer hover:text-white transition select-none hidden sm:table-cell"
                >
                  Day Low {renderSortIcon('low')}
                </th>

                <th
                  onClick={() => handleSort('pdh')}
                  className="py-3.5 px-3 text-right cursor-pointer hover:text-white transition select-none hidden md:table-cell"
                  title="Previous Day High"
                >
                  PDH {renderSortIcon('pdh')}
                </th>

                <th
                  onClick={() => handleSort('pdl')}
                  className="py-3.5 px-3 text-right cursor-pointer hover:text-white transition select-none hidden md:table-cell"
                  title="Previous Day Low"
                >
                  PDL {renderSortIcon('pdl')}
                </th>

                {/* F&O SPECIFIC COLUMNS: OPEN INTEREST */}
                {segment === 'FNO' && (
                  <>
                    <th
                      onClick={() => handleSort('oi')}
                      className="py-3.5 px-4 text-right cursor-pointer hover:text-purple-300 transition select-none bg-purple-950/20"
                      title="Open Interest: Total active contracts"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>OI (Contracts)</span>
                        {renderSortIcon('oi')}
                      </div>
                      <div className="text-[10px] text-purple-400/80 lowercase font-normal">total open contracts</div>
                    </th>

                    <th
                      onClick={() => handleSort('oiChange')}
                      className="py-3.5 px-4 text-right cursor-pointer hover:text-purple-300 transition select-none bg-purple-950/20"
                      title="Percentage change in Open Interest compared to yesterday's closing OI"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>OI Change %</span>
                        {renderSortIcon('oiChange')}
                      </div>
                      <div className="text-[10px] text-purple-400/80 lowercase font-normal">vs prev day close</div>
                    </th>
                  </>
                )}

                <th
                  onClick={() => handleSort('volume')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition select-none hidden lg:table-cell"
                >
                  Volume {renderSortIcon('volume')}
                </th>

                <th className="py-3.5 px-4 text-center">
                  Signals
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-800/60 font-mono text-sm">
              {loading ? (
                <tr>
                  <td colSpan={segment === 'FNO' ? 12 : 10} className="py-20 text-center text-gray-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading {segment === 'CASH' ? 'Cash Equity' : 'F&O Derivatives'} stock data...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={segment === 'FNO' ? 12 : 10} className="py-20 text-center text-gray-400">
                    No stocks matching the current filters.
                    <div className="mt-3">
                      <button
                        onClick={handleResetFilters}
                        className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        Reset to No Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const isPositive = stock.pChange > 0;
                  const isNegative = stock.pChange < 0;
                  const textColor = isPositive
                    ? 'text-emerald-400 font-semibold'
                    : isNegative
                    ? 'text-rose-400 font-semibold'
                    : 'text-gray-300';
                  const sign = isPositive ? '+' : '';

                  const isPdhBreakout = stock.pdh && stock.ltp >= stock.pdh;
                  const isPdlBreakdown = stock.pdl && stock.ltp <= stock.pdl;

                  const oiChg = stock.oiChange;
                  const oiPositive = oiChg > 0;
                  const oiNegative = oiChg < 0;

                  return (
                    <tr
                      key={stock.token || stock.tradingsymbol || stock.symbol}
                      className="hover:bg-[#161b29] transition-colors"
                    >
                      {/* Symbol & Name */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-white text-base flex items-center gap-2">
                          <span>{stock.symbol}</span>
                          {stock.isFno && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              F&O
                            </span>
                          )}
                        </div>
                        {stock.name && stock.name !== stock.symbol && (
                          <div className="text-xs text-gray-400 truncate max-w-[200px]">
                            {stock.name}
                          </div>
                        )}
                        {stock.tradingsymbol && stock.isFno && (
                          <div className="text-[11px] text-gray-500 font-mono">
                            {stock.tradingsymbol} {stock.lotSize ? `(Lot: ${stock.lotSize})` : ''}
                          </div>
                        )}
                      </td>

                      {/* LTP */}
                      <td className="py-3.5 px-4 text-right text-gray-100 font-bold text-base">
                        {formatCurrency(stock.ltp)}
                      </td>

                      {/* Change (₹) */}
                      <td className={`py-3.5 px-4 text-right ${textColor}`}>
                        {sign}{stock.change !== undefined && stock.change !== null ? Number(stock.change).toFixed(2) : '0.00'}
                      </td>

                      {/* % Change */}
                      <td className={`py-3.5 px-4 text-right ${textColor}`}>
                        <span className={`inline-block px-2 py-0.5 rounded text-sm font-bold ${
                          isPositive ? 'bg-emerald-500/10' : isNegative ? 'bg-rose-500/10' : 'bg-gray-800'
                        }`}>
                          {sign}{stock.pChange !== undefined && stock.pChange !== null ? Number(stock.pChange).toFixed(2) : '0.00'}%
                        </span>
                      </td>

                      {/* Day High */}
                      <td className="py-3.5 px-3 text-right text-gray-300 hidden sm:table-cell">
                        {formatCurrency(stock.high)}
                      </td>

                      {/* Day Low */}
                      <td className="py-3.5 px-3 text-right text-gray-300 hidden sm:table-cell">
                        {formatCurrency(stock.low)}
                      </td>

                      {/* PDH */}
                      <td className={`py-3.5 px-3 text-right hidden md:table-cell ${isPdhBreakout ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>
                        {stock.pdh ? formatCurrency(stock.pdh) : '-'}
                      </td>

                      {/* PDL */}
                      <td className={`py-3.5 px-3 text-right hidden md:table-cell ${isPdlBreakdown ? 'text-rose-400 font-bold' : 'text-gray-400'}`}>
                        {stock.pdl ? formatCurrency(stock.pdl) : '-'}
                      </td>

                      {/* F&O: OPEN INTEREST */}
                      {segment === 'FNO' && (
                        <>
                          {/* Absolute OI */}
                          <td className="py-3.5 px-4 text-right text-purple-200 bg-purple-950/10 font-mono">
                            {stock.oi ? Number(stock.oi).toLocaleString('en-IN') : '-'}
                          </td>

                          {/* OI Change % */}
                          <td className="py-3.5 px-4 text-right bg-purple-950/10">
                            {oiChg !== null && oiChg !== undefined ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                oiPositive
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                  : oiNegative
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'text-gray-400'
                              }`}>
                                {oiPositive ? '+' : ''}{Number(oiChg).toFixed(2)}%
                              </span>
                            ) : '-'}
                          </td>
                        </>
                      )}

                      {/* Volume */}
                      <td className="py-3.5 px-4 text-right text-gray-400 hidden lg:table-cell font-sans text-xs">
                        {formatVolume(stock.volume)}
                      </td>

                      {/* Signals Badges */}
                      <td className="py-3.5 px-4 text-center font-sans">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {isPdhBreakout && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              PDH B/O
                            </span>
                          )}
                          {isPdlBreakdown && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              PDL B/D
                            </span>
                          )}
                          {oiChg >= 5 && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              OI Buildup
                            </span>
                          )}
                          {oiChg <= -5 && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              OI Unwinding
                            </span>
                          )}
                          {!isPdhBreakout && !isPdlBreakdown && (!oiChg || Math.abs(oiChg) < 5) && (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-[#121622] border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <span>
              Showing {stocks.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, total)} of {total.toLocaleString('en-IN')} stocks in {segment === 'CASH' ? 'Cash Market' : 'F&O Market'}
            </span>
            <span className="mx-2">•</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs cursor-pointer"
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-gray-200 text-xs sm:text-sm flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="px-3 py-1 font-semibold text-gray-200">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-gray-200 text-xs sm:text-sm flex items-center gap-1 cursor-pointer"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* EDITABLE FILTER SETTINGS MODAL */}
      {showFilterModal && (
        <FilterSettingsModal
          config={filterConfig}
          segment={segment}
          onClose={() => setShowFilterModal(false)}
          onSave={handleSaveFilters}
          onReset={handleResetFilters}
        />
      )}

      {/* Footer Notice with Explanation */}
      <footer className="mt-8 text-center text-xs text-gray-500 border-t border-gray-900 pt-5 space-y-2">
        <p>
          <strong className="text-gray-400">Open Interest (OI) Note:</strong> OI represents the total number of outstanding derivative contracts. It applies exclusively to the <strong>F&O Market</strong>. Cash market equities do not have OI.
        </p>
        <p>
          Educational tool. Stock prices and OI update automatically during market hours (09:15 AM - 03:30 PM IST).
        </p>
      </footer>
    </div>
  );
}

/**
 * EDITABLE FILTER SETTINGS MODAL
 * Exactly mirrors the comprehensive filter settings from the momentum scanner
 */
function FilterSettingsModal({ config, segment, onClose, onSave, onReset }) {
  const [form, setForm] = useState({ ...config });

  const handleChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121622] border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-[#121622] z-10">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-blue-400" />
              <span>Editable Scanner Filter Settings</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Customize technical breakout thresholds and volume limits. Defaults are disabled ("No Filters").
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-sm text-gray-300">
          {/* Section 1: Price Change % */}
          <div className="p-4 bg-[#0a0d14] rounded-xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-white flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.priceChangeEnabled}
                  onChange={(e) => handleChange('priceChangeEnabled', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>Price Change % Filter</span>
              </label>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${form.priceChangeEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                {form.priceChangeEnabled ? 'Active' : 'Disabled (Default)'}
              </span>
            </div>

            {form.priceChangeEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-850">
                <div>
                  <label className="text-xs text-gray-400">Min % Change</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.minPriceChange}
                    onChange={(e) => handleChange('minPriceChange', parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 bg-[#121622] border border-gray-700 rounded px-3 py-1.5 text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Max % Change</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.maxPriceChange}
                    onChange={(e) => handleChange('maxPriceChange', parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 bg-[#121622] border border-gray-700 rounded px-3 py-1.5 text-white font-mono text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Technical Breakouts (PDH / PDL) */}
          <div className="p-4 bg-[#0a0d14] rounded-xl border border-gray-800 space-y-3">
            <h3 className="font-semibold text-white">Technical Price Level Breakouts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#121622] border border-gray-800 cursor-pointer hover:border-gray-700">
                <input
                  type="checkbox"
                  checked={form.pdhFilterEnabled}
                  onChange={(e) => handleChange('pdhFilterEnabled', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-white text-xs">PDH Breakout Only</div>
                  <div className="text-[11px] text-gray-400">Price ≥ Previous Day High</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#121622] border border-gray-800 cursor-pointer hover:border-gray-700">
                <input
                  type="checkbox"
                  checked={form.pdlFilterEnabled}
                  onChange={(e) => handleChange('pdlFilterEnabled', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-white text-xs">PDL Breakdown Only</div>
                  <div className="text-[11px] text-gray-400">Price ≤ Previous Day Low</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Open Interest Filter (F&O segment) */}
          <div className="p-4 bg-[#0a0d14] rounded-xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-semibold text-white flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.oiFilterEnabled}
                    onChange={(e) => handleChange('oiFilterEnabled', e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span>Open Interest (OI) Change Filter</span>
                </label>
                <div className="text-[11px] text-gray-400 ml-6">
                  Applies to F&O market contracts only.
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${form.oiFilterEnabled ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-500'}`}>
                {form.oiFilterEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            {form.oiFilterEnabled && (
              <div className="space-y-3 pt-2 border-t border-gray-850">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400">Min OI Change %</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form.minOiChangePct}
                      onChange={(e) => handleChange('minOiChangePct', parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 bg-[#121622] border border-gray-700 rounded px-3 py-1.5 text-white font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Max OI Change %</label>
                    <input
                      type="number"
                      step="1"
                      value={form.maxOiChangePct}
                      onChange={(e) => handleChange('maxOiChangePct', parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 bg-[#121622] border border-gray-700 rounded px-3 py-1.5 text-white font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.oiPositiveOnly}
                      onChange={(e) => {
                        handleChange('oiPositiveOnly', e.target.checked);
                        if (e.target.checked) handleChange('oiNegativeOnly', false);
                      }}
                      className="rounded text-purple-600 w-3.5 h-3.5"
                    />
                    <span>Positive OI Only (Buildup)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.oiNegativeOnly}
                      onChange={(e) => {
                        handleChange('oiNegativeOnly', e.target.checked);
                        if (e.target.checked) handleChange('oiPositiveOnly', false);
                      }}
                      className="rounded text-purple-600 w-3.5 h-3.5"
                    />
                    <span>Negative OI Only (Unwinding)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Volume & Price Thresholds */}
          <div className="p-4 bg-[#0a0d14] rounded-xl border border-gray-800 space-y-3">
            <h3 className="font-semibold text-white">Price & Volume Limits</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-xs text-gray-300 font-semibold mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.volumeFilterEnabled}
                    onChange={(e) => handleChange('volumeFilterEnabled', e.target.checked)}
                    className="rounded text-blue-600 w-3.5 h-3.5"
                  />
                  <span>Min Volume Threshold</span>
                </label>
                <input
                  type="number"
                  disabled={!form.volumeFilterEnabled}
                  value={form.minVolume}
                  onChange={(e) => handleChange('minVolume', parseInt(e.target.value) || 0)}
                  placeholder="e.g. 50000"
                  className="w-full bg-[#121622] border border-gray-700 disabled:opacity-40 rounded px-3 py-1.5 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs text-gray-300 font-semibold mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ltpFilterEnabled}
                    onChange={(e) => handleChange('ltpFilterEnabled', e.target.checked)}
                    className="rounded text-blue-600 w-3.5 h-3.5"
                  />
                  <span>Price (LTP) Range</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled={!form.ltpFilterEnabled}
                    value={form.minLtp}
                    onChange={(e) => handleChange('minLtp', parseFloat(e.target.value) || 0)}
                    placeholder="Min ₹"
                    className="w-1/2 bg-[#121622] border border-gray-700 disabled:opacity-40 rounded px-2 py-1.5 text-white font-mono text-sm"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    disabled={!form.ltpFilterEnabled}
                    value={form.maxLtp}
                    onChange={(e) => handleChange('maxLtp', parseFloat(e.target.value) || 0)}
                    placeholder="Max ₹"
                    className="w-1/2 bg-[#121622] border border-gray-700 disabled:opacity-40 rounded px-2 py-1.5 text-white font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#0a0d14] border-t border-gray-800 flex items-center justify-between sticky bottom-0 z-10">
          <button
            onClick={() => {
              onReset();
              setForm(DEFAULT_FILTERS);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-gray-400 hover:text-white text-xs font-semibold rounded hover:bg-gray-800 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to No Filters (Default)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(form)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
