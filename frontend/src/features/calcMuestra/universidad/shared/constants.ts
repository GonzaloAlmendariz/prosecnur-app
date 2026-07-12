import {
  BarChart3,
  Database,
  FileText,
  RefreshCw,
  Settings2,
  Table2,
  Target,
} from "lucide-react";
import {
  type CalcMuestraAulasObjectiveConfig,
  type CalcMuestraEstrato,
  type CalcMuestraWorkspaceAulasConfig,
  type CalcMuestraWorkspaceAulasModalidad,
  type CalcMuestraWorkspaceAulasSelector,
  type CalcMuestraWorkspaceEscenario,
  type CalcMuestraWorkspacePublicationConfig,
  type CalcMuestraWorkspaceSourceBinding,
  type CalcMuestraWorkspaceSourceMode,
  type CalcMuestraWorkspaceVariableMapping,
} from "../../../../api/client";

export type ClassroomLabTab = "marco" | "objetivo" | "metodo" | "laboratorio" | "seleccion" | "reemplazos" | "auditoria";

export const CLASSROOM_LAB_TABS: Array<{ id: ClassroomLabTab; label: string; detail: string; icon: typeof Database }> = [
  { id: "marco", label: "Marco de aulas", detail: "Base convertida en curso-horario", icon: Database },
  { id: "objetivo", label: "Objetivo de muestra", detail: "Cuotas y aulas necesarias", icon: Target },
  { id: "metodo", label: "Comparar métodos", detail: "Elegir la opción más representativa", icon: Settings2 },
  { id: "laboratorio", label: "Simulación", detail: "Estabilidad y repetidos", icon: BarChart3 },
  { id: "seleccion", label: "Aulas titulares", detail: "Aulas que se intentan primero", icon: Table2 },
  { id: "reemplazos", label: "Reemplazos por aula", detail: "Rutas Rn.1, Rn.2...", icon: RefreshCw },
  { id: "auditoria", label: "Sustento técnico", detail: "Campos, pesos y fuentes", icon: FileText },
];

export const UNIVERSITY_TOTAL_COMPONENT_ID = "estudiantes_universidad";
export const UNIVERSITY_FACULTY_COMPONENT_ID = "estudiantes_facultad";

export const DEFAULT_UNIVERSITY_PUBLICATION_CONFIG: CalcMuestraWorkspacePublicationConfig = {
  google_sheets_enabled: false,
  spreadsheet_id: "",
  spreadsheet_url: "",
  publication_mode: "single_spreadsheet_multi_sheet",
  internal_sheet_name: "Calculo muestra - interno",
  client_sheet_name: "Calculo muestra - cliente",
  frame_sheet_name: "Marco muestral",
  sample_calculation_sheet_name: "Calculo muestral",
  classroom_selection_sheet_name: "Seleccion de aulas",
  replacement_sheet_name: "Aulas de reemplazo",
  operational_routes_sheet_name: "Rutas operativas de aulas",
  agenda_sheet_name: "Agenda de aulas",
  monitoring_handoff_sheet_name: "Plan para Monitoreo",
  methodology_sheet_name: "Sustento metodologico",
  include_workbook: true,
  include_methodology: true,
  include_frame_audit: true,
  include_sample_calculation: true,
  include_classroom_selection: true,
  include_replacements: true,
  pii_policy: "sin_pii_cliente",
};

export const UNIVERSITY_AULAS_SIZE_GROUPS: CalcMuestraWorkspaceAulasConfig["grupos_tamano"] = [
  { id: "G1", label: "G1", min: 15, max: 20, descripcion: "aulas pequeñas o especializadas" },
  { id: "G2", label: "G2", min: 21, max: 30, descripcion: "aulas medianas" },
  { id: "G3", label: "G3", min: 31, max: 40, descripcion: "aulas estándar" },
  { id: "G4", label: "G4", min: 41, max: null, descripcion: "aulas grandes o masivas" },
];

