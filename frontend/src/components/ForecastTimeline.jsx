import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLunagridState } from '../context/LunagridContext';

export const ForecastTimeline = () => {
  const { state } = useLunagridState();
  const forecast = state?.forecast || [];
  const risk = state?.risk || {};
  const alert = state?.alert || {};

  const [hoverHour, setHoverHour] = useState(null);
  const prevSolarRef = useRef(null);

  // Keep track of ghost solar line from previous nominal state
  useEffect(() => {
    if (forecast.length > 0) {
      const avgSolar = forecast.reduce((acc, f) => acc + (f.solar_kw ?? f.solar ?? 0), 0) / forecast.length;
      if (avgSolar > 7.0) {
        // Record nominal solar curve
        prevSolarRef.current = forecast.map((f) => f.solar_kw ?? f.solar ?? 0);
      }
    }
  }, [forecast]);

  // Dimensions
  const width = 920;
  const height = 190;
  const padL = 50;
  const padR = 20;
  const padT = 16;
  const padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxKw = 12.0;

  const getX = (hour) => padL + (hour / 23) * chartW;
  const getY = (kw) => padT + (1 - Math.min(maxKw, Math.max(0, kw)) / maxKw) * chartH;

  // Shortage window coordinates
  const isShortage = risk.shortage_expected || risk.shortage;
  const startHour = Number(risk.shortage_start_hour ?? 2);
  const endHour = Number(risk.shortage_end_hour ?? 9);

  // Helper to build smooth SVG path through points
  const buildSmoothPath = (values) => {
    if (!values || values.length === 0) return '';
    return values.reduce((acc, val, i, arr) => {
      const x = getX(i);
      const y = getY(val);
      if (i === 0) return `M ${x} ${y}`;
      const prevX = getX(i - 1);
      const prevY = getY(arr[i - 1]);
      const cpX1 = prevX + (x - prevX) / 2;
      const cpX2 = prevX + (x - prevX) / 2;
      return `${acc} C ${cpX1} ${prevY}, ${cpX2} ${y}, ${x} ${y}`;
    }, '');
  };

  const solarValues = useMemo(() => forecast.map((f) => f.solar_kw ?? f.solar ?? 0), [forecast]);
  const demandValues = useMemo(() => forecast.map((f) => f.demand_kw ?? f.demand ?? 0), [forecast]);
  const batteryValues = useMemo(() => forecast.map((f) => f.usable_battery_kw ?? f.usable_battery ?? 0), [forecast]);

  const solarPath = useMemo(() => buildSmoothPath(solarValues), [solarValues]);
  const demandPath = useMemo(() => buildSmoothPath(demandValues), [demandValues]);
  const batteryPath = useMemo(() => buildSmoothPath(batteryValues), [batteryValues]);

  // Ghost line if current solar is depressed
  const ghostValues = prevSolarRef.current;
  const hasGhost = ghostValues && solarValues.length > 0 && solarValues[4] < 6.0;
  const ghostPath = useMemo(() => hasGhost ? buildSmoothPath(ghostValues) : '', [hasGhost, ghostValues]);

  // Handle scrubber dragging / hover
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relX = (clientX / rect.width) * width;
    if (relX < padL || relX > width - padR) {
      setHoverHour(null);
      return;
    }
    const ratio = (relX - padL) / chartW;
    const hour = Math.round(ratio * 23);
    setHoverHour(Math.max(0, Math.min(23, hour)));
  };

  const activeData = hoverHour !== null ? forecast[hoverHour] : null;

  return (
    <div className="w-full select-none mt-2">
      {/* Timeline Header & Legend */}
      <div className="flex items-center justify-between text-[13px] text-muted mb-2 font-sans">
        <div className="flex items-center gap-6">
          <span className="text-bone font-medium">24-hour power horizon</span>
          {isShortage && (
            <span className="font-mono text-[11px] text-danger">
              shortage: +{startHour}h to +{endHour}h
            </span>
          )}
        </div>
        <div className="flex items-center gap-5 text-[11px] font-sans">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-solar inline-block" />
            <span className="text-muted">Solar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-bone inline-block" />
            <span className="text-muted">Demand</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-battery inline-block" />
            <span className="text-muted">Usable battery</span>
          </div>
          {hasGhost && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dotted border-solar/40 inline-block" />
              <span className="text-muted">Pre-drop</span>
            </div>
          )}
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverHour(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair"
          aria-label="Power forecast timeline"
        >
          <defs>
            {/* Diagonal hatch for shortage window */}
            <pattern
              id="shortageHatch"
              width="8"
              height="8"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="8" stroke="#FF4A3D" strokeWidth="1.2" strokeOpacity="0.45" />
            </pattern>
          </defs>

          {/* Background Day/Night Bands */}
          {/* Lunar Day (0 - 18h) */}
          <rect
            x={getX(0)}
            y={padT}
            width={getX(18) - getX(0)}
            height={chartH}
            fill="#101013"
          />
          {/* Lunar Night (18 - 23h) */}
          <rect
            x={getX(18)}
            y={padT}
            width={getX(23) - getX(18)}
            height={chartH}
            fill="#0A0A0C"
          />
          <text
            x={getX(20.5)}
            y={padT + 14}
            fill="#8C877D"
            fontSize="10"
            fontFamily="Geist Sans"
            textAnchor="middle"
            opacity="0.6"
          >
            night
          </text>

          {/* Shortage Window Hatched Overlay */}
          {isShortage && (
            <g>
              <rect
                x={getX(startHour)}
                y={padT}
                width={getX(endHour) - getX(startHour)}
                height={chartH}
                fill="url(#shortageHatch)"
              />
              <line
                x1={getX(startHour)}
                y1={padT}
                x2={getX(startHour)}
                y2={padT + chartH}
                stroke="#FF4A3D"
                strokeWidth="1"
                strokeOpacity="0.7"
              />
              <line
                x1={getX(endHour)}
                y1={padT}
                x2={getX(endHour)}
                y2={padT + chartH}
                stroke="#FF4A3D"
                strokeWidth="1"
                strokeOpacity="0.7"
              />
            </g>
          )}

          {/* Horizontal Grid lines with kW labels */}
          {[12, 9, 6, 3, 0].map((kw) => (
            <g key={`grid-${kw}`}>
              <line
                x1={padL}
                y1={getY(kw)}
                x2={width - padR}
                y2={getY(kw)}
                stroke="rgba(237,232,223,0.06)"
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={getY(kw) + 3.5}
                fill="#8C877D"
                fontSize="11"
                fontFamily="Geist Mono"
                textAnchor="end"
              >
                {kw} kW
              </text>
            </g>
          ))}

          {/* X Axis Time Labels */}
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <text
              key={`x-${h}`}
              x={getX(h)}
              y={height - 6}
              fill="#8C877D"
              fontSize="11"
              fontFamily="Geist Mono"
              textAnchor="middle"
            >
              +{h}h
            </text>
          ))}

          {/* Now Vertical Line */}
          <line
            x1={getX(0)}
            y1={padT}
            x2={getX(0)}
            y2={padT + chartH}
            stroke="#EDE8DF"
            strokeWidth="1.5"
            strokeOpacity="0.8"
          />

          {/* Ghost solar curve */}
          {hasGhost && (
            <path
              d={ghostPath}
              fill="none"
              stroke="#FF9F1C"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              strokeOpacity="0.35"
            />
          )}

          {/* Usable Battery Line */}
          <path
            d={batteryPath}
            fill="none"
            stroke="#7DDFA4"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            strokeOpacity="0.85"
            className="transition-all duration-700"
          />

          {/* Demand Line */}
          <path
            d={demandPath}
            fill="none"
            stroke="#EDE8DF"
            strokeWidth="1.5"
            strokeOpacity="0.8"
            className="transition-all duration-700"
          />

          {/* Solar Line */}
          <path
            d={solarPath}
            fill="none"
            stroke="#FF9F1C"
            strokeWidth="2.5"
            strokeOpacity="0.95"
            className="transition-all duration-700"
          />

          {/* Scrubber / Crosshair when hovering */}
          {hoverHour !== null && (
            <g>
              <line
                x1={getX(hoverHour)}
                y1={padT}
                x2={getX(hoverHour)}
                y2={padT + chartH}
                stroke="#EDE8DF"
                strokeWidth="1"
                strokeDasharray="2 2"
                strokeOpacity="0.6"
              />
              {/* Point on solar */}
              <circle
                cx={getX(hoverHour)}
                cy={getY(solarValues[hoverHour])}
                r="4"
                fill="#FF9F1C"
                stroke="#0B0B0D"
                strokeWidth="1.5"
              />
              {/* Point on demand */}
              <circle
                cx={getX(hoverHour)}
                cy={getY(demandValues[hoverHour])}
                r="3"
                fill="#EDE8DF"
                stroke="#0B0B0D"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Card */}
        {activeData && hoverHour !== null && (
          <div
            className="absolute top-2 pointer-events-none bg-raised border border-hairline py-1.5 px-3 text-[12px] font-mono shadow-xl z-20"
            style={{
              left: `${Math.min(75, Math.max(10, (getX(hoverHour) / width) * 100))}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="text-muted text-[10px] mb-1 font-sans">
              Horizon +{hoverHour}h
            </div>
            <div className="flex items-center gap-3">
              <span className="text-solar">
                Solar {(activeData.solar_kw ?? activeData.solar ?? 0).toFixed(1)} kW
              </span>
              <span className="text-bone">
                Demand {(activeData.demand_kw ?? activeData.demand ?? 0).toFixed(1)} kW
              </span>
              <span className="text-battery">
                Batt {(activeData.usable_battery_kw ?? activeData.usable_battery ?? 0).toFixed(1)} kW
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
