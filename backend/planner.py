import logging
from typing import Dict, List, Any, Optional, Tuple
import pulp
from simulator import sim as default_sim, Simulator, SIM_HOUR, LOAD_ID_ALIAS
from optimizer import _status, optimize
from forecast import generate_forecast

logger = logging.getLogger("lunagrid.planner")

def plan_horizon(
    sim: Optional[Simulator] = None,
    forecast: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    active_sim = sim if sim is not None else default_sim
    if forecast is None:
        forecast = generate_forecast(active_sim)

    T = len(forecast)
    loads = active_sim.loads
    current_soc = float(active_sim.battery.soc_kwh)
    capacity = float(active_sim.battery.capacity_kwh)
    min_reserve = float(active_sim.battery.min_reserve_kwh)
    max_discharge = float(active_sim.battery.max_discharge_kw)

    effective_min_reserve = min(min_reserve, current_soc)

    try:
        prob = pulp.LpProblem("multi_period_dispatch", pulp.LpMinimize)

        # Variables
        P = {
            (l.id, t): pulp.LpVariable(f"P_{l.id}_{t}", lowBound=0.0, upBound=l.need_kw)
            for l in loads
            for t in range(T)
        }
        D = {
            t: pulp.LpVariable(f"D_{t}", lowBound=0.0, upBound=max_discharge)
            for t in range(T)
        }
        C = {
            t: pulp.LpVariable(f"C_{t}", lowBound=0.0, upBound=max(0.0, forecast[t]["solar_kw"]))
            for t in range(T)
        }
        SOC = {
            t: pulp.LpVariable(
                f"SOC_{t}",
                lowBound=effective_min_reserve,
                upBound=capacity
            )
            for t in range(T + 1)
        }

        # Objective: minimise weighted unmet + tie-breakers
        prob += (
            pulp.lpSum(l.weight * (l.need_kw - P[l.id, t]) for l in loads for t in range(T))
            + 1e-4 * pulp.lpSum(D[t] for t in range(T))
            - 1e-5 * pulp.lpSum(C[t] for t in range(T))
        ), "objective"

        # Constraints
        prob += SOC[0] == current_soc, "init_soc"

        for t in range(T):
            solar_t = float(forecast[t]["solar_kw"])
            prob += SOC[t + 1] == SOC[t] - D[t] + C[t], f"soc_dyn_{t}"
            prob += (
                pulp.lpSum(P[l.id, t] for l in loads) + C[t] <= solar_t + D[t],
                f"power_balance_{t}",
            )

        status_code = prob.solve(pulp.PULP_CBC_CMD(msg=0))
        if pulp.LpStatus[status_code] != "Optimal":
            raise RuntimeError(f"Solver returned non-optimal status: {pulp.LpStatus[status_code]}")

        # Extract solution
        p_alloc = {
            t: {l.id: round(max(0.0, pulp.value(P[l.id, t]) or 0.0), 3) for l in loads}
            for t in range(T)
        }
        d_val = [round(max(0.0, pulp.value(D[t]) or 0.0), 3) for t in range(T)]
        c_val = [round(max(0.0, pulp.value(C[t]) or 0.0), 3) for t in range(T)]
        soc_val = [round(max(effective_min_reserve, pulp.value(SOC[t]) or effective_min_reserve), 3) for t in range(T)]

    except Exception as exc:
        logger.warning(f"PuLP multi-period solver failed: {exc}. Falling back to sequential optimizer.")
        # Fallback
        p_alloc = {}
        d_val = []
        c_val = []
        soc_val = []
        sim_soc = current_soc

        for t in range(T):
            solar_t = float(forecast[t]["solar_kw"])
            usable_batt = min(max_discharge, max(0.0, sim_soc - min_reserve))
            res = optimize(loads, solar_t, usable_batt)
            p_alloc[t] = {LOAD_ID_ALIAS.get(ld["id"], ld["id"]): ld["allocated_kw"] for ld in res["loads"]}
            total_alloc = sum(p_alloc[t].values())
            draw = max(0.0, total_alloc - solar_t)
            charge = min(max(0.0, solar_t - total_alloc), capacity - sim_soc)
            d_val.append(round(draw, 3))
            c_val.append(round(charge, 3))
            soc_val.append(round(sim_soc, 3))
            sim_soc = max(effective_min_reserve, min(capacity, sim_soc - draw + charge))

    # Build per-hour schedule
    hourly_plan = []
    ls_at_risk_hour = None
    sg_protected_hours = 0
    sg_total_unmet = 0.0

    for t in range(T):
        f_entry = forecast[t]
        s_kw = float(f_entry["solar_kw"])
        d_kw = d_val[t]
        c_kw = c_val[t]
        soc_t = soc_val[t]
        allocs = p_alloc[t]

        loads_detail = []
        t_allocated = 0.0
        t_demand = 0.0
        t_unmet = 0.0

        for l in loads:
            alloc_kw = allocs.get(l.id, allocs.get(LOAD_ID_ALIAS.get(l.id, l.id), 0.0))
            need = l.need_kw
            unmet = max(0.0, need - alloc_kw)
            t_allocated += alloc_kw
            t_demand += need
            t_unmet += unmet

            loads_detail.append({
                "id": LOAD_ID_ALIAS.get(l.id, l.id),
                "name": l.name,
                "priority": l.priority,
                "tier": l.tier,
                "need_kw": need,
                "allocated_kw": round(alloc_kw, 3),
                "status": _status(need, alloc_kw),
            })

        ls_need = next(l.need_kw for l in loads if l.id == "life_support")
        ls_alloc = allocs.get("life_support", 0.0)
        ls_ok = ls_alloc >= ls_need - 1e-4

        if ls_ok:
            sg_protected_hours += 1
        elif ls_at_risk_hour is None:
            ls_at_risk_hour = t

        sg_total_unmet += t_unmet

        short_allocs = {LOAD_ID_ALIAS.get(k, k): v for k, v in allocs.items()}

        hourly_plan.append({
            "hour": t,
            "clock_hour": f_entry.get("clock_hour", (SIM_HOUR + t) % 24),
            "solar_kw": s_kw,
            "battery_discharge_kw": d_kw,
            "battery_charge_kw": c_kw,
            "soc_kwh": soc_t,
            "total_demand_kw": round(t_demand, 3),
            "total_allocated_kw": round(t_allocated, 3),
            "unmet_kw": round(t_unmet, 3),
            "life_support_ok": ls_ok,
            "loads": loads_detail,
            "allocations": short_allocs,
        })

    # Naive baseline policy simulation
    # Spend battery as early as possible to cover total demand
    naive_soc = current_soc
    naive_protected_hours = 0
    naive_at_risk_hour = None
    naive_total_unmet = 0.0

    for t in range(T):
        s_kw = float(forecast[t]["solar_kw"])
        usable_b = min(max_discharge, max(0.0, naive_soc - min_reserve))
        demand = 8.0  # sum of all loads
        deficit = max(0.0, demand - s_kw)
        draw = min(usable_b, deficit)
        surplus = max(0.0, s_kw - demand)
        charge = min(surplus, capacity - naive_soc)
        avail = s_kw + draw

        # Water-fall check for life support (priority 1, need 3.0)
        ls_ok = avail >= 3.0 - 1e-4
        if ls_ok:
            naive_protected_hours += 1
        elif naive_at_risk_hour is None:
            naive_at_risk_hour = t

        naive_total_unmet += max(0.0, demand - avail)
        naive_soc = max(min_reserve, min(capacity, naive_soc - draw + charge))

    return {
        "plan": hourly_plan,
        "first_hour_life_support_at_risk": ls_at_risk_hour,
        "total_unmet_kwh": round(sg_total_unmet, 2),
        "hours_life_support_protected": sg_protected_hours,
        "battery": {
            "capacity_kwh": capacity,
            "min_reserve_kwh": min_reserve,
            "current_soc_kwh": current_soc,
            "max_discharge_kw": max_discharge,
        },
        "comparison": {
            "naive": {
                "name": "Naive battery use",
                "hours_life_support_protected": naive_protected_hours,
                "first_hour_life_support_at_risk": naive_at_risk_hour,
                "total_unmet_kwh": round(naive_total_unmet, 2),
            },
            "spacegrid": {
                "name": "LUNAGRID plan",
                "hours_life_support_protected": sg_protected_hours,
                "first_hour_life_support_at_risk": ls_at_risk_hour,
                "total_unmet_kwh": round(sg_total_unmet, 2),
            },
            "hours_saved": max(0, sg_protected_hours - naive_protected_hours),
        },
    }
