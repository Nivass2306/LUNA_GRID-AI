"""
server.py - SPACEGRID AI FastAPI Backend Service (Port 8000)

FastAPI service for lunar habitat power telemetry:
- GET  /health
- GET  /state
- POST /simulate/solar-drop
- POST /reset
- POST /plan/decision
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import engine

app = FastAPI(title="SPACEGRID AI Backend", version="1.0.0")


class CustomScenarioRequest(BaseModel):
    solar_drop_pct: float = Field(..., ge=0.0, le=100.0, description="Solar drop percentage (0-100)")
    dust_factor: Optional[float] = Field(None, ge=0.0, le=1.0, description="Dust attenuation factor (0-1)")
    battery_soc_kwh: Optional[float] = Field(None, ge=0.0, le=20.0, description="Battery SoC in kWh (0-20)")


class PlanDecisionRequest(BaseModel):
    decision: Literal["approve", "reject"]


class DatasetSimulationRequest(BaseModel):
    rows: Optional[list] = None
    library: Optional[bool] = False


# ---------------------------------------------------------------------------
# 1. CORS: Allow explicit development frontend origins
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handler for unhandled errors
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "EngineError", "detail": str(exc)},
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/state")
def get_state() -> Dict[str, Any]:
    """Return current habitat telemetry and optimization state."""
    try:
        return engine.get_state()
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "EngineError", "detail": str(exc)},
        )


@app.post("/simulate/solar-drop")
def simulate_solar_drop() -> Dict[str, Any]:
    """Trigger solar obscuration event (-70% drop => factor 0.3)."""
    try:
        return engine.solar_drop(0.3)
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "EngineError", "detail": str(exc)},
        )


@app.post("/simulate/blackout")
def simulate_blackout() -> Dict[str, Any]:
    """Trigger severe blackout event (life support cannot be met, red alert)."""
    try:
        return engine.blackout()
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "EngineError", "detail": str(exc)},
        )


@app.post("/reset")
def reset() -> Dict[str, Any]:
    """Reset simulator and return nominal state."""
    try:
        return engine.reset()
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "EngineError", "detail": str(exc)},
        )


@app.post("/simulate/custom")
def simulate_custom(payload: CustomScenarioRequest) -> Dict[str, Any]:
    """Trigger a custom disruption scenario with validated parameters."""
    try:
        return engine.custom_scenario(
            solar_drop_pct=payload.solar_drop_pct,
            dust_factor=payload.dust_factor,
            battery_soc_kwh=payload.battery_soc_kwh,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "EngineError", "detail": str(exc)},
        )


@app.get("/scenarios")
def get_scenarios() -> List[Dict[str, Any]]:
    """Return id, name, category, description and the three inputs of each row from CSV."""
    return engine.get_scenarios()


@app.post("/simulate/preset/{scenario_id}")
def simulate_preset(scenario_id: str) -> Dict[str, Any]:
    """Applies preset row through the same path as /simulate/custom and returns normal full state."""
    try:
        return engine.apply_preset(scenario_id)
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "EngineError", "detail": str(exc)},
        )


@app.post("/simulate/dataset")
def simulate_dataset(payload: DatasetSimulationRequest) -> Dict[str, Any]:
    """Simulate a dataset batch on a copy of simulator state without changing live state."""
    try:
        return engine.simulate_dataset(rows=payload.rows, library=bool(payload.library))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "EngineError", "detail": str(exc)},
        )


@app.get("/benchmark")
def get_benchmark() -> Dict[str, Any]:
    """Return benchmark suite results, running suite if not yet generated."""
    json_path = Path(__file__).resolve().parent / "results" / "benchmark.json"
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    import benchmark
    return benchmark.run_benchmark()


@app.get("/forecast")
def get_forecast(hours: int = 6, horizon: Optional[int] = None) -> Dict[str, Any]:
    """
    Return baseline power forecast arrays and shortage window.
    Shortage window: hours where demand > forecast solar + usable battery
    (start_hour, end_hour, peak_deficit_kw). Returns null if no shortage.
    """
    import simulator
    import forecasting
    try:
        n_hours = horizon if horizon is not None else hours
        return forecasting.generate_baseline_forecast(sim=simulator.sim, n_hours=n_hours)
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "ForecastError", "detail": str(exc)},
        )


@app.post("/plan/decision")
def plan_decision(payload: PlanDecisionRequest) -> Dict[str, Any]:
    """Record operator plan decision ('approve' or 'reject')."""
    try:
        return engine.plan_decision(payload.decision)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "EngineError", "detail": str(exc)},
        )


# ---------------------------------------------------------------------------
# Server startup
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
