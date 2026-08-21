/**
 * EF3 fase 1 — la suma por facultad de `efectivas_esperadas` (calibración
 * 2025 por curso-horario: elegibles × P(aplicada|docente) × rendimiento(tamaño)).
 *
 * Convive con las «Esperadas» de la certificación, que usan OTRO modelo
 * (la ecuación vieja con tasa plana): dos números con el mismo nombre son la veta
 * más productiva de defectos de la casa, así que ésta se muestra AL PIE de
 * aquélla, etiquetada por su modelo, nunca en su lugar. Referencial: no toca
 * el sorteo (fase 2 = decisión de Gonzalo).
 */
export type EfectividadCalibradaFacultad = {
  suma: number;
  /** Titulares de la facultad con la columna poblada / total. */
  conDato: number;
  total: number;
};

const clave = (v: unknown) => String(v ?? "").trim().toUpperCase();

export function efectividadCalibradaPorFacultad(
  filas: ReadonlyArray<Record<string, unknown>>,
): Map<string, EfectividadCalibradaFacultad> | null {
  const mapa = new Map<string, EfectividadCalibradaFacultad>();
  let algunDato = false;
  for (const fila of filas) {
    const fac = clave(fila.faculty ?? fila.facultad);
    if (!fac) continue;
    const actual = mapa.get(fac) ?? { suma: 0, conDato: 0, total: 0 };
    actual.total += 1;
    const v = Number(fila.efectivas_esperadas);
    if (Number.isFinite(v) && fila.efectivas_esperadas != null) {
      actual.suma += v;
      actual.conDato += 1;
      algunDato = true;
    }
    mapa.set(fac, actual);
  }
  // Corrida vieja sin la columna: null — la superficie no inventa un 0
  // («Number(null) es 0», la trampa conocida del repo).
  return algunDato ? mapa : null;
}
