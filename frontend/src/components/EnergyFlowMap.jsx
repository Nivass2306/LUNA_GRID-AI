import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSpacegridState } from '../context/SpacegridContext';

const LOAD_NEEDS = {
  life_support: 3.0,
  habitat: 2.0,
  comms: 1.2,
  science: 1.0,
  rover: 0.8,
};

export const EnergyFlowMap = ({
  hoveredLoadId,
  onHoverLoad,
  mode = 'auto',
  draft = {},
  onSetAllocation,
  onToggleLoad,
  busNudge = false,
  transmitAnimation = false,
}) => {
  const { state } = useSpacegridState();

  const isLite = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('lite') === '1';
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const power = state?.power || { solar_kw: 10.0, demand_kw: 8.0, usable_battery_kw: 2.0 };
  const battery = state?.battery || { soc_kwh: 16.5, capacity_kwh: 20.0, min_reserve_kwh: 3.0 };
  const loads = state?.loads || [];
  const alert = state?.alert || { level: 'green', life_support_ok: true };
  const plan = state?.plan || {};

  const solarKw = Number(power.solar_kw ?? 10.0);
  const isServerUnsafe = alert.life_support_ok === false;

  // Manual mode safety check: is life support underpowered in draft?
  const isDraftUnsafe = mode === 'manual' && Number(draft.life_support ?? 3.0) < 3.0;
  const isUnsafe = mode === 'manual' ? isDraftUnsafe : isServerUnsafe;

  // Staggered load node layout coordinates in 920x460 space
  const solarPos = { x: 110, y: 130 };
  const batteryPos = { x: 110, y: 340 };
  const busBaseX = 330;
  const busX = busNudge ? busBaseX + 4 : busBaseX;
  const loadStartX = 660;
  const trackLength = loadStartX - 30 - busBaseX; // ~300px draggable distance

  const solarRadius = Math.max(18, Math.min(36, 16 + (solarKw / 12) * 20));

  const loadPositions = useMemo(() => {
    return [
      { id: 'life_support', name: 'Life support', x: loadStartX, y: 55, priority: 1 },
      { id: 'habitat', name: 'Habitat systems', x: loadStartX, y: 135, priority: 2 },
      { id: 'comms', name: 'Communication', x: loadStartX, y: 215, priority: 3 },
      { id: 'science', name: 'Science experiments', x: loadStartX, y: 295, priority: 4 },
      { id: 'rover', name: 'Rover dock', x: loadStartX, y: 375, priority: 5 },
    ];
  }, [loadStartX]);

  // Merge load telemetry and draft
  const activeLoadValues = useMemo(() => {
    const map = {};
    loadPositions.forEach((pos) => {
      const serverLoad = loads.find((l) => l.id === pos.id) || {};
      const need = LOAD_NEEDS[pos.id] || 1.0;
      const recommended = Number(serverLoad.recommended_kw ?? serverLoad.recommended ?? serverLoad.allocated_kw ?? need);
      const allocated = mode === 'manual'
        ? Number(draft[pos.id] ?? recommended)
        : Number(serverLoad.allocated_kw ?? serverLoad.allocated ?? 0.0);

      map[pos.id] = {
        allocated,
        need,
        recommended,
        name: serverLoad.name || pos.name,
      };
    });
    return map;
  }, [loadPositions, loads, mode, draft]);

  const totalAllocated = Object.values(activeLoadValues).reduce((sum, l) => sum + l.allocated, 0);
  const batteryContribKw = Math.max(0, totalAllocated - solarKw);

  // Dragging interaction state
  const [draggingId, setDraggingId] = useState(null);
  const svgRef = useRef(null);

  // Tooltip on recommended mark hover
  const [hoveredTickId, setHoveredTickId] = useState(null);

  // Drag handlers
  const handleMouseDownHandle = (id, e) => {
    e.stopPropagation();
    setDraggingId(id);
  };

  const updateDragPosition = useCallback((clientX) => {
    if (!draggingId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * 920;
    const relX = svgX - busBaseX;
    const ratio = Math.max(0, Math.min(1, relX / trackLength));
    const need = LOAD_NEEDS[draggingId] || 1.0;
    const nextVal = Math.round(ratio * need * 10) / 10;
    if (onSetAllocation) {
      onSetAllocation(draggingId, nextVal);
    }
  }, [draggingId, trackLength, busBaseX, onSetAllocation]);

  useEffect(() => {
    if (!draggingId) return;

    const onMouseMove = (e) => updateDragPosition(e.clientX);
    const onMouseUp = () => setDraggingId(null);
    const onTouchMove = (e) => {
      if (e.touches[0]) updateDragPosition(e.touches[0].clientX);
    };
    const onTouchEnd = () => setDraggingId(null);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [draggingId, updateDragPosition]);

  // Particle simulation loop
  const [particleOffset, setParticleOffset] = useState(0);
  useEffect(() => {
    if (isLite || prefersReducedMotion) return;

    let animId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (document.hidden) {
        lastTime = time;
        animId = requestAnimationFrame(loop);
        return;
      }
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      const surgeSpeed = transmitAnimation ? 90 : 28;
      setParticleOffset((prev) => (prev + dt * surgeSpeed) % 1000);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isLite, prefersReducedMotion, transmitAnimation]);

  const solarFlowWidth = Math.max(1.5, Math.min(7, (solarKw / 10) * 5));
  const batteryFlowWidth = Math.max(1, Math.min(6, (batteryContribKw / 4) * 4.5));

  const socPercent = Math.min(100, Math.max(5, (battery.soc_kwh / battery.capacity_kwh) * 100));
  const reservePercent = (battery.min_reserve_kwh / battery.capacity_kwh) * 100;

  return (
    <div
      className={`w-full relative transition-all duration-300 select-none ${
        mode === 'manual' ? 'border border-bone/25 p-2 bg-raised/20' : 'p-2'
      } ${isUnsafe ? 'bg-danger/[0.03]' : ''}`}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 920 460"
        className="w-full h-auto overflow-visible"
        aria-label="Energy Flow Map Schematic"
      >
        <defs>
          <filter id="breathing-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="danger-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ============================================================== */}
        {/* 1. FLOW PATHS (Sources to Bus)                                 */}
        {/* ============================================================== */}
        {/* Solar -> Bus */}
        <path
          d={`M ${solarPos.x + 36} ${solarPos.y} C 210 ${solarPos.y}, 250 200, ${busX} 200`}
          fill="none"
          stroke="#FF9F1C"
          strokeWidth={solarFlowWidth}
          strokeOpacity={solarKw > 0.5 ? 0.85 : 0.25}
          className="transition-all duration-300"
        />

        {/* Battery -> Bus */}
        <path
          d={`M ${batteryPos.x + 28} ${batteryPos.y} C 210 ${batteryPos.y}, 250 240, ${busX} 240`}
          fill="none"
          stroke="#7DDFA4"
          strokeWidth={batteryFlowWidth}
          strokeOpacity={batteryContribKw > 0.1 ? 0.85 : 0.15}
          className="transition-all duration-300"
        />

        {/* Animated Particles from sources */}
        {!isLite && !prefersReducedMotion && (
          <>
            {solarKw > 0.5 && (
              <path
                d={`M ${solarPos.x + 36} ${solarPos.y} C 210 ${solarPos.y}, 250 200, ${busX} 200`}
                fill="none"
                stroke="#FFF4E0"
                strokeWidth={Math.max(2, solarFlowWidth * 0.8)}
                strokeDasharray="4 32"
                strokeDashoffset={-particleOffset * (1 + solarKw / 5)}
                strokeLinecap="round"
                opacity="0.9"
              />
            )}
            {batteryContribKw > 0.1 && (
              <path
                d={`M ${batteryPos.x + 28} ${batteryPos.y} C 210 ${batteryPos.y}, 250 240, ${busX} 240`}
                fill="none"
                stroke="#E2FBEB"
                strokeWidth={Math.max(2, batteryFlowWidth * 0.8)}
                strokeDasharray="4 32"
                strokeDashoffset={-particleOffset * (1 + batteryContribKw / 3)}
                strokeLinecap="round"
                opacity="0.9"
              />
            )}
          </>
        )}

        {/* Central Power Bus (Vertical Spine) with nudge animation */}
        <g className="transition-transform duration-200">
          <line
            x1={busX}
            y1={50}
            x2={busX}
            y2={390}
            stroke="rgba(237,232,223,0.30)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Mode tag next to bus */}
          {mode === 'manual' ? (
            <text
              x={busX - 12}
              y="45"
              fill="#EDE8DF"
              fontSize="14"
              fontFamily="Instrument Serif"
              fontStyle="italic"
              textAnchor="end"
            >
              Manual
            </text>
          ) : plan.source === 'manual' ? (
            <text
              x={busX - 12}
              y="45"
              fill="#E9D758"
              fontSize="11"
              fontFamily="Geist Mono"
              fontWeight="600"
              textAnchor="end"
            >
              MANUAL
            </text>
          ) : null}
        </g>

        {/* ============================================================== */}
        {/* 2. BUS -> LOADS DISTRIBUTION LINES & HANDLES                   */}
        {/* ============================================================== */}
        {loadPositions.map((pos, idx) => {
          const lData = activeLoadValues[pos.id] || { allocated: 0, need: 1, recommended: 1 };
          const isHovered = hoveredLoadId === pos.id;
          const isOff = lData.allocated <= 0.05;
          const isThrottled = lData.allocated < lData.need && !isOff;
          const loadWidth = isOff ? 1 : Math.max(1.5, Math.min(5.5, (lData.allocated / 3.0) * 4));

          let strokeColor = '#EDE8DF';
          if (pos.id === 'life_support') {
            strokeColor = isUnsafe ? '#FF4A3D' : '#7DDFA4';
          } else if (isOff) {
            strokeColor = '#8C877D';
          } else if (isThrottled) {
            strokeColor = '#E9D758';
          }

          const lineY = pos.y;
          const handleFraction = Math.min(1, Math.max(0, lData.allocated / lData.need));
          const handleX = busBaseX + handleFraction * trackLength;

          const recFraction = Math.min(1, Math.max(0, lData.recommended / lData.need));
          const recX = busBaseX + recFraction * trackLength;

          const isHandleActive = draggingId === pos.id;

          return (
            <g key={`dist-${pos.id}`}>
              {/* Distribution Line */}
              <line
                x1={busX}
                y1={lineY}
                x2={pos.x - 28}
                y2={lineY}
                stroke={strokeColor}
                strokeWidth={isHovered ? loadWidth + 2 : loadWidth}
                strokeOpacity={isHovered ? 1 : isOff ? 0.25 : 0.75}
                strokeDasharray={isOff ? '4 4' : undefined}
                className="transition-all duration-200"
              />

              {/* Particle flow to load */}
              {!isLite && !prefersReducedMotion && !isOff && (
                <line
                  x1={busX}
                  y1={lineY}
                  x2={pos.x - 28}
                  y2={lineY}
                  stroke="#FFFFFF"
                  strokeWidth={Math.max(1.8, loadWidth * 0.75)}
                  strokeDasharray="3 24"
                  strokeDashoffset={-particleOffset * (1.2 + lData.allocated / 2)}
                  strokeLinecap="round"
                  opacity={isHovered ? 1 : 0.8}
                />
              )}

              {/* In Manual Mode: Recommended Tick Mark on Line */}
              {mode === 'manual' && (
                <g
                  onMouseEnter={() => setHoveredTickId(pos.id)}
                  onMouseLeave={() => setHoveredTickId(null)}
                  className="cursor-pointer"
                  onClick={() => onSetAllocation && onSetAllocation(pos.id, lData.recommended)}
                >
                  <line
                    x1={recX}
                    y1={lineY - 7}
                    x2={recX}
                    y2={lineY + 7}
                    stroke="#FF9F1C"
                    strokeWidth="1.5"
                    strokeOpacity="0.8"
                  />
                  {/* Tooltip on recommended mark */}
                  {hoveredTickId === pos.id && (
                    <text
                      x={recX}
                      y={lineY - 10}
                      fill="#FF9F1C"
                      fontSize="10"
                      fontFamily="Geist Mono"
                      textAnchor="middle"
                    >
                      SPACEGRID {lData.recommended.toFixed(1)}
                    </text>
                  )}
                </g>
              )}

              {/* In Manual Mode: Draggable Handle on Line */}
              {mode === 'manual' && (
                <g
                  role="slider"
                  tabIndex="0"
                  aria-valuemin="0"
                  aria-valuemax={lData.need}
                  aria-valuenow={lData.allocated}
                  aria-valuetext={`${lData.allocated.toFixed(1)} of ${lData.need.toFixed(1)} kilowatts`}
                  transform={`translate(${handleX}, ${lineY})`}
                  className="cursor-ew-resize focus:outline-none"
                  onMouseDown={(e) => handleMouseDownHandle(pos.id, e)}
                  onTouchStart={(e) => handleMouseDownHandle(pos.id, e)}
                  onDoubleClick={() => onSetAllocation && onSetAllocation(pos.id, lData.recommended)}
                  onKeyDown={(e) => {
                    const step = e.shiftKey ? 0.5 : 0.1;
                    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      onSetAllocation && onSetAllocation(pos.id, Math.min(lData.need, lData.allocated + step));
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      onSetAllocation && onSetAllocation(pos.id, Math.max(0, lData.allocated - step));
                    } else if (e.key === 'Home') {
                      e.preventDefault();
                      onSetAllocation && onSetAllocation(pos.id, 0);
                    } else if (e.key === 'End') {
                      e.preventDefault();
                      onSetAllocation && onSetAllocation(pos.id, lData.need);
                    }
                  }}
                  style={{
                    transition: isHandleActive ? 'none' : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  {/* Invisible 44px hit target */}
                  <rect
                    x="-22"
                    y="-22"
                    width="44"
                    height="44"
                    fill="transparent"
                  />
                  {/* Handle bar with small dark notch */}
                  <rect
                    x="-4"
                    y="-12"
                    width="8"
                    height="24"
                    fill="#EDE8DF"
                    stroke="#131316"
                    strokeWidth="1"
                    className={`transition-transform ${isHandleActive ? 'scale-125' : 'hover:scale-115'}`}
                  />
                  <line
                    x1="-2"
                    y1="0"
                    x2="2"
                    y2="0"
                    stroke="#0B0B0D"
                    strokeWidth="1.5"
                  />

                  {/* Floating Mono Readout while dragging */}
                  {isHandleActive && (
                    <g transform="translate(0, -22)">
                      <rect
                        x="-24"
                        y="-16"
                        width="48"
                        height="18"
                        fill="#131316"
                        stroke="rgba(237,232,223,0.3)"
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="-4"
                        fill="#EDE8DF"
                        fontSize="11"
                        fontFamily="Geist Mono"
                        textAnchor="middle"
                      >
                        {lData.allocated.toFixed(1)} kW
                      </text>
                    </g>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* ============================================================== */}
        {/* 3. SOURCE NODES (Solar Array & Battery)                        */}
        {/* ============================================================== */}
        {/* SOLAR NODE (Labels positioned completely outside disc) */}
        <g transform={`translate(${solarPos.x}, ${solarPos.y})`} className="cursor-default">
          <circle
            cx="0"
            cy="0"
            r={solarRadius + 6}
            fill="none"
            stroke="#FF9F1C"
            strokeWidth="1"
            strokeOpacity="0.2"
          />
          <circle
            cx="0"
            cy="0"
            r={solarRadius}
            fill="#FF9F1C"
            fillOpacity={Math.max(0.2, Math.min(0.95, solarKw / 10))}
            stroke="#FF9F1C"
            strokeWidth="1.5"
            className="transition-all duration-300"
          />
          {/* Labels moved strictly outside the sun disc (top-left offset) */}
          <text
            x="0"
            y={-solarRadius - 16}
            fill="#EDE8DF"
            fontSize="13"
            fontFamily="Geist Sans"
            fontWeight="500"
            textAnchor="middle"
          >
            Solar array
          </text>
          <text
            x="0"
            y={-solarRadius - 3}
            fill="#8C877D"
            fontSize="12"
            fontFamily="Geist Mono"
            textAnchor="middle"
          >
            {solarKw.toFixed(1)} kW
          </text>
        </g>

        {/* BATTERY NODE */}
        <g transform={`translate(${batteryPos.x}, ${batteryPos.y})`} className="cursor-default">
          <rect
            x="-14"
            y="-32"
            width="28"
            height="64"
            fill="#131316"
            stroke="rgba(237,232,223,0.25)"
            strokeWidth="1.2"
          />
          <rect
            x="-6"
            y="-36"
            width="12"
            height="4"
            fill="rgba(237,232,223,0.35)"
          />
          <rect
            x="-12"
            y={32 - (socPercent / 100) * 64}
            width="24"
            height={(socPercent / 100) * 64}
            fill="#7DDFA4"
            fillOpacity={socPercent > reservePercent ? 0.8 : 0.35}
            className="transition-all duration-300"
          />
          <line
            x1="-14"
            y1={32 - (reservePercent / 100) * 64}
            x2="14"
            y2={32 - (reservePercent / 100) * 64}
            stroke="#FF4A3D"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
          <text
            x="0"
            y="48"
            fill="#EDE8DF"
            fontSize="13"
            fontFamily="Geist Sans"
            fontWeight="500"
            textAnchor="middle"
          >
            Battery
          </text>
          <text
            x="0"
            y="65"
            fill="#8C877D"
            fontSize="12"
            fontFamily="Geist Mono"
            textAnchor="middle"
          >
            {battery.soc_kwh.toFixed(1)} / {battery.capacity_kwh.toFixed(0)} kWh
          </text>
        </g>

        {/* ============================================================== */}
        {/* 4. LOAD NODES (Right Stack)                                    */}
        {/* ============================================================== */}
        {loadPositions.map((pos) => {
          const lData = activeLoadValues[pos.id] || { allocated: 0, need: 1, name: pos.name };
          const isHovered = hoveredLoadId === pos.id;
          const isOff = lData.allocated <= 0.05;
          const isThrottled = lData.allocated < lData.need && !isOff;
          const fillRatio = Math.min(1, Math.max(0, lData.allocated / lData.need));

          const ringRadius = 18;
          const circumference = 2 * Math.PI * ringRadius;
          const strokeDashoffset = circumference * (1 - fillRatio);

          const isLifeSupport = pos.id === 'life_support';
          const isUnderpowered = isLifeSupport && lData.allocated < 3.0;

          let ringColor = '#EDE8DF';
          if (isLifeSupport) {
            ringColor = isUnsafe ? '#FF4A3D' : '#7DDFA4';
          } else if (isOff) {
            ringColor = '#8C877D';
          } else if (isThrottled) {
            ringColor = '#E9D758';
          }

          let displayStatus = isOff ? (pos.id === 'rover' ? 'Postponed' : 'Off') : isThrottled ? 'Reduced' : 'Protected';
          if (isLifeSupport && isUnderpowered) {
            displayStatus = 'Underpowered';
          }

          return (
            <g
              key={`node-${pos.id}`}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => onHoverLoad && onHoverLoad(pos.id)}
              onMouseLeave={() => onHoverLoad && onHoverLoad(null)}
              onClick={() => onToggleLoad && onToggleLoad(pos.id)}
            >
              {isHovered && (
                <rect
                  x="-28"
                  y="-26"
                  width="260"
                  height="52"
                  fill="rgba(237,232,223,0.03)"
                  stroke="rgba(237,232,223,0.15)"
                  strokeWidth="1"
                />
              )}

              {/* Background ring track */}
              <circle
                cx="0"
                cy="0"
                r={ringRadius}
                fill="#131316"
                stroke="rgba(237,232,223,0.12)"
                strokeWidth="2.5"
              />

              {/* Allocated fill ring */}
              {!isOff ? (
                <circle
                  cx="0"
                  cy="0"
                  r={ringRadius}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth={isHovered ? 3.5 : 2.5}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 0 0)"
                  filter={isLifeSupport && !isUnsafe ? 'url(#breathing-glow)' : isUnsafe ? 'url(#danger-glow)' : undefined}
                  className={`transition-all duration-300 ${
                    isLifeSupport && !isUnsafe ? 'animate-breathe-slow' : ''
                  } ${isLifeSupport && isUnsafe ? 'animate-flicker-danger' : ''}`}
                />
              ) : (
                <circle
                  cx="0"
                  cy="0"
                  r={ringRadius}
                  fill="none"
                  stroke="#8C877D"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              <circle
                cx="0"
                cy="0"
                r="4.5"
                fill={ringColor}
                opacity={isOff ? 0.3 : 1}
              />

              {/* Node label and metadata */}
              <text
                x="32"
                y="-3"
                fill="#EDE8DF"
                fontSize="13"
                fontFamily="Geist Sans"
                fontWeight={isHovered ? '600' : '500'}
                className="select-none"
              >
                {lData.name || pos.name}
              </text>
              <text
                x="32"
                y="14"
                fill="#8C877D"
                fontSize="12"
                fontFamily="Geist Mono"
                className="select-none"
              >
                {lData.allocated.toFixed(1)} of {lData.need.toFixed(1)} kW
                <tspan dx="8" fill={ringColor}>
                  {displayStatus}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
