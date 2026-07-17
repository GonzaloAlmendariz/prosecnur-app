/**
 * Modelo PURO de la pestaña Marco → Explorador (radiografía del marco,
 * contrato calc_muestra_aulas_exploracion_v1). Aquí vive toda la lógica
 * calculable: derivación de elegibles efectivos con fórmula literal (nunca un
 * score compuesto opaco), orden/filtro de facultades y cursos, distribución
 * por tipo de sesión y contraste con la selección de titulares — patrón
 * territorialSummaryModel: el `.tsx` solo presenta.
 */
import type {
  CalcMuestraAulasExploracion,
  CalcMuestraAulasExploracionCurso,
  CalcMuestraAulasExploracionFacultad,
  CalcMuestraAulasExploracionTipoSesion,
  CalcMuestraAulasParticularidades,
} from "../../../../api/client";
import { fmtInt, safeNumber } from "../../sharedCore";
import {
  classroomRowNumber,
  classroomRowText,
  normalizeUniversityLabel,
} from "../shared/format";

/* ============================================================================
   Elegibles efectivos: la ÚNICA derivación de la pestaña, con fórmula visible.
   ============================================================================ */

/**
 * Elegibles efectivos = round(elegibles × % misma facultad). Sin share medido
 * (NA del motor) NO se inventa un valor: null y la UI muestra el dato crudo.
 */
export function elegiblesEfectivos(elegibles: number, share: number | null): number | null {
  if (share == null || !Number.isFinite(share)) return null;
  if (!Number.isFinite(elegibles) || elegibles <= 0) return 0;
  return Math.round(elegibles * Math.min(1, Math.max(0, share)));
}

/** Fórmula literal para el tooltip: transparencia total, nada de caja negra. */
export function formulaEfectivos(elegibles: number, share: number | null): string {
  const efectivos = elegiblesEfectivos(elegibles, share);
  if (share == null || efectivos == null) {
    return "Sin % misma facultad medido: se muestran los elegibles sin ajustar.";
  }
  const pct = Math.round(Math.min(1, Math.max(0, share)) * 100);
  return `${fmtInt(elegibles)} elegibles × ${pct}% misma facultad = ${fmtInt(efectivos)} elegibles efectivos`;
}

/* ============================================================================
   Filas de curso del drill-down (top del contrato o aula_frame completo).
   ============================================================================ */

export type ExploradorCursoRow = {
  id: string;
  curso: string;
  nivel: string;
  tipo: string;
  elegibles: number;
  /** Proporción 0..1; null cuando el motor no la midió. */
  share: number | null;
  efectivos: number | null;
  localExterno: boolean;
  multiFacultad: boolean;
};

/** Filas del drill-down desde `top_cursos` del contrato (top 15 por elegibles). */
export function cursoRowsDesdeExploracion(
  facultad: CalcMuestraAulasExploracionFacultad,
): ExploradorCursoRow[] {
  return facultad.top_cursos.map((curso: CalcMuestraAulasExploracionCurso) => ({
    id: curso.id,
    curso: curso.curso,
    nivel: curso.nivel,
    tipo: curso.tipo,
    elegibles: curso.elegibles,
    share: curso.faculty_match_share,
    efectivos: elegiblesEfectivos(curso.elegibles, curso.faculty_match_share),
    localExterno: curso.local_externo,
    multiFacultad: curso.multi_facultad,
  }));
}

const CURSO_ID_KEYS = ["classroom_id", "course_schedule_id", "nrc", "codigo_aula", "id"];
const CURSO_NOMBRE_KEYS = ["course_name", "curso", "label", "classroom_label", "aula"];
const CURSO_NIVEL_KEYS = ["level", "nivel", "course_level", "nivel_del_curso", "ciclo"];
const CURSO_TIPO_KEYS = ["session_type", "tipo_sesion", "tipo_de_sesion", "tipo_curso", "actividad"];
const CURSO_ELEGIBLES_KEYS = ["eligible_n", "elegibles", "n_elegibles", "students_n", "matriculados", "total"];
const CURSO_FACULTAD_KEYS = ["faculty", "facultad", "unidad_academica", "stratum"];
const CURSO_SHARE_KEYS = ["faculty_match_share", "share_misma_facultad"];

function rowIncluded(row: Record<string, unknown>, hasIncludedColumn: boolean): boolean {
  if (!hasIncludedColumn) return true;
  const value = row.included;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    return t === "true" || t === "1";
  }
  return value === undefined || value === null;
}

/**
 * "Ver todos": filas completas del `aula_frame` filtradas por facultad. Los
 * badges de local externo / multi-facultad se cruzan con las particularidades
 * detectadas (ids de codigo_z y multi_facultad) porque el aula_frame no trae
 * esas columnas. `labelFacultad` traduce el valor crudo a la etiqueta canónica.
 */
