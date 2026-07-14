/**
 * Modelo puro de «Cursos-horario por facultad» (sección Cálculo · §5.3).
 *
 * Deriva, por facultad, cuántos cursos-horario (CH) hacen falta para cumplir la
 * cuota calculada, a partir de tres insumos reales del proyecto:
 *   - alumnos por CH = MÍNIMO entre la media y la mediana de elegibles por
 *     curso-horario del marco depurado (criterio conservador del método),
 *   - la cuota por facultad ya calculada por el motor (Propuestas),
 *   - el inventario de CH del marco (elegibles) o el total de CH de la base.
 *
 * CH necesarios = ceil(cuota / alumnos-por-CH); el plan definitivo suma el
 * agregado operacional (0/1/2 CH extra por facultad). Sin React ni red: la capa
 * visual consume estas cifras y el gráfico de Distribución (§5.4) las reutiliza.
 */
import type { BaseCursosHorario } from "../../dominio";

/** Insumo por facultad para el modelo (ensamblado por la capa visual). */
export type CursosHorarioEntradaFacultad = {
  facultad: string;
  /** Encuestas objetivo de la facultad (cuota del motor). */
  cuota: number;
  /** Mediana de elegibles por curso-horario en el marco depurado. */
  estAulaMediana: number | null;
  /** Media de elegibles por curso-horario en el marco depurado. */
  estAulaMedia: number | null;
  /** Cursos-horario elegibles del marco para la facultad. */
  chMarcoElegible: number | null;
  /** Total de cursos-horario de la facultad en la base (antes de depurar). */
  chTotal: number | null;
  /** Agregado operacional: 0, 1 o 2 CH extra decididos para la facultad. */
  extra: number;
};

/** Fila resuelta por facultad del plan de cursos-horario. */
export type CursosHorarioFilaFacultad = {
  facultad: string;
  /** min(media, mediana) de elegibles por CH; null si no hay medida. */
  alumnosPorCH: number | null;
  cuota: number;
  /** ceil(cuota / alumnos-por-CH); null si falta el divisor. */
  chNecesarios: number | null;
  /** Inventario de CH de la base seleccionada (total o elegible del marco). */
  chBase: number | null;
  extra: number;
  /** chNecesarios + extra; el plan definitivo por facultad. */
  chFinal: number | null;
  /** chFinal / chBase: qué proporción del marco disponible se usa. */
  usoBase: number | null;
};

export type CursosHorarioModelo = {
  filas: CursosHorarioFilaFacultad[];
  base: BaseCursosHorario;
  totalCuota: number;
  totalNecesarios: number;
  totalExtra: number;
  totalFinal: number;
  totalBase: number | null;
  /** true si TODAS las facultades con cuota tienen divisor de alumnos-por-CH. */
  completo: boolean;
};

/**
 * Alumnos por curso-horario: el MÍNIMO entre media y mediana (criterio del
 * método). Con solo una de las dos medidas, esa; sin ninguna, null.
 */
export function alumnosPorCursoHorario(mediana: number | null, media: number | null): number | null {
  const m = mediana != null && Number.isFinite(mediana) && mediana > 0 ? mediana : null;
  const a = media != null && Number.isFinite(media) && media > 0 ? media : null;
  if (m != null && a != null) return Math.min(m, a);
  return m ?? a;
}

/** CH necesarios para una cuota dado el tamaño medio de CH. */
export function cursosHorarioNecesarios(cuota: number, alumnosPorCH: number | null): number | null {
  if (alumnosPorCH == null || alumnosPorCH <= 0) return null;
  if (!Number.isFinite(cuota) || cuota <= 0) return 0;
  return Math.ceil(cuota / alumnosPorCH);
}

export function construirCursosHorarioModelo(
  entradas: CursosHorarioEntradaFacultad[],
  base: BaseCursosHorario,
): CursosHorarioModelo {
  const filas: CursosHorarioFilaFacultad[] = entradas.map((entrada) => {
    const alumnosPorCH = alumnosPorCursoHorario(entrada.estAulaMediana, entrada.estAulaMedia);
    const chNecesarios = cursosHorarioNecesarios(entrada.cuota, alumnosPorCH);
    const extra = Math.max(0, Math.round(entrada.extra));
    const chFinal = chNecesarios == null ? null : chNecesarios + extra;
    const chBase = base === "total" ? entrada.chTotal : entrada.chMarcoElegible;
    const usoBase = chFinal != null && chBase != null && chBase > 0 ? chFinal / chBase : null;
    return {
      facultad: entrada.facultad,
      alumnosPorCH,
      cuota: Math.max(0, Math.round(entrada.cuota)),
      chNecesarios,
      chBase: chBase != null && Number.isFinite(chBase) ? chBase : null,
      extra,
      chFinal,
      usoBase,
    };
  });

  const conCuota = filas.filter((f) => f.cuota > 0);
  return {
    filas,
    base,
    totalCuota: filas.reduce((sum, f) => sum + f.cuota, 0),
    totalNecesarios: filas.reduce((sum, f) => sum + (f.chNecesarios ?? 0), 0),
    totalExtra: filas.reduce((sum, f) => sum + f.extra, 0),
    totalFinal: filas.reduce((sum, f) => sum + (f.chFinal ?? 0), 0),
    totalBase: filas.some((f) => f.chBase != null)
      ? filas.reduce((sum, f) => sum + (f.chBase ?? 0), 0)
      : null,
    completo: conCuota.length > 0 && conCuota.every((f) => f.alumnosPorCH != null),
  };
}

/** Plan definitivo (nombre → CH final) para persistir al confirmar (§5.3.f / §5.4). */
export function cursosHorarioFinalMap(modelo: CursosHorarioModelo): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const fila of modelo.filas) {
    if (fila.chFinal != null) mapa[fila.facultad] = fila.chFinal;
  }
  return mapa;
}
