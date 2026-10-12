import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLunagridState } from '../context/LunagridContext';
import { AlertPill } from './AlertPill';
import { LifeSupportAlertIndicator } from './common/LifeSupportAlertIndicator';
import { Sun, Moon, Orbit, Cpu, ChevronDown, ArrowLeft } from 'lucide-react';
import { formatUtcTime } from '../lib/formatters';

export const TopBar = () => {
  const { state, isMock, switchScenario, replanning } = useLunagridState();
  const [clockTime, setClockTime] = useState('');
  const [scenarioMenuOpen, setScenarioMenuOpen] = useState(false);

  // Live ticking clock synced with state timestamp or current UTC
  useEffect(() => {
    const updateTime = () => {
      setClockTime(formatUtcTime(state?.timestamp));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [state?.timestamp]);

  const mission = state?.mission || {};
  const alert = state?.alert || { level: 'green', title: 'NOMINAL' };
  const phase = (mission.phase || 'day').toLowerCase();
  const dustFactor = mission.dust_factor !== undefined ? Number(mission.dust_factor).toFixed(2) : '0.12';

  return (
    <header className="w-full bg-bg-raised/95 border-b border-border backdrop-blur-sm sticky top-0 z-40 px-4 lg:px-6 py-2.5">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Logo & Brand + Back to Overview */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-demand/50 rounded-lg p-0.5"
            title="Return to LunaGrid AI Overview"
          >
            <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center text-solar shadow-inner group-hover:border-demand/40 transition-colors">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {/* Sun with orbital path */}
                <circle cx="12" cy="12" r="4" fill="#FFC857" fillOpacity="0.2" />
                <circle cx="12" cy="12" r="4" stroke="#FFC857" />
                <ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(-25 12 12)" stroke="#38BDF8" strokeDasharray="3 2" />
                <circle cx="19" cy="8.5" r="1.5" fill="#38BDF8" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-bold text-base tracking-wider text-text group-hover:text-demand transition-colors">
                  LUNAGRID AI
                </h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/60 text-demand border border-demand/30 font-mono tracking-tight font-semibold">
                  CONSOLE
                </span>
              </div>
              <p className="text-xs text-text-muted leading-tight">
                Lunar habitat energy advisor
              </p>
            </div>
          </Link>

          <Link
            to="/"
            className="hidden xl:inline-flex items-center gap-1 text-[11px] font-mono text-text-muted hover:text-text px-2 py-1 rounded bg-card/60 hover:bg-card border border-border ml-2 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Overview</span>
          </Link>
        </div>

        {/* Center: Mission Telemetry (Clock, Phase, Dust) */}
        <div className="flex items-center gap-4 text-xs">
          {/* Mission UTC Clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border/80">
            <span className="telemetry-caption text-[10px]">UTC CLOCK</span>
            <span className="font-mono-numbers text-text font-medium text-xs">
              {clockTime || '2026-03-14 10:00:00 UTC'}
            </span>
          </div>

          {/* Lunar Phase Chip */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border/80">
            <span className="telemetry-caption text-[10px]">LUNAR PHASE</span>
            <div className="flex items-center gap-1.5 font-mono-numbers text-xs font-medium capitalize">
              {phase === 'day' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
                  <span className="text-solar">Lunar Day</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-demand" aria-hidden="true" />
                  <span className="text-demand">Lunar Night</span>
                </>
              )}
            </div>
          </div>

          {/* Dust Factor Chip */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border/80">
            <span className="telemetry-caption text-[10px]">DUST FACTOR</span>
            <span className={`font-mono-numbers text-xs font-semibold ${Number(dustFactor) > 0.5 ? 'text-warn' : 'text-text'}`}>
              {dustFactor}
            </span>
          </div>
        </div>

        {/* Right: Permanent Advisory Badge, Mock Indicator, Alert Pill, Scenario Switch */}
        <div className="flex items-center gap-2.5">
          {/* Permanent Advisory Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-700/60 text-text-muted text-[11px] font-medium tracking-wide"
            title="Digital twin operating strictly in advisory mode. Never commands real hardware."
          >
            <Cpu className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span className="uppercase tracking-wider font-semibold">ADVISORY MODE · DIGITAL TWIN</span>
          </div>

          {/* Mock Data Indicator */}
          {isMock && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30"
              title="Running on offline fixtures"
            >
              MOCK DATA
            </span>
          )}

          {/* System Alert Pill */}
          <AlertPill level={alert.level} title={alert.title} />

          {/* Global Life Support Deficit Alert Indicator */}
          <LifeSupportAlertIndicator />

          {/* Dev Quick Scenario Selector (Hidden unless VITE_ENABLE_DEV_SCENARIO_SWITCH === 'true') */}
          {import.meta.env.VITE_ENABLE_DEV_SCENARIO_SWITCH === 'true' && (
            <div className="relative">
              <button
                onClick={() => setScenarioMenuOpen(!scenarioMenuOpen)}
                disabled={replanning}
                className="px-2 py-1 text-[11px] rounded bg-card hover:bg-slate-800 border border-border text-text-muted hover:text-text flex items-center gap-1 transition-colors"
                title="Switch demo scenarios for verification"
              >
                <span>State</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {scenarioMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 rounded-lg bg-card border border-border shadow-xl p-1 z-50 text-xs">
                  <div className="px-2 py-1 text-[10px] text-text-muted font-bold tracking-wider uppercase border-b border-border/50">
                    Select Scenario
                  </div>
                  <button
                    onClick={() => { switchScenario('nominal'); setScenarioMenuOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-bg-raised text-text flex items-center justify-between"
                  >
                    <span>Nominal</span>
                    <span className="w-2 h-2 rounded-full bg-ok"></span>
                  </button>
                  <button
                    onClick={() => { switchScenario('after_drop'); setScenarioMenuOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-bg-raised text-text flex items-center justify-between"
                  >
                    <span>-70% Solar Drop</span>
                    <span className="w-2 h-2 rounded-full bg-danger"></span>
                  </button>
                  <button
                    onClick={() => { switchScenario('unsafe'); setScenarioMenuOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-bg-raised text-text flex items-center justify-between"
                  >
                    <span>UNSAFE (Severe)</span>
                    <span className="w-2 h-2 rounded-full bg-danger animate-pulse"></span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
