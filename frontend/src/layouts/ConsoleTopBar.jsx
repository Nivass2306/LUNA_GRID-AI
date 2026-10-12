import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RotateCcw, SunMedium, ShieldAlert, Sparkles, EyeOff } from 'lucide-react';
import { useLunagridState } from '../context/LunagridContext';
import { useAlarm } from '../context/AlarmContext';
import { useToast } from '../context/ToastContext';
import { AlertPill } from '../components/AlertPill';
import { LifeSupportAlertIndicator } from '../components/common/LifeSupportAlertIndicator';

const ROUTE_META = {
  '/console/overview': {
    title: 'OVERVIEW',
    desc: 'Base power status, survival headroom, and live telemetry',
  },
  '/console/forecast': {
    title: 'FORECAST',
    desc: 'Next 24h solar projection, battery headroom, and shortage window',
  },
  '/console/allocation': {
    title: 'ALLOCATION',
    desc: 'Active power routing plan and AI trade-off rationale',
  },
  '/console/manual': {
    title: 'MANUAL ROUTING',
    desc: 'Direct operator control, real-time consequence engine, safety interlock',
  },
  '/console/comparison': {
    title: 'POLICY COMPARISON',
    desc: 'LUNAGRID vs Strict Priority vs Equal Split allocation policies',
  },
  '/console/approval': {
    title: 'OPERATOR APPROVAL',
    desc: 'Advisory recommendations, transparent reasoning, and command authorization',
  },
  '/console/simulation': {
    title: 'SIMULATION',
    desc: 'Solar drop sandbox, eclipse curve testing, and contingency rehearsals',
  },
  '/console/events': {
    title: 'EVENT LOG',
    desc: 'Chronological telemetry and decision audit trail',
  },
};

