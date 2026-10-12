import React from 'react';

const LOAD_COLORS = {
  life_support: '#7DDFA4',
  habitat: '#EDE8DF',
  comms: '#E9D758',
  science: '#FF9F1C',
  rover: '#8C877D',
};

const LOAD_NAMES = {
  life_support: 'Life support',
  habitat: 'Habitat',
  comms: 'Comms',
  science: 'Science',
  rover: 'Rover',
};

export const PowerBudgetBar = ({
  availableKw,
  draft,
  remainingKw,
  hardCapWarning,
  isOverBudget,
  overBudgetDelta,
  onAutoFix,
  onTrimLowest,
}) => {
  const safeAvail = Math.max(0.1, availableKw);
  const totalDraft = Object.values(draft).reduce((s, v) => s + v, 0);

  return (
    <div className="w-full mt-3 select-none">
      {/* Header and status text */}
      <div className="flex flex-wrap items-center justify-between text-[12.5px] mb-2 font-sans">
        <div className="flex items-center gap-3">
          <span className="text-bone font-medium">Power bus budget</span>
          <span className="font-mono text-[11px] text-muted">
            {totalDraft.toFixed(1)} / {availableKw.toFixed(1)} kW
          </span>
        </div>

        {/* Warning or remaining capacity label */}
        <div>
          {hardCapWarning ? (
            <span className="text-danger font-medium animate-pulse">
              No more power on the bus. Take it from another load.
            </span>
          ) : isOverBudget ? (
            <span className="text-danger font-medium">
              Solar changed. Your plan needs {overBudgetDelta.toFixed(1)} kW more than the bus has.
            </span>
          ) : (
            <span className="text-muted font-mono text-[11.5px]">
              {remainingKw > 0 ? `${remainingKw.toFixed(1)} kW unallocated` : 'Bus fully allocated'}
            </span>
          )}
        </div>
      </div>

      {/* The Visual Segmented Bar */}
      <div
        className={`w-full h-3 bg-ground border overflow-hidden flex transition-all duration-300 relative ${
          hardCapWarning
            ? 'border-danger/80 bg-danger/10'
            : isOverBudget
            ? 'border-danger'
            : 'border-hairline'
        }`}
      >
        {isOverBudget ? (
          // Hatched red bar in over-budget state
          <div className="w-full h-full bg-danger/25 relative overflow-hidden">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <pattern
                  id="budgetHatch"
                  width="8"
                  height="8"
                  patternTransform="rotate(45 0 0)"
                  patternUnits="userSpaceOnUse"
                >
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#FF4A3D" strokeWidth="1.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#budgetHatch)" />
            </svg>
          </div>
        ) : (
          // Segments for each load
          <>
            {['life_support', 'habitat', 'comms', 'science', 'rover'].map((id) => {
              const val = Number(draft[id] ?? 0);
              if (val <= 0) return null;
              const widthPct = Math.min(100, (val / safeAvail) * 100);

              return (
                <div
                  key={id}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: LOAD_COLORS[id] || '#EDE8DF',
                  }}
                  className="h-full border-r border-ground/40 transition-all duration-200 ease-out"
                  title={`${LOAD_NAMES[id]}: ${val.toFixed(1)} kW`}
                />
              );
            })}

            {/* Empty remaining stretch */}
            {remainingKw > 0 && (
              <div
                style={{ width: `${(remainingKw / safeAvail) * 100}%` }}
                className="h-full bg-raised/50"
              />
            )}
          </>
        )}
      </div>

      {/* Over-budget action buttons */}
      {isOverBudget && (
        <div className="flex items-center gap-4 mt-2.5 text-[12px] font-sans">
          <span className="text-muted">Options:</span>
          <button
            onClick={onAutoFix}
            className="text-solar hover:underline font-medium cursor-pointer"
          >
            Auto-fix with LUNAGRID
          </button>
          <span className="text-hairline">/</span>
          <button
            onClick={onTrimLowest}
            className="text-bone hover:underline cursor-pointer"
          >
            Trim from the lowest priority
          </button>
        </div>
      )}
    </div>
  );
};
