import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { useLunagridState } from '../context/LunagridContext';
import { AlertCircle, TrendingDown, Sun, Zap, BatteryCharging } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0B1120] border border-border/80 rounded-lg p-3 shadow-xl text-xs space-y-1.5 z-50">
        <div className="font-heading font-semibold text-text pb-1 border-b border-border/50 flex items-center justify-between gap-4">
          <span>Hour +{label}h</span>
          <span className="font-mono text-[10px] text-text-muted">T+{label}:00</span>
        </div>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-text-muted">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
            </span>
            <span className="font-mono-numbers font-semibold text-text">
              {Number(entry.value).toFixed(1)} kW
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const ForecastChart = () => {
  const { state } = useLunagridState();

  const forecast = state?.forecast || [];
  const risk = state?.risk || {};
  const forecastModel = state?.forecast_model || { name: 'baseline', mae_kw: null };
  const isXgb = forecastModel?.name?.toLowerCase() === 'xgboost';
  const isShortage = Boolean(risk.shortage_expected && risk.end_hour > risk.start_hour);

  return (
    <div className="mission-card p-4 sm:p-5 flex flex-col h-full">
      {/* Top Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading font-bold text-sm tracking-wide text-text uppercase">
              Forecast & Risk Horizon
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-raised text-text-muted border border-border">
              24-HOUR ADVISORY WINDOW
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-flex items-center gap-1.5 ${
              isXgb
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-500/10 text-slate-300 border-slate-500/30'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Forecast model: {isXgb ? 'XGBoost' : 'Baseline'}
              {forecastModel?.mae_kw != null && (
                <span className="opacity-90">
                  · MAE {Number(forecastModel.mae_kw).toFixed(2)} kW on held-out data
                </span>
              )}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Projected PV generation vs base aggregate demand and usable battery buffer.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-solar/40 border border-solar" />
            <span className="text-text-muted text-[11px]">{isXgb ? 'XGBoost Solar' : 'Solar (PV)'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b border-dashed border-slate-400" />
            <span className="text-text-muted text-[11px]">Baseline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-demand" />
            <span className="text-text-muted text-[11px]">Demand</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b border-dashed border-battery" />
            <span className="text-text-muted text-[11px]">Usable Battery</span>
          </div>
          {isShortage && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm bg-danger/25 border border-danger/60" />
              <span className="text-danger font-medium text-[11px]">Shortage Window</span>
            </div>
          )}
        </div>
      </div>

      {/* Deficit Banner if Shortage Expected */}
      {isShortage && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/30 flex items-center justify-between text-xs text-danger font-medium">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" aria-hidden="true" />
            <span>
              Anticipated power deficit between <strong>T+{risk.start_hour}h</strong> and <strong>T+{risk.end_hour}h</strong>
            </span>
          </div>
          <div className="flex items-center gap-1 font-mono-numbers">
            <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Max Deficit: {Number(risk.max_deficit_kw || 0).toFixed(1)} kW</span>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="flex-1 w-full min-h-[280px] h-[310px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={forecast}
            margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFC857" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#FFC857" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="hour"
              stroke="#8B98B0"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
              tickFormatter={(h) => `+${h}h`}
            />
            <YAxis
              stroke="#8B98B0"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
              tickFormatter={(v) => `${v}k`}
              domain={[0, 'auto']}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* "Now" Marker */}
            <ReferenceLine
              x={0}
              stroke="#8B98B0"
              strokeDasharray="3 3"
              label={{
                value: 'NOW',
                position: 'insideTopLeft',
                fill: '#8B98B0',
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'JetBrains Mono',
              }}
            />

            {/* Shortage Window Red Shaded Band */}
            {isShortage && (
              <ReferenceArea
                x1={risk.start_hour}
                x2={risk.end_hour}
                fill="#EF4444"
                fillOpacity={0.16}
                stroke="#EF4444"
                strokeOpacity={0.5}
                strokeDasharray="2 2"
                label={{
                  value: 'SHORTAGE WINDOW',
                  position: 'insideTop',
                  fill: '#EF4444',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'Space Grotesk',
                  letterSpacing: '0.05em',
                }}
              />
            )}

            {/* Baseline Yesterday Comparison (Thin Dashed Slate Line) */}
            <Line
              type="monotone"
              dataKey="baseline_solar_kw"
              name="Baseline (Yesterday)"
              stroke="#94A3B8"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
            />

            {/* Solar Gold Area */}
            <Area
              type="monotone"
              dataKey="solar_kw"
              name="Solar Output"
              stroke="#FFC857"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#solarGradient)"
              isAnimationActive={true}
              animationDuration={600}
            />

            {/* Demand Blue Line */}
            <Line
              type="monotone"
              dataKey="demand_kw"
              name="Base Demand"
              stroke="#38BDF8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={600}
            />

            {/* Usable Battery Green Dashed Line */}
            <Line
              type="monotone"
              dataKey="usable_battery_kw"
              name="Usable Battery"
              stroke="#34D399"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={true}
              animationDuration={600}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
