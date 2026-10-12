# LunaGrid · SPACEGRID AI

**LunaGrid (SPACEGRID AI)** is an autonomous lunar microgrid decision-support prototype and digital twin designed for mission control operations. It ingests lunar environmental telemetry, forecasts power generation deficits, evaluates blackout risks, formulates optimal electrical load dispatch schedules using linear programming, and presents transparent trade-off rationale to flight controllers. **This system operates strictly in an advisory decision-support mode and digital-twin simulation capacity—it is a software prototype, not a flight-certified spacecraft controller, and commands zero physical hardware directly.**

---

## ⚙️ How It Works

1. **Simulator (`simulator.py`)**: Models a fixed simulated solar clock (`SIM_HOUR = 12`, solar noon) with a sinusoidal solar curve (`SOLAR_PEAK_KW = 10.0 kW`, nominal dust attenuation 12% yielding 8.8 kW nominal solar), a 20.0 kWh battery (16.5 kWh nominal SoC, 3.0 kWh minimum reserve, 2.5 kW max discharge rate), and 5 habitat loads totaling 8.0 kW demand.
2. **Forecast (`forecasting.py`)**: Computes a deterministic baseline generation forecast for the next 24 hours. Tracks hour-by-hour battery depletion to identify shortage windows where demand exceeds available solar + usable battery.
3. **Risk Engine (`risk.py`)**: Assesses shortage windows (`start_hour`, `end_hour`, `peak_deficit_kw`) and alerts flight controllers.
4. **PuLP Optimizer (`optimizer.py`)**: Solves a linear program using PuLP 2.9.0 with the bundled CBC solver (`PULP_CBC_CMD`) to minimize priority-weighted unmet demand: $\min \sum w_i \cdot (\text{need}_i - P_i)$ subject to $0 \le P_i \le \text{need}_i$ and $\sum P_i \le P_{\text{solar}} + P_{\text{battery, usable}}$.
   - **Priority Weights**: `life_support: 1000`, `habitat: 100`, `communication: 100`, `experiments: 10`, `rover: 1`.
   - **Usable Battery Formula**: $P_{\text{battery, usable}} = \min(\max(\text{soc\_kwh} - \text{min\_reserve\_kwh}, 0.0), \text{max\_discharge\_kw})$.
5. **Mission Dashboard (`frontend/`)**: React 18 interface displaying real-time telemetry, 24h forecast charts, consequence evaluation, and hold-to-authorize approval controls.

---

## 📐 Definitions & Units

- **Survival Hours**: Hours life support can remain fully powered under the policy's battery draw: $\text{usable\_battery\_kwh} / \max(0, \text{total\_allocated\_kw} - \text{solar\_kw})$. Returns `null` when sustained (battery draw $\le 0.01$ kW), and `0.0` if life support is not fully met or usable battery is 0.
- **Critical Load Satisfaction**: Percentage of high-priority loads satisfied: $(\text{allocated}_{\text{life\_support}} + \text{allocated}_{\text{habitat}} + \text{allocated}_{\text{comms}}) / 6.2\text{ kW} \times 100\%$.
- **Solar Drop %**: Percentage reduction relative to 10.0 kW clean-sky peak (e.g., 70% drop yields 3.0 kW solar), not relative to the nominal 8.8 kW dust-attenuated value.
- **Units**: Electrical power in **kW**, storage energy in **kWh**, discrete simulation step of **1 hour**.

---

## 📡 API Reference (`backend/server.py`)

| Method | Path | Request Body | Description |
|---|---|---|---|
| `GET` | `/health` | None | Service liveness probe (`{"status": "ok"}`). |
| `GET` | `/state` | None | Full habitat state: telemetry, battery, 5 loads, alert, risk, and plan. |
| `POST` | `/simulate/solar-drop` | None | Triggers -70% solar obscuration event (solar reduced to 3.0 kW). |
| `POST` | `/simulate/blackout` | None | Triggers severe crisis (0.1 kW solar, battery at reserve, life support unmet). |
| `POST` | `/simulate/custom` | `{"solar_drop_pct": float, "dust_factor": float?, "battery_soc_kwh": float?}` | Custom scenario with strict HTTP 422 input boundary validation. |
| `POST` | `/reset` | None | Restores nominal daylight operations (8.8 kW solar, 16.5 kWh SoC). |
| `GET` | `/forecast` | Query: `hours` (default 6), `horizon` (max 24) | 24-hour solar projection and shortage window metrics. |
| `POST` | `/plan/decision` | `{"decision": "approve" \| "reject"}` | Records flight controller decision; strictly returns HTTP 422 for invalid values. |
| `GET` | `/benchmark` | None | Serves saved `benchmark.json`; generates and saves suite if missing. |

