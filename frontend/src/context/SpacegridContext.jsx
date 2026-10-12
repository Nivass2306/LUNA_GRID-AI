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

const SpacegridContext = createContext(null);

export const SpacegridProvider = ({ children }) => {
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
      console.error('Failed to fetch SPACEGRID state:', err);
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

      const updated = await simulateSolarDrop();
      setState(updated);
      return updated;
    } catch (err) {
      console.error('Failed to simulate solar drop:', err);
      setError({
        message: err.message || 'Simulation error',
        url: getApiUrl(),
      });
      throw err;
    } finally {
      setReplanning(false);
    }
  };

  // Action: Trigger severe blackout
  const handleBlackout = async () => {
    try {
      setReplanning(true);
      setError(null);

      setEdgeFlash(true);
      setTimeout(() => setEdgeFlash(false), 850);

      const updated = await simulateBlackout();
      setState(updated);
      return updated;
    } catch (err) {
      console.error('Failed to simulate blackout:', err);
      setError({
        message: err.message || 'Blackout simulation error',
        url: getApiUrl(),
      });
      throw err;
    } finally {
      setReplanning(false);
    }
  };

  // Action: Trigger custom scenario
  const handleCustomScenario = async (params) => {
    try {
      setReplanning(true);
      setError(null);

      setEdgeFlash(true);
      setTimeout(() => setEdgeFlash(false), 850);

      const updated = await simulateCustom(params);
      setState(updated);
      return updated;
    } catch (err) {
      console.error('Failed to simulate custom scenario:', err);
      throw err;
    } finally {
      setReplanning(false);
    }
  };

  // Action: Trigger scenario preset
  const handlePresetScenario = async (scenarioId) => {
    try {
      setReplanning(true);
      setError(null);

      setEdgeFlash(true);
      setTimeout(() => setEdgeFlash(false), 850);

      const updated = await simulatePreset(scenarioId);
      setState(updated);
      return updated;
    } catch (err) {
      console.error('Failed to simulate preset scenario:', err);
      throw err;
    } finally {
      setReplanning(false);
    }
  };

  // Action: Reset grid
  const handleReset = async () => {
    try {
      setReplanning(true);
      setError(null);
      const updated = await reset();
      setState(updated);
    } catch (err) {
      console.error('Failed to reset grid:', err);
      setError({
        message: err.message || 'Reset error',
        url: getApiUrl(),
      });
    } finally {
      setReplanning(false);
    }
  };

  // Action: Operator decision
  const handleDecision = async (decision) => {
    try {
      setReplanning(true);
      setError(null);
      const updated = await decidePlan(decision);
      setState(updated);
      return updated;
    } catch (err) {
      console.error('Failed to submit operator decision:', err);
      setError({
        message: err.message || 'Decision submission error',
        url: getApiUrl(),
      });
      throw err;
    } finally {
      setReplanning(false);
    }
  };

  // Dev switcher to toggle scenarios directly
  const switchScenario = async (scenario) => {
    try {
      setReplanning(true);
      if (isMockMode()) {
        const nextState = setMockScenario(scenario);
        setState(nextState);
      } else {
        await fetchState(scenario);
      }
    } finally {
      setReplanning(false);
    }
  };

  // Polling every 5 seconds, paused when document is hidden
  useEffect(() => {
    const initialScenario = getInitialScenarioFromUrl();
    fetchState(initialScenario, true);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const startPolling = () => {
      pollTimerRef.current = setInterval(() => {
        if (!document.hidden && !replanning) {
          fetchState();
        }
      }, 5000);
    };

    startPolling();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [fetchState, replanning]);

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
    <SpacegridContext.Provider value={value}>
      {children}
    </SpacegridContext.Provider>
  );
};

export const useSpacegridState = () => {
  const context = useContext(SpacegridContext);
  if (!context) {
    throw new Error('useSpacegridState must be used within a SpacegridProvider');
  }
  return context;
};
