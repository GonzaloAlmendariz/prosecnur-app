// El modo que el tipo del estudio fija en cada módulo (ADR 0124). Lo consumen
// Cálculo de muestra y Monitoreo en vez de preguntar el tipo de estudio. `null`
// mientras carga. Se relee cuando la Ficha del estudio declara algo.

import { useCallback, useEffect, useState } from "react";

import { apiPlannerModos, type PlannerModos } from "../../api/planner";
import { EVENTO_ESTUDIO_DECLARADO } from "./useEstudioDeclarado";

export function usePlannerModos(): { modos: PlannerModos | null; error: string | null; recargar: () => Promise<void> } {
  const [modos, setModos] = useState<PlannerModos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    try {
      setModos(await apiPlannerModos());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/ · E_[A-Z0-9_]+$/, "") : "No se pudo leer el tipo del estudio.");
    }
  }, []);
  useEffect(() => {
    void recargar();
    const alDeclarar = () => void recargar();
    window.addEventListener(EVENTO_ESTUDIO_DECLARADO, alDeclarar);
    return () => window.removeEventListener(EVENTO_ESTUDIO_DECLARADO, alDeclarar);
  }, [recargar]);
  return { modos, error, recargar };
}
