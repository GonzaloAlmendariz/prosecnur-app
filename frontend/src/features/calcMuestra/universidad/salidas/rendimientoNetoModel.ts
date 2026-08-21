/**
 * Lo que la muestra rinde DE VERDAD, descontando alumnos contados dos veces.
 *
 * Dos aulas del mismo estrato pueden compartir estudiantes: el mismo alumno
 * lleva los dos cursos y aparece en las dos listas. El dimensionamiento suma
 * elegibles BRUTOS, así que promete más de lo que hay. El motor ya mide el
 * neto (`eligible_n_neto`, descuento secuencial) pero sólo lo publicaba como
 * columna de auditoría: nadie contrastaba ese neto contra el objetivo.
 *
 * Medido en HSVG2026 el 2026-08-21: 6.762 brutos contra 6.440 netos, 322
 * alumnos repetidos (4,8 %). Con la tasa media rinden ~3.413 efectivas, así que
 * la sobremuestra operativa de 3.750 se queda corta pero la muestra objetivo de
 * 2.500 se cubre con holgura. Gonzalo, al verlo: «esto es algo valioso que
 * también sería bueno agregar en la validación».
 *
 * El colchón consumido es información de diseño, no una alarma: la sobremuestra
 * existe para absorber pérdidas. La alarma es que el OBJETIVO no se alcance.
 */

export type RendimientoNeto = {
  /** Elegibles sumados tal como los cuenta el dimensionamiento. */
  bruto: number;
  /** Elegibles sin contar dos veces al mismo alumno. */
  neto: number;
  /** Alumnos que aparecen en más de un aula titular. */
  repetidos: number;
  /** Proporción del bruto que estaba repetida. */
  fraccionRepetida: number;
  /** Efectivas esperadas sobre el neto, con la tasa media de la selección. */
  efectivasEsperadas: number;
  /** Tasa media ponderada usada para la proyección. */
  tasaMedia: number;
  /** Objetivo de la muestra; null si no se pudo leer. */
  objetivo: number | null;
  /** Sobremuestra operativa; null si no se pudo leer. */
  operativa: number | null;
  /** El objetivo se cubre con los netos. */
  cubreObjetivo: boolean | null;
  /** Cuánto sobra (o falta) frente al objetivo, en efectivas. */
  margenSobreObjetivo: number | null;
  /** El motor no publicó netos: sin ids de estudiante no hay traslape medible. */
  sinDatos: boolean;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const campo = (fila: Record<string, unknown>, claves: string[]): number | null => {
  for (const k of claves) {
    const v = num(fila[k]);
    if (v != null) return v;
  }
  return null;
};

/**
 * @param titulares Filas de la selección con rol titular.
 * @param objetivo n objetivo del componente vigente.
 * @param operativa Sobremuestra operativa del componente vigente.
 */
export function rendimientoNeto(
  titulares: ReadonlyArray<Record<string, unknown>> | null | undefined,
  objetivo: number | null = null,
  operativa: number | null = null,
): RendimientoNeto | null {
  const filas = titulares ?? [];
  if (!filas.length) return null;

  let bruto = 0;
  let neto = 0;
  let tasaPonderada = 0;
  let conNeto = 0;

  for (const fila of filas) {
    const b = campo(fila, ["eligible_n_bruto", "eligible_n"]) ?? 0;
    // Sin columna de neto el aula no aporta traslape conocido, y su bruto ES su
    // neto: suponer una pérdida que nadie midió sería inventar el dato.
    const n = campo(fila, ["eligible_n_neto"]);
    if (n != null) conNeto += 1;
    const tasa = campo(fila, ["tau", "tasa_efectividad", "rendimiento_ref"]);
    bruto += b;
    neto += n ?? b;
    if (tasa != null) tasaPonderada += tasa * (n ?? b);
  }

  if (bruto <= 0) return null;
  const sinDatos = conNeto === 0;
  const tasaMedia = neto > 0 && tasaPonderada > 0 ? tasaPonderada / neto : 0;
  const efectivasEsperadas = Math.round(neto * tasaMedia);
  const obj = objetivo != null && objetivo > 0 ? objetivo : null;

  return {
    bruto,
    neto,
    repetidos: Math.max(0, bruto - neto),
    fraccionRepetida: bruto > 0 ? Math.max(0, bruto - neto) / bruto : 0,
    efectivasEsperadas,
    tasaMedia,
    objetivo: obj,
    operativa: operativa != null && operativa > 0 ? operativa : null,
    cubreObjetivo: obj == null ? null : efectivasEsperadas >= obj,
    margenSobreObjetivo: obj == null ? null : efectivasEsperadas - obj,
    sinDatos,
  };
}
