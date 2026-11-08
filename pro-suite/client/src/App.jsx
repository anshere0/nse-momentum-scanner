import React, { useState, useEffect } from 'react';
import SimpleTable from './components/simple/SimpleTable';
import ProLayout from './components/pro/ProLayout';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  // If path is /pro or starts with /pro, render ProLayout
  if (currentPath.startsWith('/pro')) {
    return <ProLayout onNavigateSimple={() => navigateTo('/simple')} />;
  }

  // Otherwise render Page 1 /simple
  return (
    <div>
      {/* Discreet top bar to switch to /pro if desired */}
      <div className="bg-[#121622] border-b border-gray-800/80 px-4 py-2 flex items-center justify-between text-xs">
        <span className="text-gray-400 font-mono">Port 3001 • Screener Suite</span>
        <button
          onClick={() => navigateTo('/pro')}
          className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer transition"
        >
          <span>Switch to PRO Suite (Features 1-3) →</span>
        </button>
      </div>
      <SimpleTable />
    </div>
  );
}
