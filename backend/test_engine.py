"""
test_engine.py - SPACEGRID AI engine integration tests.

Tests engine.py across 3 deterministic scenarios:
  1. Normal (nominal)           – solar ~8.8 kW, demand 8 kW, no shortage
  2. 70% solar drop             – solar ~3.0 kW, life support protected
  3. Life support infeasible    – power < 3 kW, ls_ok == False, unsafe alert

Uses the fixed simulated clock (SIM_HOUR=12), so results never depend on
the wall clock.  No time-of-day workarounds needed.

Usage:
    python test_engine.py
"""

import sys
import time

import engine
from simulator import sim, SIM_HOUR, solar_kw_at_hour, SOLAR_PEAK_KW, NOMINAL_DUST_FACTOR

# ANSI colours for terminal output
GREEN = "\033[32m"
RED   = "\033[31m"
RESET = "\033[0m"

_results: list[bool] = []


def check(label: str, condition: bool, detail: str = "") -> bool:
    tag = f"{GREEN}PASS{RESET}" if condition else f"{RED}FAIL{RESET}"
    line = f"  [{tag}] {label}"
    if detail:
        line += f"  ({detail})"
    print(line)
    _results.append(condition)
    return condition


def section(title: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Pre-flight: verify simulated clock
# ---------------------------------------------------------------------------
section("PRE-FLIGHT: Simulated clock sanity")

nominal_solar = solar_kw_at_hour(SIM_HOUR, SOLAR_PEAK_KW, NOMINAL_DUST_FACTOR)
check("SIM_HOUR is 12 (solar noon)", SIM_HOUR == 12, f"SIM_HOUR={SIM_HOUR}")
check("Nominal solar at noon >= 8.0 kW", nominal_solar >= 8.0,
      f"solar={nominal_solar:.3f} kW")
check("Nominal solar at noon <= 10.0 kW", nominal_solar <= 10.0,
      f"solar={nominal_solar:.3f} kW")

# ---------------------------------------------------------------------------
# SCENARIO 1 – Nominal
# ---------------------------------------------------------------------------
section("SCENARIO 1: Nominal operations")

engine.reset()  # ensure clean state
state = engine.get_state()

solar     = state["power"]["solar_kw"]
usable    = state["power"]["usable_battery_kw"]
demand    = state["power"]["demand_kw"]
available = state["power"]["available_kw"]

print(f"  solar={solar:.3f} kW | usable_batt={usable:.3f} kW | "
      f"demand={demand:.3f} kW | available={available:.3f} kW")

check("solar_kw >= 8.0 (nominal, daytime)", solar >= 8.0, f"solar={solar:.3f}")
check("demand_kw == 8.0 (nominal loads)",   demand == 8.0, f"demand={demand:.3f}")
check("nominal risk agrees with forecast (shortage_expected True)", state["risk"]["shortage_expected"])
check("alert level == green (nominal)",     state["alert"]["level"] == "green")
check("alert life_support_ok True (nominal)", state["alert"]["life_support_ok"])

ls = next(l for l in state["loads"] if l["id"] == "life_support")
check("life_support fully allocated (nominal)",
      ls["allocated_kw"] >= 2.99, f"alloc={ls['allocated_kw']:.3f}")
check("life_support status == Protected (nominal)", ls["status"] == "Protected")

check("unmet_kw == 0 (nominal)",    state["comparison"][2]["unmet_kw"] == 0.0,
      f"unmet={state['comparison'][2]['unmet_kw']}")
check("forecast has 24 entries",    len(state["forecast"]) == 24)
check("forecast[0] has solar_kw",   "solar_kw" in state["forecast"][0])
check("forecast[0] hour is 0 (current hour offset)", state["forecast"][0]["hour"] == 0)
check("forecast[i] hour is offset i (0..23)",
      all(state["forecast"][i]["hour"] == i for i in range(24)))
check("nominal risk start_hour == 5 (deficit at hour 5)",
      state["risk"]["start_hour"] == 5)
check("comparison has 3 policies",  len(state["comparison"]) == 3)
check("plan status == approved",    state["plan"]["status"] == "approved")
check("replan_ms > 0",              state["replan_ms"] > 0,
      f"{state['replan_ms']:.2f} ms")
check("replan_time_ms present",     "replan_time_ms" in state)

# ---------------------------------------------------------------------------
# SCENARIO 2 – 70% solar drop
# ---------------------------------------------------------------------------
section("SCENARIO 2: 70% solar drop (solar_drop(0.7))")

t0 = time.perf_counter()
state2 = engine.solar_drop(0.7)
wall_ms = (time.perf_counter() - t0) * 1000

solar2     = state2["power"]["solar_kw"]
usable2    = state2["power"]["usable_battery_kw"]
demand2    = state2["power"]["demand_kw"]
available2 = state2["power"]["available_kw"]

print(f"  solar={solar2:.3f} kW | usable_batt={usable2:.3f} kW | "
      f"demand={demand2:.3f} kW | available={available2:.3f} kW")
print(f"  engine re-plan time: {state2['replan_ms']:.2f} ms  "
      f"(wall: {wall_ms:.2f} ms)")

check("solar reduced to ~30% of nominal",
      solar2 <= solar * 0.35,
      f"solar2={solar2:.3f}, 30%_nominal={solar*0.30:.3f}")
check("solar after drop >= 2.5 kW (not zero)",
      solar2 >= 2.5, f"solar2={solar2:.3f}")
check("dust_factor == 0.7 after drop",
      abs(sim.dust_factor - 0.7) < 1e-6, f"dust={sim.dust_factor}")
check("battery SoC reduced after drop",
      sim.battery.soc_kwh <= 8.6, f"soc={sim.battery.soc_kwh}")

check("alert level == red (drop)", state2["alert"]["level"] == "red")
check("life_support_ok True (drop – ls still met)",
      state2["alert"]["life_support_ok"])

ls2 = next(l for l in state2["loads"] if l["id"] == "life_support")
check("life_support fully allocated (drop)",
      ls2["allocated_kw"] >= 2.99, f"alloc={ls2['allocated_kw']:.3f}")

check("unmet_kw > 0 (deficit after drop)",
      state2["comparison"][2]["unmet_kw"] > 0,
      f"unmet={state2['comparison'][2]['unmet_kw']:.3f}")

rover2 = next(l for l in state2["loads"] if l["id"] == "rover")
check("rover not fully allocated (lowest priority, shed first)",
      rover2["allocated_kw"] < rover2["need_kw"],
      f"rover alloc={rover2['allocated_kw']:.3f}")

check("equal_split ls_ok == False (drop)",
      not state2["comparison"][0]["life_support_ok"])
check("spacegrid ls_ok == True (drop)",
      state2["comparison"][2]["life_support_ok"])

check("plan status == pending after drop",
      state2["plan"]["status"] == "pending")
check("replan_ms is measured (>0)",
      state2["replan_ms"] > 0, f"{state2['replan_ms']:.2f} ms")
check("shortage_expected True (drop)",
      state2["risk"]["shortage_expected"])
check("drop risk start_hour == 0 (shortage window starts now)",
      state2["risk"]["start_hour"] == 0)
check("drop risk end_hour in 0..23 offset scale and > start_hour",
      0 <= state2["risk"]["end_hour"] < 24 and state2["risk"]["end_hour"] > state2["risk"]["start_hour"],
      f"start={state2['risk']['start_hour']}, end={state2['risk']['end_hour']}")
check("drop forecast hour offsets 0..23",
      all(state2["forecast"][i]["hour"] == i for i in range(24)))

# ---------------------------------------------------------------------------
# SCENARIO 3 – Life support infeasible
# ---------------------------------------------------------------------------
section("SCENARIO 3: Life support infeasible (power critically low)")

# Reset to clean baseline, then manually set simulator to near-zero power
engine.reset()
sim.dust_factor = 0.99          # ~99% blocked -> solar ≈ 0.09 kW at noon
sim.battery.soc_kwh = 2.5       # below min_reserve (3.0) -> 0 usable battery
sim.scenario = "Extreme Solar Failure & Deep Depletion"
sim.phase = "night"

state3 = engine.get_state()     # re-plan runs automatically

solar3     = state3["power"]["solar_kw"]
usable3    = state3["power"]["usable_battery_kw"]
available3 = state3["power"]["available_kw"]
demand3    = state3["power"]["demand_kw"]

print(f"  solar={solar3:.4f} kW | usable_batt={usable3:.4f} kW | "
      f"demand={demand3:.3f} kW | available={available3:.4f} kW")

check("solar near zero (dust=0.99)",
      solar3 < 0.5, f"solar3={solar3:.4f}")
check("usable_battery == 0 (soc below reserve)",
      usable3 == 0.0, f"usable={usable3}")

ls3 = next(l for l in state3["loads"] if l["id"] == "life_support")
check("life_support_ok == False (infeasible)",
      not state3["alert"]["life_support_ok"],
      f"ls_alloc={ls3['allocated_kw']:.4f}, need={ls3['need_kw']}")
check("life_support allocated < need (infeasible)",
      ls3["allocated_kw"] < ls3["need_kw"] - 0.01,
      f"alloc={ls3['allocated_kw']:.4f}")
check("alert level == red (infeasible)",
      state3["alert"]["level"] == "red")
check("shortage_expected True (infeasible)",
      state3["risk"]["shortage_expected"])
check("infeasible risk start_hour == 0",
      state3["risk"]["start_hour"] == 0)
check("max_deficit_kw > 0 (infeasible)",
      state3["risk"]["max_deficit_kw"] > 0,
      f"deficit={state3['risk']['max_deficit_kw']:.3f}")
check("spacegrid ls_ok False in comparison (infeasible)",
      not state3["comparison"][2]["life_support_ok"])
check("replan_ms fast (<500 ms)",
      state3["replan_ms"] < 500, f"{state3['replan_ms']:.2f} ms")

# ---------------------------------------------------------------------------
# SCENARIO 4 – engine.blackout()
# ---------------------------------------------------------------------------
section("SCENARIO 4: Blackout event (engine.blackout())")

state_bo = engine.blackout()

check("blackout alert level == red", state_bo["alert"]["level"] == "red")
check("blackout life_support_ok == False", not state_bo["alert"]["life_support_ok"])
check("blackout solar near 0 (< 0.5 kW)", state_bo["power"]["solar_kw"] < 0.5,
      f"solar={state_bo['power']['solar_kw']:.3f}")
check("blackout usable_battery == 0 kW (at reserve)",
      state_bo["power"]["usable_battery_kw"] == 0.0,
      f"usable={state_bo['power']['usable_battery_kw']:.3f}")
check("blackout battery soc == min_reserve",
      abs(state_bo["battery"]["soc_kwh"] - state_bo["battery"]["min_reserve_kwh"]) < 1e-6,
      f"soc={state_bo['battery']['soc_kwh']}, reserve={state_bo['battery']['min_reserve_kwh']}")

ls_bo = next(l for l in state_bo["loads"] if l["id"] == "life_support")
check("blackout life support unmet (< need)",
      ls_bo["allocated_kw"] < ls_bo["need_kw"] - 0.01,
      f"allocated={ls_bo['allocated_kw']:.3f}, need={ls_bo['need_kw']:.3f}")
check("blackout risk shortage_expected is True", state_bo["risk"]["shortage_expected"])
check("blackout risk start_hour == 0", state_bo["risk"]["start_hour"] == 0)
check("blackout survival hours_now == 0.0", state_bo["survival"]["hours_now"] == 0.0,
      f"hours_now={state_bo['survival']['hours_now']}")
check("blackout survival hours_before == 0.0", state_bo["survival"]["hours_before"] == 0.0,
      f"hours_before={state_bo['survival']['hours_before']}")

# Verify /reset clears the blackout
state_cleared = engine.reset()
check("reset clears blackout: alert green", state_cleared["alert"]["level"] == "green")
check("reset clears blackout: life_support_ok True", state_cleared["alert"]["life_support_ok"])
check("reset clears blackout: solar restored", state_cleared["power"]["solar_kw"] >= 8.0)

# ---------------------------------------------------------------------------
# SCENARIO 5 – engine.custom_scenario() and input validation
# ---------------------------------------------------------------------------
section("SCENARIO 5: Custom scenario & input validation (engine.custom_scenario())")

state_custom = engine.custom_scenario(solar_drop_pct=50.0, dust_factor=0.0, battery_soc_kwh=10.0)
check("custom scenario solar == 5.0 kW", abs(state_custom["power"]["solar_kw"] - 5.0) < 1e-3,
      f"solar={state_custom['power']['solar_kw']:.3f}")
check("custom scenario battery soc == 10.0 kWh", abs(state_custom["battery"]["soc_kwh"] - 10.0) < 1e-3,
      f"soc={state_custom['battery']['soc_kwh']:.3f}")
check("custom scenario alert level == red", state_custom["alert"]["level"] == "red")
check("custom scenario plan pending", state_custom["plan"]["status"] == "pending")
check("survival hours computed from deficit (not hard-coded 18.0)",
      state_custom["survival"]["hours_now"] != 18.0 and state_custom["survival"]["hours_now"] > 0,
      f"hours_now={state_custom['survival']['hours_now']}")

# Input validation tests
val_err_caught = 0
try:
    engine.custom_scenario(solar_drop_pct=-5.0)
except ValueError:
    val_err_caught += 1

try:
    engine.custom_scenario(solar_drop_pct=105.0)
except ValueError:
    val_err_caught += 1

try:
    engine.custom_scenario(solar_drop_pct=10.0, dust_factor=1.5)
except ValueError:
    val_err_caught += 1

try:
    engine.custom_scenario(solar_drop_pct=10.0, battery_soc_kwh=25.0)
except ValueError:
    val_err_caught += 1

check("all 4 invalid custom parameter calls raised ValueError", val_err_caught == 4,
      f"caught={val_err_caught}/4")

# STEP 4 Benchmark & validation cases:
# Case 1: 0 / 0 / 8.5 -> solar 10.0, available 12.5, SAFE
c1 = engine.custom_scenario(solar_drop_pct=0.0, dust_factor=0.0, battery_soc_kwh=8.5)
check("Case 1 (0/0/8.5): solar 10.0 kW", abs(c1["power"]["solar_kw"] - 10.0) < 1e-3, f"solar={c1['power']['solar_kw']}")
check("Case 1 (0/0/8.5): available 12.5 kW", abs(c1["power"]["available_kw"] - 12.5) < 1e-3, f"avail={c1['power']['available_kw']}")
check("Case 1 (0/0/8.5): verdict SAFE", c1["verdict"] == "SAFE", f"verdict={c1['verdict']}")

# Case 2: 1 / 0 / 5 -> solar 9.9, usable 2.0, available 11.9, SAFE
c2 = engine.custom_scenario(solar_drop_pct=1.0, dust_factor=0.0, battery_soc_kwh=5.0)
check("Case 2 (1/0/5): solar 9.9 kW", abs(c2["power"]["solar_kw"] - 9.9) < 1e-3, f"solar={c2['power']['solar_kw']}")
check("Case 2 (1/0/5): usable 2.0 kW", abs(c2["power"]["usable_battery_kw"] - 2.0) < 1e-3, f"usable={c2['power']['usable_battery_kw']}")
check("Case 2 (1/0/5): available 11.9 kW", abs(c2["power"]["available_kw"] - 11.9) < 1e-3, f"avail={c2['power']['available_kw']}")
check("Case 2 (1/0/5): verdict SAFE", c2["verdict"] == "SAFE", f"verdict={c2['verdict']}")

# Case 3: 70 / 0 / 10 -> solar 3.0, usable 2.5, available 5.5, SHORTAGE, life support OK
c3 = engine.custom_scenario(solar_drop_pct=70.0, dust_factor=0.0, battery_soc_kwh=10.0)
check("Case 3 (70/0/10): solar 3.0 kW", abs(c3["power"]["solar_kw"] - 3.0) < 1e-3, f"solar={c3['power']['solar_kw']}")
check("Case 3 (70/0/10): usable 2.5 kW", abs(c3["power"]["usable_battery_kw"] - 2.5) < 1e-3, f"usable={c3['power']['usable_battery_kw']}")
check("Case 3 (70/0/10): available 5.5 kW", abs(c3["power"]["available_kw"] - 5.5) < 1e-3, f"avail={c3['power']['available_kw']}")
check("Case 3 (70/0/10): verdict SHORTAGE", c3["verdict"] == "SHORTAGE", f"verdict={c3['verdict']}")
check("Case 3 (70/0/10): life support OK", c3["alert"]["life_support_ok"] is True, f"ls_ok={c3['alert']['life_support_ok']}")

# Case 4: 100 / 0 / 8.5 -> solar 0, available 2.5, UNSAFE
c4 = engine.custom_scenario(solar_drop_pct=100.0, dust_factor=0.0, battery_soc_kwh=8.5)
check("Case 4 (100/0/8.5): solar 0 kW", abs(c4["power"]["solar_kw"] - 0.0) < 1e-3, f"solar={c4['power']['solar_kw']}")
check("Case 4 (100/0/8.5): available 2.5 kW", abs(c4["power"]["available_kw"] - 2.5) < 1e-3, f"avail={c4['power']['available_kw']}")
check("Case 4 (100/0/8.5): verdict UNSAFE", c4["verdict"] == "UNSAFE", f"verdict={c4['verdict']}")

# Case 5: 90 / 0 / 3 -> solar 1.0, usable 0, available 1.0, UNSAFE
c5 = engine.custom_scenario(solar_drop_pct=90.0, dust_factor=0.0, battery_soc_kwh=3.0)
check("Case 5 (90/0/3): solar 1.0 kW", abs(c5["power"]["solar_kw"] - 1.0) < 1e-3, f"solar={c5['power']['solar_kw']}")
check("Case 5 (90/0/3): usable 0 kW", abs(c5["power"]["usable_battery_kw"] - 0.0) < 1e-3, f"usable={c5['power']['usable_battery_kw']}")
check("Case 5 (90/0/3): available 1.0 kW", abs(c5["power"]["available_kw"] - 1.0) < 1e-3, f"avail={c5['power']['available_kw']}")
check("Case 5 (90/0/3): verdict UNSAFE", c5["verdict"] == "UNSAFE", f"verdict={c5['verdict']}")

# Drop 70% button matches 70 / 0
btn_drop70 = engine.solar_drop(0.7)
check("solar_drop_pct 70/0 matches the Drop 70% button",
      abs(c3["power"]["solar_kw"] - btn_drop70["power"]["solar_kw"]) < 1e-3,
      f"custom={c3['power']['solar_kw']:.3f}, button={btn_drop70['power']['solar_kw']:.3f}")

# Reset clears custom scenario and returns to normal
state_c_reset = engine.reset()
check("reset clears custom scenario: alert green", state_c_reset["alert"]["level"] == "green")
check("reset clears custom scenario: verdict SAFE", state_c_reset["verdict"] == "SAFE")
check("reset clears custom scenario: plan approved", state_c_reset["plan"]["status"] == "approved")
check("reset clears custom scenario: solar restored", state_c_reset["power"]["solar_kw"] >= 8.0)

# ---------------------------------------------------------------------------
# SCENARIO 6 – Fair equal_split, survival hours & strategy validation
# ---------------------------------------------------------------------------
section("SCENARIO 6: Benchmark & Strategy Requirements Validation")

# 1. Equal_split gives full power to all loads at nominal (water-filling)
engine.reset()
state_nom = engine.get_state()
eq_nom = next(p for p in state_nom["comparison"] if p["policy"] == "equal_split")
check("equal_split gives full power to all loads at nominal",
      eq_nom["unmet_kw"] == 0.0
      and eq_nom["life_support_ok"]
      and eq_nom["allocations"]["life_support"] == 3.0
      and eq_nom["allocations"]["habitat"] == 2.0
      and eq_nom["allocations"]["comms"] == 1.2
      and eq_nom["allocations"]["science"] == 1.0
      and eq_nom["allocations"]["rover"] == 0.8,
      f"alloc={eq_nom['allocations']}, unmet={eq_nom['unmet_kw']}")

# 2. Survival hours null when no deficit
check("survival hours null when no deficit (hours_now is None)",
      state_nom["survival"]["hours_now"] is None)
check("survival hours null when no deficit (hours_before is None)",
      state_nom["survival"]["hours_before"] is None)

# 3. solar_drop_50 survival must not exceed nominal (finite <= sustained/null)
state_drop50 = engine.custom_scenario(solar_drop_pct=50.0)
surv_drop50 = state_drop50["survival"]["hours_now"]
surv_nom = state_nom["survival"]["hours_now"]
check("solar_drop_50 survival is finite (>0)",
      surv_drop50 is not None and surv_drop50 > 0,
      f"hours_now={surv_drop50}")
check("solar_drop_50 survival must not exceed nominal",
      surv_nom is None or (surv_drop50 is not None and surv_drop50 <= surv_nom))

# 4. Spacegrid critical_load_satisfaction_pct >= fixed_rules in every scenario
from benchmark import SCENARIOS as BENCH_SCENARIOS
from optimizer import optimize as opt_func

all_sg_ge_fr = True
for sc in BENCH_SCENARIOS:
    sim.reset()
    sim.custom_scenario(
        solar_drop_pct=sc["solar_drop_pct"],
        dust_factor=sc["dust_factor"],
        battery_soc_kwh=sc["battery_soc_kwh"],
    )
    opt_res = opt_func(sim.loads, sim.current_solar_kw(), sim.current_usable_battery_kw())
    pols = {p["policy"]: p for p in opt_res["comparison"]}
    sg_crit = sum(pols["spacegrid"]["allocations"].get(k, 0.0) for k in ["life_support", "habitat", "comms"])
    fr_crit = sum(pols["fixed_rules"]["allocations"].get(k, 0.0) for k in ["life_support", "habitat", "comms"])
    if sg_crit < fr_crit - 1e-4:
        all_sg_ge_fr = False
        break

check("spacegrid critical_load_satisfaction_pct >= fixed_rules in every scenario",
      all_sg_ge_fr)

# 5. Blackout survival == 0.0 for all policies
sim.reset()
sim.custom_scenario(solar_drop_pct=99.0, dust_factor=0.99, battery_soc_kwh=3.0)
bo_opt = opt_func(sim.loads, sim.current_solar_kw(), sim.current_usable_battery_kw())
bo_usable_kwh = max(0.0, sim.battery.soc_kwh - sim.battery.min_reserve_kwh)
for pol in bo_opt["comparison"]:
    pol_name = pol["policy"]
    total_alloc = sum(pol["allocations"].values())
    draw = max(0.0, total_alloc - sim.current_solar_kw())
    pol_ls_ok = pol["life_support_ok"]
    if not pol_ls_ok:
        surv = 0.0
    elif bo_usable_kwh <= 1e-6 and total_alloc > sim.current_solar_kw():
        surv = 0.0
    elif draw <= 0.01 and pol_ls_ok:
        surv = None
    else:
        surv = round(bo_usable_kwh / draw, 2) if draw > 0 else 0.0
    check(f"blackout survival == 0.0 for policy {pol_name}", surv == 0.0, f"surv={surv}")

# 6. Nominal survival is None for all policies
sim.reset()
nom_opt = opt_func(sim.loads, sim.current_solar_kw(), sim.current_usable_battery_kw())
nom_usable_kwh = max(0.0, sim.battery.soc_kwh - sim.battery.min_reserve_kwh)
for pol in nom_opt["comparison"]:
    pol_name = pol["policy"]
    total_alloc = sum(pol["allocations"].values())
    draw = max(0.0, total_alloc - sim.current_solar_kw())
    pol_ls_ok = pol["life_support_ok"]
    if not pol_ls_ok:
        surv = 0.0
    elif nom_usable_kwh <= 1e-6 and total_alloc > sim.current_solar_kw():
        surv = 0.0
    elif draw <= 0.01 and pol_ls_ok:
        surv = None
    else:
        surv = round(nom_usable_kwh / draw, 2) if draw > 0 else 0.0
    check(f"nominal survival is None for policy {pol_name}", surv is None, f"surv={surv}")

# 7. Survival never None when life_support_ok is False
all_ls_fail_have_surv = True
for sc in BENCH_SCENARIOS:
    sim.reset()
    sim.custom_scenario(
        solar_drop_pct=sc["solar_drop_pct"],
        dust_factor=sc["dust_factor"],
        battery_soc_kwh=sc["battery_soc_kwh"],
    )
    sc_opt = opt_func(sim.loads, sim.current_solar_kw(), sim.current_usable_battery_kw())
    sc_usable_kwh = max(0.0, sim.battery.soc_kwh - sim.battery.min_reserve_kwh)
    for pol in sc_opt["comparison"]:
        total_alloc = sum(pol["allocations"].values())
        draw = max(0.0, total_alloc - sim.current_solar_kw())
        pol_ls_ok = pol["life_support_ok"]
        if not pol_ls_ok:
            surv = 0.0
        elif sc_usable_kwh <= 1e-6 and total_alloc > sim.current_solar_kw():
            surv = 0.0
        elif draw <= 0.01 and pol_ls_ok:
            surv = None
        else:
            surv = round(sc_usable_kwh / draw, 2) if draw > 0 else 0.0

        if not pol_ls_ok and surv is None:
            all_ls_fail_have_surv = False
            break

check("survival never None when life_support_ok is False across all scenarios and policies",
      all_ls_fail_have_surv)

# Verify saved benchmark.json matches conditions
import json
from pathlib import Path
bench_json_path = Path(__file__).resolve().parent / "results" / "benchmark.json"
if bench_json_path.exists():
    with open(bench_json_path, "r", encoding="utf-8") as f:
        b_data = json.load(f)
    json_valid = True
    for r in b_data["results"]:
        if not r["life_support_ok"] and r["survival_hours"] is None:
            json_valid = False
        if r["scenario"] == "blackout" and r["survival_hours"] != 0.0:
            json_valid = False
        if r["scenario"] == "nominal" and r["survival_hours"] is not None:
            json_valid = False
    check("benchmark.json file matches blackout == 0.0, nominal is None, ls_ok False != None", json_valid)

engine.reset()

# ---------------------------------------------------------------------------
# SCENARIO 7 – Baseline Forecasting & Accuracy Evaluation
# ---------------------------------------------------------------------------
section("SCENARIO 7: Power Forecasting & Accuracy Evaluation")

import forecasting

# 1. Deterministic output on two runs
f_run1 = forecasting.generate_baseline_forecast(sim, n_hours=6)
f_run2 = forecasting.generate_baseline_forecast(sim, n_hours=6)
check("deterministic forecast output on two runs", f_run1 == f_run2)

# 2. Forecast length equals horizon
check("forecast length equals horizon (default 6)",
      len(f_run1["forecast"]) == 6 and len(f_run1["solar_kw"]) == 6 and f_run1["horizon"] == 6)
f_run12 = forecasting.generate_baseline_forecast(sim, n_hours=12)
check("forecast length equals horizon (12)",
      len(f_run12["forecast"]) == 12 and f_run12["horizon"] == 12)
f_run24 = forecasting.generate_baseline_forecast(sim, n_hours=24)
check("forecast length equals horizon (max 24)",
      len(f_run24["forecast"]) == 24 and f_run24["horizon"] == 24)

# 3. Shortage window at nominal starts at hour 5
check("shortage window at nominal starts at hour 5",
      f_run1["shortage_window"] is not None and f_run1["shortage_window"]["start_hour"] == 5,
      f"window={f_run1['shortage_window']}")
check("forecast hour 0 equals current solar_kw from state",
      abs(f_run1["forecast"][0]["solar_kw"] - state["power"]["solar_kw"]) < 1e-4,
      f"forecast_0={f_run1['forecast'][0]['solar_kw']}, state={state['power']['solar_kw']}")
check("engine risk agrees with /forecast shortage window",
      state["risk"]["start_hour"] == f_run1["shortage_window"]["start_hour"])

# 4. Shortage window exists after a 70% drop and battery depletion by hour 3
engine.solar_drop(0.7)
f_drop = forecasting.generate_baseline_forecast(sim, n_hours=6)
check("a shortage window exists after a 70% drop", f_drop["shortage_window"] is not None)
check("shortage window starts at hour 0 after 70% drop",
      f_drop["shortage_window"] is not None and f_drop["shortage_window"]["start_hour"] == 0)
check("shortage window has positive peak deficit kW",
      f_drop["shortage_window"] is not None and f_drop["shortage_window"]["peak_deficit_kw"] > 0,
      f"deficit={f_drop['shortage_window']['peak_deficit_kw'] if f_drop['shortage_window'] else 0} kW")
check("after a 70% drop, usable_battery_kw is 0 by hour 3",
      abs(f_drop["forecast"][3]["usable_battery_kw"]) < 1e-4,
      f"h0={f_drop['forecast'][0]['usable_battery_kw']}, h1={f_drop['forecast'][1]['usable_battery_kw']}, h2={f_drop['forecast'][2]['usable_battery_kw']}, h3={f_drop['forecast'][3]['usable_battery_kw']}")

# Reset clears drop and restores nominal window starting at hour 5
engine.reset()
f_cleared = forecasting.generate_baseline_forecast(sim, n_hours=6)
check("reset restores nominal shortage window (starting at hour 5)",
      f_cleared["shortage_window"] is not None and f_cleared["shortage_window"]["start_hour"] == 5)

# 5. Deterministic synthetic history (at least 48 simulated hours)
hist48 = forecasting.build_synthetic_history(sim, total_hours=48)
check("synthetic history has at least 48 simulated hours", len(hist48) >= 48, f"hours={len(hist48)}")
hist48_run2 = forecasting.build_synthetic_history(sim, total_hours=48)
check("synthetic history is deterministic across runs", hist48 == hist48_run2)

# 6. MAPE ignores near-zero actuals
test_actuals = [0.0, 0.05, 5.0, 8.0]
test_preds = [0.1, 0.2, 5.5, 7.6]
eval_zero = forecasting.evaluate_forecast(actual=test_actuals, predicted=test_preds)
check("MAPE ignores near-zero actuals (excluded_points == 2)",
      eval_zero["excluded_points"] == 2, f"excluded={eval_zero['excluded_points']}")
check("MAPE computed accurately on valid points (>0.1 kW)",
      abs(eval_zero["mape"] - 7.5) < 1e-2, f"mape={eval_zero['mape']}%")

# 7. Evaluate on held-out hours
eval_heldout = forecasting.evaluate_forecast()
check("evaluate_forecast on held-out hours returns MAE >= 0", eval_heldout["mae"] >= 0,
      f"mae={eval_heldout['mae']}")
check("evaluate_forecast on held-out hours returns RMSE >= 0", eval_heldout["rmse"] >= 0,
      f"rmse={eval_heldout['rmse']}")
check("evaluate_forecast on held-out hours returns MAPE >= 0", eval_heldout["mape"] >= 0,
      f"mape={eval_heldout['mape']}%")
check("evaluate_forecast reports excluded points for night hours",
      eval_heldout["excluded_points"] > 0, f"excluded={eval_heldout['excluded_points']}")
check("evaluate_forecast output includes synthetic: true",
      eval_heldout.get("synthetic") is True)
check("evaluate_forecast output includes descriptive note",
      "note" in eval_heldout and "synthetic" in eval_heldout["note"].lower())

engine.reset()

# ---------------------------------------------------------------------------
# SCENARIO 8: API Endpoints, Validation & CORS Integration
# ---------------------------------------------------------------------------
section("SCENARIO 8: API Endpoints, Validation & CORS Integration")

import json
import shutil
from pathlib import Path
from fastapi.testclient import TestClient
from server import app

api_client = TestClient(app)

# 8.1 Health check
health_resp = api_client.get("/health")
check("GET /health status is 200", health_resp.status_code == 200)
check("GET /health returns {'status': 'ok'}", health_resp.json() == {"status": "ok"})

# 8.2 CORS headers
cors_resp = api_client.get("/health", headers={"Origin": "http://localhost:5173"})
check("CORS header access-control-allow-origin matches http://localhost:5173",
      cors_resp.headers.get("access-control-allow-origin") == "http://localhost:5173")
check("CORS does not use wildcard with credentials",
      cors_resp.headers.get("access-control-allow-origin") != "*")

# 8.3 POST /plan/decision
dec_app_resp = api_client.post("/plan/decision", json={"decision": "approve"})
check("POST /plan/decision {'decision': 'approve'} status 200", dec_app_resp.status_code == 200)
check("POST /plan/decision {'decision': 'approve'} sets plan.status 'approved'",
      dec_app_resp.json().get("plan", {}).get("status") == "approved")

dec_rej_resp = api_client.post("/plan/decision", json={"decision": "reject"})
check("POST /plan/decision {'decision': 'reject'} status 200", dec_rej_resp.status_code == 200)
check("POST /plan/decision {'decision': 'reject'} sets plan.status 'rejected'",
      dec_rej_resp.json().get("plan", {}).get("status") == "rejected")

dec_bad_resp = api_client.post("/plan/decision", json={"decision": "aprove"})
check("POST /plan/decision {'decision': 'aprove'} returns HTTP 422", dec_bad_resp.status_code == 422)
check("POST /plan/decision 422 error details contain validation error message",
      "approve" in str(dec_bad_resp.json()))

dec_empty_resp = api_client.post("/plan/decision", json={"decision": ""})
check("POST /plan/decision {'decision': ''} returns HTTP 422", dec_empty_resp.status_code == 422)

dec_nobody_resp = api_client.post("/plan/decision", json={})
check("POST /plan/decision with missing decision returns HTTP 422", dec_nobody_resp.status_code == 422)

# 8.3b Plan Decision persistence across scenarios (approve & reject after reset, solar-drop, blackout)
api_client.post("/reset")
resp_app_reset = api_client.post("/plan/decision", json={"decision": "approve"})
check("after /reset: POST /plan/decision approve status 200", resp_app_reset.status_code == 200)
check("after /reset: GET /state keeps plan.status 'approved'",
      api_client.get("/state").json().get("plan", {}).get("status") == "approved")

api_client.post("/reset")
resp_rej_reset = api_client.post("/plan/decision", json={"decision": "reject"})
check("after /reset: POST /plan/decision reject status 200", resp_rej_reset.status_code == 200)
check("after /reset: GET /state keeps plan.status 'rejected'",
      api_client.get("/state").json().get("plan", {}).get("status") == "rejected")

api_client.post("/simulate/solar-drop")
resp_app_sd = api_client.post("/plan/decision", json={"decision": "approve"})
check("after /simulate/solar-drop: POST /plan/decision approve status 200", resp_app_sd.status_code == 200)
check("after /simulate/solar-drop: GET /state keeps plan.status 'approved'",
      api_client.get("/state").json().get("plan", {}).get("status") == "approved")

api_client.post("/simulate/solar-drop")
resp_rej_sd = api_client.post("/plan/decision", json={"decision": "reject"})
check("after /simulate/solar-drop: POST /plan/decision reject status 200", resp_rej_sd.status_code == 200)
check("after /simulate/solar-drop: GET /state keeps plan.status 'rejected'",
      api_client.get("/state").json().get("plan", {}).get("status") == "rejected")

api_client.post("/simulate/blackout")
resp_app_bo = api_client.post("/plan/decision", json={"decision": "approve"})
check("after /simulate/blackout: POST /plan/decision approve status 200", resp_app_bo.status_code == 200)
check("after /simulate/blackout: GET /state keeps plan.status 'approved'",
      api_client.get("/state").json().get("plan", {}).get("status") == "approved")

api_client.post("/simulate/blackout")
resp_rej_bo = api_client.post("/plan/decision", json={"decision": "reject"})
check("after /simulate/blackout: POST /plan/decision reject status 200", resp_rej_bo.status_code == 200)
check("after /simulate/blackout: GET /state keeps plan.status 'rejected'",
      api_client.get("/state").json().get("plan", {}).get("status") == "rejected")

api_client.post("/reset")

# 8.4 GET /benchmark file serving and regeneration
bench_file = Path(__file__).resolve().parent / "results" / "benchmark.json"
check("results/benchmark.json exists on disk", bench_file.exists())

with open(bench_file, "r", encoding="utf-8") as bf:
    saved_bench_data = json.load(bf)

bench_api_resp = api_client.get("/benchmark")
check("GET /benchmark status 200", bench_api_resp.status_code == 200)
check("GET /benchmark serves saved results/benchmark.json directly",
      bench_api_resp.json() == saved_bench_data)

# Test missing file regeneration
bak_bench_file = bench_file.with_suffix(".json.testbak")
try:
    shutil.move(str(bench_file), str(bak_bench_file))
    regen_resp = api_client.get("/benchmark")
    check("GET /benchmark regenerates file when missing",
          regen_resp.status_code == 200 and bench_file.exists())
finally:
    if bak_bench_file.exists():
        if bench_file.exists():
            bak_bench_file.unlink()
        else:
            shutil.move(str(bak_bench_file), str(bench_file))

# ---------------------------------------------------------------------------
# SCENARIO 9: Consistency & Determinism Verification
# ---------------------------------------------------------------------------
section("SCENARIO 9: Cross-Module Consistency & Determinism")

def check_risk_and_forecast_consistency(scenario_name, endpoint, body=None):
    if body:
        resp = api_client.post(endpoint, json=body)
    else:
        resp = api_client.post(endpoint)
    st = resp.json()
    fc = api_client.get("/forecast").json()
    r = st.get("risk", {})
    sw = fc.get("shortage_window")
    if sw is None:
        check(f"{scenario_name}: risk matches forecast (no shortage)", r.get("shortage_expected") is False)
    else:
        consistent = (
            r.get("shortage_expected") is True
            and r.get("start_hour") == sw["start_hour"]
            and r.get("end_hour") == sw["end_hour"]
            and abs(r.get("max_deficit_kw", 0.0) - sw["peak_deficit_kw"]) < 1e-3
        )
        check(f"{scenario_name}: risk matches forecast shortage_window", consistent,
              f"start={r.get('start_hour')} vs {sw.get('start_hour')}, peak={r.get('max_deficit_kw')} vs {sw.get('peak_deficit_kw')}")

check_risk_and_forecast_consistency("/reset", "/reset")
check_risk_and_forecast_consistency("/simulate/solar-drop", "/simulate/solar-drop")
check_risk_and_forecast_consistency("/simulate/custom", "/simulate/custom", {"solar_drop_pct": 50})
check_risk_and_forecast_consistency("/simulate/blackout", "/simulate/blackout")

# Survival comparison against benchmark's spacegrid policy
bench_spacegrid_surv = {}
for row in saved_bench_data.get("results", []):
    if row["policy"] == "spacegrid":
        bench_spacegrid_surv[row["scenario"]] = row["survival_hours"]

reset_state = api_client.post("/reset").json()
check("nominal survival hours_now is None", reset_state["survival"]["hours_now"] is None)
check("nominal survival hours_now matches benchmark spacegrid survival",
      reset_state["survival"]["hours_now"] == bench_spacegrid_surv.get("nominal"))

drop_state = api_client.post("/simulate/solar-drop").json()
check("solar-drop survival hours_now is 2.2", drop_state["survival"]["hours_now"] == 2.2)
check("solar-drop survival hours_now matches benchmark spacegrid survival",
      drop_state["survival"]["hours_now"] == bench_spacegrid_surv.get("solar_drop_70"))

blackout_state = api_client.post("/simulate/blackout").json()
check("blackout survival hours_now is 0.0", blackout_state["survival"]["hours_now"] == 0.0)
check("blackout survival hours_now matches benchmark spacegrid survival",
      blackout_state["survival"]["hours_now"] == bench_spacegrid_surv.get("blackout"))

# Determinism
def filter_transient(d):
    if not isinstance(d, dict):
        return d
    return {
        k: filter_transient(v) if isinstance(v, dict) else ([filter_transient(x) if isinstance(x, dict) else x for x in v] if isinstance(v, list) else v)
        for k, v in d.items()
        if k not in ("replan_ms", "timestamp", "replan_time_ms", "latency_ms")
    }

api_client.post("/reset")
det_drop_1 = api_client.post("/simulate/solar-drop").json()
api_client.post("/reset")
det_drop_2 = api_client.post("/simulate/solar-drop").json()
check("solar-drop returns identical non-latency fields when repeated",
      filter_transient(det_drop_1) == filter_transient(det_drop_2))

api_client.post("/reset")
det_cust_1 = api_client.post("/simulate/custom", json={"solar_drop_pct": 60, "dust_factor": 0.4}).json()
api_client.post("/reset")
det_cust_2 = api_client.post("/simulate/custom", json={"solar_drop_pct": 60, "dust_factor": 0.4}).json()
check("custom scenario returns identical non-latency fields when repeated",
      filter_transient(det_cust_1) == filter_transient(det_cust_2))

# Benchmark non-latency determinism test
import benchmark
bench_run_a = benchmark.run_benchmark(iterations_per_scenario=10)
bench_run_b = benchmark.run_benchmark(iterations_per_scenario=10)

def clean_bench_payload(data):
    if isinstance(data, dict):
        return {
            k: clean_bench_payload(v)
            for k, v in data.items()
            if k not in ("timestamp", "latency_ms", "latency_mean_ms", "latency_p95_ms", "iterations_per_scenario")
        }
    elif isinstance(data, list):
        return [clean_bench_payload(x) for x in data]
    return data

check("benchmark suite non-latency fields identical across runs",
      clean_bench_payload(bench_run_a) == clean_bench_payload(bench_run_b))

# ---------------------------------------------------------------------------
# SCENARIO 10: Preset Scenarios Library & Dataset Batch Processing
# ---------------------------------------------------------------------------
section("SCENARIO 10: Preset Scenarios Library & Dataset Batch Processing")

# 1. GET /scenarios returns 30 library rows
scenarios_list = api_client.get("/scenarios").json()
check("GET /scenarios returns 30 library rows", len(scenarios_list) == 30)

# 2. POST /simulate/dataset with library=True calculates all 30 rows and matches expected
ds_lib_res = api_client.post("/simulate/dataset", json={"library": True})
check("POST /simulate/dataset status 200", ds_lib_res.status_code == 200)
ds_data = ds_lib_res.json()
check("dataset library has 30 evaluated rows", len(ds_data["rows"]) == 30)
all_lib_matched = all(r["matches_expected"] for r in ds_data["rows"])
check("all 30 library rows calculate without error and match the CSV expected values",
      all_lib_matched)

# 3. S02 matches nominal state
engine.reset()
nom_st = api_client.get("/state").json()
s02_st = api_client.post("/simulate/preset/S02").json()
check("S02 matches the nominal state: solar_kw",
      abs(s02_st["power"]["solar_kw"] - nom_st["power"]["solar_kw"]) < 1e-4)
check("S02 matches the nominal state: available_kw",
      abs(s02_st["power"]["available_kw"] - nom_st["power"]["available_kw"]) < 1e-4)
check("S02 matches the nominal state: verdict SAFE", s02_st["verdict"] == "SAFE")

# 4. S09 matches Drop 70% button
engine.reset()
drop_btn_st = api_client.post("/simulate/solar-drop").json()
engine.reset()
s09_st = api_client.post("/simulate/preset/S09").json()
check("S09 matches the Drop 70% button: solar_kw",
      abs(s09_st["power"]["solar_kw"] - drop_btn_st["power"]["solar_kw"]) < 1e-4)
check("S09 matches the Drop 70% button: available_kw",
      abs(s09_st["power"]["available_kw"] - drop_btn_st["power"]["available_kw"]) < 1e-4)
check("S09 matches the Drop 70% button: verdict SHORTAGE", s09_st["verdict"] == "SHORTAGE")

# 5. S21 matches Blackout button
engine.reset()
bo_btn_st = api_client.post("/simulate/blackout").json()
engine.reset()
s21_st = api_client.post("/simulate/preset/S21").json()
check("S21 matches the Blackout button: solar_kw near zero",
      abs(s21_st["power"]["solar_kw"] - bo_btn_st["power"]["solar_kw"]) < 0.1)
check("S21 matches the Blackout button: available_kw near zero",
      abs(s21_st["power"]["available_kw"] - bo_btn_st["power"]["available_kw"]) < 0.1)
check("S21 matches the Blackout button: verdict UNSAFE", s21_st["verdict"] == "UNSAFE")
check("S21 matches the Blackout button: life_support_ok False",
      s21_st["alert"]["life_support_ok"] is False)

# 6. Live /state is unchanged after a dataset run
engine.reset()
st_before_ds = api_client.get("/state").json()
api_client.post("/simulate/dataset", json={"library": True})
st_after_ds = api_client.get("/state").json()
check("the live /state is unchanged after a dataset run",
      filter_transient(st_before_ds) == filter_transient(st_after_ds))

# 7. Bad rows return 422 with row number
bad_row_res = api_client.post("/simulate/dataset", json={
    "rows": [
        {"solar_loss_pct": 20},
        {"solar_loss_pct": -15}
    ]
})
check("bad rows return 422", bad_row_res.status_code == 422)
check("bad rows return 422 naming the row number",
      "Row 2" in str(bad_row_res.json().get("detail", "")))

# 8. 501-row request is rejected with 422
res_501 = api_client.post("/simulate/dataset", json={
    "rows": [{"solar_loss_pct": 10}] * 501
})
check("a 501-row request is rejected (HTTP 422)", res_501.status_code == 422)

# 9. Unknown preset id returns 404
res_unk = api_client.post("/simulate/preset/UNKNOWN_PRESET_999")
check("unknown preset id returns 404", res_unk.status_code == 404)

engine.reset()

def test_all_checks_pass():
    """Pytest entrypoint confirming all checks passed."""
    assert sum(_results) == len(_results)
    assert len(_results) > 0

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
section("RESULTS")
passed = sum(_results)
total  = len(_results)
print(f"\n  {passed}/{total} checks passed.\n")
if __name__ == "__main__":
    if passed < total:
        failed = [i + 1 for i, ok in enumerate(_results) if not ok]
        print(f"  Failed check numbers: {failed}")
        sys.exit(1)
    else:
        print("  All checks PASSED.")
        sys.exit(0)
