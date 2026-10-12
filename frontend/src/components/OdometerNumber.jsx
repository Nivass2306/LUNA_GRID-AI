import React, { useEffect, useState, useRef } from 'react';

export const OdometerNumber = ({
  value = 0,
  decimals = 1,
  prefix = '',
  suffix = '',
  className = '',
  glow = true,
}) => {
  const [displayValue, setDisplayValue] = useState(Number(value) || 0);
  const targetValueRef = useRef(Number(value) || 0);
  const startValueRef = useRef(Number(value) || 0);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    if (target === targetValueRef.current) return;

    startValueRef.current = displayValue;
    targetValueRef.current = target;
    startTimeRef.current = performance.now();

    const duration = 650; // ms
    let animId;

    const tick = (now) => {
      const elapsed = now - (startTimeRef.current || now);
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValueRef.current + (targetValueRef.current - startValueRef.current) * eased;

      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(targetValueRef.current);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  const formatted = displayValue.toFixed(decimals);

  return (
    <span
      className={`font-orbitron font-bold tabular-nums inline-flex items-baseline ${
        glow ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]' : ''
      } ${className}`}
    >
      {prefix && <span className="mr-0.5 text-[0.8em] font-normal opacity-80">{prefix}</span>}
      {formatted}
      {suffix && <span className="ml-1 text-[0.75em] font-normal opacity-80">{suffix}</span>}
    </span>
  );
};
