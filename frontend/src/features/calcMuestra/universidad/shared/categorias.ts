import {
  type CalcMuestraAulasSheetInspectionSheet,
  type CalcMuestraAulasState,
  type CalcMuestraEstrato,
  type CalcMuestraWorkspace,
  type CalcMuestraWorkspaceCategoryMapping,
  type CalcMuestraWorkspaceSourceBinding,
  type CalcMuestraWorkspaceSourceMode,
  type CalcMuestraWorkspaceVariableMapping,
} from "../../../../api/client";
import { rowsFrom, safeNumber } from "../../sharedCore";
import {
  UNIVERSITY_REQUIRED_VARIABLES,
  UNIVERSITY_SOURCE_BINDING_DEFAULTS,
} from "./constants";
import {
  classroomRowNumber,
  classroomRowText,
  compareDescriptiveRows,
  normalizeColumnName,
  rowKeyForCandidates,
  type CrossTableSortMode,
  type DescriptiveBarRow,
} from "./format";

export function ensureUniversitySourceBindings(
  mode: CalcMuestraWorkspaceSourceMode,
  current: CalcMuestraWorkspaceSourceBinding[] | undefined,
) {
  const defaults = UNIVERSITY_SOURCE_BINDING_DEFAULTS[mode] ?? UNIVERSITY_SOURCE_BINDING_DEFAULTS.base_madre;
  const byRole = new Map((current ?? []).map((item) => [item.role, item]));
  return defaults.map((item) => ({ ...item, ...(byRole.get(item.role) ?? {}) }));
}

export function expectedSheetRolesForSource(role: string) {
  if (role === "base_madre") return ["base_madre"];
  if (role === "estudiantes") return ["estudiantes", "base_madre"];
  if (role === "catalogo_curso_horario") return ["catalogo_curso_horario", "base_madre"];
  if (role === "inscripciones") return ["inscripciones", "base_madre"];
  if (role === "muestra_previa") return ["muestra_previa"];
  if (role === "agenda") return ["agenda"];
  return [];
}

export function sourceBindingDiagnostics(binding: CalcMuestraWorkspaceSourceBinding) {
  return rowsFrom<CalcMuestraAulasSheetInspectionSheet>(binding.sheet_diagnostics);
}

export function sourceBindingSelectedSheet(binding: CalcMuestraWorkspaceSourceBinding) {
  return binding.sheet_name?.trim() || binding.suggested_sheet?.trim() || binding.available_sheets?.[0] || "";
}

export function sourceBindingSelectedDiagnostic(binding: CalcMuestraWorkspaceSourceBinding) {
  const selected = sourceBindingSelectedSheet(binding);
  return sourceBindingDiagnostics(binding).find((sheet) => sheet.name === selected);
}

export function sourceBindingCompatibleForBuild(binding: CalcMuestraWorkspaceSourceBinding) {
  if (!binding.file_id) return false;
  const availableSheets = binding.available_sheets ?? [];
  const selected = sourceBindingSelectedSheet(binding);
  if (availableSheets.length > 0 && (!selected || !availableSheets.includes(selected))) return false;
  const diagnostics = sourceBindingDiagnostics(binding);
  if (!diagnostics.length) return true;
  const diagnostic = sourceBindingSelectedDiagnostic(binding);
  if (!diagnostic?.role) return false;
  const expected = expectedSheetRolesForSource(binding.role);
  return expected.length === 0 || expected.includes(diagnostic.role);
}

export function sourceRoleLabel(role: string) {
  const labels: Record<string, string> = {
    base_madre: "Base principal",
    estudiantes: "Estudiantes",
    catalogo_curso_horario: "Catálogo de cursos y horarios",
    inscripciones: "Inscripciones",
    muestra_previa: "Muestra previa",
    agenda: "Agenda",
  };
  return labels[role] ?? role.replace(/_/g, " ");
}

export function sourceBindingRole(binding: CalcMuestraWorkspaceSourceBinding) {
  return sourceBindingSelectedDiagnostic(binding)?.role ?? binding.detected_role ?? "";
}

export function canBuildUniversityDeskFrameFromBindings(bindings: CalcMuestraWorkspaceSourceBinding[]) {
  const byRole = (role: string) => bindings.find((item) => item.role === role);
  const primary = byRole("estudiantes");
  if (!primary?.file_id || !sourceBindingCompatibleForBuild(primary)) return false;
  if (sourceBindingRole(primary) === "base_madre") return true;
  const inscripciones = byRole("inscripciones");
  return Boolean(inscripciones?.file_id && sourceBindingCompatibleForBuild(inscripciones));
}

