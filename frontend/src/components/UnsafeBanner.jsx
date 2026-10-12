import React from 'react';
import { AlertOctagon, PhoneCall } from 'lucide-react';

export const UnsafeBanner = ({ message }) => {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full bg-danger/20 border-b border-danger/60 px-4 py-2.5 transition-all duration-300 animate-pulse-subtle"
    >
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-danger font-medium text-sm">
          <AlertOctagon className="w-5 h-5 flex-shrink-0 text-danger" aria-hidden="true" />
          <span>
            <strong className="font-bold tracking-wide">UNSAFE:</strong> life support cannot be fully powered. Escalate to operator.
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-danger/90">
          <PhoneCall className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">PROTOCOL: IMMEDIATE ESCALATION LEVEL 1</span>
        </div>
      </div>
    </div>
  );
};
