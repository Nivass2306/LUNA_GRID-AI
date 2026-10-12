import React from 'react';

export const ModeSwitch = ({
  mode,
  onEnterManual,
  onRequestAuto,
  showAutoConfirm,
  onConfirmAuto,
  onCancelAuto,
  onStartFromZero,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-hairline/60 select-none text-[13px]">
      {/* Two-word text switch with sliding underline */}
      <div className="flex items-center gap-6 relative font-sans">
        <button
          onClick={onRequestAuto}
          className={`relative pb-1 font-medium transition-colors cursor-pointer ${
            mode === 'auto' ? 'text-bone' : 'text-muted hover:text-bone'
          }`}
          title="Automatic optimizer mode (Shortcut: M)"
        >
          Auto
          {mode === 'auto' && (
            <span className="absolute left-0 bottom-0 w-full h-[1.5px] bg-bone transition-all" />
          )}
        </button>

        <button
          onClick={onEnterManual}
          className={`relative pb-1 font-medium transition-colors cursor-pointer ${
            mode === 'manual' ? 'text-bone' : 'text-muted hover:text-bone'
          }`}
          title="Manual flight control mode (Shortcut: M)"
        >
          Manual
          {mode === 'manual' && (
            <span className="absolute left-0 bottom-0 w-full h-[1.5px] bg-bone transition-all" />
          )}
        </button>

        <span className="font-mono text-[10px] text-muted/60 border border-hairline px-1.5 py-0.5">
          M
        </span>
      </div>

      {/* Manual Mode Actions & Confirm Line */}
      {mode === 'manual' && (
        <div className="flex items-center gap-4 text-[12.5px]">
          {showAutoConfirm ? (
            <div className="flex items-center gap-3 bg-raised border border-hairline px-3 py-1 text-bone">
              <span>Return to automatic planning?</span>
              <button
                onClick={onConfirmAuto}
                className="text-solar font-medium hover:underline cursor-pointer"
              >
                Yes
              </button>
              <span className="text-hairline">/</span>
              <button
                onClick={onCancelAuto}
                className="text-muted hover:text-bone cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted">
              <button
                onClick={onStartFromZero}
                className="hover:text-bone active:scale-[0.98] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                title="Set all loads to 0 kW to energize one by one (Shortcut: Z)"
              >
                <span>Start from zero</span>
                <span className="font-mono text-[10px] border border-hairline px-1 py-0.2 text-muted">
                  Z
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
