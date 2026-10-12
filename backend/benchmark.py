"""
benchmark.py - Disruption scenario benchmark & strategy comparison suite.

Evaluates LUNAGRID AI linear program vs fixed rules vs equal split across
a deterministic suite of operational disruptions.

Metrics per scenario & policy:
  - life_support_ok (bool, lowercase in CSV/JSON)
  - critical_load_satisfaction_pct (life support + habitat + comms)
  - total_unmet_kw (float)
  - battery_soc_kwh (total battery charge)
  - usable_battery_kwh (usable energy above reserve)
  - battery_reserve_remaining_kwh (same as usable energy)
  - survival_hours (computed per policy; 0.0 if life support compromised, null if battery draw <= 0.01)
  - re-plan latency (mean and p95 timed separately per policy over 100 runs in ms)

Outputs:
  - backend/results/benchmark.json
  - backend/results/benchmark.csv
"""

from __future__ import annotations
import csv
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from simulator import sim
from optimizer import optimize, _run_lp, _equal_split, _fixed_rules

RESULTS_DIR = Path(__file__).resolve().parent / "results"
JSON_PATH = RESULTS_DIR / "benchmark.json"
CSV_PATH = RESULTS_DIR / "benchmark.csv"

# Critical load demand sum (life_support 3.0 + habitat 2.0 + comms 1.2 = 6.2 kW)
CRITICAL_LOAD_SUM_KW = 6.2

# 9 Fixed deterministic scenarios
SCENARIOS = [
    {
        "name": "nominal",
        "label": "Nominal operations",
        "solar_drop_pct": 0.0,
        "dust_factor": 0.12,
        "battery_soc_kwh": 16.5,
    },
    {
        "name": "solar_drop_30",
        "label": "Solar drop 30%",
        "solar_drop_pct": 30.0,
        "dust_factor": 0.30,
        "battery_soc_kwh": 8.5,
    },
    {
        "name": "solar_drop_50",
        "label": "Solar drop 50%",
        "solar_drop_pct": 50.0,
        "dust_factor": 0.50,
        "battery_soc_kwh": 8.5,
    },
    {
        "name": "solar_drop_70",
        "label": "Solar drop 70%",
        "solar_drop_pct": 70.0,
        "dust_factor": 0.70,
        "battery_soc_kwh": 8.5,
    },
    {
        "name": "solar_drop_90",
        "label": "Solar drop 90%",
        "solar_drop_pct": 90.0,
        "dust_factor": 0.90,
        "battery_soc_kwh": 8.5,
    },
    {
        "name": "dust_storm",
        "label": "Severe dust storm",
        "solar_drop_pct": 85.0,
        "dust_factor": 0.85,
        "battery_soc_kwh": 6.0,
    },
    {
        "name": "low_battery",
        "label": "Low battery reserve",
        "solar_drop_pct": 0.0,
        "dust_factor": 0.12,
        "battery_soc_kwh": 3.5,
    },
    {
        "name": "low_battery_drop_70",
        "label": "70% drop with low battery reserve (~0.5 kWh usable)",
        "solar_drop_pct": 70.0,
        "dust_factor": 0.70,
        "battery_soc_kwh": 3.5,
    },
    {
        "name": "blackout",
        "label": "Blackout (solar near 0, min reserve)",
        "solar_drop_pct": 99.0,
        "dust_factor": 0.99,
        "battery_soc_kwh": 3.0,
    },
]


