import React from 'react';
import { useSpacegridState } from '../context/SpacegridContext';
import { KpiCard } from './KpiCard';
import { AnimatedNumber } from './AnimatedNumber';
import { Sun, Zap, ShieldAlert, Clock, ArrowRight } from 'lucide-react';

export const KpiRow = () => {
  const { state } = useSpacegridState();

  const power = state?.power || {};
  const survival = state?.survival || {};
  const replanMs = state?.replan_ms ?? null;

  const hoursBefore = survival.hours_before ?? null;
  const hoursNow = survival.hours_now ?? null;

  const hasNumericHours =
    typeof hoursNow === 'number' && typeof hoursBefore === 'number';
  const delta = hasNumericHours ? +(hoursNow - hoursBefore).toFixed(1) : null;

  let deltaColor = 'text-ok bg-ok/10 border-ok/30';
  let deltaText = delta !== null ? `${delta > 0 ? '+' : ''}${delta} h` : '';
  if (delta !== null && delta < 0) {
    if (delta <= -8) {
      deltaColor = 'text-danger bg-danger/10 border-danger/30';
    } else {
      deltaColor = 'text-warn bg-warn/10 border-warn/30';
    }
  }

  const renderSurv = (val, isBefore = false) => {
    if (val === null || val === undefined) {
      return <span className={isBefore ? 'text-text-muted' : 'text-ok'}>Sustained</span>;
    }
    const n = Number(val);
    if (n <= 0.001) {
      return <span className="text-danger font-bold">0 h (unsafe)</span>;
    }
    return (
      <>
        <span>{n.toFixed(1)}</span>
        <span className="text-sm font-mono-numbers text-text-muted ml-0.5">h</span>
      </>
    );
  };

  return (
    <section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {/* 1. Solar Output */}
      <KpiCard
        title="SOLAR OUTPUT"
        icon={Sun}
        accentColor="#FFC857"
        value={
          <span className="text-2xl sm:text-3xl font-bold font-heading text-text">
            {power.solar_kw !== null && power.solar_kw !== undefined ? (
              <AnimatedNumber value={Number(power.solar_kw)} decimals={1} />
            ) : (
              '--'
            )}
          </span>
        }
        unit={power.solar_kw !== null && power.solar_kw !== undefined ? 'kW' : ''}
        caption="Photovoltaic array input"
      />

      {/* 2. Total Demand */}
      <KpiCard
        title="TOTAL DEMAND"
        icon={Zap}
        accentColor="#38BDF8"
        value={
          <span className="text-2xl sm:text-3xl font-bold font-heading text-text">
            {power.demand_kw !== null && power.demand_kw !== undefined ? (
              <AnimatedNumber value={Number(power.demand_kw)} decimals={1} />
            ) : (
              '--'
            )}
          </span>
        }
        unit={power.demand_kw !== null && power.demand_kw !== undefined ? 'kW' : ''}
        caption="Baseline habitat sum"
      />

      {/* 3. Available Power */}
      <KpiCard
        title="AVAILABLE POWER"
        icon={ShieldAlert}
        accentColor="#34D399"
        value={
          <span className="text-2xl sm:text-3xl font-bold font-heading text-text">
            {power.available_kw !== null && power.available_kw !== undefined ? (
              <AnimatedNumber value={Number(power.available_kw)} decimals={1} />
            ) : (
              '--'
            )}
          </span>
        }
        unit={power.available_kw !== null && power.available_kw !== undefined ? 'kW' : ''}
        caption="Solar + usable battery"
      />

      {/* 4. Survival Time */}
      <KpiCard
        title="SURVIVAL TIME"
        icon={Clock}
        accentColor="#38BDF8"
        value={
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base sm:text-lg font-bold font-mono-numbers text-text-muted">
              {renderSurv(hoursBefore, true)}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
            <span className="text-2xl sm:text-3xl font-bold font-heading text-text">
              {renderSurv(hoursNow, false)}
            </span>
          </div>
        }
        badge={
          delta !== null && delta !== 0 && (
            <span className={`text-[11px] font-mono-numbers font-semibold px-2 py-0.5 rounded border ml-auto ${deltaColor}`}>
              {deltaText}
            </span>
          )
        }
        caption={`Re-plan time: ${replanMs !== null ? `${replanMs} ms` : '--'}`}
      />
    </section>
  );
};
