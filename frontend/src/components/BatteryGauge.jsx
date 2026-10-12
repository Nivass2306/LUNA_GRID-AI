import React from 'react';
import { useSpacegridState } from '../context/SpacegridContext';
import { Battery, Zap, Shield, AlertTriangle } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

export const BatteryGauge = () => {
  const { state } = useSpacegridState();

  const battery = state?.battery || {
    soc_kwh: 8.5,
    capacity_kwh: 20.0,
    min_reserve_kwh: 3.0,
    max_discharge_kw: 2.5,
  };

  const capacity = battery.capacity_kwh || 20.0;
  const soc = Math.max(0, Math.min(battery.soc_kwh || 0, capacity));
  const minReserve = battery.min_reserve_kwh || 3.0;
  const maxDischarge = battery.max_discharge_kw || 2.5;

  const socPercent = Math.min(100, Math.max(0, (soc / capacity) * 100));
  const reservePercent = Math.min(100, Math.max(0, (minReserve / capacity) * 100));
  const usableKwh = Math.max(0, soc - minReserve);

  const isBelowReserve = soc < minReserve;

  // Arc Gauge Geometry (220 degree arc from 160 deg to 380 deg)
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Total angle span for the gauge
  const startAngle = 140;
  const totalAngle = 260;

  const polarToCartesian = (cx, cy, r, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (cx, cy, r, startA, endA) => {
    const start = polarToCartesian(cx, cy, r, endA);
    const end = polarToCartesian(cx, cy, r, startA);
    const largeArcFlag = endA - startA <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const backgroundArc = describeArc(center, center, radius, startAngle, startAngle + totalAngle);

  const socEndAngle = startAngle + (socPercent / 100) * totalAngle;
  const socArc = describeArc(center, center, radius, startAngle, socEndAngle);

  // Reserve tick coordinates
  const reserveAngle = startAngle + (reservePercent / 100) * totalAngle;
  const reserveTickInner = polarToCartesian(center, center, radius - strokeWidth / 2 - 4, reserveAngle);
  const reserveTickOuter = polarToCartesian(center, center, radius + strokeWidth / 2 + 4, reserveAngle);

  return (
    <div className="mission-card p-4 sm:p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-heading font-bold text-sm tracking-wide text-text uppercase">
            Storage Subsystem
          </h2>
          <span className="telemetry-caption text-[10px]">
            LUNAR SURFACE ESS CELL STACK
          </span>
        </div>
        <div className={`p-1.5 rounded-md border ${isBelowReserve ? 'bg-danger/10 border-danger/40 text-danger' : 'bg-battery/10 border-battery/30 text-battery'}`}>
          <Battery className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>

      {/* Radial Arc Gauge */}
      <div className="flex flex-col items-center justify-center my-2 relative">
        <svg
          width={size}
          height={size * 0.85}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
          aria-hidden="true"
        >
          {/* Base Track */}
          <path
            d={backgroundArc}
            fill="none"
            stroke="rgba(148, 163, 184, 0.12)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active SoC Arc */}
          {socPercent > 0 && (
            <path
              d={socArc}
              fill="none"
              stroke={isBelowReserve ? '#EF4444' : '#34D399'}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Minimum Reserve Tick Mark */}
          <line
            x1={reserveTickInner.x}
            y1={reserveTickInner.y}
            x2={reserveTickOuter.x}
            y2={reserveTickOuter.y}
            stroke="#F59E0B"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        {/* Central Metric Value */}
        <div className="absolute top-[38%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="text-3xl font-bold font-heading text-text">
            <AnimatedNumber value={socPercent} decimals={0} suffix="%" />
          </div>
          <span className="telemetry-caption text-[10px] block mt-0.5">
            STATE OF CHARGE
          </span>
          {isBelowReserve && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-danger bg-danger/15 px-1.5 py-0.5 rounded border border-danger/30 mt-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              BELOW RESERVE
            </span>
          )}
        </div>

        {/* Usable part indicator */}
        <div className="text-center mt-1">
          <span className="text-xs text-text-muted">
            Usable Energy:{' '}
            <strong className="text-battery font-mono-numbers">
              <AnimatedNumber value={usableKwh} decimals={1} /> kWh
            </strong>
          </span>
        </div>
      </div>

      {/* Telemetry Breakdown Details */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/70 text-center">
        {/* Stored Charge */}
        <div className="bg-bg-raised/70 p-2 rounded-lg border border-border/50">
          <span className="telemetry-caption text-[10px] block">STORED</span>
          <div className="text-xs sm:text-sm font-bold font-mono-numbers text-text mt-0.5">
            <AnimatedNumber value={soc} decimals={1} />
            <span className="text-[10px] text-text-muted font-normal ml-0.5">kWh</span>
          </div>
        </div>

        {/* Minimum Reserve */}
        <div className="bg-bg-raised/70 p-2 rounded-lg border border-border/50">
          <span className="telemetry-caption text-[10px] text-warn block flex items-center justify-center gap-1">
            <Shield className="w-2.5 h-2.5 text-warn" />
            RESERVE
          </span>
          <div className="text-xs sm:text-sm font-bold font-mono-numbers text-warn mt-0.5">
            {minReserve.toFixed(1)}
            <span className="text-[10px] text-text-muted font-normal ml-0.5">kWh</span>
          </div>
        </div>

        {/* Max Discharge */}
        <div className="bg-bg-raised/70 p-2 rounded-lg border border-border/50">
          <span className="telemetry-caption text-[10px] block flex items-center justify-center gap-1">
            <Zap className="w-2.5 h-2.5 text-demand" />
            MAX DISCH.
          </span>
          <div className="text-xs sm:text-sm font-bold font-mono-numbers text-text mt-0.5">
            {maxDischarge.toFixed(1)}
            <span className="text-[10px] text-text-muted font-normal ml-0.5">kW</span>
          </div>
        </div>
      </div>
    </div>
  );
};
