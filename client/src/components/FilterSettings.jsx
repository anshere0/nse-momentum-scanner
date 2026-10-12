import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Sliders, DollarSign, BarChart2, Clock, ShieldCheck, Activity, Layers } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

const FilterSettings = ({ onClose, onSaved }) => {
  const [config, setConfig] = useState({
    // Market Segment
    marketSegment: 'BOTH',

    // Scan Controls
    scanEnabled: true,
    scanStartTime: '09:00',
    scanEndTime: '15:30',
    timeFilterEnabled: true,

    // Price Change
    priceChangeEnabled: true,
    MIN_PCT_CHANGE: 0.5,
    MAX_PCT_CHANGE: 20.0,

    // Previous Day High/Low
    prevDayHighEnabled: false,
    prevDayLowEnabled: false,
    REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS: true,
    REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS: true,

    // Previous Month High/Low
    prevMonthHighEnabled: false,
    prevMonthLowEnabled: false,

    // Market Cap
    marketCapEnabled: false,
    minMarketCap: 0,
    maxMarketCap: 100000,
    marketCapUnit: 'crore',

    // OI Filter (Critical)
    oiFilterEnabled: true,
    MIN_OI_CHANGE_PCT: 5.0,
    MAX_OI_CHANGE_PCT: 500.0,
    oiPositiveOnly: false,
    oiNegativeOnly: false,
    minAbsoluteOI: 0,
    maxAbsoluteOI: 100000000,

    // Volume
    volumeFilterEnabled: false,
    minVolume: 50000,

    // LTP
    ltpFilterEnabled: false,
    minLtp: 20,
    maxLtp: 50000,

    // Advance/Decline
    advDeclineEnabled: false,
    minAdvancing: 0,
    minDeclining: 0,
    advDeclineRatioThreshold: 1.0,

    // Sentiment thresholds
    sentimentEnabled: true,
    sentimentPositiveThreshold: 10,
    sentimentNegativeThreshold: -10,
    sentimentMinCoverage: 50
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('technical'); // 'technical', 'oi', 'segment', 'advanced'

  useEffect(() => {
    fetch(`${API_URL}/api/config`)
      .then(res => res.json())
      .then(data => {
        setConfig(prev => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch config', err);
        setLoading(false);
      });
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        if (onSaved) onSaved();
        onClose();
      } else {
        alert('Failed to save settings');
      }
    } catch (err) {
      alert('Error connecting to server');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all scanner filters to default values?')) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/config/reset`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch (err) {
      alert('Error resetting config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#131722] p-6 rounded-xl border border-[#2a2e39] text-gray-200">
          Loading scanner configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#131722] border border-[#2a2e39] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[#2a2e39] bg-[#171b26]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Scanner Configuration</h2>
              <p className="text-xs text-gray-400">Custom quantitative filters & market parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#2a2e39] bg-[#0a0d14] px-4 text-xs font-semibold">
          {[
            { id: 'technical', label: 'Technical & PDH/PMH', icon: Activity },
            { id: 'oi', label: 'Open Interest (OI)', icon: BarChart2 },
            { id: 'segment', label: 'Segment & Time', icon: Layers },
            { id: 'advanced', label: 'Market Cap & Sentiment', icon: ShieldCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3.5 flex items-center gap-2 border-b-2 transition-colors ${
                  active ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: TECHNICAL & PDH/PMH */}
          {activeTab === 'technical' && (
            <div className="space-y-5">
              {/* Price Momentum */}
              <div className="bg-[#0a0d14] p-4 rounded-xl border border-[#2a2e39]">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Price Momentum (% Change)</h3>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
                    <input
                      type="checkbox"
                      name="priceChangeEnabled"
                      checked={config.priceChangeEnabled}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-purple-500 focus:ring-0"
                    />
                    Enable Filter
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Min % Change</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        name="MIN_PCT_CHANGE"
                        value={config.MIN_PCT_CHANGE}
                        onChange={handleChange}
                        className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                      <span className="absolute right-3 top-2 text-gray-500 text-xs">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Max % Change</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        name="MAX_PCT_CHANGE"
                        value={config.MAX_PCT_CHANGE}
                        onChange={handleChange}
                        className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                      <span className="absolute right-3 top-2 text-gray-500 text-xs">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Previous Day High / Low */}
              <div className="bg-[#0a0d14] p-4 rounded-xl border border-[#2a2e39] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">Previous Day High / Low (PDH / PDL)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      name="prevDayHighEnabled"
                      checked={config.prevDayHighEnabled}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-purple-500"
                    />
                    Price &gt; Previous Day High (PDH)
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      name="prevDayLowEnabled"
                      checked={config.prevDayLowEnabled}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-purple-500"
                    />
                    Price &lt; Previous Day Low (PDL)
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      name="REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS"
                      checked={config.REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-purple-500"
                    />
                    Require Open &gt; PDH for Gainers
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      name="REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS"
                      checked={config.REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-purple-500"
                    />
                    Require Open &lt; PDL for Losers
                  </label>
                </div>
              </div>

              {/* Previous Month High / Low */}
              <div className="bg-[#0a0d14] p-4 rounded-xl border border-[#2a2e39] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">Previous Month High / Low (PMH / PML)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      name="prevMonthHighEnabled"
                      checked={config.prevMonthHighEnabled}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-purple-500"
                    />
                    Price &gt; Previous Month High (PMH)
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      name="prevMonthLowEnabled"
                      checked={config.prevMonthLowEnabled}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-purple-500"
                    />
                    Price &lt; Previous Month Low (PML)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OPEN INTEREST (OI) */}
          {activeTab === 'oi' && (
            <div className="space-y-5">
              <div className="bg-[#0a0d14] p-4 rounded-xl border border-[#2a2e39] space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">Open Interest Change %</h3>
                    <p className="text-[11px] text-gray-400">Applies to F&O contracts with valid derivatives data</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
                    <input
                      type="checkbox"
                      name="oiFilterEnabled"
                      checked={config.oiFilterEnabled}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-purple-500"
                    />
                    Enable OI Filter
                  </label>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1.5">Quick Presets for Min OI Change:</label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, MIN_OI_CHANGE_PCT: preset, oiFilterEnabled: true }))}
                        className={`px-3 py-1 text-xs rounded-lg border font-mono transition-colors ${
                          config.MIN_OI_CHANGE_PCT === preset
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                            : 'bg-[#131722] text-gray-400 border-[#2a2e39] hover:text-white'
                        }`}
                      >
                        +{preset}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editable Inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Min OI Change %</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        name="MIN_OI_CHANGE_PCT"
                        value={config.MIN_OI_CHANGE_PCT}
                        onChange={handleChange}
                        className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <span className="absolute right-3 top-2 text-gray-500 text-xs">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Max OI Change %</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="5"
                        name="MAX_OI_CHANGE_PCT"
                        value={config.MAX_OI_CHANGE_PCT}
                        onChange={handleChange}
                        className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <span className="absolute right-3 top-2 text-gray-500 text-xs">%</span>
                    </div>
                  </div>
                </div>

                {/* Direction Toggles */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      name="oiPositiveOnly"
                      checked={config.oiPositiveOnly}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-sky-500"
                    />
                    Positive OI Change Only
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      name="oiNegativeOnly"
                      checked={config.oiNegativeOnly}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-sky-500"
                    />
                    Negative OI Change (Unwinding)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SEGMENT & TIME */}
          {activeTab === 'segment' && (
            <div className="space-y-5">
              {/* Market Segment Selection */}
              <div className="bg-[#0a0d14] p-4 rounded-xl border border-[#2a2e39] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">Market Segment Universe</h3>
                <p className="text-[11px] text-gray-400">Choose which instruments are evaluated by the scanner</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'CASH', label: 'Cash Market Only' },
                    { id: 'FNO', label: 'F&O Market Only' },
                    { id: 'BOTH', label: 'Both Cash & F&O' }
                  ].map(seg => (
                    <label
                      key={seg.id}
                      className={`p-3 rounded-xl border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${
                        config.marketSegment === seg.id
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : 'bg-[#131722] border-[#2a2e39] text-gray-400 hover:text-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="marketSegment"
                        value={seg.id}
                        checked={config.marketSegment === seg.id}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      {seg.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Time Window Settings */}
              <div className="bg-[#0a0d14] p-4 rounded-xl border border-[#2a2e39] space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Scan Time Window (IST)</h3>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
                    <input
                      type="checkbox"
                      name="timeFilterEnabled"
                      checked={config.timeFilterEnabled}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-purple-500"
                    />
                    Enable Time Restriction
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Start Time (IST)</label>
                    <input
                      type="time"
                      name="scanStartTime"
                      value={config.scanStartTime}
                      onChange={handleChange}
                      className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">End Time (IST)</label>
                    <input
                      type="time"
                      name="scanEndTime"
                      value={config.scanEndTime}
                      onChange={handleChange}
                      className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">
                  Market regular session runs from 09:15 AM to 03:30 PM IST. Pre-open is 09:00 to 09:15 AM.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: ADVANCED (MARKET CAP, VOLUME, SENTIMENT) */}
          {activeTab === 'advanced' && (
            <div className="space-y-5">
              {/* Market Breadth & Sentiment Thresholds */}
              <div className="bg-[#0a0d14] p-4 rounded-xl border border-[#2a2e39] space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">Market Sentiment Rules</h3>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
                    <input
                      type="checkbox"
                      name="sentimentEnabled"
                      checked={config.sentimentEnabled}
                      onChange={handleChange}
                      className="rounded bg-gray-900 border-gray-700 text-purple-500"
                    />
                    Enable Sentiment
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Positive Threshold</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="sentimentPositiveThreshold"
                        value={config.sentimentPositiveThreshold}
                        onChange={handleChange}
                        className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                      <span className="absolute right-3 top-2 text-gray-500 text-xs">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Negative Threshold</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="sentimentNegativeThreshold"
                        value={config.sentimentNegativeThreshold}
                        onChange={handleChange}
                        className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                      <span className="absolute right-3 top-2 text-gray-500 text-xs">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Min Coverage</label>
                    <input
                      type="number"
                      name="sentimentMinCoverage"
                      value={config.sentimentMinCoverage}
                      onChange={handleChange}
                      className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Volume & LTP Filter */}
              <div className="bg-[#0a0d14] p-4 rounded-xl border border-[#2a2e39] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Volume & Price Limits</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                      <span>Min Traded Volume</span>
                      <input
                        type="checkbox"
                        name="volumeFilterEnabled"
                        checked={config.volumeFilterEnabled}
                        onChange={handleChange}
                        className="rounded bg-gray-900 border-gray-700 text-purple-500"
                      />
                    </label>
                    <input
                      type="number"
                      name="minVolume"
                      value={config.minVolume}
                      onChange={handleChange}
                      disabled={!config.volumeFilterEnabled}
                      className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                      <span>LTP Range (₹)</span>
                      <input
                        type="checkbox"
                        name="ltpFilterEnabled"
                        checked={config.ltpFilterEnabled}
                        onChange={handleChange}
                        className="rounded bg-gray-900 border-gray-700 text-purple-500"
                      />
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        name="minLtp"
                        value={config.minLtp}
                        onChange={handleChange}
                        disabled={!config.ltpFilterEnabled}
                        className="w-1/2 bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-40"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        name="maxLtp"
                        value={config.maxLtp}
                        onChange={handleChange}
                        disabled={!config.ltpFilterEnabled}
                        className="w-1/2 bg-[#131722] border border-[#2a2e39] rounded-lg py-2 px-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2a2e39] bg-[#171b26] flex justify-between items-center">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-700 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={14} />
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Applying...' : 'Apply & Save Filters'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterSettings;
