import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

const FilterSettings = ({ onClose }) => {
  const [config, setConfig] = useState({
    MIN_PCT_CHANGE: 0.5,
    MAX_PCT_CHANGE: 20.0,
    MIN_OI_CHANGE_PCT: 5.0,
    MAX_OI_CHANGE_PCT: 500.0,
    REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS: true,
    REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/config`)
      .then(res => res.json())
      .then(data => {
        setConfig(data);
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
        onClose();
      } else {
        alert('Failed to save settings');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-brand-card p-6 rounded-xl border border-gray-800">
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-brand-card w-full max-w-md rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900/50">
          <h2 className="text-lg font-bold">Scanner Filters</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
          
          {/* Price Change Settings */}
          <div>
            <h3 className="text-sm font-semibold text-brand-green mb-3 uppercase tracking-wider">Price Momentum</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Min % Change</label>
                <div className="relative">
                  <input 
                    type="number" step="0.1" name="MIN_PCT_CHANGE" 
                    value={config.MIN_PCT_CHANGE} onChange={handleChange}
                    className="w-full bg-black border border-gray-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-brand-green"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Max % Change</label>
                <div className="relative">
                  <input 
                    type="number" step="0.1" name="MAX_PCT_CHANGE" 
                    value={config.MAX_PCT_CHANGE} onChange={handleChange}
                    className="w-full bg-black border border-gray-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-brand-green"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 text-sm">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Open Interest Settings */}
          <div>
            <h3 className="text-sm font-semibold text-blue-400 mb-3 uppercase tracking-wider">Open Interest (OI)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Min OI Change</label>
                <div className="relative">
                  <input 
                    type="number" step="0.5" name="MIN_OI_CHANGE_PCT" 
                    value={config.MIN_OI_CHANGE_PCT} onChange={handleChange}
                    className="w-full bg-black border border-gray-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Max OI Change</label>
                <div className="relative">
                  <input 
                    type="number" step="10" name="MAX_OI_CHANGE_PCT" 
                    value={config.MAX_OI_CHANGE_PCT} onChange={handleChange}
                    className="w-full bg-black border border-gray-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 text-sm">%</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Only applies if the instrument is an F&O Future.</p>
          </div>

          {/* PDH / PDL Settings */}
          <div>
            <h3 className="text-sm font-semibold text-purple-400 mb-3 uppercase tracking-wider">Technical Rules</h3>
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-0.5">
                  <input 
                    type="checkbox" name="REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS" 
                    checked={config.REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS} onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-gray-200 font-medium">Require Open &gt; PDH</span>
                  <span className="text-xs text-gray-500">Stock must gap up above Previous Day High to be a top gainer.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-0.5">
                  <input 
                    type="checkbox" name="REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS" 
                    checked={config.REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS} onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-gray-200 font-medium">Require Open &lt; PDL</span>
                  <span className="text-xs text-gray-500">Stock must gap down below Previous Day Low to be a top loser.</span>
                </div>
              </label>
            </div>
          </div>
          
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white mr-3 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-brand-green hover:bg-green-500 text-black font-bold rounded-md flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Apply Filters'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterSettings;
