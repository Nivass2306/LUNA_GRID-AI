import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLunagridState } from './LunagridContext';

const AlarmContext = createContext(null);

export const AlarmProvider = ({ children }) => {
  const { state, loading, error } = useLunagridState();

  // 1. Incident dismissal: dismissed for current unsafe incident only
  const [isDismissed, setIsDismissed] = useState(false);
  const lastUnsafeRef = useRef(false);

  // 2. Determine if system is in UNSAFE state
  // Only when state has loaded, backend is reachable, and life support is failing.
  // Treat undefined, null, loading, or error state as NOT unsafe.
  const isUnsafe = Boolean(
    !loading &&
    !error &&
    state &&
    state.alert &&
    state.alert.life_support_ok === false
  );

  // When returning from UNSAFE to non-unsafe (e.g. after Reset or Restore Safe Plan),
  // automatically clear isDismissed so a future new incident will flash again.
  useEffect(() => {
    if (!isUnsafe && lastUnsafeRef.current) {
      setIsDismissed(false);
    }
    lastUnsafeRef.current = isUnsafe;
  }, [isUnsafe]);

  const dismissFlash = useCallback(() => {
    setIsDismissed(true);
  }, []);

  const isFlashActive = isUnsafe && !isDismissed;

  const value = {
    isUnsafe,
    isFlashActive,
    isDismissed,
    dismissFlash,
    // Aliases for backwards-compatibility
    isAlarmActive: isFlashActive,
    isSilenced: isDismissed,
    silenceAlarm: dismissFlash,
  };

  return (
    <AlarmContext.Provider value={value}>
      {children}
    </AlarmContext.Provider>
  );
};

export const useAlarm = () => {
  const context = useContext(AlarmContext);
  if (!context) {
    throw new Error('useAlarm must be used within an AlarmProvider');
  }
  return context;
};
