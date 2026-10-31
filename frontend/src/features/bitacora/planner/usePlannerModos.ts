// El modo que el Planner fija en cada módulo (ADR 0122 §4). Lo consumen, en la
// fase P2, Cálculo de muestra, Material de campo, Monitoreo y Hojas de ruta en
// vez de preguntar el tipo de estudio. `null` mientras carga.

import { useCallback, useEffect, useState } from "react";

import { apiPlannerModos, type PlannerModos } from "../../../api/planner";

export function usePlannerModos(): { modos: PlannerModos | null; error: string | null; recargar: () => Promise<void> } {
  const [modos, setModos] = useState<PlannerModos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    try {
      setModos(await apiPlannerModos());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/ · E_[A-Z0-9_]+$/, "") : "No se pudo leer el Planner.");
    }
  }, []);
  useEffect(() => {
    void recargar();
  }, [recargar]);
  return { modos, error, recargar };
}
