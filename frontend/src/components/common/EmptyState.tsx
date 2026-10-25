import React from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  heightClass?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Telemetry Recorded',
  description = 'No published wind forecast intervals or settlement actuals found for the selected parameters.',
  heightClass = 'h-64',
}) => {
  return (
    <div
      className={`w-full ${heightClass} flex flex-col items-center justify-center bg-[#1a2332]/50 border border-[#2a3a4e] rounded-md p-6 text-center`}
    >
      <div className="w-10 h-10 rounded-full bg-[#0f1729] border border-[#2a3a4e] flex items-center justify-center mb-3 text-[#64748b]">
        <Database className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-[#e2e8f0] mb-1">{title}</h4>
      <p className="text-xs text-[#94a3b8] max-w-sm font-mono">{description}</p>
    </div>
  );
};
