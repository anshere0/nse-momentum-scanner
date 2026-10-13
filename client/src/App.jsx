import React, { useState, useEffect } from 'react';
import { 
  Activity, SlidersHorizontal, Shield, Play, Square, RefreshCw, 
  TableProperties, LayoutDashboard, AlertCircle, Clock, Calendar, CheckCircle, Wifi, WifiOff
} from 'lucide-react';
import IndicesBarChart from './components/IndicesBarChart';
import MomentumBoard from './components/MomentumBoard';
import FilterSettings from './components/FilterSettings';
import ConnectBrokerModal from './components/ConnectBrokerModal';
import MarketOverview from './components/MarketOverview';
import ScannerTable from './components/ScannerTable';

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [data, setData] = useState({
    gainers: [],
    losers: [],
    indices: [],
    allScanned: [],
    breadth: { advancing: 0, declining: 0, unchanged: 0, evaluated: 0, advDeclineRatio: 0, netBreadthPct: 0 },
    sentiment: { label: 'INSUFFICIENT_DATA', rule: '', netBreadthPct: 0 },
    status: {
      connection: 'CONNECTING',
      dataMode: 'UNAVAILABLE',
      sessionDate: null,
      sessionDateDisplay: null,
      lastUpdated: null,
      isScanning: false,
      tickCount: 0,
      market: null
    }
  });

  const [connected, setConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [activeView, setActiveView] = useState('boards'); // 'boards' or 'table'
  const [isScanning, setIsScanning] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // SSE connection
  useEffect(() => {
    let evtSource = null;
    let reconnectTimeout = null;

    const connectSSE = () => {
      if (evtSource) {
        evtSource.close();
      }

      evtSource = new EventSource(`${API_URL}/sse/live`);

      evtSource.onopen = () => {
        setConnected(true);
      };

      evtSource.onmessage = (event) => {
        try {
          if (!event.data || event.data.startsWith(':')) return;
          const parsed = JSON.parse(event.data);
          setData(parsed);
          setConnected(true);
          if (parsed.status?.isScanning !== undefined) {
            setIsScanning(parsed.status.isScanning);
          }
        } catch (err) {
          console.error('Failed to parse SSE event data', err);
        }
      };

      evtSource.onerror = () => {
        setConnected(false);
        // Only force recreate if connection is completely CLOSED
        if (evtSource.readyState === EventSource.CLOSED) {
          evtSource.close();
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, 3000);
        }
      };
    };

    connectSSE();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (evtSource) evtSource.close();
    };
  }, []);

  const handleToggleScan = async () => {
    const endpoint = isScanning ? '/api/scan/stop' : '/api/scan/start';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, { method: 'POST' });
      const resData = await res.json();
      if (res.ok) {
        setIsScanning(resData.isScanning);
      }
    } catch (err) {
      console.error('Failed to toggle scan', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_URL}/api/refresh`, { method: 'POST' });
    } catch (err) {
      console.error('Refresh error', err);
    } finally {
      setTimeout(() => setRefreshing(false), 800);
    }
  };

  const status = data.status || {};
  const sessionDisplay = status.sessionDateDisplay || status.sessionDate || 'Evaluating...';
  const dataMode = status.dataMode || 'UNAVAILABLE';

  // Format last updated time in IST
  const formatTime = (ts) => {
    if (!ts) return 'Waiting for feed...';
    try {
      return new Date(ts).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' IST';
    } catch {
      return new Date(ts).toLocaleTimeString();
    }
  };

  const getDataModePill = (mode) => {
    switch (mode) {
      case 'LIVE':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Live Market
          </span>
        );
      case 'PREVIOUS_CLOSE':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center gap-1.5">
            <Clock size={12} /> Previous Close
          </span>
        );
      case 'CACHED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1.5">
            <AlertCircle size={12} /> Cached Snapshot
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-700/40 text-gray-400 border border-gray-600/40">
            Unavailable
          </span>
        );
    }
  };

  const getConnectionPill = (conn) => {
    switch (conn) {
      case 'CONNECTED':
        return (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Wifi size={14} className="text-emerald-400" /> Angel One Connected
          </span>
        );
      case 'SESSION_EXPIRED':
        return (
          <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
            <AlertCircle size={14} className="text-amber-400" /> Session Expired
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <WifiOff size={14} className="text-rose-400" /> Disconnected
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-gray-200 p-3 md:p-6 flex flex-col items-center relative font-sans selection:bg-purple-500 selection:text-white">
      <div className="w-full max-w-[1600px] flex flex-col gap-5">
        
        {/* Top Header Card */}
        <header className="glass-panel p-5 rounded-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative overflow-hidden shadow-2xl border border-[#2a2e39]">
          {/* Subtle Glow */}
          <div className="absolute -top-20 -left-20 w-44 h-44 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Left Title and Connection Info */}
          <div className="z-10 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl shadow-lg shadow-purple-600/30">
                <Activity className="text-white animate-pulse" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  NSE Market Scanner
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Angel One SmartAPI
                  </span>
                </h1>
                <p className="text-xs text-gray-400">
                  Live F&O Momentum, PDH/PDL Breakouts, OI Dynamics & Market Breadth
                </p>
              </div>
            </div>

            {/* Prominent Status Line */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono pt-1">
              {getDataModePill(dataMode)}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131722] border border-[#2a2e39] text-gray-300">
                <Calendar size={13} className="text-purple-400" />
                <span>Session: <strong className="text-white">{sessionDisplay}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131722] border border-[#2a2e39] text-gray-300">
                <Clock size={13} className="text-emerald-400" />
                <span>Updated: <strong className="text-white">{formatTime(status.lastUpdated || data.timestamp)}</strong></span>
              </div>
              <div className="px-3 py-1 rounded-full bg-[#131722] border border-[#2a2e39]">
                {getConnectionPill(status.connection)}
              </div>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="z-10 flex flex-wrap items-center gap-2.5 self-stretch lg:self-auto justify-end">
            {/* View Switcher */}
            <div className="flex bg-[#0a0d14] p-1 rounded-xl border border-[#2a2e39]">
              <button
                onClick={() => setActiveView('boards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeView === 'boards' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
                title="View Momentum Boards & Sector Indices"
              >
                <LayoutDashboard size={14} />
                <span>Boards</span>
              </button>
              <button
                onClick={() => setActiveView('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeView === 'table' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
                title="View Full Quantitative Scanner Table"
              >
                <TableProperties size={14} />
                <span>Scanner Table</span>
              </button>
            </div>

            {/* Scan Toggle */}
            <button
              onClick={handleToggleScan}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                isScanning 
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30' 
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
              title={isScanning ? 'Stop active scanning' : 'Start scanner'}
            >
              {isScanning ? <Square size={14} /> : <Play size={14} />}
              <span>{isScanning ? 'Stop Scan' : 'Start Scan'}</span>
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 rounded-xl transition-all border border-[#2a2e39]"
              title="Refresh Quotes & Historical Levels"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
              className="px-3.5 py-2 bg-gray-800/80 hover:bg-gray-700/80 text-white rounded-xl transition-all flex items-center gap-2 text-xs font-bold border border-[#2a2e39]"
              title="Configure quantitative filters & parameters"
            >
              <SlidersHorizontal size={14} className="text-purple-400" />
              <span>Filters</span>
            </button>

            {/* Angel One Broker Button */}
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-xl transition-all flex items-center gap-2 text-xs font-bold border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
              title="Connect or re-authenticate Angel One SmartAPI"
            >
              <Shield size={14} />
              <span>Angel One</span>
            </button>
          </div>
        </header>

        {/* Market Overview Breadth Cards */}
        <MarketOverview
          breadth={data.breadth || {}}
          sentiment={data.sentiment || {}}
          status={status}
        />

        {/* Main Content Area */}
        {activeView === 'boards' ? (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Gainers & Losers Boards (3 columns) */}
            <div className="xl:col-span-3 flex flex-col gap-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                <MomentumBoard
                  title="Top Gainers"
                  data={data.gainers || []}
                  type="bullish"
                />
                <MomentumBoard
                  title="Top Losers"
                  data={data.losers || []}
                  type="bearish"
                />
              </div>
            </div>

            {/* Sector Indices (1 column) */}
            <div className="xl:col-span-1 glass-panel rounded-xl p-5 flex flex-col h-full relative overflow-hidden shadow-xl border border-[#2a2e39]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
              <h2 className="text-lg font-bold tracking-wide mb-4 pb-3 border-b border-[#2a2e39] flex items-center gap-2 text-white">
                Sector Momentum
              </h2>
              <div className="flex-1 overflow-auto">
                <IndicesBarChart indices={data.indices || []} />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[650px]">
            <ScannerTable
              data={data.allScanned || []}
              sessionDate={sessionDisplay}
              dataMode={dataMode}
            />
          </div>
        )}

      </div>

      {/* Modals */}
      {showSettings && (
        <FilterSettings
          onClose={() => setShowSettings(false)}
        />
      )}

      {showConnectModal && (
        <ConnectBrokerModal
          onClose={() => setShowConnectModal(false)}
          onConnected={() => handleRefresh()}
        />
      )}
    </div>
  );
}

export default App;
