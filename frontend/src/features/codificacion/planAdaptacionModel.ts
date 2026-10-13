import type { PlanPregunta } from "../../api/dashboard";

/**
 * Por qué una pregunta del plan queda fuera de la adaptación. Si el backend
 * publicó `motivo_omision` (ADR 0100, P1) se usa ese texto: es el mismo del
 * aviso de `/aplicar`, y así el plan y el aviso cuentan las mismas omitidas.
 * Sin él, el genérico de siempre.
 */
export function motivoNoSoportado(
  p: Pick<PlanPregunta, "tipo" | "text_col" | "motivo_omision">,
): string {
  const declarado = (p.motivo_omision ?? "").trim();
  if (declarado) return declarado;
  if (p.tipo === "select_multiple" && !p.text_col) return "SM sin 'Otros, especifique' emparejado";
  return "ajuste no reconocido";
}
