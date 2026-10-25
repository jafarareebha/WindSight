import type { CutoffConfig, ForecastInterval } from '../types';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

type ValidCutoff = Pick<CutoffConfig, 'hour' | 'minute' | 'timezone'>;

const validCutoff = (value: Partial<CutoffConfig> | null | undefined): value is ValidCutoff => {
  if (!value || typeof value.hour !== 'number' || typeof value.minute !== 'number') return false;
  return (
    Number.isInteger(value.hour) &&
    value.hour >= 0 &&
    value.hour <= 23 &&
    Number.isInteger(value.minute) &&
    value.minute >= 0 &&
    value.minute <= 59
  );
};

export function formatCutoff(
  cutoff: Partial<CutoffConfig> | null | undefined,
  fallback: Pick<CutoffConfig, 'hour' | 'minute' | 'timezone'>
): string {
  const value: ValidCutoff | null = validCutoff(cutoff)
    ? cutoff
    : validCutoff(fallback)
    ? fallback
    : null;
  if (!value) return 'Cutoff unavailable';

  const time = `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')} ${
    typeof value.timezone === 'string' && value.timezone ? value.timezone : 'UTC'
  }`;

  return isIsoDate(cutoff?.date) ? `D-1 • ${cutoff.date} ${time}` : `D-1 • ${time}`;
}

export interface IntervalCoverage {
  validCount: number;
  expectedCount: number;
  percentage: number | null;
}

export function calculateIntervalCoverage(
  intervals: ForecastInterval[],
  startDate: string,
  endDate: string
): IntervalCoverage {
  const start = isIsoDate(startDate) ? new Date(`${startDate}T00:00:00Z`) : null;
  const end = isIsoDate(endDate) ? new Date(`${endDate}T00:00:00Z`) : null;
  const expectedCount = start && end && start <= end
    ? ((end.getTime() - start.getTime()) / 86_400_000 + 1) * 48
    : 0;

  const validIntervals = new Set<string>();
  for (const interval of intervals) {
    const timestamp = new Date(interval.startTime);
    if (
      !Number.isNaN(timestamp.getTime()) &&
      isFiniteNumber(interval.forecastGeneration) &&
      isFiniteNumber(interval.actualGeneration)
    ) {
      validIntervals.add(timestamp.toISOString());
    }
  }

  const validCount = validIntervals.size;
  return {
    validCount,
    expectedCount,
    percentage: expectedCount > 0 && validCount > 0 ? (validCount / expectedCount) * 100 : null,
  };
}