export function sourceBindingBuildMessage(binding: CalcMuestraWorkspaceSourceBinding) {
  const selected = sourceBindingSelectedSheet(binding);
  const available = (binding.available_sheets ?? []).filter(Boolean);
  const diagnostic = sourceBindingSelectedDiagnostic(binding);
  const roleLabel = diagnostic?.role_label || sourceRoleLabel(diagnostic?.role ?? binding.detected_role ?? "desconocida");
  if (!binding.file_id) return `Sube primero el archivo para ${binding.label}.`;
  if (available.length && selected && !available.includes(selected)) {
    return `La pestaña "${selected}" no existe en ese Excel. Hojas disponibles: ${available.join(", ")}.`;
  }
  if (binding.role === "base_madre") {
    return `Excel cargado, pero la hoja "${selected || "seleccionada"}" parece "${roleLabel}", no una base principal con estudiante por curso y horario. Elige una hoja compatible o cambia el modo a selección previa + agenda. Hojas encontradas: ${available.join(", ") || "sin hojas detectadas"}.`;
  }
  return `Excel cargado, pero la hoja "${selected || "seleccionada"}" no parece compatible con "${sourceRoleLabel(binding.role)}". Revisa la pestaña antes de construir el marco.`;
}

export function sourceBindingPatchForSheet(binding: CalcMuestraWorkspaceSourceBinding, sheetName: string): Partial<CalcMuestraWorkspaceSourceBinding> {
  const diagnostic = sourceBindingDiagnostics({ ...binding, sheet_name: sheetName }).find((sheet) => sheet.name === sheetName);
  const preview = {
    ...binding,
    sheet_name: sheetName,
    detected_role: diagnostic?.role ?? binding.detected_role,
  };
  return {
    sheet_name: sheetName,
    detected_role: diagnostic?.role ?? binding.detected_role,
    compatibility_status: sourceBindingCompatibleForBuild(preview) ? "compatible" : "revisar",
    status: binding.file_id ? (sourceBindingCompatibleForBuild(preview) ? "cargada" : "revisar") : binding.status,
  };
}

export function categoryCountBaseLabel(unitLabel: string) {
  const normalized = String(unitLabel ?? "").trim().toLowerCase();
  if (normalized.includes("elegible")) return "elegibles";
  if (normalized.includes("aula") || normalized.includes("curso-horario")) return "cursos-horario";
  if (normalized.includes("registro")) return "registros";
  return "filas con valor";
}

export function categoryCountSummaryLabel(unitLabel: string) {
  const normalized = categoryCountBaseLabel(unitLabel);
  if (normalized === "elegibles") return "Elegibles con valor";
  if (normalized === "cursos-horario") return "Cursos-horario con valor";
  if (normalized === "registros") return "Registros con valor";
  return "Filas con valor";
}

export function universityInspectedColumnOptions(workspace: CalcMuestraWorkspace) {
  const inspectedColumns = (workspace.source_bindings ?? []).flatMap((binding) => {
    const selected = sourceBindingSelectedSheet(binding);
    const diagnostics = sourceBindingDiagnostics(binding);
    const selectedDiagnostic = diagnostics.find((sheet) => sheet.name === selected) ?? diagnostics[0];
    return rowsFrom<string>(selectedDiagnostic?.columns_sample);
  });
  return Array.from(new Set(inspectedColumns))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
}