export const DEFAULT_UNIVERSITY_AULAS_OBJECTIVE: CalcMuestraAulasObjectiveConfig = {
  schema: "calc_muestra_aulas_representativity_objective_v1",
  primary_unit: "estudiantes_unicos_elegibles",
  variables: [
    { dimension: "faculty", label: "Facultad", aula_col: "faculty", student_col: "faculty", weight: 0.18, tolerance: 0.025, source_preference: "student" },
    { dimension: "program", label: "Programa", aula_col: "program", student_col: "program", weight: 0.14, tolerance: 0.04, source_preference: "student" },
    { dimension: "level", label: "Nivel/ciclo", aula_col: "level", student_col: "level", weight: 0.1, tolerance: 0.05, source_preference: "student" },
    { dimension: "schedule", label: "Horario", aula_col: "schedule", weight: 0.1, tolerance: 0.05, source_preference: "aula" },
    { dimension: "modality", label: "Modalidad", aula_col: "modality", weight: 0.06, tolerance: 0.03, source_preference: "aula" },
    { dimension: "size_group", label: "Tamaño de aula", aula_col: "size_group", weight: 0.08, tolerance: 0.05, source_preference: "aula" },
    { dimension: "sex", label: "Sexo", aula_col: "sex_top_1", student_col: "sex", weight: 0.1, tolerance: 0.025, source_preference: "student" },
  ],
  component_weights: {
    balance: 0.76,
    unique_coverage: 0.1,
    duplicate_loss: 0.06,
    dispersion: 0.05,
    weight_stability: 0.02,
    reserve_depth: 0.01,
  },
  duplicate_loss_tolerance: 0.15,
  dispersion_tolerance: 0.15,
  weight_cv_warn: 0.5,
  weight_cv_critical: 1,
  reserve_depth_target: 1,
  missing_policy: "redistribute_active_weights",
};

export const DEFAULT_UNIVERSITY_AULAS_CONFIG: CalcMuestraWorkspaceAulasConfig = {
  schema: "calc_muestra_workspace_aulas_v1",
  modalidad: "presencial_aula",
  selector: "cube_balanceado",
  selector_engine: "cube_balanceado",
  method_family: "balanced_probability",
  min_elegibles_aula: 15,
  accepted_conditions: ["regular"],
  require_undergraduate: true,
  require_adult: true,
  min_age: 18,
  require_in_person: true,
  // Espejo de los defaults del motor R (calc_muestra_aulas_default_config).
  exclude_session_patterns: [],
  exclude_modality_patterns: ["virtual", "remoto", "online", "distancia", "asincron"],
  exclude_level_patterns: ["posgrado", "postgrado", "maestria", "master", "doctorado"],
  require_stable_teacher: false,
  accepted_teacher_type_patterns: ["contratado", "ordinario"],
  // H7: el criterio de pregrado opera sobre la columna de formación real
  // cuando existe; sin columna, el motor cae al fallback por nivel.
  accepted_formation_patterns: ["pregrado"],
  nivel_por_unidad: {},
  accepted_campuses: [],
  // H9: excepciones de tipo de sesión por unidad (nace vacío).
  session_type_excepciones: {},
  min_prevalence_pct: 0.8,
  min_cycle_homogeneity_pct: 0.8,
  usar_grupos_tamano: true,
  grupos_tamano: UNIVERSITY_AULAS_SIZE_GROUPS,
  estratos_selector: ["faculty", "sex_top_1", "size_group"],
  balance_vars: ["faculty", "sex_top_1", "size_group", "program", "level"],
  spread_vars: ["program", "level", "schedule", "size_group"],
  candidate_pool_size: 500,
  simulation_runs: 500,
  mos_strategy: "eligible_yield_winsorized",
  coordination_mode: "permanent_random_number",
  replacement_depth_strategy: "max_complete_chains_by_cell",
  min_replacements_per_titular: 1,
  max_replacements_per_titular: 11,
  extra_pool_policy: "leftover_after_chains",
  replacement_equivalence_vars: ["faculty", "program", "level", "size_group", "modality", "sex_top_1", "schedule"],
  replacement_score_weights: {
    faculty: 35,
    program: 22,
    level: 12,
    size_group: 8,
    modality: 7,
    sex_top_1: 6,
    schedule: 4,
    eligible_n: 10,
    active_overlap: -18,
  },
  bolsas_reemplazo: 11,
  aulas_extra_operativas_default: 1,
  penalizacion_repetidos: 1.35,
  pps_weight: 0.25,
  coverage_weight: 1,
  monte_carlo_n: 500,
  semilla: 20260619,
  objective: DEFAULT_UNIVERSITY_AULAS_OBJECTIVE,
  notas_metodologicas:
    "Selector reproducible sobre un marco de cursos y horarios: balancea cuotas, tamaño de aula y cobertura única, controla estudiantes repetidos y conserva auditoría interna del proceso.",
};

