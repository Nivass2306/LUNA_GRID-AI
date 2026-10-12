// High-fidelity mock fixtures adhering strictly to the LUNAGRID AI JSON contract

const generate24hForecast = (mode = 'nominal') => {
  const forecast = [];
  for (let h = 0; h < 24; h++) {
    let solar_kw = 10.0;
    let demand_kw = 8.0;
    let usable_battery_kw = 2.0;

    if (mode === 'nominal') {
      // Steady solar day with minor variations
      solar_kw = +(9.8 + Math.sin(h / 3) * 0.5).toFixed(1);
      demand_kw = +(7.8 + Math.cos(h / 4) * 0.4).toFixed(1);
      usable_battery_kw = 2.5;
    } else if (mode === 'after_drop') {
      // Solar drops at hour 2 to ~3.0kW, persists until hour 9
      if (h >= 2 && h <= 9) {
        solar_kw = +(3.0 + Math.sin(h) * 0.2).toFixed(1);
      } else if (h > 9 && h <= 14) {
        solar_kw = +(5.0 + Math.sin(h) * 0.4).toFixed(1);
      } else {
        solar_kw = +(8.5 + Math.sin(h) * 0.3).toFixed(1);
      }
      demand_kw = +(8.0 + (h >= 4 && h <= 8 ? 0.4 : 0.0)).toFixed(1);
      usable_battery_kw = +(Math.max(0.5, 2.5 - (h >= 2 && h <= 9 ? (h - 2) * 0.25 : 0))).toFixed(1);
    } else if (mode === 'unsafe') {
      // Catastrophic solar loss and drained battery
      solar_kw = +(1.0 + Math.sin(h) * 0.1).toFixed(1);
      demand_kw = +(8.2 + Math.cos(h) * 0.2).toFixed(1);
      usable_battery_kw = +(Math.max(0, 0.6 - h * 0.08)).toFixed(1);
    }

    forecast.push({
      hour: h,
      solar_kw,
      demand_kw,
      usable_battery_kw,
    });
  }
  return forecast;
};

export const nominalState = {
  timestamp: "2026-03-14T10:00:00Z",
  mission: {
    mode: "moon",
    phase: "day",
    dust_factor: 0.12,
    scenario: "Nominal Base Operations"
  },
  power: {
    solar_kw: 10.0,
    demand_kw: 8.0,
    usable_battery_kw: 2.0,
    available_kw: 12.0
  },
  battery: {
    soc_kwh: 16.5,
    capacity_kwh: 20.0,
    min_reserve_kwh: 3.0,
    max_discharge_kw: 2.5
  },
  survival: {
    hours_now: 18.0,
    hours_before: 18.0
  },
  alert: {
    level: "green",
    life_support_ok: true,
    title: "NOMINAL",
    message: "Solar generation exceeds base baseline. Storage cells floating at optimal buffer."
  },
  risk: {
    shortage_expected: false,
    start_hour: 0,
    end_hour: 0,
    max_deficit_kw: 0.0
  },
  forecast: generate24hForecast('nominal'),
  loads: [
    {
      id: "life_support",
      name: "Life support",
      priority: 1,
      tier: "critical",
      need_kw: 3.0,
      allocated_kw: 3.0,
      status: "Protected",
      reason: "Atmospheric scrubbers, cabin pressurization, and thermal loops fully sustained."
    },
    {
      id: "habitat",
      name: "Habitat systems",
      priority: 2,
      tier: "high",
      need_kw: 2.0,
      allocated_kw: 2.0,
      status: "Protected",
      reason: "Internal lighting, air circulation, and water reclamation fully sustained."
    },
    {
      id: "comms",
      name: "Communication",
      priority: 3,
      tier: "high",
      need_kw: 1.2,
      allocated_kw: 1.2,
      status: "Protected",
      reason: "Earth high-gain dish and lunar orbiter relay links operating at full telemetry."
    },
    {
      id: "science",
      name: "Science experiments",
      priority: 4,
      tier: "lower",
      need_kw: 1.0,
      allocated_kw: 1.0,
      status: "Protected",
      reason: "Sub-surface drill core sampling and regolith spectrometer running continuous cycles."
    },
    {
      id: "rover",
      name: "Rover",
      priority: 5,
      tier: "lowest",
      need_kw: 0.8,
      allocated_kw: 0.8,
      status: "Protected",
      reason: "Pressurized rover charging dock operating at target rate."
    }
  ],
  comparison: [
    {
      policy: "equal_split",
      label: "Equal split",
      life_support_ok: false,
      unmet_kw: 0.0,
      allocations: {
        life_support: 2.0,
        habitat: 2.0,
        comms: 1.2,
        science: 1.0,
        rover: 0.8
      }
    },
    {
      policy: "fixed_rules",
      label: "Fixed rules",
      life_support_ok: true,
      unmet_kw: 0.0,
      allocations: {
        life_support: 3.0,
        habitat: 2.0,
        comms: 1.2,
        science: 1.0,
        rover: 0.8
      }
    },
    {
      policy: "spacegrid",
      label: "LUNAGRID AI",
      life_support_ok: true,
      unmet_kw: 0.0,
      allocations: {
        life_support: 3.0,
        habitat: 2.0,
        comms: 1.2,
        science: 1.0,
        rover: 0.8
      }
    }
  ],
  plan: {
    status: "approved"
  },
  replan_ms: 18
};

