import React from 'react';
import { useSpacegridState } from '../context/SpacegridContext';
import { Flame, RotateCcw, Loader2, Sparkles } from 'lucide-react';

export const ScenarioStrip = () => {
  const { state, replanning, simulateSolarDrop, reset } = useSpacegridState();

  const mission = state?.mission || {};
  const alert = state?.alert || {};
  const isSolarDropped = (state?.power?.solar_kw || 10) <= 3.0;

  return (
    <section
      aria-label="Scenario Controls"
      className="w-full bg-card/60 border border-border rounded-card p-3 sm:p-4 mb-4 shadow-card"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Active Scenario Context */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="telemetry-caption">ACTIVE SCENARIO</span>
            <span className="text-xs px-2 py-0.5 rounded bg-bg-raised text-text font-mono border border-border">
              {mission.scenario || 'Nominal Base Operations'}
            </span>
          </div>
          <p className="text-xs text-text-muted max-w-2xl leading-relaxed">
            {alert.message || 'Lunar habitat telemetry nominal. Solar collection meets base operational baselines.'}
          </p>
        </div>

        {/* Right: Primary Action & Reset */}
        <div className="flex items-center gap-3 self-start md:self-center flex-shrink-0">
          {/* Big Red Button: Simulate 70% Solar Drop */}
          <button
            type="button"
            onClick={() => simulateSolarDrop(0.7)}
            disabled={replanning}
            aria-busy={replanning}
            className={`relative group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-heading font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-bg ${
              replanning
                ? 'bg-danger/60 text-white cursor-not-allowed shadow-none'
                : isSolarDropped
                ? 'bg-danger/80 text-white hover:bg-danger shadow-glow-danger active:scale-95'
                : 'bg-danger hover:bg-red-600 text-white shadow-glow-danger active:scale-95'
            }`}
          >
            {replanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                <span>Re-planning...</span>
              </>
            ) : (
              <>
                <Flame className="w-4 h-4 text-white" aria-hidden="true" />
                <span>Simulate 70% Solar Drop</span>
              </>
            )}
          </button>

          {/* Ghost Button: Reset */}
          <button
            type="button"
            onClick={() => reset()}
            disabled={replanning}
            aria-busy={replanning}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text bg-bg-raised/70 hover:bg-bg-raised border border-border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-demand/50 focus:ring-offset-1 focus:ring-offset-bg ${
              replanning ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${replanning ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </section>
  );
};
