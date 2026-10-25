import { jsPDF } from 'jspdf';
import type { AccuracyMetrics, ForecastInterval, CutoffConfig } from '../types';
import { calculateIntervalCoverage, formatCutoff } from './forecastPresentation';
import { buildExpectedHalfHourRows } from './exportUtils';

export interface PdfExportOptions {
  selectedDate: string;
  summary: AccuracyMetrics;
  intervals: ForecastInterval[];
  cutoff?: CutoffConfig;
  fallbackCutoff?: { hour: number; minute: number; timezone: string };
}

/**
 * Generates and downloads a clean, professional PDF report for the selected delivery date.
 */
export function generateDailyPdfReport(options: PdfExportOptions): jsPDF {
  const { selectedDate, summary, intervals, cutoff, fallbackCutoff } = options;

  const coverage = calculateIntervalCoverage(intervals, selectedDate, selectedDate);
  const cutoffStr = formatCutoff(cutoff, fallbackCutoff || { hour: 9, minute: 30, timezone: 'UTC' });
  const rows = buildExpectedHalfHourRows(selectedDate, intervals);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  let y = 14;

  // 1. HEADER BAR
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 24, 'F');

  // Brand & Report Title
  doc.setTextColor(248, 250, 252); // slate-50
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('WindSight', margin + 6, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('GB Wind Generation Day-Ahead Evaluation Report', margin + 6, y + 14);

  // Date and UTC timestamp in Header
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  const genTimeUtc = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  doc.text(`Delivery Date: ${selectedDate}`, pageWidth - margin - 6, y + 8, { align: 'right' });
  doc.setTextColor(148, 163, 184);
  doc.text(`Cutoff: ${cutoffStr}`, pageWidth - margin - 6, y + 13, { align: 'right' });
  doc.text(`Generated: ${genTimeUtc}`, pageWidth - margin - 6, y + 18, { align: 'right' });

  y += 28;

  // Overview context note
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    'Evaluates day-ahead wind generation forecasts against recorded outturn actual generation from Elexon BMRS datasets (FUELHH & WINDFOR). Units: Megawatts (MW).',
    margin,
    y
  );

  y += 5;

  // 2. KEY PERFORMANCE METRICS SECTION
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Daily Performance Summary', margin, y);

  y += 3.5;

  // Draw 4 metric cards
  const cardGap = 3.5;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  const cardHeight = 19;

  const metricsData = [
    {
      label: 'Mean Absolute Error',
      value: summary.mae !== null ? `${summary.mae.toFixed(1)} MW` : '—',
      sub: summary.mape !== null ? `${summary.mape.toFixed(1)}% MAPE` : 'Average deviation',
    },
    {
      label: 'Root Mean Sq. Error',
      value: summary.rmse !== null ? `${summary.rmse.toFixed(1)} MW` : '—',
      sub: 'Penalizes tail risks',
    },
    {
      label: 'Mean Forecast Bias',
      value:
        summary.bias !== null
          ? `${summary.bias > 0 ? '+' : ''}${summary.bias.toFixed(1)} MW`
          : '—',
      sub:
        summary.bias !== null
          ? summary.bias > 0
            ? 'Overforecasting'
            : summary.bias < 0
            ? 'Underforecasting'
            : 'Exact balance'
          : 'Signed error',
    },
    {
      label: 'Interval Coverage',
      value:
        coverage.percentage !== null
          ? `${coverage.percentage.toFixed(1).replace(/\.0$/, '')}%`
          : '—',
      sub: `${coverage.validCount} / ${coverage.expectedCount} intervals`,
    },
  ];

  metricsData.forEach((m, idx) => {
    const cardX = margin + idx * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, cardX + 3, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(m.value, cardX + 3, y + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(m.sub, cardX + 3, y + 16);
  });

  y += cardHeight + 6;

  // 3. FORECAST VS ACTUAL CHART
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Forecast vs Recorded Actual Generation', margin, y);

  // Legend
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  // Forecast legend (Teal)
  doc.setFillColor(13, 148, 136); // teal-600
  doc.rect(pageWidth - margin - 62, y - 2.8, 5, 2.5, 'F');
  doc.setTextColor(71, 85, 105);
  doc.text('Forecast (MW)', pageWidth - margin - 55, y);

  // Actual legend (Amber)
  doc.setFillColor(217, 119, 6); // amber-600
  doc.rect(pageWidth - margin - 27, y - 2.8, 5, 2.5, 'F');
  doc.text('Actual (MW)', pageWidth - margin - 20, y);

  y += 4;

  const chartX = margin + 12;
  const chartWidth = contentWidth - 14;
  const chartHeight = 44;
  const chartY = y;

  // Calculate Y-scale max
  let maxGen = 1000;
  for (const r of rows) {
    if (r.forecast !== null && r.forecast > maxGen) maxGen = r.forecast;
    if (r.actual !== null && r.actual > maxGen) maxGen = r.actual;
  }
  // Round up to nearest 2,000 or 5,000 MW
  const yMax = Math.ceil((maxGen * 1.1) / 2000) * 2000;

  // Background box & grid lines
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.rect(chartX, chartY, chartWidth, chartHeight, 'D');

  // Y-axis gridlines & labels (4 divisions)
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  for (let div = 0; div <= 4; div++) {
    const val = (yMax / 4) * div;
    const lineY = chartY + chartHeight - (div / 4) * chartHeight;
    doc.setDrawColor(241, 245, 249);
    doc.line(chartX, lineY, chartX + chartWidth, lineY);
    doc.text(`${Math.round(val).toLocaleString()}`, chartX - 2, lineY + 1, { align: 'right' });
  }

  // Plot actuals and forecasts
  const getX = (idx: number) => chartX + (idx / 47) * chartWidth;
  const getY = (val: number) => chartY + chartHeight - (val / yMax) * chartHeight;

  // Draw Actual curve (Amber solid)
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.6);
  let prevAct: { x: number; y: number } | null = null;
  rows.forEach((r, idx) => {
    if (r.actual !== null) {
      const pt = { x: getX(idx), y: getY(r.actual) };
      if (prevAct !== null) {
        doc.line(prevAct.x, prevAct.y, pt.x, pt.y);
      }
      prevAct = pt;
    } else {
      prevAct = null; // gap for missing data
    }
  });

  // Draw Forecast curve (Teal solid)
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.6);
  let prevFc: { x: number; y: number } | null = null;
  rows.forEach((r, idx) => {
    if (r.forecast !== null) {
      const pt = { x: getX(idx), y: getY(r.forecast) };
      if (prevFc !== null) {
        doc.line(prevFc.x, prevFc.y, pt.x, pt.y);
      }
      prevFc = pt;
    } else {
      prevFc = null; // gap for missing data
    }
  });

  // X-axis time tick marks every 4 hours: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00, 23:30
  const timeTicks = [0, 8, 16, 24, 32, 40, 47];
  timeTicks.forEach((slot) => {
    const xPos = getX(slot);
    const hour = Math.floor(slot / 2);
    const min = (slot % 2) * 30;
    const timeLabel = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(timeLabel, xPos, chartY + chartHeight + 3.5, { align: 'center' });
  });

  y += chartHeight + 9;

  // 4. FORECAST ERROR SUMMARY (Forecast - Actual)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Half-Hourly Forecast Error (Forecast − Actual)', margin, y);

  // Legend
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setFillColor(59, 130, 246); // blue/neutral
  doc.rect(pageWidth - margin - 50, y - 2.8, 5, 2.5, 'F');
  doc.setTextColor(71, 85, 105);
  doc.text('Signed Error (MW)', pageWidth - margin - 43, y);

  y += 4;

  const errChartY = y;
  const errChartHeight = 28;

  // Calculate max absolute error
  let maxAbsErr = 500;
  for (const r of rows) {
    if (r.forecastError !== null && Math.abs(r.forecastError) > maxAbsErr) {
      maxAbsErr = Math.abs(r.forecastError);
    }
  }
  const errMax = Math.ceil((maxAbsErr * 1.15) / 500) * 500;

  // Error chart box & zero reference line
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.rect(chartX, errChartY, chartWidth, errChartHeight, 'D');

  const zeroY = errChartY + errChartHeight / 2;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(chartX, zeroY, chartX + chartWidth, zeroY); // zero reference line

  // Y-axis labels (+errMax, 0, -errMax)
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`+${errMax}`, chartX - 2, errChartY + 2.5, { align: 'right' });
  doc.text('0', chartX - 2, zeroY + 1, { align: 'right' });
  doc.text(`-${errMax}`, chartX - 2, errChartY + errChartHeight - 0.5, { align: 'right' });

  // Draw Error Bars
  const barWidth = (chartWidth / 48) * 0.7;
  rows.forEach((r, idx) => {
    if (r.forecastError !== null) {
      const xPos = chartX + (idx / 48) * chartWidth + 0.3;
      const barH = (Math.abs(r.forecastError) / errMax) * (errChartHeight / 2);

      if (r.forecastError >= 0) {
        doc.setFillColor(239, 68, 68); // Red/rose for overforecast
        doc.rect(xPos, zeroY - barH, barWidth, barH, 'F');
      } else {
        doc.setFillColor(59, 130, 246); // Blue for underforecast
        doc.rect(xPos, zeroY, barWidth, barH, 'F');
      }
    }
  });

  timeTicks.forEach((slot) => {
    const xPos = getX(slot);
    const hour = Math.floor(slot / 2);
    const min = (slot % 2) * 30;
    const timeLabel = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(timeLabel, xPos, errChartY + errChartHeight + 3.5, { align: 'center' });
  });

  y += errChartHeight + 9;

  // 5. DETERMINISTIC BRIEF INTERPRETATION
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Operational Interpretation & Context', margin, y);

  y += 4;

  let biasText = '';
  if (summary.bias !== null) {
    if (summary.bias > 50) {
      biasText = `The day-ahead wind forecasts exhibited systemic overforecasting (+${summary.bias.toFixed(
        1
      )} MW mean bias). In electricity market operations, sustained overforecasting leads to day-ahead scheduling deficits where physical deliveries fall short of scheduled volumes, necessitating balancing reserves.`;
    } else if (summary.bias < -50) {
      biasText = `The day-ahead wind forecasts exhibited systemic underforecasting (${summary.bias.toFixed(
        1
      )} MW mean bias). In electricity market operations, underforecasting indicates physical generation exceeded day-ahead expectations, frequently requiring downward redispatch or curtailment.`;
    } else {
      biasText = `Day-ahead wind forecasts remained well-balanced against actual outturn, with a near-zero mean forecast bias (${
        summary.bias >= 0 ? '+' : ''
      }${summary.bias.toFixed(1)} MW).`;
    }
  } else {
    biasText =
      'Insufficient matched interval data was available to establish a conclusive directional forecast bias for this delivery date.';
  }

  let coverageText = '';
  if (coverage.percentage === 100) {
    coverageText = `Data completeness was 100.0% with all ${coverage.expectedCount} expected half-hour delivery intervals containing matched forecast and actual records.`;
  } else if (coverage.percentage !== null) {
    coverageText = `Data completeness was ${coverage.percentage.toFixed(
      1
    )}% (${coverage.validCount} of ${coverage.expectedCount} intervals). Missing intervals prevent a complete daily balance and are reflected as gaps in the timeline.`;
  } else {
    coverageText = 'No valid matched intervals were recorded for this delivery date.';
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const splitBias = doc.splitTextToSize(biasText, contentWidth - 8);
  doc.text(splitBias, margin + 4, y + 5);

  const splitCoverage = doc.splitTextToSize(coverageText, contentWidth - 8);
  doc.text(splitCoverage, margin + 4, y + 17);

  y += 28;

  // 6. DATA QUALITY NOTE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Data Source & Audit Information:', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Elexon BMRS WINDFOR (forecast) & FUELHH (outturn generation for WIND fuel type). Evaluated at native 30-minute settlement period resolution. Revisions published after ${cutoffStr} were excluded from the day-ahead benchmark.`,
    margin,
    y + 4.5
  );

  // 7. FOOTER
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('WindSight Intelligence • Elexon BMRS Verified', margin, pageHeight - 6);
  doc.text('Page 1 of 1', pageWidth - margin, pageHeight - 6, { align: 'right' });

  // Download trigger
  const filename = `windsight_daily_report_${selectedDate}.pdf`;
  if (typeof window !== 'undefined' && typeof doc.save === 'function') {
    doc.save(filename);
  }

  return doc;
}
