import React from 'react';

export const ManualConsequences = ({
  evaluation,
  isEvaluating,
  currentState,
  isOverBudget,
}) => {
  const recSurvival = currentState?.survival?.hours_now ?? null;
  const recUnmet = Number(currentState?.risk?.max_deficit_kw ?? 0.0);
  const recLsOk = Boolean(currentState?.alert?.life_support_ok ?? true);
  const recLevel = (currentState?.alert?.level || 'green').toLowerCase();

  const yourSurvival = evaluation?.survival_hours !== undefined ? evaluation.survival_hours : recSurvival;
  const yourUnmet = evaluation?.unmet_kw !== undefined ? Number(evaluation.unmet_kw) : recUnmet;
  const yourLsOk = evaluation?.life_support_ok ?? recLsOk;
  const yourLevel = (evaluation?.alert?.level || 'green').toLowerCase();

  const hasBothNumeric = typeof yourSurvival === 'number' && typeof recSurvival === 'number';
  const survivalDelta = evaluation?.vs_recommended?.survival_delta_h ?? (hasBothNumeric ? +(yourSurvival - recSurvival).toFixed(1) : null);
  const unmetDelta = evaluation?.vs_recommended?.unmet_delta_kw ?? +(yourUnmet - recUnmet).toFixed(1);

  const summary = evaluation?.summary || 'Evaluating flight plan in lunar digital twin...';

  const renderSurvBlock = (val, isYour = true) => {
    if (val === null || val === undefined) {
      return (
        <span className={`font-display text-3xl sm:text-4xl ${isYour ? 'text-battery' : 'text-muted'}`}>
          Sustained
        </span>
      );
    }
    const n = Number(val);
    if (n <= 0.001) {
      return (
        <span className="font-display text-3xl sm:text-4xl text-danger">
          0 h (unsafe)
        </span>
      );
    }
    return (
      <div className="flex items-baseline gap-2">
        <span className={`font-display text-3xl sm:text-4xl ${isYour ? 'text-bone' : 'text-muted'}`}>
          {n.toFixed(1)}
        </span>
        <span className="text-muted text-[11px]">hours</span>
      </div>
    );
  };

  return (
    <div className="select-none font-sans">
      {/* Header with checking indicator */}
      <div className="flex items-center justify-between border-b border-hairline pb-2 mb-3">
        <h2 className="font-display text-2xl text-bone">
          Projected consequences
        </h2>
        <div className="flex items-center gap-2">
          {isEvaluating && (
            <span className="font-mono text-[11px] text-solar animate-pulse">
              checking...
            </span>
          )}
          <span className="font-mono text-[10px] text-muted border border-hairline px-1.5 py-0.5">
            TWIN EVAL
          </span>
        </div>
      </div>

      {/* Safety warning strip if Life Support underpowered */}
      {!yourLsOk && (
        <div className="mb-4 py-1.5 px-3 bg-danger/15 border border-danger/40 text-danger text-[12.5px] font-medium">
          Unsafe: life support is underpowered in your plan.
        </div>
      )}

      {/* Two columns of big serif numbers: "Your plan" vs "SPACEGRID plan" */}
      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-hairline/60">
        {/* Column 1: Your Plan */}
        <div>
          <span className="text-[12px] text-bone font-medium block mb-2">
            Your plan
          </span>

          <div className="space-y-3">
            {/* Survival Hours */}
            <div>
              <div className="flex items-baseline gap-2 flex-wrap">
                {renderSurvBlock(yourSurvival, true)}
                {survivalDelta !== null && survivalDelta !== 0 && (
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      survivalDelta > 0 ? 'text-battery' : 'text-danger'
                    }`}
                  >
                    {survivalDelta > 0 ? `+${survivalDelta}` : survivalDelta}h
                  </span>
                )}
              </div>
              <span className="text-[11.5px] text-muted">Survival runtime</span>
            </div>

            {/* Unmet demand */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl text-bone">
                  {yourUnmet.toFixed(1)}
                </span>
                <span className="text-muted text-[11px]">kW</span>
                {unmetDelta !== 0 && (
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      unmetDelta < 0 ? 'text-battery' : 'text-danger'
                    }`}
                  >
                    {unmetDelta > 0 ? `+${unmetDelta}` : unmetDelta}
                  </span>
                )}
              </div>
              <span className="text-[11.5px] text-muted">Unmet demand</span>
            </div>

            {/* Life support */}
            <div>
              <span
                className={`font-sans text-[13px] font-medium ${
                  yourLsOk ? 'text-battery' : 'text-danger'
                }`}
              >
                {yourLsOk ? 'Powered (3.0 kW)' : 'Underpowered'}
              </span>
              <span className="block text-[11.5px] text-muted">Life support</span>
            </div>
          </div>
        </div>

        {/* Column 2: SPACEGRID Plan */}
        <div className="border-l border-hairline/60 pl-4">
          <span className="text-[12px] text-muted font-medium block mb-2">
            SPACEGRID plan
          </span>

          <div className="space-y-3">
            {/* Recommended Survival */}
            <div>
              {renderSurvBlock(recSurvival, false)}
              <span className="text-[11.5px] text-muted">Survival runtime</span>
            </div>

            {/* Recommended Unmet */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl text-muted">
                  {recUnmet.toFixed(1)}
                </span>
                <span className="text-muted text-[11px]">kW</span>
              </div>
              <span className="text-[11.5px] text-muted">Unmet demand</span>
            </div>

            {/* Recommended Life Support */}
            <div>
              <span
                className={`font-sans text-[13px] font-medium ${
                  recLsOk ? 'text-battery' : 'text-danger'
                }`}
              >
                {recLsOk ? 'Protected (3.0 kW)' : 'Critical'}
              </span>
              <span className="block text-[11.5px] text-muted">Life support</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary sentence from API */}
      <div className="mt-3 text-[13px] text-bone/90 leading-relaxed font-sans min-h-[44px]">
        {summary}
      </div>
    </div>
  );
};
