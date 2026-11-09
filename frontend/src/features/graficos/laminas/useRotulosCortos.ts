// Los rótulos cortos de las respuestas (`plan.rotulos_cortos`, U3) para las listas de la tarjeta (U14; rotuloCortoDeLista.ts).
// Sólo el mapa de opciones: la clave reservada `preguntas` (ADR 0141) no es un rótulo de respuesta.

import { useMemo } from "react";
import { opcionesDeRotulos } from "../../../api/graficosRotulosPlan";
import { usePlanStore } from "../store";

export function useRotulosCortos(): Readonly<Record<string, string>> | undefined {
  const rc = usePlanStore((s) => s.plan.rotulos_cortos);
  return useMemo(() => (rc ? opcionesDeRotulos(rc) : undefined), [rc]);
}
