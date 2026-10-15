// Los gráficos del plan que tienen su propia regla (R5 del rediseño, 2026-10-15; sirve también a R4 y R6). Puro: recorre
// las láminas y, en cada ranura con gráfico, pregunta a `leer` si ese gráfico se aparta de la regla del informe y cómo
// se dice su excepción («Siempre», «Un decimal»…). La lista la pinta `ExcepcionesRegla`.

import type { Slide } from "../../../api/graficos";
import { SLIDE_GRAF_SLOTS } from "../store";

export type Excepcion = { slideId: string; posicion: number; slot: string; titulo: string; valor: string };
type Ref = { graficador?: unknown; args?: unknown };

export function excepcionesDelPlan(
  slides: readonly Slide[],
  leer: (graficador: string, args: Record<string, unknown>) => string | null,
  titulo: (slide: Slide) => string,
): Excepcion[] {
  const out: Excepcion[] = [];
  slides.forEach((slide, i) => {
    const payload = (slide.payload ?? {}) as Record<string, unknown>;
    for (const slot of SLIDE_GRAF_SLOTS[slide.tipo] ?? []) {
      const ref = payload[slot] as Ref | undefined;
      if (!ref || typeof ref.graficador !== "string") continue;
      const args = ref.args && typeof ref.args === "object" ? (ref.args as Record<string, unknown>) : {};
      const valor = leer(ref.graficador, args);
      if (valor) out.push({ slideId: slide.id, posicion: i + 1, slot, titulo: titulo(slide), valor });
    }
  });
  return out;
}
