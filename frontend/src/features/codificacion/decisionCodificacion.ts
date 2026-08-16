// =============================================================================
// decisionCodificacion — cómo se ve cada estado del ADR 0078
// =============================================================================
// Cuatro situaciones compartían apariencia en la lista de preguntas: marcada
// sin respuestas, marcada con respuestas y sin categorías, catálogo a medias, y
// la decisión de no categorizar —que directamente no se podía expresar—. La
// lista promete decir en qué estado está cada pregunta y no podía cumplirlo:
// es un caso de C5 del Contrato de Superficie.
//
// Este módulo es sólo la traducción a interfaz. Quién está en qué estado lo
// decide el backend (`codificacion_decisiones.R`), y de ahí viene `decision`.
// =============================================================================

import type { CodifDecision, PreguntaAbierta } from "../../api/codificacion";

export type DecisionTono = "abierto" | "cerrado" | "neutro";

export type DecisionPresentacion = {
  /** Etiqueta del chip. Corta: la fila ya lleva tipo, conteos y preview. */
  etiqueta: string;
  tono: DecisionTono;
  /** Deja trabajo por hacer — es lo que cuenta el número accionable. */
  abierta: boolean;
  /** Frase para el `title`; dice qué falta, no parafrasea la etiqueta. */
  detalle: string;
};

const PRESENTACION: Record<CodifDecision, DecisionPresentacion> = {
  categorizada: {
    etiqueta: "Categorizada",
    tono: "cerrado",
    abierta: false,
    detalle: "Todas sus respuestas tienen destino.",
  },
  no_categorizar: {
    etiqueta: "No se categoriza",
    tono: "cerrado",
    abierta: false,
    detalle: "Decisión registrada con su motivo.",
  },
  sin_material: {
    etiqueta: "Sin respuestas",
    tono: "neutro",
    abierta: false,
    detalle: "No hay nada que codificar: se cierra sola.",
  },
  sin_marcar: {
    etiqueta: "",
    tono: "neutro",
    abierta: false,
    detalle: "",
  },
  pendiente: {
    etiqueta: "Sin categorías",
    tono: "abierto",
    abierta: true,
    detalle: "Está marcada y todavía no tiene categorías.",
  },
  pendiente_parcial: {
    etiqueta: "A medias",
    tono: "abierto",
    abierta: true,
    detalle: "Tiene catálogo, pero le quedan respuestas sin asignar.",
  },
  requiere_config: {
    etiqueta: "Falta declarar el modo",
    tono: "abierto",
    abierta: true,
    detalle: "Hasta que se declare si es padre o hija no se puede codificar.",
  },
};

/**
 * La presentación de una pregunta, o `null` cuando no hay nada que declarar
 * (`sin_marcar`: nadie pidió codificarla, así que no tiene estado que mostrar).
 */
export function presentarDecision(
  decision: CodifDecision | undefined,
): DecisionPresentacion | null {
  if (!decision || decision === "sin_marcar") return null;
  return PRESENTACION[decision] ?? null;
}

/**
 * El estado de una pregunta cuando el backend todavía no manda `decision`
 * —un `.pulso` abierto contra una versión anterior—. Se deriva de lo mismo que
 * el backend usa, para que la lista no quede muda mientras tanto.
 */
export function decisionDePregunta(p: PreguntaAbierta): CodifDecision {
  if (p.decision) return p.decision;
  if (p.no_categorizar?.motivo) return "no_categorizar";
  if (!p.marcada || p.status === "no-aplica") return "sin_marcar";
  switch (p.status) {
    case "completo":
      return "categorizada";
    case "sin-datos":
      return "sin_material";
    case "en-curso":
      return "pendiente_parcial";
    case "requiere-config":
      return "requiere_config";
    default:
      return "pendiente";
  }
}

/**
 * Lo que le falta a una pregunta abierta, en respuestas únicas. El chip dice
 * «A medias» y el motor sabe que son 27 de 75: sin el número, una pregunta a
 * la que le queda una respuesta se ve igual que una en la que casi no se
 * empezó, y la lista es justo donde se decide qué atender primero.
 *
 * Devuelve `null` cuando no hay nada que contar —una decisión cerrada, o un
 * conteo que no cuadra—: un «0 sin asignar» junto a «A medias» sería peor que
 * no decir nada.
 */
export function restanteDeDecision(p: PreguntaAbierta): string | null {
  const decision = decisionDePregunta(p);
  if (decision !== "pendiente" && decision !== "pendiente_parcial") return null;
  const unicas = Math.max(0, Math.trunc(p.n_unicas ?? 0));
  const hechas = Math.max(0, Math.trunc(p.n_codificadas ?? 0));
  const faltan = unicas - hechas;
  if (!Number.isFinite(faltan) || faltan <= 0) return null;
  return decision === "pendiente"
    ? `${faltan} por agrupar`
    : `${faltan} sin asignar`;
}

/**
 * Cuántas quedan sin decidir. El backend manda el número; esto es el respaldo
 * y, sobre todo, lo que hace comparable el conteo local con el suyo.
 */
export function contarSinDecidir(preguntas: readonly PreguntaAbierta[]): number {
  return preguntas.filter((p) => presentarDecision(decisionDePregunta(p))?.abierta).length;
}

/**
 * El texto del número accionable. «Te quedan 3» se puede actuar; un porcentaje
 * de avance no, y el ADR es explícito en no usarlo.
 */
export function frasePendientes(sinDecidir: number): string {
  if (sinDecidir <= 0) return "Sin variables pendientes de decidir";
  if (sinDecidir === 1) return "1 variable marcada sin decidir";
  return `${sinDecidir} variables marcadas sin decidir`;
}