export const UNIVERSITY_SOURCE_MODE_OPTIONS: Array<{
  id: CalcMuestraWorkspaceSourceMode;
  label: string;
  detail: string;
  cards: string[];
}> = [
  {
    id: "base_madre",
    label: "Una base principal",
    detail: "Una fila por estudiante en cada curso y horario. Es lo ideal para identificar aulas, controlar repetidos y auditar exclusiones.",
    cards: ["estudiante", "curso y horario", "facultad/sexo", "elegibilidad"],
  },
  {
    id: "dos_bases",
    label: "Base + catálogo",
    detail: "Un Excel puede traer una hoja principal de matrícula y otra de cursos y horarios. No exige una tercera hoja si la principal ya trae estudiante por curso.",
    cards: ["base principal", "catálogo opcional", "curso y horario", "relación entre hojas"],
  },
  {
    id: "seleccion_existente",
    label: "Selección previa + agenda",
    detail: "Para leer una muestra ya trabajada, reemplazos y agenda operativa sin rediseñar silenciosamente el marco.",
    cards: ["muestra", "reemplazos", "agenda", "campo"],
  },
];

export const UNIVERSITY_SOURCE_BINDING_DEFAULTS: Record<CalcMuestraWorkspaceSourceMode, CalcMuestraWorkspaceSourceBinding[]> = {
  base_madre: [
    { id: "src-base-madre", role: "base_madre", label: "Base principal de matrícula", status: "pendiente", sheet_name: "", notes: "Una fila por estudiante en cada curso y horario." },
  ],
  dos_bases: [
    { id: "src-estudiantes", role: "estudiantes", label: "Base principal de matrícula", status: "pendiente", sheet_name: "MATRICULADO", notes: "Puede ser estudiante elegible o, idealmente, estudiante por curso y horario." },
    { id: "src-cursos", role: "catalogo_curso_horario", label: "Catálogo de cursos y horarios", status: "pendiente", sheet_name: "CURSO Y HORARIO", notes: "Curso, horario, aula, docente y cupos. Completa la lectura cuando existe." },
  ],
  seleccion_existente: [
    { id: "src-muestra", role: "muestra_previa", label: "Muestra seleccionada", status: "pendiente", sheet_name: "Muestra", notes: "Aulas titulares y reemplazos si existen." },
    { id: "src-agenda", role: "agenda", label: "Agenda de aulas", status: "pendiente", sheet_name: "BD Agenda", notes: "Docente, fecha, responsable, estado y aplicación." },
  ],
};

export const UNIVERSITY_FALLBACK_COLUMN_OPTIONS = [
  "Código estudiante",
  "Facultad",
  "Programa",
  "Sexo",
  "Ciclo",
  "Nivel",
  "Curso y horario",
  "Curso",
  "Nombre del curso",
  "Aula",
  "Docente",
  "Horario",
  "Modalidad",
  "Condición",
];

