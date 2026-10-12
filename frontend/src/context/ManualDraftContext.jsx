import React, { createContext, useContext } from 'react';
import { useLunagridState } from './LunagridContext';
import { useManualDraft } from '../hooks/useManualDraft';

const ManualDraftContext = createContext(null);

export const ManualDraftProvider = ({ children }) => {
  const { state, refresh } = useLunagridState();

  const manual = useManualDraft(state, (updated) => {
    refresh();
  });

  return (
    <ManualDraftContext.Provider value={manual}>
      {children}
    </ManualDraftContext.Provider>
  );
};

export const useConsoleManual = () => {
  const context = useContext(ManualDraftContext);
  if (!context) {
    throw new Error('useConsoleManual must be used within a ManualDraftProvider');
  }
  return context;
};
