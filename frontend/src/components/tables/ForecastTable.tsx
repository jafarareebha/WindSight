import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Info, ExternalLink } from 'lucide-react';
import type { ForecastInterval } from '../../types';

interface ForecastTableProps {
  intervals: ForecastInterval[];
  onSelectInterval?: (interval: ForecastInterval) => void;
}

type SortField = 'startTime' | 'forecastGeneration' | 'actualGeneration' | 'signedError' | 'absoluteError';
type SortOrder = 'asc' | 'desc';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatNumber = (value: unknown, signed = false): string => {
  if (!isFiniteNumber(value)) return '—';
  return `${signed && value > 0 ? '+' : ''}${value.toLocaleString()}`;
};

export const ForecastTable: React.FC<ForecastTableProps> = ({
  intervals,
  onSelectInterval,
}) => {
  const [sortField, setSortField] = useState<SortField>('startTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterType, setFilterType] = useState<'all' | 'over' | 'under'>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedIntervals = useMemo(() => {
    let result = [...intervals];

    if (filterType === 'over') {
      result = result.filter((i) => isFiniteNumber(i.signedError) && i.signedError > 0);
    } else if (filterType === 'under') {
      result = result.filter((i) => isFiniteNumber(i.signedError) && i.signedError < 0);
    }

    result.sort((a, b) => {
      let valA: string | number | null = null;
      let valB: string | number | null = null;

      if (sortField === 'startTime') {
        valA = a.startTime;
        valB = b.startTime;
      } else {
        valA = a[sortField];
        valB = b[sortField];
      }

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (!isFiniteNumber(valA)) return 1;
      if (!isFiniteNumber(valB)) return -1;

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [intervals, sortField, sortOrder, filterType]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-[#64748b] ml-1 inline" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#14b8a6] ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#14b8a6] ml-1 inline" />
    );
  };

  if (!intervals || intervals.length === 0) {
    return (
      <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-6 text-center text-[#94a3b8] font-mono text-xs">
        No settlement interval data available.
      </div>
    );
  }

  return (
    <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md overflow-hidden">
      {/* Table controls */}
      <div className="p-3 border-b border-[#2a3a4e] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#e2e8f0]">Interval Records</span>
          <span className="text-xs font-mono text-[#64748b]">
            ({filteredAndSortedIntervals.length} periods)
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-[#64748b]">Filter:</span>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              filterType === 'all'
                ? 'bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/40'
                : 'text-[#94a3b8] hover:bg-[#1e2a3a]'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilterType('over')}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              filterType === 'over'
                ? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40'
                : 'text-[#94a3b8] hover:bg-[#1e2a3a]'
            }`}
          >
            Overprediction (+MW)
          </button>
          <button
            type="button"
            onClick={() => setFilterType('under')}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              filterType === 'under'
                ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/40'
                : 'text-[#94a3b8] hover:bg-[#1e2a3a]'
            }`}
          >
            Underprediction (-MW)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#2a3a4e] bg-[#0f1729]/60 text-[#94a3b8] font-mono">
              <th
                onClick={() => handleSort('startTime')}
                className="py-2.5 px-3 font-medium cursor-pointer hover:text-[#e2e8f0] select-none"
              >
                Time (UTC) {renderSortIcon('startTime')}
              </th>
              <th
                onClick={() => handleSort('forecastGeneration')}
                className="py-2.5 px-3 font-medium text-right cursor-pointer hover:text-[#e2e8f0] select-none"
              >
                Forecast (MW) {renderSortIcon('forecastGeneration')}
              </th>
              <th
                onClick={() => handleSort('actualGeneration')}
                className="py-2.5 px-3 font-medium text-right cursor-pointer hover:text-[#e2e8f0] select-none"
              >
                Actual (MW) {renderSortIcon('actualGeneration')}
              </th>
              <th
                onClick={() => handleSort('signedError')}
                className="py-2.5 px-3 font-medium text-right cursor-pointer hover:text-[#e2e8f0] select-none"
              >
                Signed Error {renderSortIcon('signedError')}
              </th>
              <th
                onClick={() => handleSort('absoluteError')}
                className="py-2.5 px-3 font-medium text-right cursor-pointer hover:text-[#e2e8f0] select-none"
              >
                |Error| {renderSortIcon('absoluteError')}
              </th>
              <th className="py-2.5 px-3 font-medium text-right">Published At</th>
              <th className="py-2.5 px-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a3a4e]/40 font-mono">
            {filteredAndSortedIntervals.map((interval, idx) => {
              const dateObj = new Date(interval.startTime);
              const timeDisplay = dateObj.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'UTC',
              });
              const dateDisplay = dateObj.toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              });

              const publishDisplay = interval.publishTime
                ? new Date(interval.publishTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'UTC',
                  })
                : '—';

              const signedError = interval.signedError;
              const isOver = isFiniteNumber(signedError) && signedError > 0;
              const isUnder = isFiniteNumber(signedError) && signedError < 0;

              return (
                <tr
                  key={`${interval.startTime}-${idx}`}
                  className="hover:bg-[#1e2a3a]/60 transition-colors"
                >
                  <td className="py-2.5 px-3 text-[#e2e8f0] whitespace-nowrap">
                    <span className="font-semibold">{timeDisplay}</span>
                    <span className="text-[#64748b] ml-1.5 text-[11px]">{dateDisplay}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#3b82f6] tabular-nums font-semibold whitespace-nowrap">
                    {formatNumber(interval.forecastGeneration)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#22c55e] tabular-nums font-semibold whitespace-nowrap">
                    {formatNumber(interval.actualGeneration)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right tabular-nums font-semibold whitespace-nowrap ${
                      isOver
                        ? 'text-[#f59e0b]'
                        : isUnder
                        ? 'text-[#3b82f6]'
                        : 'text-[#94a3b8]'
                    }`}
                  >
                    {formatNumber(signedError, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#e2e8f0] tabular-nums whitespace-nowrap">
                    {formatNumber(interval.absoluteError)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#94a3b8] whitespace-nowrap text-[11px]">
                    {publishDisplay}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {onSelectInterval && (
                      <button
                        type="button"
                        onClick={() => onSelectInterval(interval)}
                        title="View forecast revision history"
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-[#0f1729] hover:bg-[#14b8a6]/10 text-[#14b8a6] border border-[#2a3a4e] hover:border-[#14b8a6]/40 transition-colors"
                      >
                        <span>Revisions</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
