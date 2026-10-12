"""
load_nasa.py - NASA POWER hourly solar data loader & feature engineering for LUNAGRID AI.

Loads hourly Earth-based insolation and atmospheric records from NASA POWER
(backend/data/real/nasa_power_hourly.csv) as an empirical analogue for solar generation modeling.

Engineered Features:
- Cyclic hour of day: sin/cos
- Cyclic day of year: sin/cos
- Clear-sky model: clear_sky_kw
- Autoregressive lags: lag 1h, lag 24h (prior observations only)
- Rolling means: 6h rolling mean, 24h rolling mean (shifted to prevent data leakage)
- Weather observations: temperature_c, relative_humidity_pct, wind_speed_ms
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Tuple, Optional
import numpy as np
import pandas as pd


DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "real" / "nasa_power_hourly.csv"

FEATURE_COLUMNS = [
    "hour_sin",
    "hour_cos",
    "doy_sin",
    "doy_cos",
    "clear_sky_kw",
    "lag_1h",
    "lag_24h",
    "rolling_mean_6h",
    "rolling_mean_24h",
    "temperature_c",
    "relative_humidity_pct",
    "wind_speed_ms",
]

TARGET_COLUMNS = [f"target_h{i}" for i in range(1, 25)]
BASELINE_COLUMNS = [f"baseline_h{i}" for i in range(1, 25)]


def load_raw_nasa_data(csv_path: Optional[Path | str] = None) -> pd.DataFrame:
    """Load raw NASA POWER CSV into a pandas DataFrame."""
    path = Path(csv_path) if csv_path else DATA_PATH
    if not path.exists():
        raise FileNotFoundError(f"NASA POWER dataset not found at {path}")
    df = pd.read_csv(path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df.sort_values("timestamp").reset_index(drop=True)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Engineer cyclic time, autoregressive lag, and rolling statistics.
    Ensures zero future-data leakage by only utilizing past information up to forecast origin t.
    """
    df = df.copy()

    # Cyclic time encoding
    hour = df["hour"].values
    doy = df["day_of_year"].values
    df["hour_sin"] = np.sin(2 * np.pi * hour / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * hour / 24.0)
    df["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    df["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)

    # Autoregressive lags (strictly prior to forecast point t)
    solar = df["solar_generation_kw"]
    df["lag_1h"] = solar.shift(1)
    df["lag_24h"] = solar.shift(24)

    # Rolling statistics over prior windows (shift(1) ensures current hour is excluded)
    df["rolling_mean_6h"] = solar.shift(1).rolling(window=6, min_periods=1).mean()
    df["rolling_mean_24h"] = solar.shift(1).rolling(window=24, min_periods=1).mean()

    # 24-step ahead targets: target_h1 = t+1, ..., target_h24 = t+24
    for step in range(1, 25):
        df[f"target_h{step}"] = solar.shift(-step)

    # 24-step ahead baseline predictions: "same hour yesterday"
    # For target at t + step, yesterday's observation is at (t + step - 24).
    # Since step ranges from 1 to 24:
    #   When step == 24, yesterday is t (shift(0), which is known at time t).
    #   When step < 24, yesterday is at index t - (24 - step), i.e. shift(24 - step).
    for step in range(1, 25):
        lag_needed = 24 - step
        df[f"baseline_h{step}"] = solar.shift(lag_needed)

    # Drop warm-up rows (first 24 rows lack lag_24h) and boundary rows (last 24 rows lack future targets)
    valid_mask = df["lag_24h"].notna() & df["target_h24"].notna() & df["baseline_h1"].notna()
    return df[valid_mask].reset_index(drop=True)


def load_dataset(
    csv_path: Optional[Path | str] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Load dataset and prepare features (X), targets (y), and baseline predictions (y_baseline).
    Returns (X, y, y_baseline, full_df).
    """
    raw_df = load_raw_nasa_data(csv_path)
    df = engineer_features(raw_df)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMNS]
    y_baseline = df[BASELINE_COLUMNS]

    return X, y, y_baseline, df
