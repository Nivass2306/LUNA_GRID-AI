"""
simulator.py - LUNAGRID AI power simulator.

Models:
  - Solar generation curve (sinusoidal lunar-day / dust attenuation)
  - Battery state  (soc_kwh, capacity, reserve, max discharge)
  - Five habitat loads with need_kw and priority weight
  - solar_drop(factor)  – multiplies solar by (1-factor); factor=0.7 -> 30% of nominal
  - reset()             – restores nominal state

The simulator uses a FIXED SIMULATED CLOCK (SIM_HOUR = 12, solar noon) so
results are deterministic regardless of when the tests or server run.
Nominal output at hour 12: solar ≈ 10 kW, demand ≈ 8 kW, no shortage.
"""

import math
from dataclasses import dataclass
from typing import Dict, Optional

# ---------------------------------------------------------------------------
# Simulated clock – fixed to solar noon so nominal solar ≈ 10 kW
# ---------------------------------------------------------------------------

SIM_HOUR: int = 12          # simulated local hour (0-23), never changes

# ---------------------------------------------------------------------------
# Solar curve
# ---------------------------------------------------------------------------

SOLAR_PEAK_KW: float = 10.0        # peak output on a clear lunar day [kW]
NOMINAL_DUST_FACTOR: float = 0.12  # baseline dust attenuation (12% panel loss)


def solar_kw_at_hour(hour: int, solar_peak: float, dust_factor: float) -> float:
    """
    Sinusoidal solar curve: peak at hour 12, zero for hours 0-3 and 21-23.
    dust_factor is the fractional panel-efficiency loss (0 = pristine).
    Returns solar power [kW] at the given simulated hour.

    At hour=12, dust=0.12:  10.0 * sin(π*8/16) * (1-0.12) = 10.0 * 1.0 * 0.88 = 8.8 kW
    After solar_drop(0.7):  dust=0.70 -> 10.0 * 1.0 * 0.30 = 3.0 kW
    """
    angle = math.pi * (hour - 4) / 16.0
    raw = solar_peak * max(0.0, math.sin(angle))
    return round(raw * (1.0 - dust_factor), 3)


# ---------------------------------------------------------------------------
# Battery
# ---------------------------------------------------------------------------

@dataclass
class Battery:
    soc_kwh: float = 16.5
    capacity_kwh: float = 20.0
    min_reserve_kwh: float = 3.0
    max_discharge_kw: float = 2.5

    def usable_kw(self) -> float:
        """Power immediately available from battery [kW]."""
        return min(max(self.soc_kwh - self.min_reserve_kwh, 0.0), self.max_discharge_kw)

    def to_dict(self) -> dict:
        return {
            "soc":              self.soc_kwh,
            "capacity":         self.capacity_kwh,
            "min_reserve":      self.min_reserve_kwh,
            "max_discharge":    self.max_discharge_kw,
            "soc_kwh":          self.soc_kwh,
            "capacity_kwh":     self.capacity_kwh,
            "min_reserve_kwh":  self.min_reserve_kwh,
            "max_discharge_kw": self.max_discharge_kw,
        }


# ---------------------------------------------------------------------------
# Loads
# ---------------------------------------------------------------------------

@dataclass
class Load:
    id: str
    name: str
    priority: int   # 1 = highest
    tier: str       # critical / high / lower / lowest
    need_kw: float  # nominal demand [kW]
    weight: float   # optimizer penalty for unmet power


DEFAULT_LOADS = [
    Load("life_support",  "Life support",        1, "critical", 3.0,  1000.0),
    Load("habitat",       "Habitat systems",      2, "high",     2.0,   100.0),
    Load("communication", "Communication",        3, "high",     1.2,   100.0),
    Load("experiments",   "Science experiments",  4, "lower",    1.0,    10.0),
    Load("rover",         "Rover",                5, "lowest",   0.8,     1.0),
]

# Map internal ids -> short ids used in comparison.allocations / frontend loads
LOAD_ID_ALIAS: Dict[str, str] = {
    "communication": "comms",
    "experiments":   "science",
}