export const UNIVERSITY_REQUIRED_VARIABLES: CalcMuestraWorkspaceVariableMapping[] = [
  { role: "student_id", label: "Identificador de estudiante", required: true, source_role: "base_madre", description: "Permite controlar duplicados y cobertura. No se publica en salidas para cliente." },
  { role: "faculty", label: "Facultad", required: true, source_role: "base_madre", description: "Facultad del estudiante; sostiene representatividad, cuotas y cruces de población." },
  { role: "campus", label: "Sede o campus", required: false, source_role: "base_madre", description: "Sede donde se dicta el aula; habilita el filtro de sedes del operativo." },
  { role: "program", label: "Programa o carrera", required: false, source_role: "base_madre", description: "Carrera del estudiante dentro de su facultad; no es la facultad que dicta el curso." },
  { role: "sex", label: "Sexo", required: true, source_role: "base_madre", description: "Cuota esperada y diagnóstico descriptivo." },
  { role: "level", label: "Ciclo, nivel o año", required: false, source_role: "base_madre", description: "Balance por avance académico." },
  { role: "formation", label: "Formación", required: false, source_role: "base_madre", description: "Nivel formativo del estudiante (pregrado, maestría…); habilita el criterio de pregrado sobre la columna real." },
  { role: "age", label: "Edad", required: false, source_role: "base_madre", description: "Habilita el criterio de mayoría de edad sobre la edad real del estudiante." },
  { role: "course_id", label: "Curso o código de curso", required: true, source_role: "base_madre", description: "Junto con horario o sección permite identificar cada aula a seleccionar." },
  { role: "course_schedule_id", label: "Código único de curso y horario", required: false, source_role: "base_madre", description: "Úsala si la base trae NRC o un identificador único de aula." },
  { role: "course_name", label: "Nombre del curso", required: false, source_role: "catalogo_curso_horario", description: "Etiqueta legible de aula/curso." },
  { role: "course_level", label: "Nivel del curso", required: false, source_role: "catalogo_curso_horario", description: "Nivel o ciclo del curso (no del estudiante); habilita el rango de nivel por unidad académica." },
  { role: "classroom", label: "Aula o sección", required: false, source_role: "catalogo_curso_horario", description: "Ubicación o grupo operativo." },
  { role: "teacher", label: "Docente/contacto", required: false, source_role: "catalogo_curso_horario", description: "Útil para agenda y autorización." },
  { role: "teacher_type", label: "Tipo de docente", required: false, source_role: "catalogo_curso_horario", description: "Categoría del docente (contratado, ordinario…); habilita el criterio de docente estable." },
  { role: "schedule", label: "Horario", required: true, source_role: "catalogo_curso_horario", description: "Balance y planificación de campo." },
  { role: "modality", label: "Modalidad", required: false, source_role: "catalogo_curso_horario", description: "Presencial, virtual o mixta." },
  { role: "session_type", label: "Tipo de curso o sesión", required: false, source_role: "catalogo_curso_horario", description: "Teórico, laboratorio, taller, seminario…; habilita el criterio de tipo de curso válido." },
  { role: "enrolled_total", label: "Matriculados del aula", required: false, source_role: "catalogo_curso_horario", description: "Total de inscritos por curso-horario; los elegibles (matriculados_población) los deriva el motor." },
  { role: "condition", label: "Condición o elegibilidad", required: true, source_role: "base_madre", description: "Filtro de población objetivo; por ejemplo regular, válido o elegible." },
];

export const UNIVERSITY_AULAS_SELECTOR_OPTIONS: Array<{
  id: CalcMuestraWorkspaceAulasSelector;
  label: string;
  detail: string;
}> = [
  {
    id: "cube_balanceado",
    label: "Balance por cuotas y tamaño",
    detail: "Recomendado: conserva proporciones del marco usando tamaño elegible, cuotas y variables de control.",
  },
  {
    id: "local_pivotal_balanceado",
    label: "Balance + dispersión",
    detail: "Modo avanzado para evitar concentración por programa, nivel, horario o campus cuando hay auxiliares buenas.",
  },
  {
    id: "pool_controlado",
    label: "Optimizar repetidos",
    detail: "Elige entre muestras candidatas para reducir estudiantes repetidos; exige simulación para probabilidades finales.",
  },
  {
    id: "sistematico_pps",
    label: "Sistemático por facultad",
    detail: "Ordena el marco depurado y selecciona aulas de forma espaciada dentro de cada facultad.",
  },
  {
    id: "estratificado_aleatorio",
    label: "Aleatorio estratificado",
    detail: "Selecciona dentro de cada grupo de control sin ajuste adicional por repetición.",
  },
  {
    id: "pps_balanceado",
    label: "Balance legacy",
    detail: "Alias antiguo; se normaliza al método balanceado recomendado para conservar compatibilidad.",
  },
  {
    id: "manual_auditable",
    label: "Manual auditable",
    detail: "Permite una decisión operativa documentada con responsable, motivo y registro de cambios.",
  },
];

