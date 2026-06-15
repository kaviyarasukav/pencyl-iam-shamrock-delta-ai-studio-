import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { deltaService } from '../services/delta';
import { ExchangeService } from '../services/ExchangeService';
import { deltaApiClient } from '../lib/api';

export type ExchangeType = 'delta';

interface ExchangeContextType {
  exchange: ExchangeType;
  setExchange: (exchange: ExchangeType) => void;
  api: ExchangeService;
  hasApiKeys: boolean;
  isTestnet: boolean;
  refreshSettings: () => Promise<void>;
}

const ExchangeContext = createContext<ExchangeContextType | undefined>(undefined);

export function ExchangeProvider({ children }: { children: ReactNode }) {
  const [exchange, setExchangeState] = useState<ExchangeType>('delta');
  const [hasApiKeys, setHasApiKeys] = useState<boolean>(false);
  const [isTestnet, setIsTestnet] = useState<boolean>(false);

  const fetchSettings = async () => {
    try {
      const res = await deltaApiClient.get<any>('/api/settings');
      setHasApiKeys(res.hasApiKey && res.hasSecretKey);
      setIsTestnet(res.useTestnet);
      deltaApiClient.setDeltaBaseUrl(res.useTestnet);
    } catch (error) {
      console.error("Failed to load settings in context", error);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const setExchange = (newExchange: ExchangeType) => {
    setExchangeState(newExchange);
  };

  // Select api based on selected exchange (expandable for future exchanges)
  const api: ExchangeService = exchange === 'delta' ? deltaService : deltaService;

  return (
    <ExchangeContext.Provider value={{ exchange, setExchange, api, hasApiKeys, isTestnet, refreshSettings: fetchSettings }}>
      {children}
    </ExchangeContext.Provider>
  );
}

export function useExchange() {
  const context = useContext(ExchangeContext);
  if (context === undefined) {
    throw new Error('useExchange must be used within an ExchangeProvider');
  }
  return context;
}
