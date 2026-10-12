import React from 'react';
import { AlertOctagon } from 'lucide-react';
import { useLunagridState } from '../../context/LunagridContext.jsx';

/**
 * Safe inner content rendering the pulsing light, icon, and formatted deficit text.
 */
const LifeSupportAlertContent = ({ alert }) => {
  if (!alert || !alert.active) {
    return null;
  }

  const allocated = Number(alert.allocated_kw ?? 0);
  const threshold = Number(alert.threshold_kw ?? 3.0);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[rgba(255,59,78,0.18)] text-[#FF3B4E] border border-[#FF3B4E]/60 shadow-[0_0_16px_rgba(255,59,78,0.45)] select-none transition-all duration-300"
      title={`Life Support allocation deficit: ${allocated.toFixed(2)} kW of ${threshold.toFixed(2)} kW required.`}
    >
      {/* Slow 1-sec pulsing red light indicator */}
      <span
        aria-hidden="true"
        className="w-2.5 h-2.5 rounded-full bg-[#FF3B4E] ls-pulse-beacon inline-block shrink-0"
      />

      {/* Warning Icon - ensures visual indicator never relies on color alone */}
      <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-[#FF3B4E]" aria-hidden="true" />

      {/* Dynamic threshold metric strictly from API */}
      <span className="font-orbitron font-bold tracking-wide">
        LIFE SUPPORT LOW: {allocated.toFixed(2)} / {threshold.toFixed(2)} kW
      </span>
    </div>
  );
};

/**
 * Error boundary component protecting the indicator from crashing outer header.
 */
class LifeSupportAlertErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('LifeSupportAlertIndicator render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * Global Life Support Alert Indicator
 * Renders next to the status pill in the header.
 * Displays only when active plan's life_support_alert.active is true.
 */
export const LifeSupportAlertIndicator = ({ alertOverride }) => {
  let contextAlert = null;
  try {
    const { state } = useLunagridState();
    contextAlert = state?.life_support_alert;
  } catch {
    // If rendered outside LunagridProvider, fallback to props
    contextAlert = null;
  }

  const alert = alertOverride !== undefined ? alertOverride : contextAlert;

  return (
    <LifeSupportAlertErrorBoundary>
      <LifeSupportAlertContent alert={alert} />
    </LifeSupportAlertErrorBoundary>
  );
};
