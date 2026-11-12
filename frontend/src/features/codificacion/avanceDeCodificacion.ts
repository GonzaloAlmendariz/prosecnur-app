// El avance de la codificación de una pregunta, una sola definición para toda la sección (prototipo):
// "respuestas" son casos (personas que escribieron) y "textos distintos" son las respuestas únicas. Las dos
// cuentas salen de la lista que la base trae hoy, con las claves de los códigos alineadas como en el motor
// (`codificar/clavesDeGrupo.ts`): una clave guardada que la base ya no trae no cuenta.
//
// Las cifras del motor en la lista de preguntas (`n_codificadas`) cuentan también esas claves huérfanas y
// los textos dejados en "Otro"; no se usan para decir cuánto falta (pedido al motor).

import type { Grupo, RespuestaUnica } from "../../api/codificacion";
import { alinearClavesConRespuestas } from "./codificar/clavesDeGrupo";

export type AvanceDeCodificacion = {
  /** Respuestas (casos) con al menos un código. */
  casosConCodigo: number;
  /** Respuestas (casos) con texto. */
  casos: number;
  textosConCodigo: number;
  textos: number;
};

export const SIN_AVANCE: AvanceDeCodificacion = { casosConCodigo: 0, casos: 0, textosConCodigo: 0, textos: 0 };

export function avanceDeCodificacion(
  respuestas: readonly Pick<RespuestaUnica, "texto_normalizado" | "frecuencia">[],
  grupos: readonly Grupo[],
): AvanceDeCodificacion {
  const alineados = alinearClavesConRespuestas(grupos, respuestas);
  const conCodigo = new Set<string>();
  for (const g of alineados) for (const clave of g.respuestas) conCodigo.add(clave);
  const avance = { ...SIN_AVANCE };
  for (const r of respuestas) {
    const n = Number.isFinite(r.frecuencia) ? Math.max(0, Math.trunc(r.frecuencia)) : 0;
    avance.casos += n;
    avance.textos += 1;
    if (conCodigo.has(r.texto_normalizado)) {
      avance.casosConCodigo += n;
      avance.textosConCodigo += 1;
    }
  }
  return avance;
}

/** El porcentaje de respuestas con código, hacia abajo (99.6 no se lee como completa). */
export function porcentajeDeAvance(a: AvanceDeCodificacion): number {
  return a.casos > 0 ? Math.floor((a.casosConCodigo / a.casos) * 100) : 0;
}

/** El estado de la pregunta con los nombres del prototipo. */
export function estadoDeAvance(a: AvanceDeCodificacion): "codificada" | "en-curso" | "por-iniciar" {
  if (a.casos > 0 && a.casosConCodigo >= a.casos) return "codificada";
  return a.casosConCodigo > 0 ? "en-curso" : "por-iniciar";
}
