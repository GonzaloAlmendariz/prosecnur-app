// Los avisos del motor bajo "Efecto de ponderar", sin repetir las cifras que el
// panel ya muestra (plan 8.2: una cifra aparece una sola vez por pantalla).
//
// El motor arma dos avisos con el tamaño efectivo y el efecto de diseño
// escritos dentro (`.analitica_ponderacion_warnings`, ponderacion_analitica.R):
//  - `deff_medio` solo repite esas cifras: no se muestra; la celda del tamaño
//    efectivo ya se marca cuando la pérdida pasa del umbral.
//  - `deff_alto` trae además qué hacer: se conserva el consejo sin las cifras.
// Los demás avisos (categoría sin casos, no converge, pesos dispersos) pasan
// tal cual: dicen algo que la pantalla no muestra.

import type { PonderWarning } from "../../../api/analitica";

export const AVISO_DEFF_ALTO =
  "El efecto de diseño por ponderación es alto. Calibra con menos variables o revisa si la ponderación es necesaria.";

export function avisosDelEfecto(avisos: readonly PonderWarning[] | null | undefined): PonderWarning[] {
  return (avisos ?? []).flatMap((a): PonderWarning[] => {
    if (a.code === "deff_medio") return [];
    if (a.code === "deff_alto") return [{ ...a, message: AVISO_DEFF_ALTO }];
    return [a];
  });
}
