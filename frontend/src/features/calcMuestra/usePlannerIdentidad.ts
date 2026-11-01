import { useEffect, useState } from "react";

import { apiPlannerEstado } from "../../api/planner";

/**
 * La identidad del estudio (nombre y cliente) la declara el Planner (ADR 0122):
 * Cálculo de muestra la lee y no la escribe. `null` mientras carga o si el
 * Planner no se pudo leer; el que la pinta dice «sin título».
 */
export type IdentidadDelEstudio = { nombre: string; cliente: string };

export const RUTA_IDENTIDAD_DEL_PLANNER = "/planner?seccion=estudio&pestana=identidad";

export function usePlannerIdentidad(): IdentidadDelEstudio | null {
  const [identidad, setIdentidad] = useState<IdentidadDelEstudio | null>(null);
  useEffect(() => {
    let vivo = true;
    apiPlannerEstado()
      .then((e) => { if (vivo) setIdentidad({ nombre: e.planner.estudio.nombre, cliente: e.planner.estudio.cliente }); })
      .catch(() => { if (vivo) setIdentidad(null); });
    return () => { vivo = false; };
  }, []);
  return identidad;
}
