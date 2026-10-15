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

/**
 * R6: el «Nombre de cada público» de la tarjeta (`tabla_encabezados`, líneas `clave=Título`) dicho como excepción:
 * «Profesores» en vez de «docentes». Sin nombres propios (o iguales al de la base), `null`.
 */
export function nombresPropiosDeBase(args: Record<string, unknown>, parse: (v: unknown) => Record<string, string>): string | null {
  const ov = args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {};
  const nombres = parse(args.tabla_encabezados ?? ov.tabla_encabezados);
  const partes = Object.entries(nombres)
    .filter(([clave, titulo]) => titulo && titulo.toLowerCase() !== clave.replace(/_+/g, " ").toLowerCase())
    .map(([clave, titulo]) => `«${titulo}» en vez de «${clave.replace(/_+/g, " ")}»`);
  return partes.length ? partes.join(", ") : null;
}