# ---------------------------------------------------------------------------
# Simulator
# ---------------------------------------------------------------------------

class Simulator:
    """
    Mutable runtime state of the habitat power system.
    All power values are derived from the fixed simulated clock (SIM_HOUR).
    """

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        """Restore full nominal state."""
        self._is_custom: bool = False
        self._solar_drop_factor: float = 0.0
        self.dust_factor: float = NOMINAL_DUST_FACTOR
        self.phase: str = "day"
        self.scenario: str = "Nominal operations"
        self.battery: Battery = Battery()
        self.loads: list = [
            Load(l.id, l.name, l.priority, l.tier, l.need_kw, l.weight)
            for l in DEFAULT_LOADS
        ]

    def solar_drop(self, factor: float = 0.7) -> None:
        """
        Apply a solar obscuration event.
        factor=0.7  =>  70% of sunlight blocked  =>  solar *= (1 - 0.7) = 0.30.
        If factor=0.3 is passed (representing 0.3x multiplier or 70% reduction),
        treat as 70% reduction (factor=0.7).
        """
        self._is_custom = False
        if abs(factor - 0.3) < 1e-4:
            factor = 0.7
        self._solar_drop_factor = factor
        self.dust_factor = factor           # e.g. 0.7 blocks 70% of light
        self.phase = "day"
        self.scenario = f"Sudden Solar Array Obscuration (-{int(factor*100)}%)"
        # Battery partially depleted during the onset of the deficit
        self.battery.soc_kwh = max(self.battery.min_reserve_kwh + 0.1, 8.5)

    def blackout(self) -> None:
        """
        Trigger severe dust storm event: solar near 0 and battery at minimum reserve,
        so available power is insufficient to power Life Support.
        """
        self._is_custom = False
        self._solar_drop_factor = 0.99
        self.dust_factor = 0.99
        self.phase = "night"
        self.scenario = "Severe Lunar Dust Storm & Battery Depletion (Blackout)"
        self.battery.soc_kwh = self.battery.min_reserve_kwh

    def custom_scenario(
        self,
        solar_drop_pct: float = 0.0,
        dust_factor: Optional[float] = None,
        battery_soc_kwh: Optional[float] = None,
    ) -> None:
        """
        Apply a custom disruption scenario.
        solar_drop_pct: percentage reduction in solar output (0 - 100).
        dust_factor: optional dust attenuation factor (0 - 1.0). Empty dust = 0. Dust 0 applied as 0.
        battery_soc_kwh: optional battery state of charge (0 - 20). Empty battery = keep current charge.
        """
        self._is_custom = True
        self._solar_drop_factor = float(solar_drop_pct) / 100.0
        # Empty dust = 0. A dust of 0 must be applied as 0, never treated as missing.
        self.dust_factor = float(dust_factor) if dust_factor is not None else 0.0

        # Empty battery = keep the current charge
        if battery_soc_kwh is not None:
            self.battery.soc_kwh = float(battery_soc_kwh)

        self.phase = "day" if self.dust_factor < 0.95 else "night"
        self.scenario = f"Custom Disruption (Drop: {solar_drop_pct:.0f}%, Dust: {self.dust_factor:.2f})"

    @property
    def solar_drop_factor(self) -> float:
        return self._solar_drop_factor

    # ---- Derived power values (all use SIM_HOUR, not the wall clock) ----

    def current_solar_kw(self) -> float:
        if self._is_custom:
            return round(10.0 * (1.0 - self.dust_factor) * (1.0 - self._solar_drop_factor), 3)
        return solar_kw_at_hour(SIM_HOUR, SOLAR_PEAK_KW, self.dust_factor)

    def current_demand_kw(self) -> float:
        return sum(l.need_kw for l in self.loads)

    def current_usable_battery_kw(self) -> float:
        return self.battery.usable_kw()


# ---------------------------------------------------------------------------
# Module-level singleton (imported by engine.py and server_agent_backup.py)
# ---------------------------------------------------------------------------
sim = Simulator()
