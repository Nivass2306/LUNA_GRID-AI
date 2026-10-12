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

export const formatSurvival = (val, { includeUnit = true } = {}) => {
  if (val === null || val === undefined || isNaN(val)) {
    return 'Sustained';
  }
  const n = Number(val);
  if (n <= 0.001) {
    return '0 h (unsafe)';
  }
  return includeUnit ? `${n.toFixed(1)} h` : n.toFixed(1);
};

export const formatHours = (val) => {
  return formatSurvival(val, { includeUnit: true });
};

export const formatNumberOrDash = (val, decimals = 1, suffix = '') => {
  if (val === null || val === undefined || isNaN(val)) {
    return '--';
  }
  return `${Number(val).toFixed(decimals)}${suffix ? ` ${suffix}` : ''}`;
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
