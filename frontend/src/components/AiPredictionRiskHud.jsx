import React, { useRef, useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { OdometerNumber } from './OdometerNumber';

export const AiPredictionRiskHud = ({
  power = {},
  survival = {},
  risk = {},
  insights = [],
  alertMessage = '',
  manualSurvivalHours = null,
  mode = 'auto',
}) => {
  const coveragePct = power.coverage_pct !== undefined ? Number(power.coverage_pct) : null;
  const availableKw = power.available_kw ?? power.available ?? null;
  const demandKw = power.demand_kw ?? power.demand ?? null;

  // Survival hours logic: show before -> now only after a change
  const autoHoursNow = survival.hours_now ?? null;
  const hoursBefore = survival.hours_before ?? null;
  const currentHours = mode === 'manual' && manualSurvivalHours !== null
    ? manualSurvivalHours
    : autoHoursNow;

  const hasSurvivalChanged =
    currentHours !== null &&
    hoursBefore !== null &&
    Math.abs(Number(currentHours) - Number(hoursBefore)) > 0.05;

  // Shortage window display
  const isShortage = Boolean(risk.shortage_expected);
  const startHour = Number(risk.start_hour ?? 0);
  const endHour = Number(risk.end_hour ?? 0);

  // Key insights
  const displayInsights = (insights && insights.length > 0)
    ? insights
    : [
        {
          level: isShortage ? 'warn' : 'ok',
          text: alertMessage || 'Autonomous advisory twin operating nominal within baseline electrical envelopes.',
        },
      ];

  // SVG Ring Gauge parameters for Demand Covered
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const calcCoverage = coveragePct !== null
    ? coveragePct
    : (availableKw !== null && demandKw !== null && demandKw > 0)
    ? Math.min(100, (availableKw / demandKw) * 100)
    : 100;
  const strokeDashoffset = circumference - (calcCoverage / 100) * circumference;

  const formatSurvSnippet = (val) => {
    if (val === null || val === undefined) return 'Sustained';
    if (Number(val) <= 0.001) return '0 h (unsafe)';
    return `${Number(val).toFixed(1)}h`;
  };

  return (
    <div className="hud-panel hud-panel-blur p-4 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between border-b border-panel-border/40 pb-2">
        <h3 className="hud-title text-xs tracking-wider flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-cyan" />
          AI Prediction & Risk
        </h3>
        <span className="text-[10px] font-mono text-muted uppercase">Digital Twin</span>
      </div>

      <div className="grid grid-cols-2 gap-3 my-2 items-center">
        {/* Ring Gauge: Demand Covered */}
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 -rotate-90 overflow-visible" viewBox="0 0 70 70">
              <circle
                cx="35"
                cy="35"
                r={radius}
                fill="none"
                stroke="rgba(56, 189, 248, 0.15)"
                strokeWidth="6"
              />
              <circle
                cx="35"
                cy="35"
                r={radius}
                fill="none"
                stroke={calcCoverage < 70 ? '#FF3B4E' : calcCoverage < 95 ? '#FFC233' : '#22D3EE'}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
                style={{
                  filter: `drop-shadow(0 0 4px ${calcCoverage < 70 ? '#FF3B4E' : '#22D3EE'})`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-orbitron font-bold text-xs text-text">
                {calcCoverage.toFixed(0)}%
              </span>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-exo uppercase tracking-wider text-muted block">
              Demand Covered
            </span>
            <span className="text-xs font-mono text-text">
              {availableKw !== null ? availableKw.toFixed(1) : '--'} / {demandKw !== null ? demandKw.toFixed(1) : '--'} kW
            </span>
          </div>
        </div>

        {/* Big Safe Operation Survival Number */}
        <div className="flex flex-col border-l border-panel-border/30 pl-3">
          <span className="text-[10px] font-exo uppercase tracking-wider text-muted">
            Safe Operation
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            {currentHours === null ? (
              <span className="text-xl font-orbitron font-bold text-ok">Sustained</span>
            ) : Number(currentHours) <= 0.001 ? (
              <span className="text-xl font-orbitron font-bold text-danger">0 h (unsafe)</span>
            ) : (
              <OdometerNumber
                value={Number(currentHours)}
                decimals={1}
                suffix="h"
                className={`text-2xl font-orbitron font-bold ${
                  Number(currentHours) <= 2.0 ? 'text-danger' : Number(currentHours) < 8.0 ? 'text-warn' : 'text-ok'
                }`}
              />
            )}
          </div>
          {/* Show before -> now only after a change */}
          {hasSurvivalChanged && (
            <span className="text-[10px] font-mono text-muted/80">
              Prev: {formatSurvSnippet(hoursBefore)} → {formatSurvSnippet(currentHours)}
            </span>
          )}
        </div>
      </div>

      {/* Shortage Window & Key Insights */}
      <div className="pt-2 border-t border-panel-border/30 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-muted">Shortage window:</span>
          <span className={isShortage ? 'text-danger font-semibold' : 'text-ok'}>
            {isShortage ? `T+${startHour}h to T+${endHour}h (${endHour - startHour}h span)` : 'No shortage in 24 h'}
          </span>
        </div>

        {/* Key Insights bullets with colored dots */}
        <div className="space-y-1 mt-1">
          {displayInsights.slice(0, 2).map((ins, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[11px] font-mono text-text/90 leading-tight">
              <span
                className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                  ins.level === 'danger'
                    ? 'bg-danger shadow-[0_0_4px_#FF3B4E]'
                    : ins.level === 'warn'
                    ? 'bg-warn shadow-[0_0_4px_#FFC233]'
                    : 'bg-ok shadow-[0_0_4px_#22E58B]'
                }`}
              />
              <span>{ins.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