export const UNIVERSITY_AULAS_MODALIDAD_OPTIONS: Array<{
  id: CalcMuestraWorkspaceAulasModalidad;
  label: string;
  detail: string;
}> = [
  {
    id: "presencial_aula",
    label: "Presencial en aula",
    detail: "Aplica filtros de presencialidad, horario, docente y aula física.",
  },
  {
    id: "mixto_aula",
    label: "Mixto con aula base",
    detail: "Usa aulas como punto operativo y admite canal digital o papel.",
  },
  {
    id: "online_controlado",
    label: "Online controlado",
    detail: "Mantiene cuotas, pero reduce dependencia del aula física.",
  },
];

export const ESCENARIOS_OPINION: CalcMuestraWorkspaceEscenario[] = [
  {
    id: "total-universidad",
    label: "Nivel universidad",
    descripcion: "Inferencia para el universo de pregrado; cuotas proporcionales por facultad y sexo.",
    activo: true,
    tecnica: "prob_conglomerado_multietapico",
    producto: "muestra_probabilistica",
    component_id: "estudiantes_universidad",
    incluir_reporte: true,
    redondeo_multiplo: 100,
    parametros: {
      z: 1.96,
      p: 0.3,
      e: 0.025,
      deff: 2,
      oversample_pct: 0.5,
      n_minimo_estrato: 2500,
      promedio_conglomerado: 28,
      tau: 0.53,
      tasa_respuesta: 0.7,
    },
  },
  {
    id: "facultades",
    label: "Nivel facultad",
    descripcion: "Inferencia por facultad; margen y proporción de éxito editables por facultad.",
    activo: false,
    tecnica: "prob_estratificado_independiente",
    producto: "muestra_probabilistica",
    component_id: "estudiantes_facultad",
    incluir_reporte: false,
    redondeo_multiplo: 100,
    parametros: {
      z: 1.96,
      p: 0.5,
      e: 0.05,
      deff: 1.5,
      oversample_pct: 0.2,
      n_minimo_estrato: 4050,
      promedio_conglomerado: 20,
      tau: 0.53,
      tasa_respuesta: 0.8,
    },
  },
];

export const UNIVERSITY_REFERENCE_SUCCESS_RATE: Record<string, number> = {
  "ARQUITECTURA Y URBANISMO": 0.30,
  "ARTE Y DISEÑO": 0.50,
  "ARTE Y DISENO": 0.50,
  "ARTES ESCÉNICAS": 0.50,
  "ARTES ESCENICAS": 0.50,
  "CIENCIAS CONTABLES": 0.20,
  "CIENCIAS E INGENIERÍA": 0.20,
  "CIENCIAS E INGENIERIA": 0.20,
  "CIENCIAS SOCIALES": 0.40,
  "CIENCIAS Y ARTES DE LA COMUNICACIÓN": 0.40,
  "CIENCIAS Y ARTES DE LA COMUNICACION": 0.40,
  "DERECHO": 0.50,
  "EDUCACIÓN": 0.60,
  "EDUCACION": 0.60,
  "ESTUDIOS GENERALES CIENCIAS": 0.20,
  "ESTUDIOS GENERALES LETRAS": 0.30,
  "GASTRONOMÍA, HOTELERÍA Y TURISMO": 0.30,
  "GASTRONOMIA, HOTELERIA Y TURISMO": 0.30,
  "GESTIÓN Y ALTA DIRECCIÓN": 0.30,
  "GESTION Y ALTA DIRECCION": 0.30,
  "LETRAS Y CIENCIAS HUMANAS": 0.30,
  "PSICOLOGÍA": 0.50,
  "PSICOLOGIA": 0.50,
};

export type UniversityAuditDefaults = Partial<Pick<
  CalcMuestraEstrato,
  | "e_facultad"
  | "p_facultad"
  | "confianza_facultad"
  | "cuota_fija"
  | "sobremuestra_fija"
  | "aulas_base_fijas"
  | "aulas_extra_operativas"
>>;

