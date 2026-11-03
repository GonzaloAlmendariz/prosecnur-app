/**
 * Carácter y estado común de una cuota (ADR 0126), espejo de
 * `api/R/monitoreo_cuotas_caracter.R`.
 *
 * - `meta`: un número que el estudio se compromete a alcanzar; tiene faltante y
 *   veredicto.
 * - `referencial`: describe la composición esperada; no tiene faltante ni
 *   veredicto. Si trae número, es una referencia, nunca un piso.
 *
 * Sin declaración nada cambia: con número (aunque sea 0) es meta; sin él,
 * referencial. El motor publica `Caracter` y `estado_cuota`; este módulo sólo
 * los lee y cae a la misma regla cuando el payload viene de una versión
 * anterior.
 */

export type CaracterDeCuota = "meta" | "referencial";

export type EstadoDeCuota = "cumple" | "falta" | "sin_base" | "referencial" | "sin_comparador";

export const ROTULO_DE_CARACTER: Record<CaracterDeCuota, string> = {
  meta: "Meta",
  referencial: "Referencial",
};

/** Qué significa cada carácter, en una línea, para el control que lo declara. */
export const SENTIDO_DE_CARACTER: Record<CaracterDeCuota, string> = {
  meta: "Se exige: tiene faltante y se cumple o no.",
  referencial: "Se describe: se compara con el listado, sin faltante ni veredicto.",
};

export function caracterDeclarado(valor: unknown): CaracterDeCuota | null {
  const v = String(valor ?? "").trim().toLowerCase();
  return v === "meta" || v === "referencial" ? v : null;
}

/** El carácter efectivo: lo declarado manda; sin declarar, meta si hay número. */
export function caracterEfectivo(declarado: unknown, meta: number | null | undefined): CaracterDeCuota {
  const d = caracterDeclarado(declarado);
  const tieneNumero = meta != null && Number.isFinite(meta);
  if (d === "referencial") return "referencial";
  if (d === "meta") return tieneNumero && (meta as number) > 0 ? "meta" : "referencial";
  return tieneNumero && (meta as number) >= 0 ? "meta" : "referencial";
}

export function estadoDeCuotaDesde(valor: unknown): EstadoDeCuota | null {
  const v = String(valor ?? "").trim();
  return v === "cumple" || v === "falta" || v === "sin_base" || v === "referencial" || v === "sin_comparador" ? v : null;
}

/** El mismo cálculo que el motor, para un payload que no trae `estado_cuota`. */
export function estadoDeCuota(caracter: CaracterDeCuota, meta: number | null, efectivas: number, universo: number): EstadoDeCuota {
  const conUniverso = Number.isFinite(universo) && universo > 0;
  if (caracter === "meta" && meta != null && Number.isFinite(meta)) {
    if (efectivas >= meta) return "cumple";
    return conUniverso ? "falta" : "sin_base";
  }
  return conUniverso ? "referencial" : "sin_comparador";
}
