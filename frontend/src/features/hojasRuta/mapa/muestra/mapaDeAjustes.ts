/**
 * P3 de la paridad con la página clásica: margen y DEFF ajustados por distrito
 * (`sample_size.margin_district_overrides`, `sample_size.design_effect_overrides`). El motor ya los
 * usa (desdeConfig.ts); faltaba verlos y editarlos. Un mapa ubigeo → valor; sin clave, vale el general.
 */

/** El backend serializa un mapa vacío como `[]`: aquí siempre es un objeto de números positivos. */
export function normalizarAjustes(x: unknown): Record<string, number> {
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

/** El mapa con el ajuste de un distrito puesto, o quitado con `null`. */
export function conAjuste(mapa: Record<string, number>, ubigeo: string, valor: number | null): Record<string, number> {
  const out = { ...mapa };
  if (valor === null || !Number.isFinite(valor) || valor <= 0) delete out[ubigeo];
  else out[ubigeo] = valor;
  return out;
}

/** Margen en puntos porcentuales (como lo escribe el analista) a fracción, acotado a 0,1–80 %. */
export const margenDesdePct = (pct: number) => Math.min(0.8, Math.max(0.001, pct / 100));
/** DEFF acotado a 0,1–20, como la clásica. */
export const deffAcotado = (d: number) => Math.min(20, Math.max(0.1, d));
