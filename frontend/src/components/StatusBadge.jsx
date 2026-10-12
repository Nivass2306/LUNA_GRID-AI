import React from 'react';
import { ShieldCheck, ArrowDownRight, AlertOctagon, PowerOff, Clock } from 'lucide-react';

export const StatusBadge = ({ status }) => {
  const norm = (status || '').toLowerCase();

  switch (norm) {
    case 'protected':
    case 'full':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-ok/10 text-ok border border-ok/25">
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Protected</span>
        </span>
      );

    case 'reduced':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-warn/10 text-warn border border-warn/25">
          <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reduced</span>
        </span>
      );

    case 'unmet':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-danger/10 text-danger border border-danger/30">
          <AlertOctagon className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Unmet</span>
        </span>
      );

    case 'off':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800/80 text-text-muted border border-border">
          <PowerOff className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
          <span>Off</span>
        </span>
      );

    case 'postponed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-demand/10 text-demand border border-demand/25">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Postponed</span>
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-text-muted border border-border">
          <span>{status || 'Unknown'}</span>
        </span>
      );
  }
};
