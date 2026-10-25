import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { ForecastInterval } from '../../types';

interface ForecastActualChartProps {
  intervals: ForecastInterval[];
  title?: string;
  subtitle?: string;
  height?: number;
}

interface ChartDataPoint {
  time: string;
  fullTime: string;
  forecast: number | null;
  actual: number | null;
  error: number | null;
  publishTime: string | null;
}

export const ForecastActualChart: React.FC<ForecastActualChartProps> = ({
  intervals,
  title = 'Day-Ahead Wind Forecast vs. Settlement Actual Generation',
  subtitle = '30-minute settlement period resolution (MW)',
  height = 360,
}) => {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return intervals.map((item) => {
      const dateObj = new Date(item.startTime);
      const timeStr = dateObj.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      });

      return {
        time: timeStr,
        fullTime: item.startTime,
        forecast: item.forecastGeneration,
        actual: item.actualGeneration,
        error: item.signedError,
        publishTime: item.publishTime,
      };
    });
  }, [intervals]);

  if (!intervals || intervals.length === 0) {
    return (
      <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-6 text-center text-[#94a3b8] font-mono text-xs">
        No interval data available for chart rendering.
      </div>
    );
  }

  return (
    <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#2a3a4e] mb-4 gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#e2e8f0]">{title}</h3>
          <p className="text-xs text-[#94a3b8] font-mono">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#3b82f6] rounded" />
            <span className="text-[#94a3b8]">Forecast (MW)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#22c55e] rounded" />
            <span className="text-[#94a3b8]">Actual (MW)</span>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3a4e" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickLine={false}
              axisLine={{ stroke: '#2a3a4e' }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickLine={false}
              axisLine={{ stroke: '#2a3a4e' }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
              unit=" MW"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload as ChartDataPoint;
                return (
                  <div className="bg-[#0f1729] border border-[#2a3a4e] rounded p-3 text-xs shadow-xl font-mono">
                    <div className="text-[#94a3b8] border-b border-[#2a3a4e] pb-1.5 mb-2 font-medium">
                      Interval: <span className="text-[#e2e8f0]">{data.time} UTC</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#3b82f6] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                          Forecast:
                        </span>
                        <span className="text-[#e2e8f0] font-semibold tabular-nums">
                          {data.forecast !== null ? `${data.forecast.toLocaleString()} MW` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#22c55e] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                          Actual:
                        </span>
                        <span className="text-[#e2e8f0] font-semibold tabular-nums">
                          {data.actual !== null ? `${data.actual.toLocaleString()} MW` : 'N/A'}
                        </span>
                      </div>
                      {data.error !== null && (
                        <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-[#2a3a4e]/70">
                          <span className="text-[#94a3b8]">Signed Error:</span>
                          <span
                            className={`font-semibold tabular-nums ${
                              data.error > 0
                                ? 'text-[#f59e0b]'
                                : data.error < 0
                                ? 'text-[#3b82f6]'
                                : 'text-[#e2e8f0]'
                            }`}
                          >
                            {data.error > 0 ? `+${data.error.toLocaleString()}` : data.error.toLocaleString()} MW
                          </span>
                        </div>
                      )}
                      {data.publishTime && (
                        <div className="text-[10px] text-[#64748b] pt-1 border-t border-[#2a3a4e]/40">
                          Published: {new Date(data.publishTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            <Legend content={() => null} />
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#0f1729' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: '#22c55e', strokeWidth: 2, fill: '#0f1729' }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
