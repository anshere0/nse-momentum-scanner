import React, { useState, useEffect } from 'react';
import { X, Key, Shield, RefreshCw, LogOut, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

const ConnectBrokerModal = ({ onClose, onConnected }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Optional custom form credentials
  const [apiKey, setApiKey] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [pin, setPin] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      setErrorMsg('Failed to check broker connection status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = async (useEnv = true) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = useEnv ? {} : { apiKey, clientCode, pin, totpSecret };

    try {
      const res = await fetch(`${API_URL}/admin/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'Successfully connected to Angel One SmartAPI');
        await fetchStatus();
        if (onConnected) onConnected();
      } else {
        setErrorMsg(data.error || 'Connection failed');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error communicating with server');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReconnect = async () => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`${API_URL}/admin/reconnect`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Session reconnected');
        await fetchStatus();
      } else {
        setErrorMsg(data.error || 'Reconnect failed');
      }
    } catch (err) {
      setErrorMsg('Error reconnecting');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`${API_URL}/admin/logout`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Logged out and tokens cleared');
        await fetchStatus();
      }
    } catch (err) {
      setErrorMsg('Error logging out');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#131722] border border-[#2a2e39] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[#2a2e39] bg-[#171b26]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Angel One SmartAPI</h2>
              <p className="text-xs text-gray-400">Market Data & Broker Connection</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
              <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current Status Box */}
          <div className="bg-[#0a0d14] border border-[#2a2e39] rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Current Session:</span>
              {status?.hasToken ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active Token
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-700/30 text-gray-400 border border-gray-600/30">
                  Not Connected
                </span>
              )}
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Client Code:</span>
              <span className="font-mono text-gray-200">{status?.clientCode || (status?.credentialsConfigured ? 'Configured in .env' : 'Not configured')}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Token Expiry:</span>
              <span className="font-mono text-gray-300">
                {status?.tokenExpires ? new Date(status.tokenExpires).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'None'}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Market Status:</span>
              <span className="font-mono text-gray-300">
                {status?.market?.sessionType || 'Unknown'} {status?.market?.isMarketOpen ? '(Open)' : '(Closed)'}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <button
              onClick={() => handleConnect(true)}
              disabled={actionLoading}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} className={actionLoading ? 'animate-spin' : ''} />
              {status?.hasToken ? 'Refresh / Re-authenticate Session' : 'Connect with Server Credentials'}
            </button>

            {status?.hasToken && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleReconnect}
                  disabled={actionLoading}
                  className="py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} /> Reconnect Feeds
                </button>
                <button
                  onClick={handleLogout}
                  disabled={actionLoading}
                  className="py-2 px-3 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold rounded-xl border border-rose-800/40 flex items-center justify-center gap-2"
                >
                  <LogOut size={14} /> Disconnect & Logout
                </button>
              </div>
            )}
          </div>

          {/* Custom Credentials Toggle */}
          <div>
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-purple-400 hover:text-purple-300 underline font-medium"
            >
              {showAdvanced ? 'Hide manual credentials form' : 'Enter credentials manually (override server .env)'}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 bg-[#0a0d14] rounded-xl border border-[#2a2e39] space-y-3">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">SmartAPI Key</label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="e.g. your_api_key"
                    className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Angel One Client Code</label>
                  <input
                    type="text"
                    value={clientCode}
                    onChange={(e) => setClientCode(e.target.value)}
                    placeholder="e.g. A123456"
                    className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">PIN / Password</label>
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="4-digit PIN"
                      className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">TOTP Secret</label>
                    <input
                      type="password"
                      value={totpSecret}
                      onChange={(e) => setTotpSecret(e.target.value)}
                      placeholder="Authenticator Secret"
                      className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleConnect(false)}
                  disabled={actionLoading || !apiKey || !clientCode || !pin || !totpSecret}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all"
                >
                  Connect with Entered Credentials
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2a2e39] bg-[#171b26] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectBrokerModal;
