import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { ForecastInterval } from '../../types';

interface ForecastErrorChartProps {
  intervals: ForecastInterval[];
  title?: string;
  subtitle?: string;
  height?: number;
}

interface ErrorPoint {
  time: string;
  signedError: number | null;
  absoluteError: number | null;
  forecast: number | null;
  actual: number | null;
}

export const ForecastErrorChart: React.FC<ForecastErrorChartProps> = ({
  intervals,
  title = 'Forecast Delta & Bias Distribution (Signed Error)',
  subtitle = 'Signed Error = Forecast − Actual (Positive = Overprediction, Negative = Underprediction)',
  height = 280,
}) => {
  const chartData = useMemo<ErrorPoint[]>(() => {
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
        signedError: item.signedError,
        absoluteError: item.absoluteError,
        forecast: item.forecastGeneration,
        actual: item.actualGeneration,
      };
    });
  }, [intervals]);

  if (!intervals || intervals.length === 0) {
    return (
      <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-6 text-center text-[#94a3b8] font-mono text-xs">
        No error telemetry available.
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
            <span className="w-2.5 h-2.5 bg-[#f59e0b] rounded-sm" />
            <span className="text-[#94a3b8]">Overprediction (+MW)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#3b82f6] rounded-sm" />
            <span className="text-[#94a3b8]">Underprediction (-MW)</span>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
              tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v} MW`}
            />
            <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload as ErrorPoint;
                const isOver = (data.signedError ?? 0) > 0;
                return (
                  <div className="bg-[#0f1729] border border-[#2a3a4e] rounded p-3 text-xs shadow-xl font-mono">
                    <div className="text-[#94a3b8] border-b border-[#2a3a4e] pb-1.5 mb-2 font-medium">
                      Interval: <span className="text-[#e2e8f0]">{data.time} UTC</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#94a3b8]">Signed Delta:</span>
                        <span
                          className={`font-semibold tabular-nums ${
                            isOver ? 'text-[#f59e0b]' : 'text-[#3b82f6]'
                          }`}
                        >
                          {data.signedError !== null
                            ? `${data.signedError > 0 ? '+' : ''}${data.signedError.toLocaleString()} MW`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#94a3b8]">Abs Error (|e|):</span>
                        <span className="text-[#e2e8f0] font-semibold tabular-nums">
                          {data.absoluteError !== null
                            ? `${data.absoluteError.toLocaleString()} MW`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-[#2a3a4e]/60 text-[#64748b]">
                        <span>Direction:</span>
                        <span className="font-medium text-[#e2e8f0]">
                          {data.signedError === null
                            ? 'N/A'
                            : data.signedError > 0
                            ? 'Overpredicted generation'
                            : data.signedError < 0
                            ? 'Underpredicted generation'
                            : 'Exact match'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="signedError" isAnimationActive={false}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={(entry.signedError ?? 0) >= 0 ? '#f59e0b' : '#3b82f6'}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
