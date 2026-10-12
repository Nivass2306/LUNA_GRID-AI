import React from 'react';
import { useLunagridState } from '../context/LunagridContext';
import { Check, X, AlertTriangle, PhoneCall, Clock, CheckCircle2, XCircle } from 'lucide-react';

export const OperatorDecision = () => {
  const { state, replanning, decidePlan } = useLunagridState();

  const plan = state?.plan || { status: 'pending' };
  const alert = state?.alert || {};
  const isLifeSupportUnsafe = alert.life_support_ok === false;
  const planStatus = (plan.status || 'pending').toLowerCase();

  // Status badge style
  const getStatusChip = () => {
    switch (planStatus) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-ok/15 text-ok border border-ok/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>APPROVED</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-danger/15 text-danger border border-danger/30">
            <XCircle className="w-3 h-3" />
            <span>REJECTED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-warn/15 text-warn border border-warn/30">
            <Clock className="w-3 h-3" />
            <span>PENDING ADVISORY</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <span className="telemetry-caption text-[10px]">OPERATOR DECISION</span>
        {getStatusChip()}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        {isLifeSupportUnsafe ? (
          // In UNSAFE state: Approve is disabled and replaced by "Acknowledge & escalate"
          <button
            type="button"
            onClick={() => decidePlan('reject')}
            disabled={replanning}
            aria-busy={replanning}
            className="col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-heading font-semibold text-xs tracking-wider uppercase bg-danger hover:bg-red-600 text-white shadow-glow-danger border border-danger/80 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50"
          >
            <PhoneCall className="w-4 h-4 animate-bounce" aria-hidden="true" />
            <span>Acknowledge & Escalate</span>
          </button>
        ) : (
          <>
            {/* Standard State: Approve Button */}
            <button
              type="button"
              onClick={() => decidePlan('approve')}
              disabled={replanning || planStatus === 'approved'}
              aria-busy={replanning}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-heading font-semibold text-xs tracking-wider uppercase transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ok focus:ring-offset-1 focus:ring-offset-bg ${
                planStatus === 'approved'
                  ? 'bg-ok/20 text-ok border border-ok/40 cursor-default'
                  : 'bg-ok/90 hover:bg-ok text-slate-950 font-bold hover:shadow-lg active:scale-95'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Approve Plan</span>
            </button>

            {/* Reject Button */}
            <button
              type="button"
              onClick={() => decidePlan('reject')}
              disabled={replanning || planStatus === 'rejected'}
              aria-busy={replanning}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-heading font-semibold text-xs tracking-wider uppercase transition-all duration-150 border focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-1 focus:ring-offset-bg ${
                planStatus === 'rejected'
                  ? 'bg-danger/20 text-danger border-danger/40 cursor-default'
                  : 'bg-card hover:bg-bg-raised text-text-muted hover:text-danger border-border hover:border-danger/40 active:scale-95'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reject Plan</span>
            </button>
          </>
        )}
      </div>

      <p className="text-[10px] text-text-muted/80 text-center italic">
        Advisory telemetry only. Implementation requires human operator authorization.
      </p>
    </div>
  );
};
