// Un índice sin capítulos no se exporta (Gonzalo, 2026-10-13: «no se puede exportar si no está definido… se debe avisar
// e impedir su exportación»). Sin capítulos propios ni separadores de capítulo en el informe, el motor no tiene qué
// listar y caía a la plantilla antigua con capítulos de ejemplo. Espejo de `.plan_errores_indice`
// (api/R/graficos_plan_requisitos.R), que rechaza el mismo plan en la exportación.

import type { Slide } from "../../../api/graficos";
import { rotuloLamina } from "../rotuloLamina";
import { leerSlideMeta } from "../slideMeta";
import { leerIndice } from "./modeloIndice";

/** Separadores de capítulo (no de subcapítulo) con título: los capítulos que el índice toma del informe. */
export function capitulosDelInforme(slides: readonly Pick<Slide, "tipo" | "payload">[]): string[] {
  return slides
    .filter((s) => s.tipo === "p_slide_seccion" && leerSlideMeta(s).nivel !== "subcapitulo")
    .map((s) => (typeof s.payload?.titulo === "string" ? s.payload.titulo.trim() : ""))
    .filter(Boolean);
}

export type IndiceSinCapitulos = { slideId: string; message: string };

export function indicesSinCapitulos(slides: readonly Slide[]): IndiceSinCapitulos[] {
  if (capitulosDelInforme(slides).length) return [];
  return slides.flatMap((slide, i) => {
    if (slide.tipo !== "p_slide_indice") return [];
    if (leerIndice(slide.payload).capitulos.some((c) => c.titulo.trim())) return [];
    return [{
      slideId: slide.id,
      message: `${rotuloLamina(slide, i)} (Índice): no tiene capítulos y el informe no tiene separadores de capítulo. Escribe sus capítulos en el índice o agrega separadores al informe.`,
    }];
  });
}
