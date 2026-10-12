import React, { createContext, useContext, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ message, type = 'info', link = null, duration = 4000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    const newToast = { id, message, type, link };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Floating Bottom-Right Toast Stack */}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none select-none"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const isDanger = toast.type === 'danger';
          const isWarn = toast.type === 'warn';
          const isSuccess = toast.type === 'success';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 ${
                isDanger
                  ? 'bg-[#1C080F]/90 border-danger/60 text-danger-text shadow-[0_4px_20px_rgba(255,59,78,0.35)]'
                  : isWarn
                  ? 'bg-[#1F1706]/90 border-warn/60 text-warn-text shadow-[0_4px_20px_rgba(255,194,51,0.3)]'
                  : isSuccess
                  ? 'bg-[#081C14]/90 border-ok/60 text-ok-text shadow-[0_4px_20px_rgba(34,229,139,0.3)]'
                  : 'bg-[#071228]/90 border-cyan/50 text-text shadow-[0_4px_20px_rgba(34,211,238,0.25)]'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isDanger ? (
                  <AlertTriangle className="w-4 h-4 text-danger" />
                ) : isWarn ? (
                  <AlertTriangle className="w-4 h-4 text-warn" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-ok" />
                ) : (
                  <Info className="w-4 h-4 text-cyan" />
                )}
              </div>

              <div className="flex-1 text-xs font-mono leading-relaxed text-text">
                <p>{toast.message}</p>
                {toast.link && (
                  <Link
                    to={toast.link.href}
                    className="inline-block mt-1 font-semibold text-cyan underline hover:text-white transition-colors"
                    onClick={() => removeToast(toast.id)}
                  >
                    {toast.link.text} →
                  </Link>
                )}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-muted hover:text-text p-0.5 transition-colors cursor-pointer"
                aria-label="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
