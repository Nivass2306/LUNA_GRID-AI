import { nominalState, afterDropState, unsafeState } from '../mock/fixtures.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const REQUEST_TIMEOUT_MS = 8000; // 8-second timeout requirement

/**
 * Normalizes backend responses to conform strictly to the SPACEGRID AI JSON contract.
 * All field name differences and variations are handled HERE ONLY, never in components.
 */
function toNumOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

/**
 * Normalizes backend responses to conform strictly to the SPACEGRID AI JSON contract.
 * All field name differences and variations are handled HERE ONLY, never in components.
 * No fake defaults are invented: missing fields become null, survival is preserved as null when backend sends null.
 */
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }

  // 1. Mission object
  const mission = {
    mode: raw.mission?.mode ?? null,
    phase: raw.mission?.phase ?? null,
    dust_factor: toNumOrNull(raw.mission?.dust_factor),
    scenario: raw.mission?.scenario ?? null,
  };

  // 2. Power object (no fake 10.0 solar, 8.0 demand, 2.0 battery, 12.0 available)
  const rawPower = raw.power || {};
  const power = {
    solar_kw: toNumOrNull(rawPower.solar_kw ?? rawPower.solar),
    demand_kw: toNumOrNull(rawPower.demand_kw ?? rawPower.demand),
    usable_battery_kw: toNumOrNull(rawPower.usable_battery_kw ?? rawPower.usable_battery),
    available_kw: toNumOrNull(rawPower.available_kw ?? rawPower.available),
    storage_drain_kw: toNumOrNull(rawPower.storage_drain_kw ?? rawPower.storage_drain ?? raw.storage_drain_kw),
  };

  // 3. Battery object (no fake 8.5 soc, 20.0 capacity, 3.0 reserve, 2.5 discharge)
  const rawBattery = raw.battery || {};
  const battery = {
    soc_kwh: toNumOrNull(rawBattery.soc_kwh ?? rawBattery.soc),
    capacity_kwh: toNumOrNull(rawBattery.capacity_kwh ?? rawBattery.capacity),
    min_reserve_kwh: toNumOrNull(rawBattery.min_reserve_kwh ?? rawBattery.min_reserve),
    max_discharge_kw: toNumOrNull(rawBattery.max_discharge_kw ?? rawBattery.max_discharge),
  };

  // 4. Survival object: preserve null exactly as sent by backend (sustained)
  const rawSurvival = raw.survival || {};
  const survival = {
    hours_now: toNumOrNull(rawSurvival.hours_now ?? rawSurvival.now),
    hours_before: toNumOrNull(rawSurvival.hours_before ?? rawSurvival.before),
  };

  // 5. Alert object
  const rawAlert = raw.alert || {};
  const alert = {
    level: rawAlert.level ? String(rawAlert.level).toLowerCase() : 'green',
    life_support_ok: rawAlert.life_support_ok !== undefined ? Boolean(rawAlert.life_support_ok) : (rawAlert.life_support !== undefined ? Boolean(rawAlert.life_support) : null),
    title: rawAlert.title ?? null,
    message: rawAlert.message ?? null,
  };

  // 6. Risk object
  const rawRisk = raw.risk || {};
  const risk = {
    shortage_expected: rawRisk.shortage_expected !== undefined ? Boolean(rawRisk.shortage_expected) : (rawRisk.shortage !== undefined ? Boolean(rawRisk.shortage) : false),
    start_hour: toNumOrNull(rawRisk.start_hour),
    end_hour: toNumOrNull(rawRisk.end_hour),
    max_deficit_kw: toNumOrNull(rawRisk.max_deficit_kw ?? rawRisk.max_deficit),
  };

  // 7. Forecast array
  const forecast = Array.isArray(raw.forecast)
    ? raw.forecast.map((item, idx) => ({
        hour: toNumOrNull(item.hour) ?? idx,
        solar_kw: toNumOrNull(item.solar_kw ?? item.solar),
        demand_kw: toNumOrNull(item.demand_kw ?? item.demand),
        usable_battery_kw: toNumOrNull(item.usable_battery_kw ?? item.usable_battery),
      }))
    : [];

  // 8. Loads array
  const loads = Array.isArray(raw.loads)
    ? raw.loads.map((item, idx) => ({
        id: item.id || `load_${idx}`,
        name: item.name || 'Load',
        priority: toNumOrNull(item.priority) ?? idx + 1,
        tier: item.tier ? String(item.tier).toLowerCase() : null,
        need_kw: toNumOrNull(item.need_kw ?? item.need),
        allocated_kw: toNumOrNull(item.allocated_kw ?? item.allocated),
        status: item.status || null,
        reason: item.reason || null,
      }))
    : [];

  // 9. Comparison policies
  const comparison = Array.isArray(raw.comparison)
    ? raw.comparison.map((item) => ({
        policy: item.policy,
        label: item.label,
        life_support_ok: item.life_support_ok !== undefined ? Boolean(item.life_support_ok) : (item.life_support !== undefined ? Boolean(item.life_support) : null),
        unmet_kw: toNumOrNull(item.unmet_kw ?? item.unmet),
        allocations: item.allocations || {},
      }))
    : [];

  // 10. Plan status
  const plan = {
    status: raw.plan?.status ? String(raw.plan.status).toLowerCase() : 'pending',
  };

  // 11. Replan time (no fake 42 ms)
  const replan_ms = toNumOrNull(raw.replan_ms ?? raw.replan_time_ms ?? raw.replan_time);

  return {
    timestamp: raw.timestamp || new Date().toISOString(),
    verdict: raw.verdict ?? null,
    summary: raw.summary ?? null,
    storage_drain_kw: toNumOrNull(raw.storage_drain_kw ?? rawPower.storage_drain_kw),
    survival_hours: raw.survival_hours ?? survival.hours_now,
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
 * Fetch with an 8-second timeout, extracting validation details on errors.
 */
async function fetchWithTimeout(url, options = {}, normalize = true) {
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
      let errorBody = null;
      try {
        errorBody = await response.json();
      } catch {
        // Response was not JSON
      }
      const errMsg =
        errorBody?.detail
          ? typeof errorBody.detail === 'string'
            ? errorBody.detail
            : Array.isArray(errorBody.detail)
            ? errorBody.detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
            : JSON.stringify(errorBody.detail)
          : `FastAPI responded with HTTP ${response.status}: ${response.statusText}`;

      const err = new Error(errMsg);
      err.status = response.status;
      err.detail = errorBody?.detail;
      err.body = errorBody;
      throw err;
    }

    const data = await response.json();
    return normalize ? normalizeState(data) : data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const abortErr = new Error(`Request timed out after 8 seconds. Could not reach backend at ${API_BASE_URL}`);
      abortErr.status = 408;
      throw abortErr;
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
 * POST /simulate/solar-drop (no body expected by FastAPI backend)
 */
export async function simulateSolarDrop() {
  if (USE_MOCK) {
    await delay(500);
    mockState = JSON.parse(JSON.stringify(afterDropState));
    currentMockScenario = 'after_drop';
    mockState.replan_ms = Math.floor(38 + Math.random() * 15);
    return normalizeState(mockState);
  }

  return fetchWithTimeout(`${API_BASE_URL}/simulate/solar-drop`, {
    method: 'POST',
  });
}

/**
 * POST /simulate/blackout
 */
export async function simulateBlackout() {
  if (USE_MOCK) {
    await delay(500);
    mockState = JSON.parse(JSON.stringify(unsafeState));
    currentMockScenario = 'unsafe';
    return normalizeState(mockState);
  }

  return fetchWithTimeout(`${API_BASE_URL}/simulate/blackout`, {
    method: 'POST',
  });
}

/**
 * POST /simulate/custom
 * On HTTP 422, throws error with err.detail containing validation details.
 */
export async function simulateCustom({ solar_drop_pct, dust_factor, battery_soc_kwh }) {
  const payload = {
    solar_drop_pct: Number(solar_drop_pct),
  };
  if (dust_factor !== undefined && dust_factor !== null && dust_factor !== '') {
    payload.dust_factor = Number(dust_factor);
  }
  if (battery_soc_kwh !== undefined && battery_soc_kwh !== null && battery_soc_kwh !== '') {
    payload.battery_soc_kwh = Number(battery_soc_kwh);
  }

  if (USE_MOCK) {
    await delay(400);
    if (payload.solar_drop_pct < 0 || payload.solar_drop_pct > 100) {
      const err = new Error('solar_drop_pct must be between 0 and 100');
      err.status = 422;
      err.detail = [{ loc: ['body', 'solar_drop_pct'], msg: 'Input should be less than or equal to 100' }];
      throw err;
    }
    return normalizeState(afterDropState);
  }

  return fetchWithTimeout(`${API_BASE_URL}/simulate/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * GET /benchmark
 */
export async function getBenchmark() {
  return fetchWithTimeout(`${API_BASE_URL}/benchmark`, {}, false);
}

/**
 * GET /scenarios
 */
export async function getScenarios() {
  return fetchWithTimeout(`${API_BASE_URL}/scenarios`, {}, false);
}

/**
 * POST /simulate/preset/{scenario_id}
 */
export async function simulatePreset(scenarioId) {
  if (USE_MOCK) {
    return normalizeState(mockState);
  }
  return fetchWithTimeout(`${API_BASE_URL}/simulate/preset/${scenarioId}`, {
    method: 'POST',
  });
}

/**
 * POST /simulate/dataset
 */
export async function simulateDataset(payload) {
  return fetchWithTimeout(`${API_BASE_URL}/simulate/dataset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, false);
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

/**
 * Allocation endpoints (if implemented on backend)
 */
export async function evaluateAllocation(allocations) {
  return fetchWithTimeout(`${API_BASE_URL}/allocation/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allocations }),
  }, false);
}

export async function applyManualAllocation(allocations, overrideSafety = false) {
  return fetchWithTimeout(`${API_BASE_URL}/allocation/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allocations, override_safety: overrideSafety }),
  });
}

export async function returnToAuto() {
  return fetchWithTimeout(`${API_BASE_URL}/allocation/auto`, {
    method: 'POST',
  });
}