export function universityColumnOptions(workspace: CalcMuestraWorkspace, aulasState: CalcMuestraAulasState | null) {
  const frame = aulasState?.frame ?? null;
  const sampleRows = [
    ...rowsFrom<Record<string, unknown>>(frame?.population).slice(0, 6),
    ...rowsFrom<Record<string, unknown>>(frame?.aula_frame).slice(0, 6),
  ];
  const inspectedColumns = universityInspectedColumnOptions(workspace);
  return Array.from(new Set([...sampleRows.flatMap((row) => Object.keys(row)), ...inspectedColumns]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
}

export type UniversityColumnSourceGroup = "student" | "classroom";

export type UniversityColumnsBySource = Record<UniversityColumnSourceGroup, string[]>;

/**
 * Mapea el `source_role` de una variable (§3.3.1) a la hoja de la que debe
 * ofrecer columnas. Solo el catálogo de cursos-horario alimenta el lado "aula";
 * todo lo demás (base madre, estudiantes, inscripciones) es "estudiante".
 */
export function universitySourceGroupForRole(sourceRole: string | undefined | null): UniversityColumnSourceGroup {
  return sourceRole === "catalogo_curso_horario" ? "classroom" : "student";
}

/**
 * Columnas disponibles POR FUENTE/HOJA (§ADR 0035): las opciones de un rol
 * salen SOLO de su hoja. Los roles de alumno (source_role "base_madre") leen la
 * base madre / MATRICULADO; los roles de curso-horario (source_role
 * "catalogo_curso_horario") leen el catálogo / CURSO Y HORARIO. En modo de una
 * sola base (binding "base_madre") ambas fuentes comparten esa hoja, así que no
 * hay contaminación posible. La lista queda sin filtrar por user-facing (el
 * caller aplica isUniversityUserFacingColumnName cuando lo necesita).
 */
export function universityColumnOptionsBySource(
  workspace: CalcMuestraWorkspace,
  aulasState: CalcMuestraAulasState | null,
): UniversityColumnsBySource {
  const bindings = workspace.source_bindings ?? [];
  const inspectedForBinding = (role: string): string[] => {
    const binding = bindings.find((item) => item.role === role);
    if (!binding) return [];
    const selected = sourceBindingSelectedSheet(binding);
    const diagnostics = sourceBindingDiagnostics(binding);
    const selectedDiagnostic = diagnostics.find((sheet) => sheet.name === selected) ?? diagnostics[0];
    return rowsFrom<string>(selectedDiagnostic?.columns_sample);
  };
  const uniqueSorted = (values: string[]) =>
    Array.from(new Set(values)).filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
  // El binding "base_madre" (modo una sola base) alimenta ambas fuentes: todo
  // vive en la misma hoja y ahí no hay dos hojas que separar. El modo dos_bases
  // admite además que el binding "estudiantes" tenga rol DETECTADO base_madre
  // (una sola hoja que sirve a alumno Y curso-horario, sin catálogo aparte); en
  // ese caso sus columnas también alimentan el grupo classroom, o los roles de
  // aula quedarían sin opciones. Cuando la hoja de estudiantes es un roster real
  // (rol "estudiantes", caso HST_UNSA2 con catálogo separado) NO se comparte.
  const estudiantesBinding = bindings.find((item) => item.role === "estudiantes");
  const estudiantesEsBaseUnica = Boolean(
    estudiantesBinding && sourceBindingRole(estudiantesBinding) === "base_madre",
  );
  const shared = [
    ...inspectedForBinding("base_madre"),
    ...(estudiantesEsBaseUnica ? inspectedForBinding("estudiantes") : []),
  ];
  const studentInspected = uniqueSorted([...shared, ...inspectedForBinding("estudiantes")]);
  const classroomInspected = uniqueSorted([...shared, ...inspectedForBinding("catalogo_curso_horario")]);
  const frame = aulasState?.frame ?? null;
  // Solo columnas CRUDAS del frame procesado: sin las señales DERIVADAS del
  // motor (exclude_reason, course_level_num, sex_top_1_n…) que no existen en la
  // hoja original (§ADR 0035). El frame es únicamente fallback: la inspección
  // (head de nombres de la hoja) es la fuente de verdad de columnas reales.
  const rawFromSample = (rows: Array<Record<string, unknown>>) =>
    uniqueSorted(rows.flatMap((row) => Object.keys(row)).filter((column) => !isUniversityDerivedColumnName(column)));
  const studentSample = rawFromSample(rowsFrom<Record<string, unknown>>(frame?.population).slice(0, 6));
  const classroomSample = rawFromSample(rowsFrom<Record<string, unknown>>(frame?.aula_frame).slice(0, 6));
  return {
    // Preferimos SIEMPRE las columnas crudas inspeccionadas de la hoja; el frame
    // procesado solo entra si la hoja aún no fue inspeccionada.
    student: studentInspected.length ? studentInspected : studentSample,
    classroom: classroomInspected.length ? classroomInspected : classroomSample,
  };
}

/**
 * Opciones de columna que ve una tarjeta de rol: SOLO la hoja de su fuente,
 * filtradas a columnas de cara al usuario. Siempre incluye la columna ya
 * confirmada (para que la tarjeta renderice aunque el marco cambie).
 */
export function universityRoleColumnOptions(
  columnsBySource: UniversityColumnsBySource,
  sourceRole: string | undefined | null,
  confirmedColumn?: string,
): string[] {
  const group = universitySourceGroupForRole(sourceRole);
  const cols = group === "classroom" ? columnsBySource.classroom : columnsBySource.student;
  const confirmed = confirmedColumn?.trim() ? [confirmedColumn.trim()] : [];
  return Array.from(new Set([...cols, ...confirmed]))
    .filter(isUniversityUserFacingColumnName)
    .sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Proyecta la selección MANUAL del usuario sobre la lista canónica de roles
 * requeridos, SIN inferir ninguna columna: el mapeo es una decisión consciente
 * 1-a-1 (§3.3.1). Antes auto-asignaba `inferUniversityColumn` a cada rol vacío,
 * y esa auto-asignación (a) llegaba a persistirse y (b) secuestraba columnas
 * cross-hoja — el usuario veía roles "mapeados" que nunca eligió. La sugerencia
 * vive solo como hint NO persistido en la UI de mapeo (DefVariablesTab).
 * `_detectedColumns` se conserva en la firma por compatibilidad de llamadas.
 */
export function ensureUniversityVariableMappings(
  current: CalcMuestraWorkspaceVariableMapping[] | undefined,
  _detectedColumns: string[],
) {
  const byRole = new Map((current ?? []).map((item) => [item.role, item]));
  return UNIVERSITY_REQUIRED_VARIABLES.map((base) => {
    const existing = byRole.get(base.role);
    return { ...base, column: existing?.column ?? "" };
  });
}

/**
 * Al cambiar/recargar la base solo PODA lo que ya no aplica; NUNCA auto-asigna
 * una columna inferida (§3.3.1: el mapeo es manual 1-a-1). Antes reinfería y
 * pisaba la elección del usuario — así teacher_type terminaba en "Condición" —.
 * Conserva cada columna elegida que siga existiendo; limpia la que desapareció
 * de la base o que sea una columna interna/derivada del motor (no una columna
 * real de la hoja). Los roles sin mapear quedan vacíos (el usuario los mapea).
 */
export function reconcileUniversityVariableMappingsForColumns(
  current: CalcMuestraWorkspaceVariableMapping[] | undefined,
  detectedColumns: string[],
) {
  const base = ensureUniversityVariableMappings(current, detectedColumns);
  if (!detectedColumns.length) return base;
  const columnSet = new Set(detectedColumns);
  return base.map((row) => {
    const selected = row.column?.trim() ?? "";
    if (selected && (!columnSet.has(selected) || isUniversityInternalColumnName(selected))) {
      return { ...row, column: "" };
    }
    return row;
  });
}

export function isUniversityInternalColumnName(value: string) {
  const normalized = normalizeColumnName(value);
  return [
    "studentid",
    "faculty",
    "program",
    "sex",
    "level",
    "stratum",
    "courseid",
    "coursescheduleid",
    "coursename",
    "classroom",
    "classroomid",
    "teacher",
    "schedule",
    "modality",
    "eligible",
    "eligiblen",
    "eligibleratio",
    "eligibleunique",
    "eligibleflag",
    "enrolledtotal",
    "studentsn",
    "matriculadospoblacion",
    "uniquestudenthash",
    "studenthash",
    "selectionprobability",
    "probability",
    "weight",
    "wave",
    "rank",
    "rowid",
    "included",
    "selected",
    "methodid",
    "selectorengine",
    "framehash",
    "sextop1",
    "sextop2",
    "sexn1",
    "sexn2",
    "sexshare1",
    "sexshare2",
    "sizegroup",
    "condition",
  ].includes(normalized);
}

/**
 * Columnas DERIVADAS/sintéticas del motor de marco: no existen en la hoja cruda
 * (son señales de exclusión, agregados de sexo, ratios, claves de estrato,
 * niveles numéricos, etc.). Se excluyen cuando las opciones de columna se
 * derivan del frame PROCESADO (frame.aula_frame / population) en vez de la
 * inspección cruda de la hoja — §ADR 0035: el mapeo ofrece columnas REALES de
 * la base, nunca computadas. Reutiliza la lista de columnas internas y suma las
 * derivadas que esa lista no cubre.
 */
const UNIVERSITY_DERIVED_COLUMN_NAMES = new Set<string>([
  "courselevelnum",
  "excludereason",
  "label",
  "section",
  "prevalenceratio",
  "cyclehomogeneity",
  "teachertype",
  "teachereval",
  "coursefacultylevelpairs",
  "uniquestudentids",
  "campus",
  "sextop1n",
  "sextop2n",
]);

export function isUniversityDerivedColumnName(value: string) {
  const normalized = normalizeColumnName(value);
  if (!normalized) return false;
  if (UNIVERSITY_DERIVED_COLUMN_NAMES.has(normalized)) return true;
  return isUniversityInternalColumnName(value);
}

export function isUniversityUserFacingColumnName(value: string) {
  const normalized = normalizeColumnName(value);
  if (!normalized) return false;
  if (isUniversityInternalColumnName(value)) return false;
  if (/^(sex|gender)(top|n|share)\d+$/.test(normalized)) return false;
  if (/^(m|n|w)\d+$/.test(normalized)) return false;
  if (normalized.endsWith("hash") || normalized.endsWith("idinternal")) return false;
  return true;
}

export function inferUniversityColumn(role: string, columns: string[]) {
  if (!columns.length) return "";
  const normalized = columns.map((column) => ({ column, normalized: normalizeColumnName(column) }));
  const synonyms: Record<string, string[]> = {
    student_id: ["studentid", "codigopucp", "codpucp", "codigoestudiante", "codigointerno", "codalumno", "idalumno", "idstudent", "codigo"],
    faculty: [
      "faculty", "facultadestudiante", "facultadalumno", "facultaddematricula",
      "facultadmatricula", "nombrefac", "nombrefacultad", "facultad",
      "unidadacademicaestudiante", "unidadacademicaalumno", "unidadacademica", "escuela",
    ],
    program: [
      "program", "programa", "carreraestudiante", "carreraalumno",
      "programaestudiante", "programaalumno", "nombreesp",
      "especialidadestudiante", "especialidadalumno", "carrera", "especialidad",
    ],
    sex: ["sex", "sexo", "genero", "gender"],
    // Acuerdo 2026-07-15 (reunión del diseño muestral): "el nivel curricular
    // manda; créditos es apoyo". Las variantes curriculares/ciclo van ANTES que
    // las de créditos — espejo del orden del motor R (calc_muestra_aulas.R).
    level: ["level", "nivelcurricular", "ciclo", "nivelseguncreditos", "nivelseguncredito", "nivelporcreditos", "nivelcreditos", "nivel", "anio", "ano", "semestre"],
    formation: ["formation", "formacion", "nivelacademico", "nivelformativo"],
    course_id: ["courseid", "cursoid", "codigocurso", "codcurso", "curso"],
    course_schedule_id: ["coursescheduleid", "cursohorario", "codigocursohorario", "idcursohorario", "seccionhorario", "nrc"],
    course_name: ["coursename", "nombredelcurso", "nombrecurso", "asignatura", "curso"],
    classroom: ["classroom", "aula", "seccion", "salon"],
    teacher: ["teacher", "docente", "profesor", "contacto"],
    teacher_type: ["teachertype", "tipodedocente", "tipodocente", "categoriadocente", "dedicaciondocente", "condiciondocente"],
    schedule: ["schedule", "horario", "turno", "bloque"],
    modality: ["modality", "modalidad", "tipo"],
    age: ["age", "edad"],
    session_type: ["sessiontype", "tipodesesion", "tiposesion", "tipodecurso", "tipocurso", "tipodeclase", "actividad"],
    enrolled_total: ["enrolledtotal", "cantidadmatriculados", "matriculadostotal", "totalmatriculados", "matriculados"],
    course_level: ["courselevel", "nivelcurso", "niveldelcurso", "ciclocurso", "ciclodelcurso"],
    campus: ["campus", "sede", "filial"],
    condition: ["condition", "condicion", "condicionmatricula", "elegible", "habilitado", "valido", "regular"],
    condicion_curso: ["condicioncurso", "condiciondelcurso", "condicion", "tipodecurso", "tipocurso", "obligatorioelectivo", "obligatorioelectivotaller"],
    eligible: ["eligible", "elegible", "habilitado", "valido", "regular", "condicion", "condiciondelcurso"],
  };
  for (const synonym of synonyms[role] ?? []) {
    const exact = normalized.find((item) => item.normalized === synonym);
    if (exact) return exact.column;
  }
  if (role === "course_schedule_id") {
    const direct = normalized.find((item) =>
      item.normalized.includes("cursohorario") ||
      item.normalized.includes("courseschedule") ||
      item.normalized.includes("seccionhorario") ||
      item.normalized === "nrc" ||
      item.normalized === "crn" ||
      (item.normalized.includes("curso") && item.normalized.includes("horario"))
    );
    return direct?.column ?? "";
  }
  // formation NO participa del pase parcial: el substring bidireccional
  // secuestraría columnas como "Nivel" (⊂ "nivelacademico") o "Información
  // adicional" (⊇ "formacion") — misma clase de bug que el colapso de
  // identidad de aula (H4). Solo se automapea con match exacto normalizado.
  if (role === "formation") return "";
  // Solo el sentido SEGURO del substring: la columna CONTIENE el sinónimo
  // completo (p.ej. "Tipo de docente (categoría)" ⊇ "tipodedocente"). El sentido
  // inverso —un sinónimo que contiene a la columna corta— secuestraba columnas
  // genéricas hacia el rol equivocado (teacher_type ← "Condición", porque
  // "condiciondocente" ⊇ "condicion"): misma clase de bug que ya se excluyó en
  // formation. El match exacto de arriba ya cubrió el caso limpio.
  for (const synonym of synonyms[role] ?? []) {
    const partial = normalized.find((item) => item.normalized.includes(synonym));
    if (partial) return partial.column;
  }
  return "";
}

export type UniversityObservedCategory = {
  role: string;
  variableLabel: string;
  sourceRole?: string;
  column: string;
  observedColumn: string;
  raw: string;
  label: string;
  count: number;
  unitLabel?: string;
  saved: boolean;
};

export type CategoryLabeler = (raw: string, selectedKey?: string) => string;

export const UNIVERSITY_CATEGORY_ROLES = new Set([
  "faculty",
  "program",
  "sex",
  "level",
  "condition",
  "schedule",
  "modality",
  "session_type",
  "condicion_curso",
  "campus",
]);

// Roles CATEGÓRICOS que viven en la hoja de curso-horario (aula_frame), no en la
// de matrícula: sus categorías observadas se computan sobre las filas del aula,
// no de la población de estudiantes.
export const UNIVERSITY_CLASSROOM_CATEGORY_ROLES = new Set([
  "schedule",
  "modality",
  "session_type",
  "condicion_curso",
  "campus",
]);

export const UNIVERSITY_ROLE_VALUE_KEYS: Record<string, string[]> = {
  faculty: [
    "faculty", "facultad_estudiante", "facultad_alumno", "facultad_de_matricula",
    "facultad_matricula", "nombrefac", "nombre_facultad", "facultad",
    "unidad_academica_estudiante", "unidad_academica_alumno", "unidad_academica", "escuela", "stratum",
  ],
  program: [
    "program", "programa", "carrera_estudiante", "carrera_alumno",
    "programa_estudiante", "programa_alumno", "nombreesp",
    "especialidad_estudiante", "especialidad_alumno", "carrera", "especialidad",
  ],
  sex: ["sex", "sexo", "genero", "gender"],
  level: ["level", "nivelseguncreditos", "nivelseguncredito", "nivelporcreditos", "nivelcreditos", "nivelcurricular", "ciclo", "nivel", "anio", "ano", "semestre"],
  condition: ["condition", "condicion", "eligible", "elegible", "status", "estado"],
  schedule: ["schedule", "horario", "turno", "bloque"],
  modality: ["modality", "modalidad", "tipo_modalidad"],
};

export function isUniversityCategoryRole(role: string) {
  return UNIVERSITY_CATEGORY_ROLES.has(role);
}

export function normalizeObservedCategoryKey(value: string) {
  return normalizeColumnName(String(value ?? "").trim());
}

/**
 * Etiqueta mostrada de una categoría = su valor CRUDO tal cual la data (solo
 * trim de espacios). Requisito explícito del usuario (ADR 0035 fase 3): nada de
 * normalizar/renombrar/reetiquetar valores ("REGULAR" se muestra "REGULAR", no
 * "Elegible"; "1"/"2" de sexo no se traducen a "Hombre"/"Mujer"). El `role` se
 * conserva en la firma por compatibilidad con los llamadores, pero no altera el
 * valor. El renombrado, si el usuario lo quiere, es una decisión MANUAL que vive
 * en workspace.category_mappings (etiqueta guardada), no una heurística.
 */
export function suggestUniversityCategoryLabel(_role: string, raw: string) {
  const text = String(raw ?? "").trim();
  return text || "Sin dato";
}

export function findWorkspaceCategoryMapping(
  workspace: CalcMuestraWorkspace,
  role: string,
  raw: string,
  column?: string,
) {
  const rawKey = normalizeObservedCategoryKey(raw);
  const mappings = workspace.category_mappings ?? [];
  const exact = mappings.filter((mapping) => mapping.role === role && (mapping.column ?? "") === (column ?? ""));
  const roleOnly = mappings.filter((mapping) => mapping.role === role && !exact.includes(mapping));
  for (const mapping of [...exact, ...roleOnly]) {
    const value = (mapping.values ?? []).find((item) => normalizeObservedCategoryKey(item.raw) === rawKey);
    if (value) return value;
  }
  return null;
}

export function workspaceCategoryLabel(workspace: CalcMuestraWorkspace | undefined, role: string, raw: string, column?: string) {
  if (!workspace) return suggestUniversityCategoryLabel(role, raw);
  const saved = findWorkspaceCategoryMapping(workspace, role, raw, column);
  return saved?.label ?? suggestUniversityCategoryLabel(role, raw);
}

export function universityCategoryKeysForMapping(row: CalcMuestraWorkspaceVariableMapping) {
  return Array.from(new Set([
    row.column ?? "",
    row.role,
    ...(UNIVERSITY_ROLE_VALUE_KEYS[row.role] ?? []),
  ].filter(Boolean)));
}

export function categoryUnitLabel(role: string, fallback?: string) {
  const cleaned = String(fallback ?? "").trim().toLowerCase();
  if (cleaned.includes("elegible")) return "elegibles";
  if (cleaned.includes("aula") || cleaned.includes("curso-horario")) return "cursos-horario";
  if (cleaned.includes("fila")) return "filas";
  if (cleaned.includes("registro")) return "registros";
  if (UNIVERSITY_CLASSROOM_CATEGORY_ROLES.has(role)) return "cursos-horario";
  return "filas";
}

export function observedCategoryCounts(rows: Array<Record<string, unknown>>, keys: string[]) {
  const selectedKey = rows.reduce<string>((found, row) => {
    if (found) return found;
    return rowKeyForCandidates(row, keys);
  }, "");
  if (!selectedKey) return [];
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const raw = String(row[selectedKey] ?? "").trim();
    if (!raw) return;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([raw, count]) => ({ raw, count, observedColumn: selectedKey }))
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw, "es"));
}