def run_benchmark(iterations_per_scenario: int = 100) -> Dict[str, Any]:
    """
    Execute full benchmark suite, saving results to disk and returning summary dict.
    Times latency separately per policy and computes survival hours per policy.
    """
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    all_rows: List[Dict[str, Any]] = []
    scenarios_data: List[Dict[str, Any]] = []

    for sc in SCENARIOS:
        # Reset and configure simulator
        sim.reset()
        sim.custom_scenario(
            solar_drop_pct=sc["solar_drop_pct"],
            dust_factor=sc["dust_factor"],
            battery_soc_kwh=sc["battery_soc_kwh"],
        )

        solar_kw = sim.current_solar_kw()
        usable_battery_kw = sim.current_usable_battery_kw()
        available_kw = solar_kw + usable_battery_kw
        demand_kw = sim.current_demand_kw()
        battery_soc_kwh = round(sim.battery.soc_kwh, 3)
        usable_battery_kwh = round(max(0.0, sim.battery.soc_kwh - sim.battery.min_reserve_kwh), 3)
        battery_reserve_remaining_kwh = usable_battery_kwh

        # Time latency separately per policy over iterations_per_scenario
        latencies_sg: List[float] = []
        latencies_fr: List[float] = []
        latencies_eq: List[float] = []

        for _ in range(iterations_per_scenario):
            t0 = time.perf_counter()
            _run_lp(sim.loads, solar_kw, usable_battery_kw)
            latencies_sg.append((time.perf_counter() - t0) * 1000.0)

            t0 = time.perf_counter()
            _fixed_rules(sim.loads, available_kw)
            latencies_fr.append((time.perf_counter() - t0) * 1000.0)

            t0 = time.perf_counter()
            _equal_split(sim.loads, available_kw)
            latencies_eq.append((time.perf_counter() - t0) * 1000.0)

        latency_stats = {
            "spacegrid": {
                "mean_ms": round(float(np.mean(latencies_sg)), 3),
                "p95_ms": round(float(np.percentile(latencies_sg, 95)), 3),
            },
            "fixed_rules": {
                "mean_ms": round(float(np.mean(latencies_fr)), 3),
                "p95_ms": round(float(np.percentile(latencies_fr, 95)), 3),
            },
            "equal_split": {
                "mean_ms": round(float(np.mean(latencies_eq)), 3),
                "p95_ms": round(float(np.percentile(latencies_eq, 95)), 3),
            },
        }

        # Optimization results for each policy
        opt = optimize(sim.loads, solar_kw, usable_battery_kw)
        policy_dict: Dict[str, Any] = {}

        for pol in opt["comparison"]:
            pol_name = pol["policy"]
            allocs = pol["allocations"]
            total_allocated_kw = sum(allocs.values())
            pol_ls_ok = bool(pol["life_support_ok"])

            # Survival fix:
            # - if life_support_ok is False for a policy, survival_hours = 0.0
            # - also 0.0 if usable battery energy is 0 and total allocated > solar
            # - only return null when battery draw <= 0.01 AND life_support_ok is True
            # - otherwise usable_battery_kwh / battery_draw_kw
            battery_draw_kw = max(0.0, total_allocated_kw - solar_kw)
            if not pol_ls_ok:
                survival_hours: Optional[float] = 0.0
            elif usable_battery_kwh <= 1e-6 and total_allocated_kw > solar_kw:
                survival_hours = 0.0
            elif battery_draw_kw <= 0.01 and pol_ls_ok:
                survival_hours = None
            else:
                survival_hours = round(usable_battery_kwh / battery_draw_kw, 2) if battery_draw_kw > 0 else 0.0

            # Critical loads: life_support (3.0) + habitat (2.0) + comms (1.2) = 6.2 kW
            critical_alloc = (
                allocs.get("life_support", 0.0)
                + allocs.get("habitat", 0.0)
                + allocs.get("comms", 0.0)
            )
            critical_load_satisfaction_pct = round(
                min(100.0, (critical_alloc / CRITICAL_LOAD_SUM_KW) * 100.0), 2
            )

            pol_lat = latency_stats[pol_name]

            row = {
                "scenario": sc["name"],
                "policy": pol_name,
                "solar_kw": round(solar_kw, 3),
                "usable_battery_kw": round(usable_battery_kw, 3),
                "battery_soc_kwh": battery_soc_kwh,
                "usable_battery_kwh": usable_battery_kwh,
                "battery_reserve_remaining_kwh": battery_reserve_remaining_kwh,
                "life_support_ok": pol_ls_ok,
                "critical_load_satisfaction_pct": critical_load_satisfaction_pct,
                "total_unmet_kw": round(float(pol["unmet_kw"]), 3),
                "survival_hours": survival_hours,
                "latency_mean_ms": pol_lat["mean_ms"],
                "latency_p95_ms": pol_lat["p95_ms"],
            }
            all_rows.append(row)

            policy_dict[pol_name] = {
                "life_support_ok": pol_ls_ok,
                "critical_load_satisfaction_pct": critical_load_satisfaction_pct,
                "total_unmet_kw": row["total_unmet_kw"],
                "battery_soc_kwh": battery_soc_kwh,
                "usable_battery_kwh": usable_battery_kwh,
                "battery_reserve_remaining_kwh": battery_reserve_remaining_kwh,
                "survival_hours": survival_hours,
                "latency_ms": pol_lat,
                "allocations": allocs,
            }

        scenarios_data.append({
            "scenario": sc["name"],
            "label": sc["label"],
            "solar_kw": round(solar_kw, 3),
            "usable_battery_kw": round(usable_battery_kw, 3),
            "demand_kw": round(demand_kw, 3),
            "battery_soc_kwh": battery_soc_kwh,
            "usable_battery_kwh": usable_battery_kwh,
            "battery_reserve_remaining_kwh": battery_reserve_remaining_kwh,
            "policies": policy_dict,
        })

    # Reset simulator back to clean nominal state
    sim.reset()

    # Output structure
    payload = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "meta": {
            "scenarios_count": len(SCENARIOS),
            "iterations_per_scenario": iterations_per_scenario,
            "solver": "PULP_CBC_CMD",
            "latency_scope": "per_policy",
        },
        "scenarios": scenarios_data,
        "results": all_rows,
    }

    # Write JSON
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    # Write CSV
    csv_headers = [
        "scenario",
        "policy",
        "solar_kw",
        "usable_battery_kw",
        "battery_soc_kwh",
        "usable_battery_kwh",
        "battery_reserve_remaining_kwh",
        "life_support_ok",
        "critical_load_satisfaction_pct",
        "total_unmet_kw",
        "survival_hours",
        "latency_mean_ms",
        "latency_p95_ms",
    ]
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_headers)
        writer.writeheader()
        # Format booleans as lowercase string true/false and None as null
        for r in all_rows:
            csv_row = dict(r)
            csv_row["life_support_ok"] = "true" if csv_row["life_support_ok"] else "false"
            if csv_row["survival_hours"] is None:
                csv_row["survival_hours"] = "null"
            writer.writerow(csv_row)

    return payload