---

## 📊 Benchmark Suite (`backend/results/benchmark.json`)

Run suite: `python benchmark.py` (evaluates 9 scenarios $\times$ 3 policies across 100 iterations per policy):
- **Policies**:
  1. `equal_split`: Fair-share baseline with iterative water-filling reallocation.
  2. `fixed_rules`: Deterministic greedy priority ladder.
  3. `spacegrid`: Priority-weighted linear program (PuLP + CBC).

| Scenario | Solar | Usable Batt | Equal Split (LS / Crit% / Surv) | Fixed Rules (LS / Crit% / Surv) | SPACEGRID AI (LS / Crit% / Surv) |
|---|---|---|---|---|---|
| **nominal** | 8.8 kW | 2.5 kW | True / 100% / null | True / 100% / null | True / 100% / null |
| **solar_drop_30** | 7.0 kW | 2.5 kW | True / 100% / 5.5 h | True / 100% / 5.5 h | True / 100% / 5.5 h |
| **solar_drop_50** | 5.0 kW | 2.5 kW | False / 91.9% / 0.0 h | True / 100% / 2.2 h | True / 100% / 2.2 h |
| **solar_drop_70** | 3.0 kW | 2.5 kW | False / 59.7% / 0.0 h | True / 88.7% / 2.2 h | True / 88.7% / 2.2 h |
| **solar_drop_90** | 1.0 kW | 2.5 kW | False / 33.9% / 0.0 h | True / 56.5% / 2.2 h | True / 56.5% / 2.2 h |
| **dust_storm** | 1.5 kW | 2.5 kW | False / 38.7% / 0.0 h | True / 64.5% / 1.2 h | True / 64.5% / 1.2 h |
| **low_battery** | 8.8 kW | 0.5 kW | True / 100% / null | True / 100% / null | True / 100% / null |
| **low_battery_drop_70**| 3.0 kW | 0.5 kW | False / 33.9% / 0.0 h | True / 56.5% / 1.0 h | True / 56.5% / 1.0 h |
| **blackout** | 0.1 kW | 0.0 kW | False / 1.0% / 0.0 h | False / 1.6% / 0.0 h | False / 1.6% / 0.0 h |

**Honest Assessment**:
- **Protection**: `spacegrid` matches `fixed_rules` identically in load allocations, critical satisfaction, and survival hours across all scenarios. The key advantage over `equal_split` is life-support preservation—`equal_split` naively cuts life support in all deficits ($0.0\text{ h}$ survival).
- **Latency (Laptop CPU)**: `equal_split` ~0.015 ms, `fixed_rules` ~0.010 ms, `spacegrid` ~15–17 ms (LP solving overhead via CBC subprocess).

---

## 🔮 Forecasting Baseline & Synthetic Validation

- **Baseline Model**: Uses a "same hour yesterday" naive persistence forecast derived from the simulator's solar curve.
- **Evaluation**: Evaluated on synthetic history (48 simulated hours) yielding held-out MAE = 0.085 kW, RMSE = 0.116 kW, MAPE = 2.33% (evaluated only where solar > 0.1 kW).
- **Note**: This is a baseline calculation on synthetic simulator data, **not real operational validation**. Machine learning models (e.g. XGBoost) and persistent database backends (e.g. PostgreSQL) are not implemented.

---

## 🛠️ How to Run (100% Offline)

The entire application runs locally with zero external network or CDN calls.

### 1. Backend Service
```bash
cd backend
python -m uvicorn server:app --reload --port 8000
```

### 2. Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 3. Run Test Suite
```bash
cd backend
python test_engine.py
# (Runs 134 integration checks covering engine, API, CORS, consistency, and determinism)
```

### 4. Run Benchmark Suite
```bash
cd backend
python benchmark.py
```

---

## ⚠️ Limitations & Future Work

1. **Synthetic Data**: Telemetry is generated from mathematical models, not physical lunar instrumentation.
2. **No Hardware Actuation**: Prototype digital twin operates in advisory decision-support mode only.
3. **Editable Constraints**: Priority weights and constraint matrices are currently static in the optimizer code.
4. **Forecast Upgrades**: Implement machine learning (e.g. XGBoost / temporal neural networks) trained on lunar surface datasets.
5. **Storage & Persistence**: Add PostgreSQL/TimescaleDB time-series persistence for long-horizon audit logs.
6. **Hardware Integration & Safety**: Formal verification, hardware-in-the-loop (HIL) testing, and redundancy validation required before flight consideration.
