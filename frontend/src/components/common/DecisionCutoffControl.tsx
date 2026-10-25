import React from 'react';
import { Clock } from 'lucide-react';

interface DecisionCutoffControlProps {
  cutoffHour: number;
  cutoffMinute: number;
  onCutoffChange: (hour: number, minute: number) => void;
  timezone?: string;
}

export const DecisionCutoffControl: React.FC<DecisionCutoffControlProps> = ({
  cutoffHour,
  cutoffMinute,
  onCutoffChange,
  timezone = 'UTC',
}) => {
  const presets = [
    { label: '09:30 D-1', hour: 9, minute: 30, title: 'UK Day-Ahead Bidding Gate' },
    { label: '11:00 D-1', hour: 11, minute: 0, title: 'Nord Pool / EPEX SPOT Auction Close' },
    { label: '16:00 D-1', hour: 16, minute: 0, title: 'Late Afternoon Dispatch Update' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 bg-[#1a2332] border border-[#2a3a4e] rounded-md p-1 px-2.5">
      <div className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
        <Clock className="w-3.5 h-3.5 text-[#14b8a6]" />
        <span className="font-medium text-[#94a3b8]">Cutoff:</span>
      </div>

      <div className="flex items-center gap-1">
        <select
          value={cutoffHour}
          onChange={(e) => onCutoffChange(Number(e.target.value), cutoffMinute)}
          aria-label="Cutoff hour"
          className="bg-[#0f1729] border border-[#2a3a4e] rounded text-xs font-mono text-[#e2e8f0] px-1.5 py-1 focus:outline-none focus:border-[#14b8a6] cursor-pointer"
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <option key={i} value={i}>
              {String(i).padStart(2, '0')}
            </option>
          ))}
        </select>

        <span className="text-[#64748b] font-mono">:</span>

        <select
          value={cutoffMinute}
          onChange={(e) => onCutoffChange(cutoffHour, Number(e.target.value))}
          aria-label="Cutoff minute"
          className="bg-[#0f1729] border border-[#2a3a4e] rounded text-xs font-mono text-[#e2e8f0] px-1.5 py-1 focus:outline-none focus:border-[#14b8a6] cursor-pointer"
        >
          {[0, 15, 30, 45].map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, '0')}
            </option>
          ))}
        </select>

        <span className="text-[11px] font-mono text-[#64748b] ml-0.5">{timezone}</span>
      </div>

      <div className="h-4 w-px bg-[#2a3a4e] mx-1 hidden md:block" />

      {/* Presets */}
      <div className="hidden md:flex items-center gap-1 text-[11px] font-mono">
        {presets.map((p) => {
          const isSelected = cutoffHour === p.hour && cutoffMinute === p.minute;
          return (
            <button
              key={p.label}
              type="button"
              title={p.title}
              onClick={() => onCutoffChange(p.hour, p.minute)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                isSelected
                  ? 'bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/40'
                  : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e2a3a]'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
