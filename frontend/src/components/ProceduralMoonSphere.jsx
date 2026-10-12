import React, { useEffect, useRef } from 'react';

export const ProceduralMoonSphere = ({ size = 96, rotationSpeed = 0.003 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const radius = (size / 2) - 4;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Procedural crater coordinates on spherical surface
    const craters = [
      { theta: 0.2, phi: 0.1, r: 10, depth: 0.7 },
      { theta: 0.8, phi: -0.4, r: 16, depth: 0.9 },
      { theta: 1.5, phi: 0.3, r: 7, depth: 0.5 },
      { theta: 2.2, phi: -0.2, r: 13, depth: 0.8 },
      { theta: 3.1, phi: 0.5, r: 12, depth: 0.6 },
      { theta: 3.9, phi: -0.6, r: 8, depth: 0.5 },
      { theta: 4.8, phi: 0.2, r: 15, depth: 0.85 },
      { theta: 5.5, phi: -0.3, r: 11, depth: 0.7 },
      { theta: 1.1, phi: -0.7, r: 6, depth: 0.4 },
      { theta: 2.7, phi: 0.7, r: 9, depth: 0.65 },
    ];

    let rot = 0;
    let animId;

    const render = () => {
      rot += rotationSpeed;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;

      // Outer glow
      const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.25);
      glowGrad.addColorStop(0, 'rgba(34, 211, 238, 0.3)');
      glowGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Sphere base clipping
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // Base lunar regolith gradient
      const baseGrad = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, 2, cx, cy, radius);
      baseGrad.addColorStop(0, '#CBD5E1');
      baseGrad.addColorStop(0.5, '#64748B');
      baseGrad.addColorStop(0.85, '#334155');
      baseGrad.addColorStop(1, '#0F172A');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      // Draw procedural craters as they rotate across view
      for (const c of craters) {
        const curTheta = c.theta + rot;
        const xProj = Math.sin(curTheta);
        const zProj = Math.cos(curTheta);

        // Only draw visible hemisphere
        if (zProj > 0) {
          const px = cx + xProj * radius * Math.cos(c.phi);
          const py = cy + Math.sin(c.phi) * radius;
          const pr = c.r * (0.6 + 0.4 * zProj);

          ctx.fillStyle = `rgba(15, 23, 42, ${0.45 * c.depth * zProj})`;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();

          // Highlight rim on illuminated edge
          ctx.strokeStyle = `rgba(226, 232, 240, ${0.35 * zProj})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(px - 1, py - 1, pr, 0.5 * Math.PI, 1.5 * Math.PI);
          ctx.stroke();
        }
      }

      // 3D Shadow terminator & limb darkening
      const termGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      termGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      termGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
      termGrad.addColorStop(0.85, 'rgba(3, 8, 20, 0.7)');
      termGrad.addColorStop(1, 'rgba(3, 8, 20, 0.95)');
      ctx.fillStyle = termGrad;
      ctx.fillRect(0, 0, size, size);

      ctx.restore();

      // Thin cyan orbital rim ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (!document.hidden) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [size, rotationSpeed]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${size}px`, height: `${size}px` }}
      className="inline-block pointer-events-none"
    />
  );
};