export function cursoRowsDesdeAulaFrame(
  rows: Array<Record<string, unknown>>,
  facultad: string,
  particularidades: CalcMuestraAulasParticularidades | null,
  labelFacultad: (raw: string) => string = (raw) => raw,
): ExploradorCursoRow[] {
  const target = normalizeUniversityLabel(facultad);
  if (!target) return [];
  const localExternoIds = new Set((particularidades?.codigo_z ?? []).map((item) => item.id));
  const multiFacultadIds = new Set((particularidades?.multi_facultad ?? []).map((item) => item.id));
  const hasIncludedColumn = rows.some((row) => row.included !== undefined);
  return rows
    .filter((row) => rowIncluded(row, hasIncludedColumn))
    .filter((row) => {
      const raw = classroomRowText(row, CURSO_FACULTAD_KEYS);
      if (!raw) return false;
      return (
        normalizeUniversityLabel(raw) === target ||
        normalizeUniversityLabel(labelFacultad(raw)) === target
      );
    })
    .map((row, index): ExploradorCursoRow => {
      const id = classroomRowText(row, CURSO_ID_KEYS);
      const curso = classroomRowText(row, CURSO_NOMBRE_KEYS) || id || `Curso-horario ${index + 1}`;
      const shareRaw = classroomRowNumber(row, CURSO_SHARE_KEYS);
      // classroomRowNumber devuelve 0 cuando la columna no existe: solo hay
      // share medido si la fila trae la clave con un valor presente y no-NA.
      const shareText = CURSO_SHARE_KEYS.map((key) => classroomRowText(row, [key])).find((t) => t !== "");
      const shareMeasured = Boolean(shareText && shareText.trim().toUpperCase() !== "NA");
      const share = shareMeasured ? Math.min(1, Math.max(0, safeNumber(shareRaw, 0))) : null;
      const elegibles = Math.max(0, Math.round(classroomRowNumber(row, CURSO_ELEGIBLES_KEYS)));
      return {
        id: id || `${curso}-${index}`,
        curso,
        nivel: classroomRowText(row, CURSO_NIVEL_KEYS),
        tipo: classroomRowText(row, CURSO_TIPO_KEYS),
        elegibles,
        share,
        efectivos: elegiblesEfectivos(elegibles, share),
        localExterno: localExternoIds.has(id),
        multiFacultad: multiFacultadIds.has(id),
      };
    });
}

/* ============================================================================
   Orden del drill-down: columnas ordenables, sin ranking compuesto.
   ============================================================================ */

export type ExploradorCursoSortKey = "curso" | "nivel" | "tipo" | "elegibles" | "share" | "efectivos";
export type ExploradorCursoSort = { key: ExploradorCursoSortKey; dir: "asc" | "desc" };

export const EXPLORADOR_SORT_DEFAULT: ExploradorCursoSort = { key: "elegibles", dir: "desc" };

/** Toggle de encabezado: misma columna invierte dirección; nueva columna
 *  arranca desc en numéricas y asc en textuales. */
export function toggleCursoSort(sort: ExploradorCursoSort, key: ExploradorCursoSortKey): ExploradorCursoSort {
  if (sort.key === key) return { key, dir: sort.dir === "desc" ? "asc" : "desc" };
  const numeric = key === "elegibles" || key === "share" || key === "efectivos";
  return { key, dir: numeric ? "desc" : "asc" };
}

function cursoSortValue(row: ExploradorCursoRow, key: ExploradorCursoSortKey): string | number | null {
  if (key === "curso") return row.curso;
  if (key === "nivel") return row.nivel;
  if (key === "tipo") return row.tipo;
  if (key === "elegibles") return row.elegibles;
  if (key === "share") return row.share;
  return row.efectivos;
}

/** Orden estable: null (sin dato) siempre al final, desempate alfabético. */
export function ordenarCursos(rows: ExploradorCursoRow[], sort: ExploradorCursoSort): ExploradorCursoRow[] {
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = cursoSortValue(a, sort.key);
    const vb = cursoSortValue(b, sort.key);
    if (va == null && vb == null) return a.curso.localeCompare(b.curso, "es");
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") {
      if (va !== vb) return (va - vb) * factor;
      return a.curso.localeCompare(b.curso, "es");
    }
    const cmp = String(va).localeCompare(String(vb), "es");
    if (cmp !== 0) return cmp * factor;
    return a.curso.localeCompare(b.curso, "es");
  });
}

/* ============================================================================
   Cards por facultad: filtro por nombre y orden por elegibles.
   ============================================================================ */

