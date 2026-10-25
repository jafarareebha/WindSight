import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import React, { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import {
  sanitizeCsvCell,
  determineIntervalResult,
  buildExpectedHalfHourRows,
  generateDailySummaryCsv,
  generateHalfHourlyCsv,
} from '../src/utils/exportUtils';
import { generateDailyPdfReport } from '../src/utils/pdfExport';
import { ExportMenu } from '../src/components/common/ExportMenu';
import type { AccuracyMetrics, ForecastInterval } from '../src/types';

describe('WindSight Export Utilities & Safety Tests', () => {
  it('sanitizes cells and protects against formula injection', () => {
    assert.strictEqual(sanitizeCsvCell(null), '');
    assert.strictEqual(sanitizeCsvCell(undefined), '');
    assert.strictEqual(sanitizeCsvCell(''), '');
    assert.strictEqual(sanitizeCsvCell('Normal Text'), 'Normal Text');

    // Formula injection tests
    assert.strictEqual(sanitizeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.strictEqual(sanitizeCsvCell('+12345'), "'+12345");
    assert.strictEqual(sanitizeCsvCell('-12.5'), "'-12.5");
    assert.strictEqual(sanitizeCsvCell('@cmd'), "'@cmd");
    assert.strictEqual(sanitizeCsvCell('\tTabStart'), "'\tTabStart");

    // CSV escaping tests
    assert.strictEqual(sanitizeCsvCell('Hello, World'), '"Hello, World"');
    assert.strictEqual(sanitizeCsvCell('Quote "Inside"'), '"Quote ""Inside"""');
    assert.strictEqual(sanitizeCsvCell('Line1\nLine2'), '"Line1\nLine2"');
  });

  it('correctly determines interval result labels under all conditions', () => {
    assert.strictEqual(determineIntervalResult(1200, 1000), 'Overforecast');
    assert.strictEqual(determineIntervalResult(800, 1000), 'Underforecast');
    assert.strictEqual(determineIntervalResult(1000, 1000), 'Exact match');
    assert.strictEqual(determineIntervalResult(null, 1000), 'Missing forecast');
    assert.strictEqual(determineIntervalResult(undefined, 1000), 'Missing forecast');
    assert.strictEqual(determineIntervalResult(1000, null), 'Missing actual');
    assert.strictEqual(determineIntervalResult(1000, undefined), 'Missing actual');
    assert.strictEqual(determineIntervalResult(null, null), 'Missing data');
    assert.strictEqual(determineIntervalResult(Number.NaN, Number.NaN), 'Missing data');
  });

  it('builds exactly 48 chronological expected intervals without duplicates', () => {
    const selectedDate = '2026-01-15';
    const sampleIntervals: ForecastInterval[] = [
      {
        startTime: '2026-01-15T00:00:00Z',
        forecastGeneration: 5200.5,
        actualGeneration: 5000.0,
        publishTime: '2026-01-14T09:00:00Z',
        signedError: 200.5,
        absoluteError: 200.5,
        forecastEligible: true,
      },
      {
        startTime: '2026-01-15T00:30:00Z',
        forecastGeneration: 4800.0,
        actualGeneration: 5100.0,
        publishTime: '2026-01-14T09:00:00Z',
        signedError: -300.0,
        absoluteError: 300.0,
        forecastEligible: true,
      },
    ];

    const rows = buildExpectedHalfHourRows(selectedDate, sampleIntervals);

    assert.strictEqual(rows.length, 48, 'A full day must have exactly 48 expected delivery intervals');

    // Chronology check
    assert.strictEqual(rows[0].timeUtc, '2026-01-15T00:00:00Z');
    assert.strictEqual(rows[1].timeUtc, '2026-01-15T00:30:00Z');
    assert.strictEqual(rows[47].timeUtc, '2026-01-15T23:30:00Z');

    // Value matching check
    assert.strictEqual(rows[0].forecast, 5200.5);
    assert.strictEqual(rows[0].actual, 5000.0);
    assert.strictEqual(rows[0].forecastError, 200.5);
    assert.strictEqual(rows[0].result, 'Overforecast');

    assert.strictEqual(rows[1].forecast, 4800.0);
    assert.strictEqual(rows[1].actual, 5100.0);
    assert.strictEqual(rows[1].forecastError, -300.0);
    assert.strictEqual(rows[1].result, 'Underforecast');

    // Missing interval check
    assert.strictEqual(rows[2].timeUtc, '2026-01-15T01:00:00Z');
    assert.strictEqual(rows[2].forecast, null);
    assert.strictEqual(rows[2].actual, null);
    assert.strictEqual(rows[2].forecastError, null);
    assert.strictEqual(rows[2].result, 'Missing data');

    // Ensure all timestamps are unique
    const uniqueTimestamps = new Set(rows.map((r) => r.timeUtc));
    assert.strictEqual(uniqueTimestamps.size, 48, 'All timestamps must be distinct');
  });

  it('generates compliant Daily Summary CSV with exact headers and UTF-8 BOM', () => {
    const selectedDate = '2026-01-15';
    const summary: AccuracyMetrics = {
      mae: 245.8,
      rmse: 312.4,
      bias: 52.3,
      mape: 4.8,
      count: 48,
      coverage: 100.0,
      overpredictionPct: 60.0,
      underpredictionPct: 40.0,
    };

    // 48 valid intervals
    const intervals: ForecastInterval[] = [];
    for (let i = 0; i < 48; i++) {
      const h = Math.floor(i / 2);
      const m = (i % 2) * 30;
      intervals.push({
        startTime: `2026-01-15T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`,
        forecastGeneration: 5000,
        actualGeneration: 4950,
        publishTime: '2026-01-14T09:00:00Z',
        signedError: 50,
        absoluteError: 50,
        forecastEligible: true,
      });
    }

    const csv = generateDailySummaryCsv(selectedDate, summary, intervals);

    assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');

    const lines = csv.replace('\uFEFF', '').trim().split('\r\n');
    assert.strictEqual(lines.length, 2, 'Daily Summary CSV must have 1 header line and 1 data line');

    const expectedHeaders = [
      'Report Date',
      'Mean Absolute Error (MAE) (MW)',
      'Root Mean Squared Error (RMSE) (MW)',
      'Mean Forecast Bias (MW)',
      'Valid Matched Intervals',
      'Expected Intervals',
      'Data Coverage (%)',
    ];
    assert.strictEqual(lines[0], expectedHeaders.join(','));

    // Check data line values
    const dataParts = lines[1].split(',');
    assert.strictEqual(dataParts[0], '2026-01-15');
    assert.strictEqual(dataParts[1], '245.80');
    assert.strictEqual(dataParts[2], '312.40');
    assert.strictEqual(dataParts[3], '52.30');
    assert.strictEqual(dataParts[4], '48');
    assert.strictEqual(dataParts[5], '48');
    assert.strictEqual(dataParts[6], '100.0');
  });

  it('handles unavailable metrics in Daily Summary CSV by leaving cells empty', () => {
    const selectedDate = '2026-01-20';
    const summary: AccuracyMetrics = {
      mae: null,
      rmse: null,
      bias: null,
      mape: null,
      count: 0,
      coverage: 0,
      overpredictionPct: null,
      underpredictionPct: null,
    };

    const csv = generateDailySummaryCsv(selectedDate, summary, []);
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n');
    assert.strictEqual(lines.length, 2);

    const dataParts = lines[1].split(',');
    assert.strictEqual(dataParts[0], '2026-01-20');
    assert.strictEqual(dataParts[1], '', 'MAE should be empty');
    assert.strictEqual(dataParts[2], '', 'RMSE should be empty');
    assert.strictEqual(dataParts[3], '', 'Bias should be empty');
    assert.strictEqual(dataParts[4], '0', 'Valid count is 0');
    assert.strictEqual(dataParts[5], '48', 'Expected count is 48');
    assert.strictEqual(dataParts[6], '', 'Coverage percentage should be empty when 0 valid');
  });

  it('generates compliant Half-Hourly Data CSV with 5 columns and 48 rows', () => {
    const selectedDate = '2026-01-15';
    const intervals: ForecastInterval[] = [
      {
        startTime: '2026-01-15T00:00:00Z',
        forecastGeneration: 4000.0,
        actualGeneration: 4000.0,
        publishTime: '2026-01-14T09:00:00Z',
        signedError: 0.0,
        absoluteError: 0.0,
        forecastEligible: true,
      },
      {
        startTime: '2026-01-15T00:30:00Z',
        forecastGeneration: null,
        actualGeneration: 3800.0,
        publishTime: null,
        signedError: null,
        absoluteError: null,
        forecastEligible: false,
      },
      {
        startTime: '2026-01-15T01:00:00Z',
        forecastGeneration: 4200.0,
        actualGeneration: null,
        publishTime: '2026-01-14T09:00:00Z',
        signedError: null,
        absoluteError: null,
        forecastEligible: true,
      },
    ];

    const csv = generateHalfHourlyCsv(selectedDate, intervals);
    assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');

    const lines = csv.replace('\uFEFF', '').trim().split('\r\n');
    assert.strictEqual(lines.length, 49, '1 header line + 48 interval rows = 49 lines');

    const expectedHeaders = ['Time (UTC)', 'Forecast (MW)', 'Actual (MW)', 'Forecast Error (MW)', 'Result'];
    assert.strictEqual(lines[0], expectedHeaders.join(','));

    // Check first row (Exact match)
    assert.strictEqual(lines[1], '2026-01-15T00:00:00Z,4000.00,4000.00,0.00,Exact match');

    // Check second row (Missing forecast)
    assert.strictEqual(lines[2], '2026-01-15T00:30:00Z,,3800.00,,Missing forecast');

    // Check third row (Missing actual)
    assert.strictEqual(lines[3], '2026-01-15T01:00:00Z,4200.00,,,Missing actual');

    // Check fourth row (Missing data)
    assert.strictEqual(lines[4], '2026-01-15T01:30:00Z,,,,Missing data');
  });

  it('generates a PDF report document without throwing errors', () => {
    const summary: AccuracyMetrics = {
      mae: 180.5,
      rmse: 220.1,
      bias: 65.4,
      mape: 3.2,
      count: 48,
      coverage: 100,
      overpredictionPct: 65,
      underpredictionPct: 35,
    };

    const intervals: ForecastInterval[] = [
      {
        startTime: '2026-01-15T00:00:00Z',
        forecastGeneration: 6000,
        actualGeneration: 5800,
        publishTime: '2026-01-14T09:00:00Z',
        signedError: 200,
        absoluteError: 200,
        forecastEligible: true,
      },
    ];

    const doc = generateDailyPdfReport({
      selectedDate: '2026-01-15',
      summary,
      intervals,
      cutoff: { hour: 9, minute: 30, timezone: 'UTC' },
    });

    assert.ok(doc, 'PDF document instance must be returned');
    assert.strictEqual(typeof doc.save, 'function');
  });

  it('renders ExportMenu component cleanly', () => {
    const summary: AccuracyMetrics = {
      mae: 100,
      rmse: 120,
      bias: 10,
      mape: 2,
      count: 48,
      coverage: 100,
      overpredictionPct: 50,
      underpredictionPct: 50,
    };

    const tree = h(ExportMenu, {
      selectedDate: '2026-01-15',
      summary,
      intervals: [],
    });

    const html = renderToString(tree);
    assert.ok(html.includes('Export'), 'Must include Export button label');
    assert.ok(html.includes('windsight-export-btn'), 'Must have ID windsight-export-btn');
  });
});