export const ConsoleTopBar = () => {
  const location = useLocation();
  const { state, simulateSolarDrop, simulateBlackout, reset, replanning } = useLunagridState();
  const { isFlashActive, isUnsafe, isDismissed, dismissFlash } = useAlarm();
  const { addToast, showToast } = useToast();
  const toast = addToast || showToast || (({ title, message }) => console.log(title, message));

  const currentMeta = ROUTE_META[location.pathname] || {
    title: 'MISSION CONSOLE',
    desc: 'Autonomous Lunar Microgrid Advisory System',
  };

  // Live ticking mission clock (MET + Sol)
  const [clock, setClock] = useState({ sol: 142, met: '04:18:22' });

  useEffect(() => {
    const startTime = Date.now();
    const baseSeconds = 4 * 3600 + 18 * 60 + 22; // MET 04:18:22
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const totalSec = baseSeconds + elapsed;
      const hours = String(Math.floor(totalSec / 3600) % 24).padStart(2, '0');
      const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
      const seconds = String(totalSec % 60).padStart(2, '0');
      setClock({ sol: 142, met: `${hours}:${minutes}:${seconds}` });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const alert = state?.alert || {};
  const alertLevel = alert.level || 'green';
  const alertTitle = alert.title || (alertLevel === 'red' ? (alert.life_support_ok === false ? 'UNSAFE' : 'SHORTAGE') : alertLevel === 'yellow' ? 'SHORTAGE' : 'NOMINAL');

  const handleDrop = async () => {
    try {
      toast({
        title: 'Solar Drop Triggered',
        message: 'Simulating 70% solar panel degradation (3.0 kW output)',
        type: 'warning',
      });
      await simulateSolarDrop();
    } catch {
      toast({
        title: 'Simulation Error',
        message: 'Failed to apply solar drop test',
        type: 'danger',
      });
    }
  };

  const handleBlackout = async () => {
    try {
      toast({
        title: 'Blackout Triggered',
        message: 'Simulating severe blackout emergency',
        type: 'danger',
      });
      await simulateBlackout();
    } catch {
      toast({
        title: 'Simulation Error',
        message: 'Failed to apply blackout emergency',
        type: 'danger',
      });
    }
  };

  const handleReset = async () => {
    try {
      addToast({
        title: 'Grid Restored',
        message: 'Restored nominal daylight generation (10.0 kW output)',
        type: 'success',
      });
      await reset();
    } catch {
      addToast({
        title: 'Reset Error',
        message: 'Failed to reset grid state',
        type: 'danger',
      });
    }
  };

  return (
    <header
      className={`h-16 flex items-center justify-between px-6 backdrop-blur-md select-none shrink-0 z-20 transition-all duration-300 ${
        isFlashActive
          ? 'bg-[rgba(38,10,18,0.92)] border-b-2 border-b-[#FF3B4E] shadow-[0_4px_28px_rgba(255,59,78,0.45)]'
          : 'bg-[rgba(3,8,20,0.85)] border-b border-[rgba(56,189,248,0.20)]'
      }`}
    >
      {/* Page Title & Description */}
      <div className="flex flex-col">
        <h1 className="font-orbitron font-bold text-lg md:text-xl text-[#EAF4FF] tracking-wide flex items-center gap-2">
          {currentMeta.title}
          {replanning && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[rgba(34,211,238,0.15)] text-[#22D3EE] border border-[rgba(34,211,238,0.3)] animate-pulse">
              <Sparkles className="w-3 h-3 animate-spin" />
              RE-PLANNING
            </span>
          )}
        </h1>
        <p className="font-exo text-xs text-[#8CA3C2] truncate max-w-md hidden sm:block">
          {currentMeta.desc}
        </p>
      </div>

      {/* Center-Right: Alert Pill + Dismiss Flash + Mission Clock + Quick Actions */}
      <div className="flex items-center gap-2.5 md:gap-4">
        {/* Global Alert Pill */}
        <AlertPill level={alertLevel} title={alertTitle} />

        {/* Global Life Support Deficit Alert Indicator */}
        <LifeSupportAlertIndicator />

        {/* Dismiss Flash Button (Visible ONLY while UNSAFE and flash is active) */}
        {isUnsafe && !isDismissed && (
          <button
            onClick={dismissFlash}
            title="Dismiss full-screen flashing for this emergency incident"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-exo text-xs font-bold text-white bg-[#FF3B4E] hover:bg-[#FF3B4E]/85 border border-[#FF3B4E] transition-all shadow-[0_0_14px_rgba(255,59,78,0.6)] active:scale-95 animate-pulse"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Dismiss flash</span>
          </button>
        )}

        {/* Live Mission Clock */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-lg bg-[rgba(7,18,40,0.7)] border border-[rgba(56,189,248,0.2)] font-mono-numbers text-xs text-[#8CA3C2]">
          <span className="font-semibold text-[#EAF4FF]">SOL {clock.sol}</span>
          <span className="text-[rgba(56,189,248,0.4)]">|</span>
          <span className="text-[#22D3EE]">MET {clock.met}</span>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Drop solar 70% button */}
          <button
            onClick={handleDrop}
            disabled={replanning}
            title="Drop solar generation by 70% to trigger shortage scenario (Key: D)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-exo text-xs font-semibold text-[#FFC233] bg-[rgba(255,194,51,0.12)] border border-[rgba(255,194,51,0.45)] hover:bg-[rgba(255,194,51,0.22)] hover:border-[#FFC233] transition-all shadow-[0_0_10px_rgba(255,194,51,0.15)] active:scale-95 disabled:opacity-50"
          >
            <SunMedium className="w-3.5 h-3.5 text-[#FFC233]" />
            <span className="hidden sm:inline">Drop 70%</span>
            <kbd className="px-1 py-0.2 font-mono text-[11px] bg-black/40 text-[#FFC233] rounded ml-0.5">
              D
            </kbd>
          </button>

          {/* Blackout button */}
          <button
            onClick={handleBlackout}
            disabled={replanning}
            title="Trigger severe blackout event where life support is compromised (Red Alert)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-exo text-xs font-semibold text-[#FF3B4E] bg-[rgba(255,59,78,0.14)] border border-[rgba(255,59,78,0.5)] hover:bg-[rgba(255,59,78,0.25)] hover:border-[#FF3B4E] transition-all shadow-[0_0_10px_rgba(255,59,78,0.2)] active:scale-95 disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#FF3B4E]" />
            <span className="hidden sm:inline">Blackout</span>
          </button>

          {/* Reset button */}
          <button
            onClick={handleReset}
            disabled={replanning}
            title="Reset microgrid to nominal day condition (Key: R)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-exo text-xs font-semibold text-[#22E58B] bg-[rgba(34,229,139,0.12)] border border-[rgba(34,229,139,0.45)] hover:bg-[rgba(34,229,139,0.22)] hover:border-[#22E58B] transition-all shadow-[0_0_10px_rgba(34,229,139,0.15)] active:scale-95 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#22E58B]" />
            <span className="hidden sm:inline">Reset</span>
            <kbd className="px-1 py-0.2 font-mono text-[11px] bg-black/40 text-[#22E58B] rounded ml-0.5">
              R
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
};
