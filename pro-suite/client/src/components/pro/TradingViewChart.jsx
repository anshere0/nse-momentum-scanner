import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { 
  BarChart3, RefreshCw, ZoomIn, Eye, EyeOff, Info, 
  TrendingUp, TrendingDown, Clock, ShieldAlert, Target, HelpCircle 
} from 'lucide-react';

export default function TradingViewChart({ 
  symbol = 'RELIANCE', 
  initialResolution = '5m',
  stopLoss = null,
  target1 = null,
  target2 = null,
  standalone = false
}) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [resolution, setResolution] = useState(initialResolution);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState(null);

  // Indicator Visibility Toggles
  const [showVwap, setShowVwap] = useState(true);
  const [showOrb, setShowOrb] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showHelp, setShowHelp] = useState(true);

  // Sync symbol prop if changed externally
  useEffect(() => {
    if (symbol && symbol !== currentSymbol) {
      setCurrentSymbol(symbol);
    }
  }, [symbol]);

  // Fetch candle data
  const fetchCandles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pro/candles?symbol=${encodeURIComponent(currentSymbol)}&resolution=${resolution}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.candles && data.candles.length > 0) {
        setChartData(data);
      } else {
        throw new Error('No candle data returned for symbol');
      }
    } catch (err) {
      console.error('Failed to load chart candles:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandles();
  }, [currentSymbol, resolution]);

  // Render TradingView Chart Canvas
  useEffect(() => {
    if (!chartContainerRef.current || !chartData || !chartData.candles || chartData.candles.length === 0) {
      return;
    }

    const container = chartContainerRef.current;
    
    // Clear any previous chart instance
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    // Chart Configuration
    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: standalone ? 520 : 420,
      layout: {
        background: { color: '#090d16' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' }
      },
      crosshair: {
        mode: 1 // Magnet crosshair
      },
      rightPriceScale: {
        borderColor: '#334155',
        scaleMargins: {
          top: 0.1,
          bottom: 0.25
        }
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false
      }
    });

    chartInstanceRef.current = chart;

    // 1. Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    });
    candleSeries.setData(chartData.candles);

    // 2. Volume Histogram Sub-Pane
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Overlay on same scale with separate margin
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0
        }
      });
      const volumeData = chartData.candles.map(c => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'
      }));
      volumeSeries.setData(volumeData);
    }

    // 3. Intraday VWAP Overlay Line (Blue)
    if (showVwap && chartData.vwapSeries && chartData.vwapSeries.length > 0) {
      const vwapSeries = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 2,
        title: 'Intraday VWAP',
        priceLineVisible: false
      });
      vwapSeries.setData(chartData.vwapSeries);
    }

    // 4. 15m ORB Channel Overlays (Green & Red)
    if (showOrb && chartData.orbHighSeries && chartData.orbHighSeries.length > 0) {
      const orbHighSeries = chart.addLineSeries({
        color: '#10b981',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        title: 'ORB High',
        priceLineVisible: false
      });
      orbHighSeries.setData(chartData.orbHighSeries);

      const orbLowSeries = chart.addLineSeries({
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        title: 'ORB Low',
        priceLineVisible: false
      });
      orbLowSeries.setData(chartData.orbLowSeries);
    }

    // 5. Dynamic Stop-Loss & Target Price Lines
    if (stopLoss && Number(stopLoss) > 0) {
      candleSeries.createPriceLine({
        price: Number(stopLoss),
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '🛑 SL'
      });
    }

    if (target1 && Number(target1) > 0) {
      candleSeries.createPriceLine({
        price: Number(target1),
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '🎯 TGT 1'
      });
    }

    if (target2 && Number(target2) > 0) {
      candleSeries.createPriceLine({
        price: Number(target2),
        color: '#059669',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '🚀 TGT 2'
      });
    }

    // Fit content into visible container
    chart.timeScale().fitContent();

    // Resize observer for responsive canvas
    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [chartData, showVwap, showOrb, showVolume, stopLoss, target1, target2, standalone]);

  const summary = chartData?.summary || {};
  const isBullish = (summary.pChange || 0) >= 0;

  return (
    <div className="bg-[#0b1120] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Header & Toolbar */}
      <div className="px-5 py-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-4 bg-[#0d1527]">
        {/* Symbol Info & Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-white tracking-wide">{currentSymbol}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-semibold border ${
                isBullish 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {isBullish ? '+' : ''}{(summary.pChange || 0).toFixed(2)}%
              </span>

              {/* Quick Symbol Switcher */}
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="text"
                  placeholder="Enter symbol..."
                  defaultValue=""
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      setCurrentSymbol(e.target.value.trim().toUpperCase());
                      e.target.value = '';
                    }
                  }}
                  className="w-28 px-2 py-0.5 text-xs bg-gray-900 border border-gray-700 rounded text-white uppercase placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                {['RELIANCE', 'TCS', 'HDFCBANK', 'INFY'].map(s => (
                  <button
                    key={s}
                    onClick={() => setCurrentSymbol(s)}
                    className={`px-2 py-0.5 text-[10px] rounded border font-semibold transition ${
                      currentSymbol === s 
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' 
                        : 'bg-gray-850 text-gray-400 border-gray-800 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-3 mt-1 flex-wrap">
              <span>LTP: <strong className="text-white">₹{summary.ltp?.toFixed(2) || '—'}</strong></span>
              <span>VWAP: <strong className="text-blue-400">₹{summary.vwap?.toFixed(2) || '—'}</strong></span>
              <span>ORB H: <strong className="text-emerald-400">₹{summary.orbHigh?.toFixed(2) || '—'}</strong></span>
              <span>ORB L: <strong className="text-rose-400">₹{summary.orbLow?.toFixed(2) || '—'}</strong></span>
            </div>
          </div>
        </div>

        {/* Controls: Timeframe, Toggles & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe Buttons */}
          <div className="flex items-center bg-gray-900/80 border border-gray-700/60 rounded-lg p-0.5">
            <button
              onClick={() => setResolution('5m')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                resolution === '5m'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              5m
            </button>
            <button
              onClick={() => setResolution('15m')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                resolution === '15m'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              15m
            </button>
          </div>

          {/* Indicator Toggles */}
          <button
            onClick={() => setShowVwap(!showVwap)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition ${
              showVwap 
                ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' 
                : 'bg-gray-800/60 text-gray-400 border-gray-700 hover:text-white'
            }`}
            title="Toggle Intraday VWAP Line"
          >
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            VWAP
          </button>

          <button
            onClick={() => setShowOrb(!showOrb)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition ${
              showOrb 
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                : 'bg-gray-800/60 text-gray-400 border-gray-700 hover:text-white'
            }`}
            title="Toggle 15m ORB Channel"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            15m ORB
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition ${
              showVolume 
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' 
                : 'bg-gray-800/60 text-gray-400 border-gray-700 hover:text-white'
            }`}
            title="Toggle Volume Bars"
          >
            Vol
          </button>

          {/* Fit Zoom */}
          <button
            onClick={() => chartInstanceRef.current?.timeScale().fitContent()}
            className="p-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white transition"
            title="Reset Zoom / Fit Content"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Refresh */}
          <button
            onClick={fetchCandles}
            disabled={loading}
            className="p-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white transition disabled:opacity-50"
            title="Refresh Chart"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* Help Toggle */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-1.5 rounded-lg border transition ${
              showHelp 
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' 
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
            }`}
            title="Toggle Educational Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative w-full bg-[#090d16]" style={{ height: standalone ? '520px' : '420px' }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#090d16]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-300 font-medium">Loading candlestick feed...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#090d16]/90 p-6 text-center">
            <div className="max-w-md bg-rose-500/10 border border-rose-500/30 rounded-xl p-6">
              <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <h4 className="text-white font-semibold mb-1">Chart Data Unavailable</h4>
              <p className="text-xs text-rose-300 mb-4">{error}</p>
              <button
                onClick={fetchCandles}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        <div ref={chartContainerRef} className="w-full h-full" />
      </div>

      {/* Dynamic Trade Lines Legend (if SL or Target is set) */}
      {(stopLoss || target1 || target2) && (
        <div className="px-5 py-2.5 bg-[#0e162a] border-t border-gray-800 flex flex-wrap items-center gap-4 text-xs">
          <span className="text-gray-400 font-semibold flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-blue-400" /> Active Trade Levels:
          </span>
          {stopLoss && (
            <span className="text-rose-400 font-mono">
              🛑 Stop-Loss: <strong>₹{Number(stopLoss).toFixed(2)}</strong>
            </span>
          )}
          {target1 && (
            <span className="text-emerald-400 font-mono">
              🎯 Target 1 (1:1.5): <strong>₹{Number(target1).toFixed(2)}</strong>
            </span>
          )}
          {target2 && (
            <span className="text-emerald-300 font-mono">
              🚀 Target 2 (1:2.0): <strong>₹{Number(target2).toFixed(2)}</strong>
            </span>
          )}
        </div>
      )}

      {/* Prominent Educational Guide Box (Plain English Explanation) */}
      {showHelp && (
        <div className="p-5 bg-[#0a101f] border-t border-gray-800 text-xs text-gray-300">
          <div className="flex items-center gap-2 mb-3 text-blue-400 font-semibold text-sm">
            <Info className="w-4 h-4" />
            <span>📘 How To Read This Interactive Chart & Plain English Guide</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 font-semibold text-blue-300 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span>Blue Line: Intraday VWAP</span>
              </div>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                <strong>Volume Weighted Average Price:</strong> The true average price paid by institutional market participants today.
                If price is <strong>above the blue line</strong>, institutional buyers are in control. If price is <strong>below</strong>, sellers dominate.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-300 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Green / Red Dashed: 15m ORB Channel</span>
              </div>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                <strong>Opening Range Breakout:</strong> Marks the highest price (green) and lowest price (red) established during the first 15 minutes (9:15 - 9:30 AM).
                A candle closing <strong>above green</strong> triggers long momentum. A close <strong>below red</strong> triggers intraday breakdown.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 font-semibold text-purple-300 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <span>Bottom Bars: Volume Profile</span>
              </div>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                <strong>Institutional Confirmation:</strong> Tall green volume bars during a breakout indicate heavy institutional accumulation.
                Low volume breakouts often lead to false traps.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
