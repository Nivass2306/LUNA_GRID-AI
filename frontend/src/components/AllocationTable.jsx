import React from 'react';
import { useLunagridState } from '../context/LunagridContext';
import { StatusBadge } from './StatusBadge';
import { Shield, ShieldAlert, Cpu } from 'lucide-react';
import { getTierLabel } from '../lib/formatters';
import { AnimatedNumber } from './AnimatedNumber';

export const AllocationTable = () => {
  const { state } = useLunagridState();

  const loads = state?.loads || [];
  const alert = state?.alert || {};
  const isLifeSupportUnsafe = alert.life_support_ok === false;

  // Tier chip styling
  const getTierChipClass = (tier) => {
    switch (tier?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'lower':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'lowest':
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-800 text-text-muted border-border';
    }
  };

  return (
    <div className="mission-card p-4 sm:p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-bold text-sm tracking-wide text-text uppercase">
              Power Allocation Matrix
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-raised text-text-muted border border-border">
              OPTIMIZER OUTPUT
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Dynamic load throttling sorted strictly by mission survivability hierarchy.
          </p>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/70 text-text-muted">
              <th scope="col" className="pb-2.5 pl-3 font-semibold telemetry-caption text-[10px]">
                PRIORITY & SYSTEM
              </th>
              <th scope="col" className="pb-2.5 px-2 font-semibold telemetry-caption text-[10px] text-right">
                NEED
              </th>
              <th scope="col" className="pb-2.5 px-2 font-semibold telemetry-caption text-[10px] text-right">
                GETS
              </th>
              <th scope="col" className="pb-2.5 px-3 font-semibold telemetry-caption text-[10px] min-w-[130px]">
                SATISFACTION
              </th>
              <th scope="col" className="pb-2.5 pr-3 font-semibold telemetry-caption text-[10px] text-right">
                STATUS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loads.map((load) => {
              const isLifeSupport = load.id === 'life_support' || load.priority === 1;
              const need = Number(load.need_kw || 0);
              const allocated = Number(load.allocated_kw || 0);
              const percent = need > 0 ? Math.min(100, Math.round((allocated / need) * 100)) : 100;

              // Override status display in unsafe state for life support: Never show "Protected"
              let displayStatus = load.status;
              if (isLifeSupport && isLifeSupportUnsafe) {
                displayStatus = 'Unmet';
              }

              // Determine row highlight styles
              let rowClasses = 'hover:bg-bg-raised/40 transition-colors';
              if (isLifeSupport) {
                if (isLifeSupportUnsafe) {
                  rowClasses = 'bg-danger/10 border-2 border-danger rounded-lg';
                } else {
                  rowClasses = 'bg-bg-raised/30 border-l-2 border-l-ok font-medium';
                }
              }

              return (
                <tr
                  key={load.id}
                  className={`${rowClasses} group`}
                >
                  {/* Priority & System Name + Tier */}
                  <td className="py-3 pl-3 pr-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-numbers font-bold text-text-muted w-4 text-center">
                        #{load.priority}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isLifeSupport && (
                          isLifeSupportUnsafe ? (
                            <ShieldAlert className="w-4 h-4 text-danger flex-shrink-0 animate-pulse" aria-hidden="true" />
                          ) : (
                            <Shield className="w-4 h-4 text-ok flex-shrink-0" aria-hidden="true" />
                          )
                        )}
                        <span className={`font-medium ${isLifeSupport && isLifeSupportUnsafe ? 'text-danger font-bold' : 'text-text'}`}>
                          {load.name}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border uppercase font-medium ${getTierChipClass(load.tier)}`}>
                          {getTierLabel(load.tier)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Need (kW) */}
                  <td className="py-3 px-2 text-right font-mono-numbers text-text-muted">
                    {need.toFixed(1)} kW
                  </td>

                  {/* Gets (kW) */}
                  <td className="py-3 px-2 text-right font-mono-numbers font-semibold text-text">
                    <AnimatedNumber value={allocated} decimals={1} suffix=" kW" />
                  </td>

                  {/* Horizontal Bar (Gets vs Needs) */}
                  <td className="py-3 px-3">
                    <div className="space-y-1">
                      <div className="w-full bg-slate-800/90 h-2 rounded-full overflow-hidden border border-border/50">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            isLifeSupport && isLifeSupportUnsafe
                              ? 'bg-danger'
                              : percent >= 100
                              ? 'bg-ok'
                              : percent > 50
                              ? 'bg-warn'
                              : percent > 0
                              ? 'bg-demand'
                              : 'bg-transparent'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono-numbers text-text-muted">
                        <span>{percent}%</span>
                        <span>{allocated < need ? `-${(need - allocated).toFixed(1)} kW` : '100%'}</span>
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 pr-3 text-right">
                    <StatusBadge status={displayStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
