import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  TrendingUp,
  Cpu,
  SlidersHorizontal,
  Scale,
  ShieldCheck,
  FlaskConical,
  History,
  Activity,
  Zap,
} from 'lucide-react';
import { useSpacegridState } from '../context/SpacegridContext';

const NAV_GROUPS = [
  {
    title: 'Monitor',
    items: [
      { path: '/console/overview', label: 'Overview', keyNum: '1', icon: LayoutDashboard },
      { path: '/console/forecast', label: 'Forecast', keyNum: '2', icon: TrendingUp },
      { path: '/console/allocation', label: 'Allocation', keyNum: '3', icon: Cpu },
    ],
  },
  {
    title: 'Decide',
    items: [
      { path: '/console/comparison', label: 'Comparison', keyNum: '4', icon: Scale },
      { path: '/console/approval', label: 'Approval', keyNum: '5', icon: ShieldCheck },
    ],
  },
  {
    title: 'Test',
    items: [
      { path: '/console/simulation', label: 'Simulation', keyNum: '6', icon: FlaskConical },
    ],
  },
  {
    title: 'Record',
    items: [
      { path: '/console/events', label: 'Events', keyNum: '7', icon: History },
    ],
  },
];

export const ConsoleSidebar = ({ onOpenShortcuts }) => {
  const location = useLocation();
  const { state } = useSpacegridState();

  const isPendingApproval = state?.plan?.status === 'pending' || state?.decision === 'pending';
  const alertLevel = state?.alert?.level || 'green';
  const hasAlerts = alertLevel === 'red' || alertLevel === 'amber' || alertLevel === 'yellow';

  return (
    <aside className="w-[72px] xl:w-[232px] h-screen flex flex-col shrink-0 bg-[rgba(3,8,20,0.88)] backdrop-blur-md border-r border-[rgba(56,189,248,0.22)] select-none z-30 transition-all duration-300">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 xl:px-5 border-b border-[rgba(56,189,248,0.18)]">
        <NavLink
          to="/console/overview"
          className="flex items-center gap-3 overflow-hidden group focus:outline-none"
        >
          <div className="w-9 h-9 rounded-lg bg-[rgba(34,211,238,0.12)] border border-[rgba(34,211,238,0.35)] flex items-center justify-center shrink-0 group-hover:border-[#22D3EE] transition-colors shadow-[0_0_12px_rgba(34,211,238,0.2)]">
            <Zap className="w-5 h-5 text-[#22D3EE]" />
          </div>
          <div className="hidden xl:flex flex-col">
            <span className="font-orbitron font-bold text-sm tracking-wider text-[#EAF4FF] group-hover:text-[#22D3EE] transition-colors">
              SPACEGRID<span className="text-[#22D3EE] ml-1">AI</span>
            </span>
            <span className="font-exo text-[11px] uppercase tracking-widest text-[#8CA3C2]">
              LUNA-1 BASE
            </span>
          </div>
        </NavLink>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-4 px-2 xl:px-3 overflow-y-auto space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="hidden xl:block px-3 py-1 font-exo text-[11px] font-bold uppercase tracking-wider text-[#8CA3C2]">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={`${item.label} (${item.keyNum})`}
                    className={`relative flex items-center h-10 px-3 rounded-lg font-exo text-sm font-medium transition-colors group ${
                      isActive
                        ? 'text-[#22D3EE] font-semibold'
                        : 'text-[#8CA3C2] hover:text-[#EAF4FF] hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Sliding active highlight background */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebarActiveHighlight"
                        className="absolute inset-0 rounded-lg bg-[rgba(34,211,238,0.12)] border-l-2 border-[#22D3EE] shadow-[inset_0_0_12px_rgba(34,211,238,0.15)]"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}

                    <div className="relative z-10 flex items-center justify-center w-6 h-6 shrink-0 xl:mr-3">
                      <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-[#22D3EE]' : 'text-inherit'}`} />
                    </div>

                    <span className="relative z-10 hidden xl:inline truncate">
                      {item.label}
                    </span>

                    {/* Badges / indicators */}
                    <div className="relative z-10 hidden xl:flex items-center ml-auto gap-1.5">
                      {/* Live pending pill for Approval */}
                      {item.path === '/console/approval' && isPendingApproval && (
                        <span className="px-1.5 py-0.5 font-exo text-[11px] font-bold uppercase tracking-wider rounded bg-[rgba(255,194,51,0.2)] text-[#FFC233] border border-[rgba(255,194,51,0.4)] animate-pulse">
                          Pending
                        </span>
                      )}

                      {/* Live alert count for Events */}
                      {item.path === '/console/events' && hasAlerts && (
                        <span className="px-1.5 py-0.5 font-mono text-[11px] font-bold rounded-full bg-[rgba(255,59,78,0.2)] text-[#FF3B4E] border border-[rgba(255,59,78,0.5)]">
                          !
                        </span>
                      )}

                      {/* Shortcut key indicator */}
                      <kbd className="px-1.5 py-0.5 font-mono text-[11px] text-[#8CA3C2] bg-white/[0.04] border border-white/[0.08] rounded">
                        {item.keyNum}
                      </kbd>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / Shortcut Help Button */}
      <div className="p-2 xl:p-3 border-t border-[rgba(56,189,248,0.18)]">
        <button
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts (?)"
          className="w-full flex items-center justify-center xl:justify-start h-9 px-3 rounded-lg text-xs font-exo text-[#8CA3C2] hover:text-[#22D3EE] hover:bg-white/[0.04] transition-colors"
        >
          <span className="w-5 h-5 flex items-center justify-center font-mono font-bold text-xs rounded border border-[#8CA3C2]/40 xl:mr-2">
            ?
          </span>
          <span className="hidden xl:inline">Shortcuts</span>
        </button>
      </div>
    </aside>
  );
};
