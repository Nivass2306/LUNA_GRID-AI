import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Clock,
  SunMedium,
  BatteryCharging,
  AlertTriangle,
  ShieldCheck,
  Table,
  LineChart,
  Compass,
  Moon,
} from 'lucide-react';
import { useSpacegridState } from '../../context/SpacegridContext';
import { ForecastHudChart } from '../../components/ForecastHudChart';

export const ForecastPage = () => {
  const { state } = useSpacegridState();

  const forecast = state?.forecast || [];
  const risk = state?.risk || {};
  const battery = state?.battery || {};

  const isShortage = Boolean(risk.shortage_expected);
  const startHour = Number(risk.start_hour ?? 2);
  const endHour = Number(risk.end_hour ?? 9);
  const maxDeficitKw = Number(risk.max_deficit_kw ?? 0.0);

  const batterySocKwh = Number(battery.soc_kwh ?? 16.5);
  const batteryCapKwh = Number(battery.capacity_kwh ?? 20.0);
  const batterySocPct = Math.round((batterySocKwh / batteryCapKwh) * 100);

  // Time scrubber active state
  const [scrubHour, setScrubHour] = useState(0);
  const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'table'

  // Min solar in forecast
  const minSolar = useMemo(() => {
    if (!forecast.length) return 8.8;
    return Math.min(...forecast.map((f) => Number(f.solar_kw ?? f.solar ?? 8.8)));
  }, [forecast]);

  // Scrubbed telemetry calculation
  const scrubPoint = forecast[scrubHour] || {
    solar_kw: 8.8,
    demand_kw: 8.0,
    usable_battery_kw: 2.5,
  };
  const scrubSolar = Number(scrubPoint.solar_kw ?? scrubPoint.solar ?? 8.8);
  const scrubDemand = Number(scrubPoint.demand_kw ?? scrubPoint.demand ?? 8.0);
  const scrubBattery = Number(scrubPoint.usable_battery_kw ?? scrubPoint.usable_battery ?? 2.5);
  const scrubMargin = scrubSolar - scrubDemand;
  const isScrubInDeficit = isShortage && scrubHour >= startHour && scrubHour <= endHour;

  return (
    <div className="space-y-6">
      {/* 1. SHORTAGE STATUS HEADER & VIEW MODE TOGGLE */}
      <div className="console-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`px-3 py-1 rounded text-xs font-exo font-bold uppercase tracking-wider border ${
                isShortage
                  ? 'bg-[rgba(255,59,78,0.18)] text-[#FF3B4E] border-[#FF3B4E]/50 animate-pulse'
                  : 'bg-[rgba(34,229,139,0.18)] text-[#22E58B] border-[#22E58B]/50'
              }`}
            >
              {isShortage ? 'ORBITAL SHORTAGE PROJECTED' : 'SOLAR COLLECTION NOMINAL'}
            </span>
            <span className="font-exo text-xs text-[#8CA3C2] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#22D3EE]" />
              Horizon: 24 Hours • 1-Hour Step Resolution
            </span>
          </div>

          <h2 className="font-orbitron font-bold text-lg text-[#EAF4FF] tracking-wide">
            {isShortage
              ? `Deficit Window: T+${startHour}.0h – T+${endHour}.0h (${endHour - startHour} Hours Duration)`
              : 'Continuous Daylight Generation across 24h Orbital Arc'}
          </h2>
        </div>

        {/* Chart / Table View Mode Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-[rgba(7,18,40,0.7)] border border-[rgba(56,189,248,0.32)] select-none">
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-exo font-semibold transition-all ${
              viewMode === 'chart'
                ? 'bg-[rgba(34,211,238,0.2)] text-[#22D3EE] border border-[rgba(34,211,238,0.4)] shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                : 'text-[#8CA3C2] hover:text-[#EAF4FF]'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Chart View</span>
          </button>

          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-exo font-semibold transition-all ${
              viewMode === 'table'
                ? 'bg-[rgba(34,211,238,0.2)] text-[#22D3EE] border border-[rgba(34,211,238,0.4)] shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                : 'text-[#8CA3C2] hover:text-[#EAF4FF]'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Table View</span>
          </button>
        </div>
      </div>

      {/* 2. FOUR FORECAST METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Shortage Window */}
        <div className="console-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2]">
              Shortage Window
            </span>
            <div className="font-orbitron font-bold text-2xl text-[#EAF4FF] font-orbitron-numbers">
              {isShortage ? `T+${startHour}h – ${endHour}h` : 'NONE'}
            </div>
            <span className="font-exo text-[11px] text-[#8CA3C2] block">
              {isShortage ? `${endHour - startHour}h shadow duration` : 'Full daylight arc'}
            </span>
          </div>
          <div
            className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
              isShortage
                ? 'bg-[rgba(255,59,78,0.15)] border-[rgba(255,59,78,0.4)] text-[#FF3B4E]'
                : 'bg-[rgba(34,229,139,0.15)] border-[rgba(34,229,139,0.4)] text-[#22E58B]'
            }`}
          >
            {isShortage ? <Moon className="w-5 h-5" /> : <SunMedium className="w-5 h-5" />}
          </div>
        </div>

        {/* Metric 2: Minimum Solar Output */}
        <div className="console-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2]">
              Minimum Solar Flux
            </span>
            <div className="font-orbitron font-bold text-2xl text-[#FFB020] font-orbitron-numbers">
              {minSolar.toFixed(1)} <span className="text-xs font-normal text-[#8CA3C2]">kW</span>
            </div>
            <span className="font-exo text-[11px] text-[#8CA3C2] block">
              {minSolar < 5.0 ? '-70% array degradation' : 'Nominal baseline'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[rgba(255,176,32,0.15)] border border-[rgba(255,176,32,0.4)] flex items-center justify-center text-[#FFB020] shrink-0">
            <SunMedium className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Peak Generation Deficit */}
        <div className="console-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2]">
              Peak Deficit
            </span>
            <div
              className={`font-orbitron font-bold text-2xl font-orbitron-numbers ${
                isShortage ? 'text-[#FF3B4E]' : 'text-[#22E58B]'
              }`}
            >
              {isShortage ? `${maxDeficitKw.toFixed(1)} kW` : '0.0 kW'}
            </div>
            <span className="font-exo text-[11px] text-[#8CA3C2] block">
              {isShortage ? 'Maximum supply shortfall' : 'Zero unserved demand'}
            </span>
          </div>
          <div
            className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
              isShortage
                ? 'bg-[rgba(255,59,78,0.15)] border-[rgba(255,59,78,0.4)] text-[#FF3B4E]'
                : 'bg-[rgba(34,229,139,0.15)] border-[rgba(34,229,139,0.4)] text-[#22E58B]'
            }`}
          >
            {isShortage ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
        </div>

        {/* Metric 4: Battery Reserve & Depletion Risk */}
        <div className="console-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2]">
              Battery Buffer
            </span>
            <div className="font-orbitron font-bold text-2xl text-[#22E58B] font-orbitron-numbers">
              {batterySocPct}% <span className="text-xs font-normal text-[#8CA3C2]">SOC</span>
            </div>
            <span className="font-exo text-[11px] text-[#8CA3C2] block">
              {isShortage ? 'Discharge rate: 2.0 kW' : 'Storage floating at 100%'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[rgba(34,229,139,0.15)] border border-[rgba(34,229,139,0.4)] flex items-center justify-center text-[#22E58B] shrink-0">
            <BatteryCharging className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. MAIN FORECAST DISPLAY (Chart or Table) */}
      {viewMode === 'chart' ? (
        <div className="console-panel p-6 space-y-6">
          <div>
            <h3 className="font-exo text-base font-semibold text-[#EAF4FF] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#22D3EE]" />
              Generation vs Demand Projection (24h Window)
            </h3>
            <p className="font-exo text-xs text-[#8CA3C2]">
              Hover or scrub across time points to inspect hour-by-hour power margins and contingency dispatch
            </p>
          </div>

          {/* Area Chart Component with 0 kW, 4 kW, 8 kW, 12 kW axis */}
          <div className="h-80 w-full">
            <ForecastHudChart
              forecast={forecast}
              risk={risk}
              scrubHour={scrubHour}
              onSelectHour={(h) => setScrubHour(Number(h))}
            />
          </div>

          {/* Interactive Time Scrubber Slider & Telemetry Inspection Card */}
          <div className="pt-4 border-t border-[rgba(56,189,248,0.2)] space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between font-exo text-xs">
                <span className="text-[#8CA3C2] font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#22D3EE]" />
                  Drag Scrubber to Inspect Hourly Telemetry
                </span>
                <span className="font-orbitron font-bold text-[#22D3EE]">
                  Active Point: T+{scrubHour}h:00
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="23"
                value={scrubHour}
                onChange={(e) => setScrubHour(Number(e.target.value))}
                className="w-full h-2 bg-[rgba(3,8,20,0.8)] rounded-lg appearance-none cursor-pointer accent-[#22D3EE] border border-[rgba(56,189,248,0.3)]"
              />

              <div className="flex justify-between font-mono-numbers text-[11px] text-[#8CA3C2]">
                <span>T+0h</span>
                <span>T+4h</span>
                <span>T+8h</span>
                <span>T+12h</span>
                <span>T+16h</span>
                <span>T+20h</span>
                <span>T+23h</span>
              </div>
            </div>

            {/* Scrubber Telemetry Card */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                isScrubInDeficit
                  ? 'bg-[rgba(28,8,15,0.8)] border-[#FF3B4E]/50 shadow-[0_0_15px_rgba(255,59,78,0.15)]'
                  : 'bg-[rgba(7,18,40,0.7)] border-[rgba(56,189,248,0.25)]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="font-orbitron font-bold text-base text-[#EAF4FF]">
                    T+{scrubHour}h:00 FORECAST POINT
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                      isScrubInDeficit
                        ? 'bg-[rgba(255,59,78,0.2)] text-[#FF3B4E] border border-[rgba(255,59,78,0.4)]'
                        : 'bg-[rgba(34,229,139,0.15)] text-[#22E58B] border border-[rgba(34,229,139,0.3)]'
                    }`}
                  >
                    {isScrubInDeficit ? 'DEFICIT WINDOW' : 'NOMINAL DAYLIGHT'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-exo text-xs text-[#8CA3C2]">Net Supply Margin:</span>
                  <span
                    className={`font-mono-numbers font-bold text-sm ${
                      scrubMargin >= 0 ? 'text-[#22E58B]' : 'text-[#FF3B4E]'
                    }`}
                  >
                    {scrubMargin >= 0 ? `+${scrubMargin.toFixed(1)} kW (Surplus)` : `${scrubMargin.toFixed(1)} kW (Deficit)`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 font-exo text-xs">
                <div>
                  <span className="text-[#8CA3C2] block">Solar Array Output</span>
                  <span className="font-orbitron font-semibold text-sm text-[#22D3EE] font-orbitron-numbers">
                    {scrubSolar.toFixed(1)} kW
                  </span>
                </div>
                <div>
                  <span className="text-[#8CA3C2] block">Habitat Demand</span>
                  <span className="font-orbitron font-semibold text-sm text-[#A855F7] font-orbitron-numbers">
                    {scrubDemand.toFixed(1)} kW
                  </span>
                </div>
                <div>
                  <span className="text-[#8CA3C2] block">Battery Headroom</span>
                  <span className="font-orbitron font-semibold text-sm text-[#22E58B] font-orbitron-numbers">
                    {scrubBattery.toFixed(1)} kW
                  </span>
                </div>
                <div>
                  <span className="text-[#8CA3C2] block">Advisory Protocol</span>
                  <span className="font-exo font-semibold text-xs text-[#EAF4FF] truncate block">
                    {isScrubInDeficit ? 'Prioritize Life Support' : 'All Loads Nominal'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Table View: 24-hour detailed breakdown */
        <div className="console-panel p-4 overflow-hidden space-y-3">
          <div className="px-2 pt-2">
            <h3 className="font-exo text-base font-semibold text-[#EAF4FF] flex items-center gap-2">
              <Table className="w-4 h-4 text-[#22D3EE]" />
              24-Hour Tabular Telemetry Breakdown
            </h3>
            <p className="font-exo text-xs text-[#8CA3C2]">
              Hourly resolution showing generation, requirement, usable storage, and deficit intervals
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-exo text-xs">
              <thead>
                <tr className="border-b border-[rgba(56,189,248,0.2)] text-[#8CA3C2] uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Timeline</th>
                  <th className="py-2.5 px-3">Solar Generation</th>
                  <th className="py-2.5 px-3">Base Demand</th>
                  <th className="py-2.5 px-3">Battery Headroom</th>
                  <th className="py-2.5 px-3">Net Margin</th>
                  <th className="py-2.5 px-3">Operational Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(56,189,248,0.08)]">
                {forecast.map((row) => {
                  const h = Number(row.hour);
                  const isDeficit = isShortage && h >= startHour && h <= endHour;
                  const s = Number(row.solar_kw ?? row.solar ?? 0);
                  const d = Number(row.demand_kw ?? row.demand ?? 0);
                  const b = Number(row.usable_battery_kw ?? row.usable_battery ?? 0);
                  const margin = s - d;

                  return (
                    <tr
                      key={h}
                      className={`transition-colors ${
                        isDeficit
                          ? 'bg-[rgba(255,59,78,0.08)] hover:bg-[rgba(255,59,78,0.15)]'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono-numbers font-semibold text-[#EAF4FF] whitespace-nowrap">
                        T+{h}h:00
                      </td>
                      <td className="py-2.5 px-3 font-mono-numbers text-[#22D3EE] font-bold">
                        {s.toFixed(1)} kW
                      </td>
                      <td className="py-2.5 px-3 font-mono-numbers text-[#A855F7] font-bold">
                        {d.toFixed(1)} kW
                      </td>
                      <td className="py-2.5 px-3 font-mono-numbers text-[#22E58B]">
                        {b.toFixed(1)} kW
                      </td>
                      <td
                        className={`py-2.5 px-3 font-mono-numbers font-bold ${
                          margin >= 0 ? 'text-[#22E58B]' : 'text-[#FF3B4E]'
                        }`}
                      >
                        {margin >= 0 ? `+${margin.toFixed(1)} kW` : `${margin.toFixed(1)} kW`}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${
                            isDeficit
                              ? 'bg-[rgba(255,59,78,0.15)] text-[#FF3B4E] border-[rgba(255,59,78,0.4)]'
                              : 'bg-[rgba(34,229,139,0.15)] text-[#22E58B] border-[rgba(34,229,139,0.3)]'
                          }`}
                        >
                          {isDeficit ? 'DEFICIT WINDOW' : 'NOMINAL'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ADVISORY NOTES & LUNAR ORBITAL MECHANICS */}
      <div className="console-panel p-6 space-y-3">
        <h3 className="font-orbitron font-semibold text-sm text-[#EAF4FF] flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#22D3EE]" />
          ORBITAL INSOLATION & CONTINGENCY MITIGATION ARCHITECTURE
        </h3>
        <p className="font-exo text-xs text-[#8CA3C2] leading-relaxed">
          The forecast engine couples real-time solar panel sensor telemetry with predictive lunar orbital ephemeris models.
          When an eclipse penumbra transit is anticipated, SPACEGRID AI preemptively calculates critical reserve margins
          to ensure human life support never drops below 3.0 kW nominal safety standards.
        </p>
      </div>
    </div>
  );
};
