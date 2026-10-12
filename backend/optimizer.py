"""
optimizer.py - LUNAGRID AI linear-program load scheduler.

Uses PuLP 2.9.0 with the bundled CBC solver (PULP_CBC_CMD) to minimise
weighted unmet demand across 5 habitat loads.

Weights: life_support=1000, habitat=100, communication=100, experiments=10, rover=1

Decision variables: P_i = power allocated to load i
Objective:  minimise sum(weight_i * (need_i - P_i))
Constraints:
    0 <= P_i <= need_i        for each load i
    sum(P_i) <= solar_kw + usable_battery_kw

Returns a dict with keys:
    loads           list of per-load dicts (id, name, priority, tier,
                    need_kw, allocated_kw, status, reason + legacy aliases)
    life_support_ok bool   – False triggers the unsafe alert on the frontend
    unmet_kw        float  – total unserved demand
    comparison      list   – equal_split / fixed_rules / lunagrid policies
"""

from __future__ import annotations
from typing import List, Tuple

import pulp

from simulator import Load, LOAD_ID_ALIAS


# ---------------------------------------------------------------------------
# Status & reason helpers
# ---------------------------------------------------------------------------

def _status(need: float, alloc: float) -> str:
    if alloc >= need - 1e-4:
        return "Protected"
    if alloc > 1e-4:
        ratio = alloc / need
        return "Reduced" if ratio >= 0.25 else "Postponed"
    return "Off"


def _reason(load_id: str, need: float, alloc: float) -> str:
    ratio = alloc / need if need > 0 else 1.0

    if ratio >= 1.0 - 1e-4:
        return {
            "life_support":  "Critical priority locked: O2 scrubbing and thermal loops fully powered.",
            "habitat":       "Internal lighting, air circulation, and water reclamation fully sustained.",
            "communication": "High-gain Earth dish transmitting continuous telemetry.",
            "experiments":   "Continuous core sample spectrometer runs active.",
            "rover":         "Pressurised rover charging pad operating at target voltage.",
        }.get(load_id, "Nominal allocation.")

    if alloc > 1e-4:
        return {
            "life_support":  f"Deficit of {need - alloc:.1f} kW on primary life support – emergency mode.",
            "habitat":       f"Throttled aux lighting and appliances by {(1 - ratio)*100:.0f}%.",
            "communication": "Switched to low-bandwidth emergency beacon mode.",
            "experiments":   "Active drilling paused; sample refrigeration insulated.",
            "rover":         "Dock charging reduced; rover on partial reserves.",
        }.get(load_id, f"Reduced to {alloc:.1f} kW of {need:.1f} kW need.")

    return {
        "life_support":  "Life support completely off – immediate evacuation required.",
        "habitat":       "All non-essential habitat power severed.",
        "communication": "Primary transceiver offline. Passive VHF survival beacon only.",
        "experiments":   "Science load fully severed.",
        "rover":         "Dock charger isolated; rover on internal reserves.",
    }.get(load_id, "Load shed.")


# ---------------------------------------------------------------------------
# LP solver (PuLP 2.9.0 / CBC)
# ---------------------------------------------------------------------------

def _run_lp(loads: List[Load], solar_kw: float, usable_battery_kw: float
            ) -> Tuple[dict, bool, float]:
    """
    Solves:
        min  sum(weight_i * (need_i - P_i))
        s.t. sum(P_i) <= available
             0 <= P_i <= need_i

    Returns (allocations dict, life_support_ok, total_unmet_kw).
    """
    available = solar_kw + usable_battery_kw

    prob = pulp.LpProblem("lunagrid_dispatch", pulp.LpMinimize)

    # Decision variables
    P = {l.id: pulp.LpVariable(f"P_{l.id}", lowBound=0.0, upBound=l.need_kw)
         for l in loads}

    # Objective: minimise weighted unmet
    prob += pulp.lpSum(l.weight * (l.need_kw - P[l.id]) for l in loads), "obj"

    # Power cap
    prob += pulp.lpSum(P[l.id] for l in loads) <= available, "power_cap"

    # Solve with CBC (suppress output)
    prob.solve(pulp.PULP_CBC_CMD(msg=0))

    alloc = {l.id: round(max(0.0, pulp.value(P[l.id]) or 0.0), 4) for l in loads}

    ls_need = next(l.need_kw for l in loads if l.id == "life_support")
    life_support_ok = alloc["life_support"] >= ls_need - 1e-4

    total_unmet = round(max(0.0, sum(l.need_kw - alloc[l.id] for l in loads)), 4)
    return alloc, life_support_ok, total_unmet


