import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Table, BarChart3, BookOpen, ShieldAlert } from 'lucide-react';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const navItems = [
    {
      to: '/',
      label: 'Overview',
      icon: LayoutDashboard,
      description: 'Daily forecast & actuals',
    },
    {
      to: '/explorer',
      label: 'Forecast Explorer',
      icon: Table,
      description: 'Settlement table & revisions',
    },
    {
      to: '/analysis',
      label: 'Accuracy Analysis',
      icon: BarChart3,
      description: 'Month-long error metrics',
    },
    {
      to: '/methodology',
      label: 'Methodology',
      icon: BookOpen,
      description: 'Cutoff logic & formulation',
    },
  ];

  return (
    <aside className="h-full flex flex-col justify-between bg-[#1a2332] border-r border-[#2a3a4e] w-64 p-3 select-none">
      <div>
        <div className="px-3 py-3 mb-2">
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded text-xs transition-colors ${
                    isActive
                      ? 'bg-[#0f1729] text-[#14b8a6] border border-[#2a3a4e] font-semibold'
                      : 'text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a3a]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#14b8a6]' : 'text-[#64748b]'}`} />
                    <div className="flex flex-col text-left">
                      <span>{item.label}</span>
                      <span className="text-[10px] text-[#64748b] font-normal font-sans">
                        {item.description}
                      </span>
                    </div>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-[#2a3a4e] text-xs font-mono space-y-2">
        <div className="bg-[#0f1729] p-2.5 rounded border border-[#2a3a4e] text-[11px] text-[#94a3b8]">
          <div className="flex items-center gap-1.5 text-[#14b8a6] font-semibold mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#14b8a6]" />
            GB Power System
          </div>
          <div>BMRS WINDFOR (B1620)</div>
          <div>FUELHH Settlement Outturn</div>
          <div className="text-[#64748b] mt-1 text-[10px]">Dataset: Jan 1–31, 2026</div>
        </div>

        <div className="text-[10px] text-[#64748b] flex items-center gap-1">
          
          
        </div>
      </div>
    </aside>
  );
};
