import React, { useEffect, useState } from 'react';
import { useLunagridState } from '../../context/LunagridContext';
import { useAlarm } from '../../context/AlarmContext';

export const EmergencyAlarm = () => {
  const { state, loading, error } = useLunagridState();
  const { isDismissed } = useAlarm();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // 1. Strict boolean check: ALL must be true for UNSAFE emergency state:
  // - state has loaded (!loading)
  // - backend is reachable (!error)
  // - state and alert object exist
  // - alert.life_support_ok === false
  // Treat undefined, null, loading, or error as NOT unsafe.
  const isUnsafe = Boolean(
    !loading &&
    !error &&
    state &&
    state.alert &&
    state.alert.life_support_ok === false
  );

  // Visual emergency effect is active when UNSAFE and not dismissed
  const isVisualActive = Boolean(isUnsafe && !isDismissed);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // If not visually active, render polite status announcement if dismissed
  if (!isVisualActive) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {isUnsafe ? 'Emergency flash dismissed by operator. Life support shortage persists.' : 'Microgrid alert status nominal.'}
      </div>
    );
  }

  return (
    <>
      {/* Screen Reader Assertive Announcement */}
      <div
        role="alert"
        aria-live="assertive"
        className="sr-only"
      >
        Emergency: life support cannot be fully powered. Operator action required.
      </div>

      {/* Full-screen red overlay
          - inset-0 pointer-events-none z-[45] (above content, below modals z-50 and toasts z-50)
          - Safe pulse frequency: 1.8s period (~0.55 flashes/sec, strictly <= 1/s, WCAG 2.3.1 compliant)
          - Reduced-motion mode: no animation, steady red border and soft tint
      */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 pointer-events-none z-[45] transition-all duration-500 ${
          prefersReducedMotion
            ? 'emergency-overlay-reduced'
            : 'emergency-overlay-pulse'
        }`}
      />
    </>
  );
};
