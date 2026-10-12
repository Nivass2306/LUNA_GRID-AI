import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import {
  BatteryCharging,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Clock,
  Sliders,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  Home,
  Radio,
  Microscope,
  Car,
  Info,
  RefreshCw,
} from 'lucide-react';
import { getHorizonPlan } from '../lib/api';
import { useLunagridState } from '../context/LunagridContext';

const LOAD_CONFIG = {
  life_support: {
    name: 'Life Support',
    color: '#22E58B',
    icon: HeartHandshake,
    tier: 'CRITICAL',
    priority: 1,
  },
  habitat: {
    name: 'Habitat Systems',
    color: '#38BDF8',
    icon: Home,
    tier: 'HIGH',
    priority: 2,
  },
  comms: {
    name: 'Communication',
    color: '#A855F7',
    icon: Radio,
    tier: 'HIGH',
    priority: 3,
  },
  science: {
    name: 'Science Experiments',
    color: '#FFB020',
    icon: Microscope,
    tier: 'LOWER',
    priority: 4,
  },
  rover: {
    name: 'Rover Charging',
    color: '#FF7A1A',
    icon: Car,
    tier: 'LOWEST',
    priority: 5,
  },
};

const CustomPlanTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const isLsOk = data.life_support_ok;

  return (
    <div className="bg-[#071228] border border-[rgba(56,189,248,0.4)] rounded-xl p-3 shadow-2xl text-xs space-y-2 z-50 min-w-[210px] backdrop-blur-md">
      <div className="flex items-center justify-between pb-1.5 border-b border-[rgba(56,189,248,0.18)]">
        <span className="font-orbitron font-bold text-[#EAF4FF]">
          Hour +{data.hour} ({String(data.clock_hour).padStart(2, '0')}:00)
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
            isLsOk
              ? 'bg-[#22E58B]/15 text-[#22E58B] border border-[#22E58B]/30'
              : 'bg-[#FF3B4E]/15 text-[#FF3B4E] border border-[#FF3B4E]/30 animate-pulse'
          }`}
        >
          {isLsOk ? 'LIFE SUPPORT OK' : 'DEFICIT RISK'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 font-mono-numbers text-[11px] pb-1 border-b border-[rgba(56,189,248,0.1)]">
        <div>
          <span className="text-[#8CA3C2] text-[10px] block">Solar:</span>
          <span className="text-[#FFC857] font-semibold">{Number(data.solar_kw).toFixed(2)} kW</span>
        </div>
        <div>
          <span className="text-[#8CA3C2] text-[10px] block">Battery SoC:</span>
          <span className="text-[#22D3EE] font-semibold">{Number(data.soc_kwh).toFixed(2)} kWh</span>
        </div>
        <div>
          <span className="text-[#8CA3C2] text-[10px] block">Discharge:</span>
          <span className="text-[#38BDF8]">{Number(data.battery_discharge_kw).toFixed(2)} kW</span>
        </div>
        <div>
          <span className="text-[#8CA3C2] text-[10px] block">Charge:</span>
          <span className="text-[#34D399]">{Number(data.battery_charge_kw).toFixed(2)} kW</span>
        </div>
      </div>

      <div className="space-y-1 font-mono-numbers text-[11px]">
        <div className="flex justify-between items-center text-[#22E58B]">
          <span>Life Support:</span>
          <span className="font-bold">{Number(data.life_support ?? 0).toFixed(2)} / 3.0 kW</span>
        </div>
        <div className="flex justify-between items-center text-[#38BDF8]">
          <span>Habitat:</span>
          <span>{Number(data.habitat ?? 0).toFixed(2)} / 2.0 kW</span>
        </div>
        <div className="flex justify-between items-center text-[#A855F7]">
          <span>Comms:</span>
          <span>{Number(data.comms ?? 0).toFixed(2)} / 1.2 kW</span>
        </div>
        <div className="flex justify-between items-center text-[#FFB020]">
          <span>Science:</span>
          <span>{Number(data.science ?? 0).toFixed(2)} / 1.0 kW</span>
        </div>
        <div className="flex justify-between items-center text-[#FF7A1A]">
          <span>Rover:</span>
          <span>{Number(data.rover ?? 0).toFixed(2)} / 0.8 kW</span>
        </div>
      </div>
    </div>
  );
};

export const HorizonPlanSection = () => {
  const { state } = useLunagridState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [selectedHour, setSelectedHour] = useState(0);

  // Fetch plan from backend whenever state telemetry updates (drop, blackout, reset, etc.)
  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getHorizonPlan();
      setPlanData(data);
    } catch (err) {
      console.error('Failed to load 24-hour horizon plan:', err);
      setError(err.message || 'Failed to generate 24-hour horizon plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan, state?.timestamp, state?.power?.available_kw, state?.power?.solar_kw]);

  // Chart data formatted for stacked area
  const chartData = useMemo(() => {
    if (!planData?.plan) return [];
    return planData.plan.map((item) => {
      const allocs = item.allocations || {};
      return {
        ...item,
        name: `+${item.hour}h`,
        life_support: Number(allocs.life_support ?? 0),
        habitat: Number(allocs.habitat ?? 0),
        comms: Number(allocs.comms ?? 0),
        science: Number(allocs.science ?? 0),
        rover: Number(allocs.rover ?? 0),
        soc_kwh: Number(item.soc_kwh ?? 0),
        solar_kw: Number(item.solar_kw ?? 0),
      };
    });
  }, [planData]);

  // Find continuous intervals of hours at risk to render shaded reference areas
  const atRiskIntervals = useMemo(() => {
    if (!planData?.plan) return [];
    const intervals = [];
    let currentStart = null;

    planData.plan.forEach((h, idx) => {
      if (!h.life_support_ok) {
        if (currentStart === null) currentStart = idx;
      } else {
        if (currentStart !== null) {
          intervals.push({ start: currentStart, end: idx - 1 });
          currentStart = null;
        }
      }
    });

    if (currentStart !== null) {
      intervals.push({ start: currentStart, end: planData.plan.length - 1 });
    }

    return intervals;
  }, [planData]);

  const currentHourData = useMemo(() => {
    if (!planData?.plan || planData.plan.length === 0) return null;
    return planData.plan[selectedHour] || planData.plan[0];
  }, [planData, selectedHour]);

  const comparison = planData?.comparison || {};
  const naive = comparison.naive || {};
  const lunagrid = (comparison.lunagrid || comparison.spacegrid) || {};
  const hoursSaved = comparison.hours_saved ?? 0;
  const minReserveKwh = planData?.battery?.min_reserve_kwh ?? 3.0;

  return (
    <div className="space-y-6">
      {/* 1. Header with Advisory Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-orbitron font-bold text-base md:text-lg text-[#EAF4FF] tracking-wide flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#22D3EE]" />
              24-HOUR BATTERY-AWARE DISPATCH PLAN
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(34,211,238,0.15)] text-[#22D3EE] border border-[rgba(34,211,238,0.3)]">
              MULTI-PERIOD LP
            </span>
          </div>
          <p className="font-exo text-xs text-[#8CA3C2] mt-0.5">
            Dynamic linear optimization solving across all 24 forecast hours. Conserves battery capacity during sunny hours so human life support remains protected through the shortage window.
          </p>
        </div>

        <button
          onClick={fetchPlan}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-exo font-semibold bg-[rgba(7,18,40,0.8)] hover:bg-[rgba(14,29,64,0.9)] text-[#8CA3C2] hover:text-[#EAF4FF] border border-[rgba(56,189,248,0.2)] transition-all active:scale-95 disabled:opacity-50"
          title="Recalculate 24-hour horizon plan"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#22D3EE]' : ''}`} />
          <span>Refresh Plan</span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && !planData && (
        <div className="console-panel p-6 space-y-4 animate-pulse">
          <div className="h-24 bg-[rgba(56,189,248,0.08)] rounded-xl" />
          <div className="h-80 bg-[rgba(56,189,248,0.05)] rounded-xl" />
          <div className="h-44 bg-[rgba(56,189,248,0.06)] rounded-xl" />
        </div>
      )}

      {/* Error Banner */}
      {error && !loading && (
        <div className="console-panel-danger p-4 flex items-center justify-between gap-3 text-xs font-exo text-[#FF8591]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#FF3B4E] shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchPlan}
            className="px-3 py-1 rounded bg-[#FF3B4E]/20 text-[#FF3B4E] border border-[#FF3B4E]/40 font-semibold hover:bg-[#FF3B4E]/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {planData && (
        <>
          {/* 2. POLICY COMPARISON CARD: Naive vs LUNAGRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Naive Card */}
            <div className="console-panel p-5 border-l-4 border-l-[#FF7A1A]/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-orbitron font-semibold text-xs text-[#FF7A1A] tracking-wider uppercase">
                    BASELINE DISPATCH
                  </span>
                  <span className="text-[10px] font-mono text-[#8CA3C2] bg-[rgba(3,8,20,0.6)] px-2 py-0.5 rounded border border-[rgba(56,189,248,0.1)]">
                    Aggressive Early Discharge
                  </span>
                </div>
                <h3 className="font-orbitron font-bold text-base text-[#EAF4FF] mt-1">
                  Naive Battery Use
                </h3>
                <p className="font-exo text-xs text-[#8CA3C2] mt-1 leading-relaxed">
                  Discharges available battery immediately to cover all peripheral loads during early deficit, depleting reserves prematurely before prolonged eclipse or deep night.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[rgba(56,189,248,0.12)] grid grid-cols-3 gap-2 text-center font-mono-numbers">
                <div className="bg-[rgba(3,8,20,0.5)] p-2 rounded-lg border border-[rgba(56,189,248,0.1)]">
                  <span className="text-[10px] font-exo text-[#8CA3C2] block">Life Support Protected</span>
                  <span className="text-base font-bold text-[#EAF4FF]">
                    {naive.hours_life_support_protected ?? 0}
                    <span className="text-xs text-[#8CA3C2] font-normal"> / 24 hrs</span>
                  </span>
                </div>
                <div className="bg-[rgba(3,8,20,0.5)] p-2 rounded-lg border border-[rgba(56,189,248,0.1)]">
                  <span className="text-[10px] font-exo text-[#8CA3C2] block">First Deficit</span>
                  <span className="text-base font-bold text-[#FF7A1A]">
                    {naive.first_hour_life_support_at_risk !== null && naive.first_hour_life_support_at_risk !== undefined
                      ? `Hour +${naive.first_hour_life_support_at_risk}`
                      : 'None'}
                  </span>
                </div>
                <div className="bg-[rgba(3,8,20,0.5)] p-2 rounded-lg border border-[rgba(56,189,248,0.1)]">
                  <span className="text-[10px] font-exo text-[#8CA3C2] block">Total Unmet</span>
                  <span className="text-base font-bold text-[#8CA3C2]">
                    {Number(naive.total_unmet_kwh ?? 0).toFixed(1)}
                    <span className="text-xs font-normal"> kWh</span>
                  </span>
                </div>
              </div>
            </div>

            {/* LUNAGRID Plan Card */}
            <div className="console-panel p-5 border-l-4 border-l-[#22E58B] flex flex-col justify-between shadow-[0_0_20px_rgba(34,229,139,0.08)]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-orbitron font-semibold text-xs text-[#22E58B] tracking-wider uppercase flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    RECOMMENDED DISPATCH
                  </span>
                  {hoursSaved > 0 && (
                    <span className="text-[10px] font-mono font-bold text-[#22E58B] bg-[#22E58B]/15 px-2 py-0.5 rounded border border-[#22E58B]/30 animate-pulse">
                      +{hoursSaved}h LIFE SUPPORT EXTENDED
                    </span>
                  )}
                </div>
                <h3 className="font-orbitron font-bold text-base text-[#EAF4FF] mt-1">
                  LUNAGRID 24-Hour Plan
                </h3>
                <p className="font-exo text-xs text-[#8CA3C2] mt-1 leading-relaxed">
                  Anticipates future solar decline across the horizon. Selectively curtails non-critical science and rover loads to safeguard battery reserve for continuous Life Support.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[rgba(56,189,248,0.12)] grid grid-cols-3 gap-2 text-center font-mono-numbers">
                <div className="bg-[rgba(3,8,20,0.5)] p-2 rounded-lg border border-[#22E58B]/20">
                  <span className="text-[10px] font-exo text-[#8CA3C2] block">Life Support Protected</span>
                  <span className="text-base font-bold text-[#22E58B]">
                    {lunagrid.hours_life_support_protected ?? 0}
                    <span className="text-xs text-[#8CA3C2] font-normal"> / 24 hrs</span>
                  </span>
                </div>
                <div className="bg-[rgba(3,8,20,0.5)] p-2 rounded-lg border border-[rgba(56,189,248,0.1)]">
                  <span className="text-[10px] font-exo text-[#8CA3C2] block">First Deficit</span>
                  <span
                    className={`text-base font-bold ${
                      lunagrid.first_hour_life_support_at_risk === null
                        ? 'text-[#22E58B]'
                        : 'text-[#FFC233]'
                    }`}
                  >
                    {lunagrid.first_hour_life_support_at_risk !== null && lunagrid.first_hour_life_support_at_risk !== undefined
                      ? `Hour +${lunagrid.first_hour_life_support_at_risk}`
                      : 'None (Nominal)'}
                  </span>
                </div>
                <div className="bg-[rgba(3,8,20,0.5)] p-2 rounded-lg border border-[rgba(56,189,248,0.1)]">
                  <span className="text-[10px] font-exo text-[#8CA3C2] block">Total Unmet</span>
                  <span className="text-base font-bold text-[#EAF4FF]">
                    {Number(lunagrid.total_unmet_kwh ?? 0).toFixed(1)}
                    <span className="text-xs text-[#8CA3C2] font-normal"> kWh</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. CHART: Stacked Area + Battery SOC Line + "Now" marker + At-risk shaded banner */}
          <div className="console-panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="font-orbitron font-bold text-sm text-[#EAF4FF] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FFC857]" />
                  POWER ALLOCATION STACK &amp; BATTERY STATE-OF-CHARGE
                </h3>
                <p className="font-exo text-xs text-[#8CA3C2]">
                  Left axis: Stacked load power (kW) · Right axis: Battery state-of-charge (kWh)
                </p>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-exo">
                <span className="flex items-center gap-1.5 text-[#22E58B]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#22E58B]" />
                  Life Support (3 kW)
                </span>
                <span className="flex items-center gap-1.5 text-[#38BDF8]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#38BDF8]" />
                  Habitat (2 kW)
                </span>
                <span className="flex items-center gap-1.5 text-[#A855F7]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#A855F7]" />
                  Comms (1.2 kW)
                </span>
                <span className="flex items-center gap-1.5 text-[#FFB020]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FFB020]" />
                  Science (1 kW)
                </span>
                <span className="flex items-center gap-1.5 text-[#FF7A1A]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FF7A1A]" />
                  Rover (0.8 kW)
                </span>
                <span className="flex items-center gap-1.5 text-[#22D3EE] font-semibold">
                  <span className="w-3 h-0.5 bg-[#22D3EE]" />
                  Battery SoC (kWh)
                </span>
                <span className="flex items-center gap-1.5 text-[#FF3B4E]">
                  <span className="w-3 h-0.5 border-t border-dashed border-[#FF3B4E]" />
                  Reserve ({minReserveKwh.toFixed(1)} kWh)
                </span>
              </div>
            </div>

            {/* Shaded risk warning banner if life support is at risk in any hour */}
            {atRiskIntervals.length > 0 && (
              <div className="px-3.5 py-2 rounded-lg bg-[rgba(255,59,78,0.12)] border border-[#FF3B4E]/30 flex items-center gap-2 text-xs font-exo text-[#FF8591]">
                <AlertTriangle className="w-4 h-4 text-[#FF3B4E] shrink-0" />
                <span>
                  <strong>CRITICAL DEFICIT WINDOW DETECTED:</strong> Life support power cannot be fully sustained during hours{' '}
                  {atRiskIntervals.map((int) => `T+${int.start} to T+${int.end}`).join(', ')}. Shaded with diagonal warning patterns and labeled below.
                </span>
              </div>
            )}

            {/* Chart Area */}
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                  onClick={(e) => {
                    if (e && e.activeTooltipIndex !== undefined) {
                      setSelectedHour(e.activeTooltipIndex);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="gradLifeSupport" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22E58B" stopOpacity={0.85} />
                      <stop offset="95%" stopColor="#22E58B" stopOpacity={0.65} />
                    </linearGradient>
                    <linearGradient id="gradHabitat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="gradComms" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="gradScience" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFB020" stopOpacity={0.75} />
                      <stop offset="95%" stopColor="#FFB020" stopOpacity={0.55} />
                    </linearGradient>
                    <linearGradient id="gradRover" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF7A1A" stopOpacity={0.75} />
                      <stop offset="95%" stopColor="#FF7A1A" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>

                  <XAxis
                    dataKey="hour"
                    tickFormatter={(val) => `+${val}h`}
                    stroke="#8CA3C2"
                    tick={{ fill: '#8CA3C2', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    tickLine={{ stroke: 'rgba(56,189,248,0.2)' }}
                  />

                  {/* Left Axis: Power (kW) */}
                  <YAxis
                    yAxisId="power"
                    domain={[0, 9]}
                    stroke="#8CA3C2"
                    tick={{ fill: '#8CA3C2', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    tickFormatter={(val) => `${val} kW`}
                    tickLine={{ stroke: 'rgba(56,189,248,0.2)' }}
                  />

                  {/* Right Axis: Battery SoC (kWh) */}
                  <YAxis
                    yAxisId="soc"
                    orientation="right"
                    domain={[0, 22]}
                    stroke="#22D3EE"
                    tick={{ fill: '#22D3EE', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    tickFormatter={(val) => `${val} kWh`}
                    tickLine={{ stroke: 'rgba(34,211,238,0.3)' }}
                  />

                  <Tooltip content={<CustomPlanTooltip />} />

                  {/* Shaded Red Areas for Hours with Life Support Deficit */}
                  {atRiskIntervals.map((int, i) => (
                    <ReferenceArea
                      key={`risk-area-${i}`}
                      yAxisId="power"
                      x1={int.start}
                      x2={int.end}
                      fill="rgba(255, 59, 78, 0.22)"
                      stroke="rgba(255, 59, 78, 0.55)"
                      strokeDasharray="4 4"
                      label={{
                        value: '⚠️ DEFICIT RISK',
                        position: 'insideTop',
                        fill: '#FF6B7A',
                        fontSize: 10,
                        fontWeight: 'bold',
                        fontFamily: 'Orbitron',
                      }}
                    />
                  ))}

                  {/* Vertical "NOW" Marker at Hour 0 */}
                  <ReferenceLine
                    yAxisId="power"
                    x={0}
                    stroke="#38BDF8"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{
                      value: 'NOW',
                      position: 'top',
                      fill: '#38BDF8',
                      fontSize: 10,
                      fontWeight: 'bold',
                      fontFamily: 'Orbitron',
                    }}
                  />

                  {/* Horizontal Battery Reserve Level line */}
                  <ReferenceLine
                    yAxisId="soc"
                    y={minReserveKwh}
                    stroke="#FF3B4E"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    label={{
                      value: `RESERVE: ${minReserveKwh.toFixed(1)} kWh`,
                      position: 'insideBottomRight',
                      fill: '#FF8591',
                      fontSize: 10,
                      fontWeight: 'bold',
                      fontFamily: 'JetBrains Mono',
                    }}
                  />

                  {/* Selected Hour cursor line */}
                  <ReferenceLine
                    yAxisId="power"
                    x={selectedHour}
                    stroke="#22D3EE"
                    strokeWidth={2}
                    label={{
                      value: `T+${selectedHour}`,
                      position: 'top',
                      fill: '#22D3EE',
                      fontSize: 10,
                      fontWeight: 'bold',
                      fontFamily: 'Orbitron',
                    }}
                  />

                  {/* Stacked Areas for Loads */}
                  <Area
                    yAxisId="power"
                    type="monotone"
                    dataKey="life_support"
                    stackId="loads"
                    stroke="#22E58B"
                    fill="url(#gradLifeSupport)"
                    name="Life Support"
                  />
                  <Area
                    yAxisId="power"
                    type="monotone"
                    dataKey="habitat"
                    stackId="loads"
                    stroke="#38BDF8"
                    fill="url(#gradHabitat)"
                    name="Habitat"
                  />
                  <Area
                    yAxisId="power"
                    type="monotone"
                    dataKey="comms"
                    stackId="loads"
                    stroke="#A855F7"
                    fill="url(#gradComms)"
                    name="Comms"
                  />
                  <Area
                    yAxisId="power"
                    type="monotone"
                    dataKey="science"
                    stackId="loads"
                    stroke="#FFB020"
                    fill="url(#gradScience)"
                    name="Science"
                  />
                  <Area
                    yAxisId="power"
                    type="monotone"
                    dataKey="rover"
                    stackId="loads"
                    stroke="#FF7A1A"
                    fill="url(#gradRover)"
                    name="Rover"
                  />

                  {/* Battery State-of-Charge Line */}
                  <Line
                    yAxisId="soc"
                    type="monotone"
                    dataKey="soc_kwh"
                    stroke="#22D3EE"
                    strokeWidth={2.5}
                    dot={{ fill: '#071228', stroke: '#22D3EE', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, fill: '#22D3EE' }}
                    name="Battery SoC"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. HOUR INSPECTION SLIDER & ALLOCATION TABLE */}
          {currentHourData && (
            <div className="console-panel p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(56,189,248,0.14)]">
                <div>
                  <h3 className="font-orbitron font-bold text-sm text-[#EAF4FF] flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#22D3EE]" />
                    HOURLY DISPATCH INSPECTOR
                  </h3>
                  <p className="font-exo text-xs text-[#8CA3C2]">
                    Drag the slider to inspect the PuLP solver dispatch decision for any specific hour.
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono-numbers">
                  <button
                    onClick={() => setSelectedHour((prev) => Math.max(0, prev - 1))}
                    disabled={selectedHour === 0}
                    className="p-1.5 rounded-lg bg-[rgba(3,8,20,0.6)] border border-[rgba(56,189,248,0.2)] text-[#8CA3C2] hover:text-white disabled:opacity-30"
                    title="Previous hour"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="px-3 py-1 rounded-lg bg-[rgba(34,211,238,0.12)] border border-[rgba(34,211,238,0.3)] text-center min-w-[140px]">
                    <span className="font-orbitron font-bold text-sm text-[#22D3EE]">
                      Hour +{currentHourData.hour}
                    </span>
                    <span className="text-[11px] text-[#8CA3C2] ml-1.5">
                      ({String(currentHourData.clock_hour).padStart(2, '0')}:00 MET)
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedHour((prev) => Math.min(23, prev + 1))}
                    disabled={selectedHour === 23}
                    className="p-1.5 rounded-lg bg-[rgba(3,8,20,0.6)] border border-[rgba(56,189,248,0.2)] text-[#8CA3C2] hover:text-white disabled:opacity-30"
                    title="Next hour"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Slider Control */}
              <div className="space-y-1.5">
                <input
                  type="range"
                  min="0"
                  max="23"
                  step="1"
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(Number(e.target.value))}
                  className="w-full accent-[#22D3EE] h-2 bg-[rgba(3,8,20,0.8)] rounded-lg cursor-pointer border border-[rgba(56,189,248,0.2)]"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#8CA3C2]">
                  <span>Now (+0h)</span>
                  <span>+6h</span>
                  <span>+12h</span>
                  <span>+18h</span>
                  <span>+23h End</span>
                </div>
              </div>

              {/* Quick telemetry badges for selected hour */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-numbers">
                <div className="bg-[rgba(3,8,20,0.5)] p-2.5 rounded-xl border border-[rgba(56,189,248,0.14)]">
                  <span className="text-[10px] font-exo text-[#8CA3C2] block">Solar Generation</span>
                  <span className="text-base font-bold text-[#FFC857]">
                    {Number(currentHourData.solar_kw).toFixed(2)}
                    <span className="text-xs font-normal text-[#8CA3C2]"> kW</span>
                  </span>
                </div>
                <div className="bg-[rgba(3,8,20,0.5)] p-2.5 rounded-xl border border-[rgba(56,189,248,0.14)]">
                  <span className="text-[10px] font-exo text-[#8CA3C2] block">Battery Dispatch</span>
                  <span className="text-base font-bold text-[#38BDF8]">
                    {currentHourData.battery_discharge_kw > 0
                      ? `-${Number(currentHourData.battery_discharge_kw).toFixed(2)}`
                      : `+${Number(currentHourData.battery_charge_kw).toFixed(2)}`}
                    <span className="text-xs font-normal text-[#8CA3C2]">
                      {currentHourData.battery_discharge_kw > 0 ? ' kW (draw)' : ' kW (chg)'}
                    </span>
                  </span>
                </div>
                <div className="bg-[rgba(3,8,20,0.5)] p-2.5 rounded-xl border border-[rgba(56,189,248,0.14)]">
                  <span className="text-[10px] font-exo text-[#8CA3C2] block">Battery State-of-Charge</span>
                  <span className="text-base font-bold text-[#22D3EE]">
                    {Number(currentHourData.soc_kwh).toFixed(2)}
                    <span className="text-xs font-normal text-[#8CA3C2]"> / 20.0 kWh</span>
                  </span>
                </div>
                <div
                  className={`p-2.5 rounded-xl border ${
                    currentHourData.life_support_ok
                      ? 'bg-[rgba(34,229,139,0.1)] border-[#22E58B]/30'
                      : 'bg-[rgba(255,59,78,0.1)] border-[#FF3B4E]/30'
                  }`}
                >
                  <span className="text-[10px] font-exo text-[#8CA3C2] block">Life Support Protection</span>
                  <span
                    className={`text-base font-bold flex items-center gap-1.5 ${
                      currentHourData.life_support_ok ? 'text-[#22E58B]' : 'text-[#FF3B4E]'
                    }`}
                  >
                    {currentHourData.life_support_ok ? 'PROTECTED' : 'AT DEFICIT RISK'}
                  </span>
                </div>
              </div>

              {/* Allocation Table for Selected Hour */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-exo text-xs">
                  <thead>
                    <tr className="border-b border-[rgba(56,189,248,0.18)] text-[#8CA3C2] font-orbitron text-[11px]">
                      <th className="py-2.5 px-3">LOAD SUBSYSTEM</th>
                      <th className="py-2.5 px-3">TIER &amp; PRIORITY</th>
                      <th className="py-2.5 px-3 text-right">REQUESTED</th>
                      <th className="py-2.5 px-3 text-right">ALLOCATED</th>
                      <th className="py-2.5 px-3 text-right">DELIVERY</th>
                      <th className="py-2.5 px-3 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(56,189,248,0.08)] font-mono-numbers">
                    {currentHourData.loads?.map((load) => {
                      const cfg = LOAD_CONFIG[load.id] || {
                        name: load.name,
                        color: '#38BDF8',
                        icon: Zap,
                        tier: load.tier?.toUpperCase() || 'STANDARD',
                        priority: load.priority,
                      };
                      const Icon = cfg.icon;
                      const need = Number(load.need_kw ?? 0);
                      const alloc = Number(load.allocated_kw ?? 0);
                      const pct = need > 0 ? Math.min(100, Math.round((alloc / need) * 100)) : 100;
                      const isProtected = load.status === 'Protected' || pct >= 99;
                      const isReduced = load.status === 'Reduced' || (pct > 0 && pct < 99);

                      return (
                        <tr
                          key={load.id}
                          className="hover:bg-[rgba(56,189,248,0.04)] transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="p-1.5 rounded-lg shrink-0"
                                style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
                              >
                                <Icon className="w-4 h-4" />
                              </span>
                              <div>
                                <span className="font-orbitron font-semibold text-[#EAF4FF] text-xs block">
                                  {cfg.name}
                                </span>
                                <span className="text-[10px] text-[#8CA3C2] font-exo">
                                  ID: {load.id}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-orbitron font-bold border"
                              style={{
                                color: cfg.color,
                                borderColor: `${cfg.color}40`,
                                backgroundColor: `${cfg.color}10`,
                              }}
                            >
                              P{cfg.priority} · {cfg.tier}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right text-[#8CA3C2]">
                            {need.toFixed(2)} kW
                          </td>

                          <td className="py-3 px-3 text-right font-bold text-[#EAF4FF]">
                            {alloc.toFixed(2)} kW
                          </td>

                          <td className="py-3 px-3 text-right">
                            <span
                              className={`font-bold ${
                                isProtected
                                  ? 'text-[#22E58B]'
                                  : isReduced
                                  ? 'text-[#FFC233]'
                                  : 'text-[#FF3B4E]'
                              }`}
                            >
                              {pct}%
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-orbitron font-bold border ${
                                isProtected
                                  ? 'bg-[#22E58B]/15 text-[#22E58B] border-[#22E58B]/40'
                                  : isReduced
                                  ? 'bg-[#FFC233]/15 text-[#FFC233] border-[#FFC233]/40'
                                  : 'bg-[#FF3B4E]/15 text-[#FF3B4E] border-[#FF3B4E]/40'
                              }`}
                            >
                              {load.status || (isProtected ? 'Protected' : isReduced ? 'Reduced' : 'Off')}
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
        </>
      )}
    </div>
  );
};