export const UNIVERSITY_REFERENCE_BASE_SCENARIO_DEFAULTS: Record<string, UniversityAuditDefaults> = {
  "ARQUITECTURA Y URBANISMO": { cuota_fija: 126, sobremuestra_fija: 189, aulas_base_fijas: 11 },
  "ARTE Y DISENO": { cuota_fija: 120, sobremuestra_fija: 180, aulas_base_fijas: 13 },
  "ARTES ESCENICAS": { cuota_fija: 69, sobremuestra_fija: 104, aulas_base_fijas: 11 },
  "CIENCIAS CONTABLES": { cuota_fija: 21, sobremuestra_fija: 32, aulas_base_fijas: 3 },
  "CIENCIAS E INGENIERIA": { cuota_fija: 528, sobremuestra_fija: 792, aulas_base_fijas: 33 },
  "CIENCIAS SOCIALES": { cuota_fija: 151, sobremuestra_fija: 227, aulas_base_fijas: 12 },
  "CIENCIAS Y ARTES DE LA COMUNICACION": { cuota_fija: 97, sobremuestra_fija: 146, aulas_base_fijas: 9 },
  "DERECHO": { cuota_fija: 347, sobremuestra_fija: 521, aulas_base_fijas: 21 },
  "EDUCACION": { cuota_fija: 23, sobremuestra_fija: 35, aulas_base_fijas: 4 },
  "ESTUDIOS GENERALES CIENCIAS": { cuota_fija: 393, sobremuestra_fija: 590, aulas_base_fijas: 20 },
  "ESTUDIOS GENERALES LETRAS": { cuota_fija: 389, sobremuestra_fija: 584, aulas_base_fijas: 18 },
  "GASTRONOMIA, HOTELERIA Y TURISMO": { cuota_fija: 15, sobremuestra_fija: 23, aulas_base_fijas: 3 },
  "GESTION Y ALTA DIRECCION": { cuota_fija: 115, sobremuestra_fija: 173, aulas_base_fijas: 8 },
  "LETRAS Y CIENCIAS HUMANAS": { cuota_fija: 26, sobremuestra_fija: 39, aulas_base_fijas: 5 },
  "PSICOLOGIA": { cuota_fija: 79, sobremuestra_fija: 119, aulas_base_fijas: 6 },
};

export const UNIVERSITY_REFERENCE_FACULTY_SCENARIO_DEFAULTS: Record<string, UniversityAuditDefaults> = {
  "ARQUITECTURA Y URBANISMO": { cuota_fija: 373, sobremuestra_fija: 448, aulas_base_fijas: 24 },
  "ARTE Y DISENO": { cuota_fija: 418, sobremuestra_fija: 502, aulas_base_fijas: 35 },
  "ARTES ESCENICAS": { cuota_fija: 230, sobremuestra_fija: 276, aulas_base_fijas: 27 },
  "CIENCIAS CONTABLES": { cuota_fija: 52, sobremuestra_fija: 63, aulas_base_fijas: 4 },
  "CIENCIAS E INGENIERIA": { cuota_fija: 354, sobremuestra_fija: 425, aulas_base_fijas: 18 },
  "CIENCIAS SOCIALES": { cuota_fija: 443, sobremuestra_fija: 532, aulas_base_fijas: 26 },
  "CIENCIAS Y ARTES DE LA COMUNICACION": { cuota_fija: 233, sobremuestra_fija: 280, aulas_base_fijas: 15 },
  "DERECHO": { cuota_fija: 511, sobremuestra_fija: 614, aulas_base_fijas: 24 },
  "EDUCACION": { cuota_fija: 70, sobremuestra_fija: 84, aulas_base_fijas: 7 },
  "ESTUDIOS GENERALES CIENCIAS": { cuota_fija: 346, sobremuestra_fija: 416, aulas_base_fijas: 14 },
  "ESTUDIOS GENERALES LETRAS": { cuota_fija: 441, sobremuestra_fija: 530, aulas_base_fijas: 16 },
  "GASTRONOMIA, HOTELERIA Y TURISMO": { cuota_fija: 59, sobremuestra_fija: 71, aulas_base_fijas: 6 },
  "GESTION Y ALTA DIRECCION": { cuota_fija: 212, sobremuestra_fija: 255, aulas_base_fijas: 11 },
  "LETRAS Y CIENCIAS HUMANAS": { cuota_fija: 68, sobremuestra_fija: 82, aulas_base_fijas: 10 },
  "PSICOLOGIA": { cuota_fija: 239, sobremuestra_fija: 287, aulas_base_fijas: 13 },
};
