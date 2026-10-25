import React from 'react';
import { Activity } from 'lucide-react';

interface DataFreshnessIndicatorProps {
  freshnessTimestamp?: string;
  sourceText?: string;
  isOnline?: boolean;
}

export const DataFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({
  freshnessTimestamp,
  sourceText = 'Elexon BMRS (B1620 / FUELHH)',
  isOnline = true,
}) => {
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0f1729] border border-[#2a3a4e]">
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#14b8a6] opacity-75" />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isOnline ? 'bg-[#14b8a6]' : 'bg-[#ef4444]'
            }`}
          />
        </span>
        <span className="text-[#94a3b8] text-[11px] uppercase tracking-wider">
          {isOnline ? 'Verified Feed' : 'Offline'}
        </span>
      </div>

      <div className="hidden lg:flex items-center gap-1 text-[#64748b] text-[11px]">
        <Activity className="w-3 h-3 text-[#14b8a6]" />
        <span>{sourceText}</span>
        {freshnessTimestamp && (
          <>
            <span className="text-[#2a3a4e]">•</span>
            <span>{new Date(freshnessTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
          </>
        )}
      </div>
    </div>
  );
};
