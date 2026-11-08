import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, ChevronRight, X } from 'lucide-react';

export default function ConfidenceBadge({ score = 50, grade = 'MODERATE', data = {} }) {
  const [showDetail, setShowDetail] = useState(false);

  let badgeColor = 'bg-gray-800 text-gray-300 border-gray-700';
  let dotColor = 'bg-gray-400';

  if (score >= 80) {
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20';
    dotColor = 'bg-emerald-400 animate-pulse';
  } else if (score >= 65) {
    badgeColor = 'bg-teal-500/20 text-teal-300 border-teal-500/50';
    dotColor = 'bg-teal-400';
  } else if (score >= 45) {
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/50';
    dotColor = 'bg-amber-400';
  } else {
    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/50';
    dotColor = 'bg-rose-400';
  }

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition hover:scale-105 cursor-pointer select-none ${badgeColor}`}
        title="Click to view quantitative confidence reasoning & breakdown"
      >
        <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
        <span>{score}% {grade}</span>
      </button>

      {/* Detail Dialog */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in text-left">
          <div className="bg-[#121622] border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden font-sans">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between bg-[#0e121b]">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Confidence Breakdown</h3>
                  <p className="text-xs text-gray-400">Institutional confluence & multi-factor accuracy</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs sm:text-sm text-gray-200">
              {/* Score Meter */}
              <div className="p-3.5 bg-[#0a0d14] rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-semibold">Overall Confidence Score:</span>
                  <span className="text-base font-bold text-white font-mono">{score} / 100 ({grade})</span>
                </div>
                <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      score >= 80 ? 'bg-emerald-400' : score >= 65 ? 'bg-teal-400' : score >= 45 ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                    style={{ width: `${score}%` }}
                  ></div>
                </div>
              </div>

              {/* Reasoning */}
              {data.reasoning && (
                <div className="p-3.5 bg-blue-950/20 border border-blue-500/30 rounded-xl">
                  <div className="text-xs font-bold text-blue-300 uppercase tracking-wide mb-1">
                    🧠 Quantitative Reasoning:
                  </div>
                  <p className="text-gray-200 text-xs sm:text-sm leading-relaxed">
                    {data.reasoning}
                  </p>
                </div>
              )}

              {/* Factors Checklist */}
              {Array.isArray(data.factors) && data.factors.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Confluence Factors:
                  </div>
                  <div className="divide-y divide-gray-800/80 rounded-lg border border-gray-800 bg-[#0a0d14] overflow-hidden">
                    {data.factors.map((f, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {f.status === 'STRONG' || f.status === 'GOOD' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : f.status === 'WARNING' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full bg-rose-500/40 text-rose-300 text-[10px] flex items-center justify-center font-bold">✕</span>
                          )}
                          <span className="text-gray-300">{f.name}</span>
                        </div>
                        <span className={`font-mono font-bold ${f.points.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {f.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-[#0a0d14] border-t border-gray-800 text-right">
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
