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

  if (fuente.instrumento_distinto) {
    const coincidencia = fuente.n_preguntas_base > 0
      ? `solo ${fuente.n_emparejadas} de ${fuente.n_preguntas_base} preguntas coinciden con la base`
      : "es otro instrumento";
    return {
      key,
      tono: "incompatible",
      titulo: `${nombre} · ${coincidencia}`,
      lineas: [{ texto: SM_ACCION_INSTRUMENTO_DISTINTO }],
    };
  }

  const nFuente = fuente.sin_par_fuente.length;
  const nBase = fuente.sin_par_base.length;
  const nOpciones = fuente.n_opciones_sin_par;

  if (nFuente || nBase || nOpciones) {
    const fraseFuente = `${nFuente} ${plural(nFuente, "pregunta no está", "preguntas no están")} en la base y no ${plural(nFuente, "entró", "entraron")}`;
    const fraseBase = `${nBase} ${plural(nBase, "pregunta de la base queda vacía", "preguntas de la base quedan vacías")} para sus respuestas`;
    const fraseOpciones = `${nOpciones} ${plural(
      nOpciones,
      "respuesta con una opción que no existe en la lista quedó vacía",
      "respuestas con una opción que no existe en la lista quedaron vacías",
    )}`;
    const titulo = nFuente && nBase
      ? `${fraseFuente}, y ${fraseBase}`
      : nFuente
        ? fraseFuente
        : nBase
          ? fraseBase
          : fraseOpciones;
    const lineas: CargaReviewHallazgoLinea[] = [];
    // Con las dos listas a la vista, cada una dice cuál es; con una sola, el
    // título ya lo dijo.
    if (nFuente) lineas.push(lineaDeNombres(fuente.sin_par_fuente, nBase ? "No entraron: " : ""));
    if (nBase) lineas.push(lineaDeNombres(fuente.sin_par_base, nFuente ? `${plural(nBase, "Vacía", "Vacías")}: ` : ""));
    if ((nFuente || nBase) && nOpciones) lineas.push({ texto: `${fraseOpciones}.` });
    return { key, tono: "pending", titulo: `${nombre} · ${titulo}`, lineas };
  }

  if (fuente.reordenada) {
    const n = fuente.n_emparejadas;
    return {
      key,
      tono: "info",
      titulo: `${nombre} · ${n} ${plural(n, "pregunta emparejada", "preguntas emparejadas")} por pregunta, en otro orden`,
      lineas: [],
    };
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
