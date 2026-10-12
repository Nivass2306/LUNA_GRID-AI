"""
engine.py - LUNAGRID AI state engine.

Public API:
    get_state()          -> dict   current full state (JSON-ready)
    solar_drop(factor)   -> dict   apply obscuration event, return new state
    reset()              -> dict   restore nominal state, return new state

All three functions return the exact JSON shape expected by the frontend
(api.js normalizeState). The re-plan time is measured in real milliseconds
with time.perf_counter().

This module owns the plan-approval status that server.py manages.
To allow server.py to control plan status, use set_plan_status() /
get_plan_status().
"""

from __future__ import annotations
import csv
import logging
import math
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from simulator import sim, Simulator, NOMINAL_DUST_FACTOR, Load, DEFAULT_LOADS
from optimizer import optimize
from risk import assess_risk
from forecast import generate_forecast, get_model_status

logger = logging.getLogger("lunagrid.engine")

# ---------------------------------------------------------------------------
# Alert thresholds (kW of available power) - unified constant used everywhere
# ---------------------------------------------------------------------------
ALERT_THRESHOLDS: Dict[str, float] = {
    "safe": 8.0,       # >= 8.0 kW: Safe (all loads fully powered)
    "watch": 6.2,      # >= 6.2 kW: Watch (Life Support 3.0 + Habitat 2.0 + Comms 1.2 met)
    "critical": 3.0,   # >= 3.0 kW: Critical (Life Support 3.0 met, lower loads cut)
}


def get_alert_level(available_kw: float) -> str:
    """Return alert level ('safe', 'watch', 'critical', 'unsafe') based on unified thresholds."""
    if available_kw >= ALERT_THRESHOLDS["safe"] - 1e-4:
        return "safe"
    elif available_kw >= ALERT_THRESHOLDS["watch"] - 1e-4:
        return "watch"
    elif available_kw >= ALERT_THRESHOLDS["critical"] - 1e-4:
        return "critical"
    else:
        return "unsafe"


# ---------------------------------------------------------------------------
# Operator plan approval (shared mutable state)
# ---------------------------------------------------------------------------

_plan_status: str = "approved"


def get_plan_status() -> str:
    return _plan_status


def set_plan_status(status: str) -> None:
    global _plan_status
    _plan_status = status


# ---------------------------------------------------------------------------
# Core state builder (private)
# ---------------------------------------------------------------------------

