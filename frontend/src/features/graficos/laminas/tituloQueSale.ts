// El título con el que una lámina va a salir, como lo decide el motor: el escrito o, si no hay, el de la pregunta del
// gráfico (`tituloPorDefecto`). Una lámina sin ninguno devuelve "": la maqueta y la Estructura mostraban en su lugar el
// nombre del tipo («Un gráfico») como si fuera su título (recorrido de Arte y Diseño, 2026-10-13).
import type { Slide } from "../../../api/graficos";
import type { VarWithSource } from "../useVariables";
import { tituloDeLamina } from "../rotuloLamina";
import { leerSlideMeta } from "../slideMeta";
import { SLIDE_GRAF_SLOTS } from "../store";
import { tituloPorDefecto } from "./contenidoEspecial/modeloContenidoEspecial";
import { presentacionDeGrafico } from "./selectores/intencionesContar";

/**
 * Q2-7 (prueba con Arte): una lámina de resumen sin título no tiene pregunta de la que tomarlo (`vars` es `base$*`). En la
 * Estructura se nombra por su tarjeta («Panorama de públicos», «Cobertura y participación») o, si no la tiene, por su
 * antetítulo; nunca por una ref cruda. No es el título que sale: la maqueta sigue diciendo «Sin título». Antes que todo
 * eso, el nombre que el mazo guardó en `meta.nombre` (M2).
 */
export function nombreSinTitulo(slide: Slide): string {
  // M2: el nombre que el mazo le dio al insertarla («Escala bajo 60%») manda sobre el del tipo de su gráfico.
  const nombre = leerSlideMeta(slide).nombre;
  if (typeof nombre === "string" && nombre.trim()) return nombre.trim();
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  for (const slot of SLIDE_GRAF_SLOTS[slide.tipo] ?? []) {
    const g = payload[slot];
    if (!g || typeof g !== "object" || Array.isArray(g)) continue;
    const r = g as { graficador?: unknown; args?: unknown };
    if (typeof r.graficador !== "string") continue;
    const args = r.args && typeof r.args === "object" && !Array.isArray(r.args) ? (r.args as Record<string, unknown>) : {};
    const p = presentacionDeGrafico(r.graficador, args);
    if (p.clase === "resumen" && p.nombre) return p.nombre;
  }
  const ante = leerSlideMeta(slide).antetitulo;
  return typeof ante === "string" ? ante.trim() : "";
}

export function tituloQueSale(slide: Slide, variables: readonly VarWithSource[], tipoLabel: string): string {
  const escrito = tituloDeLamina(slide.payload);
  if (escrito) return escrito;
  const inferido = tituloPorDefecto(slide, variables, tipoLabel).placeholder;
  return inferido !== tipoLabel ? inferido : "";
}

/** Cómo se nombra la lámina en la Estructura: el título que sale o, sin él, su tarjeta o su antetítulo (Q2-7). */
export function nombreEnEstructura(slide: Slide, variables: readonly VarWithSource[], tipoLabel: string): string {
  return tituloQueSale(slide, variables, tipoLabel) || nombreSinTitulo(slide);
}