export const afterDropState = {
  timestamp: "2026-03-14T10:04:12Z",
  mission: {
    mode: "moon",
    phase: "day",
    dust_factor: 0.74,
    scenario: "Sudden Solar Array Obscuration (-70%)"
  },
  power: {
    solar_kw: 3.0,
    demand_kw: 8.0,
    usable_battery_kw: 2.5,
    available_kw: 5.5
  },
  battery: {
    soc_kwh: 8.5,
    capacity_kwh: 20.0,
    min_reserve_kwh: 3.0,
    max_discharge_kw: 2.5
  },
  survival: {
    hours_now: 6.0,
    hours_before: 18.0
  },
  alert: {
    level: "red",
    life_support_ok: true,
    title: "CRITICAL",
    message: "Solar generation decreased by 70%. Available power 5.5 kW cannot satisfy 8.0 kW demand. Habitat & Comms throttled; Science postponed."
  },
  risk: {
    shortage_expected: true,
    start_hour: 2,
    end_hour: 9,
    max_deficit_kw: 4.2
  },
  forecast: generate24hForecast('after_drop'),
  loads: [
    {
      id: "life_support",
      name: "Life support",
      priority: 1,
      tier: "critical",
      need_kw: 3.0,
      allocated_kw: 3.0,
      status: "Protected",
      reason: "Critical priority locked: O2 scrubbing, air circulation, and heating isolated from load shed."
    },
    {
      id: "habitat",
      name: "Habitat systems",
      priority: 2,
      tier: "high",
      need_kw: 2.0,
      allocated_kw: 1.3,
      status: "Reduced",
      reason: "Throttled aux lighting and galley appliances by 35% to maintain vital life support margins."
    },
    {
      id: "comms",
      name: "Communication",
      priority: 3,
      tier: "high",
      need_kw: 1.2,
      allocated_kw: 0.9,
      status: "Reduced",
      reason: "Switched to low-bandwidth emergency beacon mode; broadband telemetry links suspended."
    },
    {
      id: "science",
      name: "Science experiments",
      priority: 4,
      tier: "lower",
      need_kw: 1.0,
      allocated_kw: 0.3,
      status: "Postponed",
      reason: "Automated core sample refrigeration held in standby; active drilling suspended until solar recovery."
    },
    {
      id: "rover",
      name: "Rover",
      priority: 5,
      tier: "lowest",
      need_kw: 0.8,
      allocated_kw: 0.0,
      status: "Off",
      reason: "Docking bay charger isolated completely; rover battery reserve sufficient for 36 hours dormant."
    }
  ],
  comparison: [
    {
      policy: "equal_split",
      label: "Equal split",
      life_support_ok: false,
      unmet_kw: 2.5,
      allocations: {
        life_support: 1.6,
        habitat: 1.4,
        comms: 1.0,
        science: 0.9,
        rover: 0.6
      }
    },
    {
      policy: "fixed_rules",
      label: "Fixed rules",
      life_support_ok: true,
      unmet_kw: 2.5,
      allocations: {
        life_support: 3.0,
        habitat: 2.0,
        comms: 0.5,
        science: 0.0,
        rover: 0.0
      }
    },
    {
      policy: "spacegrid",
      label: "LUNAGRID AI",
      life_support_ok: true,
      unmet_kw: 2.5,
      allocations: {
        life_support: 3.0,
        habitat: 1.3,
        comms: 0.9,
        science: 0.3,
        rover: 0.0
      }
    }
  ],
  plan: {
    status: "pending"
  },
  replan_ms: 42
};

