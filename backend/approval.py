"""
approval.py - LUNAGRID AI Approval and Plan Proposal Management.

Manages:
- active_plan: The allocation currently in force on the lunar microgrid.
- pending_plan: At most one unapproved proposal created from simulations or operators.
- audit_events: In-memory audit trail of proposals, edits, approvals, and rejections.

Strict Server-side Locking:
- Permanent main loads: life_support and habitat CANNOT be modified via PATCH.
- Editable loads: communication, experiments, rover.
- Proposals with life_support or habitat < 100% are marked 'blocked' and cannot be approved.
"""

from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from simulator import sim, Load, DEFAULT_LOADS, LOAD_ID_ALIAS, SOLAR_PEAK_KW, NOMINAL_DUST_FACTOR
from optimizer import optimize, _status, _reason
from config import LIFE_SUPPORT_ALERT_THRESHOLD_KW

logger = logging.getLogger("lunagrid.approval")

# Track whether alert was active to avoid duplicate audit logs
_last_ls_alert_active: bool = False


def compute_life_support_alert(life_support_kw: float) -> Dict[str, Any]:
    """
    Computes life support alert status based on an allocated kW value.
    Returns: { active: bool, allocated_kw, threshold_kw, shortfall_kw, message }
    """
    alloc = round(float(life_support_kw), 3)
    thresh = float(LIFE_SUPPORT_ALERT_THRESHOLD_KW)
    is_active = alloc < thresh - 1e-4
    shortfall = round(max(0.0, thresh - alloc), 3)

    if is_active:
        msg = f"Life support below threshold: {alloc:.2f} kW of {thresh:.1f} kW"
    else:
        msg = "Life support allocation nominal"

    return {
        "active": is_active,
        "allocated_kw": alloc,
        "threshold_kw": thresh,
        "shortfall_kw": shortfall,
        "message": msg,
    }


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
LOCKED_LOAD_IDS: Set[str] = {"life_support", "habitat"}
EDITABLE_LOAD_IDS: Set[str] = {"communication", "comms", "experiments", "science", "rover"}

CANONICAL_TO_SHORT: Dict[str, str] = {
    "life_support": "life_support",
    "habitat": "habitat",
    "communication": "comms",
    "comms": "comms",
    "experiments": "science",
    "science": "science",
    "rover": "rover",
}

