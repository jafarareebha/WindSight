import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { DecisionCutoffControl } from '../common/DecisionCutoffControl';
import type { AppOutletContext } from '../../types';

interface AppShellProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  cutoffHour: number;
  cutoffMinute: number;
  onCutoffChange: (hour: number, minute: number) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  selectedDate,
  onDateChange,
  cutoffHour,
  cutoffMinute,
  onCutoffChange,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#0f1729] text-[#e2e8f0]">
      {/* Top Header */}
      <Header
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        cutoffHour={cutoffHour}
        cutoffMinute={cutoffMinute}
        onCutoffChange={onCutoffChange}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Sub-bar for mobile cutoff control */}
      <div className="lg:hidden bg-[#0f1729] border-b border-[#2a3a4e] p-2 flex justify-center">
        <DecisionCutoffControl
          cutoffHour={cutoffHour}
          cutoffMinute={cutoffMinute}
          onCutoffChange={onCutoffChange}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Sidebar overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-50 w-64 max-w-[80%] h-full bg-[#1a2332]">
              <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0f1729]">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet
              context={
                {
                  selectedDate,
                  onDateChange,
                  cutoffHour,
                  cutoffMinute,
                  onCutoffChange,
                } satisfies AppOutletContext
              }
            />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-[#0f1729] border-t border-[#2a3a4e] px-4 py-3 text-xs text-[#64748b] font-mono flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          WindSight Telemetry &copy; 2026. GB Power System Wind Forecasting Evaluation Platform.
        </div>
        
      </footer>
    </div>
  );
};
