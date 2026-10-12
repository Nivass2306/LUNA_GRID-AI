import React, { useState, useEffect, useRef } from 'react';
import { useSpacegridState } from '../context/SpacegridContext';

export const AdvisoryFeed = () => {
  const { state } = useSpacegridState();
  const alert = state?.alert || {};
  const loads = state?.loads || [];
  const power = state?.power || {};

  const solarKw = Number(power.solar_kw ?? 10.0).toFixed(1);
  const demandKw = Number(power.demand_kw ?? 8.0).toFixed(1);

  // Construct short, operator-style bullet points
  const rawStatements = [];
  if (alert.message) {
    rawStatements.push(alert.message);
  } else {
    rawStatements.push(`Solar is ${solarKw} kW against ${demandKw} kW total habitat demand.`);
  }

  // Add specific load decisions that were altered
  loads.forEach((l) => {
    if (l.status === 'Postponed' || l.status === 'Throttled' || l.status === 'Isolated') {
      rawStatements.push(`${l.name}: ${l.reason || `${l.status}. Allocated ${l.allocated_kw || 0} kW.`}`);
    }
  });

  const fullText = rawStatements.join(' ');
  const [typedLength, setTypedLength] = useState(fullText.length);
  const [isTyping, setIsTyping] = useState(false);
  const textRef = useRef(fullText);

  useEffect(() => {
    // When alert message or state changes, trigger typewriter
    textRef.current = fullText;
    setTypedLength(0);
    setIsTyping(true);

    let charIdx = 0;
    const interval = setInterval(() => {
      charIdx += 1;
      setTypedLength(charIdx);
      if (charIdx >= fullText.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [fullText]);

  const handleSkipTyping = () => {
    setTypedLength(fullText.length);
    setIsTyping(false);
  };

  const timestampStr = state?.timestamp
    ? new Date(state.timestamp).toISOString().substring(11, 19) + ' UTC'
    : '10:00:00 UTC';

  return (
    <div
      onClick={handleSkipTyping}
      className="cursor-pointer select-none group"
      title="Click to reveal full text"
    >
      <div className="flex items-center justify-between border-b border-hairline pb-2 mb-3">
        <h2 className="font-display text-2xl text-bone">
          Advisory feed
        </h2>
        <span className="font-mono text-[11px] text-muted">
          {timestampStr}
        </span>
      </div>

      {/* Screen reader full text */}
      <p className="sr-only">{fullText}</p>

      {/* Display text with typewriter caret */}
      <div className="font-sans text-[13.5px] leading-relaxed text-bone/90 min-h-[58px]">
        <span>{fullText.slice(0, typedLength)}</span>
        {isTyping && (
          <span className="inline-block w-1.5 h-3.5 bg-solar ml-1 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
};