# ---------------------------------------------------------------------------
# Comparison policies
# ---------------------------------------------------------------------------

def _equal_split(loads: List[Load], available: float) -> Tuple[dict, bool, float]:
    """
    Fair equal-split baseline with water-filling:
    Each load is capped at its need_kw, and leftover power is iteratively
    redistributed equally among still-unmet loads.
    """
    alloc = {l.id: 0.0 for l in loads}
    remaining = max(0.0, available)
    unmet = [l for l in loads if l.need_kw > 0]

    while remaining > 1e-6 and unmet:
        share = remaining / len(unmet)
        capped_this_round = []
        for l in unmet:
            needed = l.need_kw - alloc[l.id]
            if share >= needed - 1e-9:
                alloc[l.id] = l.need_kw
                remaining -= needed
                capped_this_round.append(l)
        if not capped_this_round:
            for l in unmet:
                alloc[l.id] += share
            remaining = 0.0
            break
        for l in capped_this_round:
            unmet.remove(l)

    alloc = {k: round(v, 4) for k, v in alloc.items()}
    ls_need = next((l.need_kw for l in loads if l.id == "life_support"), 3.0)
    ls_ok = alloc.get("life_support", 0.0) >= ls_need - 1e-4
    unmet_kw = round(max(0.0, sum(l.need_kw - alloc[l.id] for l in loads)), 4)
    return alloc, ls_ok, unmet_kw


def _fixed_rules(loads: List[Load], available: float) -> Tuple[dict, bool, float]:
    """Priority waterfall: fill highest-priority loads first."""
    alloc = {}
    remaining = available
    for l in sorted(loads, key=lambda x: x.priority):
        give = min(l.need_kw, max(0.0, remaining))
        alloc[l.id] = round(give, 4)
        remaining -= give
    ls_need = next(l.need_kw for l in loads if l.id == "life_support")
    ls_ok = alloc["life_support"] >= ls_need - 1e-4
    unmet = round(max(0.0, sum(l.need_kw - alloc[l.id] for l in loads)), 4)
    return alloc, ls_ok, unmet


def _to_short_allocs(alloc: dict) -> dict:
    """Remap internal load ids to the short ids used in comparison.allocations."""
    return {LOAD_ID_ALIAS.get(k, k): round(v, 3) for k, v in alloc.items()}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def optimize(loads: List[Load], solar_kw: float, usable_battery_kw: float) -> dict:
    """
    Full optimisation pass.
    Returns a dict ready to embed in the /state response.
    """
    available = solar_kw + usable_battery_kw

    sg_alloc, sg_ls_ok, sg_unmet = _run_lp(loads, solar_kw, usable_battery_kw)
    eq_alloc, eq_ls_ok, eq_unmet = _equal_split(loads, available)
    fr_alloc, fr_ls_ok, fr_unmet = _fixed_rules(loads, available)

    loads_out = []
    for l in loads:
        alloc_kw = sg_alloc[l.id]
        short_id = LOAD_ID_ALIAS.get(l.id, l.id)
        loads_out.append({
            "id":           short_id,
            "name":         l.name,
            "priority":     l.priority,
            "tier":         l.tier,
            "need":         l.need_kw,
            "allocated":    round(alloc_kw, 3),
            "need_kw":      l.need_kw,
            "allocated_kw": round(alloc_kw, 3),
            "status":       _status(l.need_kw, alloc_kw),
            "reason":       _reason(l.id, l.need_kw, alloc_kw),
        })

    comparison = [
        {
            "policy":         "equal_split",
            "label":          "Equal split",
            "life_support_ok": eq_ls_ok,
            "unmet_kw":       eq_unmet,
            "allocations":    _to_short_allocs(eq_alloc),
        },
        {
            "policy":         "fixed_rules",
            "label":          "Fixed rules",
            "life_support_ok": fr_ls_ok,
            "unmet_kw":       fr_unmet,
            "allocations":    _to_short_allocs(fr_alloc),
        },
        {
            "policy":         "spacegrid",
            "label":          "LUNAGRID AI",
            "life_support_ok": sg_ls_ok,
            "unmet_kw":       sg_unmet,
            "allocations":    _to_short_allocs(sg_alloc),
        },
    ]

    return {
        "loads":            loads_out,
        "life_support_ok":  sg_ls_ok,
        "unmet_kw":         sg_unmet,
        "comparison":       comparison,
    }