export function observedClassroomSexCategoryCounts(rows: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    [
      [classroomRowText(row, ["sex_top_1", "sexo_top_1"]), classroomRowNumber(row, ["sex_top_1_n", "sexo_top_1_n"])],
      [classroomRowText(row, ["sex_top_2", "sexo_top_2"]), classroomRowNumber(row, ["sex_top_2_n", "sexo_top_2_n"])],
    ].forEach(([rawValue, rawCount]) => {
      const raw = String(rawValue ?? "").trim();
      const count = safeNumber(rawCount, 0);
      if (!raw || count <= 0) return;
      counts.set(raw, (counts.get(raw) ?? 0) + count);
    });
  });
  return Array.from(counts.entries())
    .map(([raw, count]) => ({ raw, count, observedColumn: "Sexo estimado en cursos-horario" }))
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw, "es"));
}

export function universityObservedCategoryRows(
  workspace: CalcMuestraWorkspace,
  aulasState: CalcMuestraAulasState | null,
  maxPerVariable = Number.POSITIVE_INFINITY,
): UniversityObservedCategory[] {
  const detectedColumns = universityColumnOptions(workspace, aulasState).filter(isUniversityUserFacingColumnName);
  const mappings = ensureUniversityVariableMappings(workspace.variable_mappings, detectedColumns)
    .filter((row) => isUniversityCategoryRole(row.role) && Boolean(row.column));
  const frame = aulasState?.frame ?? null;
  const profileRows = rowsFrom<Record<string, unknown>>((frame as Record<string, unknown> | null)?.category_profiles);
  return mappings.flatMap((mapping) => {
    const profiles = profileRows.filter((profile) => {
      const role = classroomRowText(profile, ["role"]);
      const profileColumn = classroomRowText(profile, ["column"]);
      return role === mapping.role && (
        !profileColumn ||
        !mapping.column ||
        normalizeColumnName(profileColumn) === normalizeColumnName(mapping.column)
      );
    });
    if (profiles.length) {
      return profiles
        .map((profile) => {
          const raw = classroomRowText(profile, ["raw", "value", "category"]);
          const column = classroomRowText(profile, ["column"]) || mapping.column || "";
          const saved = findWorkspaceCategoryMapping(workspace, mapping.role, raw, column);
          return {
            role: mapping.role,
            variableLabel: mapping.label,
            sourceRole: classroomRowText(profile, ["source_role"]) || mapping.source_role,
            column,
            observedColumn: column,
            raw,
            label: saved?.label ?? suggestUniversityCategoryLabel(mapping.role, raw),
            count: classroomRowNumber(profile, ["count", "n", "value"]),
            unitLabel: categoryUnitLabel(mapping.role, classroomRowText(profile, ["unit_label", "unit"])),
            saved: Boolean(saved),
          };
        })
        .filter((row) => row.raw && row.count > 0)
        .slice(0, maxPerVariable);
    }
    const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
    const classroomRows = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
    const useClassroomRows = UNIVERSITY_CLASSROOM_CATEGORY_ROLES.has(mapping.role) || (!populationRows.length && classroomRows.length > 0);
    const rows = useClassroomRows ? classroomRows : populationRows;
    const observed = (mapping.role === "sex" && useClassroomRows
      ? observedClassroomSexCategoryCounts(rows)
      : observedCategoryCounts(rows, universityCategoryKeysForMapping(mapping))
    ).slice(0, maxPerVariable);
    return observed.map((item) => {
      const column = mapping.column || item.observedColumn;
      const saved = findWorkspaceCategoryMapping(workspace, mapping.role, item.raw, column);
      return {
        role: mapping.role,
        variableLabel: mapping.label,
        sourceRole: useClassroomRows ? "catalogo_curso_horario" : mapping.source_role,
        column,
        observedColumn: item.observedColumn,
        raw: item.raw,
        label: saved?.label ?? suggestUniversityCategoryLabel(mapping.role, item.raw),
        count: item.count,
        unitLabel: mapping.role === "sex" && useClassroomRows ? "elegibles" : useClassroomRows ? "cursos-horario" : categoryUnitLabel(mapping.role),
        saved: Boolean(saved),
      };
    });
  });
}