/** Filtra por nombre (sin tildes, sin mayúsculas) y ordena por elegibles desc. */
export function filtrarFacultades(
  facultades: CalcMuestraAulasExploracionFacultad[],
  query: string,
): CalcMuestraAulasExploracionFacultad[] {
  const q = normalizeUniversityLabel(query);
  const filtered = q
    ? facultades.filter((fac) => normalizeUniversityLabel(fac.facultad).includes(q))
    : facultades;
  return [...filtered].sort(
    (a, b) => b.elegibles_total - a.elegibles_total || a.facultad.localeCompare(b.facultad, "es"),
  );
}

/**
 * Resumen robusto de elegibles por aula de un tipo, sobre los CH INCLUIDOS
 * (reunión Ramiro §9: la media se distorsiona con las aulas gigantes de ~100 →
 * hay que ver la distribución, no un solo número). 5 números para el boxplot +
 * la media aparte para marcar la distorsión. Solo se construye cuando el motor
 * trae cifra defendible en los cinco (mismo subset y NA honesto que la mediana);
 * `media` puede faltar por separado. `null` en el llamador ⇒ no hay boxplot.
 */
export type BoxplotResumen = {
  min: number;
  q1: number;
  mediana: number;
  q3: number;
  max: number;
  /** Media de elegibles por aula; `null` = NA del motor. A la derecha de la
   *  mediana señala aulas gigantes que jalan el promedio. */
  media: number | null;
};

export type TipoSesionShare = {
  tipo: string;
  ch: number;
  elegibles: number;
  /** Proporción 0..1 de los elegibles de la facultad en este tipo de sesión. */
  share: number;
  /** Mediana de elegibles del aula típica INCLUIDA de este tipo. `null` = NA
   *  honesto del motor (no hay CH incluidos con dato); un 0 mentiría que el aula
   *  típica está vacía. Es la cifra que responde "¿estas aulas cubren la cuota?". */
  medianaElegibles: number | null;
  /** Distribución de elegibles por aula (boxplot) sobre los CH incluidos.
   *  `null` cuando el motor no trae el resumen (mismo subset que la mediana). */
  caja: BoxplotResumen | null;
};

/**
 * Boxplot de un registro del contrato: los cinco números comparten el subset
 * (CH incluidos con dato), así que llegan todos o ninguno. Con cualquiera en
 * `null` no hay cifra defendible ⇒ `null` (no se dibuja caja).
 */
function boxplotDesdeTipo(row: CalcMuestraAulasExploracionTipoSesion): BoxplotResumen | null {
  const { elegibles_min, elegibles_q1, mediana_elegibles, elegibles_q3, elegibles_max } = row;
  if (
    elegibles_min == null ||
    elegibles_q1 == null ||
    mediana_elegibles == null ||
    elegibles_q3 == null ||
    elegibles_max == null
  ) {
    return null;
  }
  return {
    min: elegibles_min,
    q1: elegibles_q1,
    mediana: mediana_elegibles,
    q3: elegibles_q3,
    max: elegibles_max,
    media: row.media_elegibles,
  };
}

/**
 * Distribución por tipo de sesión de una facultad: % de elegibles por tipo,
 * CH, elegibles, mediana por aula y el boxplot de elegibles por aula, ordenada
 * desc por elegibles — responde "¿dónde están los alumnos de esta facultad,
 * qué tipos cubren la cuota y con qué dispersión?". Sin `maxRows` las trae
 * TODAS (la tarjeta ancha muestra la tabla completa).
 */
export function tipoSesionShares(
  facultad: CalcMuestraAulasExploracionFacultad,
  maxRows?: number,
): TipoSesionShare[] {
  const total = facultad.por_tipo_sesion.reduce((acc, row) => acc + Math.max(0, row.elegibles), 0);
  if (total <= 0) return [];
  const ordenadas = [...facultad.por_tipo_sesion].sort(
    (a, b) => b.elegibles - a.elegibles || a.tipo.localeCompare(b.tipo, "es"),
  );
  const limitadas = maxRows == null ? ordenadas : ordenadas.slice(0, Math.max(1, maxRows));
  return limitadas.map((row) => ({
    tipo: row.tipo,
    ch: row.ch,
    elegibles: row.elegibles,
    share: Math.max(0, row.elegibles) / total,
    medianaElegibles: row.mediana_elegibles,
    caja: boxplotDesdeTipo(row),
  }));
}

/**
 * Escala compartida (máximo de elegibles por aula) entre los tipos de una
 * facultad, para que los boxplots se lean sobre el MISMO eje y sean
 * comparables. 0 si ningún tipo trae caja (el llamador omite el boxplot).
 */
