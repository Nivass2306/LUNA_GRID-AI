"""
train_xgboost.py - Offline training pipeline for 24-hour solar generation forecasting.

Model Strategy: Direct Multi-Step Regression vs Recursive Single-Step
---------------------------------------------------------------------
We choose the Direct Multi-Step approach (predicting the 24-hour horizon simultaneously)
over recursive single-step roll-forward for the following reasons:
1. Error Stability: Recursive forecasting feeds its own predictions back into lag and rolling
   windows, causing errors to compound rapidly over a 24-hour horizon. Direct forecasting
   avoids this compounding error cascade.
2. Production Simplicity: Serving requires a single instantaneous matrix inference pass
   (model.predict(X)) rather than an iterative state-mutation loop that updates 1h and 24h
   lags step-by-step.
3. Feature Integrity: All input features are guaranteed to be real observations known at the
   forecast origin time t, eliminating data leakage and error propagation.

Execution:
    python -m ml.train_xgboost
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error

# Ensure backend root is on sys.path for direct module execution
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from ml.load_nasa import load_dataset, FEATURE_COLUMNS, TARGET_COLUMNS, BASELINE_COLUMNS


MODELS_DIR = BACKEND_DIR / "models"
MODEL_PATH = MODELS_DIR / "solar_xgb.json"
METRICS_PATH = MODELS_DIR / "solar_xgb_metrics.json"


def train_and_evaluate(
    split_ratio: float = 0.8,
    save_artifacts: bool = True,
) -> dict:
    """
    Train XGBoost 24-hour solar forecast model with chronological time split.
    Evaluates against 'same hour yesterday' baseline on held-out test data.
    """
    print("=" * 70)
    print("LUNAGRID AI · XGBoost Solar Generation Training Pipeline")
    print("=" * 70)

    # 1. Load data and features
    print("[1/5] Loading NASA POWER hourly dataset and engineering features...")
    X, y, y_baseline, df = load_dataset()
    total_samples = len(X)
    print(f"      Total feature rows: {total_samples}")
    print(f"      Input features ({len(FEATURE_COLUMNS)}): {', '.join(FEATURE_COLUMNS)}")

    # 2. Strict chronological time split (no random shuffling)
    print(f"[2/5] Performing chronological time split ({int(split_ratio*100)}% train / {int((1-split_ratio)*100)}% test)...")
    split_idx = int(total_samples * split_ratio)

    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    y_base_test = y_baseline.iloc[split_idx:]

    train_rows = len(X_train)
    test_rows = len(X_test)
    print(f"      Training set: {train_rows} hours ({df['timestamp'].iloc[0]} to {df['timestamp'].iloc[split_idx-1]})")
    print(f"      Test set:     {test_rows} hours ({df['timestamp'].iloc[split_idx]} to {df['timestamp'].iloc[-1]})")

    # 3. Train XGBoost model
    print("[3/5] Training XGBoost multi-output regressor...")
    model = xgb.XGBRegressor(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.03,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        tree_method="hist",
    )
    model.fit(X_train, y_train)

    # 4. Predict and evaluate
    print("[4/5] Evaluating performance on held-out test set...")
    y_pred = model.predict(X_test)
    # Clamp negative predictions to 0.0 kW
    y_pred = np.clip(y_pred, 0.0, None)

    # Calculate metrics for XGBoost
    y_test_arr = y_test.values
    y_base_arr = y_base_test.values

    xgb_mae = float(mean_absolute_error(y_test_arr, y_pred))
    xgb_rmse = float(np.sqrt(mean_squared_error(y_test_arr, y_pred)))

    # Calculate metrics for Baseline ("same hour yesterday")
    base_mae = float(mean_absolute_error(y_test_arr, y_base_arr))
    base_rmse = float(np.sqrt(mean_squared_error(y_test_arr, y_base_arr)))

    # Calculate improvement
    mae_reduction_pct = ((base_mae - xgb_mae) / base_mae) * 100.0
    rmse_reduction_pct = ((base_rmse - xgb_rmse) / base_rmse) * 100.0

    print("\n" + "-" * 70)
    print(f"{'EVALUATION METRIC':<25} | {'BASELINE (Yesterday)':<20} | {'XGBOOST MODEL':<20}")
    print("-" * 70)
    print(f"{'MAE (kW)':<25} | {base_mae:<20.4f} | {xgb_mae:<20.4f}")
    print(f"{'RMSE (kW)':<25} | {base_rmse:<20.4f} | {xgb_rmse:<20.4f}")
    print(f"{'MAE Improvement':<25} | {'-':<20} | {mae_reduction_pct:>+.2f}%")
    print(f"{'RMSE Improvement':<25} | {'-':<20} | {rmse_reduction_pct:>+.2f}%")
    print("-" * 70 + "\n")

    metrics_payload = {
        "model_name": "xgboost",
        "mae_kw": round(xgb_mae, 4),
        "rmse_kw": round(xgb_rmse, 4),
        "baseline_mae_kw": round(base_mae, 4),
        "baseline_rmse_kw": round(base_rmse, 4),
        "mae_reduction_pct": round(mae_reduction_pct, 2),
        "rmse_reduction_pct": round(rmse_reduction_pct, 2),
        "train_rows": train_rows,
        "test_rows": test_rows,
        "features": FEATURE_COLUMNS,
        "horizon_hours": 24,
        "trained_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataset": "NASA POWER Hourly Solar & Meteorological Data (Earth-based stand-in for lunar solar)",
    }

    # 5. Save model and metrics
    if save_artifacts:
        print("[5/5] Saving model artifacts to disk...")
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        model.save_model(str(MODEL_PATH))
        with open(METRICS_PATH, "w", encoding="utf-8") as f:
            json.dump(metrics_payload, f, indent=2)
        print(f"      Model saved:   {MODEL_PATH}")
        print(f"      Metrics saved: {METRICS_PATH}")

    print("\nTraining completed successfully.\n")
    return metrics_payload


if __name__ == "__main__":
    train_and_evaluate()
