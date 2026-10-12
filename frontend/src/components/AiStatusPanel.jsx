import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Activity } from 'lucide-react';
import { StatusChip } from './StatusChip';

export const AiStatusPanel = ({ alert = {}, replanning = false, reasons = [] }) => {
  const alertLevel = alert.level || 'green';
  const alertTitle = alert.title || (alertLevel === 'red' ? 'CRITICAL' : alertLevel === 'yellow' ? 'WATCH' : 'NOMINAL');

  // Stages of AI optimization cycle
  const stages = ['Predicting', 'Optimizing', 'Simulating', 'Responding'];
  const [activeStageIdx, setActiveStageIdx] = useState(stages.length - 1);

  useEffect(() => {
    if (replanning) {
      let idx = 0;
      setActiveStageIdx(0);
      const interval = setInterval(() => {
        idx += 1;
        if (idx < stages.length) {
          setActiveStageIdx(idx);
        } else {
          clearInterval(interval);
        }
      }, 120);
      return () => clearInterval(interval);
    } else {
      setActiveStageIdx(stages.length - 1); // all lit
    }
  }, [replanning]);

  // Typed advisory feed (~15ms per character with click-to-skip)
  const fullText = (reasons && reasons.length > 0)
    ? reasons.slice(0, 3).join(' • ')
    : alert.message || 'All habitat power telemetry operating nominal within physical parameters.';

  const [displayedTextLength, setDisplayedTextLength] = useState(fullText.length);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // When text changes, start typewriter effect
    setDisplayedTextLength(0);
    setIsTyping(true);
    let currentLen = 0;

    const interval = setInterval(() => {
      currentLen += 2;
      if (currentLen >= fullText.length) {
        setDisplayedTextLength(fullText.length);
        setIsTyping(false);
        clearInterval(interval);
      } else {
        setDisplayedTextLength(currentLen);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [fullText]);

  const handleSkipTyping = () => {
    setDisplayedTextLength(fullText.length);
    setIsTyping(false);
  };

  return (
    <div className="hud-panel hud-panel-blur p-4 flex flex-col justify-between h-full min-h-[140px]">
      <div className="flex items-center justify-between border-b border-panel-border/40 pb-2">
        <h3 className="hud-title text-xs tracking-wider flex items-center gap-1.5">
          <Cpu className={`w-3.5 h-3.5 text-cyan ${replanning ? 'animate-spin' : ''}`} />
          SPACEGRID AI Status
        </h3>

        {/* Status chip matching alert level */}
        <StatusChip status={alertLevel === 'red' ? 'Off' : alertLevel === 'yellow' ? 'Reduced' : 'Protected'} />
      </div>

      {/* 4 Execution Pipeline Words */}
      <div className="flex items-center justify-between py-2 border-b border-panel-border/20">
        {stages.map((st, i) => {
          const isLit = !replanning || i <= activeStageIdx;
          return (
            <span
              key={st}
              className={`text-[10px] font-mono uppercase tracking-wider transition-all duration-200 flex items-center gap-1 ${
                isLit
                  ? 'text-cyan font-bold drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]'
                  : 'text-muted/40'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLit ? 'bg-cyan shadow-[0_0_4px_#22D3EE]' : 'bg-muted/30'
                }`}
              />
              {st}
            </span>
          );
        })}
      </div>

      {/* Typewriter Advisory Feed (latest 3 reasons) */}
      <div
        className="mt-2 text-xs font-mono text-muted/90 cursor-pointer select-none leading-relaxed line-clamp-2"
        onClick={handleSkipTyping}
        title="Click to reveal full advisory text immediately"
      >
        <span className="text-text font-medium">
          {fullText.slice(0, displayedTextLength)}
        </span>
        {isTyping && <span className="inline-block w-1.5 h-3 bg-cyan ml-0.5 animate-pulse" />}
        {/* Hidden full text in DOM immediately for screen readers */}
        <span className="sr-only">{fullText}</span>
      </div>
    </div>
  );
};
