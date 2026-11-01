// Lee el cronograma, la ventana de campo y la etapa del Planner (lectura pura).
// Vuelve a leer cuando cambia la revisión del Planner o la señal `recarga`.

import { useEffect, useState } from "react";

import { apiPlannerCalendario, type PlannerCalendario } from "../../../api/planner";

export function usePlannerCalendario(revision: number | undefined, recarga?: unknown) {
  const [cal, setCal] = useState<PlannerCalendario | null>(null);
  useEffect(() => {
    let vivo = true;
    apiPlannerCalendario().then((c) => { if (vivo) setCal(c); }).catch(() => { if (vivo) setCal(null); });
    return () => { vivo = false; };
  }, [recarga, revision]);
  return cal;
}
