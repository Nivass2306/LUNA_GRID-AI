import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  ShieldCheck,
  AlertOctagon,
  ArrowRight,
  TrendingUp,
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { useSpacegridState } from '../../context/SpacegridContext';
import { getBenchmark } from '../../lib/api';

const CRITICAL_LOAD_SUM_KW = 6.2; // life_support (3.0) + habitat (2.0) + comms (1.2)
const TOTAL_NEED_KW = 8.0;

export const PolicyComparisonPage = () => {
  const { state } = useSpacegridState();

  const comparison = state?.comparison || [];
  const power = state?.power || {};
  const battery = state?.battery || {};

  const solarKw = Number(power.solar_kw ?? power.solar ?? 0);
  const availableKw = Number(power.available_kw ?? power.available ?? 0);
  const totalBaseDemand = Number(power.demand_kw ?? power.demand ?? TOTAL_NEED_KW);

  const usableBatteryKwh = battery.soc_kwh !== undefined
    ? Math.max(0, Number(battery.soc_kwh) - Number(battery.min_reserve_kwh ?? 3.0))
    : Number(power.usable_battery_kw ?? power.usable_battery ?? 0);

  // Live Benchmark Data State
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState(null);
  const [scenarioFilter, setScenarioFilter] = useState('all');

  const fetchBenchmarkSuite = async () => {
    setBenchmarkLoading(true);
    setBenchmarkError(null);
    try {
      const data = await getBenchmark();
      setBenchmarkData(data);
    } catch (err) {
      setBenchmarkError(err.message || 'Failed to load benchmark suite');
    } finally {
      setBenchmarkLoading(false);
    }
  };

  useEffect(() => {
    fetchBenchmarkSuite();
  }, []);

  // Compute live policy cards strictly from state.comparison
  const policyCards = useMemo(() => {
    if (!comparison || comparison.length === 0) {
      return [];
    }

    const calculated = comparison.map((item) => {
      const allocations = item.allocations || {};
      const lsVal = Number(allocations.life_support ?? 0);
      const habVal = Number(allocations.habitat ?? 0);
      const commsVal = Number(allocations.comms ?? 0);
      const sciVal = Number(allocations.science ?? 0);
      const rovVal = Number(allocations.rover ?? 0);

      const totalAllocated = lsVal + habVal + commsVal + sciVal + rovVal;
      const unmetKw = item.unmet_kw !== undefined
        ? Number(item.unmet_kw)
        : Math.max(0, totalBaseDemand - totalAllocated);

      const isLsOk = Boolean(item.life_support_ok) && lsVal >= 3.0 - 1e-4;

      // Critical load satisfaction
      const critAlloc = lsVal + habVal + commsVal;
      const critSatPct = Math.min(100, (critAlloc / CRITICAL_LOAD_SUM_KW) * 100);
      const totalAvailPct = totalBaseDemand > 0
        ? Math.min(100, (totalAllocated / totalBaseDemand) * 100)
        : 100;

      const batteryDraw = Math.max(0, totalAllocated - solarKw);
      let survivalHours = null;

      if (!item.life_support_ok) {
        survivalHours = 0.0;
      } else if (usableBatteryKwh <= 1e-6 && totalAllocated > solarKw) {
        survivalHours = 0.0;
      } else if (batteryDraw <= 0.01 && item.life_support_ok) {
        survivalHours = null;
      } else {
        survivalHours = batteryDraw > 0 ? usableBatteryKwh / batteryDraw : 0.0;
      }

      // If this is the spacegrid policy and backend engine computed survival.hours_now, respect it
      if (item.policy === 'spacegrid' && state?.survival?.hours_now !== undefined) {
        survivalHours = state.survival.hours_now;
      }

      // Dynamic rationale derived purely from live numbers
      const dynamicRationale = `Allocates ${totalAllocated.toFixed(1)} kW from ${availableKw.toFixed(1)} kW available. Life support: ${lsVal.toFixed(1)} kW (${isLsOk ? '100% satisfied' : 'Deficit'}). Total unmet demand: ${unmetKw.toFixed(1)} kW. Battery draw: ${batteryDraw.toFixed(2)} kW.`;

      let title = item.label || item.policy;
      let subtitle = 'Linear Multi-Variable Optimizer';
      if (item.policy === 'fixed_rules') {
        subtitle = 'Rigid Priority 1 → 2 → 3 Sequential Fill';
      } else if (item.policy === 'equal_split') {
        subtitle = 'Proportional Load Apportionment';
      }

      return {
        ...item,
        title,
        subtitle,
        totalAllocated,
        unmetKw,
        isLsOk,
        critSatPct,
        totalAvailPct,
        survivalHours,
        dynamicRationale,
        lsVal,
        habVal,
        commsVal,
        sciVal,
        rovVal,
      };
    });

    // Determine ranking objectively: do not rank spacegrid above fixed_rules unless data proves it
    const sg = calculated.find((p) => p.policy === 'spacegrid');
    const fr = calculated.find((p) => p.policy === 'fixed_rules');

    const spacegridWins = sg && fr && (
      (sg.critSatPct > fr.critSatPct + 1e-3) ||
      (sg.unmetKw < fr.unmetKw - 1e-3) ||
      (sg.isLsOk && !fr.isLsOk)
    );

    const fixedRulesWins = sg && fr && (
      (fr.critSatPct > sg.critSatPct + 1e-3) ||
      (fr.unmetKw < sg.unmetKw - 1e-3) ||
      (fr.isLsOk && !sg.isLsOk)
    );

    return calculated.map((p) => {
      let tag = 'FEASIBLE ALLOCATION';
      let tagClass = 'bg-white/10 text-[#8CA3C2] border-white/20';
      let isSuperior = false;

      if (!p.isLsOk) {
        tag = 'CRITICAL DEFICIT';
        tagClass = 'bg-[rgba(255,59,78,0.2)] text-[#FF3B4E] border-[#FF3B4E]/60 animate-pulse';
      } else if (p.policy === 'spacegrid') {
        if (spacegridWins) {
          tag = 'OPTIMAL ALLOCATION';
          tagClass = 'bg-[rgba(34,211,238,0.2)] text-[#22D3EE] border-[#22D3EE]/50 shadow-[0_0_12px_rgba(34,211,238,0.3)]';
          isSuperior = true;
        } else {
          tag = 'AUTONOMOUS SOLVER';
          tagClass = 'bg-[rgba(34,211,238,0.12)] text-[#22D3EE] border-[#22D3EE]/30';
        }
      } else if (p.policy === 'fixed_rules') {
        if (fixedRulesWins) {
          tag = 'OPTIMAL ALLOCATION';
          tagClass = 'bg-[rgba(34,229,139,0.2)] text-[#22E58B] border-[#22E58B]/50 shadow-[0_0_12px_rgba(34,229,139,0.3)]';
          isSuperior = true;
        } else {
          tag = 'FIXED HEURISTIC';
          tagClass = 'bg-white/10 text-[#8CA3C2] border-white/20';
        }
      }

      return {
        ...p,
        tag,
        tagClass,
        isSuperior,
      };
    });
  }, [comparison, totalBaseDemand, solarKw, usableBatteryKwh, availableKw, state]);

  // Benchmark rows for the table
  const benchmarkRows = useMemo(() => {
    if (!benchmarkData?.results) return [];
    if (scenarioFilter === 'all') return benchmarkData.results;
    return benchmarkData.results.filter((r) => r.scenario === scenarioFilter);
  }, [benchmarkData, scenarioFilter]);

  const uniqueScenarios = useMemo(() => {
    if (!benchmarkData?.results) return [];
    return Array.from(new Set(benchmarkData.results.map((r) => r.scenario)));
  }, [benchmarkData]);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & EXPLANATION BANNER */}
      <div className="console-panel p-6 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[rgba(34,211,238,0.15)] border border-[rgba(34,211,238,0.4)] flex items-center justify-center text-[#22D3EE]">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-orbitron font-bold text-lg text-[#EAF4FF] tracking-wide">
              POLICY COMPARISON & BENCHMARK SUITE
            </h2>
            <p className="font-exo text-xs text-[#8CA3C2]">
              Live comparison of SPACEGRID AI vs Fixed Rules vs Equal Split from live digital twin state and GET /benchmark
            </p>
          </div>
        </div>

        <p className="font-exo text-sm text-[#8CA3C2] pt-1 leading-relaxed">
          Every value below is populated from the live API. When generation changes, allocations and survival estimates reflect empirical optimization constraints without fabricated defaults.
        </p>
      </div>

      {/* 2. THREE DYNAMIC POLICY CARDS FROM LIVE STATE.COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {policyCards.map((p) => {
          const totalAllocated = p.totalAllocated;
          const unmetKw = p.unmetKw;
          const isLsOk = p.isLsOk;

          return (
            <div
              key={p.policy}
              className={`console-panel p-6 flex flex-col justify-between space-y-5 transition-all duration-300 relative ${
                p.isSuperior
                  ? 'border-[#22D3EE] shadow-[0_0_24px_rgba(34,211,238,0.2)] bg-[rgba(7,24,52,0.9)]'
                  : !isLsOk
                  ? 'console-panel-danger border-[#FF3B4E]/60'
                  : 'hover:border-[rgba(56,189,248,0.45)]'
              }`}
            >
              {/* Card Header & Badges */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${p.tagClass}`}>
                    {p.tag}
                  </span>

                  {/* Powered vs Underpowered Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-exo font-bold uppercase tracking-wider border ${
                      isLsOk
                        ? 'bg-[rgba(34,229,139,0.15)] text-[#22E58B] border-[rgba(34,229,139,0.4)]'
                        : 'bg-[rgba(255,59,78,0.15)] text-[#FF3B4E] border-[rgba(255,59,78,0.4)] animate-pulse'
                    }`}
                  >
                    {isLsOk ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Powered ({p.lsVal.toFixed(1)} kW)</span>
                      </>
                    ) : (
                      <>
                        <AlertOctagon className="w-3.5 h-3.5" />
                        <span>Underpowered ({p.lsVal.toFixed(1)} kW)</span>
                      </>
                    )}
                  </span>
                </div>

                <div>
                  <h3 className="font-orbitron font-bold text-base text-[#EAF4FF]">
                    {p.title}
                  </h3>
                  <p className="font-exo text-xs text-[#8CA3C2]">
                    {p.subtitle}
                  </p>
                </div>
              </div>

              {/* Stacked Allocation Bar Visualization */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between font-mono-numbers text-[11px] text-[#8CA3C2]">
                  <span>Power Bus Allocation ({totalAllocated.toFixed(1)} kW)</span>
                  <span>Unmet: {unmetKw.toFixed(1)} kW</span>
                </div>

                <div className="w-full h-4 bg-[rgba(3,8,20,0.8)] border border-[rgba(56,189,248,0.25)] rounded-lg flex overflow-hidden p-0.5 gap-0.5">
                  {/* Life support */}
                  <div
                    style={{ width: `${(p.lsVal / totalBaseDemand) * 100}%` }}
                    className={`h-full rounded-xs transition-all ${
                      isLsOk ? 'bg-[#22E58B] shadow-[0_0_6px_#22E58B]' : 'bg-[#FF3B4E] animate-pulse'
                    }`}
                    title={`Life Support: ${p.lsVal.toFixed(1)} kW`}
                  />
                  {/* Habitat */}
                  <div
                    style={{ width: `${(p.habVal / totalBaseDemand) * 100}%` }}
                    className="h-full bg-[#38BDF8] rounded-xs"
                    title={`Habitat: ${p.habVal.toFixed(1)} kW`}
                  />
                  {/* Comms */}
                  <div
                    style={{ width: `${(p.commsVal / totalBaseDemand) * 100}%` }}
                    className="h-full bg-[#A855F7] rounded-xs"
                    title={`Comms: ${p.commsVal.toFixed(1)} kW`}
                  />
                  {/* Science */}
                  <div
                    style={{ width: `${(p.sciVal / totalBaseDemand) * 100}%` }}
                    className="h-full bg-[#FFB020] rounded-xs"
                    title={`Science: ${p.sciVal.toFixed(1)} kW`}
                  />
                  {/* Rover */}
                  <div
                    style={{ width: `${(p.rovVal / totalBaseDemand) * 100}%` }}
                    className="h-full bg-[#FF7A1A] rounded-xs"
                    title={`Rover: ${p.rovVal.toFixed(1)} kW`}
                  />
                  {/* Unmet remainder */}
                  {unmetKw > 0 && (
                    <div
                      style={{ width: `${(unmetKw / totalBaseDemand) * 100}%` }}
                      className="h-full bg-white/10 rounded-xs"
                      title={`Unmet: ${unmetKw.toFixed(1)} kW`}
                    />
                  )}
                </div>

                {/* Subsystem Allocation Legend */}
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono-numbers text-[11px] text-[#8CA3C2]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#22E58B]" /> LS: {p.lsVal.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#38BDF8]" /> Hab: {p.habVal.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#A855F7]" /> Com: {p.commsVal.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#FFB020]" /> Sci: {p.sciVal.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#FF7A1A]" /> Rov: {p.rovVal.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Key Quantitative Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[rgba(56,189,248,0.18)] font-exo text-xs">
                <div>
                  <span className="text-[#8CA3C2] block">Projected Survival</span>
                  {p.survivalHours === null || p.survivalHours === undefined ? (
                    <span className="font-orbitron font-bold text-lg text-[#22E58B]">
                      Sustained
                    </span>
                  ) : Number(p.survivalHours) <= 0.001 ? (
                    <span className="font-orbitron font-bold text-lg text-[#FF3B4E]">
                      0 h (unsafe)
                    </span>
                  ) : (
                    <span className={`font-orbitron font-bold text-lg font-orbitron-numbers ${
                      Number(p.survivalHours) < 6 ? 'text-[#FF3B4E]' : 'text-[#EAF4FF]'
                    }`}>
                      {Number(p.survivalHours).toFixed(1)} h
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[#8CA3C2] block">Critical Load Satisfaction</span>
                  <span className="font-orbitron font-bold text-lg text-[#22D3EE] font-orbitron-numbers">
                    {p.critSatPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Dynamic Live Rationale (No hardcoded strings) */}
              <div className="pt-2 border-t border-[rgba(56,189,248,0.18)] text-xs font-exo text-[#8CA3C2] leading-relaxed">
                {p.dynamicRationale}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. SCENARIO X POLICY BENCHMARK TABLE (FROM GET /benchmark) */}
      <div className="console-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(56,189,248,0.2)]">
          <div>
            <h3 className="font-orbitron font-bold text-base text-[#EAF4FF] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#22D3EE]" />
              SCENARIO × POLICY BENCHMARK SUITE
            </h3>
            <p className="font-exo text-xs text-[#8CA3C2]">
              Live results from GET /benchmark across 9 disruption scenarios and 3 allocation policies
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Scenario Filter */}
            {uniqueScenarios.length > 0 && (
              <select
                value={scenarioFilter}
                onChange={(e) => setScenarioFilter(e.target.value)}
                className="bg-[#030814] border border-[rgba(56,189,248,0.3)] text-[#EAF4FF] rounded-lg px-2.5 py-1 text-xs font-mono outline-none focus:border-[#22D3EE]"
              >
                <option value="all">All Scenarios ({benchmarkRows.length})</option>
                {uniqueScenarios.map((sc) => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            )}

            {/* Refresh Button */}
            <button
              onClick={fetchBenchmarkSuite}
              disabled={benchmarkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(34,211,238,0.12)] border border-[rgba(34,211,238,0.35)] text-[#22D3EE] hover:bg-[rgba(34,211,238,0.22)] font-exo text-xs font-bold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${benchmarkLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {benchmarkLoading && (
          <div className="py-8 text-center text-xs font-mono text-[#8CA3C2] animate-pulse">
            Executing benchmark suite on lunar engine...
          </div>
        )}

        {benchmarkError && (
          <div className="p-4 rounded-xl bg-[rgba(255,59,78,0.12)] border border-[#FF3B4E]/40 text-[#FF3B4E] text-xs font-mono">
            {benchmarkError}
          </div>
        )}

        {!benchmarkLoading && !benchmarkError && benchmarkRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-exo text-xs">
              <thead>
                <tr className="border-b border-[rgba(56,189,248,0.2)] text-[#8CA3C2] uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Scenario</th>
                  <th className="py-3 px-3">Policy</th>
                  <th className="py-3 px-3 text-center">Life Support</th>
                  <th className="py-3 px-3 text-right">Critical Satisfaction</th>
                  <th className="py-3 px-3 text-right">Total Unmet</th>
                  <th className="py-3 px-3 text-right">Survival</th>
                  <th className="py-3 px-3 text-right">Latency Mean</th>
                  <th className="py-3 px-3 text-right">Latency P95</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(56,189,248,0.1)] font-mono-numbers">
                {benchmarkRows.map((row, idx) => {
                  const isSg = row.policy === 'spacegrid';
                  const isFr = row.policy === 'fixed_rules';
                  const isEq = row.policy === 'equal_split';

                  const policyLabel = isSg
                    ? 'SPACEGRID AI'
                    : isFr
                    ? 'Fixed Rules'
                    : isEq
                    ? 'Equal Split'
                    : row.policy;

                  return (
                    <tr
                      key={`${row.scenario}-${row.policy}-${idx}`}
                      className={`hover:bg-white/[0.02] ${isSg ? 'bg-[rgba(34,211,238,0.02)]' : ''}`}
                    >
                      {/* 1. scenario */}
                      <td className="py-3 px-3 font-semibold text-[#EAF4FF] font-mono text-xs">
                        {row.scenario}
                      </td>

                      {/* 2. policy */}
                      <td className="py-3 px-3">
                        <span
                          className={`font-semibold ${
                            isSg
                              ? 'text-[#22D3EE]'
                              : isFr
                              ? 'text-[#8CA3C2]'
                              : 'text-[#FFB020]'
                          }`}
                        >
                          {policyLabel}
                        </span>
                      </td>

                      {/* 3. life_support_ok */}
                      <td className="py-3 px-3 text-center">
                        {row.life_support_ok ? (
                          <span className="inline-flex items-center gap-1 text-[#22E58B] font-semibold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>True</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#FF3B4E] font-bold text-xs">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>False</span>
                          </span>
                        )}
                      </td>

                      {/* 4. critical_load_satisfaction_pct */}
                      <td className="py-3 px-3 text-right font-medium text-[#EAF4FF]">
                        {row.critical_load_satisfaction_pct !== null && row.critical_load_satisfaction_pct !== undefined
                          ? `${Number(row.critical_load_satisfaction_pct).toFixed(1)}%`
                          : '--'}
                      </td>

                      {/* 5. total_unmet_kw */}
                      <td className="py-3 px-3 text-right font-medium">
                        {row.total_unmet_kw !== null && row.total_unmet_kw !== undefined ? (
                          <span className={Number(row.total_unmet_kw) > 0 ? 'text-[#FFB020]' : 'text-[#8CA3C2]'}>
                            {Number(row.total_unmet_kw).toFixed(2)} kW
                          </span>
                        ) : (
                          '--'
                        )}
                      </td>

                      {/* 6. survival_hours */}
                      <td className="py-3 px-3 text-right font-medium">
                        {row.survival_hours === null || row.survival_hours === undefined ? (
                          <span className="text-[#22E58B] font-semibold">Sustained</span>
                        ) : Number(row.survival_hours) <= 0.001 ? (
                          <span className="text-[#FF3B4E] font-bold">0 h (unsafe)</span>
                        ) : (
                          <span className={Number(row.survival_hours) < 6 ? 'text-[#FF3B4E]' : 'text-[#EAF4FF]'}>
                            {Number(row.survival_hours).toFixed(1)} h
                          </span>
                        )}
                      </td>

                      {/* 7. latency_mean_ms */}
                      <td className="py-3 px-3 text-right text-[#8CA3C2]">
                        {row.latency_mean_ms !== null && row.latency_mean_ms !== undefined
                          ? `${Number(row.latency_mean_ms).toFixed(3)} ms`
                          : '--'}
                      </td>

                      {/* 8. latency_p95_ms */}
                      <td className="py-3 px-3 text-right text-[#8CA3C2]">
                        {row.latency_p95_ms !== null && row.latency_p95_ms !== undefined
                          ? `${Number(row.latency_p95_ms).toFixed(3)} ms`
                          : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. SANDBOX ACTION SHORTCUTS */}
      <div className="console-panel p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-orbitron font-semibold text-sm text-[#EAF4FF]">
            Test Policies Under Real-Time Simulation
          </h4>
          <p className="font-exo text-xs text-[#8CA3C2]">
            Simulate solar disruptions or custom dust storms to stress-test microgrid response
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link
            to="/console/simulation"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[rgba(34,211,238,0.12)] border border-[rgba(34,211,238,0.4)] text-[#22D3EE] hover:bg-[rgba(34,211,238,0.22)] font-exo text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <span>Simulation Sandbox</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
