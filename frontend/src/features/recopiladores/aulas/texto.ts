// Primitivas de texto y lectura tolerante de filas del adapter `aulas_v1`.
//
// Todo lo demás del adapter se apoya en estas cinco funciones, así que viven
// solas y sin dependencias: son el piso de la extracción.
//
// `sourceRowText`/`sourceRowNumber` existen porque una fila de agenda llega de
// tres orígenes distintos —selección de Cálculo de muestra, plan de Monitoreo y
// pegado manual— y cada uno nombra la misma columna a su manera. Se lee por
// lista de alias, en orden de confianza, y el primer valor no vacío gana.

const numberFormat = new Intl.NumberFormat("es-PE");

export function fmt(value: unknown, fallback = "0") {
  const n = Number(value);
  if (Number.isFinite(n)) return numberFormat.format(n);
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

/**
 * Clave de comparación entre filas y celdas pegadas: sin tildes, sin
 * mayúsculas y sin separadores, para que `MAT146-0205`, `mat146 0205` y
 * `MAT146_0205` sean la misma unidad.
 */
export function normalizeMatchKey(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeHeader(value: unknown) {
  return normalizeMatchKey(value);
}

export function isUrl(value: unknown) {
  return /^https?:\/\//i.test(normalizeText(value));
}

export function sourceRowText(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = normalizeText(row[key]);
    if (value) return value;
  }
  return "";
}

export function sourceRowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}
