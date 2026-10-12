import React from 'react';
import { Sun, Wind, Thermometer, Moon } from 'lucide-react';
import { OdometerNumber } from './OdometerNumber';

export const EnvironmentPanel = ({ mission = {}, power = {} }) => {
  const phase = mission.phase || 'day';
  const dustFactor = Number(mission.dust_factor ?? 0.12);
  const solarKw = Number(power.solar_kw ?? power.solar ?? 10.0);

  // Optional fields: render only when present
  const irradiance = mission.irradiance_w_m2 !== undefined ? Number(mission.irradiance_w_m2) : null;
  const temperature = mission.temperature_c !== undefined ? Number(mission.temperature_c) : null;
  const hoursToNight = mission.hours_to_night !== undefined ? Number(mission.hours_to_night) : null;

  return (
    <div className="hud-panel hud-panel-blur p-4 flex flex-col justify-between h-full min-h-[140px]">
      <div className="flex items-center justify-between border-b border-panel-border/40 pb-2">
        <h3 className="hud-title text-xs tracking-wider">
          <Sun className="w-3.5 h-3.5 text-solar" />
          Lunar Environment
        </h3>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan/10 text-cyan border border-cyan/30">
          {mission.scenario || 'Telemetry'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 my-2">
        {/* Phase */}
        <div className="flex flex-col">
          <span className="text-[11px] font-exo uppercase tracking-wider text-muted flex items-center gap-1">
            <Moon className="w-3 h-3 text-cyan" />
            Phase
          </span>
          <span className="font-orbitron text-sm font-semibold text-text uppercase mt-0.5">
            {phase}
          </span>
        </div>

        {/* Dust factor */}
        <div className="flex flex-col">
          <span className="text-[11px] font-exo uppercase tracking-wider text-muted flex items-center gap-1">
            <Wind className="w-3 h-3 text-warn" />
            Dust factor
          </span>
          <span className="font-orbitron text-sm font-semibold text-text mt-0.5">
            <OdometerNumber value={dustFactor} decimals={2} glow={false} />
          </span>
        </div>

        {/* Solar output */}
        <div className="flex flex-col">
          <span className="text-[11px] font-exo uppercase tracking-wider text-muted flex items-center gap-1">
            <Sun className="w-3 h-3 text-solar" />
            Solar output
          </span>
          <span className="font-orbitron text-sm font-bold text-solar mt-0.5">
            <OdometerNumber value={solarKw} decimals={1} suffix="kW" />
          </span>
        </div>
      </div>

      {/* Optional fields rendered strictly when present */}
      {(irradiance !== null || temperature !== null || hoursToNight !== null) && (
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-panel-border/30 text-[11px] font-mono text-muted">
          {irradiance !== null && (
            <div>
              <span className="block text-[10px] uppercase text-muted/80">Irradiance</span>
              <span className="text-text font-semibold">{irradiance} W/m²</span>
            </div>
          )}
          {temperature !== null && (
            <div>
              <span className="block text-[10px] uppercase text-muted/80">Surface Temp</span>
              <span className="text-text font-semibold">{temperature}°C</span>
            </div>
          )}
          {hoursToNight !== null && (
            <div>
              <span className="block text-[10px] uppercase text-muted/80">To Nightfall</span>
              <span className="text-text font-semibold">{hoursToNight}h</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
