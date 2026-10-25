import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { ForecastActualChart } from '../components/charts/ForecastActualChart';
import { ForecastErrorChart } from '../components/charts/ForecastErrorChart';
import { ShortfallCalculator } from '../components/features/ShortfallCalculator';
import { ExportMenu } from '../components/common/ExportMenu';
import { calculateIntervalCoverage, formatCutoff } from '../utils/forecastPresentation';
import type { ForecastResponse, AppOutletContext } from '../types';

export const Overview: React.FC = () => {
  const { selectedDate, cutoffHour, cutoffMinute } = useOutletContext<AppOutletContext>();

  const {
    data: forecastData,
    loading,
    error,
    refetch,
  } = useApi<ForecastResponse>(
    () => api.getForecasts(selectedDate, cutoffHour, cutoffMinute),
    [selectedDate, cutoffHour, cutoffMinute]
  );

  if (loading) {
    return <LoadingState message={`Fetching BMRS WINDFOR and FUELHH data for ${selectedDate}...`} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Overview Data"
        message={error}
        onRetry={refetch}
      />
    );
  }

  if (!forecastData || !forecastData.intervals || forecastData.intervals.length === 0) {
    return (
      <EmptyState
        title="No Forecast Records"
        description={`No day-ahead forecast publications found for ${selectedDate} prior to ${String(
          cutoffHour
        ).padStart(2, '0')}:${String(cutoffMinute).padStart(2, '0')} UTC cutoff.`}
      />
    );
  }

  const { intervals, summary, cutoff } = forecastData;
  const intervalCoverage = calculateIntervalCoverage(intervals, selectedDate, selectedDate);
  const cutoffDisplay = formatCutoff(cutoff, {
    hour: cutoffHour,
    minute: cutoffMinute,
    timezone: 'UTC',
  });

  // Compute peak observed and peak forecast
  let peakActual = 0;
  let peakForecast = 0;
  intervals.forEach((i) => {
    if (i.actualGeneration && i.actualGeneration > peakActual) peakActual = i.actualGeneration;
    if (i.forecastGeneration && i.forecastGeneration > peakForecast) peakForecast = i.forecastGeneration;
  });

  const biasTrend =
    summary.bias === null || summary.bias === 0
      ? 'neutral'
      : summary.bias > 0
      ? 'warning'
      : 'positive';

  return (
    <div className="space-y-6">
      {/* Page Title & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2a3a4e] gap-2">
        <div>
          <h1 className="text-base font-semibold text-[#e2e8f0]">
            GB Wind Generation Day-Ahead Intelligence
          </h1>
          <p className="text-xs text-[#94a3b8] font-mono">
            Settlement Date: <span className="text-[#14b8a6]">{selectedDate}</span> • Decision Cutoff:{' '}
            <span className="text-[#14b8a6]">
              {cutoffDisplay}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          {intervalCoverage.percentage === null ? (
            <span className="px-2 py-1 rounded bg-[#1a2332] border border-[#2a3a4e] text-[#94a3b8]">
              No valid matched intervals
            </span>
          ) : (
            <>
              <span className="px-2 py-1 rounded bg-[#1a2332] border border-[#2a3a4e] text-[#94a3b8]">
                Valid Intervals: <strong className="text-[#e2e8f0]">{intervalCoverage.validCount} / {intervalCoverage.expectedCount}</strong>
              </span>
              <span className="px-2 py-1 rounded bg-[#1a2332] border border-[#2a3a4e] text-[#14b8a6]">
                Coverage: <strong className="text-[#14b8a6]">{intervalCoverage.percentage.toFixed(1).replace(/\.0$/, '')}%</strong>
              </span>
            </>
          )}
          <ExportMenu
            selectedDate={selectedDate}
            summary={summary}
            intervals={intervals}
            cutoff={cutoff}
            fallbackCutoff={{
              hour: cutoffHour,
              minute: cutoffMinute,
              timezone: 'UTC',
            }}
          />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Mean Absolute Error (MAE)"
          value={summary.mae}
          unit="MW"
          description="Average magnitude of forecast error"
          subtext={summary.mape ? `${summary.mape.toFixed(1)}% MAPE` : undefined}
          badge="Dispersion"
        />

        <MetricCard
          label="Root Mean Square Error (RMSE)"
          value={summary.rmse}
          unit="MW"
          description="Penalizes large tail dispatch errors"
          badge="Risk"
        />

        <MetricCard
          label="Systemic Mean Bias"
          value={summary.bias !== null && summary.bias > 0 ? `+${summary.bias.toFixed(1)}` : summary.bias}
          unit="MW"
          description="Signed delta (Forecast - Actual)"
          subtext={
            summary.bias !== null
              ? summary.bias > 0
                ? 'Overpredicted volume'
                : 'Underpredicted volume'
              : undefined
          }
          trend={biasTrend}
          badge="Direction"
        />

        <MetricCard
          label="Peak Generation"
          value={peakActual}
          unit="MW"
          description={`Forecast Peak: ${peakForecast.toLocaleString()} MW`}
          subtext={`Delta: ${((peakForecast - peakActual) > 0 ? '+' : '')}${(peakForecast - peakActual).toLocaleString()} MW`}
          trend="neutral"
          badge="Capacity"
        />
      </div>

      {/* Main Forecast vs Actual Chart */}
      <div className="w-full">
        <ForecastActualChart
          intervals={intervals}
          title={`Day-Ahead Forecast vs Settlement Actuals — ${selectedDate}`}
          subtitle={`Evaluated against latest WINDFOR published before ${cutoffDisplay.replace(/^D-1 • /, '')}`}
          height={380}
        />
      </div>

      {/* Secondary Chart: Forecast Error over time */}
      <div className="w-full">
        <ForecastErrorChart
          intervals={intervals}
          title={`Settlement Period Forecast Errors (MW) — ${selectedDate}`}
          height={260}
        />
      </div>

      {/* Quick stats & shortfall calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-4">
            <h3 className="text-xs font-semibold text-[#e2e8f0] uppercase tracking-wider mb-3">
              Distribution Diagnostics
            </h3>
            <div className="space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-[#94a3b8] mb-1">
                  <span>Overprediction Periods:</span>
                  <span className="text-[#f59e0b] font-semibold">
                    {summary.overpredictionPct !== null ? `${summary.overpredictionPct}%` : '—'}
                  </span>
                </div>
                <div className="w-full bg-[#0f1729] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#f59e0b] h-full rounded-full"
                    style={{ width: `${summary.overpredictionPct ?? 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[#94a3b8] mb-1">
                  <span>Underprediction Periods:</span>
                  <span className="text-[#3b82f6] font-semibold">
                    {summary.underpredictionPct !== null ? `${summary.underpredictionPct}%` : '—'}
                  </span>
                </div>
                <div className="w-full bg-[#0f1729] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#3b82f6] h-full rounded-full"
                    style={{ width: `${summary.underpredictionPct ?? 0}%` }}
                  />
                </div>
              </div>

              
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <ShortfallCalculator
            initialForecastMw={Math.round(peakForecast * 0.75)}
            intervals={intervals}
            selectedDate={selectedDate}
          />
        </div>
      </div>
    </div>
  );
};
