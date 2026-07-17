/**
 * Impacto EN VIVO de la selección de criterios sobre el marco (estimación
 * previa CLIENTE, patrón `aulasCubiertas`): recomputa estudiantes, docentes y
 * aulas filtrando en JS los arrays que ya trae el build (`population` y
 * `aula_frame`), sin ir al motor. Es la contraparte reactiva de la cifra dura
 * de "Reconstruir marco"; siempre se rotula como estimación.
 *
 * Modelo mental (monótono respecto del marco construido): se parte de las aulas
 * INCLUIDAS del último build y la selección actual solo puede RESTRINGIR ese
 * conjunto. Reactivar una categoría que el build ya excluyó no recupera aulas
 * (esas aulas no están en el marco): requiere reconstruir. Así la estimación
 * coincide con la cifra dura en reposo y baja al instante al endurecer.
 *
 * Alcance CLIENTE por scope (lo que el payload permite computar exacto):
 *  - aula (modalidad, tipo de sesión, tipo de docente, sede, nivel del curso,
 *    matriculados, mínimo de elegibles): `aula_frame` trae la señal por aula
 *    (modality/session_type/teacher_type/campus/course_level_num/eligible_n),
 *    así que se filtra exacto.
 *  - alumno faculty/level: `population` trae `faculty` y `level` → exacto.
 *  - alumno formation/condition/age: el payload NO trae esos atributos por
 *    estudiante (population = student_id/faculty/program/level/sex). Se reportan
 *    como pendientes: su impacto solo lo fija el motor al reconstruir.
 *
 * Funciones PURAS (patrón territorialSummaryModel): dado catálogo + selección +
 * frame, devuelven conteos. Sin efectos, sin lógica específica de estudio.
 */
import type {
  CriteriosCatalogo,
  CriteriosSeleccionMarco,
  CriterioVariable,
  MonitoreoRow,
} from "../../../api/client";
import {
  categoriaMarcada,
  clavesDeVariable,
  minEligibleThreshold,
  ordinalIncluido,
  rangosFacultad,
  seleccionVariable,
} from "./criteriosMarco";

/**
 * Clave de texto normalizada, espejo JS de `.cm_aulas_text_key` (R): minúsculas,
 * sin tildes ni comillas, no-alfanumérico -> "_", sin "_" en los bordes. Debe
 * calzar con las claves que el motor emite en el catálogo.
 */
