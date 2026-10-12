import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  ShieldCheck,
  Activity,
  HeartHandshake,
  Radio,
  Microscope,
  Car,
  Home,
  Cpu,
  Info,
  Lock,
  AlertTriangle,
  ArrowRight,
  RotateCw,
} from 'lucide-react';
import { useLunagridState } from '../../context/LunagridContext';
import { HorizonPlanSection } from '../../components/HorizonPlanSection';
import { getPendingPlan } from '../../lib/api';

const PRIORITY_METADATA = {
  life_support: {
    priority: 1,
    tier: 'CRITICAL',
    icon: HeartHandshake,
    color: '#22E58B',
    accentClass: 'text-[#22E58B]',
    bgClass: 'bg-[rgba(34,229,139,0.15)]',
    borderClass: 'border-[#22E58B]/40',
    defaultReason: 'Strict life support threshold locked at 3.0 kW to protect oxygen generators, scrubbers, and atmospheric circulation.',
  },
  habitat: {
    priority: 2,
    tier: 'HIGH',
    icon: Home,
    color: '#38BDF8',
    accentClass: 'text-[#38BDF8]',
    bgClass: 'bg-[rgba(56,189,248,0.15)]',
    borderClass: 'border-[#38BDF8]/40',
    defaultReason: 'Habitat thermal control loop, cabin illumination, and water recycling system.',
  },
  comms: {
    priority: 3,
    tier: 'HIGH',
    icon: Radio,
    color: '#A855F7',
    accentClass: 'text-[#A855F7]',
    bgClass: 'bg-[rgba(168,85,247,0.15)]',
    borderClass: 'border-[#A855F7]/40',
    defaultReason: 'Deep space telemetry and Earth relay antenna uplink maintained above brownout limits.',
  },
  science: {
    priority: 4,
    tier: 'LOWER',
    icon: Microscope,
    color: '#FFB020',
    accentClass: 'text-[#FFB020]',
    bgClass: 'bg-[rgba(255,176,32,0.15)]',
    borderClass: 'border-[#FFB020]/40',
    defaultReason: 'Regolith core sample refrigeration maintained; drilling and active spectrometer sweeps deferred.',
  },
  rover: {
    priority: 5,
    tier: 'LOWEST',
    icon: Car,
    color: '#FF7A1A',
    accentClass: 'text-[#FF7A1A]',
    bgClass: 'bg-[rgba(255,122,26,0.15)]',
    borderClass: 'border-[#FF7A1A]/40',
    defaultReason: 'Unmanned pressurized rover charging paused at hangar umbilical port during generation deficit.',
  },
};

