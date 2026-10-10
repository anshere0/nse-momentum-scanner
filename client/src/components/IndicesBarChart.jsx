import React from 'react';

// Hardcoded color map for indices based on the user's image preference
const colorMap = {
  'NIFTY IT': 'bg-[#4CB1E0]', // CNXIT
  'NIFTY FMCG': 'bg-[#FF6482]', // NIFTYFMCG
  'NIFTY PSU BANK': 'bg-[#76D275]', // NIFTYPSUBANK
  'NIFTY MIDCAP 50': 'bg-[#FFB74D]', // NIFTYMIDCAP50
  'NIFTY MID SELECT': 'bg-[#7986CB]', // NIFTYMIDSELECT
  'NIFTY CONSUMPTION': 'bg-[#F06292]', // NIFTYCONSUMPTION
  'NIFTY AUTO': 'bg-[#E6C847]', // NIFTYAUTO
  'NIFTY MIDCAP 150': 'bg-[#26A69A]', // NIFTYMIDCAP150
  'NIFTY BANK': 'bg-[#EF5350]', // BANKNIFTY
  'NIFTY 50': 'bg-[#AB47BC]', 
  'NIFTY FIN SERVICE': 'bg-[#29B6F6]',
  'NIFTY METAL': 'bg-[#8D6E63]',
  'NIFTY PHARMA': 'bg-[#26C6DA]'
};

// Default color if index not found
const DEFAULT_COLOR = 'bg-gray-500';

const IndicesBarChart = ({ indices = [] }) => {
  if (!indices || indices.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        No index data
      </div>
    );
  }

  // Find max absolute percentage change to scale the bars
  const maxAbsChange = Math.max(
    ...indices.map(idx => Math.abs(idx.pc || 0)),
    0.1 // avoid division by zero
  );

  return (
    <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
      <div className="flex flex-col gap-3 py-2">
        {indices.map((item) => {
          const val = item.pc || 0;
          const isPositive = val >= 0;
          
          // Width percentage based on max value. Max bar width is 100%.
          const widthPct = Math.min((Math.abs(val) / maxAbsChange) * 100, 100);
          
          // Fallback width to ensure name is readable, e.g., min 30% if we want
          const displayWidth = Math.max(widthPct, 40); 
          
          // Get color from map
          let barColor = colorMap[item.tradingsymbol] || colorMap[item.name] || DEFAULT_COLOR;
          if (!isPositive) {
            // Optional: If negative, you could make it red, but the image shows specific colors per index regardless?
            // Wait, the image shows top gainers. If it's a loser, maybe different styling.
            // For now, keep the color but maybe adjust opacity or just keep it as is.
          }

          // Format name (e.g., NIFTY IT -> CNXIT, NIFTY BANK -> BANKNIFTY)
          let displayName = item.name.replace('NIFTY ', 'NIFTY').replace(' ', '');
          if (item.name === 'NIFTY IT') displayName = 'CNXIT';
          if (item.name === 'NIFTY BANK') displayName = 'BANKNIFTY';

          return (
            <div key={item.instrument_key} className="flex items-center text-sm">
              {/* Value Column */}
              <div className="w-12 text-right pr-3 font-mono text-gray-300">
                {Math.abs(val).toFixed(2)}
              </div>
              
              {/* Bar Column */}
              <div className="flex-1 border-l-2 border-gray-700 pl-3 py-1 flex items-center">
                {/* Bar */}
                <div 
                  className={`h-8 flex items-center px-3 rounded-r-xl ${barColor} text-black font-bold whitespace-nowrap overflow-hidden text-xs tracking-tight transition-all duration-500 ease-out`}
                  style={{ width: `${displayWidth}%` }}
                >
                  {displayName}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IndicesBarChart;
