// Cómo se nombra una lámina en un aviso de Gráficos: «Lámina 3 · “Satisfacción con el curso”», o «Lámina 3» si no tiene
// título. Es el mismo rótulo que arma el backend (`.aviso_lamina` en api/R/graficos_avisos_texto.R), para que un aviso
// del validador del plan y uno del motor hablen igual de la misma lámina. El número es la posición visible en el plan
// (1, 2, 3…), nunca el id interno: el id viaja aparte (`slideId`) para «Ir a la lámina».

import type { Slide } from "../../api/graficos";
import { SLIDE_LABELS } from "./store";

/** Título declarado en el payload de la lámina, sin el «(cont.)» de las partes; "" si no tiene. */
export function tituloDeLamina(payload: Slide["payload"] | null | undefined): string {
  let t: unknown = payload?.titulo;
  if (t && typeof t === "object" && !Array.isArray(t)) t = (t as Record<string, unknown>).text;
  if (typeof t !== "string") return "";
  return t.trim().replace(/\s*\((cont|CONT)\.\)\s*$/, "");
}

/** «Lámina N · “título”» o «Lámina N»; `indice` es la posición base 0 de la lámina en el plan. */
export function rotuloLamina(slide: Pick<Slide, "payload">, indice: number): string {
  const n = indice + 1;
  const titulo = tituloDeLamina(slide.payload);
  return titulo ? `Lámina ${n} · “${titulo}”` : `Lámina ${n}`;
}

/** Nombre visible del tipo de lámina, como lo muestra el selector («Objetivo con ícono»), nunca `p_slide_*`. */
export function nombreTipoLamina(tipo: string, respaldo?: string): string {
  const nombre = (SLIDE_LABELS as Record<string, string | undefined>)[tipo] ?? respaldo;
  return nombre && nombre.trim() ? nombre : "un tipo de lámina que esta versión no reconoce";
}
