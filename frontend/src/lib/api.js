import { nominalState, afterDropState, unsafeState } from '../mock/fixtures.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const REQUEST_TIMEOUT_MS = 8000; // 8-second timeout requirement

/**
 * Normalizes backend responses to conform strictly to the SPACEGRID AI JSON contract.
 * All field name differences and variations are handled HERE ONLY, never in components.
 */
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }

  // 1. Mission object
  const mission = {
    mode: raw.mission?.mode ?? 'moon',
    phase: raw.mission?.phase ?? 'day',
    dust_factor: raw.mission?.dust_factor ?? 0.12,
    scenario: raw.mission?.scenario ?? 'Nominal operations',
  };

  // 2. Power object (teammate mismatch handling: 'solar' vs 'solar_kw', 'demand' vs 'demand_kw', etc.)
  const rawPower = raw.power || {};
  const power = {
    solar_kw: Number(rawPower.solar_kw ?? rawPower.solar ?? 10.0),
    demand_kw: Number(rawPower.demand_kw ?? rawPower.demand ?? 8.0),
    usable_battery_kw: Number(rawPower.usable_battery_kw ?? rawPower.usable_battery ?? 2.0),
    available_kw: Number(rawPower.available_kw ?? rawPower.available ?? 12.0),
  };

  // 3. Battery object ('soc' vs 'soc_kwh', 'capacity' vs 'capacity_kwh', etc.)
  const rawBattery = raw.battery || {};
  const battery = {
    soc_kwh: Number(rawBattery.soc_kwh ?? rawBattery.soc ?? 8.5),
    capacity_kwh: Number(rawBattery.capacity_kwh ?? rawBattery.capacity ?? 20.0),
    min_reserve_kwh: Number(rawBattery.min_reserve_kwh ?? rawBattery.min_reserve ?? 3.0),
    max_discharge_kw: Number(rawBattery.max_discharge_kw ?? rawBattery.max_discharge ?? 2.5),
  };

  // 4. Survival object ('hours_now', 'hours_before')
  const rawSurvival = raw.survival || {};
  const survival = {
    hours_now: Number(rawSurvival.hours_now ?? rawSurvival.now ?? 18.0),
    hours_before: Number(rawSurvival.hours_before ?? rawSurvival.before ?? 18.0),
  };

  // 5. Alert object ('life_support' vs 'life_support_ok')
  const rawAlert = raw.alert || {};
  const alert = {
    level: (rawAlert.level || 'green').toLowerCase(),
    life_support_ok: Boolean(rawAlert.life_support_ok ?? rawAlert.life_support ?? true),
    title: rawAlert.title || (rawAlert.level === 'red' ? 'CRITICAL' : rawAlert.level === 'yellow' ? 'WATCH' : 'NOMINAL'),
    message: rawAlert.message || 'Habitat power telemetry operating within nominal bounds.',
  };

  // 6. Risk object ('shortage' vs 'shortage_expected', 'max_deficit' vs 'max_deficit_kw')
  const rawRisk = raw.risk || {};
  const risk = {
    shortage_expected: Boolean(rawRisk.shortage_expected ?? rawRisk.shortage ?? false),
    start_hour: Number(rawRisk.start_hour ?? 0),
    end_hour: Number(rawRisk.end_hour ?? 0),
    max_deficit_kw: Number(rawRisk.max_deficit_kw ?? rawRisk.max_deficit ?? 0.0),
  };

  // 7. Forecast array ('solar' vs 'solar_kw', 'demand' vs 'demand_kw', 'usable_battery' vs 'usable_battery_kw')
  const forecast = Array.isArray(raw.forecast)
    ? raw.forecast.map((item, idx) => ({
        hour: Number(item.hour ?? idx),
        solar_kw: Number(item.solar_kw ?? item.solar ?? 10.0),
        demand_kw: Number(item.demand_kw ?? item.demand ?? 8.0),
        usable_battery_kw: Number(item.usable_battery_kw ?? item.usable_battery ?? 2.0),
      }))
    : [];

  // 8. Loads array ('need' vs 'need_kw', 'allocated' vs 'allocated_kw')
  const loads = Array.isArray(raw.loads)
    ? raw.loads.map((item, idx) => ({
        id: item.id || `load_${idx}`,
        name: item.name || 'Load',
        priority: Number(item.priority ?? idx + 1),
        tier: (item.tier || 'standard').toLowerCase(),
        need_kw: Number(item.need_kw ?? item.need ?? 0.0),
        allocated_kw: Number(item.allocated_kw ?? item.allocated ?? 0.0),
        status: item.status || 'Protected',
        reason: item.reason || 'Operational priority applied.',
      }))
    : [];

  // 9. Comparison policies ('unmet' vs 'unmet_kw', 'life_support' vs 'life_support_ok')
  const comparison = Array.isArray(raw.comparison)
    ? raw.comparison.map((item) => ({
        policy: item.policy,
        label: item.label,
        life_support_ok: Boolean(item.life_support_ok ?? item.life_support ?? true),
        unmet_kw: Number(item.unmet_kw ?? item.unmet ?? 0.0),
        allocations: item.allocations || {},
      }))
    : [];

  // 10. Plan status
  const plan = {
    status: (raw.plan?.status || 'pending').toLowerCase(),
  };

  // 11. Replan time ('replan_time_ms' vs 'replan_ms')
  const replan_ms = Number(raw.replan_ms ?? raw.replan_time_ms ?? raw.replan_time ?? 42);

  return {
    timestamp: raw.timestamp || new Date().toISOString(),
    mission,
    power,
    battery,
    survival,
    alert,
    risk,
    forecast,
    loads,
    comparison,
    plan,
    replan_ms,
  };
}

