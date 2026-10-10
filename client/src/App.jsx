import { useState, useEffect } from 'react';
import { Settings, SlidersHorizontal, Activity, Link2Off, Link2 } from 'lucide-react';
import IndicesBarChart from './components/IndicesBarChart';
import MomentumBoard from './components/MomentumBoard';
import FilterSettings from './components/FilterSettings';

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [data, setData] = useState({ gainers: [], losers: [], indices: [] });
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // SSE connection
    const evtSource = new EventSource(`${API_URL}/sse/live`);

    evtSource.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        setData(parsedData);
        setLastUpdate(parsedData.timestamp || Date.now());
        setConnected(true);
      } catch (err) {
        console.error('Failed to parse SSE data', err);
      }
    };

    evtSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      setConnected(false);
    };

    return () => {
      evtSource.close();
    };
  }, []);

  const handleAdminLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/login-url`);
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, '_blank');
      } else {
        alert('Configuration missing in .env');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-dark)] text-gray-200 p-4 md:p-6 lg:p-8 flex flex-col items-center relative">
      <div className="w-full max-w-[1500px]">
        {/* Header */}
        <header className="glass-panel flex flex-col md:flex-row justify-between items-center p-6 rounded-2xl mb-8 relative overflow-hidden">
          {/* Subtle background glow in header */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-green/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="z-10 mb-4 md:mb-0">
            <h1 className="text-3xl font-extrabold flex items-center gap-3 text-white tracking-tight">
              <Activity className="text-brand-green animate-pulse" size={32} />
              F&O Momentum Scanner
            </h1>
            <div className="flex items-center gap-4 text-sm mt-2 text-gray-400 font-mono">
              <span className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-gray-800">
                {connected ? (
                  <><div className="w-2 h-2 rounded-full bg-brand-green shadow-[0_0_8px_#00e676] animate-pulse"></div> <span className="text-brand-green">Live Feed</span></>
                ) : (
                  <><Link2Off size={14} className="text-brand-red" /> <span className="text-brand-red">Disconnected</span></>
                )}
              </span>
              <span className="bg-black/40 px-3 py-1 rounded-full border border-gray-800">
                Last Update: {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 z-10">
            <button 
              onClick={() => setShowSettings(true)}
              className="px-4 py-2.5 bg-gray-800/80 hover:bg-gray-700/80 text-white rounded-xl transition-all flex items-center gap-2 text-sm font-bold border border-gray-600 shadow-md hover:shadow-lg backdrop-blur-sm"
              title="Edit Filters"
            >
              <SlidersHorizontal size={18} className="text-purple-400" />
              Settings
            </button>
            <button 
              onClick={handleAdminLogin}
              className="px-4 py-2.5 bg-brand-green/10 hover:bg-brand-green/20 text-brand-green rounded-xl transition-all flex items-center gap-2 text-sm font-bold border border-brand-green/30 shadow-[0_0_15px_rgba(0,230,118,0.1)] hover:shadow-[0_0_20px_rgba(0,230,118,0.2)] backdrop-blur-sm"
              title="Connect Upstox Broker"
            >
              <Link2 size={18} />
              Connect Broker
            </button>
          </div>
        </header>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Gainers & Losers (Occupies 3 columns) */}
        <div className="xl:col-span-3 flex flex-col gap-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full">
            <MomentumBoard title="Top Gainers" data={data.gainers} type="bullish" />
            <MomentumBoard title="Top Losers" data={data.losers} type="bearish" />
          </div>
        </div>

        {/* Sector Indices (Occupies 1 column) */}
        <div className="xl:col-span-1 glass-panel rounded-xl p-5 flex flex-col h-full relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <h2 className="text-xl font-bold tracking-wide mb-6 pb-4 border-b border-brand-border flex items-center gap-2 text-white">
            Sector Momentum
          </h2>
          <div className="flex-1 overflow-auto">
            <IndicesBarChart indices={data.indices || []} />
          </div>
        </div>
        
      </div>

      {showSettings && <FilterSettings onClose={() => setShowSettings(false)} />}
      </div>
    </div>
  );
}

export default App;