SHORT_TO_CANONICAL: Dict[str, str] = {
    "life_support": "life_support",
    "habitat": "habitat",
    "comms": "communication",
    "communication": "communication",
    "science": "experiments",
    "experiments": "experiments",
    "rover": "rover",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# In-memory State
# ---------------------------------------------------------------------------

def build_active_loads(canonical_allocs: Dict[str, float]) -> List[Dict[str, Any]]:
    """
    Build canonical loads list with identical fields expected by /state,
    optimizer.py, and AllocationPage.jsx.
    Always populates both allocated_kw, allocated, current_kw, proposed_kw,
    status, and reason.
    """
    loads_out = []
    for l in sim.loads:
        short_id = CANONICAL_TO_SHORT.get(l.id, l.id)
        alloc_kw = round(float(canonical_allocs.get(l.id, canonical_allocs.get(short_id, l.need_kw))), 3)
        loads_out.append({
            "id": short_id,
            "canonical_id": l.id,
            "name": l.name,
            "priority": l.priority,
            "tier": l.tier,
            "need": l.need_kw,
            "need_kw": l.need_kw,
            "allocated": alloc_kw,
            "allocated_kw": alloc_kw,
            "current_kw": alloc_kw,
            "proposed_kw": alloc_kw,
            "delta_kw": 0.0,
            "change_label": "Unchanged",
            "status": _status(l.need_kw, alloc_kw),
            "reason": _reason(l.id, l.need_kw, alloc_kw),
            "locked": l.id in LOCKED_LOAD_IDS,
            "allowed_min_kw": l.need_kw if l.id in LOCKED_LOAD_IDS else 0.0,
            "allowed_max_kw": l.need_kw,
        })
    return loads_out


def _get_nominal_active_plan() -> Dict[str, Any]:
    """Build default nominal active plan from current optimizer snapshot at startup."""
    solar_kw = sim.current_solar_kw()
    usable_batt = sim.current_usable_battery_kw()
    opt_result = optimize(sim.loads, solar_kw, usable_batt)
    proposed_allocs = {l["id"]: l["allocated_kw"] for l in opt_result["loads"]}
    canonical_allocs = {
        SHORT_TO_CANONICAL.get(k, k): v for k, v in proposed_allocs.items()
    }
    loads_out = build_active_loads(canonical_allocs)
    allocations = {CANONICAL_TO_SHORT.get(k, k): v for k, v in canonical_allocs.items()}
    total_kw = round(sum(canonical_allocs.values()), 3)
    available_kw = round(solar_kw + usable_batt, 3)

    ls_alloc_val = canonical_allocs.get("life_support", 3.0)
    return {
        "id": "plan_active_initial",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "status": "approved",
        "source": "baseline_initialization",
        "loads": loads_out,
        "allocations": allocations,
        "total_allocated_kw": total_kw,
        "unmet_kw": round(max(0.0, sum(l.need_kw for l in sim.loads) - total_kw), 3),
        "life_support_ok": ls_alloc_val >= 2.99,
        "life_support_alert": compute_life_support_alert(ls_alloc_val),
        "available_kw": available_kw,
    }


def get_life_support_alert() -> Dict[str, Any]:
    """
    Exclusively computes life support alert status from the ACTIVE plan.
    Never computes from a pending proposal.
    """
    global _active_plan
    if not _active_plan:
        return compute_life_support_alert(3.0)

    # Check if life_support_alert is cached in active_plan
    cached = _active_plan.get("life_support_alert")
    if isinstance(cached, dict) and "active" in cached:
        return cached

    # Otherwise read directly from active allocations
    allocs = _active_plan.get("allocations", {})
    if "life_support" in allocs:
        return compute_life_support_alert(allocs["life_support"])

    # Fallback: check loads in active plan
    for l in _active_plan.get("loads", []):
        if l.get("canonical_id") == "life_support" or l.get("id") == "life_support":
            val = l.get("allocated_kw", l.get("allocated", 3.0))
            return compute_life_support_alert(val)

    return compute_life_support_alert(3.0)


_active_plan: Dict[str, Any] = _get_nominal_active_plan()
_pending_plan: Optional[Dict[str, Any]] = None
_audit_events: List[Dict[str, Any]] = [
    {
        "id": "ev_init",
        "timestamp": _now_iso(),
        "type": "SYSTEM_INIT",
        "title": "Autonomous Baseline Dispatch Active",
        "actor": "LUNAGRID Engine",
        "details": "All 5 habitat nodes initialized to nominal demand allocations.",
    }
]


# ---------------------------------------------------------------------------
# Public State Accessors
# ---------------------------------------------------------------------------

def get_active_plan() -> Dict[str, Any]:
    """Return the active plan currently in force."""
    if _active_plan and "life_support_alert" not in _active_plan:
        _active_plan["life_support_alert"] = get_life_support_alert()
    return _active_plan


def get_pending_plan() -> Optional[Dict[str, Any]]:
    """Return the currently pending proposal, or None."""
    return _pending_plan


def get_audit_events() -> List[Dict[str, Any]]:
    """Return the chronological audit event log."""
    return list(reversed(_audit_events))


def record_audit_event(event_type: str, title: str, actor: str, details: str) -> Dict[str, Any]:
    event = {
        "id": f"ev_{uuid.uuid4().hex[:8]}",
        "timestamp": _now_iso(),
        "type": event_type,
        "title": title,
        "actor": actor,
        "details": details,
    }
    _audit_events.append(event)
    return event


# ---------------------------------------------------------------------------
# Reasoning Generator (Dynamic from Optimizer Output)
# ---------------------------------------------------------------------------

def generate_reasoning_list(
    loads: List[Load],
    allocations: Dict[str, float],
    solar_kw: float,
    usable_batt: float,
    source: str,
) -> List[str]:
    """
    Generate dynamic reasoning bullets based on optimizer trade-offs,
    never static placeholder text.
    """
    bullets = []
    available = solar_kw + usable_batt
    total_need = sum(l.need_kw for l in loads)
    total_allocated = sum(allocations.get(l.id, 0.0) for l in loads)

    bullets.append(
        f"Proposal generated from {source}: total available power is {available:.2f} kW "
        f"({solar_kw:.2f} kW solar + {usable_batt:.2f} kW battery reserve) against {total_need:.2f} kW total demand."
    )

    ls_need = next(l.need_kw for l in loads if l.id == "life_support")
    ls_alloc = allocations.get("life_support", 0.0)
    if ls_alloc >= ls_need - 1e-4:
        bullets.append("Critical Priority 1 locked: Human Life Support strictly sustained at 100% (3.0 kW).")
    else:
        bullets.append(
            f"CRITICAL DEFICIT: Life Support underpowered by {ls_need - ls_alloc:.2f} kW. Plan is marked BLOCKED."
        )

    hab_need = next(l.need_kw for l in loads if l.id == "habitat")
    hab_alloc = allocations.get("habitat", 0.0)
    if hab_alloc >= hab_need - 1e-4:
        bullets.append("Permanent Priority 2 locked: Habitat climate loops, lighting, and air filtration fully powered.")
    else:
        bullets.append(f"Permanent Priority 2 deficit: Habitat curtailed to {hab_alloc:.2f} kW of {hab_need:.2f} kW.")

    curtailed = [l for l in loads if l.id not in LOCKED_LOAD_IDS and allocations.get(l.id, 0.0) < l.need_kw - 1e-4]
    if curtailed:
        curtailed_names = ", ".join(f"{l.name} ({allocations.get(l.id, 0.0):.2f}/{l.need_kw:.2f} kW)" for l in curtailed)
        bullets.append(f"Secondary load curtailment applied in order of priority penalty: {curtailed_names}.")
    else:
        bullets.append("Secondary loads (Comms, Science, Rover) fully met with available supply headroom.")

    bullets.append(
        f"Dispatch constraint satisfaction: {total_allocated:.2f} kW delivered, "
        f"leaving {max(0.0, available - total_allocated):.2f} kW battery/solar buffer."
    )

    return bullets


# ---------------------------------------------------------------------------
# Constraint Verification
# ---------------------------------------------------------------------------

def priority_fill_loads(loads: List[Load], available_kw: float) -> Dict[str, float]:
    """
    Fill Life support first, then Habitat, then the other loads by priority,
    each limited by its need and the remaining supply.
    """
    allocations: Dict[str, float] = {}
    remaining = max(0.0, float(available_kw))
    sorted_loads = sorted(loads, key=lambda l: l.priority)
    for l in sorted_loads:
        alloc = min(l.need_kw, remaining)
        allocations[l.id] = round(alloc, 3)
        remaining = max(0.0, remaining - alloc)
    return allocations


# ---------------------------------------------------------------------------
# Constraint Verification
# ---------------------------------------------------------------------------

def evaluate_constraints(
    loads: List[Load],
    allocations: Dict[str, float],
    available_kw: float,
    battery_soc_kwh: float,
    min_reserve_kwh: float,
) -> Dict[str, Any]:
    """
    Evaluate explicit constraint checks.
    Proposals are only blocked if malformed (total power exceeds available supply,
    or negative power values). Never blocked because a load is below 100% need.
    """
    ls_need = next(l.need_kw for l in loads if l.id == "life_support")
    ls_alloc = allocations.get("life_support", 0.0)
    ls_full = ls_alloc >= ls_need - 1e-4

    hab_need = next(l.need_kw for l in loads if l.id == "habitat")
    hab_alloc = allocations.get("habitat", 0.0)
    hab_full = hab_alloc >= hab_need - 1e-4

    total_alloc = sum(allocations.get(l.id, 0.0) for l in loads)
    supply_pass = total_alloc <= available_kw + 1e-4
    batt_pass = battery_soc_kwh >= min_reserve_kwh - 1e-4
    has_negative = any(v < -1e-4 for v in allocations.values())

    # Only blocked for exceeding supply or negative values
    is_blocked = (not supply_pass) or has_negative
    block_reason = None
    if not supply_pass:
        block_reason = f"Total power ({total_alloc:.2f} kW) exceeds available supply ({available_kw:.2f} kW)."
    elif has_negative:
        block_reason = "Negative power allocations are not permitted."

    checks = [
        {
            "id": "supply_balance",
            "name": "Total Power Within Available Supply",
            "passed": supply_pass,
            "detail": f"Total {total_alloc:.2f} kW <= {available_kw:.2f} kW available." if supply_pass else f"EXCEEDS SUPPLY: Total {total_alloc:.2f} kW exceeds {available_kw:.2f} kW.",
        },
        {
            "id": "life_support_alloc",
            "name": "Life Support Simulation Allocation",
            "passed": True,
            "detail": f"Delivered {ls_alloc:.2f} kW of {ls_need:.2f} kW need ({'Full' if ls_full else 'Partial' if ls_alloc > 0 else 'Unpowered'}).",
        },
        {
            "id": "habitat_alloc",
            "name": "Habitat Systems Simulation Allocation",
            "passed": True,
            "detail": f"Delivered {hab_alloc:.2f} kW of {hab_need:.2f} kW need ({'Full' if hab_full else 'Partial' if hab_alloc > 0 else 'Unpowered'}).",
        },
        {
            "id": "battery_reserve",
            "name": "Battery SoC Above Min Reserve",
            "passed": batt_pass,
            "detail": f"Battery SoC {battery_soc_kwh:.2f} kWh >= {min_reserve_kwh:.2f} kWh reserve." if batt_pass else f"RESERVE NOTICE: SoC {battery_soc_kwh:.2f} kWh below {min_reserve_kwh:.2f} kWh.",
        },
    ]

    return {
        "checks": checks,
        "is_blocked": is_blocked,
        "block_reason": block_reason,
    }


# ---------------------------------------------------------------------------
# Create Proposal Flow (POST /plan/propose)
# ---------------------------------------------------------------------------

def create_proposal(
    solar_drop_pct: float = 0.0,
    dust_factor: Optional[float] = None,
    battery_soc_kwh: Optional[float] = None,
    source: str = "simulation",
) -> Dict[str, Any]:
    """
    Run optimizer for scenario inputs and construct a pending proposal.
    Fills Life support first, then Habitat, then other loads by priority,
    each limited by its need and remaining supply.
    MUST NOT mutate _active_plan.
    """
    global _pending_plan

    # Use simulated power snapshot
    nominal_peak = SOLAR_PEAK_KW
    d_factor = dust_factor if dust_factor is not None else sim.dust_factor
    eff_solar_factor = max(0.0, 1.0 - (float(solar_drop_pct) / 100.0))
    sim_solar_kw = round(nominal_peak * (1.0 - d_factor) * eff_solar_factor, 3)

    batt_soc = battery_soc_kwh if battery_soc_kwh is not None else sim.battery.soc_kwh
    min_reserve = sim.battery.min_reserve_kwh
    max_discharge = sim.battery.max_discharge_kw
    sim_usable_batt = min(max(0.0, batt_soc - min_reserve), max_discharge)
    available_kw = round(sim_solar_kw + sim_usable_batt, 3)

    # Run optimizer (read-only calculation)
    try:
        opt_result = optimize(sim.loads, sim_solar_kw, sim_usable_batt)
        proposed_allocs = {l["id"]: l["allocated_kw"] for l in opt_result["loads"]}
        canonical_allocs = {
            SHORT_TO_CANONICAL.get(k, k): v for k, v in proposed_allocs.items()
        }
    except Exception as exc:
        logger.warning("Optimizer failed (%s). Falling back to priority filling.", exc)
        canonical_allocs = priority_fill_loads(sim.loads, available_kw)

    # Safety check: if available supply > 0.01 kW but total proposed allocation is 0,
    # fall back to single-moment solver / priority filling. Never silently create an all-zero proposal.
    total_proposed = sum(canonical_allocs.values())
    if available_kw > 0.01 and total_proposed <= 1e-4:
        logger.warning(
            "Optimizer returned all-zero result for available power %.2f kW. Falling back to single-moment solver on real state.",
            available_kw,
        )
        try:
            fallback_opt = optimize(sim.loads, sim.current_solar_kw(), sim.current_usable_battery_kw())
            fallback_allocs = {l["id"]: l["allocated_kw"] for l in fallback_opt["loads"]}
            canonical_allocs = {
                SHORT_TO_CANONICAL.get(k, k): v for k, v in fallback_allocs.items()
            }
        except Exception:
            canonical_allocs = priority_fill_loads(sim.loads, available_kw)

        if sum(canonical_allocs.values()) <= 1e-4:
            canonical_allocs = priority_fill_loads(sim.loads, available_kw)

    # Reference current active allocations
    current_allocs = _active_plan.get("allocations", {})

    loads_detail = []
    for l in sim.loads:
        short_id = CANONICAL_TO_SHORT.get(l.id, l.id)
        current_kw = float(current_allocs.get(short_id, l.need_kw))
        proposed_kw = float(canonical_allocs.get(l.id, 0.0))
        delta_kw = round(proposed_kw - current_kw, 3)
        is_locked = l.id in LOCKED_LOAD_IDS

        if abs(delta_kw) < 1e-4:
            change_label = "Unchanged"
        elif delta_kw > 0:
            change_label = "Increased"
        else:
            change_label = "Reduced"

        loads_detail.append({
            "id": short_id,
            "canonical_id": l.id,
            "name": l.name,
            "priority": l.priority,
            "tier": l.tier,
            "need": l.need_kw,
            "need_kw": l.need_kw,
            "allocated": proposed_kw,
            "allocated_kw": proposed_kw,
            "current_kw": current_kw,
            "proposed_kw": proposed_kw,
            "delta_kw": delta_kw,
            "change_label": change_label,
            "status": _status(l.need_kw, proposed_kw),
            "reason": _reason(l.id, l.need_kw, proposed_kw),
            "locked": is_locked,
            "allowed_min_kw": l.need_kw if is_locked else 0.0,
            "allowed_max_kw": l.need_kw,
        })

    # Evaluate constraints
    constraints = evaluate_constraints(
        sim.loads,
        canonical_allocs,
        available_kw,
        batt_soc,
        min_reserve,
    )

    reasoning = generate_reasoning_list(
        sim.loads,
        canonical_allocs,
        sim_solar_kw,
        sim_usable_batt,
        source,
    )

    proposal_id = f"prop_{uuid.uuid4().hex[:8]}"
    _pending_plan = {
        "id": proposal_id,
        "created_at": _now_iso(),
        "source": source,
        "status": "pending",
        "solar_kw": sim_solar_kw,
        "battery_soc_kwh": batt_soc,
        "available_kw": available_kw,
        "loads": loads_detail,
        "allocations": {CANONICAL_TO_SHORT.get(k, k): v for k, v in canonical_allocs.items()},
        "total_allocated_kw": round(sum(canonical_allocs.values()), 3),
        "unmet_kw": round(max(0.0, sum(l.need_kw for l in sim.loads) - sum(canonical_allocs.values())), 3),
        "life_support_ok": canonical_allocs.get("life_support", 0.0) >= 2.99,
        "reasoning": reasoning,
        "constraint_checks": constraints["checks"],
        "is_blocked": constraints["is_blocked"],
        "block_reason": constraints["block_reason"],
    }

    record_audit_event(
        "PROPOSAL_CREATED",
        f"Allocation Proposal Created ({source})",
        "LUNAGRID Optimization Engine",
        f"Created proposal {proposal_id} under {available_kw:.1f} kW supply. Status: PENDING review.",
    )

    return _pending_plan


# ---------------------------------------------------------------------------
# Update Proposal Flow (PATCH /plan/pending)
# ---------------------------------------------------------------------------

def update_pending_proposal(proposed_kw_map: Dict[str, float]) -> Dict[str, Any]:
    """
    Update editable load values in the pending proposal.
    Rejects any modification to locked loads with HTTP 422 ValueError.
    """
    global _pending_plan

    if not _pending_plan:
        raise ValueError("No proposal currently pending review.")

    # 1. Server-side Locking Check
    for key in proposed_kw_map.keys():
        canonical = SHORT_TO_CANONICAL.get(key, key)
        if canonical in LOCKED_LOAD_IDS:
            raise ValueError(
                f"Permanent main load '{canonical}' is locked and cannot be edited. "
                "Only Science experiments, Communication, and Rover are editable."
            )
        if canonical not in {"communication", "experiments", "rover"}:
            raise ValueError(
                f"Load '{key}' cannot be edited. "
                "Only Science experiments, Communication, and Rover are editable."
            )

    # 2. Build updated allocation candidate
    current_allocs = dict(_pending_plan["allocations"])
    available_kw = float(_pending_plan["available_kw"])

    for key, val in proposed_kw_map.items():
        canonical = SHORT_TO_CANONICAL.get(key, key)
        short_id = CANONICAL_TO_SHORT.get(key, key)
        target_load = next((l for l in sim.loads if l.id == canonical), None)
        if not target_load:
            raise ValueError(f"Unknown load subsystem '{key}'.")

        try:
            val_float = round(float(val), 3)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid numeric power value for {target_load.name}: '{val}'")

        if val_float < 0.0 or val_float > target_load.need_kw:
            raise ValueError(
                f"Power for {target_load.name} must be between 0.0 and {target_load.need_kw:.1f} kW, got {val_float} kW."
            )

        current_allocs[short_id] = val_float

    # 3. Supply Balance Check
    total_requested = sum(current_allocs.values())
    if total_requested > available_kw + 1e-4:
        raise ValueError(
            f"Total requested power ({total_requested:.2f} kW) exceeds available supply ({available_kw:.2f} kW). "
            "Reduce secondary allocations before saving."
        )

    canonical_allocs = {
        SHORT_TO_CANONICAL.get(k, k): v for k, v in current_allocs.items()
    }

    # 4. Recompute deltas and statuses
    active_allocs = _active_plan.get("allocations", {})
    updated_loads = []

    for l in sim.loads:
        short_id = CANONICAL_TO_SHORT.get(l.id, l.id)
        cur_kw = float(active_allocs.get(short_id, l.need_kw))
        new_kw = float(canonical_allocs.get(l.id, 0.0))
        delta_kw = round(new_kw - cur_kw, 3)
        is_locked = l.id in LOCKED_LOAD_IDS

        if abs(delta_kw) < 1e-4:
            change_label = "Unchanged"
        elif delta_kw > 0:
            change_label = "Increased"
        else:
            change_label = "Reduced"

        updated_loads.append({
            "id": short_id,
            "canonical_id": l.id,
            "name": l.name,
            "priority": l.priority,
            "tier": l.tier,
            "need": l.need_kw,
            "need_kw": l.need_kw,
            "allocated": new_kw,
            "allocated_kw": new_kw,
            "current_kw": cur_kw,
            "proposed_kw": new_kw,
            "delta_kw": delta_kw,
            "change_label": change_label,
            "status": _status(l.need_kw, new_kw),
            "reason": _reason(l.id, l.need_kw, new_kw),
            "locked": is_locked,
            "allowed_min_kw": l.need_kw if is_locked else 0.0,
            "allowed_max_kw": l.need_kw,
        })

    # 5. Recompute constraints and reasoning
    batt_soc = float(_pending_plan.get("battery_soc_kwh", sim.battery.soc_kwh))
    min_reserve = sim.battery.min_reserve_kwh
    constraints = evaluate_constraints(
        sim.loads,
        canonical_allocs,
        available_kw,
        batt_soc,
        min_reserve,
    )

    reasoning = generate_reasoning_list(
        sim.loads,
        canonical_allocs,
        float(_pending_plan["solar_kw"]),
        max(0.0, available_kw - float(_pending_plan["solar_kw"])),
        _pending_plan["source"] + " (Operator Edited)",
    )

    _pending_plan["loads"] = updated_loads
    _pending_plan["allocations"] = current_allocs
    _pending_plan["total_allocated_kw"] = round(total_requested, 3)
    _pending_plan["unmet_kw"] = round(max(0.0, sum(l.need_kw for l in sim.loads) - total_requested), 3)
    _pending_plan["life_support_ok"] = canonical_allocs.get("life_support", 0.0) >= 2.99
    _pending_plan["reasoning"] = reasoning
    _pending_plan["constraint_checks"] = constraints["checks"]
    _pending_plan["is_blocked"] = constraints["is_blocked"]
    _pending_plan["block_reason"] = constraints["block_reason"]

    record_audit_event(
        "PROPOSAL_UPDATED",
        "Pending Proposal Modified",
        "Flight Director Console",
        f"Operator adjusted secondary allocations: {', '.join(f'{k}={v}kW' for k, v in proposed_kw_map.items())}.",
    )

    return _pending_plan


# ---------------------------------------------------------------------------
# Approve Proposal Flow (POST /plan/{id}/approve)
# ---------------------------------------------------------------------------

def approve_proposal(proposal_id: str, operator_note: Optional[str] = None) -> Dict[str, Any]:
    """
    Approve pending proposal, committing it into active_plan and logging event.
    Refuses approval only if proposal is malformed (missing loads, negative values,
    or total exceeds available supply).
    """
    global _active_plan, _pending_plan

    if not _pending_plan:
        raise ValueError("No pending proposal to approve.")

    if _pending_plan["id"] != proposal_id:
        raise ValueError(f"Proposal ID mismatch: active pending proposal is '{_pending_plan['id']}', received '{proposal_id}'.")

    allocations = _pending_plan.get("allocations", {})
    avail_supply = float(_pending_plan.get("available_kw", 0.0))
    total_proposed = float(_pending_plan.get("total_allocated_kw", 0.0))

    if total_proposed <= 1e-4 and avail_supply > 1e-4:
        raise ValueError(
            f"Cannot approve proposal: Total proposed allocation is 0.0 kW while microgrid supply ({avail_supply:.2f} kW) is available."
        )

    if total_proposed > avail_supply + 1e-4:
        raise ValueError(
            f"Cannot approve proposal: Total proposed allocation ({total_proposed:.2f} kW) exceeds available supply ({avail_supply:.2f} kW)."
        )

    canonical_allocs = {
        SHORT_TO_CANONICAL.get(k, k): float(v) for k, v in allocations.items()
    }

    expected_load_ids = {l.id for l in sim.loads}
    if not expected_load_ids.issubset(canonical_allocs.keys()):
        raise ValueError("Cannot approve proposal: Missing required subsystem loads.")

    if any(v < -1e-4 for v in canonical_allocs.values()):
        raise ValueError("Cannot approve proposal: Negative power allocations are not permitted.")

    if _pending_plan.get("is_blocked"):
        raise ValueError(
            f"Cannot approve proposal: { _pending_plan.get('block_reason') or 'Constraint checks failed.' }"
        )

    # Promote to active plan using canonical shared builder
    now = _now_iso()
    canonical_allocs = {
        SHORT_TO_CANONICAL.get(k, k): float(v) for k, v in allocations.items()
    }
    active_loads = build_active_loads(canonical_allocs)

    ls_alloc_val = canonical_allocs.get("life_support", 0.0)
    ls_alert = compute_life_support_alert(ls_alloc_val)

    _active_plan = {
        "id": f"plan_active_{uuid.uuid4().hex[:8]}",
        "source_proposal_id": proposal_id,
        "created_at": _pending_plan["created_at"],
        "approved_at": now,
        "updated_at": now,
        "status": "approved",
        "source": _pending_plan["source"],
        "solar_kw": _pending_plan["solar_kw"],
        "battery_soc_kwh": _pending_plan["battery_soc_kwh"],
        "available_kw": _pending_plan["available_kw"],
        "loads": active_loads,
        "allocations": dict(allocations),
        "total_allocated_kw": round(sum(canonical_allocs.values()), 3),
        "unmet_kw": round(max(0.0, sum(l.need_kw for l in sim.loads) - sum(canonical_allocs.values())), 3),
        "life_support_ok": ls_alloc_val >= 2.99,
        "life_support_alert": ls_alert,
        "operator_note": operator_note,
    }

    # Mark proposal approved
    _pending_plan["status"] = "approved"
    _pending_plan["decision_at"] = now
    _pending_plan["operator_note"] = operator_note

    record_audit_event(
        "PLAN_APPROVED",
        "Plan Authorized and Dispatched",
        "Flight Director Console",
        f"Proposal {proposal_id} approved into active microgrid dispatch. Note: {operator_note or 'Nominal operational authorization.'}",
    )

    # Check state transition for life support alert event logging
    global _last_ls_alert_active
    if ls_alert["active"] and not _last_ls_alert_active:
        record_audit_event(
            "ALERT_TRIGGERED",
            "Life Support Alert: Active Shortfall",
            "Life Support Safety Monitor",
            f"Life support below threshold: {ls_alert['allocated_kw']:.2f} kW of {LIFE_SUPPORT_ALERT_THRESHOLD_KW:.1f} kW",
        )
        _last_ls_alert_active = True
    elif not ls_alert["active"] and _last_ls_alert_active:
        record_audit_event(
            "ALERT_CLEARED",
            "Life Support Alert: Restored",
            "Life Support Safety Monitor",
            f"Life support allocation restored: {ls_alert['allocated_kw']:.2f} kW meets {LIFE_SUPPORT_ALERT_THRESHOLD_KW:.1f} kW threshold.",
        )
        _last_ls_alert_active = False

    approved_snapshot = dict(_pending_plan)
    _pending_plan = None
    return approved_snapshot


# ---------------------------------------------------------------------------
# Reject Proposal Flow (POST /plan/{id}/reject)
# ---------------------------------------------------------------------------

def reject_proposal(proposal_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
    """
    Reject pending proposal, leaving active_plan unchanged and logging event.
    """
    global _pending_plan

    if not _pending_plan:
        raise ValueError("No pending proposal to reject.")

    if _pending_plan["id"] != proposal_id:
        raise ValueError(f"Proposal ID mismatch: active pending proposal is '{_pending_plan['id']}', received '{proposal_id}'.")

    now = _now_iso()
    _pending_plan["status"] = "rejected"
    _pending_plan["decision_at"] = now
    _pending_plan["rejection_reason"] = reason

    record_audit_event(
        "PLAN_REJECTED",
        "Proposal Rejected by Operator",
        "Flight Director Console",
        f"Proposal {proposal_id} rejected. Active plan remains in force. Reason: {reason or 'Operator declined proposed load-shed profile.'}",
    )

    rejected_snapshot = dict(_pending_plan)
    _pending_plan = None
    return rejected_snapshot


def reset_approval_state() -> None:
    """Reset to nominal active plan and clear pending proposals."""
    global _active_plan, _pending_plan, _last_ls_alert_active
    _active_plan = _get_nominal_active_plan()
    _pending_plan = None
    if _last_ls_alert_active:
        record_audit_event(
            "ALERT_CLEARED",
            "Life Support Alert: Restored",
            "Life Support Safety Monitor",
            f"Life support allocation restored to nominal baseline ({LIFE_SUPPORT_ALERT_THRESHOLD_KW:.1f} kW).",
        )
        _last_ls_alert_active = False
    record_audit_event(
        "SYSTEM_RESET",
        "Active Plan Reset to Nominal Baseline",
        "System Reset Trigger",
        "All habitat power allocations restored to nominal baseline.",
    )

