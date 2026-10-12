/**
 * Formatting utilities for SPACEGRID AI mission control telemetry
 */

export const formatKw = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '— kW';
  return `${Number(val).toFixed(1)} kW`;
};

export const formatKwh = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '— kWh';
  return `${Number(val).toFixed(1)} kWh`;
};

export const formatHours = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '— h';
  return `${Number(val).toFixed(1)} h`;
};

export const formatUtcTime = (isoString) => {
  try {
    const d = isoString ? new Date(isoString) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getUTCFullYear();
    const month = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    const hours = pad(d.getUTCHours());
    const mins = pad(d.getUTCMinutes());
    const secs = pad(d.getUTCSeconds());
    return `${year}-${month}-${day} ${hours}:${mins}:${secs} UTC`;
  } catch {
    return '2026-03-14 10:00:00 UTC';
  }
};

export const getTierLabel = (tier) => {
  switch (tier?.toLowerCase()) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'lower':
      return 'Lower';
    case 'lowest':
      return 'Lowest';
    default:
      return tier || 'Standard';
  }
};