export const unsafeState = {
  timestamp: "2026-03-14T10:18:45Z",
  mission: {
    mode: "moon",
    phase: "night",
    dust_factor: 0.95,
    scenario: "Extreme Solar Failure & Deep Depletion"
  },
  power: {
    solar_kw: 1.0,
    demand_kw: 8.0,
    usable_battery_kw: 0.5,
    available_kw: 1.5
  },
  battery: {
    soc_kwh: 2.8,
    capacity_kwh: 20.0,
    min_reserve_kwh: 3.0,
    max_discharge_kw: 1.0
  },
  survival: {
    hours_now: 1.5,
    hours_before: 18.0
  },
  alert: {
    level: "red",
    life_support_ok: false,
    title: "CRITICAL",
    message: "Total available power (1.5 kW) is below Life Support minimum requirement (3.0 kW). Immediate human command escalation required."
  },
  risk: {
    shortage_expected: true,
    start_hour: 0,
    end_hour: 16,
    max_deficit_kw: 6.5
  },
  forecast: generate24hForecast('unsafe'),
  loads: [
    {
      id: "life_support",
      name: "Life support",
      priority: 1,
      tier: "critical",
      need_kw: 3.0,
      allocated_kw: 1.5,
      status: "Unmet",
      reason: "Deficit of 1.5 kW on primary life support. Oxygen generation operating on emergency secondary tanks only."
    },
    {
      id: "habitat",
      name: "Habitat systems",
      priority: 2,
      tier: "high",
      need_kw: 2.0,
      allocated_kw: 0.0,
      status: "Off",
      reason: "All non-essential habitat power severed to preserve remaining watt-hours for life support loop."
    },
    {
      id: "comms",
      name: "Communication",
      priority: 3,
      tier: "high",
      need_kw: 1.2,
      allocated_kw: 0.0,
      status: "Off",
      reason: "Primary transceiver offline. Passive VHF survival beacon powered by internal coin cells."
    },
    {
      id: "science",
      name: "Science experiments",
      priority: 4,
      tier: "lower",
      need_kw: 1.0,
      allocated_kw: 0.0,
      status: "Off",
      reason: "Science load fully severed."
    },
    {
      id: "rover",
      name: "Rover",
      priority: 5,
      tier: "lowest",
      need_kw: 0.8,
      allocated_kw: 0.0,
      status: "Off",
      reason: "Rover charging completely isolated."
    }
  ],
  comparison: [
    {
      policy: "equal_split",
      label: "Equal split",
      life_support_ok: false,
      unmet_kw: 6.5,
      allocations: {
        life_support: 0.3,
        habitat: 0.3,
        comms: 0.3,
        science: 0.3,
        rover: 0.3
      }
    },
    {
      policy: "fixed_rules",
      label: "Fixed rules",
      life_support_ok: false,
      unmet_kw: 6.5,
      allocations: {
        life_support: 1.5,
        habitat: 0.0,
        comms: 0.0,
        science: 0.0,
        rover: 0.0
      }
    },
    {
      policy: "spacegrid",
      label: "LUNAGRID AI",
      life_support_ok: false,
      unmet_kw: 6.5,
      allocations: {
        life_support: 1.5,
        habitat: 0.0,
        comms: 0.0,
        science: 0.0,
        rover: 0.0
      }
    }
  ],
  plan: {
    status: "pending"
  },
  replan_ms: 64
};
