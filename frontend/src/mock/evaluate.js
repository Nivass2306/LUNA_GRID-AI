/**
 * SPACEGRID AI - Deterministic Mock Evaluation Calculator
 * 
 * MOCK-ONLY IMPLEMENTATION:
 * This module is strictly used when VITE_USE_MOCK=true.
 * In production/real mode, the frontend NEVER computes these numbers;
 * it solely calls POST /allocation/evaluate and renders the API response.
 */

const LOAD_WEIGHTS = {
  life_support: 1000,
  habitat: 100,
  comms: 100,
  communication: 100,
  science: 10,
  experiments: 10,
  rover: 1,
};

const LOAD_NEEDS = {
  life_support: 3.0,
  habitat: 2.0,
  comms: 1.2,
  communication: 1.2,
  science: 1.0,
  experiments: 1.0,
  rover: 0.8,
};

export function evaluateMockAllocation(allocations = {}, currentState = {}) {
  const power = currentState?.power || {};
  const battery = currentState?.battery || {};
  const recommendedLoads = currentState?.loads || [];

  const availableKw = Number(power.available_kw ?? power.available ?? 5.5);
  const totalBaseDemand = 8.0;

  // Normalize key names (comms vs communication, science vs experiments)
  const normAlloc = {
    life_support: Number(allocations.life_support ?? 0),
    habitat: Number(allocations.habitat ?? 0),
    comms: Number(allocations.comms ?? allocations.communication ?? 0),
    science: Number(allocations.science ?? allocations.experiments ?? 0),
    rover: Number(allocations.rover ?? 0),
  };

  const totalAllocated = Object.values(normAlloc).reduce((sum, v) => sum + v, 0);
  const overBudgetKw = Math.max(0, +(totalAllocated - availableKw).toFixed(2));
  const unmetKw = Math.max(0, +(totalBaseDemand - totalAllocated).toFixed(2));

  const lifeSupportOk = normAlloc.life_support >= 3.0;

  // Weighted unmet calculation
  let weightedUnmet = 0;
  Object.keys(LOAD_NEEDS).forEach((id) => {
    if (id === 'communication' || id === 'experiments') return;
    const need = LOAD_NEEDS[id];
    const alloc = normAlloc[id] ?? 0;
    const unmetPart = Math.max(0, need - alloc);
    weightedUnmet += unmetPart * (LOAD_WEIGHTS[id] || 1);
  });
  weightedUnmet = +weightedUnmet.toFixed(1);

  // Projected survival hours:
  // Derived from battery capacity (kWh) vs net continuous draw from battery.
  const solarKw = Number(power.solar_kw ?? power.solar ?? 3.0);
  const batteryDrawKw = Math.max(0, totalAllocated - solarKw);
  const usableBatteryKwh = Math.max(0.5, Number(battery.soc_kwh ?? 8.5) - Number(battery.min_reserve_kwh ?? 3.0));

  let survivalHours = 18.0;
  if (batteryDrawKw > 0) {
    survivalHours = Math.max(1.0, +(usableBatteryKwh / batteryDrawKw).toFixed(1));
  } else if (!lifeSupportOk) {
    survivalHours = 0.5;
  }

  // Determine load statuses
  const resultLoads = [
    {
      id: 'life_support',
      allocated_kw: normAlloc.life_support,
      status: normAlloc.life_support >= 3.0 ? 'full' : normAlloc.life_support > 0 ? 'reduced' : 'off',
    },
    {
      id: 'habitat',
      allocated_kw: normAlloc.habitat,
      status: normAlloc.habitat >= 2.0 ? 'full' : normAlloc.habitat > 0 ? 'reduced' : 'off',
    },
    {
      id: 'comms',
      allocated_kw: normAlloc.comms,
      status: normAlloc.comms >= 1.2 ? 'full' : normAlloc.comms > 0 ? 'reduced' : 'off',
    },
    {
      id: 'science',
      allocated_kw: normAlloc.science,
      status: normAlloc.science >= 1.0 ? 'full' : normAlloc.science > 0 ? 'reduced' : 'off',
    },
    {
      id: 'rover',
      allocated_kw: normAlloc.rover,
      status: normAlloc.rover >= 0.8 ? 'full' : normAlloc.rover > 0 ? 'reduced' : 'postponed',
    },
  ];

  // Alert level
  let alertLevel = 'green';
  let alertTitle = 'NOMINAL';
  let alertMessage = 'Manual plan is stable within electrical limits.';

  if (!lifeSupportOk) {
    alertLevel = 'red';
    alertTitle = 'UNSAFE';
    alertMessage = 'Critical: Life support is underpowered in this manual plan.';
  } else if (overBudgetKw > 0) {
    alertLevel = 'red';
    alertTitle = 'OVER BUDGET';
    alertMessage = `Manual allocations exceed available power by ${overBudgetKw.toFixed(1)} kW.`;
  } else if (unmetKw > 0) {
    alertLevel = 'yellow';
    alertTitle = 'WATCH';
    alertMessage = `Deficit managed. ${unmetKw.toFixed(1)} kW shed across non-critical loads.`;
  }

  // Summary sentence
  let summary = '';
  if (!lifeSupportOk) {
    summary = `Life support receives only ${normAlloc.life_support.toFixed(1)} of 3.0 kW. Critical loops will depressurize.`;
  } else if (overBudgetKw > 0) {
    summary = `Allocations sum to ${totalAllocated.toFixed(1)} kW, exceeding the ${availableKw.toFixed(1)} kW bus limit.`;
  } else if (normAlloc.science === 0 && normAlloc.rover === 0) {
    summary = `Science and rover suspended. ${normAlloc.life_support.toFixed(1)} kW protected for Life Support, preserving habitat safety.`;
  } else {
    summary = `Manual distribution sustains ${normAlloc.life_support.toFixed(1)} kW for Life Support with ${survivalHours.toFixed(1)} hours projected runtime.`;
  }

  // Deltas vs recommended plan
  const recSurvival = Number(currentState?.survival?.hours_now ?? 6.0);
  const recUnmet = Number(currentState?.risk?.max_deficit_kw ?? 2.5);

  const survivalDelta = +(survivalHours - recSurvival).toFixed(1);
  const unmetDelta = +(unmetKw - recUnmet).toFixed(1);

  return {
    valid: overBudgetKw === 0,
    total_allocated_kw: +totalAllocated.toFixed(2),
    available_kw: availableKw,
    over_budget_kw: overBudgetKw,
    life_support_ok: lifeSupportOk,
    alert: {
      level: alertLevel,
      title: alertTitle,
      message: alertMessage,
    },
    survival_hours: survivalHours,
    unmet_kw: unmetKw,
    weighted_unmet: weightedUnmet,
    loads: resultLoads,
    summary,
    vs_recommended: {
      survival_delta_h: survivalDelta,
      unmet_delta_kw: unmetDelta,
    },
  };
}
