/**
 * La etiqueta tolerante: la única normalización con que los editores de carga
 * comparan dos rótulos de respuesta —la firma de una escala compartida, el
 * «Emparejar por etiqueta» de la armonización de una fila y el de un segmento
 * de cruce—.
 *
 * Ignora lo que no cambia el significado: minúsculas, tildes, marcado Kobo
 * (`*cursiva*`, `**negrita**`), comillas, comas, puntos finales y espacios.
 * «No sé / Prefiero no decir» y «No se, prefiero no decir» son la misma.
 *
 * Conserva lo que sí lo cambia, porque emparejar por etiqueta recodifica:
 * - `<`, `>`, `≤`, `≥` (`<=` y `>=` se leen como `≤` y `≥`), `+` y `%`:
 *   «<18», «>18», «+18» y «18» son cuatro categorías; «A+» no es «A».
 * - El signo menos (guion, raya o «−») pegado antes de un dígito sin un dígito
 *   delante («-1» no es «1») o pegado detrás de una letra o un dígito sin nada
 *   alfanumérico detrás («A-» no es «A»).
 * - Entre dos números, la barra es una fracción y el guion o la raya un rango:
 *   «1/2» no es «1-2», pero «18–20 años» y «18-20 años» sí son la misma.
 *
 * Vive aparte de `escalaCompartidaModel` (que la reexporta) para que
 * `armonizacionModel` la use sin cerrar un ciclo de imports.
 */

import { sinEnfasis } from "../../lib/enfasisTexto";

// Marcadores de uso privado: sobreviven a la limpieza de puntuación.
const RANGO = "\uE000";
const MENOS = "\uE001";
const FRACCION = "\uE002";
const GUIONES = "\\-\u2010\u2011\u2012\u2013\u2014\u2015\u2212";

const RE_FRACCION = /(\p{N})\s*\/\s*(?=\p{N})/gu;
const RE_RANGO = new RegExp(`(\\p{N})\\s*[${GUIONES}]\\s*(?=\\p{N})`, "gu");
const RE_MENOS_PREFIJO = new RegExp(`(^|[^\\p{L}\\p{N}])[${GUIONES}](?=\\p{N})`, "gu");
const RE_MENOS_SUFIJO = new RegExp(`([\\p{L}\\p{N}])[${GUIONES}](?![\\p{L}\\p{N}])`, "gu");
const RE_RESTO = /[^\p{L}\p{N}<>≤≥+%\uE000-\uE002]+/gu;
const RE_SIGNO = /([<>≤≥+%\uE000-\uE002])/gu;

/** «¿Dos a tres veces?» y «dos a tres veces» son la misma etiqueta; «<18» y «18», no. */
export function etiquetaTolerante(s: string | null | undefined): string {
  return sinEnfasis(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/<\s*=|=\s*</g, "≤")
    .replace(/>\s*=|=\s*>/g, "≥")
    .replace(RE_FRACCION, `$1${FRACCION}`)
    .replace(RE_RANGO, `$1${RANGO}`)
    .replace(RE_MENOS_PREFIJO, `$1${MENOS}`)
    .replace(RE_MENOS_SUFIJO, `$1${MENOS}`)
    .replace(RE_RESTO, " ")
    .replace(RE_SIGNO, " $1 ")
    .replace(/\s+/g, " ")
    .trim()
    .replaceAll(RANGO, "-")
    .replaceAll(MENOS, "−")
    .replaceAll(FRACCION, "/");
}

/**
 * Etiquetas tolerantes que, en una misma lista, comparten dos o más códigos
 * distintos. Emparejar por cualquiera de ellas sería elegir al azar: ni en el
 * origen ni en el destino se empareja por ellas.
 */
export function etiquetasAmbiguas(
  categorias: readonly { codigo: string; etiqueta: string | null | undefined }[],
): Set<string> {
  const vistos = new Map<string, string>();
  const ambiguas = new Set<string>();
  for (const c of categorias) {
    const clave = etiquetaTolerante(c.etiqueta);
    const codigo = c.codigo.trim();
    if (!clave || !codigo) continue;
    const previo = vistos.get(clave);
    if (previo === undefined) vistos.set(clave, codigo);
    else if (previo !== codigo) ambiguas.add(clave);
  }
  return ambiguas;
}

/**
 * Etiqueta tolerante → código, para emparejar por etiqueta. Quedan fuera las
 * categorías sin etiqueta y las que, tolerantes, dicen lo mismo que otra con
 * otro código: ahí emparejar sería elegir al azar.
 */
export function indicePorEtiqueta(
  categorias: readonly { codigo: string; etiqueta: string | null | undefined }[],
): Map<string, string> {
  const ambiguas = etiquetasAmbiguas(categorias);
  const out = new Map<string, string>();
  for (const c of categorias) {
    const clave = etiquetaTolerante(c.etiqueta);
    const codigo = c.codigo.trim();
    if (!clave || !codigo || ambiguas.has(clave) || out.has(clave)) continue;
    out.set(clave, codigo);
  }
  return out;
}
