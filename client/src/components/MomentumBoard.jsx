import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MomentumBoard = ({ title, data = [], type }) => {
  const isBullish = type === 'bullish';
  const Icon = isBullish ? TrendingUp : TrendingDown;
  const colorClass = isBullish ? 'text-brand-green' : 'text-brand-red';
  const bgClass = isBullish ? 'bg-brand-green/10' : 'bg-brand-red/10';

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden relative shadow-lg">
      {/* Decorative top glow */}
      <div className={`absolute top-0 left-0 w-full h-1 ${isBullish ? 'bg-gradient-to-r from-brand-green to-transparent' : 'bg-gradient-to-r from-brand-red to-transparent'}`}></div>
      
      <div className="flex items-center justify-between p-5 border-b border-brand-border bg-gray-900/40">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${bgClass} ring-1 ${isBullish ? 'ring-brand-green/30' : 'ring-brand-red/30'} shadow-lg`}>
            <Icon className={colorClass} size={20} />
          </div>
          <h2 className={`text-xl font-bold tracking-wide ${isBullish ? 'text-glow-green' : 'text-glow-red'}`}>{title}</h2>
        </div>
        <span className="text-xs font-mono text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded border border-gray-700/60">
          {data.length} stocks
        </span>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {data.length === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-gray-500 p-6 text-center">
            <div className={`p-3 rounded-xl mb-3 ${bgClass}`}>
              <Icon className={`${colorClass} opacity-60`} size={28} />
            </div>
            <span className="font-mono text-sm tracking-wider uppercase text-gray-400 font-medium">
              No {isBullish ? 'Gainers' : 'Losers'} Found
            </span>
            <p className="text-xs text-gray-600 mt-1 max-w-[220px]">
              Awaiting qualifying signals or adjust scanner filter criteria
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-gray-400 uppercase bg-[#131722]/90 backdrop-blur-md sticky top-0 z-10 shadow-sm border-b border-gray-800">
              <tr>
                <th className="px-5 py-3 font-semibold tracking-wider">Symbol</th>
                <th className="px-4 py-3 text-right font-semibold tracking-wider">LTP</th>
                <th className="px-4 py-3 text-right font-semibold tracking-wider">Change</th>
                <th className="px-4 py-3 text-right font-semibold tracking-wider">OI Chg</th>
                <th className="px-4 py-3 text-center font-semibold tracking-wider">Alert</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
              {data.map((item, idx) => {
                const isFno = item.isFno ?? (item.category === 'F&O' || item.exchange === 'NFO' || item.instrumentType === 'FUTSTK');
                const category = item.category || (isFno ? 'F&O' : 'Cash');
                const oiChg = item.oi_change_pct !== undefined ? item.oi_change_pct : (item.oiChange || 0);

                return (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, x: isBullish ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
                    key={item.instrument_key || idx} 
                    className="border-b border-brand-border/40 hover:bg-gray-800/40 transition-colors cursor-default group"
                  >
                    <td className="px-5 py-3.5 font-medium">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs text-gray-500 font-mono w-4 group-hover:text-gray-300 transition-colors">{idx + 1}.</span>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="tracking-wide text-gray-200 group-hover:text-white font-semibold text-xs sm:text-sm">
                              {item.tradingsymbol || item.symbol}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded tracking-wider uppercase inline-flex items-center ${
                              category === 'F&O'
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            }`}>
                              {category}
                            </span>
                          </div>
                          {item.name && item.name !== item.tradingsymbol && (
                            <span className="text-[11px] text-gray-500 truncate">{item.name}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-gray-300 text-xs sm:text-sm">
                      ₹{item.ltp?.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3.5 text-right font-mono font-bold text-xs sm:text-sm ${item.pc >= 0 ? 'text-brand-green text-glow-green' : 'text-brand-red text-glow-red'}`}>
                      {item.pc > 0 ? '+' : ''}{item.pc?.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs">
                      {!isFno ? (
                        <span className="text-gray-500" title="Cash equity — no derivative contract OI">—</span>
                      ) : (
                        <span className={`font-semibold ${
                          oiChg >= 5 ? 'text-blue-400 font-bold' :
                          oiChg <= -5 ? 'text-orange-400 font-bold' :
                          oiChg > 0 ? 'text-blue-300' :
                          oiChg < 0 ? 'text-orange-300' :
                          'text-gray-400'
                        }`}>
                          {oiChg > 0 ? '+' : ''}{oiChg.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {/* Check signals */}
                      {item.pdh && item.ltp >= item.pdh * 0.998 ? (
                        <span className="text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded">PDH B/O</span>
                      ) : item.pdl && item.ltp <= item.pdl * 1.002 ? (
                        <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">PDL B/D</span>
                      ) : (
                        <span className="text-xs text-gray-600">-</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MomentumBoard;
