// normalizarR.ts — piezas para normalizar lo que serializa Plumber.
//
// R serializa un escalar como vector de largo uno, una lista de un elemento
// como objeto suelto y `NULL` como `{}`. Estos helpers aceptan las tres formas;
// los normalizadores de dominio (`cargaFormularioPublicado.ts`,
// `cargaArmonizacion.ts`) los componen.

export function registro(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function escalar(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

export function texto(value: unknown): string {
  const v = escalar(value);
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

export function numeroONulo(value: unknown): number | null {
  const v = escalar(value);
  if (v === null || v === undefined || v === "" || v === "NA") return null;
  if (typeof v === "object") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function enteroONulo(value: unknown): number | null {
  const n = numeroONulo(value);
  return n == null ? null : Math.max(0, Math.round(n));
}

export function booleano(value: unknown): boolean {
  const v = escalar(value);
  return v === true || v === 1 || v === "1" || v === "true" || v === "TRUE";
}

/** Lista de objetos: arreglo, objeto suelto (lista de uno) o `{}` (NULL). */
export function lista(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(registro).filter((r) => Object.keys(r).length > 0);
  const r = registro(value);
  return Object.keys(r).length ? [r] : [];
}

/** Código de opción: «5», «99», o texto si la fuente no trae número. */
export function codigo(value: unknown): string {
  const v = escalar(value);
  if (v === null || v === undefined || v === "NA") return "";
  return texto(v);
}
