import { useState, useEffect, useRef, useCallback } from 'react';
import { evaluateAllocation, applyManualAllocation, returnToAuto } from '../lib/api';

const LOAD_NEEDS = {
  life_support: 3.0,
  habitat: 2.0,
  comms: 1.2,
  science: 1.0,
  rover: 0.8,
};

// Priority order for trimming: lowest first (rover -> science -> comms -> habitat -> life_support)
const TRIM_PRIORITY_ORDER = ['rover', 'science', 'comms', 'habitat', 'life_support'];

export function useManualDraft(currentState, onStateUpdate) {
  const [mode, setMode] = useState('auto'); // 'auto' | 'manual'
  const [draft, setDraft] = useState({
    life_support: 3.0,
    habitat: 2.0,
    comms: 1.2,
    science: 1.0,
    rover: 0.8,
  });

  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [hardCapWarning, setHardCapWarning] = useState(false);
  const [busNudge, setBusNudge] = useState(false);
  const [transmitAnimation, setTransmitAnimation] = useState(false);
  const [showAutoConfirm, setShowAutoConfirm] = useState(false);

  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastAppliedRef = useRef(draft);

  const power = currentState?.power || {};
  const availableKw = Number(power.available_kw ?? power.available ?? 12.0);

  // Initialize or synchronize draft when entering manual mode
  const enterManualMode = useCallback(() => {
    if (currentState?.loads && currentState.loads.length > 0) {
      const initial = {};
      currentState.loads.forEach((l) => {
        initial[l.id] = Number(l.recommended_kw ?? l.allocated_kw ?? 0.0);
      });
      setDraft(initial);
      lastAppliedRef.current = { ...initial };
    }
    setMode('manual');
    setShowAutoConfirm(false);
  }, [currentState]);

  // Request to switch back to auto
  const requestSwitchAuto = useCallback(() => {
    if (currentState?.plan?.source === 'manual') {
      setShowAutoConfirm(true);
    } else {
      setMode('auto');
      setShowAutoConfirm(false);
    }
  }, [currentState]);

  const confirmSwitchAuto = useCallback(async () => {
    try {
      const updated = await returnToAuto();
      if (onStateUpdate) onStateUpdate(updated);
      setMode('auto');
      setShowAutoConfirm(false);
    } catch (err) {
      console.error('Failed to return to auto:', err);
    }
  }, [onStateUpdate]);

  const cancelSwitchAuto = useCallback(() => {
    setShowAutoConfirm(false);
  }, []);

  // Keyboard shortcut [M] to toggle mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (mode === 'auto') {
          enterManualMode();
        } else {
          requestSwitchAuto();
        }
      } else if ((e.key === 'z' || e.key === 'Z') && mode === 'manual') {
        e.preventDefault();
        startFromZero();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, enterManualMode, requestSwitchAuto]);

  // Trigger hard cap limit feedback
  const triggerHardCapFeedback = useCallback(() => {
    setHardCapWarning(true);
    setBusNudge(true);
    setTimeout(() => setBusNudge(false), 240);
    setTimeout(() => setHardCapWarning(false), 2800);
  }, []);

  // Set single load allocation with strict budget capping
  const setLoadAllocation = useCallback((loadId, requestedVal) => {
    setDraft((prev) => {
      const need = LOAD_NEEDS[loadId] || 3.0;
      const current = prev[loadId] ?? 0.0;
      const target = Math.max(0, Math.min(need, Math.round(requestedVal * 10) / 10));

      // Calculate total if this target is applied
      const otherTotal = Object.entries(prev).reduce(
        (sum, [id, val]) => (id === loadId ? sum : sum + val),
        0
      );

      const maxPossibleForThis = Math.max(0, Math.round((availableKw - otherTotal) * 10) / 10);

      if (target > maxPossibleForThis) {
        // Exceeded available power! Clamp to limit and trigger hard cap feedback
        triggerHardCapFeedback();
        const clamped = Math.min(need, maxPossibleForThis);
        return { ...prev, [loadId]: clamped };
      }

      return { ...prev, [loadId]: target };
    });
  }, [availableKw, triggerHardCapFeedback]);

  // Toggle load between 0 and full need
  const toggleLoad = useCallback((loadId) => {
    setDraft((prev) => {
      const need = LOAD_NEEDS[loadId] || 3.0;
      const current = prev[loadId] ?? 0.0;
      if (current > 0.05) {
        // Turn off
        return { ...prev, [loadId]: 0.0 };
      } else {
        // Turn full need
        const otherTotal = Object.entries(prev).reduce(
          (sum, [id, val]) => (id === loadId ? sum : sum + val),
          0
        );
        const maxPossible = Math.max(0, Math.round((availableKw - otherTotal) * 10) / 10);
        if (need > maxPossible) {
          triggerHardCapFeedback();
          return { ...prev, [loadId]: Math.min(need, maxPossible) };
        }
        return { ...prev, [loadId]: need };
      }
    });
  }, [availableKw, triggerHardCapFeedback]);

  // Action: Start from zero [Z]
  const startFromZero = useCallback(() => {
    setDraft({
      life_support: 0.0,
      habitat: 0.0,
      comms: 0.0,
      science: 0.0,
      rover: 0.0,
    });
  }, []);

  // Action: Discard changes
  const discardChanges = useCallback(() => {
    setDraft({ ...lastAppliedRef.current });
  }, []);

  // Action: Auto-fix with LUNAGRID
  const autoFixWithRecommended = useCallback(() => {
    if (currentState?.loads) {
      const fixed = {};
      currentState.loads.forEach((l) => {
        fixed[l.id] = Number(l.recommended_kw ?? l.allocated_kw ?? 0.0);
      });
      setDraft(fixed);
    }
  }, [currentState]);

  // Action: Trim from lowest priority until it fits
  const trimFromLowestPriority = useCallback(() => {
    setDraft((prev) => {
      const next = { ...prev };
      let currentSum = Object.values(next).reduce((s, v) => s + v, 0);
      let excess = Math.max(0, currentSum - availableKw);

      if (excess <= 0.01) return next;

      for (const id of TRIM_PRIORITY_ORDER) {
        if (excess <= 0.01) break;
        const currentVal = next[id] ?? 0.0;
        if (currentVal > 0) {
          const reduction = Math.min(currentVal, excess);
          next[id] = Math.round((currentVal - reduction) * 10) / 10;
          excess -= reduction;
        }
      }
      return next;
    });
  }, [availableKw]);

  // Total allocated in draft
  const totalDraftKw = Object.values(draft).reduce((sum, v) => sum + v, 0);
  const remainingBudgetKw = Math.max(0, Math.round((availableKw - totalDraftKw) * 10) / 10);
  const isOverBudget = totalDraftKw > availableKw + 0.05;
  const overBudgetDelta = Math.max(0, Math.round((totalDraftKw - availableKw) * 10) / 10);

  // Debounced API evaluation (150ms) with AbortController
  useEffect(() => {
    if (mode !== 'manual') return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsEvaluating(true);

      try {
        const result = await evaluateAllocation(draft, controller.signal);
        setEvaluation(result);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Manual evaluation failed:', err);
        }
      } finally {
        setIsEvaluating(false);
      }
    }, 150);

    return () => {
      clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [draft, mode, availableKw]);

  // Apply manual allocation
  const applyManualPlan = useCallback(async (overrideSafety = false) => {
    try {
      const updated = await applyManualAllocation(draft, overrideSafety);
      lastAppliedRef.current = { ...draft };
      if (onStateUpdate) onStateUpdate(updated);

      // Play transmit surge animation
      setTransmitAnimation(true);
      setTimeout(() => setTransmitAnimation(false), 1200);

      return true;
    } catch (err) {
      console.error('Failed to apply manual plan:', err);
      throw err;
    }
  }, [draft, onStateUpdate]);

  return {
    mode,
    setMode,
    enterManualMode,
    requestSwitchAuto,
    confirmSwitchAuto,
    cancelSwitchAuto,
    showAutoConfirm,
    draft,
    setDraft,
    setLoadAllocation,
    toggleLoad,
    startFromZero,
    discardChanges,
    autoFixWithRecommended,
    trimFromLowestPriority,
    totalDraftKw,
    remainingBudgetKw,
    isOverBudget,
    overBudgetDelta,
    evaluation,
    isEvaluating,
    hardCapWarning,
    busNudge,
    transmitAnimation,
    applyManualPlan,
  };
}
