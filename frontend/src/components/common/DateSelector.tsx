import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateSelectorProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  selectedDate,
  onDateChange,
  minDate = '2026-01-01',
  maxDate = '2026-01-31',
}) => {
  const handlePrevDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    const prevStr = current.toISOString().split('T')[0];
    if (prevStr >= minDate) {
      onDateChange(prevStr);
    }
  };

  const handleNextDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + 1);
    const nextStr = current.toISOString().split('T')[0];
    if (nextStr <= maxDate) {
      onDateChange(nextStr);
    }
  };

  const isMin = selectedDate <= minDate;
  const isMax = selectedDate >= maxDate;

  return (
    <div className="flex items-center gap-1.5 bg-[#1a2332] border border-[#2a3a4e] rounded-md p-1">
      <button
        type="button"
        onClick={handlePrevDay}
        disabled={isMin}
        aria-label="Previous Day"
        className="p-1 rounded text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a3a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-1.5 px-2">
        <Calendar className="w-3.5 h-3.5 text-[#14b8a6]" />
        <input
          type="date"
          value={selectedDate}
          min={minDate}
          max={maxDate}
          onChange={(e) => {
            const val = e.target.value;
            if (val >= minDate && val <= maxDate) {
              onDateChange(val);
            }
          }}
          className="bg-transparent text-xs font-mono font-medium text-[#e2e8f0] focus:outline-none cursor-pointer [color-scheme:dark]"
        />
      </div>

      <button
        type="button"
        onClick={handleNextDay}
        disabled={isMax}
        aria-label="Next Day"
        className="p-1 rounded text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a3a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-[#2a3a4e] mx-1 hidden sm:block" />

      {/* Quick shortcuts for January 2026 */}
      <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono">
        {['2026-01-05', '2026-01-15', '2026-01-25'].map((d) => (
          <button
            key={d}
            onClick={() => onDateChange(d)}
            type="button"
            className={`px-1.5 py-0.5 rounded transition-colors ${
              selectedDate === d
                ? 'bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/40'
                : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e2a3a]'
            }`}
          >
            {d.slice(5)}
          </button>
        ))}
      </div>
    </div>
  );
};
