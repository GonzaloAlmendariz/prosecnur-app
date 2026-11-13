// El avance de la codificación de una pregunta, una sola definición para toda la sección (prototipo):
// "respuestas" son casos (personas que escribieron) y "textos distintos" son las respuestas únicas. Las dos
// cuentas salen de la lista que la base trae hoy, con las claves de los códigos alineadas como en el motor
// (`codificar/clavesDeGrupo.ts`): una clave guardada que la base ya no trae no cuenta.
//
// Las cifras del motor en la lista de preguntas (`n_codificadas`) cuentan también esas claves huérfanas y
// los textos dejados en "Otro"; no se usan para decir cuánto falta (pedido al motor).

import type { Grupo, RespuestaUnica } from "../../api/codificacion";
import { formatoConteo } from "../../lib/formatoNumero";
import { alinearClavesConRespuestas } from "./codificar/clavesDeGrupo";
import type { CifraDeCasos } from "./codificar/modeloDeCodificar";

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

/**
 * Las dos cifras de la barra de avance de una pregunta, cada una con su base: las respuestas (personas
 * que escribieron) y los textos distintos (lo escrito, sin repetir). La barra dibuja la primera.
 */
export function cifrasDelAvance(a: AvanceDeCodificacion): CifraDeCasos[] {
  return [
    {
      id: "respuestas",
      valor: a.casosConCodigo,
      de: a.casos,
      singular: "respuesta con código",
      plural: "respuestas con código",
      detalle: "Personas que escribieron algo en la pregunta y tienen al menos un código",
    },
    {
      id: "textos",
      valor: a.textosConCodigo,
      de: a.textos,
      singular: "texto distinto con código",
      plural: "textos distintos con código",
      detalle: "Lo escrito sin repetir: varias personas que escriben lo mismo cuentan un solo texto",
    },
  ];
}

/** Lo que dice el porcentaje de la fila de una pregunta: sus respuestas con código sobre sus respuestas. */
export function detalleDelPorcentaje(a: AvanceDeCodificacion): string {
  if (a.casos === 0) return "Sin respuestas";
  return `${formatoConteo(a.casosConCodigo)} de ${formatoConteo(a.casos)} ${a.casos === 1 ? "respuesta" : "respuestas"} con código`;
}
