import type { PlanPregunta } from "../../api/dashboard";

/**
 * Por qué una pregunta del plan no se puede aplicar. Si el backend publicó
 * `motivo_omision` (ADR 0100, P1) se usa ese texto: es el mismo del aviso de
 * `/aplicar`, y así el plan y el aviso cuentan las mismas omitidas. Sin él, la
 * causa que se deduce del plan, en llano y sin siglas del motor.
 */
export const MOTIVO_MULTIPLE_SIN_TEXTO = 'Es de opción múltiple y no tiene emparejado su texto "Otros, especifique".';
export const MOTIVO_SIN_DECLARAR = "No se informó la causa.";

export function motivoNoSoportado(
  p: Pick<PlanPregunta, "tipo" | "text_col" | "motivo_omision">,
): string {
  const declarado = (p.motivo_omision ?? "").trim();
  if (declarado) return declarado;
  if (p.tipo === "select_multiple" && !p.text_col) return MOTIVO_MULTIPLE_SIN_TEXTO;
  return MOTIVO_SIN_DECLARAR;
}
