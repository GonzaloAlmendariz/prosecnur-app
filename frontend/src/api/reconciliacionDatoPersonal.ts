// Sospecha de dato personal en una columna fuera del formulario
// (`.reconciliacion_dato_personal` en R, ítem 21 del checklist de Validación,
// ronda 2). La decide solo el motor; el diálogo de variables extra y Carga ›
// Revisión la muestran y dejan la columna sin marcar por defecto.

export type DatoPersonal = {
  sospecha: boolean;
  /** "Parece teléfono: 9 dígitos en el 97 % de los casos con dato"; vacía sin sospecha. */
  causa: string;
};

function escalar(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

/** `undefined` si el motor no publica el bloque o no hay sospecha. */
export function normalizeDatoPersonal(raw: unknown): DatoPersonal | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const s = escalar(r.sospecha);
  const sospecha = s === true || s === 1 || s === "1" || s === "true" || s === "TRUE";
  if (!sospecha) return undefined;
  const causa = escalar(r.causa);
  return { sospecha: true, causa: typeof causa === "string" ? causa.trim() : "" };
}
