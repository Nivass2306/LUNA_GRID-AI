import React from 'react';
import { WifiOff, RotateCcw, Database } from 'lucide-react';
import { useSpacegridState } from '../context/SpacegridContext';

export const OfflineFallback = () => {
  const { error, refresh, switchScenario } = useSpacegridState();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="mission-card max-w-lg w-full p-6 sm:p-8 text-center space-y-4 border-danger/30 shadow-glow-danger">
        <div className="w-12 h-12 rounded-xl bg-danger/10 text-danger mx-auto flex items-center justify-center border border-danger/30">
          <WifiOff className="w-6 h-6" aria-hidden="true" />
        </div>

        <div>
          <h2 className="font-heading font-bold text-lg text-text">
            Can't reach the SPACEGRID backend
          </h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            {error?.message || 'The mission-control advisory telemetry stream failed to establish a handshake with the FastAPI service.'}
          </p>
        </div>

        {error?.url && (
          <div className="p-2.5 rounded-lg bg-bg font-mono text-[11px] text-text-muted border border-border/80 break-all">
            Target Endpoint: <span className="text-demand">{error.url}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={refresh}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-demand hover:bg-sky-400 text-slate-950 font-heading font-semibold text-xs tracking-wider uppercase transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>

          <button
            type="button"
            onClick={() => switchScenario('nominal')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-bg-raised hover:bg-slate-800 text-text border border-border text-xs font-semibold uppercase tracking-wider transition-all"
          >
            <Database className="w-3.5 h-3.5 text-solar" />
            <span>Switch to Mock Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
};