def _build_state() -> dict:
    """
    Compute the full /state response from the current simulator snapshot.
    Runs optimizer + risk + forecast and measures the combined time.
    """
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # ---- Live power snapshot ----
    solar_kw     = sim.current_solar_kw()
    usable_batt  = sim.current_usable_battery_kw()
    demand_kw    = sim.current_demand_kw()
    available_kw = round(solar_kw + usable_batt, 3)

    # ---- Re-plan (timed) ----
    t0        = time.perf_counter()
    opt       = optimize(sim.loads, solar_kw, usable_batt)
    risk      = assess_risk(sim)
    fcast     = generate_forecast(sim)
    replan_ms = round((time.perf_counter() - t0) * 1000, 2)

    # ---- Alert & Verdict using unified thresholds ----
    alert_tier = get_alert_level(available_kw)

    if alert_tier == "safe":
        verdict = "SAFE"
        summary = "All loads are fully powered with available power meeting habitat demand."
        level = "green"
        title = "NOMINAL"
        msg = "Solar array nominal. All habitat sub-systems fully powered."
        ls_ok = True
    elif alert_tier == "watch":
        verdict = "SHORTAGE"
        summary = "Available power covers life support, habitat, and comms. Science and rover curtailed."
        level = "red"
        title = "WATCH"
        msg = f"Watch advisory: Non-critical loads curtailed. Life support protected ({opt['loads'][0]['allocated_kw']:.1f} kW)."
        ls_ok = True
    elif alert_tier == "critical":
        verdict = "SHORTAGE"
        summary = "Available power covers life support, but lower-priority loads are curtailed."
        level = "red"
        title = "CRITICAL"
        msg = (
            f"Power deficit detected. Life support protected ({opt['loads'][0]['allocated_kw']:.1f} kW), "
            "lower loads reduced."
        )
        ls_ok = True
    else:
        verdict = "UNSAFE"
        summary = "Critical shortage: available power cannot sustain life support requirements."
        level = "red"
        title = "UNSAFE"
        msg = (
            f"Total available power ({available_kw:.1f} kW) is below Life Support "
            f"minimum requirement ({ALERT_THRESHOLDS['critical']:.1f} kW). Immediate human command escalation required."
        )
        ls_ok = False

    # ---- Battery & Survival hours ----
    storage_drain_kw = round(min(max(demand_kw - solar_kw, 0.0), usable_batt), 3)
    usable_battery_kwh = max(0.0, sim.battery.soc_kwh - sim.battery.min_reserve_kwh)
    nominal_usable_kwh = max(0.0, 16.5 - sim.battery.min_reserve_kwh)

    if verdict == "UNSAFE" or not ls_ok:
        hours_now = 0.0
        hours_before = 0.0
    elif storage_drain_kw <= 0.01:
        hours_now = None
        hours_before = None
    else:
        hours_now = round(usable_battery_kwh / storage_drain_kw, 1)
        hours_before = round(nominal_usable_kwh / storage_drain_kw, 1)

    # Synchronize with approval module's active_plan if present
    import approval
    active_plan = approval.get_active_plan()
    loads_to_return = opt["loads"]
    if active_plan and "loads" in active_plan:
        loads_to_return = active_plan["loads"]

    pending_prop = approval.get_pending_plan()
    effective_plan_status = "pending" if pending_prop is not None else _plan_status
    ls_alert = approval.get_life_support_alert()

    return {
        "timestamp": now_iso,
        "verdict": verdict,
        "summary": summary,
        "storage_drain_kw": storage_drain_kw,
        "survival_hours": hours_now,
        "mission": {
            "mode":        "moon",
            "phase":       sim.phase,
            "dust_factor": round(sim.dust_factor, 4),
            "scenario":    sim.scenario,
        },
        "power": {
            "solar":              solar_kw,
            "demand":             round(demand_kw, 3),
            "usable_battery":     round(usable_batt, 3),
            "available":          available_kw,
            "solar_kw":           solar_kw,
            "demand_kw":          round(demand_kw, 3),
            "usable_battery_kw":  round(usable_batt, 3),
            "available_kw":       available_kw,
            "storage_drain_kw":   storage_drain_kw,
            "storage_drain":      storage_drain_kw,
        },
        "battery": sim.battery.to_dict(),
        "survival": {
            "hours_now":      hours_now,
            "hours_before":   hours_before,
            "survival_hours": hours_now,
            "now":            hours_now,
            "before":         hours_before,
        },
        "alert": {
            "level":           level,
            "tier":            alert_tier,
            "alert_level":     alert_tier,
            "life_support":    ls_ok,
            "life_support_ok": ls_ok,
            "title":           title,
            "message":         msg,
        },
        "life_support_alert": ls_alert,
        "risk":         risk,
        "forecast":     fcast,
        "forecast_model": {
            "name": get_model_status().get("name", "baseline"),
            "mae_kw": get_model_status().get("mae_kw"),
            "baseline_mae_kw": get_model_status().get("baseline_mae_kw"),
        },
        "loads":        loads_to_return,
        "comparison":   opt["comparison"],
        "plan":         {"status": effective_plan_status},
        "replan_time_ms": replan_ms,
        "replan_ms":      replan_ms,
    }



# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_state() -> dict:
    """Return the current full state dict (no side effects)."""
    return _build_state()


def solar_drop(factor: float = 0.7) -> dict:
    """
    Apply a solar obscuration event (factor=0.7 => -70% solar).
    Re-runs forecast, risk, and optimizer automatically.
    Returns the updated state dict.
    """
    sim.solar_drop(factor)
    set_plan_status("pending")
    import approval
    approval.create_proposal(solar_drop_pct=(factor * 100.0), source="Solar Obscuration Event (70%)")
    return _build_state()


def reset() -> dict:
    """
    Restore the simulator to nominal state.
    Returns the reset state dict.
    """
    sim.reset()
    set_plan_status("approved")
    import approval
    approval.reset_approval_state()
    return _build_state()


def blackout() -> dict:
    """
    Trigger severe dust storm event (solar near 0) with battery at minimum reserve,
    so available power cannot meet Life Support requirements.
    Returns the updated state dict with life_support_ok = False and red alert.
    """
    sim.blackout()
    set_plan_status("pending")
    import approval
    approval.create_proposal(solar_drop_pct=100.0, dust_factor=1.0, battery_soc_kwh=3.0, source="Severe Lunar Dust Storm (Blackout)")
    return _build_state()


