// Lo que toda pestaña de Carga sabe del estudio (ADR 0142). Las pestañas
// Variables, Formulario y Respuestas lo reciben entero en vez de una docena de
// props sueltas; cada rebanada siguiente lo lee sin volver a la página.

import type { EstudioBase, EstudioPayload } from "../../../api/client";

export type ContextoDeCarga = {
  estudio: EstudioPayload | null;
  /** El estudio es de varias bases (topología resuelta). */
  esVarias: boolean;
  /** Bases que no son hijas de un grupo repetido. Vacío con una base. */
  basesPrimarias: readonly string[];
  /** Todas las bases del estudio, hijas de grupo repetido incluidas. Vacío con una base. */
  basesTodas: readonly EstudioBase[];
  /** La base que la pestaña muestra. Con una base es la única ("default" o vacío). */
  baseElegida: string;
  onCambiarBase: (nombre: string) => void;
  /** Texto de la operación en curso; vacío si no hay ninguna. */
  ocupado: string;
  error: string;
  /** Formulario y respuestas listos y sin mapeo de códigos por confirmar. */
  todoListo: boolean;
};

/** Nombre de la base de un estudio de una sola base en el servidor. */
export const BASE_UNICA = "default";

/**
 * La base cuyas variables se muestran. Con una base es la única; con varias,
 * la que nombra la dirección (`foco`) si existe, si no la activa del estudio,
 * si no la primera primaria. Vacío cuando todavía no hay bases.
 */
export function baseDeVariables({
  esVarias,
  hayRespuestas,
  bases,
  basesPrimarias,
  foco,
  baseActiva,
}: {
  esVarias: boolean;
  /** Con una base: si ya hay respuestas cargadas. */
  hayRespuestas: boolean;
  bases: readonly string[];
  basesPrimarias: readonly string[];
  foco: string | null;
  baseActiva: string | null | undefined;
}): string {
  if (!esVarias) return hayRespuestas ? BASE_UNICA : "";
  const pedida = foco?.trim() ?? "";
  if (pedida && bases.includes(pedida)) return pedida;
  if (baseActiva && basesPrimarias.includes(baseActiva)) return baseActiva;
  return basesPrimarias[0] ?? bases[0] ?? "";
}