export function textKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[`'´’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowStr(row: MonitoreoRow, col: string): string {
  const v = row[col];
  return v == null ? "" : String(v);
}

function rowNum(row: MonitoreoRow, col: string): number {
  const v = row[col];
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function rowBool(row: MonitoreoRow, col: string): boolean {
  const v = row[col];
  return v === true || v === 1 || v === "TRUE" || v === "true";
}

/** Unidad de conteo natural del criterio según su scope. */
export function unidadCriterio(variable: Pick<CriterioVariable, "scope">): "estudiantes" | "cursos-horario" {
  return variable.scope === "alumno" ? "estudiantes" : "cursos-horario";
}

/** Aulas del marco construido (incluidas) del último build. */
function aulasIncluidas(aulaFrame: MonitoreoRow[]): MonitoreoRow[] {
  return aulaFrame.filter((r) => rowBool(r, "included"));
}

/** Docentes distintos (por email; fallback nombre) de un set de aulas. */
function docentesDistintos(aulas: MonitoreoRow[]): number {
  const set = new Set<string>();
  for (const r of aulas) {
    const email = rowStr(r, "teacher_email").trim();
    const key = email || rowStr(r, "teacher").trim();
    if (key) set.add(email ? email.toLowerCase() : `n:${textKey(key)}`);
  }
  return set.size;
}

/** Estudiantes distintos (unión de `unique_student_ids`) de un set de aulas. */
function estudiantesAlcanzados(aulas: MonitoreoRow[], allow?: Set<string> | null): number {
  const set = new Set<string>();
  for (const r of aulas) {
    const ids = rowStr(r, "unique_student_ids");
    if (!ids) continue;
    for (const raw of ids.split("|")) {
      const id = raw.trim();
      if (!id) continue;
      if (allow && !allow.has(id)) continue;
      set.add(id);
    }
  }
  return set.size;
}

/** Slug de facultad (espejo de slugFacultad en la vista y de la clave de rangos). */
function slugFacultad(nombre: string): string {
  return textKey(nombre);
}

/** ¿La selección de una variable de aula RESTRINGE el marco (no es "todas")? */
function restrictivaAula(variable: CriterioVariable, seleccion: CriteriosSeleccionMarco): boolean {
  const sel = seleccionVariable(seleccion, variable.id);
  if (variable.kind === "flat" || variable.kind === "hierarchical") {
    const claves = clavesDeVariable(variable);
    if (!claves.length) return false;
    return claves.some((k) => !categoriaMarcada(sel, k));
  }
  if (variable.kind === "numeric") return Boolean(sel.threshold);
  if (variable.kind === "range") {
    const ranges = seleccion.courseLevelRanges ?? {};
    return Object.keys(ranges).length > 0;
  }
  return false;
}

/** Predicado: ¿el aula pasa la selección de UNA variable de aula restrictiva? */
function pasaVariableAula(
  variable: CriterioVariable,
  seleccion: CriteriosSeleccionMarco,
  row: MonitoreoRow,
): boolean {
  const sel = seleccionVariable(seleccion, variable.id);
  if (variable.kind === "flat") {
    const val = textKey(rowStr(row, variable.id));
    return val ? categoriaMarcada(sel, val) : false;
  }
  if (variable.kind === "hierarchical") {
    const piezas = rowStr(row, "teacher_type")
      .split("|")
      .map((p) => textKey(p))
      .filter(Boolean);
    if (!piezas.length) return false;
    return piezas.some((k) => categoriaMarcada(sel, k)); // regla "al menos uno"
  }
  if (variable.kind === "numeric") {
    const t = sel.threshold;
    if (!t) return true;
    const n = rowNum(row, "enrolled_total");
    if (!Number.isFinite(n)) return false;
    if (t.op === ">=") return n >= (t.min ?? -Infinity);
    if (t.op === "<=") return n <= (t.max ?? Infinity);
    return n >= (t.min ?? -Infinity) && n <= (t.max ?? Infinity);
  }
  if (variable.kind === "range") {
    const ranges = seleccion.courseLevelRanges ?? {};
    const fac = slugFacultad(rowStr(row, "faculty"));
    const facRanges = fac ? rangosFacultad(seleccion, fac) : [];
    if (!facRanges.length) return true; // sin rango para su facultad => no filtra
    const nivel = rowNum(row, "course_level_num");
    if (!Number.isFinite(nivel)) return false;
    return facRanges.some(([lo, hi]) => nivel >= lo && nivel <= hi);
  }
  return true;
}

/** ¿La selección de una variable de ALUMNO restringe la población (no es "todas")? */
function restrictivaAlumno(variable: CriterioVariable, sel: ReturnType<typeof seleccionVariable>): boolean {
  if (variable.kind === "flat" || variable.kind === "hierarchical") {
    return clavesDeVariable(variable).some((k) => !categoriaMarcada(sel, k));
  }
  if (variable.kind === "numeric") return Boolean(sel.threshold);
  if (variable.kind === "ordinal") return (variable.values ?? []).some((val) => !ordinalIncluido(sel, val));
  return false;
}

/** Predicado: ¿el estudiante `row` del pool pasa la selección de UNA variable de alumno? */
function pasaVariableAlumno(
  variable: CriterioVariable,
  sel: ReturnType<typeof seleccionVariable>,
  row: MonitoreoRow,
): boolean {
  if (variable.kind === "flat") {
    const val = textKey(rowStr(row, variable.id));
    return val ? categoriaMarcada(sel, val) : true; // sin señal pasa (espejo del motor R)
  }
  if (variable.kind === "ordinal") {
    const n = rowNum(row, "level");
    return Number.isFinite(n) ? ordinalIncluido(sel, n) : true;
  }
  if (variable.kind === "numeric") {
    const t = sel.threshold;
    if (!t) return true;
    const n = rowNum(row, variable.id);
    if (!Number.isFinite(n)) return true; // sin edad: sin señal pasa
    if (t.op === ">=") return n >= (t.min ?? -Infinity);
    if (t.op === "<=") return n <= (t.max ?? Infinity);
    return n >= (t.min ?? -Infinity) && n <= (t.max ?? Infinity);
  }
  return true;
}

/**
 * Conjunto de student_id permitidos por los criterios de alumno, computado sobre
 * el `population_pool` (universo con atributos crudos por estudiante SIN filtrar
 * por elegibilidad). Con el pool, TODOS los criterios de alumno son computables
 * cliente (formation/condition/age/faculty/level) y reaccionan en vivo. Si el
 * backend no trae pool (build viejo), cae al comportamiento previo: solo
 * faculty/level exactos, el resto pendiente hasta reconstruir.
 */
function idsPermitidosAlumno(
  catalogo: CriteriosCatalogo,
  seleccion: CriteriosSeleccionMarco,
  pool: MonitoreoRow[],
): { allow: Set<string> | null; activos: string[]; pendientes: string[] } {
  const activos: string[] = [];
  const pendientes: string[] = [];
  const alumno = catalogo.variables.filter((v) => v.scope === "alumno");

  // ¿El pool trae los atributos por estudiante? (edad/formación/condición).
  const muestra = pool[0];
  const poolCompleto = Boolean(
    muestra && ("age" in muestra || "formation" in muestra || "condition" in muestra),
  );
  const computableCliente = (id: string) =>
    poolCompleto || id === "faculty" || id === "level";

  const restrictivos: CriterioVariable[] = [];
  for (const v of alumno) {
    const sel = seleccionVariable(seleccion, v.id);
    if (!restrictivaAlumno(v, sel)) continue;
    if (computableCliente(v.id)) {
      activos.push(v.id);
      restrictivos.push(v);
    } else {
      pendientes.push(v.id); // sin pool: formation/condition/age solo al reconstruir
    }
  }

  if (!restrictivos.length) return { allow: null, activos, pendientes };

  const allow = new Set<string>();
  for (const r of pool) {
    const id = rowStr(r, "student_id").trim();
    if (!id) continue;
    const pasa = restrictivos.every((v) =>
      pasaVariableAlumno(v, seleccionVariable(seleccion, v.id), r),
    );
    if (pasa) allow.add(id);
  }
  return { allow, activos, pendientes };
}

/** Snapshot de impacto en vivo del marco (estimación cliente + cifra dura). */
export type ImpactoMarco = {
  hasFrame: boolean;
  aulasLive: number | null;
  docentesLive: number | null;
  estudiantesLive: number | null;
  aulasHard: number | null;
  docentesHard: number | null;
  estudiantesHard: number | null;
  /** ids de variables de aula que están restringiendo el marco ahora. */
  activeAulaVars: string[];
  /** ids de criterios de alumno marco computables cliente (faculty/level). */
  activeAlumnoVars: string[];
  /** ids de criterios de alumno marco cuyo impacto SOLO fija el motor. */
  pendingAlumnoVars: string[];
};

/**
 * Recomputa el impacto en vivo. `frame` = { population, aula_frame } del build;
 * `refs` = cifras duras del último build (para la referencia autoritativa).
 */
export function computeImpactoMarco(
  catalogo: CriteriosCatalogo,
  seleccion: CriteriosSeleccionMarco,
  frame:
    | {
        population?: MonitoreoRow[] | null;
        population_pool?: MonitoreoRow[] | null;
        aula_frame?: MonitoreoRow[] | null;
      }
    | null
    | undefined,
  refs: { poblacionN?: number | null; marcoAulas?: number | null } = {},
): ImpactoMarco {
  const aulaFrame = frame?.aula_frame ?? [];
  const population = frame?.population ?? [];
  // El pool trae el universo con atributos por estudiante (para el conteo en
  // vivo de todos los criterios de alumno); si el build es viejo y no lo trae,
  // se usa `population` (solo faculty/level reactivos).
  const pool = frame?.population_pool ?? population;
  const hasFrame = aulaFrame.length > 0;

  const alumnoIds = idsPermitidosAlumno(catalogo, seleccion, pool);
  const empty: ImpactoMarco = {
    hasFrame,
    aulasLive: null,
    docentesLive: null,
    estudiantesLive: null,
    aulasHard: refs.marcoAulas ?? null,
    docentesHard: null,
    estudiantesHard: refs.poblacionN ?? (population.length || null),
    activeAulaVars: [],
    activeAlumnoVars: alumnoIds.activos,
    pendingAlumnoVars: alumnoIds.pendientes,
  };
  if (!hasFrame) return empty;

  const incluidas = aulasIncluidas(aulaFrame);
  const docentesHard = docentesDistintos(incluidas);
  // Cifra dura de estudiantes = alcanzados por el marco construido (misma
  // métrica que la estimación en vivo), no `poblacionN`: así en reposo la
  // estimación coincide con la referencia y solo baja al endurecer.
  const estudiantesHard = estudiantesAlcanzados(incluidas) || refs.poblacionN || (population.length || null);

  const aulaVars = catalogo.variables.filter((v) => v.scope === "aula");
  const activeAulaVars = aulaVars.filter((v) => restrictivaAula(v, seleccion)).map((v) => v.id);

  const umbral = minEligibleThreshold(seleccion, 0);
  let base = incluidas;
  if (umbral > 0) base = base.filter((r) => rowNum(r, "eligible_n") >= umbral);
  for (const v of aulaVars) {
    if (!restrictivaAula(v, seleccion)) continue;
    base = base.filter((r) => pasaVariableAula(v, seleccion, r));
  }

  return {
    hasFrame,
    aulasLive: base.length,
    docentesLive: docentesDistintos(base),
    estudiantesLive: estudiantesAlcanzados(base, alumnoIds.allow),
    aulasHard: refs.marcoAulas ?? incluidas.length,
    docentesHard,
    estudiantesHard,
    activeAulaVars,
    activeAlumnoVars: alumnoIds.activos,
    pendingAlumnoVars: alumnoIds.pendientes,
  };
}

/** Un curso-horario de la lista final de selección manual por facultad. */
export type AulaFinal = {
  /** classroom_id crudo (para mostrar y como key del toggle). */
  classroomId: string;
  /** text_key del classroom_id, para casar con `manualExcludedClassrooms`. */
  classroomKey: string;
  /** Curso · sección (línea principal). */
  label: string;
  /** Horario · docente (línea secundaria; puede ir vacía). */
  detalle: string;
  /** Alumnos elegibles del aula (orden desc). */
  eligibleN: number;
};

/**
 * Cursos-horario supervivientes de una facultad para la lista final de
 * selección manual (el criterio más granular). Son los que quedaron INCLUIDOS
 * en el último marco construido, más los que solo salieron por exclusión manual
 * (para poder reactivarlos). Ordenados por elegibles desc. Lee el `aula_frame`
 * del build tal cual: el motor ya aplicó los criterios por facultad, así que no
 * se re-filtra aquí (evita divergir del cálculo autoritativo).
 */
export function aulasSupervivientesFacultad(
  aulaFrame: MonitoreoRow[] | null | undefined,
  facultadLabel: string,
): AulaFinal[] {
  const facKey = textKey(facultadLabel);
  const rows = (aulaFrame ?? []).filter((r) => {
    if (textKey(rowStr(r, "faculty")) !== facKey) return false;
    if (rowBool(r, "included")) return true;
    // Excluida SOLO a mano: sigue en la lista, apagada, para poder reactivarla.
    return rowStr(r, "exclude_reason").trim() === "manual_excluded";
  });
  return rows
    .map((r): AulaFinal => {
      const classroomId = rowStr(r, "classroom_id");
      const curso = rowStr(r, "course_name") || rowStr(r, "label") || classroomId;
      const seccion = rowStr(r, "section");
      const detalle = [rowStr(r, "schedule"), rowStr(r, "teacher")].filter(Boolean).join(" · ");
      return {
        classroomId,
        classroomKey: textKey(classroomId),
        label: seccion ? `${curso} · ${seccion}` : curso,
        detalle,
        eligibleN: rowNum(r, "eligible_n"),
      };
    })
    .sort(
      (a, b) => (b.eligibleN || 0) - (a.eligibleN || 0) || a.label.localeCompare(b.label, "es"),
    );
}
