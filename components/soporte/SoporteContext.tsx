"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SoporteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const SoporteContext = createContext<SoporteContextValue | null>(null);

export function SoporteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SoporteContext.Provider
      value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}
    >
      {children}
    </SoporteContext.Provider>
  );
}

export function useSoporte(): SoporteContextValue {
  const ctx = useContext(SoporteContext);
  if (!ctx) throw new Error("useSoporte debe usarse dentro de SoporteProvider");
  return ctx;
}
