"""
engine.py - SPACEGRID AI state engine.

Public API:
    get_state()          -> dict   current full state (JSON-ready)
    solar_drop(factor)   -> dict   apply obscuration event, return new state
    reset()              -> dict   restore nominal state, return new state

All three functions return the exact JSON shape expected by the frontend
(api.js normalizeState).  The re-plan time is measured in real milliseconds
with time.perf_counter().

This module owns the plan-approval status that server.py manages.
To allow server.py to control plan status, use set_plan_status() /
get_plan_status().
"""

from __future__ import annotations
import csv
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from simulator import sim, NOMINAL_DUST_FACTOR, Load, DEFAULT_LOADS
from optimizer import optimize
from risk import assess_risk
from forecast import generate_forecast

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

    # ---- Alert & Verdict ----
    # Demand 8.0 kW, Life Support need 3.0 kW
    # >= 8.0  -> SAFE (all loads powered)
    # 3.0 to 8.0 -> SHORTAGE (life support OK, lower loads cut)
    # < 3.0 -> UNSAFE (life support cannot be met)
    if available_kw >= demand_kw - 1e-4:
        verdict = "SAFE"
        summary = "All loads are fully powered with available power meeting habitat demand."
        level = "green"
        title = "NOMINAL"
        msg = "Solar array nominal. All habitat sub-systems fully powered."
        ls_ok = True
    elif available_kw >= 3.0 - 1e-4:
        verdict = "SHORTAGE"
        summary = "Available power covers life support, but lower-priority loads are curtailed."
        level = "red"
        title = "SHORTAGE"
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
            f"minimum requirement (3.0 kW). Immediate human command escalation required."
        )
        ls_ok = False

    # ---- Battery & Survival hours ----
    # storage_drain_kw = min(max(demand - solar, 0), usable_battery_kw), never exceeding 2.5 kW max_discharge
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
        },
        "alert": {
            "level":           level,
            "life_support":    ls_ok,
            "life_support_ok": ls_ok,
            "title":           title,
            "message":         msg,
        },
        "risk":         risk,
        "forecast":     fcast,
        "loads":        opt["loads"],
        "comparison":   opt["comparison"],
        "plan":         {"status": _plan_status},
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
    return _build_state()


def reset() -> dict:
    """
    Restore the simulator to nominal state.
    Returns the reset state dict.
    """
    sim.reset()
    set_plan_status("approved")
    return _build_state()


def blackout() -> dict:
    """
    Trigger severe dust storm event (solar near 0) with battery at minimum reserve,
    so available power cannot meet Life Support requirements.
    Returns the updated state dict with life_support_ok = False and red alert.
    """
    sim.blackout()
    set_plan_status("pending")
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
) -> dict:
    """
    Apply a custom disruption scenario with validation.
    solar_drop_pct: 0 to 100
    dust_factor: optional 0.0 to 1.0
    battery_soc_kwh: optional 0.0 to 20.0
    """
    if not isinstance(solar_drop_pct, (int, float)) or not (0.0 <= float(solar_drop_pct) <= 100.0):
        raise ValueError(f"solar_drop_pct must be between 0 and 100, got {solar_drop_pct}")

    if dust_factor is not None:
        if not isinstance(dust_factor, (int, float)) or not (0.0 <= float(dust_factor) <= 1.0):
            raise ValueError(f"dust_factor must be between 0.0 and 1.0, got {dust_factor}")

    if battery_soc_kwh is not None:
        if not isinstance(battery_soc_kwh, (int, float)) or not (0.0 <= float(battery_soc_kwh) <= 20.0):
            raise ValueError(f"battery_soc_kwh must be between 0.0 and 20.0, got {battery_soc_kwh}")

    sim.custom_scenario(
        solar_drop_pct=float(solar_drop_pct),
        dust_factor=float(dust_factor) if dust_factor is not None else None,
        battery_soc_kwh=float(battery_soc_kwh) if battery_soc_kwh is not None else None,
    )
    st = _build_state()
    is_disrupted = (
        st["verdict"] != "SAFE"
        or float(solar_drop_pct) > 0.0
        or (dust_factor is not None and float(dust_factor) > 0.12)
        or (battery_soc_kwh is not None and float(battery_soc_kwh) < 16.0)
    )
    set_plan_status("pending" if is_disrupted else "approved")
    st["plan"]["status"] = _plan_status
    return st


