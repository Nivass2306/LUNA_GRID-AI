import React, { useEffect } from 'react';
import { useLunagridState } from '../context/LunagridContext';

export const ActionButtons = () => {
  const { simulateSolarDrop, simulateBlackout, reset, replanning } = useLunagridState();

  // Keyboard shortcuts [D] and [R]
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        simulateSolarDrop();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [simulateSolarDrop, reset]);

  return (
    <div className="flex items-center gap-3 select-none flex-wrap">
      {/* Simulate solar drop button */}
      <button
        onClick={() => simulateSolarDrop()}
        disabled={replanning}
        className="group relative inline-flex items-center gap-2.5 px-4 py-2.5 bg-danger text-ground font-sans font-medium text-[13px] hover:bg-[#ff5d52] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer text-white"
        title="Simulate sudden -70% solar irradiance drop (Shortcut: D)"
      >
        <span>Simulate 70% solar drop</span>
        <span className="font-mono text-[10px] leading-none px-1.5 py-0.5 border border-ground/30 bg-ground/10 text-white font-semibold">
          D
        </span>
      </button>

      {/* Blackout button */}
      <button
        onClick={() => simulateBlackout()}
        disabled={replanning}
        className="group relative inline-flex items-center gap-2 px-3.5 py-2.5 bg-[#8b0000] hover:bg-[#a51010] text-white font-sans font-medium text-[13px] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer border border-[#FF3B4E]/50 shadow-[0_0_10px_rgba(255,59,78,0.2)]"
        title="Trigger severe blackout event where life support is compromised"
      >
        <span>Blackout</span>
      </button>

      {/* Quiet Reset text button */}
      <button
        onClick={() => reset()}
        disabled={replanning}
        className="group inline-flex items-center gap-2 text-[13px] text-muted hover:text-bone active:scale-[0.98] transition-all disabled:opacity-40 cursor-pointer"
        title="Reset habitat telemetry to nominal operations (Shortcut: R)"
      >
        <span>Reset</span>
        <span className="font-mono text-[10px] leading-none px-1.5 py-0.5 border border-hairline bg-raised text-muted group-hover:text-bone transition-colors">
          R
        </span>
      </button>
    </div>
  );
};
