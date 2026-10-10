import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MomentumBoard = ({ title, data = [], type }) => {
  const isBullish = type === 'bullish';
  const Icon = isBullish ? TrendingUp : TrendingDown;
  const colorClass = isBullish ? 'text-brand-green' : 'text-brand-red';
  const bgClass = isBullish ? 'bg-brand-green/10' : 'bg-brand-red/10';

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden relative">
      {/* Decorative top glow */}
      <div className={`absolute top-0 left-0 w-full h-1 ${isBullish ? 'bg-gradient-to-r from-brand-green to-transparent' : 'bg-gradient-to-r from-brand-red to-transparent'}`}></div>
      
      <div className="flex items-center gap-3 p-5 border-b border-brand-border bg-gray-900/30">
        <div className={`p-2 rounded-lg ${bgClass} ring-1 ${isBullish ? 'ring-brand-green/30' : 'ring-brand-red/30'} shadow-lg`}>
          <Icon className={colorClass} size={20} />
        </div>
        <h2 className={`text-xl font-bold tracking-wide ${isBullish ? 'text-glow-green' : 'text-glow-red'}`}>{title}</h2>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-70">
            <div className="w-12 h-12 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin mb-4"></div>
            <span className="font-mono text-sm tracking-widest uppercase">Awaiting Signal...</span>
          </div>
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-gray-400 uppercase bg-[#131722]/90 backdrop-blur-md sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-5 py-4 font-semibold tracking-wider">Symbol</th>
                <th className="px-4 py-4 text-right font-semibold tracking-wider">LTP</th>
                <th className="px-4 py-4 text-right font-semibold tracking-wider">Change</th>
                <th className="px-4 py-4 text-right font-semibold tracking-wider">OI Chg</th>
                <th className="px-4 py-4 text-center font-semibold tracking-wider">Alert</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
              {data.map((item, idx) => (
                <motion.tr 
                  layout
                  initial={{ opacity: 0, x: isBullish ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                  key={item.instrument_key} 
                  className="border-b border-brand-border/50 hover:bg-gray-800/40 transition-all cursor-default group"
                >
                  <td className="px-5 py-4 font-medium flex items-center gap-3">
                    <span className="text-xs text-gray-600 font-mono w-4 group-hover:text-gray-400 transition-colors">{idx + 1}.</span>
                    <span className="tracking-wide text-gray-200 group-hover:text-white">{item.tradingsymbol}</span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-gray-300">
                    ₹{item.ltp?.toFixed(2)}
                  </td>
                  <td className={`px-4 py-4 text-right font-mono font-bold ${item.pc >= 0 ? 'text-brand-green text-glow-green' : 'text-brand-red text-glow-red'}`}>
                    {item.pc > 0 ? '+' : ''}{item.pc?.toFixed(2)}%
                  </td>
                  <td className={`px-4 py-4 text-right font-mono text-xs ${parseFloat(item.oi_change_pct) >= 5 ? 'text-blue-400 font-bold' : parseFloat(item.oi_change_pct) <= -5 ? 'text-orange-400 font-bold' : 'text-gray-500'}`}>
                    {(item.oiChange || item.oi_change_pct || 0) > 0 ? '+' : ''}{(item.oiChange || item.oi_change_pct || 0).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    {/* Check if near PDH / PDL */}
                    {item.pdh && item.ltp >= item.pdh * 0.998 ? (
                      <span className="text-xs font-bold bg-green-500/20 text-green-400 px-2 py-1 rounded">PDH B/O</span>
                    ) : item.pdl && item.ltp <= item.pdl * 1.002 ? (
                      <span className="text-xs font-bold bg-red-500/20 text-red-400 px-2 py-1 rounded">PDL B/D</span>
                    ) : (
                      <span className="text-xs text-gray-600">-</span>
                    )}
                  </td>
                </motion.tr>
              ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MomentumBoard;
