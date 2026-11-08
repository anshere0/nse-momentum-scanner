import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Activity, SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Search, Download, 
  RefreshCw, Play, Pause, AlertCircle, Clock, CheckCircle2, TrendingUp, TrendingDown,
  Layers, HelpCircle, Eye, ChevronRight, Filter, Zap, BarChart2, ShieldCheck, X
} from 'lucide-react';
import BreakoutChartModal from './BreakoutChartModal';

const API_BASE = import.meta.env.VITE_API_URL || '';

const TIMEFRAMES = [
  { value: '1m', label: '1 Min' },
  { value: '3m', label: '3 Min' },
  { value: '5m', label: '5 Min' },
  { value: '10m', label: '10 Min' },
  { value: '15m', label: '15 Min' },
  { value: '30m', label: '30 Min' },
  { value: '45m', label: '45 Min' },
  { value: '1h', label: '1 Hour' },
  { value: '2h', label: '2 Hours' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
  { value: '1M', label: '1 Month' },
];

const LOOKBACK_UNITS = [
  { value: 'MINUTES', label: 'Minutes' },
  { value: 'HOURS', label: 'Hours' },
  { value: 'DAYS', label: 'Days' },
  { value: 'WEEKS', label: 'Weeks' },
  { value: 'MONTHS', label: 'Months' },
];

export default function BreakoutScreener() {
  const [data, setData] = useState({
    stats: {
      totalScanned: 0,
      liveBreakouts: 0,
      liveBreakdowns: 0,
      confirmedBreakouts: 0,
      confirmedBreakdowns: 0,
      totalSignals: 0,
      lastScanTime: null,
      isScanning: false,
      connectionStatus: 'CONNECTED'
    },
    config: {
      lookbackValue: 20,
      lookbackUnit: 'DAYS',
      timeframe: '15m',
      minVolumeMultiplier: 2.0,
      volumeMode: 'TIME_ADJUSTED',
      signalType: 'BOTH',
      signalDisplay: 'BOTH',
      marketUniverse: 'BOTH',
      indexVolumeSource: 'FUTURES',
      enabled: true
    },
    signals: []
  });

  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'LIVE_BREAKOUTS' | 'LIVE_BREAKDOWNS' | 'CONFIRMED_BREAKOUTS' | 'CONFIRMED_BREAKDOWNS'
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'STOCK' | 'INDEX'
  const [sortField, setSortField] = useState('volumeRatio');
  const [sortDir, setSortDir] = useState('desc');
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [selectedSignalForChart, setSelectedSignalForChart] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Editable form state for config
  const [formConfig, setFormConfig] = useState({ ...data.config });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState(null);

  // Fetch signals from API
  const fetchSignals = async (tab = activeTab, isManual = false) => {
    if (isPaused && !isManual) return;
    if (isManual) setIsRefreshing(true);

    try {
      const res = await fetch(`${API_BASE}/api/breakout/signals?tab=${tab}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      if (!showConfigDrawer && json.config) {
        setFormConfig(json.config);
      }
    } catch (err) {
      console.error('Failed to fetch breakout signals:', err);
    } finally {
      if (isManual) setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchSignals(activeTab, true);
    const interval = setInterval(() => {
      fetchSignals(activeTab, false);
    }, 4000); // Poll every 4 seconds for real-time reactivity

    return () => clearInterval(interval);
  }, [activeTab, isPaused]);

  // Handle configuration update
  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setIsSavingConfig(true);
    setConfigSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/breakout/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formConfig)
      });
      const resJson = await res.json();
      if (resJson.success) {
        setConfigSuccessMsg('Settings updated! Recalculating signals in background...');
        setTimeout(() => {
          setConfigSuccessMsg(null);
          setShowConfigDrawer(false);
        }, 1200);
        fetchSignals(activeTab, true);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleResetConfig = async () => {
    const defaults = {
      lookbackValue: 20,
      lookbackUnit: 'DAYS',
      timeframe: '15m',
      minVolumeMultiplier: 2.0,
      volumeMode: 'TIME_ADJUSTED',
      signalType: 'BOTH',
      signalDisplay: 'BOTH',
      marketUniverse: 'BOTH',
      indexVolumeSource: 'FUTURES',
      enabled: true
    };
    setFormConfig(defaults);
    try {
      await fetch(`${API_BASE}/api/breakout/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaults)
      });
      fetchSignals(activeTab, true);
    } catch (err) {}
  };

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Filtered and sorted signals
  const displaySignals = useMemo(() => {
    let list = data.signals || [];

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => 
        (s.symbol && s.symbol.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.tradingsymbol && s.tradingsymbol.toLowerCase().includes(q))
      );
    }

    // Type filter
    if (typeFilter === 'STOCK') {
      list = list.filter(s => s.instrumentType === 'STOCK');
    } else if (typeFilter === 'INDEX') {
      list = list.filter(s => s.instrumentType === 'INDEX');
    }

    // Sort
    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      aVal = aVal === null || aVal === undefined ? -Infinity : aVal;
      bVal = bVal === null || bVal === undefined ? -Infinity : bVal;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return list;
  }, [data.signals, search, typeFilter, sortField, sortDir]);

  // CSV Export
  const exportCSV = () => {
    if (!displaySignals || displaySignals.length === 0) return;

    const headers = [
      'Symbol', 'Name', 'Type', 'Exchange', 'Signal', 'Status', 'LTP', 'Level',
      'Distance %', 'Candle Volume', 'Avg Volume', 'Volume Multiplier', 'Min Required',
      'Volume Mode', 'Price Change %', 'Timeframe', 'Detected At'
    ];

    const rows = displaySignals.map(s => [
      s.symbol,
      `"${s.name || s.symbol}"`,
      s.instrumentType,
      s.exchange || 'NSE',
      s.signalType,
      s.signalStatus,
      s.livePrice,
      s.signalType === 'BULLISH_BREAKOUT' ? s.breakoutLevel : s.supportLevel,
      s.distancePct,
      s.currentVolume,
      s.avgVolume,
      s.volumeRatio,
      s.minMultiplierRequired,
      s.volumeMode,
      s.priceChangePct,
      s.timeframe,
      new Date(s.detectedAt).toISOString()
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `volume_breakout_signals_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = data.stats || {};
  const currentConfig = data.config || {};

  return (
    <div className="flex flex-col gap-5 w-full">

      {/* Top Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Scanned */}
        <div className="glass-panel p-4 rounded-xl border border-[#2a2e39] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Scanned</span>
            <Layers size={14} className="text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">
            {stats.totalScanned || 0}
          </div>
          <span className="text-[10px] text-gray-500 font-mono mt-1 truncate">
            {currentConfig.marketUniverse === 'BOTH' ? 'F&O Stocks + Indices' : currentConfig.marketUniverse}
          </span>
        </div>

        {/* Live Breakouts */}
        <div className="glass-panel p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/10 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
            <span>Live Breakouts</span>
            <TrendingUp size={14} className="text-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">
            {stats.liveBreakouts || 0}
          </div>
          <span className="text-[10px] text-emerald-500/80 font-mono mt-1">
            Forming candle &gt; Resistance
          </span>
        </div>

        {/* Confirmed Breakouts */}
        <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span>Confirmed B/O</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">
            {stats.confirmedBreakouts || 0}
          </div>
          <span className="text-[10px] text-gray-500 font-mono mt-1">
            Candle closed with volume
          </span>
        </div>

        {/* Live Breakdowns */}
        <div className="glass-panel p-4 rounded-xl border border-rose-500/30 bg-rose-950/10 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-rose-400 font-semibold">
            <span>Live Breakdowns</span>
            <TrendingDown size={14} className="text-rose-400 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-400 font-mono">
            {stats.liveBreakdowns || 0}
          </div>
          <span className="text-[10px] text-rose-500/80 font-mono mt-1">
            Forming candle &lt; Support
          </span>
        </div>

        {/* Confirmed Breakdowns */}
        <div className="glass-panel p-4 rounded-xl border border-rose-500/20 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span>Confirmed B/D</span>
            <CheckCircle2 size={14} className="text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">
            {stats.confirmedBreakdowns || 0}
          </div>
          <span className="text-[10px] text-gray-500 font-mono mt-1">
            Candle closed below support
          </span>
        </div>

        {/* Engine Status & Controls */}
        <div className="glass-panel p-4 rounded-xl border border-[#2a2e39] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Engine Feed</span>
            <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`}></span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setIsPaused(p => !p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border transition ${
                isPaused 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
              }`}
            >
              {isPaused ? <Play size={12} /> : <Pause size={12} />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              onClick={() => fetchSignals(activeTab, true)}
              className="p-1.5 rounded-lg bg-[#1e2330] text-gray-400 hover:text-white border border-gray-700 transition"
              title="Refresh scan"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <span className="text-[10px] text-gray-500 font-mono mt-1 truncate">
            {stats.lastScanTime ? new Date(stats.lastScanTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) + ' IST' : 'Waiting...'}
          </span>
        </div>
      </div>

      {/* Control Bar: Tabs, Search, Config Button */}
      <div className="glass-panel p-4 rounded-2xl border border-[#2a2e39] flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 shadow-xl">
        {/* Signal Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#0a0d14] p-1 rounded-xl border border-[#2a2e39]">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'ALL' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            All Signals ({stats.totalSignals || 0})
          </button>
          <button
            onClick={() => setActiveTab('LIVE_BREAKOUTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
              activeTab === 'LIVE_BREAKOUTS' ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-emerald-300'
            }`}
          >
            <TrendingUp size={13} />
            <span>Live B/O ({stats.liveBreakouts || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('CONFIRMED_BREAKOUTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
              activeTab === 'CONFIRMED_BREAKOUTS' ? 'bg-emerald-700 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Confirmed B/O ({stats.confirmedBreakouts || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('LIVE_BREAKDOWNS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
              activeTab === 'LIVE_BREAKDOWNS' ? 'bg-rose-600 text-white shadow' : 'text-gray-400 hover:text-rose-300'
            }`}
          >
            <TrendingDown size={13} />
            <span>Live B/D ({stats.liveBreakdowns || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('CONFIRMED_BREAKDOWNS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
              activeTab === 'CONFIRMED_BREAKDOWNS' ? 'bg-rose-700 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Confirmed B/D ({stats.confirmedBreakdowns || 0})</span>
          </button>
        </div>

        {/* Right Action Tools: Search, Type Filter, Config Button, Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter symbol or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0a0d14] border border-[#2a2e39] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#0a0d14] border border-[#2a2e39] rounded-xl text-xs text-gray-300 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">All Instruments</option>
            <option value="STOCK">Stocks Only</option>
            <option value="INDEX">Indices Only</option>
          </select>

          {/* CSV Export */}
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 bg-[#131722] hover:bg-gray-800 border border-[#2a2e39] rounded-xl text-xs text-gray-300 hover:text-white flex items-center gap-1.5 transition"
            title="Export CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowConfigDrawer(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition"
          >
            <SlidersHorizontal size={14} />
            <span>Configure Scanner</span>
          </button>
        </div>
      </div>

      {/* Main Results Table Card */}
      <div className="glass-panel rounded-2xl border border-[#2a2e39] overflow-hidden shadow-2xl flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#131722] border-b border-[#2a2e39] text-gray-400 font-mono select-none">
                <th onClick={() => handleSort('symbol')} className="p-3.5 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Instrument</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="p-3.5">Signal</th>
                <th onClick={() => handleSort('livePrice')} className="p-3.5 cursor-pointer hover:text-white text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span>LTP (₹)</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="p-3.5 text-right">Breakout Level</th>
                <th onClick={() => handleSort('distancePct')} className="p-3.5 cursor-pointer hover:text-white text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span>Distance %</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th onClick={() => handleSort('volumeRatio')} className="p-3.5 cursor-pointer hover:text-white text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span>Vol Multiplier</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="p-3.5 text-right hidden md:table-cell">Current / Avg Vol</th>
                <th onClick={() => handleSort('priceChangePct')} className="p-3.5 cursor-pointer hover:text-white text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span>Chg %</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="p-3.5 hidden lg:table-cell">Timeframe</th>
                <th onClick={() => handleSort('detectedAt')} className="p-3.5 cursor-pointer hover:text-white hidden xl:table-cell">
                  <div className="flex items-center gap-1">
                    <span>Signal Time</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="p-3.5 text-center">Chart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]">
              {displaySignals.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-gray-500 font-mono">
                    <AlertCircle size={28} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-sm font-semibold text-gray-400">No matching breakout/breakdown signals detected</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Current filter: {activeTab.replace(/_/g, ' ')} • Volume Multiplier &ge; {currentConfig.minVolumeMultiplier}x
                    </p>
                  </td>
                </tr>
              ) : (
                displaySignals.map((s) => {
                  const isBull = s.signalType === 'BULLISH_BREAKOUT';
                  const isLive = s.signalStatus === 'LIVE';
                  const isInv = s.signalStatus === 'INVALIDATED';

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedSignalForChart(s)}
                      className="hover:bg-[#1a202c]/50 cursor-pointer transition group"
                    >
                      {/* Instrument */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${
                            isBull ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {isBull ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          </div>
                          <div>
                            <div className="font-bold text-white tracking-wide group-hover:text-purple-400 transition">
                              {s.symbol}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate max-w-[140px]">
                              {s.name || s.tradingsymbol}
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            s.instrumentType === 'INDEX' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-gray-800 text-gray-400'
                          }`}>
                            {s.instrumentType}
                          </span>
                        </div>
                      </td>

                      {/* Signal Badge */}
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isInv
                            ? 'bg-gray-800 text-gray-400 border border-gray-700'
                            : isBull
                              ? (isLive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse' : 'bg-emerald-600 text-white')
                              : (isLive ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-rose-600 text-white')
                        }`}>
                          {isInv ? 'INVALIDATED' : isLive ? `LIVE ${isBull ? 'BREAKOUT' : 'BREAKDOWN'}` : `CONFIRMED ${isBull ? 'B/O' : 'B/D'}`}
                        </span>
                      </td>

                      {/* Live Price */}
                      <td className="p-3.5 text-right font-mono font-bold text-white text-sm">
                        ₹{s.livePrice?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Breakout / Breakdown Level */}
                      <td className="p-3.5 text-right font-mono">
                        <span className={`font-semibold ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{(isBull ? s.breakoutLevel : s.supportLevel)?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-[10px] text-gray-500">
                          {isBull ? 'Resistance' : 'Support'}
                        </div>
                      </td>

                      {/* Distance % */}
                      <td className="p-3.5 text-right font-mono">
                        <span className={`font-bold ${s.distancePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {s.distancePct >= 0 ? '+' : ''}{s.distancePct?.toFixed(2)}%
                        </span>
                      </td>

                      {/* Volume Multiplier */}
                      <td className="p-3.5 text-right font-mono">
                        <span className="text-purple-400 font-extrabold text-sm">
                          {s.volumeRatio}x
                        </span>
                        <div className="text-[10px] text-gray-500">
                          Req: &ge;{s.minMultiplierRequired}x
                        </div>
                      </td>

                      {/* Current / Avg Volume */}
                      <td className="p-3.5 text-right font-mono text-gray-300 hidden md:table-cell">
                        <div>{s.currentVolume?.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-gray-500">Avg: {s.effectiveAvgVol?.toLocaleString('en-IN')}</div>
                      </td>

                      {/* Price Change % */}
                      <td className="p-3.5 text-right font-mono font-bold">
                        <span className={s.priceChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {s.priceChangePct >= 0 ? '+' : ''}{s.priceChangePct}%
                        </span>
                      </td>

                      {/* Timeframe */}
                      <td className="p-3.5 font-mono text-gray-400 hidden lg:table-cell">
                        <span className="px-2 py-0.5 rounded bg-[#0a0d14] border border-[#2a2e39] text-[11px] text-purple-300">
                          {s.timeframe}
                        </span>
                      </td>

                      {/* Signal Time */}
                      <td className="p-3.5 font-mono text-gray-400 text-[11px] hidden xl:table-cell">
                        {new Date(s.detectedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                      </td>

                      {/* Chart Action */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSignalForChart(s);
                          }}
                          className="p-1.5 rounded-lg bg-[#1e2330] hover:bg-purple-600 hover:text-white text-gray-400 transition"
                          title="Open Interactive Chart"
                        >
                          <BarChart2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#131722] border-t border-[#2a2e39] flex flex-wrap items-center justify-between text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-2">
            <span>Showing {displaySignals.length} signals</span>
            <span>•</span>
            <span>Volume calculation: <strong className="text-gray-200">{currentConfig.volumeMode === 'TIME_ADJUSTED' ? 'Time-Adjusted Relative Volume' : 'Standard Relative Volume'}</strong></span>
          </div>
          <div>
            <span>Click any instrument to view interactive TradingView chart</span>
          </div>
        </div>
      </div>

      {/* Configuration Drawer / Modal */}
      {showConfigDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#11141f] border border-[#2a2e39] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-5 border-b border-[#2a2e39] flex items-center justify-between bg-[#131722]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Screener Configuration</h3>
                  <p className="text-xs text-gray-400">Modify lookback, timeframe, volume multiplier & calculation mode</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigDrawer(false)}
                className="p-2 rounded-xl bg-[#1e2330] text-gray-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveConfig} className="p-6 overflow-y-auto flex flex-col gap-5 text-xs">
              
              {configSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{configSuccessMsg}</span>
                </div>
              )}

              {/* 1. Historical Lookback Duration */}
              <div className="flex flex-col gap-2">
                <label className="font-bold text-gray-200 flex items-center gap-1.5 text-sm">
                  <span>1. Historical Lookback Duration</span>
                  <div className="group relative cursor-pointer">
                    <HelpCircle size={13} className="text-gray-400" />
                    <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-64 p-2 bg-gray-900 border border-gray-700 rounded-lg text-[11px] text-gray-300 shadow-xl z-30">
                      Duration of completed historical candles used to calculate historical resistance (highest high) and support (lowest low).
                    </div>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-gray-400 text-[11px] block mb-1">Numeric Value:</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={formConfig.lookbackValue}
                      onChange={(e) => setFormConfig({ ...formConfig, lookbackValue: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 bg-[#0a0d14] border border-[#2a2e39] rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px] block mb-1">Duration Unit:</span>
                    <select
                      value={formConfig.lookbackUnit}
                      onChange={(e) => setFormConfig({ ...formConfig, lookbackUnit: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0a0d14] border border-[#2a2e39] rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                    >
                      {LOOKBACK_UNITS.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <span className="text-[11px] text-gray-500 font-mono">
                  Current Lookback Window: Previous {formConfig.lookbackValue} {formConfig.lookbackUnit.toLowerCase()} of completed market data.
                </span>
              </div>

              {/* 2. Candle Timeframe */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#2a2e39]">
                <label className="font-bold text-gray-200 flex items-center gap-1.5 text-sm">
                  <span>2. Candle Timeframe (Independent of Lookback)</span>
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {TIMEFRAMES.map(tf => (
                    <button
                      type="button"
                      key={tf.value}
                      onClick={() => setFormConfig({ ...formConfig, timeframe: tf.value })}
                      className={`py-2 px-2 text-center rounded-xl text-xs font-mono font-bold border transition ${
                        formConfig.timeframe === tf.value
                          ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/30'
                          : 'bg-[#0a0d14] text-gray-400 border-[#2a2e39] hover:text-white'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Minimum Volume Multiplier */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#2a2e39]">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-200 flex items-center gap-1.5 text-sm">
                    <span>3. Minimum Volume Multiplier</span>
                    <div className="group relative cursor-pointer">
                      <HelpCircle size={13} className="text-gray-400" />
                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-72 p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-[11px] text-gray-300 shadow-xl z-30">
                        Minimum volume multiplier determines how many times higher the current candle's volume must be compared with the historical average. Increase it to find stronger volume activity and decrease it to find more opportunities.
                      </div>
                    </div>
                  </label>
                  <span className="text-purple-400 font-mono font-black text-base">
                    {formConfig.minVolumeMultiplier}x
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.1"
                    value={formConfig.minVolumeMultiplier}
                    onChange={(e) => setFormConfig({ ...formConfig, minVolumeMultiplier: parseFloat(e.target.value) })}
                    className="flex-1 accent-purple-500 cursor-pointer"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="50.0"
                    value={formConfig.minVolumeMultiplier}
                    onChange={(e) => setFormConfig({ ...formConfig, minVolumeMultiplier: parseFloat(e.target.value) || 1.0 })}
                    className="w-20 px-2.5 py-1.5 bg-[#0a0d14] border border-[#2a2e39] rounded-xl text-white font-mono text-xs text-center"
                  />
                </div>
              </div>

              {/* 4. Volume Calculation Mode */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#2a2e39]">
                <label className="font-bold text-gray-200 text-sm">
                  <span>4. Volume Calculation Mode</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setFormConfig({ ...formConfig, volumeMode: 'TIME_ADJUSTED' })}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      formConfig.volumeMode === 'TIME_ADJUSTED'
                        ? 'bg-purple-950/20 border-purple-500 text-white'
                        : 'bg-[#0a0d14] border-[#2a2e39] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Time-Adjusted Relative Volume</span>
                      {formConfig.volumeMode === 'TIME_ADJUSTED' && <CheckCircle2 size={14} className="text-purple-400" />}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Compares still-forming candle's accumulated volume against historical volume at the equivalent elapsed point. Recommended for live trading.
                    </p>
                  </div>

                  <div
                    onClick={() => setFormConfig({ ...formConfig, volumeMode: 'STANDARD' })}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      formConfig.volumeMode === 'STANDARD'
                        ? 'bg-purple-950/20 border-purple-500 text-white'
                        : 'bg-[#0a0d14] border-[#2a2e39] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Standard Relative Volume</span>
                      {formConfig.volumeMode === 'STANDARD' && <CheckCircle2 size={14} className="text-purple-400" />}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Compares current candle volume directly against total average volume of full completed historical candles.
                    </p>
                  </div>
                </div>
              </div>

              {/* 5. Market Universe & Index Handling */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#2a2e39]">
                <div>
                  <label className="font-bold text-gray-200 text-sm block mb-1.5">
                    5. Market Universe
                  </label>
                  <select
                    value={formConfig.marketUniverse}
                    onChange={(e) => setFormConfig({ ...formConfig, marketUniverse: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0d14] border border-[#2a2e39] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="BOTH">F&O Stocks + Indices (Recommended)</option>
                    <option value="STOCKS">All F&O Stocks Only</option>
                    <option value="INDICES">All Supported F&O Indices Only</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-200 text-sm block mb-1.5">
                    6. Index Volume Source
                  </label>
                  <select
                    value={formConfig.indexVolumeSource}
                    onChange={(e) => setFormConfig({ ...formConfig, indexVolumeSource: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0d14] border border-[#2a2e39] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="FUTURES">Active Index Futures Volume Feed</option>
                    <option value="PRICE_ONLY">Price-Only (Volume Check Disabled)</option>
                  </select>
                </div>
              </div>

              {/* 7. Signal Type & Display Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#2a2e39]">
                <div>
                  <label className="font-bold text-gray-200 text-sm block mb-1.5">
                    7. Signal Type
                  </label>
                  <select
                    value={formConfig.signalType}
                    onChange={(e) => setFormConfig({ ...formConfig, signalType: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0d14] border border-[#2a2e39] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="BOTH">Breakout & Breakdown Simultaneously</option>
                    <option value="BREAKOUT">Bullish Breakout Only</option>
                    <option value="BREAKDOWN">Bearish Breakdown Only</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-200 text-sm block mb-1.5">
                    8. Signal Display Mode
                  </label>
                  <select
                    value={formConfig.signalDisplay}
                    onChange={(e) => setFormConfig({ ...formConfig, signalDisplay: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0d14] border border-[#2a2e39] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="BOTH">Both Live & Confirmed Signals</option>
                    <option value="LIVE">Live Provisional Signals Only</option>
                    <option value="CONFIRMED">Confirmed Candle-Close Signals Only</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-[#2a2e39] flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetConfig}
                  className="px-4 py-2 bg-[#1e2330] hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition"
                >
                  Reset Defaults
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigDrawer(false)}
                    className="px-4 py-2 bg-transparent text-gray-400 hover:text-white rounded-xl text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/30 transition disabled:opacity-50"
                  >
                    {isSavingConfig ? 'Recalculating...' : 'Apply & Scan Now'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Stock Details & Chart Modal */}
      {selectedSignalForChart && (
        <BreakoutChartModal
          signal={selectedSignalForChart}
          onClose={() => setSelectedSignalForChart(null)}
        />
      )}

    </div>
  );
}

