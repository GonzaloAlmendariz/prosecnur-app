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
import { estudiantesPorAula, type BaseCursosHorario, type ResumenEstAula } from "../../dominio";

/**
 * Mínimo de curso-horario para que la cota inferior del bootstrap (LI 95%) se
 * considere fiable. Bajo este umbral el backend R emite NA (estAulaLo95 null) y
 * el método LI cae a mín(mediana, media). Se replica aquí como defensa: si
 * llegara un lo95 con nCh chico igual se marca poco fiable.
 */
export const LI95_MIN_CH = 15;

/** Insumo por facultad para el modelo (ensamblado por la capa visual). */
export type CursosHorarioEntradaFacultad = {
  facultad: string;
  /** Encuestas objetivo de la facultad (cuota neta del motor). */
  cuota: number;
  /** Sobremuestra de la facultad (cuota × factor de sobremuestra): es el
   *  DIVIDENDO del cálculo de aulas (método canónico §2.3). */
  sobremuestra: number;
  /** Mediana de elegibles por curso-horario en el marco depurado. */
  estAulaMediana: number | null;
  /** Media de elegibles por curso-horario en el marco depurado. */
  estAulaMedia: number | null;
  /** Cota inferior del IC 95% del bootstrap de la media (agregado R); null en
   *  facultades chicas (<15 CH) o frames sin perfil. */
  estAulaLo95?: number | null;
  /** Nº de curso-horario de la facultad en el marco (tamaño del bootstrap). */
  estAulaNCh?: number | null;
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
  /** Divisor EN USO (el valor del método elegido); null si no hay medida. */
  alumnosPorCH: number | null;
  /** Mediana de elegibles por CH (referencia), saneada a positivo o null. */
  refMediana: number | null;
  /** Media de elegibles por CH (referencia), saneada a positivo o null. */
  refMedia: number | null;
  /** mín(mediana, media) (referencia). */
  refMin: number | null;
  /** Cota inferior IC 95% del bootstrap (referencia); null si no fiable. */
  refLo95: number | null;
  /** Nº de CH de la facultad (tamaño del bootstrap). */
  nCh: number | null;
  /** true si el LI 95% es fiable (lo95 presente y ≥15 CH). */
  li95Fiable: boolean;
  /** Método realmente aplicado a esta fila: LI cae a mín(m,m) si no es fiable. */
  metodoEfectivo: ResumenEstAula;
  cuota: number;
  /** Sobremuestra de la facultad (dividendo del cálculo de aulas). */
  sobremuestra: number;
  /** ceil(sobremuestra / alumnos-por-CH); null si falta el divisor. */
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
  /** Método global elegido para el divisor de estudiantes-por-aula. */
  resumen: ResumenEstAula;
  totalCuota: number;
  totalSobremuestra: number;
  totalNecesarios: number;
  totalExtra: number;
  totalFinal: number;
  totalBase: number | null;
  /** true si TODAS las facultades con cuota tienen divisor de alumnos-por-CH. */
  completo: boolean;
};

/** Positivo finito o null (sanea medidas de aula: 0/NaN/negativo no sirven). */
function pos(valor: number | null | undefined): number | null {
  return valor != null && Number.isFinite(valor) && valor > 0 ? valor : null;
}

/**
 * Alumnos por curso-horario: el MÍNIMO entre media y mediana (criterio del
 * método). Con solo una de las dos medidas, esa; sin ninguna, null.
 */
export function alumnosPorCursoHorario(mediana: number | null, media: number | null): number | null {
  const m = pos(mediana);
  const a = pos(media);
  if (m != null && a != null) return Math.min(m, a);
  return m ?? a;
}

/** true si la cota inferior del bootstrap es fiable (lo95 presente y ≥15 CH). */
export function li95EsFiable(lo95: number | null | undefined, nCh: number | null | undefined): boolean {
  return pos(lo95) != null && (nCh == null || nCh >= LI95_MIN_CH);
}

/** CH necesarios para una sobremuestra dado el tamaño medio de CH. */
export function cursosHorarioNecesarios(sobremuestra: number, alumnosPorCH: number | null): number | null {
  if (alumnosPorCH == null || alumnosPorCH <= 0) return null;
  if (!Number.isFinite(sobremuestra) || sobremuestra <= 0) return 0;
  return Math.ceil(sobremuestra / alumnosPorCH);
}

export function construirCursosHorarioModelo(
  entradas: CursosHorarioEntradaFacultad[],
  base: BaseCursosHorario,
  resumen: ResumenEstAula = "min_mediana_media",
): CursosHorarioModelo {
  const filas: CursosHorarioFilaFacultad[] = entradas.map((entrada) => {
    const refMediana = pos(entrada.estAulaMediana);
    const refMedia = pos(entrada.estAulaMedia);
    const refMin = alumnosPorCursoHorario(entrada.estAulaMediana, entrada.estAulaMedia);
    const li95Fiable = li95EsFiable(entrada.estAulaLo95, entrada.estAulaNCh);
    const refLo95 = li95Fiable ? pos(entrada.estAulaLo95) : null;
    // LI 95% cae a mín(mediana, media) cuando no es fiable (facultad chica).
    const metodoEfectivo: ResumenEstAula =
      resumen === "li_bootstrap" && !li95Fiable ? "min_mediana_media" : resumen;
    // Divisor EN USO: la regla de dominio única (estudiantesPorAula) sobre las
    // medidas saneadas, para que el fallback del LI sea idéntico al del motor.
    const alumnosPorCH = estudiantesPorAula(
      { estAulaMediana: refMediana, estAulaMedia: refMedia, estAulaLo95: refLo95 },
      resumen,
    );
    const sobremuestra = Math.max(0, Math.round(entrada.sobremuestra));
    const chNecesarios = cursosHorarioNecesarios(sobremuestra, alumnosPorCH);
    const extra = Math.max(0, Math.round(entrada.extra));
    const chFinal = chNecesarios == null ? null : chNecesarios + extra;
    const chBase = base === "total" ? entrada.chTotal : entrada.chMarcoElegible;
    const usoBase = chFinal != null && chBase != null && chBase > 0 ? chFinal / chBase : null;
    return {
      facultad: entrada.facultad,
      alumnosPorCH,
      refMediana,
      refMedia,
      refMin,
      refLo95,
      nCh: entrada.estAulaNCh ?? null,
      li95Fiable,
      metodoEfectivo,
      cuota: Math.max(0, Math.round(entrada.cuota)),
      sobremuestra,
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
    resumen,
    totalCuota: filas.reduce((sum, f) => sum + f.cuota, 0),
    totalSobremuestra: filas.reduce((sum, f) => sum + f.sobremuestra, 0),
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
