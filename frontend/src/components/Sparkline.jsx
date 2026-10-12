import React from 'react';

export const Sparkline = ({
  data = [],
  dataKey = 'solar_kw',
  strokeColor = '#FFB020',
  fillColor = 'rgba(255, 176, 32, 0.2)',
  height = 36,
  width = 120,
}) => {
  if (!data || data.length === 0) return null;

  const values = data.map((d) => Number(d[dataKey] ?? d.value ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values, min + 0.1);
  const range = max - min || 1;

  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;

  const gradId = `sparkline-grad-${strokeColor.replace('#', '')}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible pointer-events-none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${strokeColor})` }}
      />
    </svg>
  );
};
