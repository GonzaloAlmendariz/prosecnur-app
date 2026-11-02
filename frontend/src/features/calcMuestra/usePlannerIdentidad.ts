import { useEffect, useState } from "react";

import { apiPlannerEstado } from "../../api/planner";
import { EVENTO_ESTUDIO_DECLARADO } from "../estudio/useEstudioDeclarado";

/**
 * La identidad del estudio (nombre y cliente) se declara en la Ficha del estudio (ADR 0124):
 * Cálculo de muestra la lee y no la escribe. `null` mientras carga o si la
 * ficha no se pudo leer; el que la pinta dice «sin título».
 */
export type IdentidadDelEstudio = { nombre: string; cliente: string };

export function usePlannerIdentidad(): IdentidadDelEstudio | null {
  const [identidad, setIdentidad] = useState<IdentidadDelEstudio | null>(null);
  useEffect(() => {
    let vivo = true;
    const leer = () => apiPlannerEstado()
      .then((e) => { if (vivo) setIdentidad({ nombre: e.planner.estudio.nombre, cliente: e.planner.estudio.cliente }); })
      .catch(() => { if (vivo) setIdentidad(null); });
    void leer();
    window.addEventListener(EVENTO_ESTUDIO_DECLARADO, leer);
    return () => { vivo = false; window.removeEventListener(EVENTO_ESTUDIO_DECLARADO, leer); };
  }, []);
  return identidad;
}
