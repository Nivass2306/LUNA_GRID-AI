import React from 'react';
import { useLunagridState } from '../context/LunagridContext';

export const AllocationList = ({
  hoveredLoadId,
  onHoverLoad,
  mode = 'auto',
  draft = {},
  onSetAllocation,
}) => {
  const { state } = useLunagridState();
  const loads = state?.loads || [];
  const alert = state?.alert || {};
  const isServerUnsafe = alert.life_support_ok === false;

  return (
    <div className="border-t border-hairline pt-4 mt-4 select-none">
      <div className="flex items-center justify-between mb-3 text-[13px] text-muted font-sans">
        <span className="text-bone font-medium">Allocation breakdown</span>
        <span className="font-mono text-[11px]">
          {mode === 'manual' ? 'manual adjustment (kW)' : 'kW allocated / need'}
        </span>
      </div>

      <div className="space-y-1.5">
        {loads.map((load) => {
          const isHovered = hoveredLoadId === load.id;
          const need = Number(load.need_kw ?? load.need ?? 1.0);

          const allocated = mode === 'manual'
            ? Number(draft[load.id] ?? 0.0)
            : Number(load.allocated_kw ?? load.allocated ?? 0.0);

          const isOff = allocated <= 0.05;
          const isThrottled = allocated < need && !isOff;
          const isLifeSupport = load.id === 'life_support';
          const isUnderpowered = isLifeSupport && allocated < 3.0;

          let statusText = load.status;
          let statusColor = 'text-battery';

          if (isUnderpowered) {
            statusText = 'Underpowered';
            statusColor = 'text-danger font-medium';
          } else if (isOff) {
            statusText = load.id === 'rover' ? 'Postponed' : 'Off';
            statusColor = 'text-muted';
          } else if (isThrottled) {
            statusText = 'Reduced';
            statusColor = 'text-watch';
          } else {
            statusText = isLifeSupport && isServerUnsafe && mode === 'auto' ? 'Unsafe' : 'Protected';
          }

          return (
            <div
              key={load.id}
              onMouseEnter={() => onHoverLoad && onHoverLoad(load.id)}
              onMouseLeave={() => onHoverLoad && onHoverLoad(null)}
              className={`flex items-center justify-between py-2 px-2.5 transition-colors cursor-pointer ${
                isHovered ? 'bg-raised text-bone' : 'text-bone/90 hover:bg-raised/60'
              }`}
            >
              {/* Left: Priority and Load Name */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-muted w-3">
                  {load.priority}
                </span>
                <span className="text-[13px] font-sans font-medium">
                  {load.name}
                </span>
              </div>

              {/* Right: Manual Stepper OR Static Readout */}
              {mode === 'manual' ? (
                <div className="flex items-center gap-3">
                  {/* Stepper Controls */}
                  <div className="flex items-center border border-hairline bg-ground" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onSetAllocation(load.id, Math.max(0, allocated - 0.1))}
                      className="px-2 py-0.5 text-muted hover:text-bone hover:bg-raised text-xs transition-colors cursor-pointer"
                      title="Decrease by 0.1 kW"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={need}
                      value={allocated.toFixed(1)}
                      onChange={(e) => onSetAllocation(load.id, parseFloat(e.target.value) || 0)}
                      className="w-12 text-center bg-transparent font-mono text-[12px] text-bone focus:outline-none"
                    />
                    <button
                      onClick={() => onSetAllocation(load.id, Math.min(need, allocated + 0.1))}
                      className="px-2 py-0.5 text-muted hover:text-bone hover:bg-raised text-xs transition-colors cursor-pointer"
                      title="Increase by 0.1 kW"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-muted font-mono text-[11px] w-10">
                    / {need.toFixed(1)}
                  </span>
                  <span className={`text-[11px] font-sans w-20 text-right ${statusColor}`}>
                    {statusText}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[12.5px] tabular-nums text-bone">
                    {allocated.toFixed(1)}{' '}
                    <span className="text-muted text-[11px]">/ {need.toFixed(1)}</span>
                  </span>
                  <span className={`text-[11px] font-sans w-20 text-right ${statusColor}`}>
                    {statusText}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
