import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

export const AlertPill = ({ level, title }) => {
  const normLevel = (level || 'green').toLowerCase();

  let colorClasses = 'bg-ok/10 text-ok border-ok/30';
  let Icon = ShieldCheck;
  let defaultText = 'NOMINAL';

  if (normLevel === 'red' || normLevel === 'critical') {
    colorClasses = 'bg-danger/15 text-danger border-danger/40';
    Icon = AlertOctagon;
    defaultText = 'CRITICAL';
  } else if (normLevel === 'yellow' || normLevel === 'warn' || normLevel === 'watch') {
    colorClasses = 'bg-warn/15 text-warn border-warn/40';
    Icon = AlertTriangle;
    defaultText = 'WATCH';
  }

  const displayText = title || defaultText;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors duration-300 ${colorClasses}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0 animate-pulse-subtle" aria-hidden="true" />
      <span>{displayText}</span>
    </div>
  );
};
