import React from 'react';
import { useSpacegridState } from '../context/SpacegridContext';
import { Check, X, ShieldCheck, ShieldAlert, Sparkles, Scale } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

const LOAD_COLORS = {
  life_support: { bg: '#22C55E', label: 'Life Support' },
  habitat: { bg: '#38BDF8', label: 'Habitat' },
  comms: { bg: '#818CF8', label: 'Comms' },
  science: { bg: '#FFC857', label: 'Science' },
  rover: { bg: '#94A3B8', label: 'Rover' },
};

export const PolicyComparison = () => {
  const { state } = useSpacegridState();

  const comparison = state?.comparison || [];
  const totalBaseDemand = Number(state?.power?.demand_kw || 8.0);

  return (
    <section
      aria-label="Policy Comparison"
      className="mission-card p-4 sm:p-5 mb-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-bold text-sm tracking-wide text-text uppercase">
              Heuristic & Policy Benchmark Comparison
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-raised text-text-muted border border-border">
              3 STRATEGIES BENCHMARKED
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Cross-policy allocation evaluation under identical solar array deficit conditions.
          </p>
        </div>

        {/* Mini Legend for Load Colors in Stacked Bar */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
          {Object.entries(LOAD_COLORS).map(([key, item]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.bg }} />
              <span>{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-danger/50 border border-danger" />
            <span className="text-danger font-medium">Unmet</span>
          </div>
        </div>
      </div>

      {/* Comparison Rows */}
      <div className="space-y-3.5">
        {comparison.map((item) => {
          const isSpacegrid = item.policy === 'spacegrid';
          const allocations = item.allocations || {};
          const unmetKw = Number(item.unmet_kw || 0);

          // Calculate total allocated
          const totalAllocated = Object.values(allocations).reduce((acc, val) => acc + Number(val || 0), 0);
          const totalScale = Math.max(totalBaseDemand, totalAllocated + unmetKw, 8.0);

          return (
            <div
              key={item.policy}
              className={`p-3 rounded-xl border transition-all ${
                isSpacegrid
                  ? 'bg-sky-950/20 border-demand/40 shadow-glow'
                  : 'bg-bg-raised/50 border-border/70 hover:bg-bg-raised/70'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-2">
                {/* Policy Label & Spacegrid Tag */}
                <div className="flex items-center gap-2">
                  {isSpacegrid && (
                    <span className="w-2 h-2 rounded-full bg-demand animate-pulse" />
                  )}
                  <span className={`text-xs font-heading font-semibold ${isSpacegrid ? 'text-demand font-bold text-sm' : 'text-text'}`}>
                    {item.label}
                  </span>
                  {isSpacegrid && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-demand/20 text-demand border border-demand/40 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      RECOMMENDED PLAN
                    </span>
                  )}
                </div>

                {/* Right Metrics: Life Support Safety + Total Unmet kW */}
                <div className="flex items-center gap-4 text-xs">
                  {/* Life Support Check / Cross */}
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="telemetry-caption text-[10px]">LIFE SUPPORT:</span>
                    {item.life_support_ok ? (
                      <span className="inline-flex items-center gap-1 text-ok font-semibold">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Powered</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-danger font-semibold">
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Compromised</span>
                      </span>
                    )}
                  </div>

                  {/* Total Unmet kW */}
                  <div className="flex items-center gap-1.5 font-mono-numbers">
                    <span className="telemetry-caption text-[10px]">UNMET:</span>
                    <span className={`font-bold ${unmetKw > 0 ? 'text-danger' : 'text-ok'}`}>
                      <AnimatedNumber value={unmetKw} decimals={1} suffix=" kW" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Horizontal Stacked Allocation Bar */}
              <div className="w-full h-3 rounded-md bg-slate-900 border border-border/60 overflow-hidden flex">
                {/* Segments for each load */}
                {Object.entries(allocations).map(([loadId, kw]) => {
                  const val = Number(kw || 0);
                  if (val <= 0) return null;
                  const widthPercent = (val / totalScale) * 100;
                  const colorConfig = LOAD_COLORS[loadId] || { bg: '#8B98B0', label: loadId };

                  return (
                    <div
                      key={loadId}
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: colorConfig.bg,
                      }}
                      title={`${colorConfig.label}: ${val.toFixed(1)} kW`}
                      className="h-full border-r border-slate-950/40 transition-all duration-700 ease-out hover:opacity-90"
                    />
                  );
                })}

                {/* Deficit / Unmet segment */}
                {unmetKw > 0 && (
                  <div
                    style={{
                      width: `${(unmetKw / totalScale) * 100}%`,
                    }}
                    title={`Unmet Power Deficit: ${unmetKw.toFixed(1)} kW`}
                    className="h-full bg-danger/40 border-r border-slate-950/40 relative overflow-hidden"
                  >
                    <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(239,68,68,0.4)_4px,rgba(239,68,68,0.4)_8px)]" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
