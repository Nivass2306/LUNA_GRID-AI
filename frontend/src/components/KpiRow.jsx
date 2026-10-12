import React from 'react';
import { useSpacegridState } from '../context/SpacegridContext';
import { KpiCard } from './KpiCard';
import { AnimatedNumber } from './AnimatedNumber';
import { Sun, Zap, ShieldAlert, Clock, ArrowRight } from 'lucide-react';

export const KpiRow = () => {
  const { state } = useSpacegridState();

  const power = state?.power || {};
  const survival = state?.survival || {};
  const replanMs = state?.replan_ms !== undefined ? state.replan_ms : 42;

  const hoursBefore = survival.hours_before !== undefined ? Number(survival.hours_before) : 18.0;
  const hoursNow = survival.hours_now !== undefined ? Number(survival.hours_now) : 18.0;
  const delta = +(hoursNow - hoursBefore).toFixed(1);

  let deltaColor = 'text-ok bg-ok/10 border-ok/30';
  let deltaText = `${delta > 0 ? '+' : ''}${delta} h`;
  if (delta < 0) {
    if (delta <= -8) {
      deltaColor = 'text-danger bg-danger/10 border-danger/30';
    } else {
      deltaColor = 'text-warn bg-warn/10 border-warn/30';
    }
  }

  return (
    <section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {/* 1. Solar Output */}
      <KpiCard
        title="SOLAR OUTPUT"
        icon={Sun}
        accentColor="#FFC857"
        value={
          <span className="text-2xl sm:text-3xl font-bold font-heading text-text">
            <AnimatedNumber value={power.solar_kw ?? 10.0} decimals={1} />
          </span>
        }
        unit="kW"
        caption="Photovoltaic array input"
      />

      {/* 2. Total Demand */}
      <KpiCard
        title="TOTAL DEMAND"
        icon={Zap}
        accentColor="#38BDF8"
        value={
          <span className="text-2xl sm:text-3xl font-bold font-heading text-text">
            <AnimatedNumber value={power.demand_kw ?? 8.0} decimals={1} />
          </span>
        }
        unit="kW"
        caption="Baseline habitat sum"
      />

      {/* 3. Available Power */}
      <KpiCard
        title="AVAILABLE POWER"
        icon={ShieldAlert}
        accentColor="#34D399"
        value={
          <span className="text-2xl sm:text-3xl font-bold font-heading text-text">
            <AnimatedNumber value={power.available_kw ?? 12.0} decimals={1} />
          </span>
        }
        unit="kW"
        caption="Solar + usable battery"
      />

      {/* 4. Survival Time */}
      <KpiCard
        title="SURVIVAL TIME"
        icon={Clock}
        accentColor="#38BDF8"
        value={
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold font-mono-numbers text-text-muted">
              {hoursBefore.toFixed(0)} h
            </span>
            <ArrowRight className="w-4 h-4 text-text-muted" aria-hidden="true" />
            <span className="text-2xl sm:text-3xl font-bold font-heading text-text">
              <AnimatedNumber value={hoursNow} decimals={1} />
            </span>
            <span className="text-sm font-mono-numbers text-text-muted">h</span>
          </div>
        }
        badge={
          delta !== 0 && (
            <span className={`text-[11px] font-mono-numbers font-semibold px-2 py-0.5 rounded border ml-auto ${deltaColor}`}>
              {deltaText}
            </span>
          )
        }
        caption={`Re-plan time: ${replanMs} ms`}
      />
    </section>
  );
};
