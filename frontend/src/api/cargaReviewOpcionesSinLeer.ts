// Carga › Revisión: columnas de opción múltiple que el motor no pudo leer
// (`.carga_review_opciones_sin_leer`, ítem 20 del checklist de Validación
// 2026-11-12). Una columna por opción vale 0/1 o el código de su opción; la que
// no tiene ninguna de esas formas no entra a su pregunta, se conserva en la base
// y llega aquí con su causa. Avisa, no bloquea: no entra en `ready`.

export type CargaReviewOpcionSinLeer = {
  /** La pregunta de opción múltiple (name del formulario). */
  variable: string;
  /** La columna de la base que no se pudo leer. */
  columna: string;
  /** El código de la opción según el nombre de la columna. */
  codigo: string;
  motivo: "valores" | "fuera_de_lista";
  valores: string[];
  n_con_dato: number;
  causa: string;
};

export type CargaReviewOpcionesSinLeer = {
  n: number;
  columnas: CargaReviewOpcionSinLeer[];
};

function registro(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// R puede entregar un escalar como vector de largo uno.
function escalar(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function texto(value: unknown): string {
  const v = escalar(value);
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

function entero(value: unknown): number {
  const v = Number(escalar(value));
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

/** `null` cuando el motor no publica columnas sin leer. */
export function normalizeCargaReviewOpcionesSinLeer(raw: unknown): CargaReviewOpcionesSinLeer | null {
  const r = registro(raw);
  const filas = Array.isArray(r.columnas) ? r.columnas : [];
  const columnas = filas
    .map((fila) => registro(fila))
    .map((fila): CargaReviewOpcionSinLeer => ({
      variable: texto(fila.variable),
      columna: texto(fila.columna),
      codigo: texto(fila.codigo),
      motivo: texto(fila.motivo) === "fuera_de_lista" ? "fuera_de_lista" : "valores",
      valores: (Array.isArray(fila.valores) ? fila.valores : [fila.valores]).map(texto).filter(Boolean),
      n_con_dato: entero(fila.n_con_dato),
      causa: texto(fila.causa),
    }))
    .filter((fila) => fila.columna.length > 0);
  if (!columnas.length) return null;
  return { n: columnas.length, columnas };
}
