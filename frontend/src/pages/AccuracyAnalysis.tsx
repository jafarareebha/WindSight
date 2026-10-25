import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { ForecastErrorChart } from '../components/charts/ForecastErrorChart';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Layers, Calendar } from 'lucide-react';
import type { AnalysisResponse, ForecastInterval, AppOutletContext } from '../types';
import { calculateIntervalCoverage, formatCutoff } from '../utils/forecastPresentation';

export const AccuracyAnalysis: React.FC = () => {
  const { cutoffHour, cutoffMinute } = useOutletContext<AppOutletContext>();
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-01-31');

  const {
    data: analysisData,
    loading,
    error,
    refetch,
  } = useApi<AnalysisResponse>(
    () => api.getAnalysis(startDate, endDate, cutoffHour, cutoffMinute),
    [startDate, endDate, cutoffHour, cutoffMinute]
  );

  const largestErrors = useMemo(() => {
    if (!analysisData || !analysisData.intervals) return { over: [], under: [] };

    const withError = analysisData.intervals.filter(
      (i): i is ForecastInterval & { signedError: number; absoluteError: number } =>
        i.signedError !== null && i.absoluteError !== null
    );

    const sortedBySigned = [...withError].sort((a, b) => b.signedError - a.signedError);
    const topOver = sortedBySigned.slice(0, 5); // Highest positive errors

    const sortedByUnder = [...withError].sort((a, b) => a.signedError - b.signedError);
    const topUnder = sortedByUnder.slice(0, 5); // Lowest negative errors

    return { over: topOver, under: topUnder };
  }, [analysisData]);

  // Scatter plot data: Forecast vs Actual
  const scatterData = useMemo(() => {
    if (!analysisData || !analysisData.intervals) return [];
    return analysisData.intervals
      .filter((i) => i.forecastGeneration !== null && i.actualGeneration !== null)
      .map((i) => ({
        forecast: i.forecastGeneration,
        actual: i.actualGeneration,
        error: i.signedError,
        time: i.startTime,
      }));
  }, [analysisData]);

  if (loading) {
    return (
      <LoadingState
        message={`Aggregating monthly telemetry analysis across ${startDate} to ${endDate}...`}
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Accuracy Analysis"
        message={error}
        onRetry={refetch}
      />
    );
  }

  if (!analysisData || !analysisData.metrics) {
    return (
      <EmptyState
        title="No Analysis Telemetry"
        description="Unable to compute statistical accuracy metrics for the specified period."
      />
    );
  }

  const { metrics, period, cutoff, dataFreshness } = analysisData;
  const intervalCoverage = calculateIntervalCoverage(analysisData.intervals, period.startDate, period.endDate);
  const cutoffDisplay = formatCutoff(cutoff, {
    hour: cutoffHour,
    minute: cutoffMinute,
    timezone: 'UTC',
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2a3a4e] gap-3">
        <div>
          <h1 className="text-base font-semibold text-[#e2e8f0]">
            January 2026 Forecast Accuracy &amp; Systemic Bias Analysis
          </h1>
          <p className="text-xs text-[#94a3b8] font-mono">
            Analysis Cohort: <span className="text-[#14b8a6]">{period.startDate}</span> to{' '}
            <span className="text-[#14b8a6]">{period.endDate}</span> • Cutoff: D-1{' '}
            <span className="text-[#14b8a6]">
              {cutoffDisplay.replace(/^D-1 • /, '')}
            </span>
          </p>
        </div>

        {/* Date range picker within Jan 2026 */}
        <div className="flex items-center gap-2 bg-[#1a2332] border border-[#2a3a4e] rounded-md p-1 px-2.5 text-xs font-mono">
          <Calendar className="w-3.5 h-3.5 text-[#14b8a6]" />
          <span className="text-[#94a3b8]">Range:</span>
          <input
            type="date"
            value={startDate}
            min="2026-01-01"
            max="2026-01-31"
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-xs text-[#e2e8f0] focus:outline-none cursor-pointer [color-scheme:dark]"
          />
          <span className="text-[#64748b]">to</span>
          <input
            type="date"
            value={endDate}
            min="2026-01-01"
            max="2026-01-31"
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-xs text-[#e2e8f0] focus:outline-none cursor-pointer [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Aggregate Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Cohort MAE"
          value={metrics.mae}
          unit="MW"
          description="Mean Absolute Error over entire period"
          subtext={metrics.mape ? `${metrics.mape.toFixed(1)}% MAPE` : undefined}
          badge="Cohort"
        />

        <MetricCard
          label="Cohort RMSE"
          value={metrics.rmse}
          unit="MW"
          description="Quadratic penalty for extreme forecast swings"
          badge="Volatility"
        />

        <MetricCard
          label="Systemic Mean Bias"
          value={metrics.bias !== null && metrics.bias > 0 ? `+${metrics.bias.toFixed(1)}` : metrics.bias}
          unit="MW"
          description="Signed mean error (Over (+) / Under (-))"
          trend={metrics.bias !== null && metrics.bias > 0 ? 'warning' : 'positive'}
          badge="Bias"
        />

        <MetricCard
          label="Dataset Sample Count"
          value={intervalCoverage.validCount || null}
          unit="intervals"
          description={
            intervalCoverage.percentage === null
              ? 'No valid matched intervals'
              : `Telemetry coverage: ${intervalCoverage.validCount}/${intervalCoverage.expectedCount} (${intervalCoverage.percentage.toFixed(1).replace(/\.0$/, '')}%)`
          }
          subtext="48 settlement periods/day"
          badge="Integrity"
        />
      </div>

      {/* Error Over Time Chart */}
      {analysisData.intervals && analysisData.intervals.length > 0 && (
        <ForecastErrorChart
          intervals={analysisData.intervals}
          title="Residual Forecast Error Chronology (MW)"
          subtitle="Signed deltas across evaluated settlement periods"
          height={300}
        />
      )}

      {/* Correlation / Forecast vs Actual Scatter Plot */}
      <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2a3a4e] mb-4 gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#e2e8f0]">
              Forecast Reliability Correlation (Forecast vs. Actual MW)
            </h3>
            <p className="text-xs text-[#94a3b8] font-mono">
              Points along the 1:1 dashed line represent exact forecast matching
            </p>
          </div>
          <div className="text-xs font-mono text-[#64748b]">
            Total Pairs: {scatterData.length}
          </div>
        </div>

        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a4e" />
              <XAxis
                type="number"
                dataKey="forecast"
                name="Forecast"
                stroke="#64748b"
                fontSize={11}
                fontFamily="monospace"
                unit=" MW"
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="number"
                dataKey="actual"
                name="Actual"
                stroke="#64748b"
                fontSize={11}
                fontFamily="monospace"
                unit=" MW"
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="bg-[#0f1729] border border-[#2a3a4e] rounded p-2.5 text-xs font-mono shadow-xl">
                      <div className="text-[#94a3b8] border-b border-[#2a3a4e] pb-1 mb-1.5">
                        {new Date(item.time).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'UTC',
                        })}{' '}
                        UTC
                      </div>
                      <div className="text-[#3b82f6]">
                        Forecast: <span className="text-[#e2e8f0] font-semibold">{item.forecast.toLocaleString()} MW</span>
                      </div>
                      <div className="text-[#22c55e]">
                        Actual: <span className="text-[#e2e8f0] font-semibold">{item.actual.toLocaleString()} MW</span>
                      </div>
                      <div className="text-[#f59e0b] border-t border-[#2a3a4e]/60 pt-1 mt-1">
                        Delta: <span className="text-[#e2e8f0] font-semibold">{item.error > 0 ? `+${item.error.toLocaleString()}` : item.error.toLocaleString()} MW</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter
                name="Intervals"
                data={scatterData}
                fill="#14b8a6"
                fillOpacity={0.6}
                isAnimationActive={false}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Discrepancies Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Largest Overpredictions */}
        <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#2a3a4e]">
            <TrendingUp className="w-4 h-4 text-[#f59e0b]" />
            <h3 className="text-sm font-semibold text-[#e2e8f0]">
              Largest Overprediction Events (Shortfall Risk)
            </h3>
          </div>
          <p className="text-xs text-[#94a3b8] mb-3">
            Periods where wind generation was significantly below day-ahead expectations, demanding reserve dispatch:
          </p>
          <div className="space-y-2 font-mono text-xs">
            {largestErrors.over.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded bg-[#0f1729] border border-[#2a3a4e] flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-[#e2e8f0]">
                    {new Date(item.startTime).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'UTC',
                    })}{' '}
                    UTC
                  </div>
                  <div className="text-[11px] text-[#64748b]">
                    Forecast: {item.forecastGeneration?.toLocaleString()} MW • Actual: {item.actualGeneration?.toLocaleString()} MW
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#f59e0b]">
                    +{item.signedError.toLocaleString()} MW
                  </span>
                  <div className="text-[10px] text-[#94a3b8]">Overpredicted</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Largest Underpredictions */}
        <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#2a3a4e]">
            <TrendingDown className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-semibold text-[#e2e8f0]">
              Largest Underprediction Events (Surplus / Spill Risk)
            </h3>
          </div>
          <p className="text-xs text-[#94a3b8] mb-3">
            Periods where outturn wind exceeded forecast, potentially causing downward balancing or curtailment:
          </p>
          <div className="space-y-2 font-mono text-xs">
            {largestErrors.under.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded bg-[#0f1729] border border-[#2a3a4e] flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-[#e2e8f0]">
                    {new Date(item.startTime).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'UTC',
                    })}{' '}
                    UTC
                  </div>
                  <div className="text-[11px] text-[#64748b]">
                    Forecast: {item.forecastGeneration?.toLocaleString()} MW • Actual: {item.actualGeneration?.toLocaleString()} MW
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#3b82f6]">
                    {item.signedError.toLocaleString()} MW
                  </span>
                  <div className="text-[10px] text-[#94a3b8]">Underpredicted</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
