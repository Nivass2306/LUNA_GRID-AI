"""
SPACEGRID AI Backend Service (Port 8000)
Implements FastAPI-compatible REST endpoints for lunar habitat power telemetry:
- GET /state
- POST /simulate/solar-drop
- POST /reset
- POST /plan/decision
Includes simulated real-world teammate telemetry fields to test front-end normalization.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import time
from datetime import datetime, timezone
import random

# Internal lunar habitat state
current_mode = "nominal"
operator_plan_status = "approved"

def get_forecast(mode="nominal"):
    forecast = []
    for h in range(24):
        if mode == "nominal":
            s = round(9.8 + random.uniform(-0.2, 0.4), 1)
            d = round(7.8 + random.uniform(-0.3, 0.3), 1)
            b = 2.5
        elif mode == "after_drop":
            if 2 <= h <= 9:
                s = round(3.0 + random.uniform(-0.1, 0.2), 1)
            elif 9 < h <= 14:
                s = round(5.0 + random.uniform(-0.2, 0.3), 1)
            else:
                s = round(8.5 + random.uniform(-0.2, 0.2), 1)
            d = round(8.0 + (0.4 if 4 <= h <= 8 else 0.0), 1)
            b = round(max(0.5, 2.5 - (h - 2) * 0.25 if 2 <= h <= 9 else 2.5), 1)
        else: # unsafe
            s = 1.0
            d = 8.2
            b = 0.5
        
        forecast.append({
            "hour": h,
            "solar": s,                  # Teammate mismatch: 'solar' instead of 'solar_kw'
            "demand": d,                 # Teammate mismatch: 'demand' instead of 'demand_kw'
            "usable_battery": b,         # Teammate mismatch: 'usable_battery' instead of 'usable_battery_kw'
            "solar_kw": s,
            "demand_kw": d,
            "usable_battery_kw": b
        })
    return forecast

def build_state(mode="nominal"):
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    replan_ms = random.randint(34, 58) if mode != "nominal" else 19

    if mode == "nominal":
        return {
            "timestamp": now_iso,
            "mission": {
                "mode": "moon",
                "phase": "day",
                "dust_factor": 0.12,
                "scenario": "Nominal operations"
            },
            "power": {
                "solar": 10.0,            # Teammate mismatch: 'solar' instead of 'solar_kw'
                "demand": 8.0,            # Teammate mismatch: 'demand' instead of 'demand_kw'
                "usable_battery": 2.0,    # Teammate mismatch: 'usable_battery' instead of 'usable_battery_kw'
                "available": 12.0,        # Teammate mismatch: 'available' instead of 'available_kw'
                "solar_kw": 10.0,
                "demand_kw": 8.0,
                "usable_battery_kw": 2.0,
                "available_kw": 12.0
            },
            "battery": {
                "soc": 16.5,              # Teammate mismatch: 'soc' instead of 'soc_kwh'
                "capacity": 20.0,         # Teammate mismatch: 'capacity' instead of 'capacity_kwh'
                "min_reserve": 3.0,       # Teammate mismatch: 'min_reserve' instead of 'min_reserve_kwh'
                "max_discharge": 2.5,     # Teammate mismatch: 'max_discharge' instead of 'max_discharge_kw'
                "soc_kwh": 16.5,
                "capacity_kwh": 20.0,
                "min_reserve_kwh": 3.0,
                "max_discharge_kw": 2.5
            },
            "survival": {
                "hours_now": 18.0,
                "hours_before": 18.0
            },
            "alert": {
                "level": "green",
                "life_support": True,     # Teammate mismatch: 'life_support' instead of 'life_support_ok'
                "life_support_ok": True,
                "title": "NOMINAL",
                "message": "Solar array nominal. All habitat sub-systems fully powered."
            },
            "risk": {
                "shortage": False,        # Teammate mismatch: 'shortage' instead of 'shortage_expected'
                "shortage_expected": False,
                "start_hour": 0,
                "end_hour": 0,
                "max_deficit": 0.0,       # Teammate mismatch: 'max_deficit' instead of 'max_deficit_kw'
                "max_deficit_kw": 0.0
            },
            "forecast": get_forecast("nominal"),
            "loads": [
                { "id": "life_support", "name": "Life support", "priority": 1, "tier": "critical", "need": 3.0, "allocated": 3.0, "need_kw": 3.0, "allocated_kw": 3.0, "status": "Protected", "reason": "Atmospheric scrubbers and thermal loops fully powered." },
                { "id": "habitat", "name": "Habitat systems", "priority": 2, "tier": "high", "need": 2.0, "allocated": 2.0, "need_kw": 2.0, "allocated_kw": 2.0, "status": "Protected", "reason": "Internal lighting, air circulation, and recycling nominal." },
                { "id": "comms", "name": "Communication", "priority": 3, "tier": "high", "need": 1.2, "allocated": 1.2, "need_kw": 1.2, "allocated_kw": 1.2, "status": "Protected", "reason": "High-gain Earth dish transmitting continuous telemetry." },
                { "id": "science", "name": "Science experiments", "priority": 4, "tier": "lower", "need": 1.0, "allocated": 1.0, "need_kw": 1.0, "allocated_kw": 1.0, "status": "Protected", "reason": "Continuous core sample spectrometer runs active." },
                { "id": "rover", "name": "Rover", "priority": 5, "tier": "lowest", "need": 0.8, "allocated": 0.8, "need_kw": 0.8, "allocated_kw": 0.8, "status": "Protected", "reason": "Pressurized rover charging pad operating at target voltage." }
            ],
            "comparison": [
                { "policy": "equal_split", "label": "Equal split", "life_support_ok": False, "unmet_kw": 0.0, "allocations": { "life_support": 2.0, "habitat": 2.0, "comms": 1.2, "science": 1.0, "rover": 0.8 } },
                { "policy": "fixed_rules", "label": "Fixed rules", "life_support_ok": True, "unmet_kw": 0.0, "allocations": { "life_support": 3.0, "habitat": 2.0, "comms": 1.2, "science": 1.0, "rover": 0.8 } },
                { "policy": "spacegrid", "label": "SPACEGRID AI", "life_support_ok": True, "unmet_kw": 0.0, "allocations": { "life_support": 3.0, "habitat": 2.0, "comms": 1.2, "science": 1.0, "rover": 0.8 } }
            ],
            "plan": { "status": operator_plan_status },
            "replan_time_ms": replan_ms,   # Teammate mismatch: 'replan_time_ms' instead of 'replan_ms'
            "replan_ms": replan_ms
        }
    else: # after_drop
        return {
            "timestamp": now_iso,
            "mission": {
                "mode": "moon",
                "phase": "day",
                "dust_factor": 0.74,
                "scenario": "Sudden Solar Array Obscuration (-70%)"
            },
            "power": {
                "solar": 3.0,
                "demand": 8.0,
                "usable_battery": 2.5,
                "available": 5.5,
                "solar_kw": 3.0,
                "demand_kw": 8.0,
                "usable_battery_kw": 2.5,
                "available_kw": 5.5
            },
            "battery": {
                "soc": 8.5,
                "capacity": 20.0,
                "min_reserve": 3.0,
                "max_discharge": 2.5,
                "soc_kwh": 8.5,
                "capacity_kwh": 20.0,
                "min_reserve_kwh": 3.0,
                "max_discharge_kw": 2.5
            },
            "survival": {
                "hours_now": 6.0,
                "hours_before": 18.0
            },
            "alert": {
                "level": "red",
                "life_support": True,
                "life_support_ok": True,
                "title": "CRITICAL",
                "message": "Solar drop detected (-70%). Available power 5.5 kW. Habitat and Comms reduced to preserve Life Support."
            },
            "risk": {
                "shortage": True,
                "shortage_expected": True,
                "start_hour": 2,
                "end_hour": 9,
                "max_deficit": 4.2,
                "max_deficit_kw": 4.2
            },
            "forecast": get_forecast("after_drop"),
            "loads": [
                { "id": "life_support", "name": "Life support", "priority": 1, "tier": "critical", "need": 3.0, "allocated": 3.0, "need_kw": 3.0, "allocated_kw": 3.0, "status": "Protected", "reason": "Critical priority locked: O2 scrubbing and heating protected." },
                { "id": "habitat", "name": "Habitat systems", "priority": 2, "tier": "high", "need": 2.0, "allocated": 1.3, "need_kw": 2.0, "allocated_kw": 1.3, "status": "Reduced", "reason": "Throttled lighting and aux circulation by 35%." },
                { "id": "comms", "name": "Communication", "priority": 3, "tier": "high", "need": 1.2, "allocated": 0.9, "need_kw": 1.2, "allocated_kw": 0.9, "status": "Reduced", "reason": "Switched to low-bandwidth emergency beacon mode." },
                { "id": "science", "name": "Science experiments", "priority": 4, "tier": "lower", "need": 1.0, "allocated": 0.3, "need_kw": 1.0, "allocated_kw": 0.3, "status": "Postponed", "reason": "Active drilling paused; sample refrigeration insulated." },
                { "id": "rover", "name": "Rover", "priority": 5, "tier": "lowest", "need": 0.8, "allocated": 0.0, "need_kw": 0.8, "allocated_kw": 0.0, "status": "Off", "reason": "Dock charging isolated; rover on internal reserves." }
            ],
            "comparison": [
                { "policy": "equal_split", "label": "Equal split", "life_support_ok": False, "unmet_kw": 2.5, "allocations": { "life_support": 1.6, "habitat": 1.4, "comms": 1.0, "science": 0.9, "rover": 0.6 } },
                { "policy": "fixed_rules", "label": "Fixed rules", "life_support_ok": True, "unmet_kw": 2.5, "allocations": { "life_support": 3.0, "habitat": 2.0, "comms": 0.5, "science": 0.0, "rover": 0.0 } },
                { "policy": "spacegrid", "label": "SPACEGRID AI", "life_support_ok": True, "unmet_kw": 2.5, "allocations": { "life_support": 3.0, "habitat": 1.3, "comms": 0.9, "science": 0.3, "rover": 0.0 } }
            ],
            "plan": { "status": operator_plan_status },
            "replan_time_ms": replan_ms,
            "replan_ms": replan_ms
        }

class SpacegridHandler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        global current_mode
        if self.path == "/state" or self.path.startswith("/state?"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            data = build_state(current_mode)
            self.wfile.write(json.dumps(data).encode("utf-8"))
        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(b'{"status":"ok","service":"spacegrid-backend"}')
        else:
            self.send_response(404)
            self._send_cors()
            self.end_headers()
            self.wfile.write(b'{"detail":"Not found"}')

    def do_POST(self):
        global current_mode, operator_plan_status
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b""
        
        parsed = {}
        if body:
            try:
                parsed = json.loads(body.decode("utf-8"))
            except:
                pass

        if self.path == "/simulate/solar-drop":
            current_mode = "after_drop"
            operator_plan_status = "pending"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            data = build_state(current_mode)
            self.wfile.write(json.dumps(data).encode("utf-8"))
        elif self.path == "/reset":
            current_mode = "nominal"
            operator_plan_status = "approved"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            data = build_state(current_mode)
            self.wfile.write(json.dumps(data).encode("utf-8"))
        elif self.path == "/plan/decision":
            dec = parsed.get("decision", "approve")
            operator_plan_status = "approved" if dec == "approve" else "rejected"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            data = build_state(current_mode)
            self.wfile.write(json.dumps(data).encode("utf-8"))
        else:
            self.send_response(404)
            self._send_cors()
            self.end_headers()
            self.wfile.write(b'{"detail":"Not found"}')

def run_server():
    server_address = ("127.0.0.1", 8000)
    httpd = HTTPServer(server_address, SpacegridHandler)
    print("SPACEGRID Backend listening on http://127.0.0.1:8000")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()
