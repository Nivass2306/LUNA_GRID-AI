"""
forecast.py - LUNAGRID AI 24-hour power forecast.

Baseline-only implementation: for each of the next 24 simulated hours,
projects solar output from the current dust_factor, holds demand constant,
and models battery usability degrading conservatively under a deficit.

Uses the simulator's SIM_HOUR (fixed simulated clock) — not the wall clock —
so output is deterministic.
"""

from __future__ import annotations

from simulator import Simulator, solar_kw_at_hour, SOLAR_PEAK_KW, SIM_HOUR


def generate_forecast(sim: Simulator) -> list:
    """
    24-entry forecast starting from SIM_HOUR.
    Uses generate_power_forecast (XGBoost with automatic baseline fallback).
    """
    from forecasting import generate_power_forecast
    result = generate_power_forecast(sim, n_hours=24)
    return result["forecast"]



# Re-export extended forecasting suite from forecasting.py
from forecasting import (
    build_synthetic_history,
    generate_baseline_forecast,
    generate_power_forecast,
    evaluate_forecast,
    load_solar_model,
    get_model_status,
    get_model_info,
)

