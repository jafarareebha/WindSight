import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  heightClass?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading forecast telemetry...',
  heightClass = 'h-64',
}) => {
  return (
    <div
      className={`w-full ${heightClass} flex flex-col items-center justify-center bg-[#1a2332]/50 border border-[#2a3a4e] rounded-md p-6`}
    >
      <Loader2 className="w-6 h-6 text-[#14b8a6] animate-spin mb-3" />
      <p className="text-xs font-mono text-[#94a3b8] tracking-wide">{message}</p>
    </div>
  );
};
