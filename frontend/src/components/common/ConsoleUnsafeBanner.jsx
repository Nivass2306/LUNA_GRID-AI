import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { useSpacegridState } from '../../context/SpacegridContext';
import { useToast } from '../../context/ToastContext';

export const ConsoleUnsafeBanner = () => {
  const { state, reset } = useSpacegridState();
  const { addToast } = useToast();

  const alert = state?.alert || {};
  const isUnsafe = alert.life_support_ok === false;

  if (!isUnsafe) return null;

  const handleRestore = async () => {
    try {
      await reset();
      addToast({
        title: 'Safe Plan Restored',
        message: 'Life support power restored to 3.0 kW nominal baseline',
        type: 'success',
      });
    } catch {
      addToast({
        title: 'Restore Failed',
        message: 'Unable to restore safe state automatically',
        type: 'danger',
      });
    }
  };

  return (
    <div className="w-full bg-[rgba(255,59,78,0.18)] border-b border-[#FF3B4E]/60 px-6 py-2 flex items-center justify-between z-10 animate-pulse">
      <div className="flex items-center gap-2.5 text-[#FF3B4E]">
        <AlertOctagon className="w-4 h-4 shrink-0 animate-bounce" />
        <span className="font-orbitron font-semibold text-xs md:text-sm tracking-wide">
          LIFE SUPPORT AT RISK — POWER SHORTAGE UNRESOLVED
        </span>
      </div>
      <button
        onClick={handleRestore}
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#FF3B4E] hover:bg-[#FF3B4E]/80 text-white font-exo text-xs font-bold uppercase tracking-wider transition-colors shadow-[0_0_12px_rgba(255,59,78,0.5)] active:scale-95"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Restore Safe Plan</span>
      </button>
    </div>
  );
};
