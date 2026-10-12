import React, { useState, useEffect } from 'react';
import { Sliders, ShieldCheck, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { StatusChip, PriorityBadge } from './StatusChip';

export const LoadAllocationHud = ({
  loads = [],
  mode = 'auto',
  onToggleMode,
  manual = null,
  availableKw = 12.0,
}) => {
  const isManual = mode === 'manual';

  const draft = manual?.draft || {};
  const isOverBudget = manual?.isOverBudget || false;
  const setLoadAllocation = manual?.setLoadAllocation;
  const autoFixWithRecommended = manual?.autoFixWithRecommended;
  const applyManualPlan = manual?.applyManualPlan;
  const confirmSwitchAuto = manual?.confirmSwitchAuto;

  // Hold-to-apply logic (~800ms)
  const [holdingApply, setHoldingApply] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);
  const [overrideSafety, setOverrideSafety] = useState(false);

  const isLifeSupportShort = isManual && Number(draft.life_support ?? 3.0) < 3.0 - 1e-4;

  useEffect(() => {
    let timer;
    if (holdingApply) {
      const startTime = performance.now();
      timer = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const p = Math.min(1, elapsed / 800);
        setApplyProgress(p);
        if (p >= 1) {
          clearInterval(timer);
          setHoldingApply(false);
          setApplyProgress(0);
          if (applyManualPlan) {
            applyManualPlan(overrideSafety);
          }
        }
      }, 30);
    } else {
      setApplyProgress(0);
    }
    return () => clearInterval(timer);
  }, [holdingApply, applyManualPlan, overrideSafety]);

  const totalAllocated = isManual
    ? Object.values(draft).reduce((s, v) => s + Number(v), 0)
    : loads.reduce((s, l) => s + Number(l.allocated_kw ?? l.allocated ?? 0), 0);

  const budgetPct = Math.min(100, (totalAllocated / availableKw) * 100);

  return (
    <div className="hud-panel hud-panel-blur p-4 flex flex-col justify-between h-full" id="optimization">
      {/* Panel Header & Mode Switch */}
      <div className="flex items-center justify-between border-b border-panel-border/40 pb-2">
        <h3 className="hud-title text-xs tracking-wider flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-cyan" />
          Load Allocation
        </h3>

        {/* Segmented Auto / Manual Control (Key M) */}
        <div className="flex items-center bg-[#030814]/80 p-0.5 rounded border border-panel-border text-xs font-mono">
          <button
            onClick={() => onToggleMode && onToggleMode('auto')}
            className={`px-3 py-1 rounded transition-all cursor-pointer font-exo font-bold tracking-wider uppercase text-[10px] ${
              !isManual
                ? 'bg-cyan text-space shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                : 'text-muted hover:text-text'
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => onToggleMode && onToggleMode('manual')}
            className={`px-3 py-1 rounded transition-all cursor-pointer font-exo font-bold tracking-wider uppercase text-[10px] flex items-center gap-1 ${
              isManual
                ? 'bg-gradient-to-r from-orange to-solar text-space font-bold shadow-[0_0_8px_rgba(255,176,32,0.5)]'
                : 'text-muted hover:text-text'
            }`}
          >
            <span>Manual</span>
            <kbd className="text-[9px] font-mono bg-black/40 text-text/80 px-1 py-0.2 rounded ml-0.5">M</kbd>
          </button>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="overflow-x-auto my-2">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-panel-border/30 text-[10px] font-exo uppercase tracking-wider text-muted">
              <th className="py-1.5 px-2">Pri</th>
              <th className="py-1.5 px-2">Subsystem</th>
              <th className="py-1.5 px-2">Status</th>
              {isManual ? (
                <>
                  <th className="py-1.5 px-2 text-right">Target</th>
                  <th className="py-1.5 px-2 text-right">Rec</th>
                </>
              ) : (
                <th className="py-1.5 px-2 text-right">Power</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border/15">
            {loads.map((load) => {
              const lid = load.id;
              const need = Number(load.need_kw ?? load.need ?? 1.0);
              const rec = Number(load.recommended_kw ?? load.recommended ?? need);
              const currentAlloc = isManual
                ? Number(draft[lid] ?? load.allocated_kw ?? rec)
                : Number(load.allocated_kw ?? load.allocated ?? rec);

              const status = isManual
                ? currentAlloc >= need - 1e-4
                  ? 'Protected'
                  : currentAlloc > 0
                  ? 'Reduced'
                  : lid === 'rover'
                  ? 'Postponed'
                  : 'Off'
                : load.status || 'Protected';

              return (
                <tr key={lid} className="hover:bg-cyan/5 transition-colors group">
                  <td className="py-2 px-2">
                    <PriorityBadge priority={load.priority} />
                  </td>
                  <td className="py-2 px-2 font-exo font-semibold text-text">
                    {load.name}
                  </td>
                  <td className="py-2 px-2">
                    <StatusChip status={status} />
                  </td>

                  {isManual ? (
                    <>
                      {/* Interactive Slider & Number Input in Manual Mode */}
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="range"
                            min="0"
                            max={need}
                            step="0.1"
                            value={currentAlloc}
                            onChange={(e) => setLoadAllocation && setLoadAllocation(lid, parseFloat(e.target.value))}
                            className="w-16 accent-solar cursor-pointer h-1.5 bg-space border border-panel-border rounded"
                          />
                          <input
                            type="number"
                            min="0"
                            max={need}
                            step="0.1"
                            value={currentAlloc.toFixed(1)}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(need, parseFloat(e.target.value) || 0));
                              setLoadAllocation && setLoadAllocation(lid, val);
                            }}
                            className="w-12 text-right font-orbitron text-xs bg-space/80 border border-panel-border px-1 py-0.5 rounded text-solar focus:border-cyan outline-none"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-[11px] text-muted">
                        {rec.toFixed(1)}
                      </td>
                    </>
                  ) : (
                    <td className="py-2 px-2 text-right">
                      <span className="font-orbitron font-bold text-text text-sm">
                        {currentAlloc.toFixed(1)} <span className="text-[10px] text-muted font-normal">kW</span>
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* POWER-BUS BUDGET BAR */}
      <div className="pt-2 border-t border-panel-border/30">
        <div className="flex items-center justify-between text-[11px] font-mono text-muted mb-1">
          <span>
            Power Bus: <strong className={isOverBudget ? 'text-danger' : 'text-text'}>{totalAllocated.toFixed(1)}</strong> / {availableKw.toFixed(1)} kW
          </span>
          <span className={isOverBudget ? 'text-danger font-bold animate-pulse' : 'text-cyan font-bold'}>
            {isOverBudget ? `OVER BUDGET by ${(totalAllocated - availableKw).toFixed(1)} kW` : `${(availableKw - totalAllocated).toFixed(1)} kW headroom`}
          </span>
        </div>
        <div className="relative w-full h-2.5 bg-space border border-panel-border rounded-xs overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out ${
              isOverBudget ? 'bg-danger shadow-[0_0_8px_#FF3B4E]' : 'bg-gradient-to-r from-cyan to-ok'
            }`}
            style={{ width: `${Math.min(100, budgetPct)}%` }}
          />
        </div>
      </div>

      {/* Manual Mode Action Buttons & Safety Override */}
      {isManual && (
        <div className="mt-3 pt-2 border-t border-panel-border/30 flex items-center justify-between gap-2 flex-wrap">
          {/* Life support safety override toggle if short */}
          {isLifeSupportShort && (
            <label className="flex items-center gap-1.5 text-[11px] font-mono text-danger cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overrideSafety}
                onChange={(e) => setOverrideSafety(e.target.checked)}
                className="accent-danger"
              />
              <span>Override Life Support Protocol</span>
            </label>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={autoFixWithRecommended}
              className="px-2 py-1 text-[10px] font-mono border border-panel-border hover:border-cyan text-muted hover:text-text rounded transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to AI Rec
            </button>

            {/* Hold to Confirm Apply Button */}
            <button
              onMouseDown={() => setHoldingApply(true)}
              onMouseUp={() => setHoldingApply(false)}
              onMouseLeave={() => setHoldingApply(false)}
              onTouchStart={() => setHoldingApply(true)}
              onTouchEnd={() => setHoldingApply(false)}
              disabled={isOverBudget || (isLifeSupportShort && !overrideSafety)}
              className={`relative px-4 py-1.5 rounded font-exo font-bold text-xs uppercase tracking-wider transition-all select-none overflow-hidden cursor-pointer ${
                isOverBudget || (isLifeSupportShort && !overrideSafety)
                  ? 'bg-panel-border/30 text-muted cursor-not-allowed'
                  : 'bg-gradient-to-r from-solar to-orange text-space shadow-[0_0_12px_rgba(255,176,32,0.4)] hover:brightness-110 active:scale-95'
              }`}
            >
              {/* Hold progress fill */}
              {holdingApply && (
                <div
                  className="absolute inset-0 bg-white/35 transition-all pointer-events-none"
                  style={{ width: `${applyProgress * 100}%` }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {holdingApply ? `Holding ${(applyProgress * 100).toFixed(0)}%...` : 'Hold to Apply'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
