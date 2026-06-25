"use client";

import { useEffect, useRef } from "react";

interface UseBlockNavigationArgs {
  enabled: boolean;
  // Devuelve true para permitir la navegación, false para bloquearla.
  // El callback recibe el href destino y debe orquestar UI (modal).
  onIntent: (href: string) => boolean;
}

// Intercepta clicks en <a> internos para mostrar el modal "guarda o pierdes".
// También controla beforeunload (recarga/cierre de pestaña).
export function useBlockNavigation({ enabled, onIntent }: UseBlockNavigationArgs): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!enabledRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.target === "_blank") return;
      if (anchor.hasAttribute("data-bypass-block")) return;

      const allow = onIntent(href);
      if (!allow) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!enabledRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [onIntent]);
}
