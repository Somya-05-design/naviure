"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface AppContextType {
  introComplete: boolean;
  setIntroComplete: (value: boolean) => void;
  isTransitioning: boolean;
  setIsTransitioning: (value: boolean) => void;
  portfolioMode: boolean;
  setPortfolioMode: (value: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [introComplete, setIntroComplete] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [portfolioMode, setPortfolioMode] = useState(false);

  return (
    <AppContext.Provider
      value={{
        introComplete,
        setIntroComplete,
        isTransitioning,
        setIsTransitioning,
        portfolioMode,
        setPortfolioMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
