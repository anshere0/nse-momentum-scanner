import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { X, TrendingUp, TrendingDown, Volume2, Clock, Calendar, ShieldAlert, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function BreakoutChartModal({ signal, onClose }) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState(null);

  const isBullish = signal.signalType === 'BULLISH_BREAKOUT';
  const isLive = signal.signalStatus === 'LIVE';
  const isInvalidated = signal.signalStatus === 'INVALIDATED';

  useEffect(() => {
    let isMounted = true;
    const fetchCandles = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          token: signal.token,
          symbol: signal.symbol,
          exchange: signal.exchange || 'NSE',
          timeframe: signal.timeframe || '15m'
        });
        const res = await fetch(`${API_BASE}/api/breakout/candles?${params.toString()}`);
        if (!res.ok) throw new Error(`Candle data unavailable (Status: ${res.status})`);
        const data = await res.json();
        if (isMounted) {
          setChartData(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchCandles();
    return () => { isMounted = false; };
  }, [signal.token, signal.timeframe]);

  useEffect(() => {
    if (!chartContainerRef.current || !chartData || !chartData.candles || chartData.candles.length === 0) {
      return;
    }

    // Clean up previous chart instance
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const initialWidth = Math.max(300, container.clientWidth || 800);
    const chart = createChart(container, {
      width: initialWidth,
      height: 480,
      layout: {
        background: { type: ColorType.Solid, color: '#0d111a' },
        textColor: '#9ca3af',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.4)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.4)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#8b5cf6', width: 1, style: 2 },
        horzLine: { color: '#8b5cf6', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartInstanceRef.current = chart;

    // Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Volume Series
    const volumeSeries = chart.addHistogramSeries({
      color: '#6366f1',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
    });

    // Format candle and volume data synchronously with strict ascending time and deduplication
    const dedupedCandles = [];
    const dedupedVolume = [];
    const seenTimes = new Set();

    const sortedRaw = [...chartData.candles].sort((a, b) => {
      const tA = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : a.timestamp;
      const tB = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : b.timestamp;
      return tA - tB;
    });

    for (const c of sortedRaw) {
      let timeSec = c.timestamp;
      if (typeof timeSec === 'string') {
        timeSec = Math.floor(new Date(timeSec).getTime() / 1000);
      } else if (timeSec > 1e11) {
        timeSec = Math.floor(timeSec / 1000);
      }

      if (!timeSec || isNaN(timeSec) || seenTimes.has(timeSec)) continue;
      seenTimes.add(timeSec);

      const o = Number(c.open);
      const h = Number(c.high);
      const l = Number(c.low);
      const cl = Number(c.close);
      const v = Number(c.volume) || 0;

      if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(cl)) continue;

      dedupedCandles.push({
        time: timeSec,
        open: o,
        high: h,
        low: l,
        close: cl,
      });

      const isUp = cl >= o;
      dedupedVolume.push({
        time: timeSec,
        value: v,
        color: isUp ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)',
      });
    }

    if (dedupedCandles.length > 0) {
      try {
        candleSeries.setData(dedupedCandles);
        volumeSeries.setData(dedupedVolume);
      } catch (err) {
        console.warn('Lightweight charts setData error:', err);
      }
    }

    // Add Resistance Level Line (Emerald)
    if (chartData.resistance) {
      candleSeries.createPriceLine({
        price: chartData.resistance,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `Resistance: ₹${chartData.resistance}`,
      });
    }

    // Add Support Level Line (Rose)
    if (chartData.support) {
      candleSeries.createPriceLine({
        price: chartData.support,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `Support: ₹${chartData.support}`,
      });
    }

    chart.timeScale().fitContent();

    requestAnimationFrame(() => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({ width: chartContainerRef.current.clientWidth || initialWidth });
        chartInstanceRef.current.timeScale().fitContent();
      }
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
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
  }, [chartData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-[#11141f] border border-[#2a2e39] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2a2e39] flex flex-wrap items-center justify-between gap-3 bg-[#131722]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              isBullish ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {isBullish ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white tracking-tight">{signal.symbol}</h3>
                <span className="text-xs font-mono text-gray-400 px-2 py-0.5 rounded bg-[#1e2330] border border-gray-700">
                  {signal.exchange || 'NSE'} • {signal.instrumentType}
                </span>
                {/* Signal Badge */}
                <span className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  isInvalidated 
                    ? 'bg-gray-700/50 text-gray-400 border border-gray-600'
                    : isBullish
                      ? (isLive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse' : 'bg-emerald-600 text-white')
                      : (isLive ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-rose-600 text-white')
                }`}>
                  {isInvalidated ? (
                    <><AlertTriangle size={11} /> INVALIDATED</>
                  ) : (
                    <><CheckCircle2 size={11} /> {isLive ? `LIVE ${isBullish ? 'BREAKOUT' : 'BREAKDOWN'}` : `CONFIRMED ${isBullish ? 'BREAKOUT' : 'BREAKDOWN'}`}</>
                  )}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{signal.name || signal.symbol}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-black text-white font-mono">
                ₹{signal.livePrice?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className={`text-xs font-bold font-mono ${signal.priceChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {signal.priceChangePct >= 0 ? '+' : ''}{signal.priceChangePct}% Today
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#1e2330] text-gray-400 hover:text-white hover:bg-gray-700 transition"
              title="Close chart view"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 p-3 sm:px-5 bg-[#0a0d14] border-b border-[#2a2e39] text-xs font-mono">
          <div className="bg-[#131722] p-2.5 rounded-lg border border-[#2a2e39]">
            <span className="text-gray-400 block text-[11px]">Timeframe</span>
            <strong className="text-white text-sm">{signal.timeframe}</strong>
          </div>
          <div className="bg-[#131722] p-2.5 rounded-lg border border-[#2a2e39]">
            <span className="text-gray-400 block text-[11px]">Lookback</span>
            <strong className="text-white text-sm">{signal.lookbackValue} {signal.lookbackUnit}</strong>
          </div>
          <div className="bg-[#131722] p-2.5 rounded-lg border border-[#2a2e39]">
            <span className="text-gray-400 block text-[11px]">{isBullish ? 'Resistance' : 'Support'}</span>
            <strong className={`${isBullish ? 'text-emerald-400' : 'text-rose-400'} text-sm`}>
              ₹{isBullish ? signal.breakoutLevel : signal.supportLevel}
            </strong>
          </div>
          <div className="bg-[#131722] p-2.5 rounded-lg border border-[#2a2e39]">
            <span className="text-gray-400 block text-[11px]">Distance</span>
            <strong className={`${signal.distancePct >= 0 ? 'text-emerald-400' : 'text-rose-400'} text-sm`}>
              {signal.distancePct >= 0 ? '+' : ''}{signal.distancePct}%
            </strong>
          </div>
          <div className="bg-[#131722] p-2.5 rounded-lg border border-[#2a2e39]">
            <span className="text-gray-400 block text-[11px]">Volume Multiplier</span>
            <strong className="text-purple-400 text-sm font-bold">
              {signal.volumeRatio}x <span className="text-gray-500 font-normal text-[10px]">(&ge; {signal.minMultiplierRequired}x)</span>
            </strong>
          </div>
          <div className="bg-[#131722] p-2.5 rounded-lg border border-[#2a2e39]">
            <span className="text-gray-400 block text-[11px]">Volume Mode</span>
            <span className="text-indigo-300 font-semibold text-[11px] truncate block">
              {signal.volumeMode === 'TIME_ADJUSTED' ? 'Time-Adjusted' : 'Standard'}
            </span>
          </div>
        </div>

        {/* Chart Canvas Area */}
        <div className="flex-1 p-3 sm:p-5 relative min-h-[480px] bg-[#0d111a]">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0d111a]/90 z-20">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-gray-400">Loading historical candles from Angel One SmartAPI...</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center z-20">
              <ShieldAlert size={36} className="text-amber-400" />
              <div className="text-sm font-bold text-gray-200">Historical Chart Unavailable</div>
              <p className="text-xs text-gray-400 max-w-md">{error}</p>
            </div>
          )}

          <div ref={chartContainerRef} className="w-full h-[480px]"></div>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-[#131722] border-t border-[#2a2e39] flex flex-wrap items-center justify-between text-[11px] text-gray-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Green line: Historical Resistance ({signal.lookbackValue} {signal.lookbackUnit})</span>
            <span className="mx-2 text-gray-600">•</span>
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>Red line: Historical Support</span>
          </div>
          <div>
            <span>Signal Time: {new Date(signal.signalTime || signal.detectedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, day: '2-digit', month: 'short' })} IST</span>
          </div>
        </div>

      </div>
    </div>
  );
}

