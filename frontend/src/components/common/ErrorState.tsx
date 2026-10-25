import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  heightClass?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Data Pipeline Error',
  message = 'Failed to retrieve telemetry data from the BMRS feed.',
  onRetry,
  heightClass = 'h-64',
}) => {
  return (
    <div
      className={`w-full ${heightClass} flex flex-col items-center justify-center bg-[#1a2332]/50 border border-[#ef4444]/30 rounded-md p-6 text-center`}
    >
      <div className="w-10 h-10 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center mb-3 text-[#ef4444]">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-[#e2e8f0] mb-1">{title}</h4>
      <p className="text-xs text-[#94a3b8] max-w-md mb-4 font-mono">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded bg-[#1e2a3a] hover:bg-[#2a3a4e] text-[#e2e8f0] border border-[#2a3a4e] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#14b8a6]" />
          Retry Request
        </button>
      )}
    </div>
  );
};
