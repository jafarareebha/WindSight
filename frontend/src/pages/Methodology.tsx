import React from 'react';
import { MethodologyPanel } from '../components/features/MethodologyPanel';
import { BookOpen, FileText } from 'lucide-react';

export const Methodology: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-[#2a3a4e]">
        <div>
          <h1 className="text-base font-semibold text-[#e2e8f0]">
            System Architecture &amp; Methodology Specification
          </h1>
          <p className="text-xs text-[#94a3b8] font-mono">
            Scientific documentation of point-in-time forecast telemetry matching &amp; BMRS data feeds
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#64748b]">
          <FileText className="w-4 h-4 text-[#14b8a6]" />
          <span>Spec Revision: 2026.1-GB</span>
        </div>
      </div>

      <MethodologyPanel />
    </div>
  );
};
