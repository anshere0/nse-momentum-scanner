import React, { useState, useEffect } from 'react';
import { 
  Activity, SlidersHorizontal, ArrowLeft, Shield, BarChart3, TrendingUp, Zap, HelpCircle, AlertCircle
} from 'lucide-react';
import ProOverviewCard from './ProOverviewCard';
import QuadrantCard from './QuadrantCard';
import VwapCard from './VwapCard';
import OrbCard from './OrbCard';
import RvolCard from './RvolCard';
import SectorCard from './SectorCard';
import RiskPlannerCard from './RiskPlannerCard';
import DerivativesCard from './DerivativesCard';
import TradingViewChart from './TradingViewChart';
import ChartModal from './ChartModal';

// React Error Boundary for isolated component safety
class FeatureErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error(`Error in feature module [${this.props.featureName}]:`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card rounded-xl p-6 border border-rose-500/40 text-center text-sm text-gray-300">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h3 className="font-bold text-white text-base mb-1">{this.props.featureName} Temporarily Unavailable</h3>
          <p className="text-gray-400 text-xs mb-4">
            An error occurred while calculating this quantitative module. Other features remain unaffected.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold cursor-pointer"
          >
            Retry Loading Module
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ProLayout({ onNavigateSimple }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'quadrant' | 'vwap' | 'orb' | 'rvol' | 'sector' | 'risk' | 'derivatives' | 'charts'
  const [settings, setSettings] = useState({});
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [chartModalStock, setChartModalStock] = useState(null);

  // Fetch settings from server
  useEffect(() => {
    fetch('/api/pro/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => {});
  }, []);

  const handleSaveSettings = async (updated) => {
    try {
      const merged = { ...settings, ...updated };
      setSettings(merged);
      await fetch('/api/pro/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      });
    } catch (err) {
      console.error('Failed to save settings', err);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* Top Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-blue-400 font-extrabold">PRO</span>
              <span>Quantitative Momentum Suite</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              F&O Analytics & Risk Engine
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Institutional 4-Quadrant OI analysis, VWAP Sweet-Spots, 15m ORB Breakouts, R-Vol shockers, Sector Tailwind, Risk Planning, Derivatives Edge & Interactive Charts.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateSimple}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold transition cursor-pointer border border-gray-700"
          >
            <ArrowLeft className="w-4 h-4 text-gray-400" />
            <span>Cash Market Screener (/simple)</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 pb-4 mb-6">
        {[
          { id: 'overview', label: '📊 Suite Overview', desc: 'Summary & Top Picks' },
          { id: 'quadrant', label: '1. F&O 4-Quadrant', desc: 'OI vs Price Acc' },
          { id: 'vwap', label: '2. VWAP Filter', desc: 'Sweet Spot Entries' },
          { id: 'orb', label: '3. Opening Range (ORB)', desc: '15m/30m Breakouts' },
          { id: 'rvol', label: '4. Relative Volume', desc: 'Volume Shockers' },
          { id: 'sector', label: '5. Sector & RS', desc: 'Tailwind & Leaders' },
          { id: 'risk', label: '6. Risk & Basket', desc: 'Sizing & Trade Planner' },
          { id: 'derivatives', label: '7. Derivatives Edge', desc: 'PCR & OI Walls' },
          { id: 'charts', label: '8. Interactive Charts', desc: 'Candlesticks & Overlays' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === t.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400'
                : 'glass-card text-gray-300 hover:bg-gray-800 border-gray-800'
            }`}
          >
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Feature Content with Error Boundaries */}
      <main>
        {activeTab === 'overview' && (
          <FeatureErrorBoundary featureName="Suite Overview">
            <ProOverviewCard 
              onSelectTab={(tabId) => setActiveTab(tabId)} 
              onOpenChart={(sym) => setChartModalStock(sym)}
            />
          </FeatureErrorBoundary>
        )}

        {activeTab === 'quadrant' && (
          <FeatureErrorBoundary featureName="F&O 4-Quadrant Interpretation">
            <QuadrantCard
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onOpenChart={(sym) => setChartModalStock(sym)}
            />
          </FeatureErrorBoundary>
        )}

        {activeTab === 'vwap' && (
          <FeatureErrorBoundary featureName="Intraday VWAP Distance Filter">
            <VwapCard
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onOpenChart={(sym) => setChartModalStock(sym)}
            />
          </FeatureErrorBoundary>
        )}

        {activeTab === 'orb' && (
          <FeatureErrorBoundary featureName="Opening Range Breakout (ORB)">
            <OrbCard
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onOpenChart={(sym) => setChartModalStock(sym)}
            />
          </FeatureErrorBoundary>
        )}

        {activeTab === 'rvol' && (
          <FeatureErrorBoundary featureName="Relative Volume (R-Vol)">
            <RvolCard
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onOpenChart={(sym) => setChartModalStock(sym)}
            />
          </FeatureErrorBoundary>
        )}

        {activeTab === 'sector' && (
          <FeatureErrorBoundary featureName="Sector Tailwind & Relative Strength">
            <SectorCard
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onOpenChart={(sym) => setChartModalStock(sym)}
            />
          </FeatureErrorBoundary>
        )}

        {activeTab === 'risk' && (
          <FeatureErrorBoundary featureName="Risk Management & Basket Planner">
            <RiskPlannerCard
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onOpenChart={(sym) => setChartModalStock(sym)}
            />
          </FeatureErrorBoundary>
        )}

        {activeTab === 'derivatives' && (
          <FeatureErrorBoundary featureName="Derivatives Edge (PCR & OI Walls)">
            <DerivativesCard
              onOpenChart={(sym) => setChartModalStock(sym)}
            />
          </FeatureErrorBoundary>
        )}

        {activeTab === 'charts' && (
          <FeatureErrorBoundary featureName="Interactive Candlestick Charts">
            <div className="space-y-4">
              <TradingViewChart
                symbol="RELIANCE"
                initialResolution="5m"
                standalone={true}
              />
            </div>
          </FeatureErrorBoundary>
        )}
      </main>

      {/* Global Quick Chart Modal */}
      <ChartModal
        isOpen={Boolean(chartModalStock)}
        symbol={chartModalStock}
        onClose={() => setChartModalStock(null)}
      />

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-gray-500 border-t border-gray-900 pt-5 space-y-1">
        <p>
          Educational quantitative suite. Signals and confidence ratings are algorithmically generated and do not constitute financial advice.
        </p>
        <p>Market data refreshes automatically every 10–15 seconds during NSE trading hours.</p>
      </footer>
    </div>
  );
}