def plan_decision(decision: str = "approve") -> dict:
    """
    Apply operator decision ("approve" -> "approved", "reject" -> "rejected")
    and return the updated state dict.
    """
    decision_clean = str(decision).strip().lower()
    if decision_clean not in ("approve", "reject"):
        raise ValueError(f"Invalid decision '{decision}'. Expected 'approve' or 'reject'.")
    status = "approved" if decision_clean == "approve" else "rejected"
    set_plan_status(status)
    return _build_state()



def custom_scenario(
    solar_drop_pct: float = 0.0,
    dust_factor: Optional[float] = None,
    battery_soc_kwh: Optional[float] = None,
    source: str = "Manual Simulation",
) -> dict:
    """
    Evaluate a custom disruption scenario by creating an approval proposal.
    Does NOT mutate active_plan.
    """
    if not isinstance(solar_drop_pct, (int, float)) or not (0.0 <= float(solar_drop_pct) <= 100.0):
        raise ValueError(f"solar_drop_pct must be between 0 and 100, got {solar_drop_pct}")

    if dust_factor is not None:
        if not isinstance(dust_factor, (int, float)) or not (0.0 <= float(dust_factor) <= 1.0):
            raise ValueError(f"dust_factor must be between 0.0 and 1.0, got {dust_factor}")

    if battery_soc_kwh is not None:
        if not isinstance(battery_soc_kwh, (int, float)) or not (0.0 <= float(battery_soc_kwh) <= 20.0):
            raise ValueError(f"battery_soc_kwh must be between 0.0 and 20.0, got {battery_soc_kwh}")

    import approval
    proposal = approval.create_proposal(
        solar_drop_pct=float(solar_drop_pct),
        dust_factor=float(dust_factor) if dust_factor is not None else None,
        battery_soc_kwh=float(battery_soc_kwh) if battery_soc_kwh is not None else None,
        source=source,
    )

    is_safe = proposal["life_support_ok"] and proposal["total_allocated_kw"] >= 7.99
    is_shortage = proposal["life_support_ok"] and not is_safe
    verdict = "SAFE" if is_safe else ("SHORTAGE" if is_shortage else "UNSAFE")
    summary = f"Simulation evaluated: {proposal['total_allocated_kw']:.1f} kW allocated across 5 subsystems. Proposal sent to Approval tab."

    return {
        "status": "proposal_created",
        "proposal_id": proposal["id"],
        "proposal": proposal,
        "verdict": verdict,
        "summary": summary,
        "power": {
            "solar_kw": proposal["solar_kw"],
            "available_kw": proposal["available_kw"],
            "demand_kw": 8.0,
            "usable_battery_kw": round(max(0.0, proposal["available_kw"] - proposal["solar_kw"]), 3),
        },
        "loads": proposal["loads"],
        "alert": {
            "level": "green" if is_safe else ("yellow" if is_shortage else "red"),
            "life_support_ok": proposal["life_support_ok"],
            "message": "Proposal awaiting operator authorization in Approval tab.",
        },
        "survival": {
            "hours_now": None if proposal["life_support_ok"] else 0.0,
        },
        "plan": {"status": "pending"},
    }



# ---------------------------------------------------------------------------
# In-memory Dataset Management (10,000 Scenarios)
# ---------------------------------------------------------------------------

DATA_DIR = Path(__file__).resolve().parent / "data"
SCENARIOS_10000_PATH = DATA_DIR / "simulation_scenarios_10000.csv"
SCENARIOS_30_PATH = DATA_DIR / "simulation_scenarios.csv"

_DATASET_DF: Optional[pd.DataFrame] = None
_DATASET_META: Dict[str, Any] = {}
_PRESET_SCENARIOS: List[Dict[str, Any]] = []
_DATASET_ROWS_CACHE: Optional[List[Dict[str, Any]]] = None
_DATASET_RESULTS_CACHE: Optional[Dict[str, Any]] = None