export const AllocationPage = () => {
  const navigate = useNavigate();
  const { state, loading, error, refresh } = useLunagridState();
  const [pendingPlan, setPendingPlan] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPending = async () => {
      try {
        const res = await getPendingPlan();
        if (isMounted) {
          setPendingPlan(res?.plan || (res?.id ? res : null));
        }
      } catch (err) {
        console.error('Failed to fetch pending plan:', err);
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [state?.timestamp, state?.plan]);

  const loads = useMemo(() => {
    if (Array.isArray(state?.loads)) return state.loads;
    return [];
  }, [state?.loads]);

  const power = state?.power || {};
  const plan = state?.plan || {};
  const lifeSupportAlert = state?.life_support_alert;

  const availableKw = Number(power.available_kw ?? power.available ?? 12.0);
  const solarKw = Number(power.solar_kw ?? power.solar ?? 10.0);

  // Total allocated sum across all loads
  const totalAllocated = useMemo(() => {
    if (!loads || loads.length === 0) return 0;
    return loads.reduce((sum, l) => sum + Number(l?.allocated_kw ?? l?.allocated ?? 0), 0);
  }, [loads]);

  const unallocatedKw = Math.max(0, availableKw - totalAllocated);

  // Breakdown of power bus feed
  const solarToHab = Math.min(totalAllocated, solarKw);
  const batteryToHab = Math.max(0, totalAllocated - solarToHab);

  // Strictly sort loads by survivability priority hierarchy
  const sortedLoads = useMemo(() => {
    if (!loads || loads.length === 0) return [];
    return [...loads].sort((a, b) => {
      const pA = PRIORITY_METADATA[a?.id]?.priority ?? a?.priority ?? 99;
      const pB = PRIORITY_METADATA[b?.id]?.priority ?? b?.priority ?? 99;
      return pA - pB;
    });
  }, [loads]);

  const hasPendingProposal = pendingPlan && pendingPlan.status === 'pending';

  // 1. Loading Skeleton when initial state is still fetching
  if (loading && !state) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="console-panel p-6 h-28 rounded-xl bg-white/5" />
        <div className="console-panel p-6 h-36 rounded-xl bg-white/5" />
        <div className="console-panel p-6 space-y-4 rounded-xl bg-white/5">
          <div className="h-6 w-48 bg-white/10 rounded-md" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  // 2. Error Banner when telemetry fails to fetch
  if (error && !state) {
    return (
      <div className="console-panel p-6 rounded-xl border border-[#FF3B4E]/40 bg-[rgba(255,59,78,0.1)] space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-[#FF3B4E]" />
          <div>
            <h3 className="font-orbitron font-bold text-sm text-[#FF3B4E]">
              Telemetry Signal Error
            </h3>
            <p className="font-exo text-xs text-[#EAF4FF]/80">
              {error.message || 'Unable to establish connection to lunar grid bus.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refresh && refresh()}
          className="px-4 py-2 rounded-xl text-xs font-orbitron font-bold uppercase tracking-wider text-black bg-[#22D3EE] hover:bg-[#22D3EE]/90 flex items-center gap-2 cursor-pointer"
        >
          <RotateCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* LIFE SUPPORT DEFICIT ALERT BANNER */}
      {lifeSupportAlert?.active && (
        <div
          role="alert"
          aria-live="assertive"
          className="console-panel p-4 bg-[rgba(255,59,78,0.14)] border-2 border-[#FF3B4E] rounded-xl flex items-center justify-between gap-4 shadow-[0_0_24px_rgba(255,59,78,0.35)] animate-fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF3B4E]/25 border border-[#FF3B4E]/60 flex items-center justify-center shrink-0">
              <span className="w-3 h-3 rounded-full bg-[#FF3B4E] ls-pulse-beacon inline-block" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-orbitron font-bold text-xs uppercase tracking-wider text-[#FF3B4E]">
                  CRITICAL: LIFE SUPPORT ALLOCATION DEFICIT
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#FF3B4E]/30 text-white border border-[#FF3B4E]/60">
                  -{(Number(lifeSupportAlert.shortfall_kw ?? 0)).toFixed(2)} kW DEFICIT
                </span>
              </div>
              <p className="font-exo text-xs text-[#EAF4FF] leading-relaxed mt-0.5">
                Active microgrid dispatch provides {(Number(lifeSupportAlert.allocated_kw ?? 0)).toFixed(2)} kW of {(Number(lifeSupportAlert.threshold_kw ?? 3)).toFixed(2)} kW required. Life support systems are running below nominal safety margins.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PENDING PROPOSAL BANNER */}
      {hasPendingProposal && (
        <div className="console-panel p-4 bg-[rgba(255,194,51,0.12)] border border-[rgba(255,194,51,0.4)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(255,194,51,0.2)] border border-[#FFC233]/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#FFC233]" />
            </div>
            <div>
              <span className="font-orbitron font-bold text-xs uppercase tracking-wider text-[#FFC233] block">
                Proposal awaiting approval
              </span>
              <p className="font-exo text-xs text-[#EAF4FF] leading-relaxed">
                A new allocation plan proposal ({pendingPlan.source || 'simulation'}) is waiting for review. The active grid allocation below will not change until an operator approves it.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/console/approval')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-orbitron font-bold uppercase tracking-wider text-black bg-[#FFC233] hover:bg-[#FFC233]/90 transition-all shrink-0 cursor-pointer shadow-[0_0_12px_rgba(255,194,51,0.35)]"
          >
            <span>Go to Approval</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. TOP SUMMARY BAR */}
      <div className="console-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-exo text-xs uppercase tracking-wider text-[#8CA3C2] font-semibold">
              COMMITTED ACTIVE ALLOCATION
            </span>
            <span
              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                plan.source === 'manual'
                  ? 'bg-[rgba(255,176,32,0.18)] text-[#FFB020] border border-[rgba(255,176,32,0.4)]'
                  : 'bg-[rgba(34,211,238,0.18)] text-[#22D3EE] border border-[rgba(34,211,238,0.4)]'
              }`}
            >
              Source: {plan.source === 'manual' ? 'Manual Operator Plan' : 'Autonomous Optimizer'}
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="font-orbitron font-bold text-3xl sm:text-4xl text-[#EAF4FF] font-orbitron-numbers">
              {totalAllocated.toFixed(2)}
            </span>
            <span className="font-orbitron text-sm text-[#8CA3C2]">
              kW Committed / {availableKw.toFixed(1)} kW Bus Headroom
            </span>
          </div>
        </div>
      </div>

      {/* 2. POWER BUS BUDGET & SOURCE CONTRIBUTION STRIP */}
      <div className="console-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[rgba(56,189,248,0.2)]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#22D3EE]" />
            <h3 className="font-exo text-sm font-semibold text-[#EAF4FF]">
              Microgrid Power Bus Balance
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-exo">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#FFB020]" />
              <span className="text-[#8CA3C2]">Direct Solar ({solarToHab.toFixed(1)} kW)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#22E58B]" />
              <span className="text-[#8CA3C2]">Battery Discharge ({batteryToHab.toFixed(1)} kW)</span>
            </div>
            {unallocatedKw > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-white/20" />
                <span className="text-[#8CA3C2]">Unallocated ({unallocatedKw.toFixed(1)} kW)</span>
              </div>
            )}
          </div>
        </div>

        {/* Multi-segment bus capacity bar */}
        <div className="space-y-1.5">
          <div className="w-full h-4 bg-[rgba(3,8,20,0.7)] border border-[rgba(56,189,248,0.25)] rounded-lg flex overflow-hidden p-0.5 gap-0.5">
            {/* Solar portion */}
            <div
              style={{ width: `${Math.min(100, (solarToHab / Math.max(availableKw, 0.001)) * 100)}%` }}
              className="h-full bg-[#FFB020] rounded-xs shadow-[0_0_8px_rgba(255,176,32,0.4)] transition-all duration-500"
              title={`Solar to habitat: ${solarToHab.toFixed(1)} kW`}
            />

            {/* Battery portion */}
            <div
              style={{ width: `${Math.min(100, (batteryToHab / Math.max(availableKw, 0.001)) * 100)}%` }}
              className="h-full bg-[#22E58B] rounded-xs shadow-[0_0_8px_rgba(34,229,139,0.4)] transition-all duration-500"
              title={`Battery to habitat: ${batteryToHab.toFixed(1)} kW`}
            />

            {/* Unallocated buffer */}
            {unallocatedKw > 0 && (
              <div
                style={{ width: `${(unallocatedKw / Math.max(availableKw, 0.001)) * 100}%` }}
                className="h-full bg-white/10 rounded-xs transition-all duration-500"
                title={`Unallocated bus margin: ${unallocatedKw.toFixed(1)} kW`}
              />
            )}
          </div>

          <div className="flex justify-between font-mono-numbers text-[11px] text-[#8CA3C2] pt-1">
            <span>0 kW</span>
            <span>Committed: {totalAllocated.toFixed(1)} kW ({availableKw > 0 ? Math.round((totalAllocated / availableKw) * 100) : 0}%)</span>
            <span>Total Available: {availableKw.toFixed(1)} kW</span>
          </div>
        </div>
      </div>

      {/* 3. DEDICATED SUBSYSTEM LOAD ROWS */}
      <div className="console-panel p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(56,189,248,0.2)]">
          <div>
            <h2 className="font-orbitron font-bold text-base text-[#EAF4FF] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#22D3EE]" />
              SUBSYSTEM POWER ALLOCATION MATRIX & RATIONALE
            </h2>
            <p className="font-exo text-xs text-[#8CA3C2]">
              Strictly prioritized according to human life support and mission survivability hierarchy
            </p>
          </div>
          <span className="font-mono text-xs text-[#8CA3C2] hidden sm:block">
            {sortedLoads.length} Subsystems Monitored
          </span>
        </div>

        {/* Load List with 56 px minimum rows */}
        <div className="space-y-3.5">
          {sortedLoads.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-black/40 border border-white/10 space-y-2">
              <Cpu className="w-8 h-8 mx-auto text-[#8CA3C2]/60" />
              <p className="font-orbitron text-sm text-[#8CA3C2]">
                No subsystem load telemetry registered.
              </p>
              <p className="font-exo text-xs text-[#8CA3C2]/70">
                Awaiting telemetry synchronization from lunar grid bus.
              </p>
            </div>
          ) : (
            sortedLoads.map((load, index) => {
              const loadId = load?.id || `load_${index}`;
              const meta = PRIORITY_METADATA[loadId] || {
                priority: load?.priority ?? index + 1,
                tier: load?.tier ?? 'GENERAL',
                icon: Activity,
                color: '#38BDF8',
                accentClass: 'text-[#38BDF8]',
                bgClass: 'bg-white/5',
                borderClass: 'border-white/10',
                defaultReason: 'Standard habitat auxiliary consumer load.',
              };

              const Icon = meta.icon || Activity;
              const allocated = Number(load?.allocated_kw ?? load?.allocated ?? 0);
              const needed = Math.max(0.001, Number(load?.need_kw ?? load?.need ?? 1));
              const pct = Math.min(100, Math.round((allocated / needed) * 100));

              let computedStatus = 'Unpowered';
              if (allocated >= needed - 0.001) {
                computedStatus = 'Full';
              } else if (allocated > 0.001) {
                computedStatus = 'Partial';
              } else {
                computedStatus = 'Unpowered';
              }
              const isFull = computedStatus === 'Full';
              const isPartial = computedStatus === 'Partial';
              const isUnpowered = computedStatus === 'Unpowered';
              const isLsDeficit = (loadId === 'life_support' || load?.canonical_id === 'life_support') && Boolean(lifeSupportAlert?.active);

              return (
                <div
                  key={loadId}
                  className={`min-h-[56px] p-4 rounded-xl bg-[rgba(3,8,20,0.6)] border transition-all duration-200 hover:border-[rgba(56,189,248,0.45)] ${
                    isLsDeficit
                      ? 'border-2 border-[#FF3B4E] shadow-[0_0_22px_rgba(255,59,78,0.45)] ring-1 ring-[#FF3B4E]/50'
                      : isUnpowered
                      ? 'border-white/10 opacity-75'
                      : isPartial
                      ? 'border-[rgba(255,194,51,0.35)]'
                      : 'border-[rgba(56,189,248,0.3)]'
                  }`}
                >
                  {/* Main Row: Subsystem info, Need-vs-Allocated Bar, and Metric */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Identity, Priority, Status */}
                    <div className="flex items-center gap-3 min-w-[260px]">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.bgClass} ${meta.borderClass} ${meta.accentClass}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-orbitron font-bold text-sm text-[#EAF4FF]">
                            {load?.name || loadId}
                          </span>
                          <span
                            className={`status-chip ${
                              isFull
                                ? 'status-chip-protected'
                                : isPartial
                                ? 'status-chip-reduced'
                                : 'status-chip-postponed'
                            }`}
                          >
                            {computedStatus}
                          </span>
                          {isLsDeficit && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#FF3B4E]/25 text-[#FF3B4E] border border-[#FF3B4E]/60 animate-pulse">
                              BELOW 3.0 kW
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-mono text-[11px] text-[#8CA3C2] flex-wrap">
                          <span className="uppercase font-semibold tracking-wider">
                            PRIORITY {meta.priority} • {meta.tier}
                          </span>
                          {(loadId === 'life_support' || loadId === 'habitat') && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase text-[#22E58B] bg-[rgba(34,229,139,0.12)] border border-[rgba(34,229,139,0.35)]">
                              <Lock className="w-3 h-3 text-[#22E58B]" />
                              Permanent priority
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Visual Need-vs-Allocated Meter Bar */}
                    <div className="flex-1 space-y-1.5 min-w-[220px]">
                      <div className="flex justify-between font-mono-numbers text-xs">
                        <span className="text-[#8CA3C2] text-[11px] font-exo">
                          Power Delivery Ratio
                        </span>
                        <span
                          className={`font-bold ${
                            isFull
                              ? 'text-[#22E58B]'
                              : isPartial
                              ? 'text-[#FFC233]'
                              : 'text-[#FF3B4E]'
                          }`}
                        >
                          {pct}% ({allocated.toFixed(2)} / {needed.toFixed(2)} kW)
                        </span>
                      </div>

                      <div className="w-full h-3 rounded-full bg-[rgba(3,8,20,0.8)] border border-[rgba(56,189,248,0.2)] overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isFull
                              ? 'bg-[#22E58B] shadow-[0_0_8px_rgba(34,229,139,0.5)]'
                              : isPartial
                              ? 'bg-[#FFC233] shadow-[0_0_8px_rgba(255,176,32,0.5)]'
                              : 'bg-[#FF3B4E]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Right: Absolute Numeric Readout */}
                    <div className="flex lg:flex-col items-baseline lg:items-end justify-between lg:justify-center shrink-0 min-w-[130px] font-mono-numbers">
                      <div className="flex items-baseline gap-1">
                        <span className="font-orbitron font-bold text-lg text-[#EAF4FF]">
                          {allocated.toFixed(2)}
                        </span>
                        <span className="font-orbitron text-xs text-[#8CA3C2]">kW</span>
                      </div>
                      <span className="text-xs text-[#8CA3C2]">
                        Target: {needed.toFixed(2)} kW
                      </span>
                    </div>
                  </div>

                  {/* Bottom of Row: AI Rationale & Explanation */}
                  <div className="mt-3 pt-2.5 border-t border-[rgba(56,189,248,0.12)] flex items-start gap-2 text-xs font-exo text-[#8CA3C2] leading-relaxed">
                    <Info className="w-3.5 h-3.5 text-[#22D3EE] shrink-0 mt-0.5" />
                    <span>{load?.reason || meta.defaultReason}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. 24-HOUR BATTERY-AWARE HORIZON PLAN */}
      <HorizonPlanSection />

      {/* 5. OPTIMIZATION OBJECTIVE FUNCTION & SAFETY GUARANTEE */}
      <div className="console-panel p-6 space-y-3">
        <h3 className="font-orbitron font-semibold text-sm text-[#EAF4FF] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#22E58B]" />
          MATHEMATICAL SAFETY CONSTRAINT GUARANTEE
        </h3>
        <p className="font-exo text-xs text-[#8CA3C2] leading-relaxed">
          LUNAGRID AI formulates microgrid dispatch as a constrained linear optimization problem with heavy penalty weights:
          Life Support (1,000), Habitat (100), Comms (100), Science (10), and Rover (1). The optimizer will systematically
          shed non-essential science instruments and mobility batteries before curtailing any human life support system.
        </p>
      </div>
    </div>
  );
};
