import React, { useState, useEffect } from 'react';

/**
 * Smoothly animates numeric transitions over ~600ms using requestAnimationFrame.
 * If prefers-reduced-motion is active, updates immediately.
 */
export const AnimatedNumber = ({ value, decimals = 1, suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    const start = displayValue;
    const end = Number(value);
    if (isNaN(end) || start === end) {
      setDisplayValue(value);
      return;
    }

    const duration = 600; // ~600 ms as requested
    const startTime = performance.now();

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(end);
      }
    };

    const frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  const formatted = typeof displayValue === 'number' && !isNaN(displayValue)
    ? displayValue.toFixed(decimals)
    : value;

  return (
    <span className="font-mono-numbers">
      {formatted}{suffix}
    </span>
  );
};
