/**
 * La etiqueta tolerante: la única normalización con que los editores de carga
 * comparan dos rótulos de respuesta —la firma de una escala compartida, el
 * «Emparejar por etiqueta» de la armonización de una fila y el de un segmento
 * de cruce—.
 *
 * Minúsculas, sin tildes, sin marcado Kobo (`*cursiva*`, `**negrita**`), sin
 * puntuación —rayas y guiones incluidos: «18–20 años» y «18-20 años» son la
 * misma— y espacios colapsados.
 *
 * Vive aparte de `escalaCompartidaModel` (que la reexporta) para que
 * `armonizacionModel` la use sin cerrar un ciclo de imports.
 */

import { sinEnfasis } from "../../lib/enfasisTexto";

/** «¿Dos a tres veces?» y «dos a tres veces» son la misma etiqueta. */
export function etiquetaTolerante(s: string | null | undefined): string {
  return sinEnfasis(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Etiqueta tolerante → código, para emparejar por etiqueta. Quedan fuera las
 * categorías sin etiqueta y las que, tolerantes, dicen lo mismo que otra con
 * otro código: ahí emparejar sería elegir al azar.
 */
export function indicePorEtiqueta(
  categorias: readonly { codigo: string; etiqueta: string | null | undefined }[],
): Map<string, string> {
  const out = new Map<string, string>();
  const ambiguas = new Set<string>();
  for (const c of categorias) {
    const clave = etiquetaTolerante(c.etiqueta);
    const codigo = c.codigo.trim();
    if (!clave || !codigo) continue;
    const previo = out.get(clave);
    if (previo !== undefined && previo !== codigo) ambiguas.add(clave);
    else out.set(clave, codigo);
  }
  for (const clave of ambiguas) out.delete(clave);
  return out;
}
