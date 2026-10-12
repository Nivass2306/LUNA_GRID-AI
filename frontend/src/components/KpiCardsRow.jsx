import React, { useRef, useEffect, useState } from 'react';
import { Sun, Zap, BatteryCharging, AlertOctagon, RotateCcw, Activity } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { OdometerNumber } from './OdometerNumber';
import { ProceduralMoonSphere } from './ProceduralMoonSphere';

export const KpiCardsRow = ({
  state = {},
  forecast = [],
  onSimulateSolarDrop,
  onReset,
  replanning = false,
}) => {
  const power = state.power || {};
  const battery = state.battery || {};

  const solarKw = Number(power.solar_kw ?? power.solar ?? 10.0);
  const demandKw = Number(power.demand_kw ?? power.demand ?? 8.0);
  const socKwh = Number(battery.soc_kwh ?? battery.soc ?? 16.5);
  const capacityKwh = Number(battery.capacity_kwh ?? battery.capacity ?? 20.0);
  const minReserveKwh = Number(battery.min_reserve_kwh ?? battery.min_reserve ?? 3.0);
  const socPercent = Math.min(100, Math.max(0, (socKwh / capacityKwh) * 100));

  // Previous metrics to calculate percentage change ONLY after a state change
  const prevMetrics = useRef(null);
  const [deltas, setDeltas] = useState({ solar: null, demand: null, battery: null });

  useEffect(() => {
    if (prevMetrics.current) {
      const prev = prevMetrics.current;
      const sDelta = prev.solarKw !== 0 ? (((solarKw - prev.solarKw) / prev.solarKw) * 100).toFixed(0) : 0;
      const dDelta = prev.demandKw !== 0 ? (((demandKw - prev.demandKw) / prev.demandKw) * 100).toFixed(0) : 0;
      const bDelta = prev.socKwh !== 0 ? (((socKwh - prev.socKwh) / prev.socKwh) * 100).toFixed(0) : 0;

      if (solarKw !== prev.solarKw || demandKw !== prev.demandKw || socKwh !== prev.socKwh) {
        setDeltas({
          solar: sDelta !== '0' ? Number(sDelta) : null,
          demand: dDelta !== '0' ? Number(dDelta) : null,
          battery: bDelta !== '0' ? Number(bDelta) : null,
        });
      }
    }
    prevMetrics.current = { solarKw, demandKw, socKwh };
  }, [solarKw, demandKw, socKwh]);

  // Derived flows to habitat
  const loads = state.loads || [];
  const totalAllocated = loads.reduce((sum, l) => sum + Number(l.allocated_kw ?? l.allocated ?? 0), 0);
  const solarToHab = Math.min(totalAllocated, solarKw);
  const batteryToHab = Math.max(0, totalAllocated - solarKw);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5 w-full">
      {/* KPI 1: Solar Generation */}
      <div className="hud-panel hud-panel-blur p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-exo uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-solar" />
            Solar Generation
          </span>
          {deltas.solar !== null && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${
                deltas.solar < 0
                  ? 'text-danger border-danger/40 bg-danger/10'
                  : 'text-ok border-ok/40 bg-ok/10'
              }`}
            >
              {deltas.solar > 0 ? `+${deltas.solar}%` : `${deltas.solar}%`}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between my-1">
          <OdometerNumber value={solarKw} decimals={1} suffix="kW" className="text-2xl text-solar" />
          <Sparkline
            data={forecast}
            dataKey="solar_kw"
            strokeColor="#FFB020"
            fillColor="rgba(255, 176, 32, 0.2)"
            height={32}
            width={85}
          />
        </div>
        <div className="text-[10px] font-mono text-muted/80 flex justify-between">
          <span>Array capacity: 12.0 kW</span>
          <span>Eff: 98.2%</span>
        </div>
      </div>

      {/* KPI 2: Total Demand */}
      <div className="hud-panel hud-panel-blur p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-exo uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-violet" />
            Total Demand
          </span>
          {deltas.demand !== null && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${
                deltas.demand > 0
                  ? 'text-warn border-warn/40 bg-warn/10'
                  : 'text-ok border-ok/40 bg-ok/10'
              }`}
            >
              {deltas.demand > 0 ? `+${deltas.demand}%` : `${deltas.demand}%`}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between my-1">
          <OdometerNumber value={demandKw} decimals={1} suffix="kW" className="text-2xl text-violet" />
          <Sparkline
            data={forecast}
            dataKey="demand_kw"
            strokeColor="#A855F7"
            fillColor="rgba(168, 85, 247, 0.2)"
            height={32}
            width={85}
          />
        </div>
        <div className="text-[10px] font-mono text-muted/80 flex justify-between">
          <span>5 connected systems</span>
          <span>Baseload: 8.0 kW</span>
        </div>
      </div>

      {/* KPI 3: Battery Storage */}
      <div className="hud-panel hud-panel-blur p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-exo uppercase tracking-wider text-muted flex items-center gap-1.5">
            <BatteryCharging className="w-3.5 h-3.5 text-ok" />
            Battery Storage
          </span>
          {deltas.battery !== null && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${
                deltas.battery < 0
                  ? 'text-danger border-danger/40 bg-danger/10'
                  : 'text-ok border-ok/40 bg-ok/10'
              }`}
            >
              {deltas.battery > 0 ? `+${deltas.battery}%` : `${deltas.battery}%`}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between my-1">
          <div>
            <OdometerNumber value={socKwh} decimals={1} suffix="kWh" className="text-2xl text-ok" />
            <span className="text-[11px] font-mono text-muted block -mt-1">
              {socPercent.toFixed(0)}% SoC
            </span>
          </div>
          <Sparkline
            data={forecast}
            dataKey="usable_battery_kw"
            strokeColor="#22E58B"
            fillColor="rgba(34, 229, 139, 0.2)"
            height={32}
            width={85}
          />
        </div>
        {/* Charge Bar with Min Reserve Tick (3.0 kWh / 20 kWh = 15%) */}
        <div className="relative w-full h-2 bg-space border border-panel-border rounded-xs overflow-hidden mt-1">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              socKwh <= minReserveKwh ? 'bg-danger' : 'bg-ok'
            }`}
            style={{ width: `${socPercent}%` }}
          />
          {/* Reserve tick at 15% (3.0 kWh) */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-danger shadow-[0_0_4px_#FF3B4E]"
            style={{ left: `${(minReserveKwh / capacityKwh) * 100}%` }}
            title="Minimum safety reserve threshold: 3.0 kWh"
          />
        </div>
      </div>

      {/* EMERGENCY CARD */}
      <div className="hud-panel hud-panel-danger p-3.5 flex flex-col justify-between" id="simulation">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-exo font-bold uppercase tracking-wider text-danger flex items-center gap-1.5">
            <AlertOctagon className="w-3.5 h-3.5 text-danger animate-pulse" />
            Simulate Emergency
          </span>
          <span className="text-[9px] font-mono uppercase bg-danger/20 text-danger px-1.5 py-0.5 rounded border border-danger/40">
            TEST DRILL
          </span>
        </div>
        <p className="text-[11px] font-mono text-muted leading-tight my-1">
          Trigger 70% solar generation drop due to dust or eclipse
        </p>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => onSimulateSolarDrop(0.7)}
            disabled={replanning}
            title="Simulate 70% solar drop (Key: D)"
            className="flex-1 py-1.5 px-2 bg-gradient-to-r from-[#DC2626] to-[#EF4444] hover:from-[#EF4444] hover:to-[#F87171] text-white text-[11px] font-exo font-bold uppercase tracking-wider rounded-xs shadow-[0_0_12px_rgba(239,68,68,0.4)] active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Simulate 70% Drop</span>
            <kbd className="text-[9px] font-mono bg-black/40 px-1 py-0.2 rounded ml-0.5">D</kbd>
          </button>
          <button
            onClick={onReset}
            disabled={replanning}
            title="Reset to nominal solar grid (Key: R)"
            className="p-1.5 border border-panel-border/60 hover:border-cyan text-muted hover:text-cyan bg-panel-solid rounded-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* LUNAR HABITAT CARD */}
      <div className="hud-panel hud-panel-blur p-3.5 flex items-center justify-between gap-3">
        <div className="flex flex-col justify-between h-full">
          <div>
            <span className="text-[11px] font-exo uppercase tracking-wider text-muted flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan" />
              Lunar Habitat
            </span>
            <span className="status-chip status-chip-protected mt-1 inline-flex text-[9px]">
              <span className="w-1.5 h-1.5 rounded-full bg-ok animate-ping mr-1" />
              Flow Active
            </span>
          </div>

          <div className="text-[10px] font-mono text-muted space-y-0.5 mt-2">
            <div className="flex justify-between gap-2">
              <span>Solar → Hab:</span>
              <span className="text-solar font-semibold">{solarToHab.toFixed(1)} kW</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Battery → Hab:</span>
              <span className="text-ok font-semibold">{batteryToHab.toFixed(1)} kW</span>
            </div>
            <div className="flex justify-between gap-2 pt-0.5 border-t border-panel-border/30">
              <span>Total supply:</span>
              <span className="text-text font-bold">{(solarToHab + batteryToHab).toFixed(1)} kW</span>
            </div>
          </div>
        </div>

        {/* Procedural rotating 3D Moon sphere */}
        <div className="flex items-center justify-center shrink-0">
          <ProceduralMoonSphere size={78} rotationSpeed={0.003} />
        </div>
      </div>
    </div>
  );
};