# ---------------------------------------------------------------------------
# Preset library and dataset batch processing
# ---------------------------------------------------------------------------

SCENARIOS_CSV_PATH = Path(__file__).resolve().parent / "data" / "simulation_scenarios.csv"
_PRESET_SCENARIOS: List[Dict[str, Any]] = []


def load_simulation_scenarios() -> List[Dict[str, Any]]:
    """Load built-in 30 scenarios from CSV."""
    global _PRESET_SCENARIOS
    _PRESET_SCENARIOS = []
    if SCENARIOS_CSV_PATH.exists():
        with open(SCENARIOS_CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                _PRESET_SCENARIOS.append(r)
    return _PRESET_SCENARIOS


# Load at module initialization
load_simulation_scenarios()


def get_scenarios() -> List[Dict[str, Any]]:
    """Return id, name, category, description and the three inputs of each row."""
    if not _PRESET_SCENARIOS and SCENARIOS_CSV_PATH.exists():
        load_simulation_scenarios()
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
    """Apply preset row through the same path as custom_scenario and return full state."""
    scenarios = get_scenarios()
    target = next((s for s in scenarios if str(s["id"]).strip().upper() == str(scenario_id).strip().upper()), None)
    if not target:
        raise KeyError(f"Scenario preset '{scenario_id}' not found")
    return custom_scenario(
        solar_drop_pct=target["solar_loss_pct"],
        dust_factor=target["dust_factor"],
        battery_soc_kwh=target["battery_soc_kwh"],
    )


def simulate_dataset(rows: Optional[List[Dict[str, Any]]] = None, library: bool = False) -> Dict[str, Any]:
    """
    Simulate a batch of scenarios without altering live state.
    """
    if library or rows is None:
        raw_rows = get_scenarios()
    else:
        raw_rows = rows

    if len(raw_rows) > 500:
        raise ValueError(f"Dataset exceeds limit: maximum 500 rows allowed, got {len(raw_rows)}")

    evaluated_rows = []
    safe_cnt = 0
    shortage_cnt = 0
    unsafe_cnt = 0
    eq_fail_sg_ok_cnt = 0
    t0 = time.perf_counter()

    for idx, r in enumerate(raw_rows, start=1):
        raw_loss = r.get("solar_loss_pct", r.get("solar_drop_pct"))
        if raw_loss is None or raw_loss == "":
            raise ValueError(f"Row {idx}: missing required field solar_loss_pct")
        try:
            drop = float(raw_loss)
        except (ValueError, TypeError):
            raise ValueError(f"Row {idx}: invalid solar_loss_pct '{raw_loss}'. Must be a number.")
        if not (0.0 <= drop <= 100.0):
            raise ValueError(f"Row {idx}: invalid solar_loss_pct '{drop}'. Must be between 0 and 100.")

        raw_dust = r.get("dust_factor")
        if raw_dust is not None and raw_dust != "":
            try:
                dust = float(raw_dust)
            except (ValueError, TypeError):
                raise ValueError(f"Row {idx}: invalid dust_factor '{raw_dust}'. Must be a number.")
            if not (0.0 <= dust <= 1.0):
                raise ValueError(f"Row {idx}: invalid dust_factor '{dust}'. Must be between 0 and 1.")
        else:
            dust = 0.0

        raw_soc = r.get("battery_soc_kwh")
        if raw_soc is not None and raw_soc != "":
            try:
                soc = float(raw_soc)
            except (ValueError, TypeError):
                raise ValueError(f"Row {idx}: invalid battery_soc_kwh '{raw_soc}'. Must be a number.")
            if not (0.0 <= soc <= 20.0):
                raise ValueError(f"Row {idx}: invalid battery_soc_kwh '{soc}'. Must be between 0 and 20.")
        else:
            soc = 16.5

        # Rule from STEP 0
        solar_kw = round(10.0 * (1.0 - dust) * (1.0 - drop / 100.0), 3)
        usable_batt_kw = round(min(max(soc - 3.0, 0.0), 2.5), 3)
        available_kw = round(solar_kw + usable_batt_kw, 3)

        if available_kw >= 8.0 - 0.001:
            verdict = "SAFE"
            safe_cnt += 1
        elif available_kw >= 3.0 - 0.001:
            verdict = "SHORTAGE"
            shortage_cnt += 1
        else:
            verdict = "UNSAFE"
            unsafe_cnt += 1

        # Run policies on copy of loads
        loads_copy = [Load(l.id, l.name, l.priority, l.tier, l.need_kw, l.weight) for l in DEFAULT_LOADS]
        opt_res = optimize(loads_copy, solar_kw, usable_batt_kw)

        ls_ok = opt_res["life_support_ok"]
        unmet_kw = round(opt_res["unmet_kw"], 3)
        alloc_map = {l["id"]: round(l["allocated_kw"], 3) for l in opt_res["loads"]}

        pols_data = {}
        for p in opt_res["comparison"]:
            pols_data[p["policy"]] = {
                "life_support_ok": p["life_support_ok"],
                "unmet_kw": round(p["unmet_kw"], 3),
                "allocations": {k: round(v, 3) for k, v in p["allocations"].items()},
            }

        eq_pol = pols_data.get("equal_split")
        sg_pol = pols_data.get("spacegrid")
        if eq_pol and sg_pol and (not eq_pol["life_support_ok"]) and sg_pol["life_support_ok"]:
            eq_fail_sg_ok_cnt += 1

        matches_expected = True
        has_expected = False
        swap_detected = False

        exp_avail = r.get("expected_available_kw", r.get("available_kw"))
        if exp_avail is not None and exp_avail != "":
            has_expected = True
            if abs(available_kw - float(exp_avail)) > 0.05:
                matches_expected = False

        exp_verdict = r.get("expected_verdict", r.get("verdict"))
        if exp_verdict is not None and exp_verdict != "":
            has_expected = True
            if str(exp_verdict).strip().upper() != verdict.upper():
                matches_expected = False

        exp_ls_ok = r.get("expected_life_support_ok", r.get("life_support_ok"))
        if exp_ls_ok is not None and exp_ls_ok != "":
            has_expected = True
            b_exp = exp_ls_ok is True or str(exp_ls_ok).lower() in ("true", "1")
            if ls_ok != b_exp:
                matches_expected = False

        # Load swap reporting (habitat and comms share weight 100)
        exp_hab = r.get("alloc_habitat")
        exp_com = r.get("alloc_comms")
        calc_hab = alloc_map.get("habitat", 0.0)
        calc_com = alloc_map.get("comms", 0.0)
        if exp_hab is not None and exp_com is not None and exp_hab != "" and exp_com != "":
            exp_hab_f = float(exp_hab)
            exp_com_f = float(exp_com)
            if abs((calc_hab + calc_com) - (exp_hab_f + exp_com_f)) <= 0.05:
                if abs(calc_hab - exp_hab_f) > 0.05:
                    swap_detected = True

        evaluated_rows.append({
            "id": r.get("id"),
            "name": r.get("name", f"Scenario {idx}"),
            "category": r.get("category"),
            "description": r.get("description"),
            "inputs": {
                "solar_loss_pct": drop,
                "dust_factor": dust,
                "battery_soc_kwh": soc,
            },
            "solar_kw": solar_kw,
            "usable_battery_kw": usable_batt_kw,
            "available_kw": available_kw,
            "verdict": verdict,
            "life_support_ok": ls_ok,
            "load_allocations": alloc_map,
            "unmet_kw": unmet_kw,
            "policies": pols_data,
            "matches_expected": matches_expected if has_expected else True,
            "swap_detected": swap_detected,
        })

    total_time_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "rows": evaluated_rows,
        "summary": {
            "total_rows": len(evaluated_rows),
            "safe_count": safe_cnt,
            "shortage_count": shortage_cnt,
            "unsafe_count": unsafe_cnt,
            "equal_split_fails_ls_spacegrid_ok": eq_fail_sg_ok_cnt,
            "total_optimizer_time_ms": total_time_ms,
        }
    }


