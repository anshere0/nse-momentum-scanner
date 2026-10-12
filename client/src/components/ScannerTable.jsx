import React, { useState, useMemo } from 'react';
import { Search, Download, ArrowUpDown, ArrowUp, ArrowDown, Filter, FileSpreadsheet } from 'lucide-react';

const ScannerTable = ({ data = [], sessionDate, dataMode }) => {
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('ALL'); // 'ALL', 'FNO', 'CASH'
  const [signalFilter, setSignalFilter] = useState('ALL'); // 'ALL', 'PDH', 'PDL', 'HIGH_OI', 'GAINERS', 'LOSERS'
  const [sortField, setSortField] = useState('pc'); // 'pc', 'ltp', 'oiChange', 'volume', 'tradingsymbol'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc', 'desc'

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Symbol search
      if (search && !item.tradingsymbol?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      // Segment filter
      if (segmentFilter === 'FNO' && item.type !== 'STOCK') return false;
      if (segmentFilter === 'CASH' && item.type === 'STOCK' && item.isFno) return false;

      // Signal filter
      const pc = item.pc || 0;
      const oiChg = item.oiChange || item.oi_change_pct || 0;
      const isPdh = item.pdh && item.ltp >= item.pdh;
      const isPdl = item.pdl && item.ltp <= item.pdl;

      if (signalFilter === 'PDH' && !isPdh) return false;
      if (signalFilter === 'PDL' && !isPdl) return false;
      if (signalFilter === 'HIGH_OI' && Math.abs(oiChg) < 5) return false;
      if (signalFilter === 'GAINERS' && pc <= 0) return false;
      if (signalFilter === 'LOSERS' && pc >= 0) return false;

      return true;
    }).sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'oiChange') {
        aVal = a.oiChange || a.oi_change_pct || 0;
        bVal = b.oiChange || b.oi_change_pct || 0;
      }

      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, search, segmentFilter, signalFilter, sortField, sortDirection]);

  const exportCSV = () => {
    if (!filteredData || filteredData.length === 0) return;

    const headers = ['Symbol', 'LTP', 'Change %', 'Open', 'High', 'Low', 'PDH', 'PDL', 'OI', 'OI Change %', 'Volume', 'Signal'];
    const rows = filteredData.map(item => [
      item.tradingsymbol || item.symbol || '',
      item.ltp || '',
      item.pc ? item.pc.toFixed(2) : '0',
      item.open || '',
      item.high || '',
      item.low || '',
      item.pdh || '',
      item.pdl || '',
      item.oi || '',
      (item.oiChange || item.oi_change_pct || 0).toFixed(2),
      item.volume || '',
      item.signal || (item.pdh && item.ltp >= item.pdh ? 'PDH Breakout' : item.pdl && item.ltp <= item.pdl ? 'PDL Breakdown' : '')
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `scanner_export_${sessionDate || 'today'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-gray-500" />;
    return sortDirection === 'asc' ? <ArrowUp size={12} className="text-purple-400" /> : <ArrowDown size={12} className="text-purple-400" />;
  };

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden shadow-xl border border-[#2a2e39]">
      {/* Table Controls */}
      <div className="p-4 border-b border-[#2a2e39] bg-[#131722]/80 flex flex-col md:flex-row gap-3 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol..."
            className="w-full bg-[#0a0d14] border border-[#2a2e39] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex bg-[#0a0d14] p-0.5 rounded-lg border border-[#2a2e39]">
            {['ALL', 'GAINERS', 'LOSERS', 'PDH', 'HIGH_OI'].map((f) => (
              <button
                key={f}
                onClick={() => setSignalFilter(f)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  signalFilter === f ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {f === 'ALL' ? 'All' : f === 'PDH' ? 'PDH B/O' : f === 'HIGH_OI' ? 'High OI' : f === 'GAINERS' ? 'Gainers' : 'Losers'}
              </button>
            ))}
          </div>

          {/* Export to CSV */}
          <button
            onClick={exportCSV}
            disabled={filteredData.length === 0}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 text-xs font-semibold rounded-lg border border-gray-700 flex items-center gap-1.5 transition-colors"
            title="Export filtered rows to CSV"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        {filteredData.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-sm font-medium">No instruments match the current filters or search query.</p>
            <p className="text-xs mt-1 text-gray-600">Try adjusting the filter criteria or search string.</p>
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="text-[11px] uppercase tracking-wider text-gray-400 bg-[#171b26] sticky top-0 z-10 border-b border-[#2a2e39]">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th 
                  onClick={() => handleSort('tradingsymbol')} 
                  className="px-4 py-3 font-semibold cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    Symbol {getSortIcon('tradingsymbol')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('ltp')} 
                  className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    LTP (₹) {getSortIcon('ltp')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('pc')} 
                  className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Change % {getSortIcon('pc')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('oiChange')} 
                  className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    OI Chg % {getSortIcon('oiChange')}
                  </div>
                </th>
                <th className="px-4 py-3 text-right font-semibold">PDH / PDL Level</th>
                <th 
                  onClick={() => handleSort('volume')} 
                  className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Volume {getSortIcon('volume')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold">Technical Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2e39]/50">
              {filteredData.map((item, idx) => {
                const pc = item.pc || 0;
                const oiChg = item.oiChange || item.oi_change_pct || 0;
                const isPositive = pc >= 0;
                const isPdhBreakout = item.pdh && item.ltp >= item.pdh;
                const isPdlBreakdown = item.pdl && item.ltp <= item.pdl;

                return (
                  <tr 
                    key={item.instrument_key || idx} 
                    className="hover:bg-[#1a2235]/60 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-[11px]">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-bold text-white tracking-wide">
                      <div className="flex items-center gap-2">
                        <span>{item.tradingsymbol || item.symbol}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                          (item.category === 'F&O' || item.isFno)
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {item.category || (item.isFno ? 'F&O' : 'Cash')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-200">
                      ₹{item.ltp ? item.ltp.toFixed(2) : '-'}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isPositive ? '+' : ''}{pc.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">
                      {(!item.isFno && item.category !== 'F&O') ? (
                        <span className="text-gray-500">—</span>
                      ) : (
                        <span className={oiChg >= 5 ? 'text-sky-400' : oiChg <= -5 ? 'text-amber-400' : 'text-gray-400'}>
                          {oiChg > 0 ? '+' : ''}{oiChg.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-400 text-[11px]">
                      {item.pdh ? `H: ${item.pdh.toFixed(1)}` : ''} {item.pdl ? `L: ${item.pdl.toFixed(1)}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-400">
                      {item.volume ? item.volume.toLocaleString('en-IN') : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isPdhBreakout ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          PDH B/O
                        </span>
                      ) : isPdlBreakdown ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          PDL B/D
                        </span>
                      ) : Math.abs(oiChg) >= 10 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                          OI Spike
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-[#2a2e39] bg-[#171b26] flex justify-between items-center text-[11px] text-gray-400">
        <div>
          Showing <span className="font-semibold text-white">{filteredData.length}</span> of {data.length} instruments
        </div>
        <div>
          Session: <span className="text-gray-300 font-mono">{sessionDate || 'Current'}</span> ({dataMode || 'Active'})
        </div>
      </div>
    </div>
  );
};

export default ScannerTable;
