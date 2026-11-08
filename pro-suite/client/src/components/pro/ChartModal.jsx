import React from 'react';
import { X, ExternalLink, Maximize2 } from 'lucide-react';
import TradingViewChart from './TradingViewChart';

export default function ChartModal({ isOpen, onClose, symbol, stopLoss = null, target1 = null, target2 = null }) {
  if (!isOpen || !symbol) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-[#090e1a] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-[#0c1322]">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white tracking-wide">{symbol}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              Interactive Candlesticks + VWAP + 15m ORB
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Embedded TradingView Chart */}
        <div className="p-4 overflow-y-auto">
          <TradingViewChart 
            symbol={symbol}
            initialResolution="5m"
            stopLoss={stopLoss}
            target1={target1}
            target2={target2}
            standalone={true}
          />
        </div>
      </div>
    </div>
  );
}
