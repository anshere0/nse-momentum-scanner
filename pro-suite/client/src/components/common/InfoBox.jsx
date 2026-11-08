import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Lightbulb, Calculator, Target } from 'lucide-react';

export default function InfoBox({ title, what, calculation, example, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="glass-card rounded-xl border border-blue-500/20 bg-blue-950/10 mb-5 overflow-hidden transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left hover:bg-blue-900/10 transition cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-blue-300 text-sm sm:text-base">
            ⓘ What is this? — {title}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-blue-400">
          <span>{isOpen ? 'Hide Guide' : 'Explain Indicator'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-1 sm:p-5 sm:pt-2 border-t border-blue-900/30 space-y-3.5 text-xs sm:text-sm text-gray-300">
          {/* What it is */}
          <div className="flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">What it shows: </strong>
              <span>{what}</span>
            </div>
          </div>

          {/* How it is calculated */}
          {calculation && (
            <div className="flex items-start gap-2.5">
              <Calculator className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">How it is calculated: </strong>
                <code className="text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded font-mono text-xs">
                  {calculation}
                </code>
              </div>
            </div>
          )}

          {/* Real-world example */}
          {example && (
            <div className="flex items-start gap-2.5 bg-blue-900/20 p-3 rounded-lg border border-blue-800/40">
              <Target className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-cyan-300">One-line Trade Example: </strong>
                <span className="text-gray-200">{example}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
