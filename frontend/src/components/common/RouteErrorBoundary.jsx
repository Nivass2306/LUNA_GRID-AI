import React from 'react';
import { AlertOctagon, RotateCw, Home } from 'lucide-react';

export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      `[RouteErrorBoundary] Caught error in ${this.props.routeName || 'route'}:`,
      error,
      errorInfo
    );
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full py-12 px-4 flex items-center justify-center">
          <div className="console-panel max-w-lg w-full p-6 sm:p-8 rounded-2xl border border-[rgba(255,59,78,0.4)] bg-[rgba(10,18,36,0.85)] shadow-[0_0_30px_rgba(255,59,78,0.2)] text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[rgba(255,59,78,0.15)] border border-[#FF3B4E]/40 flex items-center justify-center text-[#FF3B4E]">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="font-orbitron font-bold text-lg text-[#EAF4FF]">
                This page failed to load
              </h3>
              <p className="font-exo text-xs text-[#8CA3C2] leading-relaxed">
                An unexpected error occurred while rendering the {this.props.routeName || 'console'} view. The sidebar and flight deck controls remain fully operational.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-black/60 border border-white/10 text-left font-mono text-[11px] text-[#FF3B4E] overflow-x-auto max-h-32">
                {String(this.state.error?.message || this.state.error)}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2.5 rounded-xl text-xs font-orbitron font-bold uppercase tracking-wider text-black bg-[#22D3EE] hover:bg-[#22D3EE]/90 transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.35)]"
              >
                <RotateCw className="w-4 h-4" />
                <span>Retry Page</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/console/overview')}
                className="px-4 py-2.5 rounded-xl text-xs font-orbitron font-bold uppercase tracking-wider text-[#EAF4FF] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Go to Overview</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
