import React from 'react';

export const KpiCard = ({ title, value, unit, caption, icon: Icon, accentColor, badge, extraContent }) => {
  return (
    <div className="mission-card p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-200">
      {/* Top row: Label & Icon */}
      <div className="flex items-center justify-between mb-2">
        <span className="telemetry-caption">{title}</span>
        {Icon && (
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center bg-bg-raised border border-border"
            style={{ color: accentColor }}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Metric Value */}
      <div className="flex items-baseline gap-2 my-1">
        {value}
        {unit && <span className="text-sm font-mono-numbers text-text-muted">{unit}</span>}
        {badge}
      </div>

      {/* Extra content (e.g. before -> now or formula) */}
      {extraContent}

      {/* Bottom Telemetry Caption */}
      <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted font-mono">
        <span>{caption}</span>
      </div>
    </div>
  );
};
