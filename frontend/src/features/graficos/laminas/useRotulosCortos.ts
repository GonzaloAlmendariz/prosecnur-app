// Los rótulos cortos del estudio (`plan.rotulos_cortos`, U3) para las listas de la tarjeta (U14; rotuloCortoDeLista.ts).

import { usePlanStore } from "../store";

export function useRotulosCortos(): Readonly<Record<string, string>> | undefined {
  return usePlanStore((s) => s.plan.rotulos_cortos);
}
