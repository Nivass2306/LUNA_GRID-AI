import React from 'react';

/**
 * Animated SVG illustration for SPACEGRID AI Hero.
 * Features:
 * - Curved lunar horizon with crater silhouettes
 * - Lunar habitat geodesic dome with illuminated airlock & comms antenna
 * - Solar disc that slowly dims to a smaller disc in a smooth 10s cycle
 * - Thin orbital ellipses with traveling tracking nodes
 * Pure SVG & CSS only. No external dependencies.
 */
export const LunarHeroSvg = () => {
  return (
    <div className="relative w-full max-w-[540px] aspect-[4/3] mx-auto flex items-center justify-center">
      <svg
        viewBox="0 0 600 450"
        className="w-full h-full overflow-visible select-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Lunar habitat horizon with orbital paths and solar illumination"
        role="img"
      >
        <defs>
          {/* Deep lunar space gradient */}
          <radialGradient id="spaceVignette" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#0B132B" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#060912" stopOpacity="0" />
          </radialGradient>

          {/* Lunar surface gradient */}
          <linearGradient id="lunarGround" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="30%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#060912" />
          </linearGradient>

          {/* Habitat dome glow */}
          <radialGradient id="domeGlow" cx="50%" cy="60%" r="50%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.9" />
          </radialGradient>

          {/* Solar corona / halo */}
          <radialGradient id="solarCorona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFC857" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#FFC857" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#FFC857" stopOpacity="0" />
          </radialGradient>

          {/* Solar disc core */}
          <linearGradient id="solarCore" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF1C2" />
            <stop offset="100%" stopColor="#FFC857" />
          </linearGradient>

          {/* Shaded filter for eclipse / dust dimming */}
          <style>{`
            @keyframes solarDimCycle {
              0%, 100% {
                transform: scale(1);
                opacity: 0.95;
              }
              45%, 55% {
                transform: scale(0.68);
                opacity: 0.38;
              }
            }

            @keyframes coronaDimCycle {
              0%, 100% {
                transform: scale(1);
                opacity: 0.6;
              }
              45%, 55% {
                transform: scale(0.45);
                opacity: 0.12;
              }
            }

            @keyframes orbitRotate {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }

            @keyframes beaconPulse {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 1; }
            }

            @keyframes starTwinkle {
              0%, 100% { opacity: 0.2; }
              50% { opacity: 0.8; }
            }

            .solar-core {
              transform-origin: 430px 110px;
              animation: solarDimCycle 10s ease-in-out infinite;
            }

            .solar-corona {
              transform-origin: 430px 110px;
              animation: coronaDimCycle 10s ease-in-out infinite;
            }

            .beacon-light {
              animation: beaconPulse 2.5s ease-in-out infinite;
            }

            .orbit-spin {
              transform-origin: 300px 240px;
              animation: orbitRotate 45s linear infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .solar-core, .solar-corona, .beacon-light, .orbit-spin {
                animation: none !important;
              }
            }
          `}</style>
        </defs>

        {/* Space backdrop with faint radial glow */}
        <circle cx="300" cy="225" r="280" fill="url(#spaceVignette)" />

        {/* Distant background stars */}
        <g fill="#E8EEF8" opacity="0.4">
          <circle cx="80" cy="65" r="1" />
          <circle cx="160" cy="110" r="1.5" opacity="0.6" />
          <circle cx="240" cy="50" r="0.8" />
          <circle cx="320" cy="95" r="1.2" />
          <circle cx="510" cy="70" r="1" />
          <circle cx="480" cy="180" r="1.2" />
          <circle cx="110" cy="190" r="0.8" />
          <circle cx="200" cy="160" r="1.4" opacity="0.7" />
          <circle cx="370" cy="40" r="1" />
        </g>

        {/* Thin Orbital Ellipses */}
        <g stroke="rgba(56, 189, 248, 0.18)" fill="none" strokeWidth="1">
          {/* Main transfer ellipse */}
          <ellipse
            cx="300"
            cy="240"
            rx="270"
            ry="110"
            transform="rotate(-18 300 240)"
            strokeDasharray="4 6"
          />

          {/* Secondary high orbit */}
          <ellipse
            cx="300"
            cy="240"
            rx="230"
            ry="75"
            transform="rotate(12 300 240)"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeDasharray="2 4"
          />

          {/* Orbit tracking node */}
          <g className="orbit-spin">
            <circle cx="570" cy="240" r="3" fill="#38BDF8" />
            <circle cx="570" cy="240" r="6" stroke="#38BDF8" strokeWidth="1" fill="none" opacity="0.5" />
          </g>
        </g>

        {/* Solar Orb (Dims to smaller disc and glows) */}
        <g>
          {/* Outer corona halo */}
          <circle
            cx="430"
            cy="110"
            r="70"
            fill="url(#solarCorona)"
            className="solar-corona"
          />
          {/* Intermediate solar flare ring */}
          <circle
            cx="430"
            cy="110"
            r="38"
            fill="#FFC857"
            fillOpacity="0.12"
            className="solar-corona"
          />
          {/* Core solar disc */}
          <circle
            cx="430"
            cy="110"
            r="24"
            fill="url(#solarCore)"
            stroke="#FFF1C2"
            strokeWidth="1.5"
            className="solar-core"
            filter="drop-shadow(0 0 12px rgba(255, 200, 87, 0.6))"
          />
        </g>

        {/* Lunar Surface / Horizon (Curved ground with crater silhouettes) */}
        <g>
          {/* Background mountain ridge / rim */}
          <path
            d="M -20 340 Q 120 300, 240 320 T 450 305 Q 540 315, 620 330 L 620 460 L -20 460 Z"
            fill="#0F172A"
            opacity="0.8"
          />

          {/* Foreground main lunar curve */}
          <path
            d="M -20 350 Q 150 285, 330 305 T 620 335 L 620 460 L -20 460 Z"
            fill="url(#lunarGround)"
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth="1"
          />

          {/* Subtle Craters on surface */}
          <ellipse cx="140" cy="370" rx="36" ry="10" fill="#090E1A" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="1" />
          <ellipse cx="490" cy="385" rx="55" ry="14" fill="#090E1A" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="1" />
          <ellipse cx="290" cy="410" rx="42" ry="9" fill="#080C16" opacity="0.6" />
        </g>

        {/* Lunar Habitat Complex (Geodesic Dome & Connected Modules) */}
        <g transform="translate(230, 260)">
          {/* Ground reflection glow under habitat */}
          <ellipse cx="65" cy="54" rx="75" ry="16" fill="rgba(56, 189, 248, 0.12)" />

          {/* Main Habitat Dome */}
          <path
            d="M 25 50 A 40 38 0 0 1 105 50 Z"
            fill="url(#domeGlow)"
            stroke="rgba(56, 189, 248, 0.6)"
            strokeWidth="1.5"
          />

          {/* Dome geodesic structural ribs */}
          <path
            d="M 65 12 L 65 50 M 40 22 L 48 50 M 90 22 L 82 50"
            stroke="rgba(56, 189, 248, 0.25)"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M 33 34 Q 65 30, 97 34"
            stroke="rgba(56, 189, 248, 0.3)"
            strokeWidth="1"
            fill="none"
          />

          {/* Airlock Vestibule */}
          <rect
            x="57"
            y="42"
            width="16"
            height="10"
            rx="2"
            fill="#0B132B"
            stroke="#38BDF8"
            strokeWidth="1"
          />
          <circle cx="65" cy="46" r="1.5" fill="#34D399" />

          {/* Secondary module (Power / Storage pod) */}
          <rect
            x="115"
            y="43"
            width="26"
            height="9"
            rx="3"
            fill="#0F172A"
            stroke="rgba(148, 163, 184, 0.4)"
            strokeWidth="1"
          />
          {/* Connector tube */}
          <rect x="104" y="46" width="12" height="4" fill="#1E293B" stroke="rgba(148, 163, 184, 0.3)" strokeWidth="0.8" />

          {/* High-gain Communication Dish */}
          <path d="M 128 43 L 128 32" stroke="#8B98B0" strokeWidth="1.2" />
          <path
            d="M 120 28 Q 128 23, 136 28"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="1.5"
          />
          <circle cx="128" cy="27" r="1" fill="#38BDF8" />

          {/* Communications Beacon Light (pulsing) */}
          <circle
            cx="65"
            cy="12"
            r="2"
            fill="#FFC857"
            className="beacon-light"
          />
          <circle
            cx="65"
            cy="12"
            r="5"
            fill="none"
            stroke="#FFC857"
            strokeWidth="0.8"
            className="beacon-light"
          />

          {/* Photovoltaic array miniature field */}
          <g stroke="#FFC857" strokeWidth="1" opacity="0.75">
            <line x1="5" y1="52" x2="16" y2="45" />
            <polygon points="4,46 16,39 20,44 8,51" fill="#0B132B" stroke="#FFC857" strokeWidth="0.8" />
            <line x1="12" y1="48" x2="16" y2="45" />
          </g>
        </g>
      </svg>
    </div>
  );
};
