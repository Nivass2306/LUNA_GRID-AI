"""
forecasting.py - LUNAGRID AI Baseline Power Forecasting & Accuracy Evaluation.

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

import json
import logging
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from simulator import (
    SIM_HOUR,
    SOLAR_PEAK_KW,
    NOMINAL_DUST_FACTOR,
    Simulator,
    sim as default_sim,
    solar_kw_at_hour,
)

logger = logging.getLogger("lunagrid.forecasting")

MODELS_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODELS_DIR / "solar_xgb.json"
METRICS_PATH = MODELS_DIR / "solar_xgb_metrics.json"

_cached_model: Any = None
_cached_metrics: Optional[Dict[str, Any]] = None
_model_checked: bool = False


def load_solar_model(force_reload: bool = False) -> Tuple[Any, Optional[Dict[str, Any]]]:
    """
    Safely load XGBoost model and metrics if they exist.
    Never raises an exception; logs warnings and gracefully returns (None, None).
    """
    global _cached_model, _cached_metrics, _model_checked

    # If already loaded and file still exists (and no force_reload requested)
    if _model_checked and not force_reload:
        if _cached_model is not None and not MODEL_PATH.exists():
            # Model file was removed dynamically
            logger.warning("XGBoost model file %s was removed; switching to baseline.", MODEL_PATH)
            _cached_model = None
            _cached_metrics = None
            return None, None
        if _cached_model is not None:
            return _cached_model, _cached_metrics
        if not MODEL_PATH.exists():
            return None, None

    _model_checked = True
    _cached_model = None
    _cached_metrics = None

    if not MODEL_PATH.exists():
        logger.warning("XGBoost model file not found at %s. Defaulting to baseline forecast.", MODEL_PATH)
        return None, None

    try:
        import xgboost as xgb
        model = xgb.XGBRegressor()
        model.load_model(str(MODEL_PATH))

        metrics: Dict[str, Any] = {}
        if METRICS_PATH.exists():
            try:
                with open(METRICS_PATH, "r", encoding="utf-8") as f:
                    metrics = json.load(f)
            except Exception as e:
                logger.warning("Could not read metrics file %s: %s", METRICS_PATH, e)

        _cached_model = model
        _cached_metrics = metrics
        mae_val = metrics.get("mae_kw", "N/A")
        logger.info("Successfully loaded XGBoost solar forecast model from %s (MAE: %s kW)", MODEL_PATH, mae_val)
        print(f"[INFO] Successfully loaded XGBoost solar forecast model from {MODEL_PATH} (MAE: {mae_val} kW)")
        return _cached_model, _cached_metrics
    except Exception as exc:
        logger.warning("Failed to load XGBoost model from %s: %s. Falling back to baseline forecast.", MODEL_PATH, exc)
        print(f"[WARNING] Failed to load XGBoost model: {exc}. Falling back to baseline forecast.")
        return None, None


def get_model_status() -> Dict[str, Any]:
    """Return model status for API response (name: 'xgboost' | 'baseline', mae_kw, baseline_mae_kw)."""
    model, metrics = load_solar_model()
    # Also verify file still exists in case it was renamed/deleted at runtime
    if model is not None and MODEL_PATH.exists():
        return {
            "name": "xgboost",
            "mae_kw": metrics.get("mae_kw") if metrics else None,
            "baseline_mae_kw": metrics.get("baseline_mae_kw") if metrics else None,
        }
    return {
        "name": "baseline",
        "mae_kw": None,
        "baseline_mae_kw": None,
    }


def get_model_info() -> Dict[str, Any]:
    """Return metrics file contents or baseline fallback description."""
    if METRICS_PATH.exists() and MODEL_PATH.exists():
        try:
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            data["model_available"] = True
            return data
        except Exception:
            pass
    return {
        "model_name": "baseline",
        "model_available": False,
        "mae_kw": None,
        "baseline_mae_kw": None,
        "note": "XGBoost model file not found; falling back to baseline forecast.",
    }


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
            "baseline_solar_kw": f_solar,
            "demand_kw": f_demand,
            "usable_battery_kw": f_batt,
            # Legacy alias keys for frontend compatibility
            "solar": f_solar,
            "baseline_solar": f_solar,
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
        "model": "baseline",
    }


def generate_power_forecast(
    sim: Optional[Simulator] = None,
    n_hours: int = 24,
) -> Dict[str, Any]:
    """
    Generate power forecast for the next N hours (default 24).
    Uses the trained offline XGBoost model if available.
    If model is missing, corrupt, or prediction throws any exception,
    gracefully falls back to generate_baseline_forecast() and logs a warning.
    The application will NEVER crash.
    """
    active_sim = sim if sim is not None else default_sim
    baseline_res = generate_baseline_forecast(active_sim, n_hours=n_hours)

    model, metrics = load_solar_model()
    if model is None or not MODEL_PATH.exists():
        return baseline_res

    try:
        import pandas as pd
        history = build_synthetic_history(active_sim, total_hours=48)
        prior_solars = [h["solar_kw"] for h in history]

        hour_sin = float(np.sin(2 * np.pi * SIM_HOUR / 24.0))
        hour_cos = float(np.cos(2 * np.pi * SIM_HOUR / 24.0))
        doy = 172
        doy_sin = float(np.sin(2 * np.pi * doy / 365.25))
        doy_cos = float(np.cos(2 * np.pi * doy / 365.25))
        clear_sky_kw = float(solar_kw_at_hour(SIM_HOUR, SOLAR_PEAK_KW, 0.0))
        lag_1h = float(prior_solars[-1])
        lag_24h = float(prior_solars[-24])
        rolling_mean_6h = float(np.mean(prior_solars[-6:]))
        rolling_mean_24h = float(np.mean(prior_solars[-24:]))

        row = {
            "hour_sin": hour_sin,
            "hour_cos": hour_cos,
            "doy_sin": doy_sin,
            "doy_cos": doy_cos,
            "clear_sky_kw": clear_sky_kw,
            "lag_1h": lag_1h,
            "lag_24h": lag_24h,
            "rolling_mean_6h": rolling_mean_6h,
            "rolling_mean_24h": rolling_mean_24h,
            "temperature_c": 25.0,
            "relative_humidity_pct": 20.0,
            "wind_speed_ms": 2.0,
        }

        X = pd.DataFrame([row])
        raw_preds = model.predict(X)[0]  # shape (24,)

        # Attenuation scaling matching current active simulator condition (solar drop / dust)
        nom_solar = solar_kw_at_hour(SIM_HOUR, SOLAR_PEAK_KW, NOMINAL_DUST_FACTOR)
        curr_solar = active_sim.current_solar_kw()
        attenuation = max(0.0, curr_solar / max(0.1, nom_solar))
        scaled_preds = np.clip(raw_preds * attenuation, 0.0, SOLAR_PEAK_KW)

        horizon = baseline_res["horizon"]
        remaining_kwh = max(0.0, active_sim.battery.soc_kwh - active_sim.battery.min_reserve_kwh)
        max_discharge = active_sim.battery.max_discharge_kw

        solar_kw_list: List[float] = []
        demand_kw_list: List[float] = []
        usable_batt_list: List[float] = []
        forecast_entries: List[Dict[str, Any]] = []

        for offset in range(horizon):
            clock_h = (SIM_HOUR + offset) % 24
            base_solar = baseline_res["forecast"][offset]["solar_kw"]
            f_demand = baseline_res["forecast"][offset]["demand_kw"]

            if offset == 0:
                f_solar = round(curr_solar, 3)
            else:
                pred_idx = min(offset - 1, len(scaled_preds) - 1)
                f_solar = round(float(scaled_preds[pred_idx]), 3)

            f_batt = round(min(max_discharge, remaining_kwh), 3)
            draw_needed = max(0.0, f_demand - f_solar)
            actual_draw = min(draw_needed, f_batt)
            remaining_kwh = max(0.0, remaining_kwh - actual_draw)

            entry = {
                "hour": offset,
                "clock_hour": clock_h,
                "solar_kw": f_solar,
                "baseline_solar_kw": base_solar,
                "demand_kw": f_demand,
                "usable_battery_kw": f_batt,
                "solar": f_solar,
                "baseline_solar": base_solar,
                "demand": f_demand,
                "usable_battery": f_batt,
            }
            forecast_entries.append(entry)
            solar_kw_list.append(f_solar)
            demand_kw_list.append(f_demand)
            usable_batt_list.append(f_batt)

        shortage_hours: List[int] = []
        max_deficit: float = 0.0
        for item in forecast_entries:
            supply = item["solar_kw"] + item["usable_battery_kw"]
            deficit = item["demand_kw"] - supply
            if deficit > 1e-4:
                shortage_hours.append(item["hour"])
                if deficit > max_deficit:
                    max_deficit = deficit

        shortage_window = (
            {
                "start_hour": shortage_hours[0],
                "end_hour": shortage_hours[-1],
                "peak_deficit_kw": round(max_deficit, 3),
            }
            if shortage_hours
            else None
        )

        return {
            "horizon": horizon,
            "hours": horizon,
            "solar_kw": solar_kw_list,
            "demand_kw": demand_kw_list,
            "usable_battery_kw": usable_batt_list,
            "forecast": forecast_entries,
            "shortage_window": shortage_window,
            "model": "xgboost",
        }
    except Exception as exc:
        logger.warning("XGBoost prediction failed: %s; falling back to baseline forecast.", exc)
        return baseline_res


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
