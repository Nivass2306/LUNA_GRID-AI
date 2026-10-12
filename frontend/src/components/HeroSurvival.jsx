import React, { useState, useEffect } from 'react';
import { useLunagridState } from '../context/LunagridContext';

export const HeroSurvival = ({ mode = 'auto', manualSurvivalHours = null }) => {
  const { state } = useLunagridState();
  const survival = state?.survival || {};

  const autoNow = survival.hours_now ?? null;
  const before = survival.hours_before ?? null;
  const now = mode === 'manual' && manualSurvivalHours !== null
    ? manualSurvivalHours
    : autoNow;

  const hasChanged =
    mode === 'auto' &&
    now !== null &&
    before !== null &&
    Math.abs(Number(now) - Number(before)) > 0.05;

  const numNow = typeof now === 'number' ? now : null;
  const [displayNow, setDisplayNow] = useState(numNow);

  useEffect(() => {
    if (numNow === null) {
      setDisplayNow(null);
      return;
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayNow(numNow);
      return;
    }

    const start = typeof displayNow === 'number' ? displayNow : numNow;
    const end = numNow;
    if (start === end) return;

    const duration = 600;
    const startTime = performance.now();

    const step = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;
      setDisplayNow(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayNow(end);
      }
    };

    const frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [numNow]);

  const renderBefore = () => {
    if (before === null) return 'Sustained';
    if (before <= 0.001) return <span className="text-[#FF3B4E]">0 h (unsafe)</span>;
    return `${Number(before).toFixed(1)} h`;
  };

  const isUnsafe = now !== null && Number(now) <= 0.001;
  const isSustained = now === null;

  return (
    <div className="flex flex-col select-none">
      <div className="flex items-baseline gap-4">
        {hasChanged && (
          <span className="font-display text-muted text-4xl sm:text-5xl line-through decoration-hairline">
            {renderBefore()}
          </span>
        )}
        <div
          className={`font-display leading-none tracking-tight font-normal ${
            isUnsafe
              ? 'text-[#FF3B4E] text-4xl sm:text-6xl xl:text-7xl'
              : isSustained
              ? 'text-[#22E58B] text-5xl sm:text-7xl xl:text-8xl'
              : 'text-bone text-[96px] sm:text-[120px] xl:text-[144px]'
          }`}
        >
          {isSustained
            ? 'Sustained'
            : isUnsafe
            ? '0 h (unsafe)'
            : (displayNow !== null ? displayNow : Number(now)).toFixed(1)}
        </div>
        {!isSustained && !isUnsafe && (
          <span className="font-display italic text-2xl sm:text-3xl text-muted pb-4">
            hours
          </span>
        )}
      </div>
      <div className="text-[13px] text-muted mt-1 font-sans">
        {mode === 'manual' ? 'projected runtime with your plan' : 'operational runtime headroom'}
      </div>
    </div>
  );
};
