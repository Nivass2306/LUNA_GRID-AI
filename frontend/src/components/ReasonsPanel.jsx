import React from 'react';
import { useLunagridState } from '../context/LunagridContext';
import { Shield, Home, Radio, Microscope, Truck, CheckCircle2 } from 'lucide-react';
import { OperatorDecision } from './OperatorDecision';

const getLoadIcon = (id) => {
  switch (id) {
    case 'life_support':
      return Shield;
    case 'habitat':
      return Home;
    case 'comms':
      return Radio;
    case 'science':
      return Microscope;
    case 'rover':
      return Truck;
    default:
      return Shield;
  }
};

export const ReasonsPanel = () => {
  const { state } = useLunagridState();

  const loads = state?.loads || [];
  const risk = state?.risk || {};
  const isShortage = Boolean(risk.shortage_expected);

  return (
    <div className="mission-card p-4 sm:p-5 flex flex-col justify-between h-full">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-heading font-bold text-sm tracking-wide text-text uppercase">
              Advisory Rationale & Decision
            </h2>
            <span className="telemetry-caption text-[10px]">
              AI OPTIMIZER EXPLANABILITY ENGINE
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-raised text-text-muted border border-border">
            {loads.length} LOADS ANALYZED
          </span>
        </div>

        {/* Reasons Cards Container */}
        <div
          role="region"
          aria-live="polite"
          aria-label="Optimization reasons"
          className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1"
        >
          {!isShortage ? (
            <div className="p-4 rounded-xl bg-bg-raised/70 border border-border/60 text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-ok/10 text-ok mx-auto flex items-center justify-center border border-ok/30">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold text-text">No action needed</p>
              <p className="text-[11px] text-text-muted">
                Solar generation satisfies baseline habitat demand. Storage reserve remains fully uncompromised.
              </p>
            </div>
          ) : (
            loads.map((load, index) => {
              const Icon = getLoadIcon(load.id);
              return (
                <div
                  key={load.id}
                  style={{ animationDelay: `${index * 80}ms` }}
                  className="p-2.5 rounded-lg bg-bg-raised/60 hover:bg-bg-raised border border-border/70 transition-all duration-200"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center flex-shrink-0 text-demand mt-0.5">
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-medium text-text truncate">
                          {load.name}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted uppercase">
                          {load.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {load.reason || 'Shedding policy derived from mission constraints.'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Operator Decision Section */}
      <div className="mt-4 pt-3 border-t border-border/70">
        <OperatorDecision />
      </div>
    </div>
  );
};
