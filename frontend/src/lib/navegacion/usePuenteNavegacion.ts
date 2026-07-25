// Instala `window.__pulsoNav` mientras la app está montada.
//
// Solo en dev y bajo QA visual: en producción la app no expone su navegación
// como API. El gate es el mismo que ya usa el deep-link `?pulso=`, así que no
// introduce una superficie nueva que auditar.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { instalarPuenteNavegacion } from "./runtime";

function puenteHabilitado(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  // `?qaWarmup=skip` es la marca que ya usan los runners de QA visual.
  return new URLSearchParams(window.location.search).get("qaWarmup") === "skip";
}

export function usePuenteNavegacion(): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (!puenteHabilitado()) return undefined;
    return instalarPuenteNavegacion((href) => navigate(href));
  }, [navigate]);
}
