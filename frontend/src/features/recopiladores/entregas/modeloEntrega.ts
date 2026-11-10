// Material de campo sobre el kit de entregables (ADR 0133, fase 5): lo que el
// módulo agrega al kit y nada más. Puro: se prueba sin React ni red.
//
// - `MODULO_MATERIAL`: la carpeta del módulo en la bandeja y en `Entregables\`.
// - `archivoParaElKit`: varias respuestas de Material dicen el peso en
//   `size_bytes`; el kit lo lee en `size`. Se copia, sin perder lo demás
//   (`guardado_en`, `aviso_guardado`, `rotulo`…).
// - `causaConPista`: el error de cobertura de Hojas de ruta dice dónde se
//   resuelve.

import { ApiError } from "../../../api/core";
import { errorLegible, type ErrorLegible } from "../../../components/entregables/generacionModelo";

export const MODULO_MATERIAL = "Material de campo";

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

/** La respuesta con el peso donde el kit lo busca (`size`), si sólo venía en `size_bytes`. */
export function archivoParaElKit(respuesta: unknown): unknown {
  if (!esRegistro(respuesta)) return respuesta;
  if (respuesta.size != null || respuesta.size_bytes == null) return respuesta;
  return { ...respuesta, size: respuesta.size_bytes };
}

const PISTA_COBERTURA = "Resuélvelo en Hojas de ruta › Manzanas.";

/** Causa legible; la falta de decisión de cobertura añade dónde se resuelve. */
export function causaConPista(e: unknown): ErrorLegible {
  const legible = errorLegible(e);
  const codigo = legible.codigo ?? (e instanceof ApiError ? e.code : null);
  if (codigo !== "E_COVERAGE_DECISION_REQUIRED") return legible;
  return { causa: `${legible.causa.replace(/\.?\s*$/, ".")} ${PISTA_COBERTURA}`, codigo };
}