// In-memory mock scenario state
let currentMockScenario = 'nominal';
let mockState = JSON.parse(JSON.stringify(nominalState));

export const setMockScenario = (scenario) => {
  currentMockScenario = scenario;
  if (scenario === 'unsafe') {
    mockState = JSON.parse(JSON.stringify(unsafeState));
  } else if (scenario === 'after_drop') {
    mockState = JSON.parse(JSON.stringify(afterDropState));
  } else {
    currentMockScenario = 'nominal';
    mockState = JSON.parse(JSON.stringify(nominalState));
  }
  return normalizeState(mockState);
};

export const isMockMode = () => USE_MOCK;
export const getApiUrl = () => API_BASE_URL;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch with an 8-second timeout
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`FastAPI responded with HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeState(data);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after 8 seconds. Could not reach backend at ${API_BASE_URL}`);
    }
    throw err;
  }
}

/**
 * GET /state
 */
export async function getState(requestedScenario = null) {
  if (USE_MOCK) {
    await delay(100);
    if (requestedScenario && ['nominal', 'after_drop', 'unsafe'].includes(requestedScenario)) {
      setMockScenario(requestedScenario);
    }
    return normalizeState(mockState);
  }

  return fetchWithTimeout(`${API_BASE_URL}/state`);
}

/**
 * POST /simulate/solar-drop
 */
export async function simulateSolarDrop(drop = 0.7) {
  if (USE_MOCK) {
    await delay(500);
    mockState = JSON.parse(JSON.stringify(afterDropState));
    currentMockScenario = 'after_drop';
    mockState.replan_ms = Math.floor(38 + Math.random() * 15);
    return normalizeState(mockState);
  }

  return fetchWithTimeout(`${API_BASE_URL}/simulate/solar-drop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drop }),
  });
}

/**
 * POST /reset
 */
export async function reset() {
  if (USE_MOCK) {
    await delay(300);
    mockState = JSON.parse(JSON.stringify(nominalState));
    currentMockScenario = 'nominal';
    return normalizeState(mockState);
  }

  return fetchWithTimeout(`${API_BASE_URL}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /plan/decision
 */
export async function decidePlan(decision) {
  if (USE_MOCK) {
    await delay(250);
    mockState.plan.status = decision === 'approve' ? 'approved' : 'rejected';
    return normalizeState(mockState);
  }

  return fetchWithTimeout(`${API_BASE_URL}/plan/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
}
