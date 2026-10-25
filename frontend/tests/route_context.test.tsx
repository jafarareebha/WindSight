import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import React, { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route, useOutletContext } from 'react-router-dom';
import { AppShell } from '../src/components/layout/AppShell';
import { DateSelector } from '../src/components/common/DateSelector';
import type { AppOutletContext } from '../src/types';
import { calculateIntervalCoverage, formatCutoff } from '../src/utils/forecastPresentation';

describe('WindSight Route Context & Data Flow Tests', () => {
  it('formats a valid cutoff without exposing undefined values', () => {
    assert.strictEqual(
      formatCutoff(
        { hour: 9, minute: 30, timezone: 'UTC', date: '2026-01-14' },
        { hour: 9, minute: 30, timezone: 'UTC' }
      ),
      'D-1 • 2026-01-14 09:30 UTC'
    );
    assert.strictEqual(
      formatCutoff({ hour: Number.NaN, minute: null }, { hour: 9, minute: 30, timezone: 'UTC' }),
      'D-1 • 09:30 UTC'
    );
  });

  it('counts only distinct finite forecast-actual pairs and calculates settlement coverage', () => {
    const intervals = [
      { startTime: '2026-01-01T00:00:00Z', forecastGeneration: 100, actualGeneration: 90 },
      { startTime: '2026-01-01T00:00:00Z', forecastGeneration: 100, actualGeneration: 90 },
      { startTime: '2026-01-01T00:30:00Z', forecastGeneration: null, actualGeneration: 90 },
      { startTime: '2026-01-01T01:00:00Z', forecastGeneration: Number.NaN, actualGeneration: 90 },
      { startTime: '2026-01-01T01:30:00Z', forecastGeneration: 100, actualGeneration: 90 },
    ] as never[];

    const dayCoverage = calculateIntervalCoverage(intervals, '2026-01-01', '2026-01-01');
    assert.deepStrictEqual(dayCoverage, { validCount: 2, expectedCount: 48, percentage: 2 / 48 * 100 });

    const monthCoverage = calculateIntervalCoverage(intervals, '2026-01-01', '2026-01-31');
    assert.strictEqual(monthCoverage.expectedCount, 1488);
    assert.strictEqual(monthCoverage.validCount, 2);
    assert.strictEqual(monthCoverage.percentage, 2 / 1488 * 100);
  });

  it('AppShell passes selectedDate, cutoffHour, cutoffMinute, onDateChange, and onCutoffChange to child route', () => {
    let capturedContext: AppOutletContext | null = null;

    const ChildComponent = () => {
      const context = useOutletContext<AppOutletContext>();
      capturedContext = context;
      return h(
        'div',
        { id: 'child' },
        `Date: ${context.selectedDate}, Cutoff: ${context.cutoffHour}:${context.cutoffMinute}`
      );
    };

    let updatedDate: string | null = null;
    let updatedCutoff: { hour: number; minute: number } | null = null;

    const handleDateChange = (d: string) => {
      updatedDate = d;
    };
    const handleCutoffChange = (hour: number, minute: number) => {
      updatedCutoff = { hour, minute };
    };

    const tree = h(
      MemoryRouter,
      { initialEntries: ['/'] },
      h(
        Routes,
        null,
        h(
          Route,
          {
            element: h(AppShell, {
              selectedDate: '2026-01-15',
              onDateChange: handleDateChange,
              cutoffHour: 9,
              cutoffMinute: 30,
              onCutoffChange: handleCutoffChange,
            }),
          },
          h(Route, { index: true, element: h(ChildComponent) })
        )
      )
    );

    const html = renderToString(tree);

    // Verify child rendered successfully without throwing undefined destructure error
    assert.ok(
      html.includes('Date: 2026-01-15, Cutoff: 9:30'),
      'Rendered HTML should include child content with context values'
    );

    // Verify capturedContext properties
    assert.ok(capturedContext !== null, 'useOutletContext() must not be undefined');
    const ctx = capturedContext as AppOutletContext;
    assert.strictEqual(ctx.selectedDate, '2026-01-15');
    assert.strictEqual(ctx.cutoffHour, 9);
    assert.strictEqual(ctx.cutoffMinute, 30);
    assert.strictEqual(typeof ctx.onDateChange, 'function');
    assert.strictEqual(typeof ctx.onCutoffChange, 'function');

    // Verify callbacks work
    ctx.onDateChange('2026-01-20');
    assert.strictEqual(updatedDate, '2026-01-20');

    ctx.onCutoffChange(11, 0);
    assert.deepStrictEqual(updatedCutoff, { hour: 11, minute: 0 });
  });

  it('DateSelector renders and properly limits date ranges for Jan 2026', () => {
    let dateSelected: string | null = null;
    const selectorTree = h(DateSelector, {
      selectedDate: '2026-01-15',
      onDateChange: (d: string) => {
        dateSelected = d;
      },
      minDate: '2026-01-01',
      maxDate: '2026-01-31',
    });

    const selectorHtml = renderToString(selectorTree);
    assert.ok(selectorHtml.includes('2026-01-15'), 'DateSelector should contain the selected date');
    assert.ok(selectorHtml.includes('01-05'), 'DateSelector should contain quick shortcut 01-05');
    assert.ok(selectorHtml.includes('01-15'), 'DateSelector should contain quick shortcut 01-15');
    assert.ok(selectorHtml.includes('01-25'), 'DateSelector should contain quick shortcut 01-25');
  });

  it('Overview component renders inside AppShell without throwing undefined destructure error', async () => {
    const { Overview } = await import('../src/pages/Overview');

    const tree = h(
      MemoryRouter,
      { initialEntries: ['/'] },
      h(
        Routes,
        null,
        h(
          Route,
          {
            element: h(AppShell, {
              selectedDate: '2026-01-15',
              onDateChange: () => {},
              cutoffHour: 9,
              cutoffMinute: 30,
              onCutoffChange: () => {},
            }),
          },
          h(Route, { index: true, element: h(Overview) })
        )
      )
    );

    // This executes renderToString which invokes Overview() and useOutletContext()
    const html = renderToString(tree);
    assert.ok(
      html.includes('Fetching BMRS WINDFOR and FUELHH data for 2026-01-15'),
      'Overview should render initial loading state using context selectedDate'
    );
  });

  it('ForecastExplorer renders safely inside AppShell without throwing errors', async () => {
    const { ForecastExplorer } = await import('../src/pages/ForecastExplorer');

    const tree = h(
      MemoryRouter,
      { initialEntries: ['/'] },
      h(
        Routes,
        null,
        h(
          Route,
          {
            element: h(AppShell, {
              selectedDate: '2026-01-15',
              onDateChange: () => {},
              cutoffHour: 9,
              cutoffMinute: 30,
              onCutoffChange: () => {},
            }),
          },
          h(Route, { index: true, element: h(ForecastExplorer) })
        )
      )
    );

    const html = renderToString(tree);
    assert.ok(
      html.includes('Loading interval settlement telemetry for 2026-01-15'),
      'ForecastExplorer should render initial loading state using context selectedDate'
    );
  });
});
