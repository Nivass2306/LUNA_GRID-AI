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
  Lock,
  Edit3,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useLunagridState } from '../../context/LunagridContext';
import { useToast } from '../../context/ToastContext';
import {
  getPendingPlan,
  getActivePlan,
  patchPendingPlan,
  approveProposal,
  rejectProposal,
  getPlanEvents,
} from '../../lib/api';

export const ApprovalPage = () => {
  const navigate = useNavigate();
  const { state, refresh } = useLunagridState();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  const [lastDecision, setLastDecision] = useState(null);

  // Form input values for editable rows: { [load_id]: string }
  const [inputKw, setInputKw] = useState({});
  const [patching, setPatching] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);

  // Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [operatorNote, setOperatorNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Initial and periodic fetch
  const loadData = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const [pendRes, evtRes] = await Promise.all([
        getPendingPlan(),
        getPlanEvents(),
      ]);

      const plan = (pendRes?.id ? pendRes : pendRes?.plan) || null;
      setPendingPlan(plan);
      setAuditEvents(evtRes?.events || []);

      if (plan && plan.loads) {
        setInputKw((prev) => {
          const updated = { ...prev };
          plan.loads.forEach((l) => {
            if (!l.locked && (updated[l.id] === undefined || isManual)) {
              updated[l.id] = String(l.proposed_kw);
            }
          });
          return updated;
        });
      }
    } catch (err) {
      console.error('Failed to load approval data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => {
      loadData(false);
    }, 2500);
    return () => clearInterval(interval);
  }, [state?.timestamp]);

  // Handle changing an editable kW input
  const handleInputChange = (loadId, val) => {
    setInputKw((prev) => ({
      ...prev,
      [loadId]: val,
    }));
  };

  // Submit PATCH to /plan/pending
  const handleInputBlurOrSubmit = async (loadId, minKw, maxKw) => {
    const rawVal = inputKw[loadId];
    if (rawVal === undefined || rawVal === '') return;

    const parsedVal = parseFloat(rawVal);
    if (isNaN(parsedVal)) {
      setErrorBanner(`Invalid kW value entered for load ${loadId}. Must be a valid number.`);
      return;
    }

    if (parsedVal < minKw || parsedVal > maxKw) {
      setErrorBanner(
        `Value ${parsedVal.toFixed(2)} kW is outside allowed range [${minKw.toFixed(1)} – ${maxKw.toFixed(1)} kW].`
      );
      return;
    }

    setPatching(true);
    setErrorBanner(null);

    try {
      const res = await patchPendingPlan({
        proposed_kw: {
          [loadId]: parsedVal,
        },
      });

      const updatedPlan = res?.plan || (res?.id ? res : null);
      if (updatedPlan) {
        setPendingPlan(updatedPlan);
        // Sync local input with validated response
        setInputKw((prev) => ({
          ...prev,
          [loadId]: String(updatedPlan.loads.find((l) => l.id === loadId)?.proposed_kw ?? parsedVal),
        }));
        showToast({
          message: `Updated ${loadId} allocation to ${parsedVal.toFixed(2)} kW. Constraints re-evaluated.`,
          type: 'info',
        });
      }
    } catch (err) {
      const msg = err?.detail || err?.message || 'Failed to update proposal allocation';
      setErrorBanner(typeof msg === 'string' ? msg : JSON.stringify(msg));
      // Revert input to current proposed value
      if (pendingPlan?.loads) {
        const current = pendingPlan.loads.find((l) => l.id === loadId);
        if (current) {
          setInputKw((prev) => ({
            ...prev,
            [loadId]: String(current.proposed_kw),
          }));
        }
      }
    } finally {
      setPatching(false);
    }
  };

  // Approve proposal handler
  const handleApproveConfirm = async () => {
    if (!pendingPlan) return;
    setSubmitting(true);
    setErrorBanner(null);
    try {
      const res = await approveProposal(pendingPlan.id, {
        operator_note: operatorNote.trim() || undefined,
      });

      setLastDecision({
        action: 'Approved',
        id: pendingPlan.id,
        timestamp: new Date().toISOString(),
        note: operatorNote.trim() || null,
        plan: res?.plan || null,
      });

      setShowApproveModal(false);
      setOperatorNote('');
      setPendingPlan(null);

      showToast({
        message: 'Plan successfully authorized! Active grid allocation updated.',
        type: 'success',
      });

      await refresh();
      await getActivePlan();
      await loadData(false);
    } catch (err) {
      const msg = err?.detail || err?.message || 'Failed to approve plan';
      setErrorBanner(typeof msg === 'string' ? msg : JSON.stringify(msg));
      showToast({
        message: 'Authorization rejected by constraint validator.',
        type: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Reject proposal handler
  const handleRejectConfirm = async () => {
    if (!pendingPlan) return;
    setSubmitting(true);
    setErrorBanner(null);
    try {
      await rejectProposal(pendingPlan.id, {
        reason: rejectReason.trim() || undefined,
      });

      setLastDecision({
        action: 'Rejected',
        id: pendingPlan.id,
        timestamp: new Date().toISOString(),
        note: rejectReason.trim() || null,
      });

      setShowRejectModal(false);
      setRejectReason('');
      setPendingPlan(null);

      showToast({
        message: 'Proposal dismissed. Active microgrid allocation remains unchanged.',
        type: 'warn',
      });

      await refresh();
      await loadData(false);
    } catch (err) {
      const msg = err?.detail || err?.message || 'Failed to reject plan';
      setErrorBanner(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // Loads changed list for the approve confirm modal
  const changedLoads = useMemo(() => {
    if (!pendingPlan || !pendingPlan.loads) return [];
    return pendingPlan.loads.filter((l) => Math.abs(Number(l.delta_kw ?? 0)) > 0.001);
  }, [pendingPlan]);

  const hasPending = pendingPlan && pendingPlan.status === 'pending';

  return (
    <div className="space-y-6">
      {/* 1. DECISION RESULT BANNER (FROM RECENT API ACTION) */}
      {lastDecision && (
        <div
          className={`console-panel p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            lastDecision.action === 'Approved'
              ? 'bg-[rgba(34,229,139,0.12)] border-[#22E58B]/50 text-[#22E58B]'
              : 'bg-[rgba(255,194,51,0.12)] border-[#FFC233]/50 text-[#FFC233]'
          }`}
        >
          <div className="flex items-center gap-3">
            {lastDecision.action === 'Approved' ? (
              <CheckCircle2 className="w-5 h-5 text-[#22E58B] shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-[#FFC233] shrink-0" />
            )}
            <div>
              <span className="font-orbitron font-bold text-xs uppercase tracking-wider block">
                Decision Result: {lastDecision.action} ({lastDecision.id})
              </span>
              <p className="font-exo text-xs text-[#EAF4FF] leading-relaxed">
                Processed at {new Date(lastDecision.timestamp).toLocaleTimeString()}{' '}
                {lastDecision.note ? `• Operator Note: "${lastDecision.note}"` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setLastDecision(null)}
            className="text-[11px] font-mono text-[#8CA3C2] hover:text-[#EAF4FF] underline self-end sm:self-auto cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ERROR BANNER */}
      {errorBanner && (
        <div className="console-panel p-4 bg-[rgba(255,59,78,0.18)] border border-[#FF3B4E]/60 text-[#FF3B4E] rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-[#FF3B4E] shrink-0 mt-0.5" />
            <div>
              <span className="font-orbitron font-bold text-xs uppercase tracking-wider block">
                Validation & Dispatch Constraint Error
              </span>
              <p className="font-exo text-xs text-[#EAF4FF] mt-0.5 leading-relaxed">
                {errorBanner}
              </p>
            </div>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-xs font-mono text-[#8CA3C2] hover:text-[#EAF4FF] cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* 2. MAIN PROPOSAL CONTAINER OR EMPTY STATE */}
      {!hasPending ? (
        <div className="console-panel p-10 sm:p-14 text-center space-y-5 border border-[rgba(56,189,248,0.25)]">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(56,189,248,0.12)] border border-[rgba(56,189,248,0.3)] flex items-center justify-center mx-auto text-[#22D3EE] shadow-[0_0_20px_rgba(34,211,238,0.15)]">
            <FileCheck className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="font-orbitron font-bold text-lg text-[#EAF4FF] tracking-wide">
              No proposal waiting. Run a simulation to create one.
            </h3>
            <p className="font-exo text-xs text-[#8CA3C2] leading-relaxed">
              Active grid allocation operates strictly under human flight director governance.
              Running contingency scenarios or autonomous optimizations generates proposals here for manual review.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => navigate('/console/simulation')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-orbitron text-xs font-bold uppercase tracking-wider text-black bg-[#22D3EE] hover:bg-[#22D3EE]/90 transition-all cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.35)] active:scale-95"
            >
              <span>Go to Simulation Sandbox</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* PENDING PROPOSAL SECTION */
        <div className="space-y-6">
          {/* TOP METADATA BAR */}
          <div className="console-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-l-[#FFC233]">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 rounded text-xs font-exo font-bold uppercase tracking-wider bg-[rgba(255,194,51,0.18)] text-[#FFC233] border border-[#FFC233]/50 animate-pulse">
                  PENDING FLIGHT DIRECTOR AUTHORIZATION
                </span>
                <span className="font-mono text-xs text-[#8CA3C2] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#22D3EE]" />
                  Source: <strong className="text-[#EAF4FF]">{pendingPlan.source}</strong> • Created:{' '}
                  {new Date(pendingPlan.created_at).toLocaleTimeString()}
                </span>
              </div>
              <h2 className="font-orbitron font-bold text-lg text-[#EAF4FF] tracking-wide">
                PROPOSED ALLOCATION SCHEDULE — {pendingPlan.id}
              </h2>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-right">
                <span className="text-[#8CA3C2] block text-[10px] uppercase font-exo">Proposed Total</span>
                <span className="font-orbitron font-bold text-sm text-[#22D3EE]">
                  {Number(pendingPlan.total_proposed_kw ?? 0).toFixed(2)} kW
                </span>
              </div>
              <div className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-right">
                <span className="text-[#8CA3C2] block text-[10px] uppercase font-exo">Available Supply</span>
                <span className="font-orbitron font-bold text-sm text-[#22E58B]">
                  {Number(pendingPlan.available_kw ?? 12).toFixed(2)} kW
                </span>
              </div>
            </div>
          </div>

          {/* ALLOCATION MATRIX TABLE */}
          <div className="console-panel p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[rgba(56,189,248,0.2)]">
              <div>
                <h3 className="font-orbitron font-bold text-base text-[#EAF4FF] flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#22D3EE]" />
                  SUBSYSTEM ALLOCATION MATRIX & OPERATOR TUNING
                </h3>
                <p className="font-exo text-xs text-[#8CA3C2]">
                  Life support and Habitat are permanently locked. Adjust Rover, Communication, and Science kW directly below.
                </p>
              </div>
              {patching && (
                <span className="text-xs font-mono text-[#22D3EE] animate-pulse flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Updating constraints...
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-exo text-xs">
                <thead>
                  <tr className="border-b border-[rgba(56,189,248,0.2)] text-[#8CA3C2] uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3">Subsystem Load</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Current kW</th>
                    <th className="py-3 px-3">Proposed kW</th>
                    <th className="py-3 px-3">Change (Δ kW)</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(56,189,248,0.08)]">
                  {(pendingPlan.loads || []).map((load) => {
                    const delta = Number(load.delta_kw ?? 0);
                    const isIncreased = delta > 0.001;
                    const isReduced = delta < -0.001;
                    const isUnchanged = !isIncreased && !isReduced;

                    const need = Number(load.need_kw ?? 0);
                    const proposed = Number(load.proposed_kw ?? 0);
                    const isFullyPowered = proposed >= need - 0.05;
                    const isPartial = proposed > 0.05 && !isFullyPowered;

                    const changeLabel = isIncreased ? 'Increased' : isReduced ? 'Reduced' : 'Unchanged';

                    return (
                      <tr
                        key={load.id}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          load.locked ? 'bg-white/[0.01]' : ''
                        }`}
                      >
                        {/* Subsystem Name */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#EAF4FF] text-xs">
                              {load.name}
                            </span>
                            {load.locked && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase text-[#22E58B] bg-[rgba(34,229,139,0.12)] border border-[#22E58B]/35">
                                <Lock className="w-3 h-3 text-[#22E58B]" />
                                Locked
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-[#8CA3C2] block">
                            Target need: {need.toFixed(2)} kW
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-3 font-mono font-bold text-[#22D3EE]">
                          P{load.priority}
                        </td>

                        {/* Current kW */}
                        <td className="py-3.5 px-3 font-mono text-[#8CA3C2]">
                          {Number(load.current_kw ?? 0).toFixed(2)} kW
                        </td>

                        {/* Proposed kW */}
                        <td className="py-3.5 px-3">
                          {load.locked ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-[#EAF4FF]">
                                {proposed.toFixed(2)} kW
                              </span>
                              <Lock className="w-3.5 h-3.5 text-[#22E58B]" title="Permanent priority - cannot be changed" />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.1"
                                  min={load.allowed_min_kw}
                                  max={load.allowed_max_kw}
                                  value={inputKw[load.id] ?? String(proposed)}
                                  onChange={(e) => handleInputChange(load.id, e.target.value)}
                                  onBlur={() =>
                                    handleInputBlurOrSubmit(
                                      load.id,
                                      load.allowed_min_kw,
                                      load.allowed_max_kw
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleInputBlurOrSubmit(
                                        load.id,
                                        load.allowed_min_kw,
                                        load.allowed_max_kw
                                      );
                                    }
                                  }}
                                  className="w-24 px-2.5 py-1 bg-black/60 border border-[rgba(56,189,248,0.4)] rounded-lg font-mono text-sm text-[#EAF4FF] focus:border-[#22D3EE] focus:outline-none focus:ring-1 focus:ring-[#22D3EE]"
                                />
                                <span className="font-mono text-xs text-[#8CA3C2]">kW</span>
                              </div>
                              <span className="text-[10px] font-mono text-[#8CA3C2] block">
                                Allowed: {Number(load.allowed_min_kw).toFixed(1)} – {Number(load.allowed_max_kw).toFixed(1)} kW
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Change Column (explicit text labels: Increased, Reduced, Unchanged) */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span
                              className={`font-bold ${
                                isIncreased
                                  ? 'text-[#22E58B]'
                                  : isReduced
                                  ? 'text-[#FFC233]'
                                  : 'text-[#8CA3C2]'
                              }`}
                            >
                              {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)} kW
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${
                                isIncreased
                                  ? 'bg-[rgba(34,229,139,0.12)] text-[#22E58B] border-[#22E58B]/35'
                                  : isReduced
                                  ? 'bg-[rgba(255,194,51,0.12)] text-[#FFC233] border-[#FFC233]/35'
                                  : 'bg-white/5 text-[#8CA3C2] border-white/10'
                              }`}
                            >
                              {changeLabel}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              isFullyPowered
                                ? 'bg-[rgba(34,229,139,0.15)] text-[#22E58B] border-[#22E58B]/40'
                                : isPartial
                                ? 'bg-[rgba(255,194,51,0.15)] text-[#FFC233] border-[#FFC233]/40'
                                : 'bg-[rgba(255,59,78,0.15)] text-[#FF3B4E] border-[#FF3B4E]/40'
                            }`}
                          >
                            {isFullyPowered ? 'Fully Powered' : isPartial ? 'Curtailed' : 'Shed / Off'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. REASONING LIST & CONSTRAINT CHECKS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Reasoning list (Why this proposal) */}
            <div className="lg:col-span-7">
              <div className="console-panel p-6 space-y-4 h-full">
                <div className="flex items-center gap-2 pb-2.5 border-b border-[rgba(56,189,248,0.2)]">
                  <Sparkles className="w-4 h-4 text-[#22D3EE]" />
                  <h4 className="font-orbitron font-bold text-sm text-[#EAF4FF]">
                    WHY THIS PROPOSAL (OPTIMIZER REASONING)
                  </h4>
                </div>
                <div className="space-y-2.5 font-exo text-xs">
                  {(pendingPlan.reasoning || []).map((reason, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-[rgba(7,18,40,0.7)] border border-[rgba(56,189,248,0.2)] text-[#EAF4FF] leading-relaxed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#22D3EE] shrink-0 mt-0.5" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Constraint Checks & Decision Deck */}
            <div className="lg:col-span-5 space-y-6">
              {/* Checks */}
              <div className="console-panel p-6 space-y-4">
                <div className="flex items-center gap-2 pb-2.5 border-b border-[rgba(56,189,248,0.2)]">
                  <ShieldCheck className="w-4 h-4 text-[#22E58B]" />
                  <h4 className="font-orbitron font-bold text-sm text-[#EAF4FF]">
                    MATHEMATICAL CONSTRAINT CHECKS
                  </h4>
                </div>

                <div className="space-y-2.5">
                  {(pendingPlan.constraint_checks || pendingPlan.checks || []).map((check) => (
                    <div
                      key={check.id}
                      className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                        check.passed
                          ? 'bg-[rgba(34,229,139,0.08)] border-[#22E58B]/35'
                          : 'bg-[rgba(255,59,78,0.12)] border-[#FF3B4E]/50'
                      }`}
                    >
                      {check.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-[#22E58B] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#FF3B4E] shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-orbitron font-bold text-xs text-[#EAF4FF]">
                            {check.name || check.label}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                              check.passed ? 'text-[#22E58B]' : 'text-[#FF3B4E]'
                            }`}
                          >
                            {check.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                        <p className="font-exo text-[11px] text-[#8CA3C2] leading-relaxed">
                          {check.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons Deck */}
              <div className="console-panel p-6 space-y-4">
                <div>
                  <h4 className="font-orbitron font-bold text-sm text-[#EAF4FF] flex items-center gap-2 pb-2 border-b border-[rgba(56,189,248,0.2)]">
                    <ShieldCheck className="w-4 h-4 text-[#22D3EE]" />
                    OPERATOR DECISION AUTHORIZATION
                  </h4>
                  <p className="font-exo text-xs text-[#8CA3C2] mt-1.5 leading-relaxed">
                    Approval commits the proposed load allocation to the digital twin grid. Rejection drops the proposal.
                  </p>
                </div>

                {pendingPlan.is_blocked && (
                  <div className="p-3 rounded-lg bg-[rgba(255,59,78,0.15)] border border-[#FF3B4E]/40 text-[#FF3B4E] text-xs font-exo flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#FF3B4E]" />
                    <div>
                      <strong className="block font-orbitron uppercase text-[11px]">Approval Blocked</strong>
                      <span>{pendingPlan.block_reason || 'Critical constraints violated.'}</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {/* Approve Button */}
                  <button
                    type="button"
                    onClick={() => setShowApproveModal(true)}
                    disabled={
                      pendingPlan.is_blocked ||
                      submitting ||
                      patching
                    }
                    className="flex-1 py-3 px-4 rounded-xl font-orbitron text-xs font-bold uppercase tracking-wider text-black bg-[#22E58B] hover:bg-[#22E58B]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(34,229,139,0.35)] flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve Proposal</span>
                  </button>

                  {/* Reject Button */}
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={submitting || patching}
                    className="flex-1 py-3 px-4 rounded-xl font-orbitron text-xs font-bold uppercase tracking-wider text-[#FF3B4E] bg-[rgba(255,59,78,0.15)] hover:bg-[rgba(255,59,78,0.25)] border border-[rgba(255,59,78,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONFIRM APPROVE MODAL */}
      {showApproveModal && pendingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="console-panel max-w-lg w-full p-6 space-y-5 border border-[#22E58B]/50 shadow-[0_0_30px_rgba(34,229,139,0.25)]">
            <div className="flex items-center gap-3 pb-3 border-b border-[rgba(56,189,248,0.2)]">
              <div className="w-10 h-10 rounded-xl bg-[rgba(34,229,139,0.15)] border border-[#22E58B]/40 flex items-center justify-center text-[#22E58B]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-orbitron font-bold text-base text-[#EAF4FF]">
                  Confirm Allocation Authorization
                </h3>
                <span className="font-mono text-xs text-[#8CA3C2]">
                  Plan ID: {pendingPlan.id}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="font-exo font-semibold text-xs uppercase tracking-wider text-[#8CA3C2] block">
                Allocation Dispatch Impact:
              </span>

              {changedLoads.length === 0 && (
                <div className="p-3 rounded-xl bg-[rgba(34,211,238,0.1)] border border-[rgba(34,211,238,0.3)] text-xs font-exo text-[#22D3EE] flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>No changes: proposal matches the active allocation.</span>
                </div>
              )}

              <div className="max-h-48 overflow-y-auto space-y-2 p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-xs">
                {(pendingPlan.loads || []).map((l) => {
                  const delta = Number(l.delta_kw ?? 0);
                  const isChg = Math.abs(delta) > 0.001;
                  return (
                    <div key={l.id} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                      <span className="text-[#EAF4FF]">{l.name}:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#8CA3C2]">{Number(l.current_kw).toFixed(2)} kW</span>
                        <ArrowRight className="w-3 h-3 text-[#22D3EE]" />
                        <span className={`font-bold ${isChg ? 'text-[#22E58B]' : 'text-[#8CA3C2]'}`}>
                          {Number(l.proposed_kw).toFixed(2)} kW
                        </span>
                        <span className="text-[10px] text-[#8CA3C2]">
                          ({delta > 0.001 ? `+${delta.toFixed(2)} kW` : delta < -0.001 ? `${delta.toFixed(2)} kW` : 'Unchanged'})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Optional Operator Note */}
              <div className="space-y-1.5 pt-2">
                <label className="font-exo text-xs text-[#8CA3C2] flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-[#22D3EE]" />
                  <span>Optional Operator Note:</span>
                </label>
                <input
                  type="text"
                  value={operatorNote}
                  onChange={(e) => setOperatorNote(e.target.value)}
                  placeholder="e.g., Authorized dust contingency schedule"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[rgba(56,189,248,0.3)] text-xs text-[#EAF4FF] font-exo focus:border-[#22E58B] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[rgba(56,189,248,0.2)]">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-exo font-semibold text-[#8CA3C2] hover:text-[#EAF4FF] bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveConfirm}
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-orbitron font-bold uppercase tracking-wider text-black bg-[#22E58B] hover:bg-[#22E58B]/90 transition-all cursor-pointer shadow-[0_0_12px_rgba(34,229,139,0.4)]"
              >
                {submitting ? 'Dispatching...' : 'Confirm Authorization'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. CONFIRM REJECT MODAL */}
      {showRejectModal && pendingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="console-panel max-w-lg w-full p-6 space-y-5 border border-[#FF3B4E]/50 shadow-[0_0_30px_rgba(255,59,78,0.25)]">
            <div className="flex items-center gap-3 pb-3 border-b border-[rgba(56,189,248,0.2)]">
              <div className="w-10 h-10 rounded-xl bg-[rgba(255,59,78,0.15)] border border-[#FF3B4E]/40 flex items-center justify-center text-[#FF3B4E]">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-orbitron font-bold text-base text-[#EAF4FF]">
                  Confirm Proposal Rejection
                </h3>
                <span className="font-mono text-xs text-[#8CA3C2]">
                  Plan ID: {pendingPlan.id}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-exo text-xs text-[#8CA3C2] leading-relaxed">
                Dismissing this proposal leaves the active microgrid allocation completely unchanged.
                The proposal will be archived as rejected in the audit event log.
              </p>

              {/* Optional Rejection Reason */}
              <div className="space-y-1.5 pt-2">
                <label className="font-exo text-xs text-[#8CA3C2] flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-[#FF3B4E]" />
                  <span>Optional Rejection Reason:</span>
                </label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g., Unacceptable scientific payload curtailment"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[rgba(56,189,248,0.3)] text-xs text-[#EAF4FF] font-exo focus:border-[#FF3B4E] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[rgba(56,189,248,0.2)]">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-exo font-semibold text-[#8CA3C2] hover:text-[#EAF4FF] bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-orbitron font-bold uppercase tracking-wider text-white bg-[#FF3B4E] hover:bg-[#FF3B4E]/90 transition-all cursor-pointer shadow-[0_0_12px_rgba(255,59,78,0.4)]"
              >
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. IMMUTABLE AUDIT TIMELINE (FROM API) */}
      <div className="console-panel p-6 space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-[rgba(56,189,248,0.2)]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#22D3EE]" />
            <h3 className="font-orbitron font-bold text-sm text-[#EAF4FF]">
              FLIGHT DECISION & TELEMETRY AUDIT TRAIL
            </h3>
          </div>
          <span className="font-mono text-xs text-[#8CA3C2]">
            {auditEvents.length} Recorded Events
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
              {auditEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#8CA3C2]">
                    No recorded authorization events yet.
                  </td>
                </tr>
              ) : (
                auditEvents.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-mono text-[#22D3EE] font-semibold whitespace-nowrap">
                      {entry.id}
                    </td>
                    <td className="py-3 px-3 font-mono-numbers text-[#8CA3C2] whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-[#EAF4FF] block">
                        {entry.title}
                      </span>
                      <span className="text-[11px] text-[#8CA3C2] block mt-0.5">
                        {entry.details}
                        {entry.note ? ` (Note: "${entry.note}")` : ''}
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
                            : entry.status === 'REJECTED'
                            ? 'bg-[rgba(255,59,78,0.15)] text-[#FF3B4E] border-[rgba(255,59,78,0.4)]'
                            : 'bg-white/10 text-[#8CA3C2] border-white/20'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. MANDATORY ADVISORY INTEGRITY FOOTER */}
      <div className="console-panel p-4 text-center font-exo text-xs text-[#8CA3C2] leading-relaxed border border-[rgba(56,189,248,0.2)]">
        LUNAGRID AI operates in an advisory decision-support capacity under NASA/ESA human-in-the-loop spaceflight governance.
        Mission operations retain final command authority over all electrical bus switches and digital twin relays.
      </div>
    </div>
  );
};