export function upsertWorkspaceCategoryValue(
  current: CalcMuestraWorkspaceCategoryMapping[] | undefined,
  target: UniversityObservedCategory,
  label: string,
) {
  const mappings = [...(current ?? [])];
  const mappingIndex = mappings.findIndex((mapping) =>
    mapping.role === target.role && (mapping.column ?? "") === target.column
  );
  const base: CalcMuestraWorkspaceCategoryMapping = mappingIndex >= 0
    ? { ...mappings[mappingIndex], values: [...(mappings[mappingIndex].values ?? [])] }
    : {
        role: target.role,
        label: target.variableLabel,
        source_role: target.sourceRole,
        column: target.column,
        values: [],
      };
  const rawKey = normalizeObservedCategoryKey(target.raw);
  const valueIndex = base.values.findIndex((item) => normalizeObservedCategoryKey(item.raw) === rawKey);
  const value = { raw: target.raw, label: label.trim() || suggestUniversityCategoryLabel(target.role, target.raw), include: true };
  if (valueIndex >= 0) {
    base.values[valueIndex] = { ...base.values[valueIndex], ...value };
  } else {
    base.values.push(value);
  }
  if (mappingIndex >= 0) {
    mappings[mappingIndex] = base;
  } else {
    mappings.push(base);
  }
  return mappings;
}

