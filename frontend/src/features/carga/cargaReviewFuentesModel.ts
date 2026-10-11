/**
 * Carga › Revisión: qué dice cada fuente de una base que junta encuestas
 * (ADR 0094). Avisa lo que no entró o quedó vacío, informa lo que solo cambió
 * de orden y no bloquea: `fuentes` no entra en `ready`.
 */
import type {
  CargaReviewFuente,
  CargaReviewFuentes,
  CargaReviewPreguntaSinPar,
} from "../../api/client";
import { SM_ACCION_INSTRUMENTO_DISTINTO, smListaAcotada } from "./smEstructuraFuente";

export type CargaReviewHallazgoTono = "pending" | "info" | "incompatible";

export type CargaReviewHallazgoLinea = {
  texto: string;
  /** Lista completa cuando `texto` está acotado («+N»). */
  completo?: string;
};

export type CargaReviewHallazgoFuente = {
  key: string;
  tono: CargaReviewHallazgoTono;
  titulo: string;
  lineas: CargaReviewHallazgoLinea[];
};

/** Cuántos nombres se muestran antes del «+N». */
export const CARGA_REVIEW_NOMBRES_VISIBLES = 3;

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

function nombreFuente(fuente: CargaReviewFuente, index: number): string {
  return fuente.titulo || `Fuente ${index + 1}`;
}

function lineaDeNombres(
  preguntas: readonly CargaReviewPreguntaSinPar[],
  prefijo = "",
): CargaReviewHallazgoLinea {
  const nombres = preguntas.map((pregunta) => pregunta.etiqueta || pregunta.variable);
  const texto = `${prefijo}${smListaAcotada(nombres, CARGA_REVIEW_NOMBRES_VISIBLES)}`;
  return nombres.length > CARGA_REVIEW_NOMBRES_VISIBLES
    ? { texto, completo: `${prefijo}${nombres.join(", ")}` }
    : { texto };
}

function hallazgoDeFuente(fuente: CargaReviewFuente, index: number): CargaReviewHallazgoFuente | null {
  const nombre = nombreFuente(fuente, index);
  const key = fuente.survey_id || `fuente-${index}`;
  const nEmp = fuente.n_emparejadas;
  const nTotal = fuente.n_preguntas_base;
  const coinciden = nTotal > 0 ? `${nEmp} de ${nTotal} preguntas` : "";

  // Otro instrumento: el titular dice qué pasó con sus respuestas; el detalle,
  // por qué y qué hacer.
  if (fuente.instrumento_distinto || fuente.excluida) {
    const lineas: CargaReviewHallazgoLinea[] = [];
    const porque = coinciden ? `Solo coinciden ${coinciden} con la base.` : "Es otro instrumento.";
    const fuera = fuente.n_filas_excluidas > 0
      ? ` ${fuente.n_filas_excluidas} ${plural(fuente.n_filas_excluidas, "respuesta quedó fuera", "respuestas quedaron fuera")}.`
      : "";
    lineas.push({ texto: `${porque}${fuera}` });
    lineas.push({ texto: SM_ACCION_INSTRUMENTO_DISTINTO });
    return {
      key,
      tono: "incompatible",
      titulo: fuente.excluida ? `${nombre} · no entró a la base` : `${nombre} · es otro instrumento`,
      lineas,
    };
  }

  const nFuente = fuente.sin_par_fuente.length;
  const nBase = fuente.sin_par_base.length;
  const nAmbiguas = fuente.ambiguas.length;
  const nOpciones = fuente.n_opciones_sin_par;
  const titulo = coinciden ? `${nombre} · ${coinciden} emparejadas` : nombre;

  // Lo que se perdió o quedó vacío va en el detalle, una línea por cosa.
  if (nFuente || nBase || nAmbiguas || nOpciones || fuente.consentimiento_sin_par) {
    const lineas: CargaReviewHallazgoLinea[] = [];
    if (nFuente) lineas.push(lineaDeNombres(fuente.sin_par_fuente, "No entraron: "));
    if (nBase) lineas.push(lineaDeNombres(fuente.sin_par_base, "Sin respuesta en esta fuente: "));
    // Misma pregunta y escala repetidas un número distinto de veces: emparejar
    // por orden de aparición podría cruzarlas, así que quedan vacías.
    if (nAmbiguas) lineas.push(lineaDeNombres(fuente.ambiguas, "Ambiguas, sin emparejar: "));
    if (fuente.consentimiento_sin_par) {
      lineas.push({ texto: "Su pregunta de consentimiento no calza con la de la base: sus respuestas completas entraron." });
    }
    if (nOpciones) {
      lineas.push({
        texto: `${nOpciones} ${plural(nOpciones, "respuesta quedó vacía", "respuestas quedaron vacías")} por una opción que no existe en la lista.`,
      });
    }
    return { key, tono: "pending", titulo, lineas };
  }

  if (fuente.reordenada) {
    return { key, tono: "info", titulo: `${titulo}, en otro orden`, lineas: [] };
  }

  return null;
}

const ORDEN_TONO: Record<CargaReviewHallazgoTono, number> = {
  incompatible: 0,
  pending: 1,
  info: 2,
};

/** Un hallazgo por fuente que tiene algo que decir; lo grave primero. */
export function cargaReviewFuentesHallazgos(
  fuentes: CargaReviewFuentes | null | undefined,
): CargaReviewHallazgoFuente[] {
  return (fuentes?.fuentes ?? [])
    .map((fuente, index) => ({ hallazgo: hallazgoDeFuente(fuente, index), index }))
    .filter((entry): entry is { hallazgo: CargaReviewHallazgoFuente; index: number } => entry.hallazgo !== null)
    .sort((a, b) => ORDEN_TONO[a.hallazgo.tono] - ORDEN_TONO[b.hallazgo.tono] || a.index - b.index)
    .map((entry) => entry.hallazgo);
}
