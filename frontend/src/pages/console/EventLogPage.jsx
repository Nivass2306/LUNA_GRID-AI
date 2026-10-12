import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import { useSpacegridState } from '../../context/SpacegridContext';
import { useToast } from '../../context/ToastContext';

export const EventLogPage = () => {
  const { state } = useSpacegridState();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [copied, setCopied] = useState(false);

  // Generate event records from state
  const rawEvents = useMemo(() => {
    const list = [];
    const ts = '10:04:12 UTC';
    const alert = state?.alert || {};
    const power = state?.power || {};

    if (alert.message) {
      list.push({
        id: 'ev-alert',
        time: ts,
        level: alert.level || (alert.life_support_ok === false ? 'danger' : 'warn'),
        text: alert.message,
      });
    }

    if (power.solar_kw !== null && power.solar_kw !== undefined && power.solar_kw < 5.0) {
      list.push({
        id: 'ev-solar',
        time: '10:02:45 UTC',
        level: 'warn',
        text: `Solar irradiance dropped to ${Number(power.solar_kw).toFixed(1)} kW. Obscuration transit underway.`,
      });
    }

    list.push(
      {
        id: 'ev-rec-3',
        time: '10:00:15 UTC',
        level: 'ok',
        text: 'Telemetry synchronization confirmed across all 5 lunar power bus nodes.',
      },
      {
        id: 'ev-rec-2',
        time: '09:58:30 UTC',
        level: 'ok',
        text: 'PuLP optimization solver generated nominal allocation matrix (re-plan: 38 ms).',
      },
      {
        id: 'ev-rec-1',
        time: '09:50:00 UTC',
        level: 'ok',
        text: 'Morning daylight pass initiated. Battery reserve charging at +2.5 kW.',
      }
    );

    return list;
  }, [state]);

  // Deduplicate and group matching repeat events
  const deduplicatedEvents = useMemo(() => {
    const groups = new Map();

    rawEvents.forEach((ev) => {
      const key = `${ev.level}-${ev.text}`;
      if (groups.has(key)) {
        const item = groups.get(key);
        item.count += 1;
        item.lastTime = ev.time;
      } else {
        groups.set(key, { ...ev, count: 1, lastTime: null });
      }
    });

    return Array.from(groups.values());
  }, [rawEvents]);

  // Apply search query and severity filter
  const filteredEvents = useMemo(() => {
    return deduplicatedEvents.filter((ev) => {
      const matchesSearch =
        ev.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.time.toLowerCase().includes(searchTerm.toLowerCase());

      const normLevel = (ev.level || 'ok').toLowerCase();
      let matchesFilter = true;
      if (levelFilter === 'ok') matchesFilter = normLevel === 'ok' || normLevel === 'green';
      if (levelFilter === 'warn') matchesFilter = normLevel === 'warn' || normLevel === 'amber' || normLevel === 'yellow';
      if (levelFilter === 'danger') matchesFilter = normLevel === 'danger' || normLevel === 'red' || normLevel === 'critical';

      return matchesSearch && matchesFilter;
    });
  }, [deduplicatedEvents, searchTerm, levelFilter]);

  const handleCopyLog = () => {
    const text = filteredEvents
      .map((e) => `[${e.time}] [${e.level.toUpperCase()}] ${e.text} (x${e.count})`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast({
      message: 'Telemetry audit log copied to clipboard.',
      type: 'info',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filteredEvents, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `luna-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast({
      message: 'Exported JSON telemetry audit file.',
      type: 'success',
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. AUDIT LOG TOOLBAR & SEARCH HEADER */}
      <div className="console-panel p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[rgba(56,189,248,0.2)]">
          <div>
            <h2 className="font-orbitron font-bold text-base text-[#EAF4FF] flex items-center gap-2">
              <History className="w-4 h-4 text-[#22D3EE]" />
              TELEMETRY & FLIGHT DECISION AUDIT TRAIL
            </h2>
            <p className="font-exo text-xs text-[#8CA3C2]">
              Immutable chronological record of grid adjustments, optimizer re-plans, and operator approvals
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-exo font-semibold bg-white/5 hover:bg-white/10 text-[#8CA3C2] hover:text-[#EAF4FF] border border-white/10 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#22E58B]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Log'}</span>
            </button>

            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-exo font-semibold bg-[rgba(34,211,238,0.12)] hover:bg-[rgba(34,211,238,0.22)] text-[#22D3EE] border border-[rgba(34,211,238,0.35)] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8CA3C2]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by keyword, subsystem, or timestamp..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[rgba(7,18,40,0.85)] border border-[rgba(56,189,248,0.32)] text-xs text-[#EAF4FF] placeholder-[#8CA3C2]/60 focus:outline-none focus:border-[#22D3EE] transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto select-none">
            {[
              { id: 'all', label: 'All' },
              { id: 'ok', label: 'Nominal' },
              { id: 'warn', label: 'Watch' },
              { id: 'danger', label: 'Critical' },
            ].map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => setLevelFilter(lvl.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-exo font-semibold uppercase tracking-wider transition-all ${
                  levelFilter === lvl.id
                    ? 'bg-[rgba(34,229,139,0.2)] text-[#22E58B] border border-[rgba(34,229,139,0.45)] shadow-[0_0_8px_rgba(34,229,139,0.2)]'
                    : 'bg-white/5 text-[#8CA3C2] hover:text-[#EAF4FF] border border-transparent'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. DEDUPLICATED AUDIT TABLE */}
      <div className="console-panel p-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-exo text-xs">
            <thead>
              <tr className="border-b border-[rgba(56,189,248,0.2)] text-[#8CA3C2] uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Timestamp (UTC)</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Telemetry Event Description</th>
                <th className="py-2.5 px-3 text-right">Occurrence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(56,189,248,0.08)]">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-10 text-[#8CA3C2] font-exo">
                    No matching telemetry events found for "{searchTerm}".
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev, idx) => {
                  const norm = (ev.level || 'ok').toLowerCase();
                  const isDanger = norm === 'danger' || norm === 'red' || norm === 'critical';
                  const isWarn = norm === 'warn' || norm === 'amber' || norm === 'yellow';

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Timestamp with Monospace numbers */}
                      <td className="py-3 px-3 font-mono-numbers text-[#22D3EE] whitespace-nowrap">
                        {ev.lastTime ? `${ev.time} – ${ev.lastTime}` : ev.time}
                      </td>

                      {/* Severity Chip */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider border ${
                            isDanger
                              ? 'bg-[rgba(255,59,78,0.18)] text-[#FF3B4E] border-[rgba(255,59,78,0.45)]'
                              : isWarn
                              ? 'bg-[rgba(255,194,51,0.18)] text-[#FFC233] border-[rgba(255,194,51,0.45)]'
                              : 'bg-[rgba(34,229,139,0.18)] text-[#22E58B] border-[rgba(34,229,139,0.45)]'
                          }`}
                        >
                          {isDanger ? (
                            <AlertOctagon className="w-3 h-3" />
                          ) : isWarn ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <ShieldCheck className="w-3 h-3" />
                          )}
                          {isDanger ? 'CRITICAL' : isWarn ? 'WATCH' : 'NOMINAL'}
                        </span>
                      </td>

                      {/* Event Text */}
                      <td className="py-3 px-3 text-[#EAF4FF] font-exo text-xs leading-relaxed max-w-xl">
                        {ev.text}
                      </td>

                      {/* Occurrence Multiplier Badge */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {ev.count > 1 ? (
                          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-[rgba(34,211,238,0.15)] text-[#22D3EE] border border-[rgba(34,211,238,0.35)] shadow-xs">
                            ×{ev.count}
                          </span>
                        ) : (
                          <span className="text-[#8CA3C2]/50 font-mono text-[11px]">1</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
