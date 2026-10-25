// TXT-12: las no respuestas de una pregunta abierta («No», «.», «Ninguno», «Nada»…) van aparte y al final de la lista
// de respuestas, como en la nube. El criterio es el del backend (`.txt_no_respuesta`, api/R/texto_abierto_normalizar.R),
// que `/sugerencias-seccion` ya devuelve por persona; aquí sólo se lleva a la respuesta única, sin repetir la regla.

import type { CodifSugerenciasSeccion, RespuestaUnica } from "../../api/codificacion";
import { normalizarTextoCodif } from "./sugerenciasModulo";

/** Claves (`texto_normalizado`) de las respuestas únicas que el backend marcó como no respuesta. */
export function clavesNoRespuesta(sug: CodifSugerenciasSeccion, respuestas: readonly RespuestaUnica[]): Set<string> {
  const porClave = new Set(respuestas.map((r) => r.texto_normalizado));
  const porUuid = new Map<string, string>();
  for (const r of respuestas) for (const u of r.uuids ?? []) porUuid.set(u, r.texto_normalizado);
  const no = new Set<string>();
  const con = new Set<string>();
  for (const fila of sug.respuestas) {
    const norm = normalizarTextoCodif(fila.texto);
    const clave = porClave.has(norm) ? norm : porUuid.get(fila.idCaso);
    if (!clave) continue;
    (fila.noRespuesta ? no : con).add(clave);
  }
  // Una respuesta única con alguna persona que sí dijo algo no se aparta.
  for (const c of con) no.delete(c);
  return no;
}

/** La lista con las no respuestas al final, en su propio tramo; cada tramo conserva su orden. */
export function separarNoRespuestas<T extends { texto_normalizado: string }>(
  respuestas: readonly T[],
  claves: ReadonlySet<string>,
): { conContenido: T[]; noRespuestas: T[] } {
  const conContenido: T[] = [];
  const noRespuestas: T[] = [];
  for (const r of respuestas) (claves.has(r.texto_normalizado) ? noRespuestas : conContenido).push(r);
  return { conContenido, noRespuestas };
}
