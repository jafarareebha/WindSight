import React from 'react';
import { Database, GitCompare, Gauge, Scale, AlertOctagon, Layers } from 'lucide-react';

export const MethodologyPanel: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-5">
        <h3 className="text-base font-semibold text-[#e2e8f0] mb-2">
          Methodological Framework: GB Wind Power Day-Ahead Forecasting Intelligence
        </h3>
        <p className="text-sm text-[#94a3b8] leading-relaxed">
          WindSight provides an institutional-grade retrospective telemetry evaluation pipeline
          analyzing the accuracy, systemic bias, and volume risk of day-ahead Great Britain (GB)
          wind generation forecasts during January 2026. The platform reconstructs the exact
          information state available to power trading desks, balancing dispatchers, and system
          operators at specific decision cutoffs.
        </p>
      </div>

      {/* Grid of core pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Data Sources */}
        <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-[#0f1729] border border-[#2a3a4e] text-[#14b8a6]">
              <Database className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-[#e2e8f0]">1. Data Feeds & Sourcing</h4>
          </div>
          <p className="text-xs text-[#94a3b8] leading-relaxed mb-3">
            All data is sourced directly from Elexon BMRS (Balancing Mechanism Reporting Service),
            the official data registry under the Balancing and Settlement Code (BSC):
          </p>
          <ul className="space-y-2 text-xs font-mono">
            <li className="bg-[#0f1729] p-2.5 rounded border border-[#2a3a4e]">
              <span className="text-[#14b8a6] font-semibold">B1620 / WINDFOR:</span>
              <p className="text-[#94a3b8] mt-1 font-sans">
                Day-ahead wind generation forecasts published at regular intervals by National Grid
                ESO / NESO. Each publication record includes a publication timestamp and forecast target intervals.
              </p>
            </li>
            <li className="bg-[#0f1729] p-2.5 rounded border border-[#2a3a4e]">
              <span className="text-[#22c55e] font-semibold">FUELHH:</span>
              <p className="text-[#94a3b8] mt-1 font-sans">
                Half-hourly outturn generation by fuel type across Great Britain. Represents metered
                settlement actuals for transmission-connected wind and large embedded generation.
              </p>
            </li>
          </ul>
        </div>

        {/* Decision Cutoff Logic */}
        <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-[#0f1729] border border-[#2a3a4e] text-[#14b8a6]">
              <Scale className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-[#e2e8f0]">2. Decision Cutoff Logic</h4>
          </div>
          <p className="text-xs text-[#94a3b8] leading-relaxed mb-3">
            GB power trading desks must commit positions into day-ahead auctions (e.g. EPEX SPOT and
            Nord Pool) before the auction gates close (typically 11:00 UTC D-1), with initial trade
            modeling finalizing around 09:30 UTC.
          </p>
          <div className="bg-[#0f1729] p-3 rounded border border-[#2a3a4e] text-xs font-mono text-[#94a3b8] leading-relaxed">
            <span className="text-[#e2e8f0] font-semibold">Point-in-Time Causality:</span>
            <p className="mt-1 font-sans">
              To prevent lookahead data leakage, for any settlement period on Day <span className="font-mono text-[#14b8a6]">D</span>,
              WindSight queries exclusively the latest WINDFOR forecast published prior to the user-specified cutoff time
              (<span className="font-mono text-[#14b8a6]">D-1 at HH:MM UTC</span>). Later intra-day revisions are strictly quarantined.
            </p>
          </div>
        </div>

        {/* Temporal Alignment */}
        <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-[#0f1729] border border-[#2a3a4e] text-[#14b8a6]">
              <GitCompare className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-[#e2e8f0]">3. 30-Minute Settlement Alignment</h4>
          </div>
          <p className="text-xs text-[#94a3b8] leading-relaxed mb-3">
            GB electricity market settlement operates strictly on 30-minute settlement periods (48 periods per day,
            SP 1 through SP 48, totaling 1,488 expected intervals for January 2026).
          </p>
          <div className="bg-[#0f1729] p-3 rounded border border-[#2a3a4e] text-xs font-mono text-[#94a3b8] leading-relaxed">
            <span className="text-[#e2e8f0] font-semibold">Native Half-Hour Evaluation:</span>
            <p className="mt-1 font-sans">
              Every FUELHH settlement actual is evaluated at its native 30-minute resolution without averaging
              two half-hours into an hourly figure. Because WINDFOR national forecasts are issued at hourly cadence,
              each 30-minute settlement interval (:00 and :30) is evaluated against the prevailing hourly forecast rate
              covering that window. Missing records are excluded from statistical metrics and reflected in coverage percentages
              rather than being replaced with fabricated zeroes.
            </p>
          </div>
        </div>

        {/* Statistical Metrics */}
        <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-[#0f1729] border border-[#2a3a4e] text-[#14b8a6]">
              <Gauge className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-[#e2e8f0]">4. Statistical Error Formulations</h4>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="bg-[#0f1729] p-2.5 rounded border border-[#2a3a4e]">
              <div className="text-[#e2e8f0] font-semibold flex justify-between">
                <span>Mean Absolute Error (MAE)</span>
                <span className="text-[#64748b]">(MW)</span>
              </div>
              <code className="text-[#14b8a6] text-[11px] block mt-1">MAE = (1/N) * Σ |Forecast_i - Actual_i|</code>
            </div>
            <div className="bg-[#0f1729] p-2.5 rounded border border-[#2a3a4e]">
              <div className="text-[#e2e8f0] font-semibold flex justify-between">
                <span>Root Mean Square Error (RMSE)</span>
                <span className="text-[#64748b]">(MW)</span>
              </div>
              <code className="text-[#14b8a6] text-[11px] block mt-1">RMSE = sqrt((1/N) * Σ (Forecast_i - Actual_i)²)</code>
            </div>
            <div className="bg-[#0f1729] p-2.5 rounded border border-[#2a3a4e]">
              <div className="text-[#e2e8f0] font-semibold flex justify-between">
                <span>Systemic Bias (Mean Signed Error)</span>
                <span className="text-[#64748b]">(MW)</span>
              </div>
              <code className="text-[#14b8a6] text-[11px] block mt-1">Bias = (1/N) * Σ (Forecast_i - Actual_i)</code>
            </div>
          </div>
        </div>
      </div>

      {/* Assumptions & Limitations */}
      
    </div>
  );
};
