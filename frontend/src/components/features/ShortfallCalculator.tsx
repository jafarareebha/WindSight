import React, { useState, useEffect } from 'react';
import { Calculator, AlertTriangle, ArrowRight, ShieldAlert, Clock } from 'lucide-react';
import { api } from '../../services/api';
import type { ForecastInterval, ShortfallResponse } from '../../types';

interface ShortfallCalculatorProps {
  initialForecastMw?: number;
  intervals?: ForecastInterval[];
  selectedDate?: string;
}

export const ShortfallCalculator: React.FC<ShortfallCalculatorProps> = ({
  initialForecastMw = 14500,
  intervals = [],
  selectedDate,
}) => {
  const [demandMw, setDemandMw] = useState<number>(36000);
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<number | 'custom'>('custom');
  const [forecastMw, setForecastMw] = useState<number>(initialForecastMw);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ShortfallResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync if initialForecastMw or intervals change
  useEffect(() => {
    if (intervals && intervals.length > 0) {
      // Default to evening peak interval (~17:30 UTC or Period 36) or first valid
      const peakEveningIndex = intervals.findIndex((inv) => {
        const d = new Date(inv.startTime);
        return d.getUTCHours() === 17 && d.getUTCMinutes() === 30 && inv.forecastGeneration !== null;
      });
      const chosenIdx = peakEveningIndex >= 0 ? peakEveningIndex : intervals.findIndex((inv) => inv.forecastGeneration !== null);
      if (chosenIdx >= 0) {
        setSelectedIntervalIndex(chosenIdx);
        setForecastMw(intervals[chosenIdx].forecastGeneration ?? initialForecastMw);
        return;
      }
    }
    setForecastMw(initialForecastMw);
  }, [intervals, initialForecastMw]);

  const handleIntervalSelect = (value: string) => {
    if (value === 'custom') {
      setSelectedIntervalIndex('custom');
    } else {
      const idx = Number(value);
      setSelectedIntervalIndex(idx);
      const chosen = intervals[idx];
      if (chosen && chosen.forecastGeneration !== null) {
        setForecastMw(chosen.forecastGeneration);
      }
    }
  };

  const handleCalculate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.calculateShortfall({
        demand_mw: Number(demandMw),
        forecast_mw: Number(forecastMw),
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const calculatedShortfall = Math.max(0, demandMw - forecastMw);

  const selectedInterval =
    typeof selectedIntervalIndex === 'number' && intervals[selectedIntervalIndex]
      ? intervals[selectedIntervalIndex]
      : null;

  return (
    <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-5">
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#2a3a4e]">
        <Calculator className="w-4 h-4 text-[#14b8a6]" />
        <div>
          <h3 className="text-sm font-semibold text-[#e2e8f0]">Residual Demand & Shortfall Stress Calculator</h3>
          <p className="text-xs text-[#94a3b8]">
            Simulate thermal/storage dispatch requirements given wind forecast generation
          </p>
        </div>
      </div>

      <form onSubmit={handleCalculate} className="space-y-4">
        {intervals && intervals.length > 0 && (
          <div className="bg-[#0f1729] border border-[#2a3a4e] rounded p-3">
            <label className="block text-xs font-mono text-[#94a3b8] mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#14b8a6]" />
              <span>Target Settlement Interval (30-Minute Period)</span>
            </label>
            <select
              value={selectedIntervalIndex}
              onChange={(e) => handleIntervalSelect(e.target.value)}
              className="w-full bg-[#1a2332] border border-[#2a3a4e] rounded px-3 py-2 text-xs font-mono text-[#e2e8f0] focus:outline-none focus:border-[#14b8a6] cursor-pointer"
            >
              <option value="custom">Manual / Custom Forecast Value</option>
              {intervals.map((inv, idx) => {
                const dateObj = new Date(inv.startTime);
                const timeStr = dateObj.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                  timeZone: 'UTC',
                });
                const periodNum = idx + 1;
                const fcText =
                  inv.forecastGeneration !== null
                    ? `${inv.forecastGeneration.toLocaleString()} MW`
                    : 'No forecast';
                return (
                  <option key={inv.startTime} value={idx}>
                    Period {periodNum} ({timeStr} UTC) — Forecast: {fcText}
                  </option>
                );
              })}
            </select>
            {selectedInterval && (
              <p className="text-[11px] text-[#14b8a6] mt-1.5 font-mono">
                Using Period {Number(selectedIntervalIndex) + 1} ({new Date(selectedInterval.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })} UTC) day-ahead forecast of {selectedInterval.forecastGeneration?.toLocaleString() ?? '—'} MW
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-[#94a3b8] mb-1.5">
              System Demand (MW)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="100"
                value={demandMw}
                onChange={(e) => setDemandMw(Number(e.target.value))}
                className="w-full bg-[#0f1729] border border-[#2a3a4e] rounded px-3 py-2 text-sm font-mono text-[#e2e8f0] focus:outline-none focus:border-[#14b8a6]"
                placeholder="e.g. 36000"
              />
              <span className="absolute right-3 top-2.5 text-xs text-[#64748b] font-mono">
                MW
              </span>
            </div>
            <p className="text-[11px] text-[#64748b] mt-1 font-mono">
              Typical UK winter peak: 38,000–44,000 MW
            </p>
          </div>

          <div>
            <label className="block text-xs font-mono text-[#94a3b8] mb-1.5">
              Wind Generation Forecast (MW)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="100"
                value={forecastMw}
                onChange={(e) => {
                  setSelectedIntervalIndex('custom');
                  setForecastMw(Number(e.target.value));
                }}
                className="w-full bg-[#0f1729] border border-[#2a3a4e] rounded px-3 py-2 text-sm font-mono text-[#e2e8f0] focus:outline-none focus:border-[#14b8a6]"
                placeholder="e.g. 14500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-[#64748b] font-mono">
                MW
              </span>
            </div>
            <p className="text-[11px] text-[#64748b] mt-1 font-mono">
              GB Wind Nameplate Capacity: ~30,000 MW
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            {[
              { label: 'Low Wind / High Peak', d: 42000, f: 3200 },
              { label: 'Average Winter', d: 36000, f: 14500 },
              { label: 'High Wind Storm', d: 33000, f: 22000 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setSelectedIntervalIndex('custom');
                  setDemandMw(preset.d);
                  setForecastMw(preset.f);
                }}
                className="px-2 py-1 text-[11px] font-mono bg-[#0f1729] hover:bg-[#1e2a3a] text-[#94a3b8] rounded border border-[#2a3a4e] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded bg-[#14b8a6] hover:bg-[#0d9488] text-[#0f1729] transition-colors cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'Evaluating...' : 'Compute Residual Shortfall'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 text-xs font-mono text-[#ef4444]">
          {error}
        </div>
      )}

      {/* Result Display */}
      {(result || (!error && demandMw > 0)) && (
        <div className="mt-5 pt-4 border-t border-[#2a3a4e]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-[#0f1729] border border-[#2a3a4e] p-3 rounded">
              <span className="text-[11px] font-mono text-[#94a3b8] uppercase">Target Demand</span>
              <div className="text-lg font-mono font-semibold text-[#e2e8f0] tabular-nums mt-0.5">
                {(result?.demand_mw ?? demandMw).toLocaleString()} MW
              </div>
            </div>

            <div className="bg-[#0f1729] border border-[#2a3a4e] p-3 rounded">
              <span className="text-[11px] font-mono text-[#94a3b8] uppercase">Wind Share</span>
              <div className="text-lg font-mono font-semibold text-[#14b8a6] tabular-nums mt-0.5">
                {(((result?.forecast_mw ?? forecastMw) / (result?.demand_mw ?? demandMw)) * 100).toFixed(1)}%
              </div>
              <span className="text-[10px] text-[#64748b] font-mono">
                {(result?.forecast_mw ?? forecastMw).toLocaleString()} MW forecast
              </span>
            </div>

            <div className="bg-[#0f1729] border border-[#2a3a4e] p-3 rounded">
              <span className="text-[11px] font-mono text-[#94a3b8] uppercase">Thermal/Interconnector Residual</span>
              <div className="text-lg font-mono font-semibold text-[#f59e0b] tabular-nums mt-0.5">
                {(result?.shortfall_mw ?? calculatedShortfall).toLocaleString()} MW
              </div>
              <span className="text-[10px] text-[#64748b] font-mono">Capacity required</span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-[#0f1729]/70 border border-[#2a3a4e] rounded text-[11px] text-[#94a3b8] font-mono leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#e2e8f0]">System Operational Notice: </span>
              {result?.disclaimer ||
                'Simulated shortfall calculation based on raw day-ahead forecast deltas. This metric is informational and does not account for interconnectors, pumped storage, rapid CCGT spinning reserves, or demand-side balancing mechanisms.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
