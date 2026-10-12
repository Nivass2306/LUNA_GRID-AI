"""
forecasting.py - SPACEGRID AI Baseline Power Forecasting & Accuracy Evaluation.

Features:
1. Deterministic synthetic history (48 simulated hours) from the simulator's solar curve.
2. Baseline forecast: "same hour yesterday" for solar_kw and demand_kw for the next N hours
   (default 6, max 24). Forecast hour 0 equals current solar_kw from state.
3. Hour-by-hour battery depletion: usable_battery_kw = min(max_discharge, remaining_kwh),
   then subtract draw max(0, demand - solar) capped at that value.
4. Shortage window: hours where demand > forecast solar + usable battery
   (start_hour, end_hour, peak_deficit_kw).
5. evaluate_forecast(): MAE, RMSE, MAPE (filtered for actual > 0.1 kW), reporting
   synthetic: true and explanatory note.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np

from simulator import (
    SIM_HOUR,
    SOLAR_PEAK_KW,
    NOMINAL_DUST_FACTOR,
    Simulator,
    sim as default_sim,
    solar_kw_at_hour,
)


# ---------------------------------------------------------------------------
# 1. Deterministic Synthetic History (>= 48 simulated hours)
# ---------------------------------------------------------------------------

def build_synthetic_history(
    sim: Optional[Simulator] = None,
    total_hours: int = 48,
) -> List[Dict[str, Any]]:
    """
    Build a deterministic synthetic history of at least 48 simulated hours.
    Fixed simulated clock, no random values, no datetime.now().

    Structure:
      - Hours 0..23 (Day 1, 48h to 24h prior to now): baseline nominal solar curve
      - Hours 24..47 (Day 2, 24h to 0h prior to now): reflects simulator's state
        (or deterministic 2% dust drift for held-out evaluation during nominal operations)
    Current simulated time 'now' is at index 48 (SIM_HOUR=12, solar noon).
    """
    active_sim = sim if sim is not None else default_sim
    history: List[Dict[str, Any]] = []

    nominal_demand = 8.0
    nominal_usable_batt = active_sim.battery.usable_kw()

    for t in range(total_hours):
        clock_h = (t + SIM_HOUR) % 24

        if t < 24:
            # Day 1: baseline nominal lunar solar conditions
            dust = NOMINAL_DUST_FACTOR
            solar = solar_kw_at_hour(clock_h, SOLAR_PEAK_KW, dust)
            demand = nominal_demand
        else:
            # Day 2: reflects current simulation condition or nominal held-out evaluation curve
            if active_sim.solar_drop_factor > 0 or active_sim.dust_factor > NOMINAL_DUST_FACTOR:
                dust = active_sim.dust_factor
            else:
                # Deterministic slight dust drift (0.14 vs 0.12) for baseline accuracy verification
                dust = round(NOMINAL_DUST_FACTOR + 0.02, 4)
            solar = solar_kw_at_hour(clock_h, SOLAR_PEAK_KW, dust)
            demand = active_sim.current_demand_kw()

        history.append({
            "hour": t,
            "clock_hour": clock_h,
            "solar_kw": round(solar, 3),
            "demand_kw": round(demand, 3),
            "usable_battery_kw": round(nominal_usable_batt, 3),
        })

    return history


# ---------------------------------------------------------------------------
# 2. Baseline Forecast with Battery Depletion Tracking
# ---------------------------------------------------------------------------

def generate_baseline_forecast(
    sim: Optional[Simulator] = None,
    n_hours: int = 6,
) -> Dict[str, Any]:
    """
    Generate baseline forecast for the next N hours (default 6, max 24):
    - Predicts 'same hour yesterday' for solar_kw and demand_kw.
    - Forecast hour 0 equals current solar_kw from state.
    - Tracks remaining usable battery energy hour by hour:
        usable_battery_kw = min(max_discharge, remaining_kwh)
        subtract draw max(0, demand - solar) capped at that value.
    - Computes shortage window where demand > forecast solar + usable battery
      (start_hour, end_hour, peak_deficit_kw). Returns null if no shortage.
    """
    active_sim = sim if sim is not None else default_sim

    # Clamp horizon (default 6, 1 <= n <= 24)
    horizon = max(1, min(24, int(n_hours) if n_hours is not None else 6))

    history = build_synthetic_history(active_sim, total_hours=48)

    remaining_kwh = max(0.0, active_sim.battery.soc_kwh - active_sim.battery.min_reserve_kwh)
    max_discharge = active_sim.battery.max_discharge_kw

    solar_kw_list: List[float] = []
    demand_kw_list: List[float] = []
    usable_batt_list: List[float] = []
    forecast_entries: List[Dict[str, Any]] = []

    for offset in range(horizon):
        clock_h = (SIM_HOUR + offset) % 24

        # Forecast solar: hour 0 equals current solar_kw from state, otherwise yesterday's hour
        if offset == 0:
            f_solar = round(active_sim.current_solar_kw(), 3)
        else:
            hist_idx = 24 + offset
            f_solar = history[hist_idx]["solar_kw"]

        f_demand = history[24 + offset]["demand_kw"]

        # Each hour's usable_battery_kw = min(max_discharge, remaining_kwh)
        f_batt = round(min(max_discharge, remaining_kwh), 3)

        # Subtract draw max(0, demand - solar) capped at usable_battery_kw
        draw_needed = max(0.0, f_demand - f_solar)
        actual_draw = min(draw_needed, f_batt)
        remaining_kwh = max(0.0, remaining_kwh - actual_draw)

        entry = {
            "hour": offset,
            "clock_hour": clock_h,
            "solar_kw": f_solar,
            "demand_kw": f_demand,
            "usable_battery_kw": f_batt,
            # Legacy alias keys for frontend compatibility
            "solar": f_solar,
            "demand": f_demand,
            "usable_battery": f_batt,
        }
        forecast_entries.append(entry)
        solar_kw_list.append(f_solar)
        demand_kw_list.append(f_demand)
        usable_batt_list.append(f_batt)

    # Shortage window: use exactly demand > forecast_solar + usable_battery for every hour
    shortage_hours: List[int] = []
    max_deficit: float = 0.0

    for item in forecast_entries:
        supply = item["solar_kw"] + item["usable_battery_kw"]
        deficit = item["demand_kw"] - supply
        if deficit > 1e-4:
            shortage_hours.append(item["hour"])
            if deficit > max_deficit:
                max_deficit = deficit

    if shortage_hours:
        shortage_window: Optional[Dict[str, Any]] = {
            "start_hour": shortage_hours[0],
            "end_hour": shortage_hours[-1],
            "peak_deficit_kw": round(max_deficit, 3),
        }
    else:
        shortage_window = None

    return {
        "horizon": horizon,
        "hours": horizon,
        "solar_kw": solar_kw_list,
        "demand_kw": demand_kw_list,
        "usable_battery_kw": usable_batt_list,
        "forecast": forecast_entries,
        "shortage_window": shortage_window,
    }


# ---------------------------------------------------------------------------
# 3. Forecast Evaluation: MAE, RMSE, and MAPE
# ---------------------------------------------------------------------------

def evaluate_forecast(
    actual: Optional[List[float]] = None,
    predicted: Optional[List[float]] = None,
    history: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Evaluate forecast accuracy using MAE, RMSE, and MAPE.
    - Evaluates on held-out hours only.
    - Computes MAPE only where actual > 0.1 kW and reports excluded points count.
    - Adds synthetic: true and note indicating baseline on synthetic data.
    """
    if actual is None or predicted is None:
        hist = history if history is not None else build_synthetic_history(total_hours=48)
        # Held-out hours: Day 2 (indices 24..47)
        # Predicted via "same hour yesterday": Day 1 (indices 0..23)
        actual = [hist[t]["solar_kw"] for t in range(24, 48)]
        predicted = [hist[t - 24]["solar_kw"] for t in range(24, 48)]

    if len(actual) != len(predicted):
        raise ValueError(f"actual and predicted length mismatch: {len(actual)} vs {len(predicted)}")

    if not actual:
        return {
            "mae": 0.0,
            "rmse": 0.0,
            "mape": 0.0,
            "excluded_points": 0,
            "points_excluded": 0,
            "total_points": 0,
            "evaluated_points": 0,
            "synthetic": True,
            "note": "Baseline evaluation on deterministic synthetic data, not real validation.",
        }

    act_arr = np.array(actual, dtype=float)
    pred_arr = np.array(predicted, dtype=float)

    abs_errors = np.abs(act_arr - pred_arr)
    sq_errors = np.square(act_arr - pred_arr)

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(sq_errors)))

    # MAPE calculation: filter where actual > 0.1 kW
    valid_mask = act_arr > 0.1
    excluded_count = int(np.sum(~valid_mask))

    if np.any(valid_mask):
        pct_errors = abs_errors[valid_mask] / act_arr[valid_mask]
        mape = float(np.mean(pct_errors) * 100.0)
    else:
        mape = 0.0

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": round(mape, 4),
        "excluded_points": excluded_count,
        "points_excluded": excluded_count,
        "total_points": len(actual),
        "evaluated_points": int(np.sum(valid_mask)),
        "synthetic": True,
        "note": "Baseline evaluation on deterministic synthetic data, not real validation.",
    }
