import type { AccuracyMetrics, ForecastInterval, CutoffConfig } from '../types';
import { calculateIntervalCoverage, formatCutoff, IntervalCoverage } from './forecastPresentation';

/**
 * Escapes a CSV cell value, handling commas, quotes, newlines,
 * and formula injection protection (=, +, -, @, \t, \r).
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  if (str === '') {
    return '';
  }

  // Formula injection protection: prepend single quote if text starts with dangerous characters
  let safeStr = str;
  if (/^[=+\-@\t\r]/.test(safeStr)) {
    safeStr = `'${safeStr}`;
  }

  // If cell contains commas, quotes, or newlines, wrap in double quotes and escape internal quotes
  if (/[",\n\r]/.test(safeStr)) {
    return `"${safeStr.replace(/"/g, '""')}"`;
  }

  return safeStr;
}

/**
 * Generates the Daily Summary CSV content for a selected date.
 * Columns:
 * 1. Report Date
 * 2. Mean Absolute Error (MAE) (MW)
 * 3. Root Mean Squared Error (RMSE) (MW)
 * 4. Mean Forecast Bias (MW)
 * 5. Valid Matched Intervals
 * 6. Expected Intervals
 * 7. Data Coverage (%)
 */
export function generateDailySummaryCsv(
  selectedDate: string,
  summary: AccuracyMetrics,
  intervals: ForecastInterval[]
): string {
  const coverage = calculateIntervalCoverage(intervals, selectedDate, selectedDate);

  const headers = [
    'Report Date',
    'Mean Absolute Error (MAE) (MW)',
    'Root Mean Squared Error (RMSE) (MW)',
    'Mean Forecast Bias (MW)',
    'Valid Matched Intervals',
    'Expected Intervals',
    'Data Coverage (%)',
  ];

  const row = [
    sanitizeCsvCell(selectedDate),
    summary.mae !== null && Number.isFinite(summary.mae) ? summary.mae.toFixed(2) : '',
    summary.rmse !== null && Number.isFinite(summary.rmse) ? summary.rmse.toFixed(2) : '',
    summary.bias !== null && Number.isFinite(summary.bias) ? summary.bias.toFixed(2) : '',
    String(coverage.validCount),
    String(coverage.expectedCount),
    coverage.percentage !== null && Number.isFinite(coverage.percentage)
      ? coverage.percentage.toFixed(1)
      : '',
  ];

  return '\uFEFF' + [headers.join(','), row.join(',')].join('\r\n') + '\r\n';
}

export type IntervalResultLabel =
  | 'Overforecast'
  | 'Underforecast'
  | 'Exact match'
  | 'Missing forecast'
  | 'Missing actual'
  | 'Missing data';

export function determineIntervalResult(
  forecast: number | null | undefined,
  actual: number | null | undefined
): IntervalResultLabel {
  const hasForecast = forecast !== null && forecast !== undefined && Number.isFinite(forecast);
  const hasActual = actual !== null && actual !== undefined && Number.isFinite(actual);

  if (hasForecast && hasActual) {
    if (forecast > actual) return 'Overforecast';
    if (forecast < actual) return 'Underforecast';
    return 'Exact match';
  }
  if (!hasForecast && hasActual) return 'Missing forecast';
  if (hasForecast && !hasActual) return 'Missing actual';
  return 'Missing data';
}

export interface ExpectedHalfHourRow {
  timeUtc: string;
  forecast: number | null;
  actual: number | null;
  forecastError: number | null;
  result: IntervalResultLabel;
}

/**
 * Normalizes an ISO date-time string to standard UTC `YYYY-MM-DDTHH:mm:ssZ`.
 */
export function normalizeIsoUtc(dtStr: string): string | null {
  const d = new Date(dtStr);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hour = String(d.getUTCHours()).padStart(2, '0');
  const minute = String(d.getUTCMinutes()).padStart(2, '0');
  const second = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

/**
 * Builds all 48 expected half-hourly rows for a delivery date in chronological order,
 * matching with existing intervals and honest missing representation.
 */
export function buildExpectedHalfHourRows(
  selectedDate: string,
  intervals: ForecastInterval[]
): ExpectedHalfHourRow[] {
  // Map existing intervals by normalized UTC timestamp
  const intervalMap = new Map<string, ForecastInterval>();
  for (const interval of intervals) {
    const key = normalizeIsoUtc(interval.startTime);
    if (key) {
      intervalMap.set(key, interval);
    }
  }

  const rows: ExpectedHalfHourRow[] = [];

  // Generate exactly 48 expected intervals: 00:00 to 23:30 UTC
  for (let slot = 0; slot < 48; slot++) {
    const hour = Math.floor(slot / 2);
    const minute = (slot % 2) * 30;
    const timeUtc = `${selectedDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
    const interval = intervalMap.get(timeUtc);

    const forecast = interval && interval.forecastGeneration !== null && Number.isFinite(interval.forecastGeneration)
      ? interval.forecastGeneration
      : null;
    const actual = interval && interval.actualGeneration !== null && Number.isFinite(interval.actualGeneration)
      ? interval.actualGeneration
      : null;

    let forecastError: number | null = null;
    if (forecast !== null && actual !== null) {
      forecastError = Math.round((forecast - actual) * 100) / 100;
    }

    const result = determineIntervalResult(forecast, actual);

    rows.push({
      timeUtc,
      forecast,
      actual,
      forecastError,
      result,
    });
  }

  return rows;
}

/**
 * Generates the Half-Hourly Data CSV content.
 * Columns in exact order:
 * 1. Time (UTC)
 * 2. Forecast (MW)
 * 3. Actual (MW)
 * 4. Forecast Error (MW)
 * 5. Result
 */
export function generateHalfHourlyCsv(
  selectedDate: string,
  intervals: ForecastInterval[]
): string {
  const headers = [
    'Time (UTC)',
    'Forecast (MW)',
    'Actual (MW)',
    'Forecast Error (MW)',
    'Result',
  ];

  const rows = buildExpectedHalfHourRows(selectedDate, intervals);

  const csvRows = rows.map((r) => {
    return [
      sanitizeCsvCell(r.timeUtc),
      r.forecast !== null ? r.forecast.toFixed(2) : '',
      r.actual !== null ? r.actual.toFixed(2) : '',
      r.forecastError !== null ? r.forecastError.toFixed(2) : '',
      sanitizeCsvCell(r.result),
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...csvRows].join('\r\n') + '\r\n';
}

/**
 * Triggers a client-side file download via Blob.
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