def load_dataset_scenarios() -> pd.DataFrame:
    """
    Load simulation scenarios ONCE at startup into memory (pandas).
    Validates required columns and numerical ranges.
    Falls back to the 30-scenario library if the 10,000-scenario file is missing.
    """
    global _DATASET_DF, _DATASET_META, _PRESET_SCENARIOS
    required_cols = ["solar_loss_pct", "dust_factor", "battery_soc_kwh"]

    if SCENARIOS_10000_PATH.exists():
        file_path = SCENARIOS_10000_PATH
        dataset_name = "simulation_scenarios_10000.csv"
    elif SCENARIOS_30_PATH.exists():
        file_path = SCENARIOS_30_PATH
        dataset_name = "simulation_scenarios.csv"
        print(f"Warning: 10000-scenario file missing at {SCENARIOS_10000_PATH}. Falling back to 30-scenario library.")
    else:
        raise FileNotFoundError(f"Neither {SCENARIOS_10000_PATH} nor {SCENARIOS_30_PATH} exists.")

    df = pd.read_csv(file_path)

    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Dataset missing required column: '{col}'")

    # Validate ranges
    if not ((df["solar_loss_pct"] >= 0.0) & (df["solar_loss_pct"] <= 100.0)).all():
        raise ValueError("solar_loss_pct contains values outside [0, 100]")
    if not ((df["dust_factor"] >= 0.0) & (df["dust_factor"] <= 1.0)).all():
        raise ValueError("dust_factor contains values outside [0, 1]")
    if not ((df["battery_soc_kwh"] >= 0.0) & (df["battery_soc_kwh"] <= 20.0)).all():
        raise ValueError("battery_soc_kwh contains values outside [0, 20]")

    _DATASET_DF = df
    cats = sorted([str(c) for c in df["category"].dropna().unique()]) if "category" in df.columns else []
    _DATASET_META = {
        "name": dataset_name,
        "total_rows": int(len(df)),
        "categories": cats,
    }

    # Populate preset scenarios list for backwards compatibility
    _PRESET_SCENARIOS = []
    if SCENARIOS_30_PATH.exists():
        with open(SCENARIOS_30_PATH, "r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                _PRESET_SCENARIOS.append(r)

    print(f"Loaded {len(df)} scenarios")
    return _DATASET_DF


# Load dataset once at module initialization
load_dataset_scenarios()


def get_dataset_info() -> Dict[str, Any]:
    """Return dataset metadata: name, total_rows, and categories."""
    if _DATASET_DF is None:
        load_dataset_scenarios()
    return {
        "name": _DATASET_META.get("name", "simulation_scenarios_10000.csv"),
        "total_rows": _DATASET_META.get("total_rows", 0),
        "categories": _DATASET_META.get("categories", []),
    }


def get_dataset_random(category: Optional[str] = None) -> Dict[str, Any]:
    """Return a single random row and its 0-based index, optionally filtered by category."""
    if _DATASET_DF is None:
        load_dataset_scenarios()

    if category and category.strip() and "category" in _DATASET_DF.columns:
        filtered_df = _DATASET_DF[_DATASET_DF["category"].astype(str).str.lower() == category.strip().lower()]
        if filtered_df.empty:
            filtered_df = _DATASET_DF
    else:
        filtered_df = _DATASET_DF

    chosen_idx = int(random.choice(filtered_df.index))
    row = _DATASET_DF.iloc[chosen_idx].to_dict()

    return {
        "index": chosen_idx,
        "scenario": {
            "scenario_id": str(row.get("scenario_id", f"SC{chosen_idx+1:05d}")),
            "name": str(row.get("name", f"Scenario {chosen_idx+1}")),
            "category": str(row.get("category", "General")),
            "solar_loss_pct": float(row.get("solar_loss_pct", 0.0)),
            "dust_factor": float(row.get("dust_factor", 0.0)),
            "battery_soc_kwh": float(row.get("battery_soc_kwh", 16.5)),
            "description": str(row.get("description", "")),
        },
    }


def get_dataset_by_index(index: int) -> Dict[str, Any]:
    """Return one row by 0-based index. Raises IndexError if out of range."""
    if _DATASET_DF is None:
        load_dataset_scenarios()

    if index < 0 or index >= len(_DATASET_DF):
        raise IndexError(f"Scenario index {index} out of range [0, {len(_DATASET_DF) - 1}]")

    row = _DATASET_DF.iloc[index].to_dict()
    return {
        "index": int(index),
        "scenario": {
            "scenario_id": str(row.get("scenario_id", f"SC{index+1:05d}")),
            "name": str(row.get("name", f"Scenario {index+1}")),
            "category": str(row.get("category", "General")),
            "solar_loss_pct": float(row.get("solar_loss_pct", 0.0)),
            "dust_factor": float(row.get("dust_factor", 0.0)),
            "battery_soc_kwh": float(row.get("battery_soc_kwh", 16.5)),
            "description": str(row.get("description", "")),
        },
    }


def run_all_dataset(chunk_size: int = 500) -> Dict[str, Any]:
    """
    Evaluates all rows in chunks of 500 with the exact same mathematical model
    as the manual simulation. Returns only a SUMMARY:
    - counts per alert level (safe/watch/critical/unsafe)
    - % with life support OK
    - average survival hours
    - the 10 worst scenarios
    - 50-row engine verification check (ensuring complete parity)
    """
    if _DATASET_DF is None:
        load_dataset_scenarios()

    df = _DATASET_DF
    n_rows = len(df)
    t0 = time.perf_counter()

    safe_count = 0
    watch_count = 0
    critical_count = 0
    unsafe_count = 0

    all_available = np.zeros(n_rows, dtype=np.float64)
    all_solar = np.zeros(n_rows, dtype=np.float64)
    all_usable_batt = np.zeros(n_rows, dtype=np.float64)
    all_ls_ok = np.zeros(n_rows, dtype=bool)
    all_survival_hours = np.full(n_rows, np.nan, dtype=np.float64)
    all_alert_levels = []

    # Process in chunks of 500
    for start in range(0, n_rows, chunk_size):
        end = min(start + chunk_size, n_rows)
        chunk = df.iloc[start:end]

        c_loss = chunk["solar_loss_pct"].to_numpy(dtype=np.float64)
        c_dust = chunk["dust_factor"].to_numpy(dtype=np.float64)
        c_batt = chunk["battery_soc_kwh"].to_numpy(dtype=np.float64)

        # Solar, usable battery, available power matching manual simulation exactly
        c_solar = np.round(10.0 * (1.0 - c_dust) * (1.0 - c_loss / 100.0), 3)
        c_usable_batt = np.round(np.clip(c_batt - 3.0, 0.0, 2.5), 3)
        c_avail = np.round(c_solar + c_usable_batt, 3)

        # Categorization based on unified ALERT_THRESHOLDS
        c_safe = c_avail >= ALERT_THRESHOLDS["safe"] - 1e-4
        c_watch = (c_avail >= ALERT_THRESHOLDS["watch"] - 1e-4) & (~c_safe)
        c_critical = (c_avail >= ALERT_THRESHOLDS["critical"] - 1e-4) & (~c_safe) & (~c_watch)
        c_unsafe = c_avail < ALERT_THRESHOLDS["critical"] - 1e-4

        safe_count += int(c_safe.sum())
        watch_count += int(c_watch.sum())
        critical_count += int(c_critical.sum())
        unsafe_count += int(c_unsafe.sum())

        c_ls_ok = c_avail >= ALERT_THRESHOLDS["critical"] - 1e-4

        # Survival hours calculation matching engine._build_state
        c_drain = np.round(np.minimum(np.maximum(8.0 - c_solar, 0.0), c_usable_batt), 3)
        c_usable_kwh = np.maximum(0.0, c_batt - 3.0)

        c_surv = np.full(len(chunk), np.nan, dtype=np.float64)
        # Unsafe / LS deficit => 0.0
        c_surv[~c_ls_ok] = 0.0
        # When draining battery:
        draining = c_ls_ok & (c_drain > 0.01)
        c_surv[draining] = np.round(c_usable_kwh[draining] / c_drain[draining], 1)
        # Non-draining (surv remains nan)

        all_available[start:end] = c_avail
        all_solar[start:end] = c_solar
        all_usable_batt[start:end] = c_usable_batt
        all_ls_ok[start:end] = c_ls_ok
        all_survival_hours[start:end] = c_surv

        for s, w, c, u in zip(c_safe, c_watch, c_critical, c_unsafe):
            if s:
                all_alert_levels.append("safe")
            elif w:
                all_alert_levels.append("watch")
            elif c:
                all_alert_levels.append("critical")
            else:
                all_alert_levels.append("unsafe")

    # Metrics
    life_support_ok_count = safe_count + watch_count + critical_count
    life_support_ok_pct = round((life_support_ok_count / n_rows) * 100.0, 2)
    shortage_count = watch_count + critical_count
    shortage_pct = round((shortage_count / n_rows) * 100.0, 2)

    # Average survival hours for finite draining scenarios
    draining_surv = all_survival_hours[~np.isnan(all_survival_hours)]
    avg_survival_hours = round(float(np.mean(draining_surv)), 1) if len(draining_surv) > 0 else 0.0

    # Build compact in-memory cache of all row evaluations
    cached_rows: List[Dict[str, Any]] = []
    for i in range(n_rows):
        row = df.iloc[i]
        surv_val = all_survival_hours[i]
        cached_rows.append({
            "index": int(i),
            "scenario_id": str(row.get("scenario_id", f"SC{i+1:05d}")),
            "name": str(row.get("name", f"Scenario {i+1}")),
            "category": str(row.get("category", "General")),
            "solar_loss_pct": float(row.get("solar_loss_pct", 0.0)),
            "loss": float(row.get("solar_loss_pct", 0.0)),
            "dust_factor": float(row.get("dust_factor", 0.0)),
            "dust": float(row.get("dust_factor", 0.0)),
            "battery_soc_kwh": float(row.get("battery_soc_kwh", 0.0)),
            "battery": float(row.get("battery_soc_kwh", 0.0)),
            "solar_kw": float(all_solar[i]),
            "usable_battery_kw": float(all_usable_batt[i]),
            "available_kw": float(all_available[i]),
            "alert_level": str(all_alert_levels[i]),
            "life_support_ok": bool(all_ls_ok[i]),
            "survival_hours": None if np.isnan(surv_val) else float(surv_val),
            "description": str(row.get("description", "")),
        })

    # 10 Worst Scenarios
    # Sort criteria: LS deficit first (ls_ok=False), lowest available power, lowest battery SoC
    worst_sort_keys = []
    for i in range(n_rows):
        worst_sort_keys.append((
            all_ls_ok[i],                    # False comes before True
            all_available[i],                # Lowest available first
            df["battery_soc_kwh"].iloc[i],   # Lowest battery first
            i                                # Index tie-breaker
        ))
    worst_indices = [k[3] for k in sorted(worst_sort_keys)[:10]]

    worst_scenarios = []
    for rank, idx in enumerate(worst_indices, start=1):
        row = df.iloc[idx]
        surv_val = all_survival_hours[idx]
        worst_scenarios.append({
            "rank": rank,
            "index": int(idx),
            "scenario_id": str(row.get("scenario_id", f"SC{idx+1:05d}")),
            "name": str(row.get("name", f"Scenario {idx+1}")),
            "category": str(row.get("category", "General")),
            "solar_loss_pct": float(row.get("solar_loss_pct", 0.0)),
            "loss": float(row.get("solar_loss_pct", 0.0)),
            "dust_factor": float(row.get("dust_factor", 0.0)),
            "dust": float(row.get("dust_factor", 0.0)),
            "battery_soc_kwh": float(row.get("battery_soc_kwh", 0.0)),
            "battery": float(row.get("battery_soc_kwh", 0.0)),
            "solar_kw": float(all_solar[idx]),
            "usable_battery_kw": float(all_usable_batt[idx]),
            "available_kw": float(all_available[idx]),
            "alert_level": all_alert_levels[idx],
            "life_support_ok": bool(all_ls_ok[idx]),
            "survival_hours": None if np.isnan(surv_val) else float(surv_val),
            "description": str(row.get("description", "")),
        })

    # 50 random sample verification check against isolated Simulator instance
    sample_size = min(50, n_rows)
    rng = random.Random(42)
    sample_indices = rng.sample(range(n_rows), sample_size)
    mismatches = 0
    test_sim = Simulator()

    for s_idx in sample_indices:
        s_row = df.iloc[s_idx]
        test_sim.custom_scenario(
            solar_drop_pct=float(s_row["solar_loss_pct"]),
            dust_factor=float(s_row["dust_factor"]),
            battery_soc_kwh=float(s_row["battery_soc_kwh"]),
        )
        s_solar = test_sim.current_solar_kw()
        s_usable = test_sim.current_usable_battery_kw()
        s_avail = round(s_solar + s_usable, 3)
        s_opt = optimize(test_sim.loads, s_solar, s_usable)
        s_ls = s_opt["life_support_ok"]
        s_drain = round(min(max(8.0 - s_solar, 0.0), s_usable), 3)
        s_kwh = max(0.0, float(s_row["battery_soc_kwh"]) - 3.0)
        s_surv = 0.0 if not s_ls else (None if s_drain <= 0.01 else round(s_kwh / s_drain, 1))

        calc_avail = all_available[s_idx]
        calc_ls = all_ls_ok[s_idx]
        calc_surv = all_survival_hours[s_idx]

        surv_matches = (s_surv is None and np.isnan(calc_surv)) or (
            s_surv is not None and not np.isnan(calc_surv) and abs(s_surv - calc_surv) <= 0.15
        )

        if abs(s_avail - calc_avail) > 0.01 or s_ls != calc_ls or not surv_matches:
            mismatches += 1

    total_time_ms = round((time.perf_counter() - t0) * 1000, 2)

    result = {
        "summary": {
            "total_scenarios": n_rows,
            "chunk_size": chunk_size,
            "counts": {
                "safe": safe_count,
                "watch": watch_count,
                "critical": critical_count,
                "unsafe": unsafe_count,
                "shortage": shortage_count,
                "all": n_rows,
            },
            "percentages": {
                "safe": round(safe_count / n_rows * 100.0, 2),
                "watch": round(watch_count / n_rows * 100.0, 2),
                "critical": round(critical_count / n_rows * 100.0, 2),
                "unsafe": round(unsafe_count / n_rows * 100.0, 2),
                "shortage": shortage_pct,
                "all": 100.0,
            },
            "life_support_ok_count": life_support_ok_count,
            "life_support_ok_pct": life_support_ok_pct,
            "average_survival_hours": avg_survival_hours,
            "computation_time_ms": total_time_ms,
        },
        "worst_scenarios": worst_scenarios,
        "validation_check": {
            "samples_checked": sample_size,
            "mismatches": mismatches,
            "status": "pass" if mismatches == 0 else "mismatch_detected",
        },
    }

    global _DATASET_ROWS_CACHE, _DATASET_RESULTS_CACHE
    _DATASET_ROWS_CACHE = cached_rows
    _DATASET_RESULTS_CACHE = result

    return result


def get_dataset_results(
    level: str = "shortage",
    sort: str = "worst",
    page: int = 1,
    page_size: int = 10,
) -> Dict[str, Any]:
    """
    Return paginated, sorted results for a specific alert level from cache.
    If run-all has not been run yet, runs it automatically.
    - level: all | safe | watch | critical | unsafe | shortage
    - sort: worst | best | random
    """
    global _DATASET_ROWS_CACHE, _DATASET_RESULTS_CACHE
    if _DATASET_ROWS_CACHE is None or _DATASET_RESULTS_CACHE is None:
        run_all_dataset()

    level_norm = (level or "all").strip().lower()
    sort_norm = (sort or "worst").strip().lower()
    page_num = max(1, int(page))
    page_sz = max(1, min(100, int(page_size)))

    all_rows = _DATASET_ROWS_CACHE or []

    if level_norm == "safe":
        filtered = [r for r in all_rows if r["alert_level"] == "safe"]
    elif level_norm == "watch":
        filtered = [r for r in all_rows if r["alert_level"] == "watch"]
    elif level_norm == "critical":
        filtered = [r for r in all_rows if r["alert_level"] == "critical"]
    elif level_norm == "unsafe":
        filtered = [r for r in all_rows if r["alert_level"] == "unsafe"]
    elif level_norm == "shortage":
        filtered = [r for r in all_rows if r["alert_level"] in ("watch", "critical")]
    else:  # "all"
        filtered = list(all_rows)

    total_matching = len(filtered)
    total_pages = math.ceil(total_matching / page_sz) if total_matching > 0 else 1

    if sort_norm == "random":
        sample_k = min(page_sz, total_matching)
        rows_page = random.sample(filtered, sample_k) if sample_k > 0 else []
        return {
            "total_matching": total_matching,
            "page": page_num,
            "page_size": page_sz,
            "total_pages": total_pages,
            "rows": rows_page,
        }
    elif sort_norm == "best":
        # Highest available power first
        filtered.sort(key=lambda r: (-r["available_kw"], not r["life_support_ok"], -r["battery_soc_kwh"], r["index"]))
    else:  # default "worst": lowest available power first
        filtered.sort(key=lambda r: (r["available_kw"], r["life_support_ok"], r["battery_soc_kwh"], r["index"]))

    start_idx = (page_num - 1) * page_sz
    end_idx = start_idx + page_sz
    rows_page = filtered[start_idx:end_idx] if start_idx < total_matching else []

    return {
        "total_matching": total_matching,
        "page": page_num,
        "page_size": page_sz,
        "total_pages": total_pages,
        "rows": rows_page,
    }


def get_dataset_samples() -> Dict[str, Any]:
    """
    Return one random representative scenario from each alert level:
    safe, watch, critical, unsafe.
    """
    global _DATASET_ROWS_CACHE
    if _DATASET_ROWS_CACHE is None:
        run_all_dataset()

    all_rows = _DATASET_ROWS_CACHE or []
    grouped: Dict[str, List[Dict[str, Any]]] = {
        "safe": [],
        "watch": [],
        "critical": [],
        "unsafe": [],
    }
    for r in all_rows:
        lvl = r.get("alert_level")
        if lvl in grouped:
            grouped[lvl].append(r)

    samples: Dict[str, Optional[Dict[str, Any]]] = {}
    for lvl in ("safe", "watch", "critical", "unsafe"):
        pool = grouped[lvl]
        samples[lvl] = random.choice(pool) if pool else None

    return {
        "samples": samples,
        **samples,
    }


# Backwards compatibility helper for preset library
def load_simulation_scenarios() -> List[Dict[str, Any]]:
    return _PRESET_SCENARIOS


def get_scenarios() -> List[Dict[str, Any]]:
    """Return scenarios from the loaded preset library."""
    output = []
    for r in _PRESET_SCENARIOS:
        output.append({
            "id": r.get("id"),
            "name": r.get("name"),
            "category": r.get("category"),
            "description": r.get("description"),
            "solar_loss_pct": float(r.get("solar_loss_pct", 0.0)),
            "dust_factor": float(r.get("dust_factor", 0.0)) if r.get("dust_factor") != "" else 0.0,
            "battery_soc_kwh": float(r.get("battery_soc_kwh", 16.5)) if r.get("battery_soc_kwh") != "" else 16.5,
            "expected_solar_kw": float(r["solar_kw"]) if "solar_kw" in r and r["solar_kw"] != "" else None,
            "expected_available_kw": float(r["available_kw"]) if "available_kw" in r and r["available_kw"] != "" else None,
            "expected_verdict": r.get("verdict"),
            "expected_life_support_ok": (r.get("life_support_ok") == "True") if "life_support_ok" in r else None,
            "alloc_life_support": float(r["alloc_life_support"]) if "alloc_life_support" in r and r["alloc_life_support"] != "" else None,
            "alloc_habitat": float(r["alloc_habitat"]) if "alloc_habitat" in r and r["alloc_habitat"] != "" else None,
            "alloc_comms": float(r["alloc_comms"]) if "alloc_comms" in r and r["alloc_comms"] != "" else None,
            "alloc_science": float(r["alloc_science"]) if "alloc_science" in r and r["alloc_science"] != "" else None,
            "alloc_rover": float(r["alloc_rover"]) if "alloc_rover" in r and r["alloc_rover"] != "" else None,
            "unmet_kw": float(r["unmet_kw"]) if "unmet_kw" in r and r["unmet_kw"] != "" else None,
        })
    return output


def apply_preset(scenario_id: str) -> Dict[str, Any]:
    """Apply preset row through custom_scenario and return full state."""
    scenarios = get_scenarios()
    target = next((s for s in scenarios if str(s["id"]).strip().upper() == str(scenario_id).strip().upper()), None)
    if not target:
        raise KeyError(f"Scenario preset '{scenario_id}' not found")
    return custom_scenario(
        solar_drop_pct=target["solar_loss_pct"],
        dust_factor=target["dust_factor"],
        battery_soc_kwh=target["battery_soc_kwh"],
        source=f"Preset {scenario_id}: {target.get('name', '')}",
    )



def get_horizon_plan() -> Dict[str, Any]:
    """24-hour battery-aware multi-period horizon dispatch plan."""
    from planner import plan_horizon
    return plan_horizon(sim)

