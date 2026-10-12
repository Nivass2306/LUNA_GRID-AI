import React, { useEffect, useRef, useState, useMemo } from 'react';
import { HOTSPOTS } from './hotspots';

const CAMERA_PRESETS = {
  overview: { scale: 1.03, x: 0, y: 0 },
  forecast: { scale: 1.15, x: 0, y: 8 },
  allocation: { scale: 1.24, x: -4, y: -5 },
  manual: { scale: 1.24, x: -4, y: -5 },
  comparison: { scale: 1.20, x: 12, y: -2 },
  approval: { scale: 1.22, x: -4, y: -5 },
  simulation: { scale: 1.18, x: 10, y: 6 },
  events: { scale: 1.05, x: 0, y: 0 },
};

export const Scene = ({
  state,
  isDropping = false,
  isResetting = false,
  cameraPreset = 'overview',
  overlayOpacity = 0.20,
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Parallax offsets (mouse-driven)
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const mouseTarget = useRef({ x: 0, y: 0 });
  const mouseCurrent = useRef({ x: 0, y: 0 });

  // Scene state derived from telemetry
  const power = state?.power || {};
  const alert = state?.alert || {};
  const loads = state?.loads || [];

  const solarKw = Number(power.solar_kw ?? power.solar ?? 10.0);
  const availableKw = Number(power.available_kw ?? power.available ?? 12.0);
  const alertLevel = alert.level || 'green';
  const isUnsafe = alert.life_support_ok === false || alert.life_support === false;

  // Darkness factor: 0 (nominal daylight) to 1 (full dark / eclipse)
  const [darkness, setDarkness] = useState(0);
  const [eclipseProgress, setEclipseProgress] = useState(0); // 0 = uncovered, 1 = eclipse over sun
  const [panelFlashRed, setPanelFlashRed] = useState(false);

  // Window shutdown sequence during drop: tracks active window IDs
  const [activeWindows, setActiveWindows] = useState({
    life_support: true,
    habitat: true,
    comms: true,
    science: true,
    rover: true,
  });

  // Hotspots debug overlay flag (?debug=hotspots)
  const [debugHotspots, setDebugHotspots] = useState(false);
  const [liteMode, setLiteMode] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === 'hotspots') setDebugHotspots(true);
      if (params.get('lite') === '1') {
        setLiteMode(true);
        document.body.classList.add('lite-mode');
      }
    }
  }, []);

  // Frame-rate performance monitor
  useEffect(() => {
    let lastTime = performance.now();
    let slowTimeAccum = 0;
    let animId;

    const monitorLoop = (time) => {
      const delta = time - lastTime;
      lastTime = time;

      if (delta > 24) {
        slowTimeAccum += delta;
      } else {
        slowTimeAccum = Math.max(0, slowTimeAccum - delta * 0.5);
      }

      if (slowTimeAccum > 2000 && !liteMode) {
        setLiteMode(true);
        document.body.classList.add('lite-mode');
      }

      if (!document.hidden) {
        animId = requestAnimationFrame(monitorLoop);
      }
    };

    animId = requestAnimationFrame(monitorLoop);
    const onVisibility = () => {
      if (!document.hidden) {
        lastTime = performance.now();
        animId = requestAnimationFrame(monitorLoop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [liteMode]);

  // Mouse Parallax listener
  useEffect(() => {
    if (liteMode) return;

    const handleMouseMove = (e) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      mouseTarget.current = {
        x: (e.clientX - halfW) / halfW,
        y: (e.clientY - halfH) / halfH,
      };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    let rafId;
    const lerpLoop = () => {
      const ease = 0.06;
      mouseCurrent.current.x += (mouseTarget.current.x - mouseCurrent.current.x) * ease;
      mouseCurrent.current.y += (mouseTarget.current.y - mouseCurrent.current.y) * ease;
      setParallax({
        x: mouseCurrent.current.x,
        y: mouseCurrent.current.y,
      });
      rafId = requestAnimationFrame(lerpLoop);
    };
    rafId = requestAnimationFrame(lerpLoop);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [liteMode]);

  // Handle Drop and Reset Transitions
  useEffect(() => {
    if (isDropping || solarKw <= 3.5) {
      // 3-second solar drop sequence:
      setEclipseProgress(1);
      setDarkness(0.85);

      setPanelFlashRed(true);
      const flashTimer = setTimeout(() => setPanelFlashRed(false), 600);

      const t1 = setTimeout(() => setActiveWindows(w => ({ ...w, rover: false })), 250);
      const t2 = setTimeout(() => setActiveWindows(w => ({ ...w, science: false })), 500);
      const t3 = setTimeout(() => setActiveWindows(w => ({ ...w, comms: false })), 750);
      const t4 = setTimeout(() => setActiveWindows(w => ({ ...w, habitat: false })), 1000);

      return () => {
        clearTimeout(flashTimer);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    } else {
      // Reset sequence (~1.2s sunrise)
      setEclipseProgress(0);
      setDarkness(0);
      setActiveWindows({
        life_support: true,
        habitat: true,
        comms: true,
        science: true,
        rover: true,
      });
    }
  }, [isDropping, solarKw]);

  // Load status mapping to window glow
  const windowGlows = useMemo(() => {
    const map = {};
    loads.forEach(l => {
      const id = l.id === 'comms' ? 'comms' : l.id === 'science' ? 'science' : l.id;
      const status = (l.status || '').toLowerCase();
      map[id] = status === 'protected' || status === 'full' ? 1.0 : status === 'reduced' ? 0.45 : 0.05;
    });
    return map;
  }, [loads]);

  // Foreground Dust & Starfield Animation Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 65 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * (window.innerHeight * 0.42),
      radius: Math.random() * 1.2 + 0.4,
      alpha: Math.random(),
      twinkleSpeed: Math.random() * 0.02 + 0.005,
    }));

    const dustCount = liteMode ? 20 : 60;
    const dust = Array.from({ length: dustCount }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -Math.random() * 0.3 - 0.05,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    let shootingStar = null;
    let nextShootingStarTime = performance.now() + 15000 + Math.random() * 10000;

    let prevTime = performance.now();
    const render = (time) => {
      const delta = (time - prevTime) / 1000;
      prevTime = time;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const s of stars) {
        s.alpha += s.twinkleSpeed;
        if (s.alpha > 1 || s.alpha < 0.2) s.twinkleSpeed = -s.twinkleSpeed;
        ctx.fillStyle = `rgba(234, 244, 255, ${Math.max(0.1, s.alpha)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (time > nextShootingStarTime && !shootingStar) {
        shootingStar = {
          x: Math.random() * (window.innerWidth * 0.6),
          y: Math.random() * (window.innerHeight * 0.2),
          length: 90,
          speed: 800,
          alpha: 1.0,
        };
        nextShootingStarTime = time + 18000 + Math.random() * 10000;
      }

      if (shootingStar) {
        shootingStar.x += shootingStar.speed * delta;
        shootingStar.y += (shootingStar.speed * 0.4) * delta;
        shootingStar.alpha -= delta * 1.6;

        ctx.strokeStyle = `rgba(34, 211, 238, ${Math.max(0, shootingStar.alpha)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(shootingStar.x - shootingStar.length, shootingStar.y - (shootingStar.length * 0.4));
        ctx.stroke();

        if (shootingStar.alpha <= 0) shootingStar = null;
      }

      for (const p of dust) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) p.y = window.innerHeight;
        if (p.x < 0) p.x = window.innerWidth;
        if (p.x > window.innerWidth) p.x = 0;

        ctx.fillStyle = `rgba(234, 244, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!document.hidden) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [liteMode]);

  // Camera preset lookup
  const cam = CAMERA_PRESETS[cameraPreset] || CAMERA_PRESETS.overview;

  // Power flow scales
  const totalAllocated = loads.reduce((sum, l) => sum + Number(l.allocated_kw ?? l.allocated ?? 0), 0);
  const batteryContribution = Math.max(0, totalAllocated - solarKw);
  const solarFlowScale = Math.min(1.0, Math.max(0.2, solarKw / 10.0));
  const batteryFlowScale = Math.min(1.0, Math.max(0.1, batteryContribution / 2.5));

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none select-none overflow-hidden z-0 bg-space"
      aria-hidden="true"
    >
      {/* Dynamic Camera Target Movement with 600ms Ease */}
      <div
        className="absolute inset-0 w-full h-full will-change-transform"
        style={{
          transform: `translate3d(${cam.x + parallax.x * 6}%, ${cam.y + parallax.y * 4}%, 0) scale(${cam.scale})`,
          transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Night Image */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-bottom transition-opacity duration-1000 ease-in-out"
          style={{
            backgroundImage: `url('/bg/moon-base-night.webp')`,
            opacity: Math.min(1, Math.max(0, darkness)),
          }}
        />

        {/* Day Image */}
        {!imageError && (
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-bottom transition-opacity duration-1000 ease-in-out"
            style={{
              backgroundImage: `url('/bg/moon-base-day.webp')`,
              opacity: Math.max(0, 1 - darkness),
            }}
          />
        )}

        {/* Fallback Vector Scene */}
        {imageError && (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#030814] via-[#09152C] to-[#0A101D]">
            <div className="absolute bottom-0 w-full h-48 bg-[#0D182B] rounded-t-[100%]" />
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-72 h-44 border border-cyan/40 bg-cyan/5 rounded-t-full shadow-[0_0_50px_rgba(34,211,238,0.2)]" />
          </div>
        )}


        {/* Starfield & Floating Dust Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none relative z-10" />

        {/* SVG Hotspot Overlays */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <radialGradient id="sunFlareGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF7ED" stopOpacity={0.95 * (1 - eclipseProgress * 0.9)} />
              <stop offset="35%" stopColor="#FFB020" stopOpacity={0.7 * (1 - eclipseProgress * 0.9)} />
              <stop offset="70%" stopColor="#FF7A1A" stopOpacity={0.3 * (1 - eclipseProgress * 0.9)} />
              <stop offset="100%" stopColor="#FF7A1A" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="earthGlowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
              <stop offset="75%" stopColor="#38BDF8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.55" />
            </radialGradient>

            <radialGradient id="windowWarmGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFD37A" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#FF9F1C" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#FF9F1C" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="solarLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFB020" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.9" />
            </linearGradient>

            <linearGradient id="batteryLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22E58B" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* 1. Sun & Eclipse */}
          <g id="hotspot-sun">
            <circle
              cx={HOTSPOTS.sun.x}
              cy={HOTSPOTS.sun.y}
              r={HOTSPOTS.sun.radius * (1 - eclipseProgress * 0.4)}
              fill="url(#sunFlareGrad)"
              className="transition-all duration-1000 ease-out"
            />
            <circle
              cx={HOTSPOTS.sun.x - (1 - eclipseProgress) * 12}
              cy={HOTSPOTS.sun.y}
              r={HOTSPOTS.sun.radius * 0.88}
              fill="#030814"
              opacity={eclipseProgress > 0.05 ? 0.96 : 0}
              className="transition-all duration-1000 ease-in-out"
            />
          </g>

          {/* 2. Earth Glow */}
          <circle
            cx={HOTSPOTS.earth.x}
            cy={HOTSPOTS.earth.y}
            r={HOTSPOTS.earth.radius}
            fill="url(#earthGlowGrad)"
            className="animate-pulse-glow"
          />

          {/* 3. Radar Dish Waves */}
          <g id="hotspot-dish">
            <circle
              cx={HOTSPOTS.dish.x}
              cy={HOTSPOTS.dish.y}
              r="1.8"
              fill="none"
              stroke="#22D3EE"
              strokeWidth="0.25"
              className="animate-radar-sweep origin-center"
              style={{ transformOrigin: `${HOTSPOTS.dish.x}% ${HOTSPOTS.dish.y}%` }}
            />
          </g>

          {/* 4. Conduits */}
          <path
            d={`M ${HOTSPOTS.conduits.solar_to_dome.from.x} ${HOTSPOTS.conduits.solar_to_dome.from.y} Q ${HOTSPOTS.conduits.solar_to_dome.control.x} ${HOTSPOTS.conduits.solar_to_dome.control.y} ${HOTSPOTS.conduits.solar_to_dome.to.x} ${HOTSPOTS.conduits.solar_to_dome.to.y}`}
            fill="none"
            stroke="url(#solarLineGrad)"
            strokeWidth={0.25 * solarFlowScale + 0.15}
            strokeDasharray={solarKw > 0 ? '1.5 2' : 'none'}
            style={{ filter: 'drop-shadow(0 0 3px rgba(255, 176, 32, 0.6))' }}
          />

          <path
            d={`M ${HOTSPOTS.conduits.battery_to_dome.from.x} ${HOTSPOTS.conduits.battery_to_dome.from.y} Q ${HOTSPOTS.conduits.battery_to_dome.control.x} ${HOTSPOTS.conduits.battery_to_dome.control.y} ${HOTSPOTS.conduits.battery_to_dome.to.x} ${HOTSPOTS.conduits.battery_to_dome.to.y}`}
            fill="none"
            stroke="url(#batteryLineGrad)"
            strokeWidth={0.25 * batteryFlowScale + 0.15}
            strokeDasharray={batteryContribution > 0 ? '1.5 2' : 'none'}
            style={{
              filter: 'drop-shadow(0 0 3px rgba(34, 229, 139, 0.6))',
              opacity: batteryContribution > 0 ? 0.9 : 0.25,
            }}
          />

          {/* 5. Window Groups */}
          {Object.entries(HOTSPOTS.windows).map(([key, win]) => {
            const isActive = activeWindows[key] !== false;
            const glowMultiplier = isActive ? (windowGlows[key] ?? 1.0) : 0.05;
            const isCriticalTier = key === 'life_support';

            return (
              <ellipse
                key={key}
                cx={win.x}
                cy={win.y}
                rx={win.width / 2}
                ry={win.height / 2}
                fill="url(#windowWarmGrad)"
                opacity={isCriticalTier && isUnsafe ? 0.3 : glowMultiplier}
                className="transition-opacity duration-500 ease-in-out"
                style={{
                  filter: glowMultiplier > 0.3 ? 'drop-shadow(0 0 5px rgba(255, 176, 32, 0.75))' : 'none',
                }}
              />
            );
          })}
        </svg>
      </div>

      {/* Page Dark Overlay: Controls contrast per page */}
      <div
        className="absolute inset-0 bg-[#030814] pointer-events-none transition-opacity duration-600 ease-out"
        style={{ opacity: overlayOpacity }}
      />

      {/* Top & Bottom Read Gradients */}
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#030814]/85 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#030814]/90 to-transparent pointer-events-none" />

      {/* Ambient Edge Alert Tint */}
      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-700 ease-in-out ${
          alertLevel === 'red' || isUnsafe
            ? 'shadow-[inset_0_0_120px_rgba(255,59,78,0.4)]'
            : alertLevel === 'yellow'
            ? 'shadow-[inset_0_0_80px_rgba(255,194,51,0.22)]'
            : 'shadow-[inset_0_0_60px_rgba(34,211,238,0.1)]'
        }`}
      />

      {/* Red beacon in critical */}
      {(alertLevel === 'red' || isUnsafe) && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(255,59,78,0.18)_0%,_transparent_70%)] animate-breathe-slow" />
      )}

      {/* Solar drop single red flash */}
      {panelFlashRed && (
        <div className="absolute inset-0 pointer-events-none border-2 border-danger shadow-[0_0_40px_rgba(255,59,78,0.6)] animate-pulse" />
      )}
    </div>
  );
};
