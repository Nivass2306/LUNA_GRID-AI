import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  SunMedium,
  BatteryCharging,
  Zap,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  Clock,
  Activity,
  Layers,
  Thermometer,
  Eye,
} from 'lucide-react';
import { useSpacegridState } from '../../context/SpacegridContext';
import { Sparkline } from '../../components/Sparkline';

export const OverviewPage = () => {
  const { state } = useSpacegridState();

  const power = state?.power || {};
  const battery = state?.battery || {};
  const survival = state?.survival || {};
  const alert = state?.alert || {};
  const risk = state?.risk || {};
  const mission = state?.mission || {};
  const loads = state?.loads || [];
  const forecast = state?.forecast || [];

  // Telemetry values: all live, null if missing
  const solarKw = power.solar_kw !== null && power.solar_kw !== undefined ? Number(power.solar_kw) : null;
  const demandKw = power.demand_kw !== null && power.demand_kw !== undefined ? Number(power.demand_kw) : null;
  const availableKw = power.available_kw !== null && power.available_kw !== undefined ? Number(power.available_kw) : null;

  const socKwh = battery.soc_kwh !== null && battery.soc_kwh !== undefined ? Number(battery.soc_kwh) : null;
  const capacityKwh = battery.capacity_kwh !== null && battery.capacity_kwh !== undefined ? Number(battery.capacity_kwh) : null;
  const socPct = (socKwh !== null && capacityKwh !== null && capacityKwh > 0)
    ? Math.min(100, Math.max(0, Math.round((socKwh / capacityKwh) * 100)))
    : null;

  // Life support load specifics
  const lifeSupportLoad = loads.find((l) => l.id === 'life_support' || l.name?.toLowerCase().includes('life'));
  const lsAllocated = lifeSupportLoad?.allocated_kw !== null && lifeSupportLoad?.allocated_kw !== undefined
    ? Number(lifeSupportLoad.allocated_kw)
    : null;
  const lsNeeded = lifeSupportLoad?.need_kw !== null && lifeSupportLoad?.need_kw !== undefined
    ? Number(lifeSupportLoad.need_kw)
    : null;
  const isLsOk = alert.life_support_ok !== false && (lsAllocated === null || lsNeeded === null || lsAllocated >= lsNeeded - 1e-4);

  // Survival hours calculation: null -> "Sustained", 0 -> "0 h (unsafe)", no fallbacks
  const survivalHours = survival.hours_now ?? null;
  const isUnsafe = !isLsOk || alert.level === 'red';

  // Environmental telemetry
  const dustFactor = mission.dust_factor !== null && mission.dust_factor !== undefined ? Number(mission.dust_factor) : null;
  const dustAccumPct = dustFactor !== null ? (dustFactor * 100).toFixed(1) : '--';
  const opticalTransPct = dustFactor !== null ? ((1 - dustFactor) * 100).toFixed(1) : '--';
  const surfaceTemp = mission.temperature_c !== undefined ? `${mission.temperature_c}°C` : '--';
  const irradiance = mission.irradiance_w_m2 !== undefined ? `${mission.irradiance_w_m2} W/m²` : '--';
  const lunarPhase = mission.scenario ? `LUNAR DAY 6 • ${mission.scenario.toUpperCase()}` : 'LUNAR TELEMETRY ACTIVE';

  // Shortage Forecast window details
  const isShortageExpected = Boolean(risk.shortage_expected);
  const startHour = Number(risk.start_hour ?? 2);
  const endHour = Number(risk.end_hour ?? 9);
  const maxDeficitKw = Number(risk.max_deficit_kw ?? 0.0);

  // Sparkline data sequences (24h fallback generated if empty)
  const solarSparkData = useMemo(() => {
    if (forecast.length > 0) return forecast;
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      solar_kw: solarKw + Math.sin(i / 3) * 0.4,
    }));
  }, [forecast, solarKw]);

  const demandSparkData = useMemo(() => {
    if (forecast.length > 0) return forecast;
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      demand_kw: demandKw + Math.cos(i / 4) * 0.3,
    }));
  }, [forecast, demandKw]);

  const batterySparkData = useMemo(() => {
    if (forecast.length > 0) return forecast;
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      usable_battery_kw: Math.max(0.5, 2.5 - (i > 2 && i < 10 ? (i - 2) * 0.2 : 0)),
    }));
  }, [forecast]);

  return (
    <div className="space-y-6">
      {/* 1. HERO SURVIVAL READOUT PANEL */}
      <div
        className={`console-panel p-6 md:p-8 relative overflow-hidden transition-all duration-300 ${
          isUnsafe
            ? 'console-panel-danger border-[#FF3B4E]/60 shadow-[0_4px_30px_rgba(255,59,78,0.25)]'
            : 'border-[rgba(56,189,248,0.35)] shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            {/* Status Chip & Telemetry Source */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`px-3 py-1 rounded text-xs font-exo font-bold uppercase tracking-wider border ${
                  isUnsafe
                    ? 'bg-[rgba(255,59,78,0.18)] text-[#FF3B4E] border-[#FF3B4E]/50 animate-pulse'
                    : isShortageExpected
                    ? 'bg-[rgba(255,194,51,0.18)] text-[#FFC233] border-[#FFC233]/50'
                    : 'bg-[rgba(34,229,139,0.18)] text-[#22E58B] border-[#22E58B]/50'
                }`}
              >
                {isUnsafe
                  ? 'CRITICAL SHORTAGE'
                  : isShortageExpected
                  ? 'MONITORING ECLIPSE TRANSIT'
                  : 'AUTONOMOUS DISPATCH NOMINAL'}
              </span>

              <span className="font-exo text-xs text-[#8CA3C2] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#22D3EE]" />
                Live Twin Telemetry Synchronized
              </span>
            </div>

            {/* Survival Readout */}
            <div className="flex items-baseline gap-4 pt-1">
              <span
                className={`font-orbitron font-extrabold tracking-tight drop-shadow-[0_0_35px_rgba(34,211,238,0.35)] leading-none ${
                  survivalHours === null
                    ? 'text-4xl sm:text-6xl lg:text-7xl xl:text-8xl text-[#22E58B]'
                    : Number(survivalHours) <= 0.001
                    ? 'text-4xl sm:text-6xl lg:text-7xl xl:text-8xl text-[#FF3B4E]'
                    : 'text-6xl sm:text-7xl lg:text-8xl xl:text-9xl text-[#EAF4FF] font-orbitron-numbers'
                }`}
              >
                {survivalHours === null
                  ? 'Sustained'
                  : Number(survivalHours) <= 0.001
                  ? '0 h (unsafe)'
                  : Number(survivalHours).toFixed(1)}
              </span>
              {survivalHours !== null && Number(survivalHours) > 0.001 && (
                <div className="flex flex-col">
                  <span className="font-orbitron font-bold text-2xl sm:text-3xl text-[#22D3EE] tracking-wide">
                    HOURS
                  </span>
                  <span className="font-exo text-[11px] uppercase tracking-widest text-[#8CA3C2]">
                    SURVIVAL HEADROOM
                  </span>
                </div>
              )}
              {(survivalHours === null || Number(survivalHours) <= 0.001) && (
                <div className="flex flex-col">
                  <span className="font-exo text-[11px] uppercase tracking-widest text-[#8CA3C2]">
                    SURVIVAL HEADROOM
                  </span>
                </div>
              )}
            </div>

            {/* Clear Situation Explanation Message */}
            <p className="font-exo text-sm text-[#8CA3C2] leading-relaxed pt-1">
              {isUnsafe
                ? 'CRITICAL DEFICIT: Life support allocation is short of life-safety thresholds. Battery depletion impending unless emergency load shedding is authorized.'
                : isShortageExpected
                ? 'Solar collection dropped. SPACEGRID AI has formulated an emergency shedding plan to sustain life support while shedding lower-priority subsystems.'
                : 'All habitat life-support and mission payloads are fully powered under active autonomous dispatch. Storage cells floating at optimal reserve buffer.'}
            </p>
          </div>

          {/* Quick Route Action Tiles */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
            <Link
              to="/console/forecast"
              className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-[rgba(7,18,40,0.7)] border border-[rgba(56,189,248,0.32)] hover:border-[#22D3EE] text-[#EAF4FF] hover:text-[#22D3EE] transition-all group shadow-md"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#22D3EE]" />
                <span className="font-exo text-xs font-semibold">Shortage Forecast</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 text-[11px] font-mono text-[#8CA3C2] bg-white/5 rounded">2</kbd>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              to="/console/allocation"
              className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-[rgba(7,18,40,0.7)] border border-[rgba(56,189,248,0.32)] hover:border-[#22D3EE] text-[#EAF4FF] hover:text-[#22D3EE] transition-all group shadow-md"
            >
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-[#22D3EE]" />
                <span className="font-exo text-xs font-semibold">Power Allocation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 text-[11px] font-mono text-[#8CA3C2] bg-white/5 rounded">3</kbd>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              to="/console/simulation"
              className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-[rgba(34,211,238,0.12)] border border-[rgba(34,211,238,0.4)] hover:border-[#22D3EE] text-[#22D3EE] transition-all group shadow-md"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-[#22D3EE]" />
                <span className="font-exo text-xs font-semibold">Simulation Sandbox</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 text-[11px] font-mono text-[#22D3EE] bg-black/40 rounded">6</kbd>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. ENVIRONMENTAL TELEMETRY BAR (Each in .console-panel with padding) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="console-panel p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgba(34,211,238,0.12)] border border-[rgba(34,211,238,0.3)] flex items-center justify-center text-[#22D3EE] shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="font-exo text-[11px] uppercase tracking-wider text-[#8CA3C2] block">
              LUNAR EPHEMERIS
            </span>
            <span className="font-orbitron font-semibold text-xs text-[#EAF4FF] truncate block">
              {lunarPhase}
            </span>
          </div>
        </div>

        <div className="console-panel p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgba(255,176,32,0.12)] border border-[rgba(255,176,32,0.3)] flex items-center justify-center text-[#FFB020] shrink-0">
            <SunMedium className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="font-exo text-[11px] uppercase tracking-wider text-[#8CA3C2] block">
              SOLAR IRRADIANCE
            </span>
            <span className="font-mono-numbers font-semibold text-xs text-[#EAF4FF] block">
              {irradiance}
            </span>
          </div>
        </div>

        <div className="console-panel p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgba(34,229,139,0.12)] border border-[rgba(34,229,139,0.3)] flex items-center justify-center text-[#22E58B] shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="font-exo text-[11px] uppercase tracking-wider text-[#8CA3C2] block">
              REGOLITH DUST FACTOR
            </span>
            <span className="font-mono-numbers font-semibold text-xs text-[#EAF4FF] block">
              {dustAccumPct}% ({opticalTransPct}% T)
            </span>
          </div>
        </div>

        <div className="console-panel p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgba(168,85,247,0.12)] border border-[rgba(168,85,247,0.3)] flex items-center justify-center text-[#A855F7] shrink-0">
            <Thermometer className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="font-exo text-[11px] uppercase tracking-wider text-[#8CA3C2] block">
              SURFACE TEMPERATURE
            </span>
            <span className="font-mono-numbers font-semibold text-xs text-[#EAF4FF] block">
              {surfaceTemp} (Albedo 0.12)
            </span>
          </div>
        </div>
      </div>

      {/* 3. FOUR KPI CARDS (Each in .console-panel with padding) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Solar Array Output */}
        <div className="console-panel p-5 flex flex-col justify-between space-y-4 hover:border-[rgba(56,189,248,0.45)] transition-all">
          <div className="flex items-center justify-between">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2] flex items-center gap-1.5 font-semibold">
              <SunMedium className="w-4 h-4 text-[#FFB020]" />
              SOLAR ARRAY OUTPUT
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-[#FFB020] bg-[rgba(255,176,32,0.12)] border border-[rgba(255,176,32,0.3)]">
              {solarKw !== null ? (solarKw < 5.0 ? 'LOW' : 'NOMINAL') : '--'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="font-orbitron font-bold text-3xl text-[#EAF4FF] font-orbitron-numbers">
                {solarKw !== null ? solarKw.toFixed(1) : '--'}
              </span>
              <span className="font-orbitron text-xs text-[#8CA3C2]">kW</span>
            </div>
            <span className="font-exo text-xs text-[#8CA3C2]">
              Solar Array
            </span>
          </div>

          {/* Sparkline & Range */}
          <div className="pt-2 flex items-center justify-between border-t border-[rgba(56,189,248,0.16)]">
            <Sparkline
              data={solarSparkData}
              dataKey="solar_kw"
              strokeColor="#FFB020"
              height={32}
              width={140}
            />
            <span className="font-mono-numbers text-[11px] text-[#8CA3C2]">
              24h Trend
            </span>
          </div>
        </div>

        {/* KPI 2: Battery Storage Reserve */}
        <div className="console-panel p-5 flex flex-col justify-between space-y-4 hover:border-[rgba(56,189,248,0.45)] transition-all">
          <div className="flex items-center justify-between">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2] flex items-center gap-1.5 font-semibold">
              <BatteryCharging className="w-4 h-4 text-[#22E58B]" />
              STORAGE CELL RESERVE
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-[#22E58B] bg-[rgba(34,229,139,0.12)] border border-[rgba(34,229,139,0.3)]">
              {socPct !== null ? `${socPct}% SOC` : '--'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="font-orbitron font-bold text-3xl text-[#22E58B] font-orbitron-numbers">
                {socKwh !== null ? socKwh.toFixed(1) : '--'}
              </span>
              <span className="font-orbitron text-xs text-[#8CA3C2]">/ {capacityKwh !== null ? capacityKwh.toFixed(0) : '--'} kWh</span>
            </div>
            <span className="font-exo text-xs text-[#8CA3C2]">
              Cap: {capacityKwh !== null ? `${capacityKwh.toFixed(0)} kWh` : '--'}
            </span>
          </div>

          {/* Sparkline & Range */}
          <div className="pt-2 flex items-center justify-between border-t border-[rgba(56,189,248,0.16)]">
            <Sparkline
              data={batterySparkData}
              dataKey="usable_battery_kw"
              strokeColor="#22E58B"
              height={32}
              width={140}
            />
            <span className="font-mono-numbers text-[11px] text-[#8CA3C2]">
              Discharge Headroom
            </span>
          </div>
        </div>

        {/* KPI 3: Habitat Base Demand */}
        <div className="console-panel p-5 flex flex-col justify-between space-y-4 hover:border-[rgba(56,189,248,0.45)] transition-all">
          <div className="flex items-center justify-between">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2] flex items-center gap-1.5 font-semibold">
              <Zap className="w-4 h-4 text-[#A855F7]" />
              BASE ELECTRICAL DEMAND
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-[#A855F7] bg-[rgba(168,85,247,0.12)] border border-[rgba(168,85,247,0.3)]">
              {availableKw !== null ? `${availableKw.toFixed(1)} kW AVAIL` : '--'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="font-orbitron font-bold text-3xl text-[#A855F7] font-orbitron-numbers">
                {demandKw !== null ? demandKw.toFixed(1) : '--'}
              </span>
              <span className="font-orbitron text-xs text-[#8CA3C2]">kW Req</span>
            </div>
            <span className="font-exo text-xs text-[#8CA3C2]">
              Alloc: {demandKw !== null && availableKw !== null ? `${Math.min(demandKw, availableKw).toFixed(1)} kW` : '--'}
            </span>
          </div>

          {/* Sparkline & Range */}
          <div className="pt-2 flex items-center justify-between border-t border-[rgba(56,189,248,0.16)]">
            <Sparkline
              data={demandSparkData}
              dataKey="demand_kw"
              strokeColor="#A855F7"
              height={32}
              width={140}
            />
            <span className="font-mono-numbers text-[11px] text-[#8CA3C2]">
              24h Demand
            </span>
          </div>
        </div>

        {/* KPI 4: Life Support Status */}
        <div
          className={`console-panel p-5 flex flex-col justify-between space-y-4 hover:border-[rgba(56,189,248,0.45)] transition-all ${
            !isLsOk ? 'console-panel-danger border-[#FF3B4E]/60' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2] flex items-center gap-1.5 font-semibold">
              <ShieldCheck
                className={`w-4 h-4 ${isLsOk ? 'text-[#22E58B]' : 'text-[#FF3B4E]'}`}
              />
              LIFE SUPPORT DISPATCH
            </span>
            <span
              className={`status-chip ${
                isLsOk ? 'status-chip-protected' : 'status-chip-postponed animate-pulse'
              }`}
            >
              {isLsOk ? 'PROTECTED' : 'DEFICIT'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-orbitron font-bold text-3xl font-orbitron-numbers ${
                  isLsOk ? 'text-[#EAF4FF]' : 'text-[#FF3B4E]'
                }`}
              >
                {lsAllocated !== null ? lsAllocated.toFixed(1) : '--'}
              </span>
              <span className="font-orbitron text-xs text-[#8CA3C2]">/ {lsNeeded !== null ? lsNeeded.toFixed(1) : '--'} kW</span>
            </div>
            <span className="font-exo text-xs text-[#8CA3C2]">
              Safety Req: 3.0 kW
            </span>
          </div>

          {/* Safety Bar Progress */}
          <div className="pt-2 border-t border-[rgba(56,189,248,0.16)] space-y-1.5">
            <div className="flex justify-between font-mono-numbers text-[11px] text-[#8CA3C2]">
              <span>Coverage Ratio</span>
              <span className={isLsOk ? 'text-[#22E58B] font-bold' : 'text-[#FF3B4E] font-bold'}>
                {lsAllocated !== null && lsNeeded !== null && lsNeeded > 0
                  ? `${Math.round((lsAllocated / lsNeeded) * 100)}%`
                  : '--%'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isLsOk ? 'bg-[#22E58B]' : 'bg-[#FF3B4E]'
                }`}
                style={{
                  width: `${lsAllocated !== null && lsNeeded !== null && lsNeeded > 0 ? Math.min(100, (lsAllocated / lsNeeded) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. SHORTAGE FORECAST HORIZONTAL STRIP (Next 24h orbital window) */}
      <div className="console-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[rgba(56,189,248,0.2)]">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-[#22D3EE]" />
            <div>
              <h2 className="font-exo text-base font-semibold text-[#EAF4FF]">
                Orbital Shortage Forecast (Next 24 Hours)
              </h2>
              <p className="font-exo text-xs text-[#8CA3C2]">
                Predicted lunar shadow entry and microgrid power deficit window
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase ${
                isShortageExpected
                  ? 'bg-[rgba(255,59,78,0.18)] text-[#FF3B4E] border border-[rgba(255,59,78,0.5)]'
                  : 'bg-[rgba(34,229,139,0.18)] text-[#22E58B] border border-[rgba(34,229,139,0.5)]'
              }`}
            >
              {isShortageExpected ? `DEFICIT T+${startHour}h–${endHour}h` : 'NO SHORTAGE PROJECTED'}
            </span>
          </div>
        </div>

        {/* 24-Hour Visual Timeline Segment Bar */}
        <div className="space-y-2 pt-1">
          <div className="relative w-full h-8 bg-[rgba(3,8,20,0.7)] border border-[rgba(56,189,248,0.22)] rounded-lg flex overflow-hidden p-1 gap-0.5">
            {Array.from({ length: 24 }).map((_, h) => {
              const isDeficit = isShortageExpected && h >= startHour && h <= endHour;
              const isNow = h === 0;

              return (
                <div
                  key={h}
                  title={`Hour T+${h}h: ${isDeficit ? 'Shortage Window' : 'Daylight Nominal'}`}
                  className={`flex-1 h-full rounded-xs transition-colors relative group ${
                    isDeficit
                      ? 'bg-[rgba(255,59,78,0.65)] hover:bg-[#FF3B4E] shadow-[0_0_8px_rgba(255,59,78,0.4)]'
                      : 'bg-[rgba(34,211,238,0.25)] hover:bg-[#22D3EE]'
                  }`}
                >
                  {isNow && (
                    <div className="absolute inset-y-0 left-0 w-1 bg-white shadow-[0_0_6px_#fff]" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Time Legend Markers */}
          <div className="flex justify-between font-mono-numbers text-[11px] text-[#8CA3C2] px-1">
            <span>T+0h (Now)</span>
            <span>T+6h</span>
            <span>T+12h</span>
            <span>T+18h</span>
            <span>T+24h</span>
          </div>
        </div>

        {/* Deficit Metric Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 font-exo text-xs">
          <div className="p-3 rounded-lg bg-[rgba(7,18,40,0.7)] border border-[rgba(56,189,248,0.2)]">
            <span className="text-[#8CA3C2] block">Deficit Duration</span>
            <span className="font-orbitron font-semibold text-sm text-[#EAF4FF] mt-0.5 block">
              {isShortageExpected ? `${endHour - startHour} Hours` : '0 Hours'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[rgba(7,18,40,0.7)] border border-[rgba(56,189,248,0.2)]">
            <span className="text-[#8CA3C2] block">Max Generation Deficit</span>
            <span className="font-orbitron font-semibold text-sm text-[#FFC233] mt-0.5 block">
              {isShortageExpected ? `${maxDeficitKw.toFixed(1)} kW` : '0.0 kW'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[rgba(7,18,40,0.7)] border border-[rgba(56,189,248,0.2)]">
            <span className="text-[#8CA3C2] block">Mitigation Status</span>
            <span className="font-orbitron font-semibold text-sm text-[#22E58B] mt-0.5 block">
              {isShortageExpected ? 'Load Shedding Active' : 'All Loads Nominal'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. SUBSYSTEM LOADS AT A GLANCE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-exo text-base font-semibold text-[#EAF4FF] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#22D3EE]" />
              Habitat Subsystem Loads at a Glance
            </h2>
            <p className="font-exo text-xs text-[#8CA3C2]">
              Click any load card to view full allocation breakdown and AI justification
            </p>
          </div>
          <Link
            to="/console/allocation"
            className="font-exo text-xs text-[#22D3EE] hover:underline flex items-center gap-1 font-semibold group"
          >
            <span>Allocation Page (3)</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {loads.map((load) => {
            const allocated = Number(load.allocated_kw ?? load.allocated ?? 0);
            const needed = Number(load.need_kw ?? load.need ?? 1);
            const pct = Math.min(100, Math.round((allocated / needed) * 100));
            const isProtected = (load.status || '').toLowerCase() === 'protected';
            const isReduced = (load.status || '').toLowerCase() === 'reduced';

            return (
              <Link
                key={load.id}
                to="/console/allocation"
                className="console-panel p-4 flex flex-col justify-between space-y-3 hover:border-[#22D3EE] transition-all group shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-exo text-xs font-semibold text-[#EAF4FF] group-hover:text-[#22D3EE] transition-colors truncate">
                    {load.name}
                  </span>
                  <span
                    className={`status-chip ${
                      isProtected
                        ? 'status-chip-protected'
                        : isReduced
                        ? 'status-chip-reduced'
                        : 'status-chip-postponed'
                    }`}
                  >
                    {load.status || 'Active'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between font-mono-numbers text-xs">
                  <span className="font-bold text-[#EAF4FF]">
                    {allocated.toFixed(1)} <span className="text-[11px] text-[#8CA3C2]">kW</span>
                  </span>
                  <span className="text-[#8CA3C2] text-[11px]">
                    / {needed.toFixed(1)} kW ({pct}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isProtected
                        ? 'bg-[#22E58B]'
                        : isReduced
                        ? 'bg-[#FFC233]'
                        : 'bg-[#FF3B4E]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="text-[11px] text-[#8CA3C2] font-exo truncate group-hover:text-[#EAF4FF] transition-colors flex items-center justify-between pt-1">
                  <span>View Details</span>
                  <ArrowRight className="w-3 h-3 text-[#22D3EE] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
