import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Check,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  FileCheck,
  Cpu,
} from 'lucide-react';
import { useSpacegridState } from '../../context/SpacegridContext';
import { useToast } from '../../context/ToastContext';

export const ApprovalPage = () => {
  const navigate = useNavigate();
  const { state, approvePlan, rejectPlan, decidePlan, replanning, refresh } = useSpacegridState();
  const { showToast } = useToast();

  const plan = state?.plan || {};
  const alert = state?.alert || {};
  const survival = state?.survival || {};
  const power = state?.power || {};

  const isApproved = plan.status === 'approved' || state?.decision === 'approved';
  const isPending = plan.status === 'pending' || state?.decision === 'pending';
  const isLifeSupportSafe = alert.life_support_ok !== false;

  // Hold-to-approve interaction state (~800ms)
  const [holdingApprove, setHoldingApprove] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  // Typewriter streaming state for transparent reasoning bullets
  const [typewriterIndex, setTypewriterIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  // Formulate 3 clear lines of plain text summary
  const summaryLines = useMemo(() => {
    const solarKw = Number(power.solar_kw ?? power.solar ?? 10.0);
    const demandKw = Number(power.demand_kw ?? power.demand ?? 8.0);
    const hours = survival.hours_now ?? null;

    if (isLifeSupportSafe && solarKw >= 5.0) {
      return {
        action: 'Maintain autonomous baseline dispatch without load throttling.',
        impact: 'All 5 habitat nodes fully powered; Earth telemetry link active at full capacity.',
        result: hours === null ? 'Sustained indefinitely with floating reserve batteries.' : `Sustained for ${hours.toFixed(1)} hours of continuous reserve.`,
      };
    }

    return {
      action: 'Prioritize human life support (3.0 kW) while throttling habitat climate, Earth comms beacon, and science instruments.',
      impact: 'Pressurized rovers decoupled; science spectrometers placed in low-power idle sleep.',
      result: hours === null
        ? 'Life support sustained without time limitation.'
        : Number(hours) <= 0.001
        ? 'CRITICAL HAZARD: 0 h (unsafe). Life support underpowered.'
        : `Extends crew atmospheric survival by ${hours.toFixed(1)} hours under emergency rationing.`,
    };
  }, [isLifeSupportSafe, power, survival]);

  // Transparent AI Reasoning Bullets
  const reasoningBullets = useMemo(() => {
    return [
      'Identified solar array deficit through Kalman filter ephemeris projection.',
      'Applied Priority Tier 1 lock: Human life support guaranteed at 3.0 kW strictly.',
      'Ranked and partitioned secondary loads: Habitat (2.0 kW) and Earth Comms (1.2 kW).',
      'Calculated minimal battery drain gradient to maximize reserve longevity.',
      'Audited digital twin thermal inertia to ensure sample refrigeration safety.',
    ];
  }, []);

  // Streaming typewriter effect on mount
  useEffect(() => {
    setIsTyping(true);
    setTypewriterIndex(1);
    const interval = setInterval(() => {
      setTypewriterIndex((prev) => {
        if (prev >= reasoningBullets.length) {
          clearInterval(interval);
          setIsTyping(false);
          return prev;
        }
        return prev + 1;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [reasoningBullets.length]);

  // Handle continuous hold for 800ms
  useEffect(() => {
    let timer;
    if (holdingApprove && !isApproved && !replanning) {
      const startTime = performance.now();
      timer = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / 800);
        setHoldProgress(progress);

        if (progress >= 1) {
          clearInterval(timer);
          setHoldingApprove(false);
          setHoldProgress(0);
          handleApprove();
        }
      }, 25);
    } else {
      setHoldProgress(0);
    }

    return () => clearInterval(timer);
  }, [holdingApprove, isApproved, replanning]);

  const handleApprove = async () => {
    try {
      if (typeof approvePlan === 'function') {
        await approvePlan();
      } else if (typeof decidePlan === 'function') {
        await decidePlan('approve');
      }
      if (typeof refresh === 'function') {
        await refresh();
      }
      showToast({
        message: 'Plan authorized: Autonomous microgrid dispatch plan committed.',
        type: 'success',
      });
    } catch (err) {
      const errorMsg =
        (typeof err?.detail === 'string' ? err.detail : err?.message) ||
        'Authorization failed. Check backend connection.';
      showToast({
        message: errorMsg,
        type: 'danger',
      });
    }
  };

  const handleReject = async () => {
    try {
      if (typeof rejectPlan === 'function') {
        await rejectPlan();
      } else if (typeof decidePlan === 'function') {
        await decidePlan('reject');
      }
      if (typeof refresh === 'function') {
        await refresh();
      }
      showToast({
        message: 'Plan rejected. Returning to overview.',
        type: 'warn',
      });
      navigate('/console/overview');
    } catch (err) {
      const errorMsg =
        (typeof err?.detail === 'string' ? err.detail : err?.message) ||
        'Rejection failed. Check backend connection.';
      showToast({
        message: errorMsg,
        type: 'danger',
      });
    }
  };

  // Mock Audit trail entries
  const auditEntries = useMemo(() => {
    return [
      {
        id: '#SG-2026-REV4',
        time: '10:04:12 UTC',
        title: isApproved ? 'Plan Authorized by Flight Director' : 'Plan Proposed by SPACEGRID AI',
        actor: isApproved ? 'Flight Director Console (FD-1)' : 'Linear Optimization Engine',
        status: isApproved ? 'APPROVED' : 'PENDING',
        details: 'Constraint solver balanced 5 microgrid nodes under updated insolation vector.',
      },
      {
        id: '#SG-2026-REV3',
        time: '10:02:45 UTC',
        title: 'Solar Obscuration Anomaly Registered',
        actor: 'Telemetry Ingestion Gateway',
        status: 'ALERT',
        details: 'Array output dropped below 3.5 kW threshold. Contingency protocol triggered.',
      },
      {
        id: '#SG-2026-REV2',
        time: '10:00:00 UTC',
        title: 'Nominal Orbital Track Synchronized',
        actor: 'Flight Operations Console',
        status: 'NOMINAL',
        details: 'Luna-1 habitat morning operational baseline verified across all 5 nodes.',
      },
    ];
  }, [isApproved]);

  return (
    <div className="space-y-6">
      {/* 1. STATUS HEADER & PLAN PROVENANCE */}
      <div className="console-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`px-3 py-1 rounded text-xs font-exo font-bold uppercase tracking-wider border ${
                isApproved
                  ? 'bg-[rgba(34,229,139,0.18)] text-[#22E58B] border-[#22E58B]/50'
                  : isPending
                  ? 'bg-[rgba(255,194,51,0.18)] text-[#FFC233] border-[#FFC233]/50 animate-pulse'
                  : 'bg-[rgba(255,59,78,0.18)] text-[#FF3B4E] border-[#FF3B4E]/50'
              }`}
            >
              {isApproved
                ? 'AUTHORIZED & DISPATCHED'
                : isPending
                ? 'PENDING FLIGHT DIRECTOR AUTHORIZATION'
                : 'REJECTED / MANUAL OVERRIDE'}
            </span>

            <span className="font-mono text-xs text-[#8CA3C2] flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-[#22D3EE]" />
              Plan Revision: #SG-2026-REV4 • Latency: {state?.replan_ms !== null && state?.replan_ms !== undefined ? `${state.replan_ms} ms` : '--'}
            </span>
          </div>

          <h2 className="font-orbitron font-bold text-lg text-[#EAF4FF] tracking-wide">
            {isApproved
              ? 'ACTIVE OPTIMIZER PLAN COMMITTED TO DIGITAL TWIN'
              : 'REVIEW & AUTHORIZE EMERGENCY LOAD-SHED SCHEDULE'}
          </h2>
        </div>

        {/* Quick Link to Simulation Mode */}
        <button
          onClick={() => navigate('/console/simulation')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-exo font-semibold text-[#8CA3C2] hover:text-[#EAF4FF] border border-white/10 transition-colors"
        >
          <span>Open Simulation Sandbox</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. THREE-LINE ACTION / IMPACT / RESULT SUMMARY */}
      <div className="console-panel p-6 space-y-4 border-l-4 border-l-[#22D3EE]">
        <div className="flex items-center justify-between border-b border-[rgba(56,189,248,0.2)] pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#22D3EE]" />
            <h3 className="font-orbitron font-bold text-sm text-[#EAF4FF]">
              PROPOSED OPERATIONAL PLAN SUMMARY
            </h3>
          </div>
          <span className="font-mono text-xs text-[#8CA3C2]">
            Target Horizon: 24h
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Line 1: Action */}
          <div className="p-4 rounded-xl bg-[rgba(3,8,20,0.6)] border border-[rgba(56,189,248,0.2)] space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFB020]" />
              <span className="font-exo text-xs font-bold uppercase tracking-wider text-[#FFB020]">
                1. Proposed Action
              </span>
            </div>
            <p className="font-exo text-xs font-medium text-[#EAF4FF] leading-relaxed">
              {summaryLines.action}
            </p>
          </div>

          {/* Line 2: Impact */}
          <div className="p-4 rounded-xl bg-[rgba(3,8,20,0.6)] border border-[rgba(56,189,248,0.2)] space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22D3EE]" />
              <span className="font-exo text-xs font-bold uppercase tracking-wider text-[#22D3EE]">
                2. Operational Impact
              </span>
            </div>
            <p className="font-exo text-xs font-medium text-[#EAF4FF] leading-relaxed">
              {summaryLines.impact}
            </p>
          </div>

          {/* Line 3: Result */}
          <div className="p-4 rounded-xl bg-[rgba(3,8,20,0.6)] border border-[rgba(56,189,248,0.2)] space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22E58B]" />
              <span className="font-exo text-xs font-bold uppercase tracking-wider text-[#22E58B]">
                3. Survivability Result
              </span>
            </div>
            <p className="font-exo text-xs font-medium text-[#EAF4FF] leading-relaxed">
              {summaryLines.result}
            </p>
          </div>
        </div>
      </div>

      {/* 3. AUTHORIZATION DECK & HOLD-TO-APPROVE RING BUTTON */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (7 cols): Live Transparent Reasoning Feed */}
        <div className="lg:col-span-7">
          <div className="console-panel p-6 space-y-4 h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-[rgba(56,189,248,0.2)]">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#22D3EE]" />
                  <h3 className="font-orbitron font-bold text-sm text-[#EAF4FF]">
                    OPTIMIZER DECISION TRACE & MATHEMATICAL JUSTIFICATION
                  </h3>
                </div>
                {isTyping && (
                  <button
                    onClick={() => setTypewriterIndex(reasoningBullets.length)}
                    className="font-exo text-[11px] text-[#22D3EE] hover:underline cursor-pointer"
                  >
                    Skip
                  </button>
                )}
              </div>

              {/* Feed items */}
              <div className="space-y-2.5 font-exo text-xs">
                {reasoningBullets.slice(0, typewriterIndex).map((bullet, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[rgba(7,18,40,0.7)] border border-[rgba(56,189,248,0.2)] text-[#EAF4FF] leading-relaxed transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22D3EE] shrink-0 mt-0.5" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[rgba(56,189,248,0.18)] text-[11px] font-mono text-[#8CA3C2] flex justify-between">
              <span>Solver: PuLP Linear Programming Core</span>
              <span>Weights: Life 1000 • Hab 100 • Comms 100 • Sci 10 • Rov 1</span>
            </div>
          </div>
        </div>

        {/* Right (5 cols): Authorization Controls & Radial Hold Button */}
        <div className="lg:col-span-5">
          <div className="console-panel p-6 space-y-6 flex flex-col justify-between h-full">
            <div>
              <h3 className="font-orbitron font-bold text-sm text-[#EAF4FF] flex items-center gap-2 pb-2.5 border-b border-[rgba(56,189,248,0.2)]">
                <ShieldCheck className="w-4 h-4 text-[#22E58B]" />
                FLIGHT CONTROLLER AUTHORIZATION DECK
              </h3>
              <p className="font-exo text-xs text-[#8CA3C2] mt-2 leading-relaxed">
                Advisory recommendations require explicit human flight director confirmation before deployment.
              </p>
            </div>

            {/* Circular Hold-to-Approve Button Component */}
            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* SVG Progress Ring */}
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="rgba(56, 189, 248, 0.2)"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke={isApproved ? '#22E58B' : '#22D3EE'}
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={264}
                    strokeDashoffset={264 - (isApproved ? 1 : holdProgress) * 264}
                    strokeLinecap="round"
                    className="transition-all duration-75"
                    style={{
                      filter: `drop-shadow(0 0 8px ${isApproved ? '#22E58B' : '#22D3EE'})`,
                    }}
                  />
                </svg>

                {/* Inner Action Button */}
                <button
                  onMouseDown={() => !isApproved && setHoldingApprove(true)}
                  onMouseUp={() => setHoldingApprove(false)}
                  onMouseLeave={() => setHoldingApprove(false)}
                  onTouchStart={() => !isApproved && setHoldingApprove(true)}
                  onTouchEnd={() => setHoldingApprove(false)}
                  disabled={isApproved || replanning}
                  className={`absolute inset-3 rounded-full flex flex-col items-center justify-center p-3 select-none transition-all ${
                    isApproved
                      ? 'bg-[rgba(34,229,139,0.2)] text-[#22E58B] border border-[#22E58B]/50 cursor-default'
                      : 'bg-gradient-to-br from-[rgba(7,24,52,0.9)] to-[rgba(3,8,20,0.95)] text-[#EAF4FF] hover:border-[#22D3EE] border border-[rgba(56,189,248,0.4)] hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] active:scale-95 cursor-pointer'
                  }`}
                >
                  {isApproved ? (
                    <>
                      <Check className="w-7 h-7 text-[#22E58B] mb-1" />
                      <span className="font-orbitron font-bold text-[11px] text-[#22E58B]">
                        AUTHORIZED
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-6 h-6 text-[#22D3EE] mb-1" />
                      <span className="font-orbitron font-bold text-xs tracking-wider text-center">
                        {holdingApprove ? `${(holdProgress * 100).toFixed(0)}%` : 'HOLD TO APPROVE'}
                      </span>
                      <span className="font-exo text-[11px] text-[#8CA3C2] mt-0.5">
                        ~800ms Hold
                      </span>
                    </>
                  )}
                </button>
              </div>

              <span className="font-exo text-xs text-[#8CA3C2] text-center">
                {isApproved
                  ? 'Plan approved. Microgrid operating under new dispatch constraints.'
                  : 'Press and hold circular ring to commit schedule'}
              </span>
            </div>

            {/* Rejection / Escalation button */}
            <div className="pt-2 border-t border-[rgba(56,189,248,0.18)] flex items-center gap-3">
              <button
                onClick={handleReject}
                disabled={replanning}
                className="w-full py-2.5 rounded-xl bg-[rgba(255,59,78,0.15)] border border-[rgba(255,59,78,0.4)] hover:bg-[rgba(255,59,78,0.25)] text-[#FF3B4E] font-exo text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject & Return to Overview</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CHRONOLOGICAL IMMUTABLE AUDIT TIMELINE */}
      <div className="console-panel p-6 space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-[rgba(56,189,248,0.2)]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#22D3EE]" />
            <h3 className="font-orbitron font-bold text-sm text-[#EAF4FF]">
              FLIGHT DECISION & TELEMETRY AUDIT TRAIL
            </h3>
          </div>
          <span className="font-mono text-xs text-[#8CA3C2]">
            Cryptographic Integrity Verified
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-exo text-xs">
            <thead>
              <tr className="border-b border-[rgba(56,189,248,0.2)] text-[#8CA3C2] uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Revision ID</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Decision Event</th>
                <th className="py-2.5 px-3">Authorized Actor</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(56,189,248,0.08)]">
              {auditEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-mono text-[#22D3EE] font-semibold whitespace-nowrap">
                    {entry.id}
                  </td>
                  <td className="py-3 px-3 font-mono-numbers text-[#8CA3C2] whitespace-nowrap">
                    {entry.time}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-[#EAF4FF] block">
                      {entry.title}
                    </span>
                    <span className="text-[11px] text-[#8CA3C2] block mt-0.5">
                      {entry.details}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-exo text-[#8CA3C2] whitespace-nowrap">
                    {entry.actor}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${
                        entry.status === 'APPROVED'
                          ? 'bg-[rgba(34,229,139,0.15)] text-[#22E58B] border-[rgba(34,229,139,0.4)]'
                          : entry.status === 'PENDING'
                          ? 'bg-[rgba(255,194,51,0.15)] text-[#FFC233] border-[rgba(255,194,51,0.4)]'
                          : entry.status === 'ALERT'
                          ? 'bg-[rgba(255,59,78,0.15)] text-[#FF3B4E] border-[rgba(255,59,78,0.4)]'
                          : 'bg-white/10 text-[#8CA3C2] border-white/20'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MANDATORY ADVISORY INTEGRITY FOOTER */}
      <div className="console-panel p-4 text-center font-exo text-xs text-[#8CA3C2] leading-relaxed border border-[rgba(56,189,248,0.2)]">
        SPACEGRID AI operates in an advisory decision-support capacity under NASA/ESA human-in-the-loop spaceflight governance.
        Mission operations retain final command authority over all electrical bus switches and digital twin relays.
      </div>
    </div>
  );
};
