import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getState,
  simulateSolarDrop,
  simulateBlackout,
  simulateCustom,
  simulatePreset,
  reset,
  decidePlan,
  isMockMode,
  getApiUrl,
  setMockScenario,
} from '../lib/api.js';

export const LunagridContext = createContext(null);
export const SpacegridContext = LunagridContext; // Backward compatibility alias

export const LunagridProvider = ({ children }) => {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replanning, setReplanning] = useState(false);
  const [error, setError] = useState(null);
  const [edgeFlash, setEdgeFlash] = useState(false);
  const pollTimerRef = useRef(null);

  // Read scenario from URL parameter if provided (?scenario=unsafe | after_drop | nominal)
  const getInitialScenarioFromUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('scenario');
    } catch {
      return null;
    }
  };

  const fetchState = useCallback(async (requestedScenario = null, isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const data = await getState(requestedScenario);
      setState(data);
    } catch (err) {
      console.error('Failed to fetch LUNAGRID state:', err);
      setError({
        message: err.message || 'Connection failed',
        url: getApiUrl(),
      });
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Action: Trigger solar drop
  const handleSolarDrop = async () => {
    try {
      setReplanning(true);
      setError(null);

      // Trigger edge flash animation for visual telemetry signal
      setEdgeFlash(true);
      setTimeout(() => setEdgeFlash(false), 850);

      const data = await simulateSolarDrop();
      setState(data);
    } catch (err) {
      console.error('Solar drop simulation failed:', err);
      setError({
        message: err.message || 'Simulation failed',
        url: getApiUrl(),
      });
    } finally {
      setReplanning(false);
    }
  };

  // Action: Trigger blackout
  const handleBlackout = async () => {
    try {
      setReplanning(true);
      setError(null);

      // Trigger edge flash animation for visual telemetry signal
      setEdgeFlash(true);
      setTimeout(() => setEdgeFlash(false), 850);

      const data = await simulateBlackout();
      setState(data);
    } catch (err) {
      console.error('Blackout simulation failed:', err);
      setError({
        message: err.message || 'Simulation failed',
        url: getApiUrl(),
      });
    } finally {
      setReplanning(false);
    }
  };

  // Action: Trigger custom scenario
  const handleCustomScenario = async (solarDropPct, dustFactor, batterySocKwh) => {
    try {
      setReplanning(true);
      setError(null);

      setEdgeFlash(true);
      setTimeout(() => setEdgeFlash(false), 850);

      const data = await simulateCustom(solarDropPct, dustFactor, batterySocKwh);
      setState(data);
    } catch (err) {
      console.error('Custom scenario simulation failed:', err);
      setError({
        message: err.message || 'Simulation failed',
        url: getApiUrl(),
      });
    } finally {
      setReplanning(false);
    }
  };

  // Action: Trigger preset scenario
  const handlePresetScenario = async (presetId) => {
    try {
      setReplanning(true);
      setError(null);

      setEdgeFlash(true);
      setTimeout(() => setEdgeFlash(false), 850);

      const data = await simulatePreset(presetId);
      setState(data);
    } catch (err) {
      console.error('Preset scenario simulation failed:', err);
      setError({
        message: err.message || 'Simulation failed',
        url: getApiUrl(),
      });
    } finally {
      setReplanning(false);
    }
  };

  // Action: Reset to nominal state
  const handleReset = async () => {
    try {
      setReplanning(true);
      setError(null);
      const data = await reset();
      setState(data);
    } catch (err) {
      console.error('Reset failed:', err);
      setError({
        message: err.message || 'Reset failed',
        url: getApiUrl(),
      });
    } finally {
      setReplanning(false);
    }
  };

  // Action: Operator decision on advisory plan
  const handleDecision = async (decision) => {
    try {
      setReplanning(true);
      setError(null);
      const data = await decidePlan(decision);
      setState(data);
    } catch (err) {
      console.error(`Plan ${decision} failed:`, err);
      setError({
        message: err.message || 'Decision failed',
        url: getApiUrl(),
      });
    } finally {
      setReplanning(false);
    }
  };

  // Switch scenario (Mock mode only)
  const switchScenario = (scenarioKey) => {
    if (!isMockMode()) return;
    setMockScenario(scenarioKey);
    fetchState(scenarioKey);
  };

  // Initial load
  useEffect(() => {
    const scenario = getInitialScenarioFromUrl();
    if (scenario && isMockMode()) {
      setMockScenario(scenario);
    }
    fetchState(scenario, true);
  }, [fetchState]);

  // Periodic polling (1.5s live, 5s mock)
  useEffect(() => {
    const pollInterval = isMockMode() ? 5000 : 1500;

    pollTimerRef.current = setInterval(() => {
      // Don't poll while an action is in-flight or if initial load errored heavily
      if (!replanning) {
        fetchState(null, false);
      }
    }, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [fetchState, replanning]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'd':
          e.preventDefault();
          handleSolarDrop();
          break;
        case 'b':
          e.preventDefault();
          handleBlackout();
          break;
        case 'r':
          e.preventDefault();
          handleReset();
          break;
        case 'a':
          if (state?.plan?.status === 'pending' || state?.decision === 'pending') {
            e.preventDefault();
            handleDecision('approve');
          }
          break;
        case 'x':
          if (state?.plan?.status === 'pending' || state?.decision === 'pending') {
            e.preventDefault();
            handleDecision('reject');
          }
          break;
        case '1':
          if (isMockMode()) {
            e.preventDefault();
            switchScenario('nominal');
          }
          break;
        case '2':
          if (isMockMode()) {
            e.preventDefault();
            switchScenario('after_drop');
          }
          break;
        case '3':
          if (isMockMode()) {
            e.preventDefault();
            switchScenario('unsafe');
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, replanning]);

  const value = {
    state,
    loading,
    replanning,
    error,
    edgeFlash,
    isMock: isMockMode(),
    apiUrl: getApiUrl(),
    simulateSolarDrop: handleSolarDrop,
    simulateBlackout: handleBlackout,
    simulateCustom: handleCustomScenario,
    simulatePreset: handlePresetScenario,
    reset: handleReset,
    decidePlan: handleDecision,
    approvePlan: () => handleDecision('approve'),
    rejectPlan: () => handleDecision('reject'),
    refresh: () => fetchState(null, false),
    switchScenario,
  };

  return (
    <LunagridContext.Provider value={value}>
      {children}
    </LunagridContext.Provider>
  );
};

export const SpacegridProvider = LunagridProvider; // Backward compatibility alias

export const useLunagridState = () => {
  const context = useContext(LunagridContext);
  if (!context) {
    throw new Error('useLunagridState must be used within a LunagridProvider');
  }
  return context;
};

export const useSpacegridState = useLunagridState; // Backward compatibility alias