export function summarizeRowsByKeys(
  rows: Array<Record<string, unknown>>,
  keys: string[],
  labelFor?: CategoryLabeler,
  sortMode: CrossTableSortMode = "total",
  maxRows = 10,
) {
  const selectedKey = rows.reduce<string>((found, row) => found || rowKeyForCandidates(row, keys), "");
  if (!selectedKey) return [];
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const raw = row[selectedKey];
    const rawLabel = String(raw ?? "").trim();
    const label = rawLabel ? (labelFor ? labelFor(rawLabel, selectedKey) : rawLabel) : "";
    if (!label) return;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => compareDescriptiveRows(a, b, sortMode))
    .slice(0, maxRows);
}

export function universityCategoryProfileRows(
  rows: Array<Record<string, unknown>>,
  keys: string[],
  fallbackEstratos: CalcMuestraEstrato[],
  labelFor?: CategoryLabeler,
  sortMode: CrossTableSortMode = "total",
): DescriptiveBarRow[] {
  const summarized = summarizeRowsByKeys(rows, keys, labelFor, sortMode);
  if (summarized.length) return summarized;
  const normalizedKeys = keys.map(normalizeColumnName);
  if (normalizedKeys.some((key) => ["sex", "sexo", "genero", "gender"].includes(key))) {
    const mujeres = fallbackEstratos.reduce((sum, row) => sum + safeNumber(row.N_a, 0), 0);
    const hombres = fallbackEstratos.reduce((sum, row) => sum + safeNumber(row.N_b, 0), 0);
    return [
      { label: "Mujeres", value: mujeres },
      { label: "Hombres", value: hombres },
    ].filter((row) => row.value > 0);
  }
  return [];
}