def print_table(results: List[Dict[str, Any]]) -> None:
    """Print the full results table including all policies and verification columns."""
    header = (
        f"{'Scenario':<20} | {'Policy':<12} | {'Solar':<6} | {'Batt':<5} | "
        f"{'SoC':<5} | {'Usable':<6} | {'LS OK':<6} | {'Crit %':<7} | "
        f"{'Unmet kW':<8} | {'Surv (h)':<9} | {'Mean ms':<8} | {'p95 ms':<8}"
    )
    print("\n" + "=" * len(header))
    print("  LUNAGRID AI BENCHMARK RESULTS")
    print("=" * len(header))
    print(header)
    print("-" * len(header))

    current_sc = ""
    for r in results:
        sc_disp = r["scenario"] if r["scenario"] != current_sc else ""
        current_sc = r["scenario"]
        surv_str = "null" if r["survival_hours"] is None else f"{r['survival_hours']:.2f}"
        ls_str = "true" if r["life_support_ok"] else "false"

        print(
            f"{sc_disp:<20} | {r['policy']:<12} | {r['solar_kw']:<6.1f} | {r['usable_battery_kw']:<5.1f} | "
            f"{r['battery_soc_kwh']:<5.1f} | {r['usable_battery_kwh']:<6.1f} | "
            f"{ls_str:<6} | {r['critical_load_satisfaction_pct']:<6.1f}% | {r['total_unmet_kw']:<8.2f} | "
            f"{surv_str:<9} | {r['latency_mean_ms']:<8.3f} | {r['latency_p95_ms']:<8.3f}"
        )
    print("=" * len(header) + "\n")


if __name__ == "__main__":
    print("Running LUNAGRID AI Benchmark Suite (100 iterations/policy/scenario)...")
    t_start = time.perf_counter()
    data = run_benchmark()
    elapsed = time.perf_counter() - t_start
    print_table(data["results"])
    print(f"Benchmark completed in {elapsed:.2f} s.")
    print(f"Results saved to:")
    print(f"  - {JSON_PATH}")
    print(f"  - {CSV_PATH}")
