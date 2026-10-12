import React from 'react';
import { ShieldCheck, AlertTriangle, Clock, PowerOff, ShieldAlert } from 'lucide-react';

export const StatusChip = ({ status = 'Protected', className = '' }) => {
  const norm = (status || '').toLowerCase();

  if (norm === 'protected' || norm === 'full') {
    return (
      <span className={`status-chip status-chip-protected ${className}`}>
        <ShieldCheck className="w-3.5 h-3.5 text-ok" />
        <span>Protected</span>
      </span>
    );
  }

  if (norm === 'reduced') {
    return (
      <span className={`status-chip status-chip-reduced ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5 text-warn" />
        <span>Reduced</span>
      </span>
    );
  }

  if (norm === 'postponed') {
    return (
      <span className={`status-chip status-chip-postponed ${className}`}>
        <Clock className="w-3.5 h-3.5 text-orange" />
        <span>Postponed</span>
      </span>
    );
  }

  // Off / Unmet
  return (
    <span className={`status-chip status-chip-off ${className}`}>
      {norm === 'unmet' ? (
        <ShieldAlert className="w-3.5 h-3.5 text-danger" />
      ) : (
        <PowerOff className="w-3.5 h-3.5 text-danger" />
      )}
      <span>{norm === 'unmet' ? 'Unmet' : 'Off'}</span>
    </span>
  );
};

export const PriorityBadge = ({ priority = 1 }) => {
  const p = Number(priority) || 1;
  const colorClass =
    p === 1
      ? 'priority-1'
      : p === 2
      ? 'priority-2'
      : p === 3
      ? 'priority-3'
      : p === 4
      ? 'priority-4'
      : 'priority-5';

  return (
    <span className={`priority-badge ${colorClass}`} title={`Priority ${p}`}>
      {p}
    </span>
  );
};
