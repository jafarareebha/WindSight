import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { ForecastTable } from '../components/tables/ForecastTable';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { X, History, Clock, Activity, CheckCircle2 } from 'lucide-react';
import type {
  ForecastResponse,
  ForecastInterval,
  ForecastPublicationsResponse,
  AppOutletContext,
} from '../types';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatMw = (value: unknown, signed = false): string => {
  if (!isFiniteNumber(value)) return '—';
  return `${signed && value > 0 ? '+' : ''}${value.toLocaleString()} MW`;
};

export const ForecastExplorer: React.FC = () => {
  const { selectedDate, cutoffHour, cutoffMinute } = useOutletContext<AppOutletContext>();
  const [selectedInterval, setSelectedInterval] = useState<ForecastInterval | null>(null);
  const [revisionsLoading, setRevisionsLoading] = useState<boolean>(false);
  const [revisionsData, setRevisionsData] = useState<ForecastPublicationsResponse | null>(null);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);

  const {
    data: forecastData,
    loading,
    error,
    refetch,
  } = useApi<ForecastResponse>(
    () => api.getForecasts(selectedDate, cutoffHour, cutoffMinute),
    [selectedDate, cutoffHour, cutoffMinute]
  );

  const handleSelectInterval = async (interval: ForecastInterval) => {
    setSelectedInterval(interval);
    setRevisionsLoading(true);
    setRevisionsError(null);
    try {
      const response = await api.getForecastPublications(
        selectedDate,
        interval.startTime,
        cutoffHour,
        cutoffMinute
      );
      setRevisionsData(response);
    } catch (err) {
      setRevisionsError(
        err instanceof Error ? err.message : 'Failed to load publication revisions'
      );
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedInterval(null);
    setRevisionsData(null);
    setRevisionsError(null);
  };

  if (loading) {
    return <LoadingState message={`Loading interval settlement telemetry for ${selectedDate}...`} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Interval Telemetry"
        message={error}
        onRetry={refetch}
      />
    );
  }

  if (!forecastData || !forecastData.intervals || forecastData.intervals.length === 0) {
    return (
      <EmptyState
        title="No Interval Data"
        description={`No settlement period intervals recorded for ${selectedDate}.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2a3a4e] gap-2">
        <div>
          <h1 className="text-base font-semibold text-[#e2e8f0]">
            Settlement Period Forecast Explorer
          </h1>
          <p className="text-xs text-[#94a3b8] font-mono">
            Granular 30-minute breakdown • Date: <span className="text-[#14b8a6]">{selectedDate}</span> •
            Click "Revisions" on any row to audit forecast updates over time
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2 py-1 rounded bg-[#1a2332] border border-[#2a3a4e] text-[#94a3b8]">
            Records: <strong className="text-[#e2e8f0]">{forecastData.intervals.length}</strong>
          </span>
        </div>
      </div>

      {/* Main Table */}
      <ForecastTable
        intervals={forecastData.intervals}
        onSelectInterval={handleSelectInterval}
      />

      {/* Publication History Modal / Drawer */}
      {selectedInterval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#2a3a4e] flex items-center justify-between bg-[#0f1729]/80">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#14b8a6]" />
                <h3 className="text-sm font-semibold text-[#e2e8f0]">
                  Forecast Publication History
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a3a] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Subhead */}
            <div className="p-4 border-b border-[#2a3a4e] bg-[#1a2332] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <span className="text-[#64748b] block text-[11px]">Target Period</span>
                <span className="text-[#e2e8f0] font-semibold">
                  {new Date(selectedInterval.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'UTC',
                  })}{' '}
                  UTC
                </span>
              </div>
              <div>
                <span className="text-[#64748b] block text-[11px]">Actual Outturn</span>
                <span className="text-[#22c55e] font-semibold">
                  {formatMw(selectedInterval.actualGeneration)}
                </span>
              </div>
              <div>
                <span className="text-[#64748b] block text-[11px]">Cutoff Forecast</span>
                <span className="text-[#3b82f6] font-semibold">
                  {formatMw(selectedInterval.forecastGeneration)}
                </span>
              </div>
              <div>
                <span className="text-[#64748b] block text-[11px]">Signed Error</span>
                <span
                  className={`font-semibold ${
                    isFiniteNumber(selectedInterval.signedError) && selectedInterval.signedError > 0
                      ? 'text-[#f59e0b]'
                      : 'text-[#3b82f6]'
                  }`}
                >
                  {formatMw(selectedInterval.signedError, true)}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs">
              {revisionsLoading ? (
                <div className="py-8 flex flex-col items-center justify-center text-[#94a3b8]">
                  <Activity className="w-5 h-5 text-[#14b8a6] animate-pulse mb-2" />
                  <span>Retrieving publication chronology from B1620 feed...</span>
                </div>
              ) : revisionsError ? (
                <div className="p-3 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444]">
                  {revisionsError}
                </div>
              ) : revisionsData && revisionsData.publications && revisionsData.publications.length > 0 ? (
                <div>
                  <div className="text-[11px] text-[#64748b] mb-3">
                    Chronological WINDFOR releases received for this target settlement period. The entry active at the decision cutoff is highlighted.
                  </div>
                  <div className="space-y-2">
                    {revisionsData.publications.map((pub, idx) => {
                      const pubDate = pub.publishTime ? new Date(pub.publishTime) : null;
                      const hasValidDate = pubDate && !Number.isNaN(pubDate.getTime());
                      const isChosen =
                        Boolean(selectedInterval.publishTime &&
                        pub.publishTime &&
                        new Date(pub.publishTime).getTime() ===
                          new Date(selectedInterval.publishTime).getTime());
                      const genValue = pub.generation ?? pub.forecastGeneration;

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded border transition-colors flex items-center justify-between ${
                            isChosen
                              ? 'bg-[#14b8a6]/10 border-[#14b8a6]/50 text-[#e2e8f0]'
                              : 'bg-[#0f1729] border-[#2a3a4e] text-[#94a3b8]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Clock className="w-3.5 h-3.5 text-[#64748b]" />
                            <div>
                              <div className="font-semibold text-[#e2e8f0]">
                                {hasValidDate
                                  ? `${pubDate.toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      timeZone: 'UTC',
                                    })} UTC`
                                  : '—'}
                              </div>
                              <div className="text-[10px] text-[#64748b]">
                                Publication Timestamp
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-semibold text-[#3b82f6] text-sm tabular-nums">
                              {formatMw(genValue)}
                            </div>
                            {isChosen && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#14b8a6] font-semibold">
                                <CheckCircle2 className="w-3 h-3" />
                                Active at Cutoff
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-[#64748b]">
                  Single publication record available for this settlement period.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#2a3a4e] bg-[#0f1729]/80 flex justify-end">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-3 py-1.5 rounded text-xs font-mono font-medium bg-[#1e2a3a] hover:bg-[#2a3a4e] text-[#e2e8f0] border border-[#2a3a4e] transition-colors"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
