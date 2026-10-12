"""
risk.py - LUNAGRID AI operational power risk assessment.

Computes the power shortage window and deficit from forecasting.generate_baseline_forecast,
ensuring risk assessment and /forecast are fully aligned.
"""

from __future__ import annotations

from simulator import Simulator
from forecasting import generate_baseline_forecast

RISK_HORIZON_H = 6


def assess_risk(sim: Simulator) -> dict:
    """
    Report power shortage risk based on forecast shortage window.
    Agrees with /forecast shortage window.
    """
    f = generate_baseline_forecast(sim, n_hours=RISK_HORIZON_H)
    sw = f["shortage_window"]

    if sw is None:
        return {
            "shortage":          False,
            "shortage_expected": False,
            "start_hour":        0,
            "end_hour":          0,
            "max_deficit":       0.0,
            "max_deficit_kw":    0.0,
        }

    return {
        "shortage":          True,
        "shortage_expected": True,
        "start_hour":        sw["start_hour"],
        "end_hour":          sw["end_hour"],
        "max_deficit":       sw["peak_deficit_kw"],
        "max_deficit_kw":    sw["peak_deficit_kw"],
    }

