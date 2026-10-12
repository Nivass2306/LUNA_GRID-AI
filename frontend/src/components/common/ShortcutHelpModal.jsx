import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, ArrowRight } from 'lucide-react';

const SHORTCUTS = [
  { group: 'Navigation', items: [
    { key: '1', label: 'Overview', desc: 'Base status, survival readout, telemetry' },
    { key: '2', label: 'Forecast', desc: 'Solar drop projection, shortage window' },
    { key: '3', label: 'Allocation', desc: 'Active load distribution and AI reasons' },
    { key: '4', label: 'Manual Routing', desc: 'Direct power sliders and consequence engine' },
    { key: '5', label: 'Comparison', desc: 'SPACEGRID vs Priority vs Equal Split' },
    { key: '6', label: 'Approval', desc: 'Audit feed and hold-to-approve command' },
    { key: '7', label: 'Simulation', desc: 'Stress tests, eclipse curve, drop sandbox' },
    { key: '8', label: 'Event Log', desc: 'Audited log with filters and deduplication' },
  ]},
  { group: 'Grid Control', items: [
    { key: 'D', label: 'Simulate 70% Drop', desc: 'Instantly drop solar output to 3.0 kW' },
    { key: 'R', label: 'Reset to Day', desc: 'Restore nominal 10.0 kW daylight generation' },
    { key: 'M', label: 'Toggle Manual Mode', desc: 'Switch directly to / from Manual Routing' },
  ]},
  { group: 'System', items: [
    { key: '?', label: 'Keyboard Shortcuts', desc: 'Toggle this cheat sheet' },
    { key: 'Esc', label: 'Close Modal', desc: 'Dismiss active overlay' },
  ]}
];

export const ShortcutHelpModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-2xl console-panel console-panel-blur p-6 z-10 border border-[rgba(56,189,248,0.4)] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[rgba(56,189,248,0.18)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[rgba(34,211,238,0.15)] border border-[rgba(34,211,238,0.4)] flex items-center justify-center text-[#22D3EE]">
                <Keyboard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-orbitron font-semibold text-base text-[#EAF4FF] tracking-wide">
                  KEYBOARD SHORTCUTS
                </h3>
                <p className="font-exo text-xs text-[#8CA3C2]">
                  Quick keyboard commands for mission console operators
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8CA3C2] hover:text-[#EAF4FF] hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Shortcut Groups */}
          <div className="mt-5 space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            {SHORTCUTS.map((group) => (
              <div key={group.group}>
                <h4 className="font-exo text-xs font-semibold uppercase tracking-wider text-[#22D3EE] mb-2.5">
                  {group.group}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {group.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(3,8,20,0.5)] border border-[rgba(56,189,248,0.12)] hover:border-[rgba(56,189,248,0.3)] transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-exo text-sm font-medium text-[#EAF4FF]">
                          {item.label}
                        </span>
                        <span className="font-exo text-[11px] text-[#8CA3C2] leading-tight">
                          {item.desc}
                        </span>
                      </div>
                      <kbd className="ml-3 px-2 py-1 min-w-[28px] text-center font-mono text-xs font-bold rounded bg-[rgba(34,211,238,0.12)] text-[#22D3EE] border border-[rgba(34,211,238,0.35)] shadow-sm">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-5 pt-3 border-t border-[rgba(56,189,248,0.18)] flex items-center justify-between font-exo text-xs text-[#8CA3C2]">
            <span>Press <kbd className="px-1.5 py-0.5 font-mono text-[11px] rounded bg-white/10 text-white">Esc</kbd> anytime to dismiss</span>
            <span className="text-[#22D3EE]/80">Global shortcuts disabled while typing in text inputs</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
