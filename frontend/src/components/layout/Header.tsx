import React from 'react';
import { Wind, Menu, X, ShieldCheck } from 'lucide-react';
import { DateSelector } from '../common/DateSelector';
import { DecisionCutoffControl } from '../common/DecisionCutoffControl';
import { DataFreshnessIndicator } from '../common/DataFreshnessIndicator';

interface HeaderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  cutoffHour: number;
  cutoffMinute: number;
  onCutoffChange: (hour: number, minute: number) => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedDate,
  onDateChange,
  cutoffHour,
  cutoffMinute,
  onCutoffChange,
  mobileMenuOpen,
  onToggleMobileMenu,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#0f1729]/95 backdrop-blur-sm border-b border-[#2a3a4e] px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Mobile menu trigger & brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a3a] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#14b8a6]/15 border border-[#14b8a6]/30 flex items-center justify-center text-[#14b8a6]">
              <Wind className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-[#e2e8f0]">
                Wind<span className="text-[#14b8a6]">Sight</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-mono text-[#64748b] border border-[#2a3a4e] px-1 rounded">
                Jan 2026
              </span>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <DateSelector selectedDate={selectedDate} onDateChange={onDateChange} />
          <div className="hidden lg:block">
            <DecisionCutoffControl
              cutoffHour={cutoffHour}
              cutoffMinute={cutoffMinute}
              onCutoffChange={onCutoffChange}
            />
          </div>
          <div className="hidden xl:block">
            <DataFreshnessIndicator />
          </div>
        </div>
      </div>
    </header>
  );
};
