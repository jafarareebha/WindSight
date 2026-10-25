import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Table, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import type { AccuracyMetrics, ForecastInterval, CutoffConfig } from '../../types';
import { generateDailySummaryCsv, generateHalfHourlyCsv, triggerFileDownload } from '../../utils/exportUtils';
import { generateDailyPdfReport } from '../../utils/pdfExport';

export interface ExportMenuProps {
  selectedDate: string;
  summary: AccuracyMetrics;
  intervals: ForecastInterval[];
  cutoff?: CutoffConfig;
  fallbackCutoff?: { hour: number; minute: number; timezone: string };
  disabled?: boolean;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  selectedDate,
  summary,
  intervals,
  cutoff,
  fallbackCutoff,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [csvSubmenuOpen, setCsvSubmenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setCsvSubmenuOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key to close menu
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setCsvSubmenuOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleExportReport = async () => {
    if (isExporting || disabled) return;
    setIsExporting(true);
    setExportError(null);

    try {
      // Yield to let UI update loading state
      await new Promise((resolve) => setTimeout(resolve, 50));
      generateDailyPdfReport({
        selectedDate,
        summary,
        intervals,
        cutoff,
        fallbackCutoff,
      });
      setIsOpen(false);
      setCsvSubmenuOpen(false);
    } catch (err) {
      console.error('Failed to export PDF report:', err);
      setExportError('Failed to generate PDF report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDailySummaryCsv = () => {
    if (isExporting || disabled) return;
    setIsExporting(true);
    setExportError(null);

    try {
      const csv = generateDailySummaryCsv(selectedDate, summary, intervals);
      triggerFileDownload(csv, `windsight_daily_summary_${selectedDate}.csv`);
      setIsOpen(false);
      setCsvSubmenuOpen(false);
    } catch (err) {
      console.error('Failed to export Daily Summary CSV:', err);
      setExportError('Failed to generate Daily Summary CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportHalfHourlyCsv = () => {
    if (isExporting || disabled) return;
    setIsExporting(true);
    setExportError(null);

    try {
      const csv = generateHalfHourlyCsv(selectedDate, intervals);
      triggerFileDownload(csv, `windsight_half_hourly_${selectedDate}.csv`);
      setIsOpen(false);
      setCsvSubmenuOpen(false);
    } catch (err) {
      console.error('Failed to export Half-Hourly CSV:', err);
      setExportError('Failed to generate Half-Hourly CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Primary Export Button */}
      <button
        ref={buttonRef}
        type="button"
        id="windsight-export-btn"
        disabled={disabled || isExporting}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setCsvSubmenuOpen(false);
          setExportError(null);
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/40 ${
          isOpen
            ? 'bg-[#14b8a6]/20 border-[#14b8a6] text-[#e2e8f0]'
            : 'bg-[#1a2332] border-[#2a3a4e] text-[#e2e8f0] hover:bg-[#243044] hover:border-[#3b4d66]'
        } ${disabled || isExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isExporting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#14b8a6]" />
        ) : (
          <Download className="w-3.5 h-3.5 text-[#14b8a6]" />
        )}
        <span>Export</span>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="windsight-export-btn"
          className="absolute right-0 mt-1.5 w-60 rounded-md bg-[#0f172a] border border-[#2a3a4e] shadow-xl shadow-black/50 z-50 py-1 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {exportError && (
            <div className="mx-2 my-1.5 p-2 bg-rose-950/60 border border-rose-800/80 rounded text-[11px] text-rose-200 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>{exportError}</span>
            </div>
          )}

          {/* Option 1: Export as Report */}
          <button
            type="button"
            role="menuitem"
            disabled={isExporting}
            onClick={handleExportReport}
            className="w-full text-left px-3 py-2 text-xs text-[#e2e8f0] hover:bg-[#1e293b] flex items-center justify-between group transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#14b8a6] group-hover:scale-105 transition-transform" />
              <div>
                <div className="font-medium text-[#f1f5f9]">Export as Report</div>
                <div className="text-[10px] text-[#94a3b8]">PDF executive summary</div>
              </div>
            </div>
          </button>

          <div className="my-1 border-t border-[#1e293b]" />

          {/* Option 2: Export as CSV (reveals submenu or inline options) */}
          <div className="relative">
            <button
              type="button"
              role="menuitem"
              aria-expanded={csvSubmenuOpen}
              onClick={() => setCsvSubmenuOpen((prev) => !prev)}
              className="w-full text-left px-3 py-2 text-xs text-[#e2e8f0] hover:bg-[#1e293b] flex items-center justify-between group transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-[#38bdf8] group-hover:scale-105 transition-transform" />
                <div>
                  <div className="font-medium text-[#f1f5f9]">Export as CSV</div>
                  <div className="text-[10px] text-[#94a3b8]">Raw & aggregate data</div>
                </div>
              </div>
              <ChevronRight
                className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform duration-150 ${
                  csvSubmenuOpen ? 'rotate-90 text-[#38bdf8]' : ''
                }`}
              />
            </button>

            {/* Submenu options for CSV */}
            {csvSubmenuOpen && (
              <div className="bg-[#161f30] border-t border-b border-[#243044] py-1 pl-7 pr-2 space-y-1">
                <button
                  type="button"
                  role="menuitem"
                  disabled={isExporting}
                  onClick={handleExportDailySummaryCsv}
                  className="w-full text-left px-2.5 py-1.5 rounded text-[11px] text-[#cbd5e1] hover:text-[#f8fafc] hover:bg-[#202c42] transition-colors flex flex-col cursor-pointer"
                >
                  <span className="font-medium">Export Daily Summary</span>
                  <span className="text-[9.5px] text-[#64748b]">1 row • metrics & coverage</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={isExporting}
                  onClick={handleExportHalfHourlyCsv}
                  className="w-full text-left px-2.5 py-1.5 rounded text-[11px] text-[#cbd5e1] hover:text-[#f8fafc] hover:bg-[#202c42] transition-colors flex flex-col cursor-pointer"
                >
                  <span className="font-medium">Export Half-Hourly Data</span>
                  <span className="text-[9.5px] text-[#64748b]">48 intervals • forecast, actual, error</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
