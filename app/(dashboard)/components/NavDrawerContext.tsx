"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

interface NavDrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const NavDrawerContext = createContext<NavDrawerContextValue | null>(null);

export function NavDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Cierra el drawer al navegar
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Cierra el drawer al pasar a desktop para limpiar el overlay de shadcn
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setIsOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return (
    <NavDrawerContext.Provider value={value}>
      {children}
    </NavDrawerContext.Provider>
  );
}

export function useNavDrawer() {
  const ctx = useContext(NavDrawerContext);
  if (!ctx) {
    throw new Error("useNavDrawer debe usarse dentro de <NavDrawerProvider>");
  }
  return ctx;
}
