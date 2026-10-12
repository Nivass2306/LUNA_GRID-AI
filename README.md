# SPACEGRID AI · Lunar Habitat Energy Advisor

**SPACEGRID AI** is the software "brain" of a lunar habitat mission-control console. It predicts solar drops, evaluates deficit risk, optimizes electrical power allocation across habitat loads by mission priority, and transparently explains optimization rationale to flight controllers.

> [!IMPORTANT]
> **Advisory Mode Only · Digital Twin Prototype**  
> This system is an advisory flight-control console and decision-support digital twin. The user interface does not claim to directly command or actuate physical habitat hardware. All allocations require flight controller authorization.

---

## ⚡ Tech Stack

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + Custom Dark Theme Tokens (`tokens.css`)
- **Telemetry Charts**: Recharts (`ComposedChart` with 24-hour horizon, gold solar area, demand line, usable battery dashed line, shortage window band)
- **Icons & Motion**: Lucide React + Framer Motion + Accessible CSS Keyframes
- **Offline Typography**: `@fontsource/space-grotesk`, `@fontsource/inter`, `@fontsource/jetbrains-mono`
  - Zero external CDN links, zero Google Fonts requests, zero remote asset dependencies.

---

## 🚀 Getting Started

### 1. Installation
```bash
cd frontend
npm install
```

### 2. Development Mode (Mock Data)
By default, the frontend starts with `VITE_USE_MOCK=true` and runs offline without requiring a live backend service:
```bash
npm run dev
```
The application will launch on `http://localhost:5173`.

### 3. Connecting to the FastAPI Backend
To connect to your teammate's live FastAPI backend:
1. Update `.env` (or run with environment variables):
   ```bash
   VITE_USE_MOCK=false
   VITE_API_URL=http://localhost:8000
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```

### 4. Production Build
```bash
npm run build
npm run preview
```

---

## 🛰️ Habitat Load Priority Hierarchy
Loads are strictly throttled according to the mission survivability hierarchy:
1. **Priority 1: Life Support** (*Critical*) — Atmospheric scrubbers, O2 generation, pressure loops. Locked from load shedding in all survivable scenarios.
2. **Priority 2: Habitat Systems** (*High*) — Internal lighting, air circulation, water recycling. Throttled during severe deficits.
3. **Priority 3: Communication** (*High*) — High-gain Earth dish and lunar relay links. Throttled to emergency beacon bandwidth during deficits.
4. **Priority 4: Science Experiments** (*Lower*) — Core drilling and regolith analysis. Suspended during solar drops.
5. **Priority 5: Rover** (*Lowest*) — Surface rover dock recharging. Isolated immediately upon shortage.

---

## 🧪 Scenario Verification Matrix
- **Nominal State** (`?scenario=nominal`): 10.0 kW solar, 8.0 kW demand, 18h survival time, Green alert, no shortage window.
- **-70% Solar Drop** (Triggered via red button or `?scenario=after_drop`): Solar drops to 3.0 kW, 4.2 kW max deficit across hours 2–9, survival drops to 6.0 h, life support protected, habitat/comms reduced, science/rover postponed/off.
- **UNSAFE State** (`?scenario=unsafe`): Available power (1.5 kW) falls below Life Support need (3.0 kW). Triggers full-width pulsing banner, red outline on Life Support row, Approve button replaced with *"Acknowledge & Escalate"*, and never labels Life Support as "Protected".
