import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Calculator, AlertTriangle, Briefcase, Plus, Trash2, 
  Download, SlidersHorizontal, RotateCcw, TrendingUp, TrendingDown, 
  CheckCircle, ArrowRight, DollarSign, PieChart, Info, RefreshCw, BarChart2
} from 'lucide-react';
import InfoBox from '../common/InfoBox';

export default function RiskPlannerCard({ settings = {}, onSaveSettings, onOpenChart }) {
  const [stocks, setStocks] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [direction, setDirection] = useState('LONG');
  const [slMethod, setSlMethod] = useState('SMART_PREDICTED');
  const [manualSlPrice, setManualSlPrice] = useState('');
  const [capital, setCapital] = useState(settings?.defaultCapital || 100000);
  const [riskAmount, setRiskAmount] = useState(settings?.defaultRiskAmount || 2000);
  const [t1Multiplier, setT1Multiplier] = useState(1.5);
  const [t2Multiplier, setT2Multiplier] = useState(2.0);

  const [currentPlan, setCurrentPlan] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [basket, setBasket] = useState([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // 1. Fetch F&O stocks for selector
  useEffect(() => {
    fetch('/api/pro/quadrant?minScore=0')
      .then(res => res.json())
      .then(data => {
        const list = data.stocks || [];
        setStocks(list);
        if (list.length > 0 && !selectedSymbol) {
          setSelectedSymbol(list[0].symbol);
        }
      })
      .catch(err => console.error('Failed to load stocks for planner', err));
  }, []);

  // 2. Fetch existing basket
  const fetchBasket = async () => {
    try {
      const res = await fetch('/api/pro/basket');
      if (res.ok) {
        const data = await res.json();
        setBasket(data.trades || []);
      }
    } catch (err) {
      console.error('Failed to fetch basket', err);
    }
  };

  useEffect(() => {
    fetchBasket();
  }, []);

  // 3. Calculate trade plan
  const calculatePlan = async () => {
    if (!selectedSymbol) return;
    setCalculating(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/pro/risk-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol,
          direction,
          slMethod,
          manualSlPrice: slMethod === 'MANUAL' && manualSlPrice ? Number(manualSlPrice) : null,
          capital: Number(capital),
          riskAmount: Number(riskAmount),
          target1Multiplier: Number(t1Multiplier),
          target2Multiplier: Number(t2Multiplier)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentPlan(data.plan);
      }
    } catch (err) {
      console.error('Failed to calculate risk plan', err);
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    calculatePlan();
  }, [selectedSymbol, direction, slMethod, manualSlPrice, capital, riskAmount, t1Multiplier, t2Multiplier]);

  // 4. Add to Basket
  const handleAddToBasket = async () => {
    if (!currentPlan) return;
    const newTrade = {
      id: Date.now().toString(),
      symbol: currentPlan.symbol,
      direction: currentPlan.direction,
      slMethod,
      entryPrice: currentPlan.entryPrice,
      stopLoss: currentPlan.stopLoss,
      target1: currentPlan.target1,
      target2: currentPlan.target2,
      riskPerShare: currentPlan.riskPerShare,
      lotSize: currentPlan.lotSize,
      lots: currentPlan.recommendedLots,
      shares: currentPlan.recommendedLots > 0 ? currentPlan.fnoShares : currentPlan.recommendedShares,
      isFno: currentPlan.recommendedLots > 0,
      marginRequired: currentPlan.recommendedLots > 0 ? currentPlan.totalMarginNeeded : currentPlan.cashCapitalNeeded,
      actualRisk: currentPlan.actualRiskAmount,
      potentialProfitT1: currentPlan.potentialProfitT1,
      potentialProfitT2: currentPlan.potentialProfitT2,
      createdAt: new Date().toLocaleTimeString('en-IN')
    };

    const updatedBasket = [...basket, newTrade];
    setBasket(updatedBasket);

    try {
      await fetch('/api/pro/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: updatedBasket })
      });
      setStatusMessage(`✓ Added ${currentPlan.symbol} to Trade Basket`);
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save basket', err);
    }
  };

  // 5. Remove trade from basket
  const handleRemoveFromBasket = async (id) => {
    const updated = basket.filter(t => t.id !== id);
    setBasket(updated);
    try {
      await fetch('/api/pro/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: updated })
      });
    } catch (err) {
      console.error('Failed to update basket', err);
    }
  };

  // 6. Clear entire basket
  const handleClearBasket = async () => {
    if (!window.confirm('Clear all planned trades from your basket?')) return;
    setBasket([]);
    try {
      await fetch('/api/pro/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: [] })
      });
    } catch (err) {
      console.error('Failed to clear basket', err);
    }
  };

  // 7. Export to CSV
  const handleExportCSV = () => {
    if (basket.length === 0) return;
    const headers = [
      'Symbol', 'Direction', 'SL Method', 'Entry Price', 'Stop Loss', 
      'Target 1 (1:1.5)', 'Target 2 (1:2.0)', 'Lot Size', 'Quantity', 
      'Type', 'Margin/Capital Needed', 'Max Risk Rs', 'Potential Profit T1', 'Potential Profit T2', 'Planned At'
    ];
    const rows = basket.map(t => [
      t.symbol,
      t.direction,
      t.slMethod,
      t.entryPrice,
      t.stopLoss,
      t.target1,
      t.target2,
      t.lotSize,
      t.shares,
      t.isFno ? 'F&O Futures' : 'Cash Equity',
      t.marginRequired,
      t.actualRisk,
      t.potentialProfitT1,
      t.potentialProfitT2,
      t.createdAt
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trade_basket_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter stocks for search
  const filteredStocks = searchQuery
    ? stocks.filter(s => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
    : stocks;

  // Basket summary calculations
  const totalMarginAllocated = basket.reduce((acc, t) => acc + (t.marginRequired || 0), 0);
  const totalPortfolioRisk = basket.reduce((acc, t) => acc + (t.actualRisk || 0), 0);
  const totalProfitT1 = basket.reduce((acc, t) => acc + (t.potentialProfitT1 || 0), 0);
  const totalProfitT2 = basket.reduce((acc, t) => acc + (t.potentialProfitT2 || 0), 0);
  const portfolioRiskPct = capital > 0 ? ((totalPortfolioRisk / capital) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Educational Guide Box */}
      <InfoBox
        title="Institutional Risk Management & Trade Planning Engine"
        what="Automates institutional risk rules before entering any position. Calculates exact Stop-Loss levels based on technical pivots (VWAP or ORB), exact position sizes strictly based on your maximum ₹ risk tolerance, and rounds contracts to full F&O lot sizes to prevent overleveraging."
        calculation="Position Size = Risk Budget (₹) / |Entry - StopLoss|. For F&O: Lots = floor(Position Size / Lot Size). If lots = 0, system flags capital warning and recommends Cash Equity."
        example="With ₹2,000 risk budget on a ₹1,000 stock with ₹990 SL (₹10 risk/share), size is 200 shares. If lot size is 250, taking 1 full lot risks ₹2,500 (+25% above budget). The engine warns you immediately."
        defaultOpen={true}
      />

      {/* Safety Notice Banner */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-300 font-semibold">Strict Educational & Sizing Guardrail: </strong>
          This engine plans stop losses, position sizes, and margin requirements. It operates strictly in memory and local storage — 
          <span className="underline font-bold text-white ml-1">NO automated broker orders or credentials are connected</span>. 
          Execute planned orders manually on your Angel One terminal.
        </div>
      </div>

      {/* Main Grid: Calculator on Left, Basket on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Trade Planning Form & Output (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="glass-card rounded-2xl p-5 border border-gray-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-white">Setup Trade Parameters</h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-white glass-card rounded-lg border border-gray-700 transition cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Defaults</span>
              </button>
            </div>

            {/* Inputs Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Stock Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Select Stock (F&O)</label>
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="Search symbol (e.g. RELIANCE)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                  >
                    {filteredStocks.map(s => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.symbol} — ₹{Number(s.ltp).toFixed(2)} ({s.pChange >= 0 ? '+' : ''}{Number(s.pChange).toFixed(1)}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Trade Direction */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Trade Direction</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setDirection('LONG')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      direction === 'LONG'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400'
                        : 'bg-gray-900 text-gray-400 border border-gray-800 hover:text-white'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    LONG (Buy)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('SHORT')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      direction === 'SHORT'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-400'
                        : 'bg-gray-900 text-gray-400 border border-gray-800 hover:text-white'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    SHORT (Sell)
                  </button>
                </div>
              </div>

              {/* Stop Loss Method */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Stop-Loss Placement Strategy</label>
                <select
                  value={slMethod}
                  onChange={(e) => {
                    setSlMethod(e.target.value);
                    if (e.target.value === 'MANUAL' && !manualSlPrice && currentPlan?.stopLoss) {
                      setManualSlPrice(currentPlan.stopLoss);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="SMART_PREDICTED">✨ Smart Predicted (Algorithmic Multi-Factor)</option>
                  <option value="MANUAL">✍️ Custom Manual Price Input</option>
                  <option value="VWAP">Dynamic VWAP Buffer (0.3% beyond VWAP)</option>
                  <option value="ORB">15m Opening Range (Above High / Below Low)</option>
                  <option value="DAY_EXTREME">Today's Day Low / High Pivot</option>
                  <option value="PDH_PDL">Previous Day High / Low (PDH/PDL)</option>
                  <option value="ATR">Volatility Buffer (1.2% fixed ATR buffer)</option>
                  <option value="PERCENT_1">Fixed 1.0% Buffer from Entry</option>
                </select>
              </div>

              {/* Manual SL Price Input (Visible when MANUAL selected) */}
              {slMethod === 'MANUAL' && (
                <div className="col-span-1 sm:col-span-2 p-3 rounded-xl bg-purple-950/20 border border-purple-500/40 space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <span>✍️ Enter Custom Stop-Loss Price</span>
                    </label>
                    <span className="text-[11px] text-gray-400">
                      Entry LTP: <strong className="text-white font-mono">₹{currentPlan?.entryPrice || '-'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2 text-xs text-gray-400 font-mono">₹</span>
                      <input
                        type="number"
                        step="0.05"
                        value={manualSlPrice}
                        placeholder={direction === 'LONG' ? "Enter price strictly below entry" : "Enter price strictly above entry"}
                        onChange={(e) => setManualSlPrice(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-xs bg-gray-950 border border-purple-500/50 rounded-lg text-white font-mono font-bold focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentPlan?.entryPrice) {
                          const p = direction === 'LONG' 
                            ? (currentPlan.entryPrice * 0.99).toFixed(2) 
                            : (currentPlan.entryPrice * 1.01).toFixed(2);
                          setManualSlPrice(p);
                        }
                      }}
                      className="px-2.5 py-2 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-mono transition cursor-pointer"
                    >
                      1% SL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentPlan?.entryPrice) {
                          const p = direction === 'LONG' 
                            ? (currentPlan.entryPrice * 0.98).toFixed(2) 
                            : (currentPlan.entryPrice * 1.02).toFixed(2);
                          setManualSlPrice(p);
                        }
                      }}
                      className="px-2.5 py-2 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-mono transition cursor-pointer"
                    >
                      2% SL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSlMethod('SMART_PREDICTED');
                        setManualSlPrice('');
                      }}
                      className="px-3 py-2 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition cursor-pointer whitespace-nowrap"
                    >
                      ✨ Auto-Predict
                    </button>
                  </div>
                </div>
              )}

              {/* Risk Budget */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Max ₹ Risk on This Trade</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-gray-400 font-mono">₹</span>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={riskAmount}
                    onChange={(e) => setRiskAmount(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Total Account Capital */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Account Capital (Portfolio)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-gray-400 font-mono">₹</span>
                  <input
                    type="number"
                    min="10000"
                    step="10000"
                    value={capital}
                    onChange={(e) => setCapital(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Target Multipliers */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">Target 1 (R:R)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    value={t1Multiplier}
                    onChange={(e) => setT1Multiplier(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">Target 2 (R:R)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.5"
                    value={t2Multiplier}
                    onChange={(e) => setT2Multiplier(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Calculated Output Card */}
          {currentPlan && (
            <div className="glass-card rounded-2xl p-5 border border-blue-500/30 bg-[#090d16] shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-lg font-mono">{currentPlan.symbol}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                    currentPlan.direction === 'LONG'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {currentPlan.direction} SETUP
                  </span>
                  <span className="text-xs text-gray-400 font-mono">Lot Size: {currentPlan.lotSize}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenChart && onOpenChart(currentPlan.symbol)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-300 hover:text-white rounded-lg text-xs font-semibold border border-gray-700 transition cursor-pointer"
                    title="View technical chart with SL and Target levels"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>📈 Chart</span>
                  </button>
                  <button
                    onClick={handleAddToBasket}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-600/30 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Basket</span>
                  </button>
                </div>
              </div>

              {/* Execution Price Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800">
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Entry (LTP)</span>
                  <div className="text-base font-bold text-white font-mono mt-0.5">₹{currentPlan.entryPrice}</div>
                  <span className="text-[10px] text-gray-500">Current market price</span>
                </div>

                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-rose-300 uppercase font-semibold">
                      Stop Loss ({slMethod === 'SMART_PREDICTED' ? '✨ Smart' : slMethod === 'MANUAL' ? '✍️ Manual' : slMethod})
                    </span>
                    {slMethod !== 'MANUAL' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSlMethod('MANUAL');
                          setManualSlPrice(currentPlan.stopLoss);
                        }}
                        className="text-[10px] text-purple-300 hover:text-white px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-500/30 cursor-pointer"
                        title="Fine-tune stop loss manually"
                      >
                        ✏️ Custom
                      </button>
                    )}
                  </div>
                  <div className="text-base font-bold text-rose-400 font-mono mt-0.5">₹{currentPlan.stopLoss}</div>
                  <span className="text-[10px] text-rose-300/70">Risk: ₹{currentPlan.riskPerShare} ({currentPlan.riskPct}%)</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                  <span className="text-[11px] text-emerald-300 uppercase font-semibold">Target 1 (1:{t1Multiplier})</span>
                  <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">₹{currentPlan.target1}</div>
                  <span className="text-[10px] text-emerald-300/70">Profit: +₹{currentPlan.potentialProfitT1.toLocaleString('en-IN')}</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                  <span className="text-[11px] text-emerald-300 uppercase font-semibold">Target 2 (1:{t2Multiplier})</span>
                  <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">₹{currentPlan.target2}</div>
                  <span className="text-[10px] text-emerald-300/70">Profit: +₹{currentPlan.potentialProfitT2.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Algorithmic SL Rationale Banner */}
              {currentPlan.slReasoning && (
                <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 flex items-start gap-2">
                  <span className="text-blue-400 font-bold shrink-0">ⓘ SL Rationale:</span>
                  <span className="text-gray-300 leading-relaxed">{currentPlan.slReasoning}</span>
                </div>
              )}

              {/* Sizing & Capital Recommendations */}
              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-300 border-b border-gray-800 pb-2">
                  <span>Calculated Position Sizing</span>
                  <span className="text-blue-400">Actual Risk: ₹{currentPlan.actualRiskAmount.toLocaleString('en-IN')} / ₹{riskAmount.toLocaleString('en-IN')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* F&O Lots */}
                  <div className="p-3 rounded-lg bg-gray-950 border border-gray-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-300">F&O Futures Sizing:</span>
                      <span className="font-bold text-white font-mono">
                        {currentPlan.recommendedLots} Lots ({currentPlan.fnoShares} shares)
                      </span>
                    </div>
                    <div className="text-gray-400 text-[11px] flex justify-between">
                      <span>Approx Margin (~20%):</span>
                      <span className="text-gray-200 font-mono">₹{currentPlan.totalMarginNeeded.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-gray-400 text-[11px] flex justify-between">
                      <span>Contract Value:</span>
                      <span className="text-gray-200 font-mono">₹{(currentPlan.oneLotValue * Math.max(1, currentPlan.recommendedLots)).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Cash Market Shares */}
                  <div className="p-3 rounded-lg bg-gray-950 border border-gray-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-300">Cash Equity Sizing:</span>
                      <span className="font-bold text-white font-mono">
                        {currentPlan.recommendedShares} Shares
                      </span>
                    </div>
                    <div className="text-gray-400 text-[11px] flex justify-between">
                      <span>Total Cash Capital:</span>
                      <span className="text-gray-200 font-mono">₹{currentPlan.cashCapitalNeeded.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-gray-400 text-[11px] flex justify-between">
                      <span>Exact Risk Budget Fit:</span>
                      <span className="text-emerald-400 font-mono">100% Sized</span>
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {currentPlan.warnings?.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {currentPlan.warnings.map((warn, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-300 bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/30">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {statusMessage && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Trade Basket (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-card rounded-2xl p-5 border border-gray-800 shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-purple-400" />
                <h2 className="text-base font-bold text-white">Trade Basket Planner</h2>
              </div>
              <div className="flex items-center gap-2">
                {basket.length > 0 && (
                  <>
                    <button
                      onClick={handleExportCSV}
                      title="Export planned basket to CSV"
                      className="p-1.5 text-xs text-gray-300 hover:text-white glass-card rounded-lg border border-gray-700 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleClearBasket}
                      title="Clear basket"
                      className="p-1.5 text-xs text-rose-400 hover:text-rose-300 glass-card rounded-lg border border-rose-900/40 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Basket Portfolio Risk Summary */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Allocated Margin</span>
                <div className="text-sm font-bold text-white font-mono mt-0.5">
                  ₹{totalMarginAllocated.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-gray-500">
                  {capital > 0 ? `${((totalMarginAllocated / capital) * 100).toFixed(0)}% of Capital` : ''}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Total Portfolio Risk</span>
                <div className="text-sm font-bold text-rose-400 font-mono mt-0.5">
                  ₹{totalPortfolioRisk.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-gray-400">
                  {portfolioRiskPct}% of account
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Target 1 Upside</span>
                <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                  +₹{totalProfitT1.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-emerald-500/70">Potential gain</span>
              </div>

              <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Target 2 Upside</span>
                <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                  +₹{totalProfitT2.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-emerald-500/70">Full runner gain</span>
              </div>
            </div>

            {/* Basket Items List */}
            <div className="flex-1 overflow-y-auto max-h-[480px] space-y-2.5 pr-1">
              {basket.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs border border-dashed border-gray-800 rounded-xl p-6">
                  <Briefcase className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  Your basket is empty. Configure a trade setup on the left and click "Add to Basket" to plan your portfolio allocations.
                </div>
              ) : (
                basket.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-[#0a0d14] border border-gray-800 hover:border-gray-700 transition space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono text-sm">{t.symbol}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          t.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {t.direction}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {t.isFno ? `${t.lots} Lots` : `${t.shares} Shrs`}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveFromBasket(t.id)}
                        className="text-gray-500 hover:text-rose-400 transition cursor-pointer p-1"
                        title="Remove setup"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-[11px] font-mono text-gray-300 bg-gray-950 p-2 rounded-lg">
                      <div>
                        <span className="text-[9px] text-gray-500 block">ENTRY</span>
                        ₹{t.entryPrice}
                      </div>
                      <div>
                        <span className="text-[9px] text-rose-400 block">SL</span>
                        ₹{t.stopLoss}
                      </div>
                      <div>
                        <span className="text-[9px] text-emerald-400 block">T1</span>
                        ₹{t.target1}
                      </div>
                      <div>
                        <span className="text-[9px] text-emerald-400 block">T2</span>
                        ₹{t.target2}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-900">
                      <span>Margin: <strong className="text-gray-200 font-mono">₹{t.marginRequired?.toLocaleString('en-IN')}</strong></span>
                      <span>Risk: <strong className="text-rose-400 font-mono">₹{t.actualRisk?.toLocaleString('en-IN')}</strong></span>
                      <span>T1 Gain: <strong className="text-emerald-400 font-mono">+₹{t.potentialProfitT1?.toLocaleString('en-IN')}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* CSV Export Button */}
            {basket.length > 0 && (
              <div className="pt-4 border-t border-gray-800 mt-auto">
                <button
                  onClick={handleExportCSV}
                  className="w-full py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer border border-gray-700"
                >
                  <Download className="w-4 h-4 text-gray-400" />
                  <span>Download Basket CSV for Terminal Entry</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 border border-gray-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                Risk Engine Default Settings
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Default Account Capital (₹)</label>
                <input
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Default Risk Budget per Trade (₹)</label>
                <input
                  type="number"
                  value={riskAmount}
                  onChange={(e) => setRiskAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Default Stop Loss Strategy</label>
                <select
                  value={slMethod}
                  onChange={(e) => setSlMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="VWAP">VWAP Buffer (0.3% beyond VWAP)</option>
                  <option value="ORB">ORB Extremes (High/Low)</option>
                  <option value="ATR">ATR / Volatility Buffer (1.2%)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setCapital(100000);
                  setRiskAmount(2000);
                  setSlMethod('VWAP');
                  setT1Multiplier(1.5);
                  setT2Multiplier(2.0);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white text-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onSaveSettings) {
                    onSaveSettings({
                      defaultCapital: capital,
                      defaultRiskAmount: riskAmount
                    });
                  }
                  setShowSettingsModal(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
              >
                Apply & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
