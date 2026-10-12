import React, { useState, useEffect } from 'react';

export const BootSequence = ({ onComplete }) => {
  const [booting, setBooting] = useState(true);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Check session storage
    if (sessionStorage.getItem('spacegrid_booted')) {
      setBooting(false);
      if (onComplete) onComplete();
      return;
    }

    const bootMessages = [
      'INITIALIZING SPACEGRID AI CORE...',
      'ESTABLISHING LUNAR SURFACE TELEMETRY LINK...',
      'CALIBRATING PHOTOVOLTAIC & BATTERY STORAGE SENSORS...',
      'ALL SYSTEMS SYNCHRONIZED. DIGITAL TWIN ONLINE.',
    ];

    let timer;
    let s = 0;
    timer = setInterval(() => {
      s += 1;
      setStage(s);
      if (s >= bootMessages.length) {
        clearInterval(timer);
        setTimeout(() => {
          sessionStorage.setItem('spacegrid_booted', 'true');
          setBooting(false);
          if (onComplete) onComplete();
        }, 350);
      }
    }, 380);

    // Any key or click skips immediately
    const handleSkip = () => {
      clearInterval(timer);
      sessionStorage.setItem('spacegrid_booted', 'true');
      setBooting(false);
      if (onComplete) onComplete();
    };

    window.addEventListener('keydown', handleSkip);
    window.addEventListener('click', handleSkip);

    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', handleSkip);
      window.removeEventListener('click', handleSkip);
    };
  }, [onComplete]);

  if (!booting) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#030814] flex flex-col items-center justify-center p-6 text-cyan select-none transition-opacity duration-500 ease-out">
      {/* Scanline overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

      {/* Boot HUD Frame */}
      <div className="relative z-10 w-full max-w-lg p-8 border border-cyan/40 bg-panel shadow-[0_0_50px_rgba(34,211,238,0.2)] rounded">
        <div className="flex items-center justify-between border-b border-cyan/30 pb-3 mb-6">
          <span className="font-orbitron font-bold text-lg tracking-widest text-text">
            SPACEGRID AI
          </span>
          <span className="text-xs font-mono text-cyan animate-pulse">BOOT SEQUENCE</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-space border border-cyan/40 rounded-xs overflow-hidden mb-6">
          <div
            className="h-full bg-cyan shadow-[0_0_10px_#22D3EE] transition-all duration-300 ease-out"
            style={{ width: `${((stage + 1) / 4) * 100}%` }}
          />
        </div>

        {/* Terminal Boot Lines */}
        <div className="font-mono text-xs space-y-2 text-text/90">
          <div className="text-ok">✓ HARDWARE ADVISORY PROTOCOL INITIALIZED</div>
          {stage >= 1 && <div className="text-cyan">✓ ORBITAL SOLAR EPHEMERIS LINKED</div>}
          {stage >= 2 && <div className="text-cyan">✓ 5 HABITAT SUBSYSTEM CHANNELS READY</div>}
          {stage >= 3 && <div className="text-solar font-bold animate-pulse">✓ DIGITAL TWIN READY. LAUNCHING CONSOLE...</div>}
        </div>

        <div className="mt-8 pt-4 border-t border-cyan/20 flex justify-between items-center text-[11px] font-mono text-muted">
          <span>PRESS ANY KEY TO SKIP</span>
          <span className="animate-ping w-2 h-2 rounded-full bg-cyan" />
        </div>
      </div>
    </div>
  );
};
