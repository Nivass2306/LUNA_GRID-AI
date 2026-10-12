import React from 'react';
import { useLunagridState } from '../context/LunagridContext';
import { TopBar } from '../components/TopBar';
import { UnsafeBanner } from '../components/UnsafeBanner';
import { ScenarioStrip } from '../components/ScenarioStrip';
import { KpiRow } from '../components/KpiRow';
import { ForecastChart } from '../components/ForecastChart';
import { BatteryGauge } from '../components/BatteryGauge';
import { AllocationTable } from '../components/AllocationTable';
import { ReasonsPanel } from '../components/ReasonsPanel';
import { PolicyComparison } from '../components/PolicyComparison';
import { OfflineFallback } from '../components/OfflineFallback';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { AlertTriangle } from 'lucide-react';

export const DashboardPage = () => {
  const { state, loading, error, edgeFlash } = useLunagridState();

  const alert = state?.alert || {};
  const isLifeSupportUnsafe = alert.life_support_ok === false;
  // Critical non-unsafe state: life support ok, but habitat or communication underpowered / red alert
  const isCriticalWarning = alert.level === 'red' && alert.life_support_ok === true;

  return (
    <div className={`min-h-screen lunagrid-pattern flex flex-col relative transition-all duration-300 ${
      edgeFlash ? 'animate-edge-flash' : ''
    }`}>
      {/* 1. Top Navigation Bar */}
      <TopBar />

      {/* UNSAFE Full-Width Banner (only when life support cannot be fully powered) */}
      {isLifeSupportUnsafe && <UnsafeBanner message={alert.message} />}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 lg:px-6 py-4 space-y-4">
        {error ? (
          <OfflineFallback />
        ) : loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Critical Warning Card (Habitat or Comms throttled, but Life Support OK - no pulse) */}
            {isCriticalWarning && (
              <div className="w-full bg-warn/10 border border-warn/40 rounded-card p-3 sm:p-4 flex items-center justify-between gap-3 text-xs text-warn shadow-card">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-warn" aria-hidden="true" />
                  <span>
                    <strong>ADVISORY ADMONITION:</strong> Generation drop detected. Habitat systems & communication bandwidth reduced to preserve critical margins.
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-warn/80 font-bold hidden sm:inline">
                  LEVEL 2 THROTTLE ACTIVE
                </span>
              </div>
            )}

            {/* 2. Scenario Strip */}
            <ScenarioStrip />

            {/* 3. KPI Telemetry Row (4 Cards) */}
            <KpiRow />

            {/* 4. Main Row: Forecast & Risk (8/12) + Battery Gauge (4/12) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8">
                <ForecastChart />
              </div>
              <div className="lg:col-span-4">
                <BatteryGauge />
              </div>
            </div>

            {/* 5. Second Row: Power Allocation Matrix (7/12) + Rationale & Decision (5/12) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7">
                <AllocationTable />
              </div>
              <div className="lg:col-span-5">
                <ReasonsPanel />
              </div>
            </div>

            {/* 6. Bottom Row: Policy Benchmark Comparison */}
            <PolicyComparison />
          </>
        )}
      </main>

      {/* 7. Footer: Strict Honesty Disclaimer */}
      <footer className="w-full border-t border-border/80 bg-bg-raised/80 py-3 px-4 text-center text-xs text-text-muted">
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-mono text-[11px]">
            LUNAGRID AI · Autonomous Energy Distribution Advisor
          </p>
          <p className="text-[11px] text-text-muted/80">
            Software prototype. Not connected to real habitat hardware.
          </p>
          <p className="font-mono text-[10px] text-text-muted/60">
            SEC-OP-2026-LUNAR-B
          </p>
        </div>
      </footer>
    </div>
  );
};
