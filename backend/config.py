"""
config.py - LUNAGRID AI Configuration Constants

Provides unified environment-configurable constants for microgrid safety
and threshold monitors.
"""

import os

# Threshold below which Life support allocation triggers an active alert [kW]
LIFE_SUPPORT_ALERT_THRESHOLD_KW: float = float(
    os.getenv("LIFE_SUPPORT_ALERT_THRESHOLD_KW", "3.0")
)
