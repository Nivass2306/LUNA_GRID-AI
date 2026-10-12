import React from 'react';
import { Sun } from 'lucide-react';

export const SunPathArc = ({ sunProgress = null }) => {
  if (sunProgress === null || sunProgress === undefined) {
    return <div className="h-full min-h-[140px]" />; // Open viewport to scene
  }

  const p = Math.max(0, Math.min(1, Number(sunProgress)));
  // Calculate position along an arc spanning 0% to 100% width
  const arcRadius = 160;
  // Arc angle from PI to 0
  const angle = Math.PI - p * Math.PI;
  const markerX = 50 - Math.cos(angle) * 44; // percent
  const markerY = 70 - Math.sin(angle) * 45; // percent

  return (
    <div className="relative h-full min-h-[140px] flex items-center justify-center pointer-events-none select-none">
      <svg className="w-full h-full max-w-md max-h-32 overflow-visible" viewBox="0 0 200 90">
        <defs>
          <linearGradient id="sunArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255, 176, 32, 0.2)" />
            <stop offset="50%" stopColor="rgba(255, 176, 32, 0.8)" />
            <stop offset="100%" stopColor="rgba(255, 176, 32, 0.2)" />
          </linearGradient>
        </defs>

        {/* Dashed Lunar Day Sun-Path Arc */}
        <path
          d="M 20,80 Q 100,10 180,80"
          fill="none"
          stroke="url(#sunArcGrad)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Horizon Baseline */}
        <line x1="15" y1="80" x2="185" y2="80" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" />

        {/* Arc Label */}
        <text
          x="100"
          y="88"
          fill="#8CA3C2"
          fontSize="7"
          fontFamily="'Exo 2', sans-serif"
          textAnchor="middle"
          letterSpacing="0.1em"
        >
          LUNAR DAY CYCLE ({(p * 100).toFixed(0)}%)
        </text>

        {/* Animated Sun Marker on Arc */}
        <circle
          cx={20 + (160 * p)}
          cy={80 - Math.sin(p * Math.PI) * 70}
          r="5"
          fill="#FFB020"
          style={{ filter: 'drop-shadow(0 0 6px #FFB020)' }}
        />
        <circle
          cx={20 + (160 * p)}
          cy={80 - Math.sin(p * Math.PI) * 70}
          r="8"
          fill="none"
          stroke="rgba(255, 176, 32, 0.5)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};