export function escalaMaxElegibles(tipos: TipoSesionShare[]): number {
  return tipos.reduce((acc, t) => (t.caja ? Math.max(acc, t.caja.max) : acc), 0);
}

/** Marcas del boxplot como fracción 0..1 de la escala compartida. */
export type BoxplotPosiciones = {
  min: number;
  q1: number;
  mediana: number;
  q3: number;
  max: number;
  /** `null` cuando la media es NA del motor. */
  media: number | null;
};

/**
 * Posiciones 0..1 de cada marca sobre la escala compartida. Escala 0 (ningún
 * dato) ⇒ todo colapsa a 0 (el llamador no llega aquí sin caja).
 */
export function boxplotPosiciones(caja: BoxplotResumen, escalaMax: number): BoxplotPosiciones {
  const frac = (v: number) => (escalaMax > 0 ? Math.min(1, Math.max(0, v / escalaMax)) : 0);
  return {
    min: frac(caja.min),
    q1: frac(caja.q1),
    mediana: frac(caja.mediana),
    q3: frac(caja.q3),
    max: frac(caja.max),
    media: caja.media != null ? frac(caja.media) : null,
  };
}

export type NivelDistribucion = {
  nivel: string;
  ch: number;
  elegibles: number;
  /** Proporción 0..1 de los elegibles de la facultad en este nivel. */
  share: number;
  /** Mediana de elegibles del aula típica incluida de este nivel; misma
   *  semántica de `null` honesto que en la distribución por tipo. */
  medianaElegibles: number | null;
};

/**
 * Distribución por nivel del curso de una facultad (misma forma que
 * `tipoSesionShares`, para la fila secundaria de la tarjeta ancha). Vacío
 * honesto cuando el contrato no trae niveles con elegibles.
 */
export function nivelDistribucion(
  facultad: CalcMuestraAulasExploracionFacultad,
  maxRows?: number,
): NivelDistribucion[] {
  const total = facultad.por_nivel.reduce((acc, row) => acc + Math.max(0, row.elegibles), 0);
  if (total <= 0) return [];
  const ordenadas = [...facultad.por_nivel].sort(
    (a, b) => b.elegibles - a.elegibles || a.nivel.localeCompare(b.nivel, "es"),
  );
  const limitadas = maxRows == null ? ordenadas : ordenadas.slice(0, Math.max(1, maxRows));
  return limitadas.map((row) => ({
    nivel: row.nivel,
    ch: row.ch,
    elegibles: row.elegibles,
    share: Math.max(0, row.elegibles) / total,
    medianaElegibles: row.mediana_elegibles,
  }));
}

/** % de CH sin condición registrada (señal de calidad del dato, no un juicio). */
export function shareSinCondicion(facultad: CalcMuestraAulasExploracionFacultad): number | null {
  if (facultad.ch_total <= 0) return null;
  return Math.min(1, Math.max(0, facultad.n_sin_condicion / facultad.ch_total));
}

/* ============================================================================
   Contraste con la selección: titulares elegidos vs CH elegibles por facultad.
   ============================================================================ */

export type ContrasteSeleccionRow = {
  facultad: string;
  titulares: number;
  chElegibles: number;
};

function esTitular(row: Record<string, unknown>): boolean {
  return (
    classroomRowText(row, ["sample_role"]) === "titular" ||
    classroomRowText(row, ["wave"]) === "M1"
  );
}

/**
 * Cuenta titulares (M1) por facultad y los enfrenta a los CH elegibles del
 * contrato. Derivación barata: un solo pase por las filas de la selección.
 * Sin titulares ⇒ [] y la franja secundaria no se muestra.
 */
export function contrasteSeleccion(
  selectionRows: Array<Record<string, unknown>>,
  exploracion: CalcMuestraAulasExploracion,
): ContrasteSeleccionRow[] {
  const titularesPorFacultad = new Map<string, number>();
  for (const row of selectionRows) {
    if (!esTitular(row)) continue;
    const raw = classroomRowText(row, CURSO_FACULTAD_KEYS);
    if (!raw) continue;
    const key = normalizeUniversityLabel(raw);
    titularesPorFacultad.set(key, (titularesPorFacultad.get(key) ?? 0) + 1);
  }
  if (!titularesPorFacultad.size) return [];
  return filtrarFacultades(exploracion.por_facultad, "")
    .map((fac) => ({
      facultad: fac.facultad,
      titulares: titularesPorFacultad.get(normalizeUniversityLabel(fac.facultad)) ?? 0,
      chElegibles: fac.ch_elegibles,
    }))
    .filter((row) => row.titulares > 0);
}
