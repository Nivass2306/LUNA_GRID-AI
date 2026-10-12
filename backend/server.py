"""
server.py - LUNAGRID AI FastAPI Backend Service (Port 8000)

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

from contextlib import asynccontextmanager
import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    import forecasting
    forecasting.load_solar_model()
    yield

app = FastAPI(title="LUNAGRID AI Backend", description="LUNAGRID AI Autonomous Lunar Microgrid Decision Support", version="1.0.0", lifespan=lifespan)


class CustomScenarioRequest(BaseModel):
    solar_drop_pct: float = Field(..., ge=0.0, le=100.0, description="Solar drop percentage (0-100)")
    dust_factor: Optional[float] = Field(None, ge=0.0, le=1.0, description="Dust attenuation factor (0-1)")
    battery_soc_kwh: Optional[float] = Field(None, ge=0.0, le=20.0, description="Battery SoC in kWh (0-20)")


class PlanDecisionRequest(BaseModel):
    decision: Literal["approve", "reject"]


class PlanProposeRequest(BaseModel):
    solar_drop_pct: float = Field(0.0, ge=0.0, le=100.0)
    dust_factor: Optional[float] = Field(None, ge=0.0, le=1.0)
    battery_soc_kwh: Optional[float] = Field(None, ge=0.0, le=20.0)
    source: str = "simulation"


class PlanPatchRequest(BaseModel):
    proposed_kw: Optional[Dict[str, float]] = None
    communication: Optional[float] = None
    comms: Optional[float] = None
    experiments: Optional[float] = None
    science: Optional[float] = None
    rover: Optional[float] = None
    life_support: Optional[float] = None
    habitat: Optional[float] = None


class PlanApproveRequest(BaseModel):
    operator_note: Optional[str] = None


class PlanRejectRequest(BaseModel):
    reason: Optional[str] = None



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
    return {"status": "ok", "service": "LUNAGRID AI Backend"}


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


@app.get("/dataset/info")
def get_dataset_info() -> Dict[str, Any]:
    """Return dataset metadata: file name, total rows, categories."""
    try:
        return engine.get_dataset_info()
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "DatasetError", "detail": str(exc)},
        )


@app.get("/dataset/random")
def get_dataset_random(category: Optional[str] = None) -> Dict[str, Any]:
    """Return one random row plus its index (optionally filtered by category)."""
    try:
        return engine.get_dataset_random(category=category)
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "DatasetError", "detail": str(exc)},
        )


@app.get("/dataset/results")
def get_dataset_results(
    level: str = "shortage",
    sort: str = "worst",
    page: int = 1,
    page_size: int = 10,
) -> Dict[str, Any]:
    """
    Return paginated, sorted scenario evaluation results for a given alert level.
    If run-all has not been executed yet, executes it automatically.
    - level: all | safe | watch | critical | unsafe | shortage
    - sort: worst | best | random
    """
    try:
        return engine.get_dataset_results(
            level=level,
            sort=sort,
            page=page,
            page_size=page_size,
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "DatasetResultsError", "detail": str(exc)},
        )


@app.get("/dataset/samples")
def get_dataset_samples() -> Dict[str, Any]:
    """
    Return one random representative scenario from each alert level
    (safe, watch, critical, unsafe).
    """
    try:
        return engine.get_dataset_samples()
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "DatasetSamplesError", "detail": str(exc)},
        )


@app.get("/dataset/{index}")
def get_dataset_by_index(index: int) -> Dict[str, Any]:
    """Return one row by 0-based index (404 if out of range)."""
    try:
        return engine.get_dataset_by_index(index=index)
    except IndexError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "DatasetError", "detail": str(exc)},
        )


@app.post("/simulate/dataset/run-all")
def simulate_dataset_run_all() -> Dict[str, Any]:
    """
    Evaluates all rows in chunks of 500 using the exact manual simulation engine.
    Returns only summary statistics (safe/watch/critical/unsafe counts, % life support OK,
    average survival hours, 10 worst scenarios, and 50-row engine validation check).
    """
    try:
        return engine.run_all_dataset(chunk_size=500)
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "DatasetSimulationError", "detail": str(exc)},
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



@app.get("/model/info")
def get_model_info() -> Dict[str, Any]:
    """Return metrics file contents and metadata for the offline-trained XGBoost model."""
    import forecasting
    try:
        return forecasting.get_model_info()
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "ModelInfoError", "detail": str(exc)},
        )


@app.get("/forecast")
def get_forecast(hours: int = 6, horizon: Optional[int] = None, model: Optional[str] = None) -> Dict[str, Any]:
    """
    Return power forecast arrays and shortage window.
    Shortage window: hours where demand > forecast solar + usable battery
    (start_hour, end_hour, peak_deficit_kw). Returns null if no shortage.
    """
    import simulator
    import forecasting
    try:
        n_hours = horizon if horizon is not None else hours
        if model == "xgboost":
            return forecasting.generate_power_forecast(sim=simulator.sim, n_hours=n_hours)
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


@app.get("/plan/horizon")
def get_plan_horizon() -> Dict[str, Any]:
    """24-hour battery-aware horizon plan with multi-period optimization and naive comparison."""
    try:
        return engine.get_horizon_plan()
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "HorizonPlanError", "detail": str(exc)},
        )


@app.post("/plan/propose")
def plan_propose(payload: PlanProposeRequest) -> Dict[str, Any]:
    """Run optimizer for given scenario inputs and store as pending proposal without changing active plan."""
    import approval
    try:
        return approval.create_proposal(
            solar_drop_pct=payload.solar_drop_pct,
            dust_factor=payload.dust_factor,
            battery_soc_kwh=payload.battery_soc_kwh,
            source=payload.source,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@app.get("/plan/pending")
def plan_get_pending() -> Optional[Dict[str, Any]]:
    """Return current pending proposal awaiting operator review, or null."""
    import approval
    return approval.get_pending_plan()


@app.get("/plan/active")
def plan_get_active() -> Dict[str, Any]:
    """Return the active plan currently in force on the microgrid."""
    import approval
    return approval.get_active_plan()


@app.patch("/plan/pending")
def plan_patch_pending(payload: PlanPatchRequest) -> Dict[str, Any]:
    """
    Update editable secondary load kW values in the pending proposal.
    Rejects any modification to permanent locked loads (life_support, habitat) with HTTP 422.
    """
    import approval
    patch_dict = {}
    if payload.proposed_kw:
        patch_dict.update(payload.proposed_kw)
    for field in ("communication", "comms", "experiments", "science", "rover", "life_support", "habitat"):
        val = getattr(payload, field, None)
        if val is not None:
            patch_dict[field] = val

    try:
        return approval.update_pending_proposal(patch_dict)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@app.post("/plan/{plan_id}/approve")
def plan_approve(plan_id: str, payload: PlanApproveRequest = PlanApproveRequest()) -> Dict[str, Any]:
    """
    Approve pending proposal, promoting it to active_plan and recording an audit event.
    Refuses approval with 422 if proposal is blocked or ID mismatch.
    """
    import approval
    try:
        approved = approval.approve_proposal(plan_id, payload.operator_note)
        engine.set_plan_status("approved")
        return {"status": "approved", "plan": approved}
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@app.post("/plan/{plan_id}/reject")
def plan_reject(plan_id: str, payload: PlanRejectRequest = PlanRejectRequest()) -> Dict[str, Any]:
    """
    Reject pending proposal, leaving active_plan unchanged and recording an audit event.
    """
    import approval
    try:
        rejected = approval.reject_proposal(plan_id, payload.reason)
        engine.set_plan_status("rejected")
        return {"status": "rejected", "plan": rejected}
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@app.get("/plan/events")
@app.get("/events")
def plan_events() -> List[Dict[str, Any]]:
    """Return chronological audit event log."""
    import approval
    return approval.get_audit_events()




# ---------------------------------------------------------------------------
# Server startup
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
