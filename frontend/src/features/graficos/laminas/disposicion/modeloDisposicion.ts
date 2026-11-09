// La disposición de una lámina (ítem 1 del checklist del catálogo): la de cinco gráficos va en «3+2» o «2+3», a
// elección del analista; nada la decide solo. Los valores y el de por defecto salen del catálogo (`disposiciones` de
// graficos_tipos.json → DISPOSICIONES_LAMINA) y la elección se guarda en `meta.disposicion`, que el motor lee
// (`.slide_disposicion_5`). Pura.

import type { Slide } from "../../../../api/graficos";
import { RANURAS_GRAFICO_POR_LAMINA } from "../../catalogoGraficos";
import { DISPOSICIONES_LAMINA, type DisposicionCatalogo } from "../../iconos/catalogoTipos.generated";
import { composicionDe } from "../../iconos/composicion";
import { lugaresPorPosicion } from "../../iconos/disposicionRanuras";
import { conSlideMeta, leerSlideMeta, type SlideMeta } from "../../slideMeta";

type LaminaLeida = Pick<Slide, "tipo" | "payload">;

/** La disposición que se elige en `tipo`, o `null` si el tipo no tiene. */
export function disposicionesDe(tipo: string): DisposicionCatalogo | null {
  return DISPOSICIONES_LAMINA[tipo] ?? null;
}

/**
 * La disposición vigente de la lámina, como la lee el motor: el argumento del constructor si viene, si no la de su
 * `meta`; un valor fuera del catálogo o ausente es la de por defecto. `null` si el tipo no tiene disposición.
 */
export function disposicionDe(slide: LaminaLeida): string | null {
  const d = disposicionesDe(slide.tipo);
  if (!d) return null;
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  const meta = leerSlideMeta(slide) as Record<string, unknown>;
  const elegida = [payload[d.arg], meta[d.arg]].find((v): v is string => typeof v === "string" && v.trim() !== "");
  return elegida && d.valores.some((v) => v.value === elegida.trim()) ? elegida.trim() : d.default;
}

/**
 * El cambio de payload que guarda `valor` en la meta de la lámina. Si el plan traía el argumento suelto en el payload, se
 * borra: el motor le da precedencia y la elección no llegaría.
 */
export function cambioDeDisposicion(slide: LaminaLeida, valor: string): Record<string, unknown> {
  const d = disposicionesDe(slide.tipo);
  if (!d || !d.valores.some((v) => v.value === valor)) return {};
  const cambio: Record<string, unknown> = { meta: conSlideMeta(slide, { [d.arg]: valor } as Partial<SlideMeta>).payload.meta };
  if (d.arg in ((slide.payload ?? {}) as Record<string, unknown>)) cambio[d.arg] = undefined;
  return cambio;
}

/**
 * El lugar de `slot` en la lámina cuando su disposición no es la de por defecto («Superior derecha» con «2+3» es la
 * segunda ranura, no la tercera). Con la de por defecto, `null`: manda el rótulo del catálogo (`ranuras[].label`).
 */
export function lugarDispuesto(slide: LaminaLeida | undefined, slot: string): string | null {
  if (!slide) return null;
  const d = disposicionesDe(slide.tipo);
  const disposicion = disposicionDe(slide);
  if (!d || !disposicion || disposicion === d.default) return null;
  const graficos = composicionDe(slide.tipo, RANURAS_GRAFICO_POR_LAMINA[slide.tipo] ?? [], disposicion).ranuras.filter((r) => r.tipo === "grafico");
  const i = graficos.findIndex((r) => r.slot === slot);
  if (i < 0) return null;
  return lugaresPorPosicion(graficos)[i] || null;
}

/**
 * Ronda 19 (F4): el lugar de `slot` por la geometría de la lámina, con cualquier disposición, cuando la lámina tiene dos
 * o más gráficos («Izquierda» / «Derecha» en «Dos gráficos + texto», que van lado a lado; un plan o registro viejo aún
 * los rotula por número o por otro lugar). `null` con un solo gráfico o sin geometría del estándar: manda el rótulo del catálogo.
 */
export function lugarEnLamina(slide: LaminaLeida | undefined, slot: string): string | null {
  if (!slide) return null;
  const graficos = composicionDe(slide.tipo, RANURAS_GRAFICO_POR_LAMINA[slide.tipo] ?? [], disposicionDe(slide))
    .ranuras.filter((r) => r.tipo === "grafico");
  if (graficos.length < 2) return null;
  const i = graficos.findIndex((r) => r.slot === slot);
  if (i < 0) return null;
  return lugaresPorPosicion(graficos)[i] || null;
}

const RAICES_LUGAR = ["superior", "inferior", "central", "izquierd", "derech", "centro"] as const;
const raices = (texto: string): Set<string> => {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return new Set(RAICES_LUGAR.filter((r) => t.includes(r)));
};

/**
 * El nombre de la ranura (ronda 19, F4): el rótulo del catálogo si describe el lugar que la ranura ocupa («Gráfico
 * izquierdo» en la izquierda); si no lo describe o dice otro lugar («Gráfico 2» lado a lado, «Superior derecha» que con
 * «2+3» baja), el lugar por la geometría. Sin lugar (un solo gráfico), el rótulo.
 */
export function rotuloDeRanura(slide: LaminaLeida | undefined, slot: string, rotuloCatalogo: string): string {
  const lugar = lugarEnLamina(slide, slot);
  if (!lugar) return rotuloCatalogo;
  const delLugar = raices(lugar);
  const delRotulo = raices(rotuloCatalogo);
  const coincide = delRotulo.size === delLugar.size && [...delLugar].every((r) => delRotulo.has(r));
  return coincide && rotuloCatalogo.trim() ? rotuloCatalogo : lugar;
}
