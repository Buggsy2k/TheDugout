import { createContext, useContext, useState, useCallback } from 'react';
import type { TokenUsageInfo } from '../types';

interface TokenUsageContextValue {
  tokenUsage: TokenUsageInfo | null;
  updateTokenUsage: (usage: TokenUsageInfo) => void;
}

const TokenUsageContext = createContext<TokenUsageContextValue>({
  tokenUsage: null,
  updateTokenUsage: () => {},
});

export function TokenUsageProvider({ children }: { children: React.ReactNode }) {
  const [tokenUsage, setTokenUsage] = useState<TokenUsageInfo | null>(null);

  const updateTokenUsage = useCallback((usage: TokenUsageInfo) => {
    setTokenUsage(usage);
  }, []);

  return (
    <TokenUsageContext.Provider value={{ tokenUsage, updateTokenUsage }}>
      {children}
    </TokenUsageContext.Provider>
  );
}

export function useTokenUsage() {
  return useContext(TokenUsageContext);
}
