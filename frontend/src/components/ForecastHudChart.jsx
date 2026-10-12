import React from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, Moon, Sun, Zap } from 'lucide-react';

export const ForecastHudChart = ({ forecast = [], risk = {}, scrubHour = null, onSelectHour = null }) => {
  const isShortage = Boolean(risk.shortage_expected);
  const startHour = Number(risk.start_hour ?? 2);
  const endHour = Number(risk.end_hour ?? 9);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const hour = label;
    const isNightHour = isShortage && hour >= startHour && hour <= endHour;

    const solarVal = payload.find((p) => p.dataKey === 'solar_kw')?.value ?? 0;
    const demandVal = payload.find((p) => p.dataKey === 'demand_kw')?.value ?? 0;
    const margin = Number(solarVal) - Number(demandVal);

    return (
      <div className="bg-[#071228]/95 border border-[rgba(56,189,248,0.5)] p-3 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.85)] text-xs font-mono select-none">
        <div className="text-[#8CA3C2] border-b border-[rgba(56,189,248,0.2)] pb-1.5 mb-2 flex items-center justify-between gap-4">
          <span className="font-bold text-[#EAF4FF]">T+{hour}h:00</span>
          {isNightHour ? (
            <span className="text-[#FF3B4E] font-bold px-1.5 py-0.5 rounded bg-[rgba(255,59,78,0.15)] border border-[rgba(255,59,78,0.4)]">
              DEFICIT WINDOW
            </span>
          ) : (
            <span className="text-[#22E58B] px-1.5 py-0.5 rounded bg-[rgba(34,229,139,0.1)] border border-[rgba(34,229,139,0.3)]">
              NOMINAL
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between gap-5">
            <span className="text-[#22D3EE] font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#22D3EE]" /> Solar Generation:
            </span>
            <span className="text-[#EAF4FF] font-bold">{Number(solarVal).toFixed(1)} kW</span>
          </div>

          <div className="flex justify-between gap-5">
            <span className="text-[#A855F7] font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#A855F7]" /> Habitat Demand:
            </span>
            <span className="text-[#EAF4FF] font-bold">{Number(demandVal).toFixed(1)} kW</span>
          </div>

          <div className="flex justify-between gap-5 pt-1.5 border-t border-white/10 font-bold">
            <span className={margin >= 0 ? 'text-[#22E58B]' : 'text-[#FF3B4E]'}>
              Net Margin:
            </span>
            <span className={margin >= 0 ? 'text-[#22E58B]' : 'text-[#FF3B4E]'}>
              {margin >= 0 ? `+${margin.toFixed(1)} kW` : `${margin.toFixed(1)} kW`}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col justify-between" id="forecast-hud-chart">
      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(56,189,248,0.18)] pb-2 mb-2">
        <div className="flex items-center gap-4 text-xs font-exo font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#22D3EE] shadow-[0_0_6px_#22D3EE]" />
            <span className="text-[#EAF4FF]">Solar Generation</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#A855F7] shadow-[0_0_6px_#A855F7]" />
            <span className="text-[#EAF4FF]">Base Demand</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b border-dashed border-[#8CA3C2]" />
            <span className="text-[#8CA3C2]">Nominal Baseline (10 kW)</span>
          </div>
        </div>

        {isShortage && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[rgba(255,59,78,0.15)] text-[#FF3B4E] border border-[rgba(255,59,78,0.4)] animate-pulse">
            <Moon className="w-3.5 h-3.5" />
            <span>T+{startHour}h–T+{endHour}h Shortage Window</span>
          </div>
        )}
      </div>

      {/* Main Responsive Area Chart */}
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={forecast}
            margin={{ top: 12, right: 16, left: 10, bottom: 4 }}
            onClick={(e) => {
              if (e && e.activeLabel !== undefined && onSelectHour) {
                onSelectHour(e.activeLabel);
              }
            }}
          >
            <defs>
              {/* Cyan Solar Area Gradient */}
              <linearGradient id="hudSolarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#22D3EE" stopOpacity={0.02} />
              </linearGradient>

              {/* Red Deficit Region Gradient */}
              <linearGradient id="deficitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF3B4E" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#FF3B4E" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="hour"
              stroke="#8CA3C2"
              fontSize={11}
              fontFamily="JetBrains Mono, monospace"
              tickLine={false}
              tickFormatter={(h) => `+${h}h`}
            />

            {/* Explicit kW labels on Y-Axis: 0 kW, 4 kW, 8 kW, 12 kW */}
            <YAxis
              stroke="#8CA3C2"
              fontSize={11}
              fontFamily="JetBrains Mono, monospace"
              domain={[0, 14]}
              ticks={[0, 4, 8, 12]}
              tickLine={false}
              tickFormatter={(v) => `${v} kW`}
              width={48}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Reference baseline for nominal daylight: 10 kW */}
            <ReferenceLine
              y={10}
              stroke="#8CA3C2"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />

            {/* Active Scrub Hour Vertical Line if selected */}
            {scrubHour !== null && (
              <ReferenceLine
                x={scrubHour}
                stroke="#22D3EE"
                strokeWidth={1.5}
                strokeDasharray="2 2"
              />
            )}

            {/* Solar Generation Area (Cyan Gradient) */}
            <Area
              type="monotone"
              dataKey="solar_kw"
              name="Solar Output"
              stroke="#22D3EE"
              strokeWidth={2.5}
              fill="url(#hudSolarGrad)"
              style={{ filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.5))' }}
            />

            {/* Demand Requirement Line (Violet) */}
            <Line
              type="monotone"
              dataKey="demand_kw"
              name="Base Demand"
              stroke="#A855F7"
              strokeWidth={2.5}
              dot={false}
              style={{ filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.6))' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] font-mono text-[#8CA3C2] flex justify-between border-t border-[rgba(56,189,248,0.18)] pt-2 mt-2">
        <span>Model: Orbital Ephemeris T+24h</span>
        <span>Resolution: 1.0 hr intervals • Y-Axis: kW Tabular Telemetry</span>
      </div>
    </div>
  );
};
