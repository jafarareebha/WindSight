import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  description?: string;
  subtext?: string;
  trend?: 'positive' | 'negative' | 'neutral' | 'warning';
  badge?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  description,
  subtext,
  trend = 'neutral',
  badge,
}) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'positive':
        return 'text-[#22c55e]';
      case 'negative':
        return 'text-[#ef4444]';
      case 'warning':
        return 'text-[#f59e0b]';
      default:
        return 'text-[#94a3b8]';
    }
  };

  const formattedValue = value !== null && value !== undefined 
    ? typeof value === 'number' 
      ? Number.isInteger(value) 
        ? value.toLocaleString() 
        : value.toFixed(1)
      : value
    : '—';

  return (
    <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-md p-4 flex flex-col justify-between hover:border-[#3b506b] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider">
          {label}
        </span>
        {badge && (
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#0f1729] border border-[#2a3a4e] text-[#14b8a6]">
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-baseline space-x-1.5 my-1">
        <span className="text-2xl font-semibold text-[#e2e8f0] font-mono tabular-nums tracking-tight">
          {formattedValue}
        </span>
        {unit && (
          <span className="text-xs font-mono text-[#94a3b8]">
            {unit}
          </span>
        )}
      </div>

      {(description || subtext) && (
        <div className="mt-2 pt-2 border-t border-[#2a3a4e]/50 flex items-center justify-between text-xs">
          {description && (
            <span className="text-[#64748b] truncate" title={description}>
              {description}
            </span>
          )}
          {subtext && (
            <span className={`font-mono text-xs ${getTrendColor()}`}>
              {subtext}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
