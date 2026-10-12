import React, { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, ShieldAlert, Clock, Info, ShieldCheck } from 'lucide-react';

export const CommandAuditRow = ({
  plan = {},
  isUnsafe = false,
  nextActionText = '',
  onApprove,
  onReject,
  events = [],
}) => {
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  // Hold-to-confirm logic (~800ms)
  useEffect(() => {
    let timer;
    if (holding) {
      const startTime = performance.now();
      timer = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const p = Math.min(1, elapsed / 800);
        setHoldProgress(p);
        if (p >= 1) {
          clearInterval(timer);
          setHolding(false);
          setHoldProgress(0);
          if (onApprove) onApprove();
        }
      }, 30);
    } else {
      setHoldProgress(0);
    }
    return () => clearInterval(timer);
  }, [holding, onApprove]);

  const defaultNextAction = isUnsafe
    ? 'Critical deficit: Life support underpowered. Human command escalation required.'
    : plan.status === 'pending'
    ? 'Review proposed emergency load shedding and approve recommended distribution.'
    : 'Autonomous regulation active. All sub-system allocations nominal.';

  const actionCopy = nextActionText || defaultNextAction;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 w-full">
      {/* 1. NEXT ACTION PANEL */}
      <div className="hud-panel hud-panel-blur p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-panel-border/40 pb-2">
          <h3 className="hud-title text-xs tracking-wider flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-cyan" />
            Next Action
          </h3>
          <span className="text-[10px] font-mono uppercase text-muted">Flight Controller</span>
        </div>

        <p className="text-xs font-mono text-text/90 my-2 leading-relaxed">
          {actionCopy}
        </p>

        <div className="flex items-center gap-2 pt-2 border-t border-panel-border/30">
          {isUnsafe ? (
            <button
              onClick={onReject}
              className="w-full py-2 bg-danger hover:bg-danger/80 text-white font-exo font-bold text-xs uppercase tracking-wider rounded-xs shadow-[0_0_12px_rgba(255,59,78,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Escalate to Mission Commander</span>
            </button>
          ) : (
            <>
              {/* Circular Ring Hold-to-Confirm Approve Button */}
              <button
                onMouseDown={() => setHolding(true)}
                onMouseUp={() => setHolding(false)}
                onMouseLeave={() => setHolding(false)}
                onTouchStart={() => setHolding(true)}
                onTouchEnd={() => setHolding(false)}
                className="relative flex-1 py-2 bg-gradient-to-r from-ok to-cyan text-space font-exo font-bold text-xs uppercase tracking-wider rounded-xs overflow-hidden select-none active:scale-95 transition-all shadow-[0_0_12px_rgba(34,229,139,0.4)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {/* Hold progress ring/bar overlay */}
                {holding && (
                  <div
                    className="absolute inset-0 bg-white/35 transition-all pointer-events-none"
                    style={{ width: `${holdProgress * 100}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  {holding ? `Holding ${(holdProgress * 100).toFixed(0)}%...` : 'Hold to Approve Plan'}
                </span>
              </button>

              <button
                onClick={onReject}
                className="py-2 px-4 border border-panel-border/60 hover:border-danger text-muted hover:text-danger bg-space/60 font-exo text-xs uppercase tracking-wider rounded-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. RECENT EVENTS LOG */}
      <div className="hud-panel hud-panel-blur p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-panel-border/40 pb-2">
          <h3 className="hud-title text-xs tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan" />
            Recent Events
          </h3>
          <span className="text-[10px] font-mono text-muted uppercase">Audit Feed</span>
        </div>

        <div className="space-y-1.5 my-2 max-h-24 overflow-y-auto pr-1">
          {events.length === 0 ? (
            <div className="text-[11px] font-mono text-muted italic">No events logged yet.</div>
          ) : (
            events.slice(0, 4).map((ev, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 text-[11px] font-mono py-1 px-1.5 rounded bg-space/50 border border-panel-border/20"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      ev.level === 'danger'
                        ? 'bg-danger'
                        : ev.level === 'warn'
                        ? 'bg-warn'
                        : 'bg-ok'
                    }`}
                  />
                  <span className="text-text truncate">{ev.text}</span>
                </div>
                <span className="text-muted/70 text-[10px] shrink-0">{ev.time}</span>
              </div>
            ))
          )}
        </div>

        <div className="text-[10px] font-mono text-muted/60 border-t border-panel-border/30 pt-1">
          Chronological twin telemetry log
        </div>
      </div>

      {/* 3. MISSION OBJECTIVE (HONESTY PROTOCOL) */}
      <div className="hud-panel hud-panel-blur p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-panel-border/40 pb-2">
          <h3 className="hud-title text-xs tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan" />
            Mission Objective
          </h3>
          <span className="text-[10px] font-mono text-cyan uppercase font-bold">Advisory Only</span>
        </div>

        <p className="text-[11px] font-mono text-muted leading-relaxed my-2">
          SPACEGRID AI is an advisory digital twin optimizing energy distribution during lunar emergencies.
          All allocations are mathematical simulations requiring flight controller authorization.
        </p>

        <div className="text-[10px] font-mono text-muted/80 border-t border-panel-border/30 pt-1 flex justify-between">
          <span>Simulation Mode: Active</span>
          <span>No Direct Actuator Control</span>
        </div>
      </div>
    </div>
  );
};
