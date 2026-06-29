import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Database,
  FileText,
  Gauge,
  Grid3X3,
  Home,
  Layers3,
  Loader2,
  MapPinned,
  PencilLine,
  Plus,
  QrCode,
  RefreshCw,
  Route,
  Settings2,
  SlidersHorizontal,
  Table2,
  Target,
  Trash2,
  Users,
  Upload,
  Wand2,
} from "lucide-react";
import { PageFrame } from "../../components/PageFrame";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { PlotlyChart } from "../../lib/PlotlyChart";
import { AulasApplicationFlow } from "../aulasFlow/AulasApplicationFlow";
import { Math as LatexMath } from "../enciclopedia/shared/components/Math";
import { useCalcMuestraAutosave } from "./hooks/useCalcMuestraAutosave";
import { useCalcMuestraStore } from "./store/calcMuestraStore";
import {
  apiCalcMuestraAulasCompararMetodos,
  apiCalcMuestraAulasSeleccionar,
  apiCalcMuestraAulasSimularReemplazos,
  apiCalcMuestraCalcular,
  apiCalcMuestraEstudioPut,
  apiCalcMuestraIniciarEstudio,
  apiCalcMuestraMarcoConstruir,
  apiCalcMuestraMarcoInspeccionarArchivo,
  apiCalcMuestraReporteIniciar,
  apiCalcMuestraState,
  apiMonitoreoImportFromCalcMuestra,
  apiUpload,
  calcMuestraReporteDescargarUrl,
  type CalcMuestraCanalRecojo,
  type CalcMuestraAulasMethodComparison,
  type CalcMuestraAulasMethodSummary,
  type CalcMuestraAulasSheetInspectionSheet,
  type CalcMuestraAulasObjectiveConfig,
  type CalcMuestraAulasProfileDistribution,
  type CalcMuestraAulasReplacementSuggestion,
  type CalcMuestraAulasReplacementSimulation,
  type CalcMuestraAulasRepresentativityMetric,
  type CalcMuestraAulasSelection,
  type CalcMuestraAulasSimulationSummary,
  type CalcMuestraAulasState,
  type CalcMuestraComponente,
  type CalcMuestraEstrato,
  type CalcMuestraEstudio,
  type CalcMuestraMacroFamilia,
  type CalcMuestraMatrizOperativaCelda,
  type CalcMuestraNivelRespaldo,
  type CalcMuestraOrigenTamano,
  type CalcMuestraParametros,
  type CalcMuestraState,
  type CalcMuestraTecnica,
  type CalcMuestraWorkspace,
  type CalcMuestraWorkspaceAulasConfig,
  type CalcMuestraWorkspaceAulasModalidad,
  type CalcMuestraWorkspaceAulasSelector,
  type CalcMuestraWorkspaceCategoryMapping,
  type CalcMuestraWorkspaceEscenario,
  type CalcMuestraWorkspaceFrameMode,
  type CalcMuestraWorkspacePublicationConfig,
  type CalcMuestraWorkspaceProducto,
  type CalcMuestraWorkspaceSourceBinding,
  type CalcMuestraWorkspaceSourceMode,
  type CalcMuestraWorkspaceVariableMapping,
  type CalcMuestraWorkspaceVariableControl,
} from "../../api/client";
import "./calcMuestra.css";

type Msg = { kind: "info" | "warn" | "error"; text: string } | null;
type ActiveDesk = CalcMuestraWorkspaceFrameMode;
type GuidancePoint = {
  prompt: string;
  answer: string;
  detail: string;
  icon?: typeof Database;
};
type ComponentePatch = Omit<Partial<CalcMuestraComponente>, "marco" | "parametros" | "meta"> & {
  marco?: Partial<CalcMuestraComponente["marco"]>;
  parametros?: Partial<CalcMuestraComponente["parametros"]>;
  meta?: Partial<CalcMuestraComponente["meta"]>;
};
type MarcoOcasional =
  | "marco_total"
  | "estratos"
  | "conglomerados"
  | "servicios"
  | "cuotas_controladas"
  | "cobertura";
type CalcMuestraSectionNavItem = {
  id: string;
  label: string;
  shortLabel?: string;
  detail: string;
  icon: typeof Database;
  targetId?: string;
  route?: "hojas-ruta";
};
type CalcMuestraContextCheck = {
  label: string;
  value: string;
  ready: boolean;
  icon: typeof Database;
};
type CalcMuestraChromeStatus = {
  label: string;
  detail: string;
  tone: "idle" | "working" | "ready";
  icon: typeof Database;
};
type CalcMuestraChromeToken = {
  label: string;
  value: string;
  tone?: "neutral" | "ready" | "working" | "path";
};
type CalcMuestraSidebarTab = {
  id: string;
  label: string;
  detail: string;
  icon: typeof Database;
  status: GuideStatus;
  targetId?: string;
  classroomTab?: ClassroomLabTab;
};
type GuideStatus = "ready" | "working" | "pending";
type ClassroomLabTab = "marco" | "objetivo" | "metodo" | "laboratorio" | "seleccion" | "reemplazos" | "auditoria";

const CLASSROOM_LAB_TABS: Array<{ id: ClassroomLabTab; label: string; detail: string; icon: typeof Database }> = [
  { id: "marco", label: "Marco de aulas", detail: "Base convertida en curso-horario", icon: Database },
  { id: "objetivo", label: "Objetivo de muestra", detail: "Cuotas y aulas necesarias", icon: Target },
  { id: "metodo", label: "Comparar métodos", detail: "Elegir la opción más representativa", icon: Settings2 },
  { id: "laboratorio", label: "Simulación", detail: "Estabilidad y repetidos", icon: BarChart3 },
  { id: "seleccion", label: "Aulas titulares", detail: "Aulas que se intentan primero", icon: Table2 },
  { id: "reemplazos", label: "Reemplazos por aula", detail: "Rutas Rn.1, Rn.2...", icon: RefreshCw },
  { id: "auditoria", label: "Sustento técnico", detail: "Campos, pesos y fuentes", icon: FileText },
];

function guidedStatusLabel(status: GuideStatus) {
  if (status === "ready") return "Listo";
  if (status === "working") return "Siguiente paso";
  return "Pendiente";
}

function guideStatus(done: boolean, enabled = true): GuideStatus {
  if (done) return "ready";
  return enabled ? "working" : "pending";
}

const UNIVERSITY_TOTAL_COMPONENT_ID = "estudiantes_universidad";
const UNIVERSITY_FACULTY_COMPONENT_ID = "estudiantes_facultad";

const DEFAULT_PARAMS: CalcMuestraParametros = {
  z: 1.96,
  p: 0.5,
  e: 0.05,
  deff: 1,
  tau: 0.7,
  oversample_pct: 0.1,
  tasa_contacto: 0.5,
  tasa_elegibilidad: 0.9,
  tasa_respuesta: 0.7,
  cobertura_objetivo: 0.6,
  promedio_conglomerado: 25,
  n_minimo_estrato: 30,
  tope_operativo: 150,
};

const DEFAULT_UNIVERSITY_PUBLICATION_CONFIG: CalcMuestraWorkspacePublicationConfig = {
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

const EMPTY_WORKSPACE: CalcMuestraWorkspace = {
  version: 2,
  frame_mode: "sin_definir",
  marco_disponible: "",
  fuente_marco: "",
  unidad_observacion: "",
  unidad_muestreo: "",
  variables_control: [],
  escenarios: [],
  notas_diseno: "",
  source_mode: "base_madre",
  source_bindings: [],
  variable_mappings: [],
  category_mappings: [],
  publication_config: DEFAULT_UNIVERSITY_PUBLICATION_CONFIG,
};

const UNIVERSITY_AULAS_SIZE_GROUPS: CalcMuestraWorkspaceAulasConfig["grupos_tamano"] = [
  { id: "G1", label: "G1", min: 15, max: 20, descripcion: "aulas pequenas o especializadas" },
  { id: "G2", label: "G2", min: 21, max: 30, descripcion: "aulas medianas" },
  { id: "G3", label: "G3", min: 31, max: 40, descripcion: "aulas estandar" },
  { id: "G4", label: "G4", min: 41, max: null, descripcion: "aulas grandes o masivas" },
];

const DEFAULT_UNIVERSITY_AULAS_OBJECTIVE: CalcMuestraAulasObjectiveConfig = {
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

const DEFAULT_UNIVERSITY_AULAS_CONFIG: CalcMuestraWorkspaceAulasConfig = {
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
    "Selector reproducible sobre un marco de cursos y horarios: balancea cuotas, tamano de aula y cobertura unica, controla estudiantes repetidos y conserva auditoria interna del proceso.",
};

const UNIVERSITY_SOURCE_MODE_OPTIONS: Array<{
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

const UNIVERSITY_SOURCE_BINDING_DEFAULTS: Record<CalcMuestraWorkspaceSourceMode, CalcMuestraWorkspaceSourceBinding[]> = {
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

const UNIVERSITY_REQUIRED_VARIABLES: CalcMuestraWorkspaceVariableMapping[] = [
  { role: "student_id", label: "Identificador de estudiante", required: true, source_role: "base_madre", description: "Permite controlar duplicados y cobertura. No se publica en salidas para cliente." },
  { role: "faculty", label: "Facultad", required: true, source_role: "base_madre", description: "Facultad del estudiante; sostiene representatividad, cuotas y cruces de población." },
  { role: "program", label: "Programa o carrera", required: false, source_role: "base_madre", description: "Carrera del estudiante dentro de su facultad; no es la facultad que dicta el curso." },
  { role: "sex", label: "Sexo", required: true, source_role: "base_madre", description: "Cuota esperada y diagnóstico descriptivo." },
  { role: "level", label: "Ciclo, nivel o año", required: false, source_role: "base_madre", description: "Balance por avance académico." },
  { role: "course_id", label: "Curso o código de curso", required: true, source_role: "base_madre", description: "Junto con horario o sección permite identificar cada aula a seleccionar." },
  { role: "course_schedule_id", label: "Código único de curso y horario", required: false, source_role: "base_madre", description: "Úsala si la base trae NRC o un identificador único de aula." },
  { role: "course_name", label: "Nombre del curso", required: false, source_role: "catalogo_curso_horario", description: "Etiqueta legible de aula/curso." },
  { role: "classroom", label: "Aula o sección", required: false, source_role: "catalogo_curso_horario", description: "Ubicación o grupo operativo." },
  { role: "teacher", label: "Docente/contacto", required: false, source_role: "catalogo_curso_horario", description: "Útil para agenda y autorización." },
  { role: "schedule", label: "Horario", required: true, source_role: "catalogo_curso_horario", description: "Balance y planificación de campo." },
  { role: "modality", label: "Modalidad", required: false, source_role: "catalogo_curso_horario", description: "Presencial, virtual o mixta." },
  { role: "condition", label: "Condición o elegibilidad", required: true, source_role: "base_madre", description: "Filtro de población objetivo; por ejemplo regular, válido o elegible." },
];

const UNIVERSITY_FALLBACK_COLUMN_OPTIONS = [
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

const UNIVERSITY_AULAS_SELECTOR_OPTIONS: Array<{
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
    detail: "Alias antiguo; se normaliza al motor balanceado recomendado para conservar compatibilidad.",
  },
  {
    id: "manual_auditable",
    label: "Manual auditable",
    detail: "Permite una decisión operativa documentada con responsable, motivo y registro de cambios.",
  },
];

const UNIVERSITY_AULAS_MODALIDAD_OPTIONS: Array<{
  id: CalcMuestraWorkspaceAulasModalidad;
  label: string;
  detail: string;
}> = [
  {
    id: "presencial_aula",
    label: "Presencial en aula",
    detail: "Aplica filtros de presencialidad, horario, docente y aula fisica.",
  },
  {
    id: "mixto_aula",
    label: "Mixto con aula base",
    detail: "Usa aulas como punto operativo y admite canal digital o papel.",
  },
  {
    id: "online_controlado",
    label: "Online controlado",
    detail: "Mantiene cuotas, pero reduce dependencia del aula fisica.",
  },
];

const CANAL_OPTIONS: Array<{ id: CalcMuestraCanalRecojo; label: string }> = [
  { id: "aula_qr", label: "Aulas / QR" },
  { id: "online_email", label: "Correo / online" },
  { id: "telefonico", label: "Telefónico" },
  { id: "presencial", label: "Presencial" },
  { id: "mixto", label: "Mixto" },
  { id: "sin_definir", label: "Por definir" },
];

const METODOS_CLASICOS: Array<{
  id: CalcMuestraTecnica;
  label: string;
  marco: string;
  producto: CalcMuestraWorkspaceProducto;
}> = [
  {
    id: "prob_aleatorio_simple",
    label: "Probabilístico clásico",
    marco: "Marco enumerable con unidades individuales",
    producto: "muestra_probabilistica",
  },
  {
    id: "prob_estratificado",
    label: "Estratificado proporcional",
    marco: "Marco por capas o variables de control",
    producto: "muestra_probabilistica",
  },
  {
    id: "prob_estratificado_independiente",
    label: "Dominios independientes",
    marco: "Cada dominio calcula su propio n con margen y p propios",
    producto: "muestra_probabilistica",
  },
  {
    id: "sistematico",
    label: "Sistemático",
    marco: "Marco ordenado con arranque aleatorio",
    producto: "muestra_probabilistica",
  },
  {
    id: "prob_conglomerado_multietapico",
    label: "Por conglomerados",
    marco: "Unidades agrupadas: aulas, sedes, servicios, manzanas",
    producto: "muestra_probabilistica",
  },
  {
    id: "intencion_censal",
    label: "Cobertura censal",
    marco: "Universo pequeño o actor que conviene cubrir",
    producto: "cobertura_marco",
  },
  {
    id: "barrido",
    label: "Barrido operativo",
    marco: "Marco operativo a cubrir por rutas, aulas o servicios",
    producto: "cobertura_marco",
  },
  {
    id: "no_prob_cuotas",
    label: "Cuotas controladas",
    marco: "Control sin selección probabilística final",
    producto: "matriz_cuotas",
  },
  {
    id: "no_prob_conveniencia",
    label: "Conveniencia con pisos",
    marco: "Acceso parcial con cuotas mínimas por capa",
    producto: "matriz_cuotas",
  },
];

const ESCENARIOS_OPINION: CalcMuestraWorkspaceEscenario[] = [
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

const UNIVERSITY_REFERENCE_SUCCESS_RATE: Record<string, number> = {
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

type UniversityAuditDefaults = Partial<Pick<
  CalcMuestraEstrato,
  | "e_facultad"
  | "p_facultad"
  | "confianza_facultad"
  | "cuota_fija"
  | "sobremuestra_fija"
  | "aulas_base_fijas"
  | "aulas_extra_operativas"
>>;

const UNIVERSITY_REFERENCE_BASE_SCENARIO_DEFAULTS: Record<string, UniversityAuditDefaults> = {
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

const UNIVERSITY_REFERENCE_FACULTY_SCENARIO_DEFAULTS: Record<string, UniversityAuditDefaults> = {
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

const FRAME_CARDS: Array<{
  id: ActiveDesk;
  title: string;
  eyebrow: string;
  copy: string;
  action: string;
  details: string[];
  sourceRoles: Array<{ label: string; detail: string }>;
  guidance: GuidancePoint[];
  icon: typeof Database;
}> = [
  {
    id: "opinion_universitaria",
    title: "Muestra de aulas",
    eyebrow: "Base institucional",
    copy: "Para estudios de hostigamiento u opinión donde la muestra se aplica en aulas y sale de matrícula, facultades, sexo y aulas disponibles.",
    action: "Empezar este camino",
    details: ["Matrícula", "Cuotas", "Aulas", "Seguimiento"],
    sourceRoles: [
      { label: "Base", detail: "estudiantes por facultad y sexo" },
      { label: "Muestra", detail: "tamaño final y cuotas" },
      { label: "Aulas", detail: "titulares y reemplazos" },
      { label: "Campo", detail: "queda listo para seguimiento" },
    ],
    guidance: [
      { prompt: "¿A quién representa?", answer: "Estudiantes matriculados", detail: "La base se ordena por facultad, sexo y aulas disponibles.", icon: Users },
      { prompt: "¿Qué se calcula?", answer: "Entrevistas y cuotas", detail: "Define metas por universidad y por facultad antes de seleccionar aulas.", icon: SlidersHorizontal },
      { prompt: "¿Qué queda listo?", answer: "Aulas titulares y reemplazos", detail: "El plan queda trazable para seguimiento de campo.", icon: FileText },
    ],
    icon: Grid3X3,
  },
  {
    id: "marco_disponible",
    title: "Cálculo de muestra general",
    eyebrow: "Marco propio",
    copy: "Para estudios con una población conocida, registros por estrato, servicios, sedes o cuotas operativas.",
    action: "Empezar este camino",
    details: ["Marco total", "Estratos", "Grupos", "Cuotas"],
    sourceRoles: [
      { label: "Población", detail: "persona, atención o institución" },
      { label: "Base", detail: "total, estratos o grupos operativos" },
      { label: "Decisión", detail: "muestra, cobertura o cuotas" },
      { label: "Resultado", detail: "tamaño, distribución y reporte" },
    ],
    guidance: [
      { prompt: "¿A quién cubre?", answer: "Población o registros propios", detail: "Sirve para personas, atenciones, sedes, servicios o instituciones.", icon: Users },
      { prompt: "¿Cómo se organiza?", answer: "Marco, estratos o cuotas", detail: "Parte de lo que realmente existe en el proyecto.", icon: SlidersHorizontal },
      { prompt: "¿Qué se entrega?", answer: "Tamaño y distribución", detail: "Deja resultados revisables para reporte o seguimiento.", icon: FileText },
    ],
    icon: SlidersHorizontal,
  },
  {
    id: "acreditacion",
    title: "Acreditación institucional",
    eyebrow: "Actores y cuotas",
    copy: "Para procesos donde se necesitan metas por actor, programa, canal o componente institucional.",
    action: "Empezar este camino",
    details: ["Actores", "Programas", "Canales", "Brechas"],
    sourceRoles: [
      { label: "Universo", detail: "actores y segmentos" },
      { label: "Regla", detail: "meta, cobertura o cuota" },
      { label: "Cálculo", detail: "mínimos por componente" },
      { label: "Reporte", detail: "metas y brechas" },
    ],
    guidance: [
      { prompt: "¿Quiénes deben aparecer?", answer: "Actores institucionales", detail: "Ordena grupos para no dejar voces importantes fuera.", icon: Users },
      { prompt: "¿Cómo se levanta?", answer: "Metas por canal", detail: "Define actor, programa, canal y mínimo esperado.", icon: SlidersHorizontal },
      { prompt: "¿Qué sustenta?", answer: "Cobertura por componente", detail: "Muestra brechas y criterios de suficiencia.", icon: FileText },
    ],
    icon: ClipboardList,
  },
  {
    id: "territorial_handoff",
    title: "Rutas territoriales y hogares",
    eyebrow: "Hojas de ruta",
    copy: "Para estudios donde el diseño depende de zonas, manzanas, viviendas, reemplazos y recorrido de campo.",
    action: "Ir a Hojas de Ruta",
    details: ["Zonas", "Manzanas", "Viviendas", "Reemplazos"],
    sourceRoles: [
      { label: "Territorio", detail: "distritos, zonas y cartografía" },
      { label: "Recorrido", detail: "manzanas y viviendas titulares" },
      { label: "Campo", detail: "reemplazos y ocurrencias" },
      { label: "Cierre", detail: "avance territorial" },
    ],
    guidance: [
      { prompt: "¿Dónde se trabaja?", answer: "Zonas y viviendas", detail: "Convierte territorio en visitas concretas para campo.", icon: Home },
      { prompt: "¿Cómo se recorre?", answer: "Rutas y reemplazos", detail: "Controla manzanas, titulares, reservas y ocurrencias.", icon: Route },
      { prompt: "¿Qué se verifica?", answer: "Cobertura espacial", detail: "Deja evidencia cartográfica y dispersión territorial.", icon: FileText },
    ],
    icon: MapPinned,
  },
];

const PATHWAY_PRIMER: GuidancePoint[] = [
  {
    prompt: "¿De dónde sale la muestra?",
    answer: "Base, actores, marco o territorio",
    detail: "Cada camino abre una mesa distinta.",
    icon: Users,
  },
  {
    prompt: "¿Qué avance se guarda?",
    answer: "Un tipo de cálculo por proyecto",
    detail: "Cambiar de camino reinicia la mesa para no mezclar avances.",
    icon: SlidersHorizontal,
  },
  {
    prompt: "¿Qué debe quedar listo?",
    answer: "Resultado y salida operativa",
    detail: "Tamaño, distribución, selección o plan de campo.",
    icon: FileText,
  },
];

function workspaceFor(mode: ActiveDesk): CalcMuestraWorkspace {
  if (mode === "acreditacion") {
    return {
      ...EMPTY_WORKSPACE,
      frame_mode: "acreditacion",
      marco_disponible: "Actores institucionales por programa",
      unidad_observacion: "Actor del programa",
      unidad_muestreo: "Actor o unidad operativa según canal",
      fuente_marco: "Dirección académica / comité de acreditación / DIRINFO",
      variables_control: [
        variableControl("actor", "Actor", "estrato"),
        variableControl("programa", "Programa o especialidad", "estrato"),
        variableControl("canal", "Canal de contacto", "segmento"),
      ],
      notas_diseno:
        "Actores, marco, meta mínima y salida.",
    };
  }
  if (mode === "opinion_universitaria") {
    return {
      ...EMPTY_WORKSPACE,
      frame_mode: "opinion_universitaria",
      marco_disponible: "Matrícula por facultad y sexo",
      unidad_observacion: "Estudiante matriculado",
      unidad_muestreo: "",
      fuente_marco: "Matrícula institucional",
      variables_control: [
        variableControl("facultad", "Facultad", "estrato"),
        variableControl("sexo", "Sexo", "cuota"),
      ],
      escenarios: ESCENARIOS_OPINION,
      aulas_config: DEFAULT_UNIVERSITY_AULAS_CONFIG,
      source_mode: "base_madre",
      source_bindings: UNIVERSITY_SOURCE_BINDING_DEFAULTS.base_madre,
      variable_mappings: UNIVERSITY_REQUIRED_VARIABLES,
      publication_config: DEFAULT_UNIVERSITY_PUBLICATION_CONFIG,
      notas_diseno:
        "Propuesta A: representatividad a nivel universidad. Propuesta B: representatividad a nivel facultad.",
    };
  }
  if (mode === "territorial_handoff") {
    return {
      ...EMPTY_WORKSPACE,
      frame_mode: "territorial_handoff",
      marco_disponible: "Territorio, zonas, manzanas u hogares",
      unidad_observacion: "Persona u hogar",
      unidad_muestreo: "Zona / manzana / vivienda",
      fuente_marco: "Marco cartográfico y población territorial",
      notas_diseno:
        "Los estudios territoriales puros se resuelven en Hojas de Ruta para integrar zonas, rutas, viviendas y reemplazos.",
    };
  }
  if (mode === "legacy") {
    return {
      ...EMPTY_WORKSPACE,
      frame_mode: "legacy",
      notas_diseno: "Sesión antigua.",
    };
  }
  return {
    ...EMPTY_WORKSPACE,
    frame_mode: "marco_disponible",
    marco_disponible: "Marco específico del estudio",
    unidad_observacion: "Persona, atención, institución o actor",
    unidad_muestreo: "Unidad seleccionable según marco",
    fuente_marco: "Contraparte, registro administrativo o estimación operativa",
    variables_control: [
      variableControl("territorio", "Territorio", "estrato"),
      variableControl("servicio", "Servicio / actor", "cuota"),
    ],
    notas_diseno:
      "Primero se declara qué contiene el marco y luego se elige el cálculo: muestra, cobertura o cuotas.",
  };
}

function variableControl(
  id: string,
  label: string,
  tipo: CalcMuestraWorkspaceVariableControl["tipo"],
): CalcMuestraWorkspaceVariableControl {
  return { id, label, tipo, disponible: true, notas: "" };
}

function normalizeWorkspace(estudio: CalcMuestraEstudio): CalcMuestraWorkspace {
  const rawWorkspace = estudio.workspace ?? EMPTY_WORKSPACE;
  return {
    ...EMPTY_WORKSPACE,
    ...rawWorkspace,
    variables_control: rawWorkspace.variables_control ?? [],
    escenarios: rawWorkspace.escenarios ?? [],
    source_mode: rawWorkspace.source_mode ?? "base_madre",
    source_bindings: rawWorkspace.source_bindings ?? [],
    variable_mappings: rawWorkspace.variable_mappings ?? [],
    category_mappings: rawWorkspace.category_mappings ?? [],
    publication_config: {
      ...DEFAULT_UNIVERSITY_PUBLICATION_CONFIG,
      ...(rawWorkspace.publication_config ?? {}),
    },
  };
}

function inferDesk(estudio: CalcMuestraEstudio, workspace: CalcMuestraWorkspace): ActiveDesk {
  const legacy = estudio.macro_familia === "listado_telefonico" ||
    estudio.componentes.some((c) => c.tecnica === "listado_externo_meta_fija");
  if (legacy) return "legacy";
  if (estudio.macro_familia === "territorial") return "territorial_handoff";
  if (workspace.frame_mode !== "sin_definir") return workspace.frame_mode;
  if (estudio.macro_familia === "acreditacion" && estudio.componentes.length > 0) return "acreditacion";
  if (["encuesta_estudiantes", "hsvg_universitario"].includes(estudio.macro_familia) && estudio.componentes.length > 0) return "opinion_universitaria";
  if (estudio.componentes.length > 0) return "marco_disponible";
  return "sin_definir";
}

function requestedDeskFromSearch(searchParams: URLSearchParams): ActiveDesk | null {
  const raw = searchParams.get("mesa") ?? searchParams.get("desk") ?? searchParams.get("tipo");
  const value = normalizeUniversityLabel(raw ?? "").replace(/_/g, " ");
  if (["AULAS", "MUESTRA AULAS", "OPINION UNIVERSITARIA", "HOSTIGAMIENTO"].includes(value)) {
    return "opinion_universitaria";
  }
  return null;
}

function clearDeskRequest(searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete("mesa");
  next.delete("desk");
  next.delete("tipo");
  return next;
}

function defaultRailSectionForDesk(desk: ActiveDesk) {
  if (desk === "opinion_universitaria") return "definicion";
  if (desk === "marco_disponible") return "marco";
  if (desk === "acreditacion") return "actores";
  if (desk === "territorial_handoff") return "hojas-ruta";
  return "pathways";
}

function railTitleForDesk(desk: ActiveDesk) {
  if (desk === "opinion_universitaria") return "Muestra de aulas";
  if (desk === "marco_disponible") return "Muestra general";
  if (desk === "acreditacion") return "Acreditación";
  if (desk === "territorial_handoff") return "Territorial";
  if (desk === "legacy") return "Sesión anterior";
  return "Tipo de estudio";
}

function deskSubtitleForDesk(desk: ActiveDesk) {
  if (desk === "opinion_universitaria") return "Base institucional, cuotas, aulas y seguimiento de aplicación.";
  if (desk === "marco_disponible") return "Unidad, forma del marco, método y resultados.";
  if (desk === "acreditacion") return "Actores, canales, mínimos y reporte metodológico.";
  if (desk === "territorial_handoff") return "Territorio, rutas y viviendas se resuelven en Hojas de Ruta.";
  if (desk === "legacy") return "Sesión antigua conservada para compatibilidad.";
  return "Elige el tipo de muestra para abrir la mesa de trabajo.";
}

function railSectionsForDesk(desk: ActiveDesk): CalcMuestraSectionNavItem[] {
  if (desk === "opinion_universitaria") {
    return [
      { id: "definicion", label: "Definición", detail: "estudio y contrato de datos", icon: ClipboardList, targetId: "cmv2-section-university-setup" },
      { id: "marco", label: "Marco institucional", shortLabel: "Marco", detail: "base principal o dos hojas", icon: Database, targetId: "cmv2-section-university-marco" },
      { id: "calculo", label: "Cálculo", detail: "n final y ajustes", icon: Calculator, targetId: "cmv2-section-university-calculo" },
      { id: "aulas", label: "Aulas y selección", shortLabel: "Aulas", detail: "selector, reemplazos y cuotas", icon: Grid3X3, targetId: "cmv2-section-university-aulas" },
      { id: "salidas", label: "Salida", detail: "reporte y seguimiento", icon: Route, targetId: "cmv2-section-university-salidas" },
    ];
  }
  if (desk === "marco_disponible") {
    return [
      { id: "marco", label: "Marco", detail: "unidad y cobertura", icon: Database, targetId: "cmv2-section-general-marco" },
      { id: "metodo", label: "Método", detail: "muestra, cobertura o cuotas", icon: Settings2, targetId: "cmv2-section-general-metodo" },
      { id: "resultados", label: "Resultados", detail: "n, distribución y reporte", icon: BarChart3, targetId: "cmv2-section-general-resultados" },
    ];
  }
  if (desk === "acreditacion") {
    return [
      { id: "actores", label: "Actores", detail: "marco y canal", icon: ClipboardList, targetId: "cmv2-section-acreditacion-actores" },
      { id: "contexto", label: "Contexto", detail: "programa y fuente", icon: Database, targetId: "cmv2-section-acreditacion-contexto" },
      { id: "resultados", label: "Resultados", detail: "metas por actor", icon: BarChart3, targetId: "cmv2-section-acreditacion-resultados" },
    ];
  }
  if (desk === "territorial_handoff") {
    return [
      { id: "hojas-ruta", label: "Diseño de rutas", detail: "zonas, manzanas y viviendas", icon: MapPinned, route: "hojas-ruta" },
    ];
  }
  return [];
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInputNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? String(value) : "";
}

function normalizeAulasSelectorEngine(value: unknown): CalcMuestraWorkspaceAulasSelector {
  const raw = String(value ?? "").trim();
  if (raw === "local_pivotal_balanceado" || raw === "pool_controlado" || raw === "sistematico_pps" || raw === "estratificado_aleatorio" || raw === "manual_auditable") return raw;
  if (raw === "pps_balanceado") return "cube_balanceado";
  return "cube_balanceado";
}

function fmtInt(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString("es-PE");
}

function fmtPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function fmtStackPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function safeShare(value: number, total: number) {
  return total > 0 && Number.isFinite(total) ? value / total : Number.NaN;
}

function normalizeUniversityAulasConfig(config?: CalcMuestraWorkspace["aulas_config"] | null): CalcMuestraWorkspaceAulasConfig {
  const raw: Partial<CalcMuestraWorkspaceAulasConfig> = config ?? {};
  const selector = raw.selector ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.selector;
  const selectorEngine = normalizeAulasSelectorEngine(raw.selector_engine ?? selector);
  const acceptedConditions = (raw.accepted_conditions ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.accepted_conditions ?? ["regular"])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  return {
    ...DEFAULT_UNIVERSITY_AULAS_CONFIG,
    ...raw,
    modalidad: raw.modalidad ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.modalidad,
    selector,
    selector_engine: selectorEngine,
    method_family: raw.method_family ?? (selectorEngine === "pool_controlado" ? "probability_with_operational_optimization" : "balanced_probability"),
    min_elegibles_aula: Math.max(1, Math.round(safeNumber(raw.min_elegibles_aula, DEFAULT_UNIVERSITY_AULAS_CONFIG.min_elegibles_aula))),
    accepted_conditions: acceptedConditions.length ? acceptedConditions : ["regular"],
    require_undergraduate: raw.require_undergraduate ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.require_undergraduate,
    require_adult: raw.require_adult ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.require_adult,
    min_age: Math.max(0, Math.round(safeNumber(raw.min_age, DEFAULT_UNIVERSITY_AULAS_CONFIG.min_age))),
    require_in_person: raw.require_in_person ?? (raw.modalidad ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.modalidad) !== "online_controlado",
    usar_grupos_tamano: raw.usar_grupos_tamano ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.usar_grupos_tamano,
    grupos_tamano: raw.grupos_tamano?.length ? raw.grupos_tamano : DEFAULT_UNIVERSITY_AULAS_CONFIG.grupos_tamano,
    estratos_selector: raw.estratos_selector?.length ? raw.estratos_selector : DEFAULT_UNIVERSITY_AULAS_CONFIG.estratos_selector,
    balance_vars: raw.balance_vars?.length ? raw.balance_vars : DEFAULT_UNIVERSITY_AULAS_CONFIG.balance_vars,
    spread_vars: raw.spread_vars?.length ? raw.spread_vars : DEFAULT_UNIVERSITY_AULAS_CONFIG.spread_vars,
    candidate_pool_size: Math.max(1, Math.round(safeNumber(raw.candidate_pool_size, DEFAULT_UNIVERSITY_AULAS_CONFIG.candidate_pool_size))),
    simulation_runs: Math.max(0, Math.round(safeNumber(raw.simulation_runs, DEFAULT_UNIVERSITY_AULAS_CONFIG.simulation_runs))),
    mos_strategy: raw.mos_strategy ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.mos_strategy,
    coordination_mode: raw.coordination_mode ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.coordination_mode,
    replacement_depth_strategy: raw.replacement_depth_strategy ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.replacement_depth_strategy,
    min_replacements_per_titular: Math.max(0, Math.round(safeNumber(raw.min_replacements_per_titular, DEFAULT_UNIVERSITY_AULAS_CONFIG.min_replacements_per_titular))),
    max_replacements_per_titular: Math.max(0, Math.round(safeNumber(raw.max_replacements_per_titular, DEFAULT_UNIVERSITY_AULAS_CONFIG.max_replacements_per_titular))),
    extra_pool_policy: raw.extra_pool_policy ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.extra_pool_policy,
    replacement_equivalence_vars: raw.replacement_equivalence_vars?.length ? raw.replacement_equivalence_vars : DEFAULT_UNIVERSITY_AULAS_CONFIG.replacement_equivalence_vars,
    replacement_score_weights: raw.replacement_score_weights ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.replacement_score_weights,
    bolsas_reemplazo: Math.max(0, Math.round(safeNumber(raw.bolsas_reemplazo, DEFAULT_UNIVERSITY_AULAS_CONFIG.bolsas_reemplazo))),
    aulas_extra_operativas_default: Math.max(0, Math.round(safeNumber(raw.aulas_extra_operativas_default, DEFAULT_UNIVERSITY_AULAS_CONFIG.aulas_extra_operativas_default))),
    penalizacion_repetidos: Math.max(0, safeNumber(raw.penalizacion_repetidos, DEFAULT_UNIVERSITY_AULAS_CONFIG.penalizacion_repetidos)),
    pps_weight: Math.max(0, safeNumber(raw.pps_weight, DEFAULT_UNIVERSITY_AULAS_CONFIG.pps_weight)),
    coverage_weight: Math.max(0, safeNumber(raw.coverage_weight, DEFAULT_UNIVERSITY_AULAS_CONFIG.coverage_weight)),
    monte_carlo_n: Math.max(0, Math.round(safeNumber(raw.monte_carlo_n, DEFAULT_UNIVERSITY_AULAS_CONFIG.monte_carlo_n))),
    semilla: Math.round(safeNumber(raw.semilla, DEFAULT_UNIVERSITY_AULAS_CONFIG.semilla)),
    objective: raw.objective ?? DEFAULT_UNIVERSITY_AULAS_OBJECTIVE,
    notas_metodologicas: raw.notas_metodologicas ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.notas_metodologicas,
  };
}

function universityFacultyError(N: number) {
  if (N > 1000) return 0.05;
  if (N >= 300) return 0.07;
  return 0.10;
}

function universityFacultyConfidence(N: number) {
  return N < 300 ? 0.90 : 0.95;
}

function zFromConfidence(confianza: number | null | undefined, fallback = 1.96) {
  const conf = safeNumber(confianza, 0);
  if (conf <= 0 || conf >= 1) return fallback;
  if (Math.abs(conf - 0.90) < 0.0005) return 1.644853627;
  if (Math.abs(conf - 0.95) < 0.0005) return 1.96;
  if (Math.abs(conf - 0.99) < 0.0005) return 2.575829304;
  return fallback;
}

function normalizeUniversityLabel(label: string) {
  return label
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function defaultTitleFor(mode: ActiveDesk) {
  if (mode === "acreditacion") return "Diseño muestral de acreditación";
  if (mode === "opinion_universitaria") return "Muestra de aulas";
  return "Diseño muestral desde marco disponible";
}

function calcNFormulaPreview(N: number, p: number, z: number, e: number, deff: number) {
  if (N <= 0 || p < 0 || p > 1 || e <= 0 || e >= 1 || deff < 1) return null;
  const q = 1 - p;
  const num = z ** 2 * p * q * deff;
  const n = (N * num) / ((N - 1) * e ** 2 + num);
  return Number.isFinite(n) ? Math.ceil(n) : null;
}

function calcEPreview(n: number, N: number, p: number, z: number, deff: number) {
  if (n <= 0 || N <= 1 || p < 0 || p > 1 || deff < 1) return null;
  const q = 1 - p;
  const num = z ** 2 * p * q * deff * Math.max(N - n, 0);
  const den = n * Math.max(N - 1, 1);
  if (den <= 0) return null;
  return Math.sqrt(num / den);
}

function roundUpTo(value: number | null | undefined, multiple: number) {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  if (!Number.isFinite(multiple) || multiple <= 1) return Math.ceil(value);
  return Math.ceil(value / multiple) * multiple;
}

function calcFacultyIndependentPreview(comp: CalcMuestraComponente) {
  const p = comp.parametros;
  const rows = (comp.marco.estratos ?? []).map((e) => {
    const pEstrato = e.p_facultad == null ? p.p : safeNumber(e.p_facultad, p.p);
    const zEstrato = safeNumber(e.z_facultad, zFromConfidence(e.confianza_facultad, p.z));
    const n = calcNFormulaPreview(safeNumber(e.N), pEstrato, zEstrato, safeNumber(e.e_facultad, p.e), p.deff) ?? 0;
    return { estrato: e.label, N: safeNumber(e.N), n };
  });
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  return { total: total || null, rows };
}

function fmtSignedInt(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("es-PE")}`;
}

function tecnicaLabel(tecnica: CalcMuestraTecnica) {
  return METODOS_CLASICOS.find((m) => m.id === tecnica)?.label ??
    ({
      medicion_recurrente: "Medición recurrente",
      listado_externo_meta_fija: "Flujo legacy",
    } as Partial<Record<CalcMuestraTecnica, string>>)[tecnica] ??
    tecnica;
}

function productoLabel(producto: CalcMuestraWorkspaceProducto) {
  const labels: Record<CalcMuestraWorkspaceProducto, string> = {
    muestra_probabilistica: "Muestra probabilística",
    cobertura_marco: "Cobertura / marco a cubrir",
    matriz_cuotas: "Matriz de cuotas",
    componentes_mixtos: "Componentes mixtos calculables",
  };
  return labels[producto];
}

function tecnicaProducto(comp: CalcMuestraComponente): CalcMuestraWorkspaceProducto {
  if ((comp.marco.matriz_operativa?.length ?? 0) > 0) return "matriz_cuotas";
  if (comp.tecnica === "intencion_censal" || comp.tecnica === "barrido") return "cobertura_marco";
  if (comp.tecnica === "no_prob_cuotas" || comp.tecnica === "no_prob_conveniencia") return "matriz_cuotas";
  return "muestra_probabilistica";
}

function actorVisual(comp: CalcMuestraComponente) {
  const key = comp.actor_categoria === "otros" ? comp.actor_id || "otros" : comp.actor_categoria;
  const meta: Record<string, { label: string; copy: string; key: string }> = {
    administrativos: {
      key: "administrativos",
      label: "Personal administrativo",
      copy: "Actor institucional de cobertura censal",
    },
    docentes: {
      key: "docentes",
      label: "Docentes",
      copy: "Cobertura o cuotas según tamaño del marco",
    },
    estudiantes: {
      key: "estudiantes",
      label: "Estudiantes pregrado",
      copy: "Cobertura o aulas según marco disponible",
    },
    egresados: {
      key: "egresados",
      label: "Egresados",
      copy: "Cobertura o cuotas por acceso al marco",
    },
    empleadores: {
      key: "empleadores",
      label: "Empleadores",
      copy: "Actor cualitativo o de cuota específica",
    },
    otros: {
      key: "otros",
      label: comp.actor,
      copy: "Actor adicional",
    },
  };
  return meta[key] ?? meta.otros;
}

function criterioSalida(comp: CalcMuestraComponente) {
  if (!comp.resultado) return "Pendiente";
  if (["administrativos", "docentes", "estudiantes", "egresados"].includes(comp.actor_categoria)) {
    if (comp.tecnica === "no_prob_cuotas") {
      return `Cuota ${fmtInt(comp.meta.valor || comp.inferencia_acreditacion?.minimo_cuota || 150)}`;
    }
    if (comp.tecnica === "no_prob_conveniencia") {
      return `Cobertura ${fmtPct(comp.parametros.cobertura_objetivo)}`;
    }
    if (comp.tecnica === "prob_conglomerado_multietapico") {
      return `Sobremuestra ${fmtPct(comp.parametros.oversample_pct)}`;
    }
    return `Cobertura ${fmtPct(comp.parametros.cobertura_objetivo)}`;
  }
  if ((comp.resultado.cuotas_matriz?.length ?? 0) > 0) {
    return "Cuotas por celda";
  }
  if (comp.tecnica === "intencion_censal" || comp.tecnica === "barrido") {
    return `Cobertura ${fmtPct(comp.resultado.cobertura_objetivo)}`;
  }
  if (comp.tecnica === "no_prob_cuotas" || comp.tecnica === "no_prob_conveniencia") {
    return "Cuotas";
  }
  return "Muestra";
}

function naturalezaPara(tecnica: CalcMuestraTecnica) {
  if (tecnica.startsWith("prob_") || tecnica === "sistematico" || tecnica === "medicion_recurrente") return "prob";
  if (tecnica === "intencion_censal" || tecnica === "barrido" || tecnica === "listado_externo_meta_fija") return "operativo";
  return "no_prob";
}

function origenPara(tecnica: CalcMuestraTecnica): CalcMuestraOrigenTamano {
  if (tecnica === "intencion_censal" || tecnica === "barrido") return "cobertura_esperada";
  if (tecnica === "no_prob_cuotas" || tecnica === "no_prob_conveniencia") return "matriz_perfiles_cualitativa";
  if (tecnica === "listado_externo_meta_fija") return "meta_contractual";
  return "formula";
}

function respaldoPara(tecnica: CalcMuestraTecnica): CalcMuestraNivelRespaldo {
  if (tecnica.startsWith("prob_") || tecnica === "sistematico") return "representatividad_estadistica";
  if (tecnica === "intencion_censal" || tecnica === "barrido") return "representatividad_operacional";
  if (tecnica === "no_prob_cuotas") return "representatividad_teorica_controlada";
  return "evidencia_descriptiva";
}

function defaultComponente(overrides: ComponentePatch = {}): CalcMuestraComponente {
  const tecnica = overrides.tecnica ?? "prob_aleatorio_simple";
  return {
    id: overrides.id ?? uid("cmp"),
    actor: overrides.actor ?? "Población objetivo",
    actor_id: overrides.actor_id ?? "poblacion_objetivo",
    actor_categoria: overrides.actor_categoria ?? "otros",
    canal_recojo: overrides.canal_recojo ?? "presencial",
    tecnica,
    naturaleza: overrides.naturaleza ?? naturalezaPara(tecnica),
    origen_tamano: overrides.origen_tamano ?? origenPara(tecnica),
    nivel_respaldo: overrides.nivel_respaldo ?? respaldoPara(tecnica),
    marco: {
      universo_bruto: 0,
      marco_validado: 0,
      marco_contactable: 0,
      estado: "no_definido",
      notas: "",
      estratos: [],
      matriz_operativa: [],
      ...(overrides.marco ?? {}),
    },
    parametros: { ...DEFAULT_PARAMS, ...(overrides.parametros ?? {}) },
    meta: {
      tipo: "objetivo",
      valor: 0,
      variable_control: "",
      sub_cuotas: {},
      ...(overrides.meta ?? {}),
    },
    resultado: overrides.resultado ?? null,
    inferencia_acreditacion: overrides.inferencia_acreditacion,
  };
}

function withUniversityEstratoDefaults(estratos: CalcMuestraEstrato[] = [], kind: "universidad" | "facultad" = "universidad") {
  const auditMap = kind === "facultad" ? UNIVERSITY_REFERENCE_FACULTY_SCENARIO_DEFAULTS : UNIVERSITY_REFERENCE_BASE_SCENARIO_DEFAULTS;
  return estratos.map((e) => ({
    ...e,
    sub_a_label: e.sub_a_label || "Mujeres",
    sub_b_label: e.sub_b_label || "Hombres",
    e_facultad: safeNumber(e.e_facultad, universityFacultyError(safeNumber(e.N))),
    confianza_facultad: safeNumber(e.confianza_facultad, universityFacultyConfidence(safeNumber(e.N))),
    p_facultad: e.p_facultad == null
      ? UNIVERSITY_REFERENCE_SUCCESS_RATE[e.label.toUpperCase()] ?? UNIVERSITY_REFERENCE_SUCCESS_RATE[normalizeUniversityLabel(e.label)] ?? 0.5
      : safeNumber(e.p_facultad, UNIVERSITY_REFERENCE_SUCCESS_RATE[e.label.toUpperCase()] ?? UNIVERSITY_REFERENCE_SUCCESS_RATE[normalizeUniversityLabel(e.label)] ?? 0.5),
    ...(auditMap[normalizeUniversityLabel(e.label)] ?? {}),
    aulas_extra_operativas: e.aulas_extra_operativas == null
      ? auditMap[normalizeUniversityLabel(e.label)]?.aulas_extra_operativas ?? 1
      : Math.max(0, Math.round(safeNumber(e.aulas_extra_operativas, 1))),
  }));
}

function makeUniversityComponent(
  base: CalcMuestraComponente,
  kind: "universidad" | "facultad",
): CalcMuestraComponente {
  const escenario = kind === "universidad" ? ESCENARIOS_OPINION[0] : ESCENARIOS_OPINION[1];
  const actorId = kind === "universidad" ? UNIVERSITY_TOTAL_COMPONENT_ID : UNIVERSITY_FACULTY_COMPONENT_ID;
  const existingNew = base.actor_id === actorId;
  const techniqueBase: CalcMuestraComponente = base.tecnica === escenario.tecnica
    ? {
        ...base,
        tecnica: escenario.tecnica,
        naturaleza: naturalezaPara(escenario.tecnica),
        origen_tamano: origenPara(escenario.tecnica),
        nivel_respaldo: respaldoPara(escenario.tecnica),
      }
    : setTecnica(base, escenario.tecnica);
  return {
    ...techniqueBase,
    id: existingNew ? base.id : kind === "universidad" ? base.id : `${base.id}-fac`,
    actor: kind === "universidad"
      ? "Muestra con representatividad a nivel universidad"
      : "Muestra con representatividad a nivel facultad",
    actor_id: actorId,
    actor_categoria: "otros",
    canal_recojo: "aula_qr",
    parametros: existingNew
      ? { ...DEFAULT_PARAMS, ...escenario.parametros, ...base.parametros }
      : { ...base.parametros, ...escenario.parametros },
    marco: {
      ...base.marco,
      estado: base.marco.estado === "no_definido" ? "validado" : base.marco.estado,
      estratos: withUniversityEstratoDefaults(base.marco.estratos ?? [], kind),
    },
    meta: {
      ...base.meta,
      tipo: "objetivo",
      valor: existingNew ? safeNumber(base.meta.valor) : 0,
      variable_control: "facultad_sexo",
    },
    resultado: existingNew ? base.resultado ?? null : null,
  };
}

function universityComponents(componentes: CalcMuestraComponente[]) {
  const totalExisting = componentes.find((c) => c.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID);
  const facultyExisting = componentes.find((c) => c.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID);
  const legacy = componentes.find((c) => c.actor_id === "estudiantes") ?? componentes[0];
  const base = legacy ?? defaultComponente({
    actor: "Estudiantes pregrado",
    actor_id: "estudiantes",
    actor_categoria: "estudiantes",
    canal_recojo: "aula_qr",
    tecnica: "prob_conglomerado_multietapico",
  });
  const sharedMarco =
    (totalExisting?.marco.estratos?.length ? totalExisting.marco : null) ??
    (facultyExisting?.marco.estratos?.length ? facultyExisting.marco : null) ??
    base.marco;
  const total = makeUniversityComponent({ ...(totalExisting ?? base), marco: sharedMarco }, "universidad");
  const faculty = makeUniversityComponent({ ...(facultyExisting ?? base), marco: sharedMarco }, "facultad");
  return [total, faculty] as const;
}

function universityWorkspace(workspace: CalcMuestraWorkspace, total: CalcMuestraComponente, faculty: CalcMuestraComponente): CalcMuestraWorkspace {
  const byId = new Map((workspace.escenarios.length ? workspace.escenarios : ESCENARIOS_OPINION).map((e) => [e.id, e]));
  return {
    ...workspace,
    aulas_config: normalizeUniversityAulasConfig(workspace.aulas_config),
    escenarios: ESCENARIOS_OPINION.map((base) => {
      const current = byId.get(base.id);
      const component_id = base.id === "total-universidad" ? total.id : faculty.id;
      return {
        ...base,
        ...(current ?? {}),
        component_id,
        incluir_reporte: current?.incluir_reporte ?? base.incluir_reporte,
        redondeo_multiplo: current?.redondeo_multiplo ?? base.redondeo_multiplo,
      };
    }),
  };
}

function componentFormulaBase(comp: CalcMuestraComponente) {
  if (comp.tecnica === "prob_estratificado_independiente") {
    return calcFacultyIndependentPreview(comp).total;
  }
  return calcNFormulaPreview(comp.marco.marco_validado, comp.parametros.p, comp.parametros.z, comp.parametros.e, comp.parametros.deff);
}

function componentRoundedTarget(comp: CalcMuestraComponente, escenario?: CalcMuestraWorkspaceEscenario) {
  const formula = componentFormulaBase(comp);
  return roundUpTo(formula, escenario?.redondeo_multiplo ?? 100);
}

function scenarioTarget(escenario: CalcMuestraWorkspaceEscenario) {
  const explicit = safeNumber(escenario.parametros.n_minimo_estrato);
  return explicit > 0 ? explicit : 0;
}

function prepareUniversityStudyForCalculation(estudio: CalcMuestraEstudio, workspace: CalcMuestraWorkspace): CalcMuestraEstudio {
  const [rawTotal, rawFaculty] = universityComponents(estudio.componentes);
  const nextWorkspace = universityWorkspace(workspace, rawTotal, rawFaculty);
  const totalScenario = nextWorkspace.escenarios.find((e) => e.component_id === rawTotal.id);
  const facultyScenario = nextWorkspace.escenarios.find((e) => e.component_id === rawFaculty.id);
  const totalRounded = scenarioTarget(totalScenario ?? ESCENARIOS_OPINION[0]) || componentRoundedTarget(rawTotal, totalScenario);
  const facultyRounded = scenarioTarget(facultyScenario ?? ESCENARIOS_OPINION[1]) || componentRoundedTarget(rawFaculty, facultyScenario);
  const total = totalRounded && safeNumber(rawTotal.meta.valor) <= 0
    ? { ...rawTotal, meta: { ...rawTotal.meta, valor: totalRounded } }
    : rawTotal;
  const faculty = facultyRounded && safeNumber(rawFaculty.meta.valor) <= 0
    ? { ...rawFaculty, meta: { ...rawFaculty.meta, valor: facultyRounded } }
    : rawFaculty;
  return {
    ...estudio,
    componentes: [total, faculty],
    workspace: universityWorkspace(nextWorkspace, total, faculty),
  };
}

function setTecnica(comp: CalcMuestraComponente, tecnica: CalcMuestraTecnica): CalcMuestraComponente {
  return {
    ...comp,
    tecnica,
    naturaleza: naturalezaPara(tecnica),
    origen_tamano: origenPara(tecnica),
    nivel_respaldo: respaldoPara(tecnica),
    resultado: null,
  };
}

function primaryMetric(comp: CalcMuestraComponente) {
  const r = comp.resultado;
  if (!r) return "Pendiente";
  if ((r.cuotas_matriz?.length ?? 0) > 0) {
    return `${fmtInt(r.n_objetivo)} encuestas · ${r.cuotas_matriz?.length ?? 0} cuotas`;
  }
  if (comp.tecnica === "intencion_censal" || comp.tecnica === "barrido") {
    return `${fmtInt(r.n_objetivo)} objetivo · ${fmtInt(r.n_operativo)} a cubrir`;
  }
  if (r.unidades_operativas) {
    return `${fmtInt(r.n_objetivo)} casos · ${fmtInt(r.unidades_operativas)} unidades`;
  }
  return `${fmtInt(r.n_objetivo)} casos`;
}

function hasUsefulResult(comp: CalcMuestraComponente) {
  return !!comp.resultado && safeNumber(comp.resultado.n_objetivo, 0) > 0;
}

function calculatedTargetForComponents(componentes: CalcMuestraComponente[]) {
  return componentes.reduce((peak, comp) => Math.max(peak, safeNumber(comp.resultado?.n_objetivo, 0)), 0);
}

function classroomFrameReady(aulasState: CalcMuestraAulasState | null) {
  const frame = aulasState?.frame ?? null;
  return Boolean(
    rowsFrom(frame?.aula_frame).length ||
    rowsFrom(frame?.population).length ||
    frameAuditNumber(frame, "classroom_n") > 0 ||
    frameAuditNumber(frame, "classroom_included_n") > 0 ||
    frameAuditNumber(frame, "population_n") > 0,
  );
}

function classroomComparisonForState(aulasState: CalcMuestraAulasState | null) {
  return aulasState?.method_comparison ?? aulasState?.selection?.method_comparison ?? null;
}

function classroomComparisonReady(aulasState: CalcMuestraAulasState | null) {
  const comparison = classroomComparisonForState(aulasState);
  return Boolean(
    comparison &&
    (
      rowsFrom(comparison.methods).length ||
      rowsFrom(comparison.balance).length ||
      rowsFrom(comparison.simulation_summary).length ||
      comparison.recommendation
    ),
  );
}

function classroomSelectionForState(aulasState: CalcMuestraAulasState | null) {
  return aulasState?.selection ?? null;
}

function classroomSelectionRowsForState(aulasState: CalcMuestraAulasState | null) {
  return rowsFrom<Record<string, unknown>>(classroomSelectionForState(aulasState)?.selection);
}

function classroomM1RowsForState(aulasState: CalcMuestraAulasState | null) {
  return classroomSelectionRowsForState(aulasState).filter((row) => classroomRowText(row, ["sample_role"]) === "titular" || classroomRowText(row, ["wave"]) === "M1");
}

function classroomReserveRowsForState(aulasState: CalcMuestraAulasState | null) {
  return classroomSelectionRowsForState(aulasState).filter((row) => {
    const wave = classroomRowText(row, ["wave"]);
    const role = classroomRowText(row, ["sample_role"]);
    return role === "chain_reserve" || Boolean(wave && wave !== "M1" && role !== "extra_reserve_pool");
  });
}

function classroomExtraReserveRowsForState(aulasState: CalcMuestraAulasState | null) {
  return classroomSelectionRowsForState(aulasState).filter((row) => classroomRowText(row, ["sample_role"]) === "extra_reserve_pool");
}

function classroomSelectionReady(aulasState: CalcMuestraAulasState | null) {
  return classroomM1RowsForState(aulasState).length > 0;
}

function classroomRecoveryTarget(aulasState: CalcMuestraAulasState | null): { section: string; tab: ClassroomLabTab } {
  if (classroomSelectionReady(aulasState)) return { section: "aulas", tab: "seleccion" };
  if (classroomComparisonReady(aulasState)) return { section: "aulas", tab: "metodo" };
  if (classroomFrameReady(aulasState)) return { section: "marco", tab: "marco" };
  return { section: "definicion", tab: "marco" };
}

function classroomReplacementSimulationForState(aulasState: CalcMuestraAulasState | null) {
  const selection = classroomSelectionForState(aulasState);
  return aulasState?.replacement_simulation ?? selection?.replacement_simulation ?? null;
}

function classroomReplacementReady(aulasState: CalcMuestraAulasState | null) {
  const simulation = classroomReplacementSimulationForState(aulasState);
  return Boolean(
    classroomReserveRowsForState(aulasState).length &&
    simulation &&
    (
      rowsFrom((simulation as Record<string, unknown>).suggestions).length ||
      rowsFrom((simulation as Record<string, unknown>).replacement_suggestions).length ||
      rowsFrom((simulation as Record<string, unknown>).impact).length ||
      rowsFrom((simulation as Record<string, unknown>).summary).length
    ),
  );
}

function productSummary(productos: CalcMuestraWorkspaceProducto[]) {
  if (productos.length > 1) return "Mixto";
  return productoLabel(productos[0] ?? "muestra_probabilistica");
}

function compactProductSummary(productos: CalcMuestraWorkspaceProducto[]) {
  if (productos.length > 1) return "mixto";
  const producto = productos[0] ?? "muestra_probabilistica";
  if (producto === "muestra_probabilistica") return "muestra";
  if (producto === "cobertura_marco") return "cobertura";
  if (producto === "matriz_cuotas") return "cuotas";
  return "mixto";
}

function compactTechniqueLabel(tecnica: CalcMuestraTecnica) {
  if (tecnica === "prob_aleatorio_simple") return "clásico";
  if (tecnica === "prob_estratificado") return "estratos";
  if (tecnica === "prob_estratificado_independiente") return "dominios";
  if (tecnica === "prob_conglomerado_multietapico") return "conglomerado";
  if (tecnica === "sistematico") return "sistemático";
  if (tecnica === "intencion_censal" || tecnica === "barrido") return "cobertura";
  if (tecnica === "no_prob_cuotas" || tecnica === "no_prob_conveniencia") return "cuotas";
  return tecnicaLabel(tecnica);
}

function chromeStatusForDesk({
  desk,
  componentes,
  resultados,
  calculando,
  reporteEnCurso,
  busy,
}: {
  desk: ActiveDesk;
  componentes: number;
  resultados: number;
  calculando: boolean;
  reporteEnCurso: boolean;
  busy: string | null;
}): CalcMuestraChromeStatus {
  if (calculando) return { label: "Calculando", detail: "componentes en proceso", tone: "working", icon: Loader2 };
  if (busy) return { label: busy, detail: "operación activa", tone: "working", icon: Loader2 };
  if (reporteEnCurso) return { label: "Reporte", detail: "generando evidencia", tone: "working", icon: FileText };
  if (desk === "sin_definir") return { label: "Tipo por elegir", detail: "abre una mesa de muestra", tone: "idle", icon: Database };
  if (resultados > 0) return { label: "Cálculo listo", detail: `${resultados}/${componentes} componentes`, tone: "ready", icon: CheckCircle2 };
  if (componentes > 0) return { label: "Mesa preparada", detail: "pendiente de cálculo", tone: "working", icon: Target };
  return { label: "Sin componentes", detail: "declara el marco", tone: "idle", icon: ClipboardList };
}

function chromeTokensForDesk({
  desk,
  estudio,
  workspace,
  productos,
  resultados,
  aulasState,
}: {
  desk: ActiveDesk;
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  productos: CalcMuestraWorkspaceProducto[];
  resultados: number;
  aulasState: CalcMuestraAulasState | null;
}): CalcMuestraChromeToken[] {
  const componentes = estudio.componentes;
  const productText = compactProductSummary(productos);
  const hasResult = resultados > 0;
  const firstComp = componentes[0];
  const sourceReady = Boolean(workspace.fuente_marco || workspace.marco_disponible);

  if (desk === "opinion_universitaria") {
    const totalComp = componentes.find((comp) => comp.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID) ?? componentes[0];
    const facultyComp = componentes.find((comp) => comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID) ?? componentes[1] ?? componentes[0];
    const estratos = totalComp?.marco.estratos ?? [];
    const marcoTotal = safeNumber(totalComp?.marco.marco_validado, 0);
    const selectionReady = classroomSelectionReady(aulasState);
    const comparisonReady = classroomComparisonReady(aulasState);
    const target = calculatedTargetForComponents([totalComp, facultyComp].filter(Boolean) as CalcMuestraComponente[]);
    return [
      { label: "Mesa", value: "Muestra de aulas", tone: "path" },
      { label: "Base", value: marcoTotal ? `${fmtInt(marcoTotal)} est.` : estratos.length ? `${fmtInt(estratos.length)} dominios` : "por validar", tone: marcoTotal ? "ready" : "working" },
      { label: "Cálculo", value: target ? `${fmtInt(target)} objetivo` : hasResult ? "calculado" : "pendiente", tone: target || hasResult ? "ready" : "working" },
      { label: "Aulas", value: selectionReady ? "titulares + reemplazos" : comparisonReady ? "métodos listos" : "por seleccionar", tone: selectionReady ? "ready" : comparisonReady ? "working" : "neutral" },
    ];
  }

  if (desk === "acreditacion") {
    const withChannel = componentes.filter((comp) => comp.canal_recojo !== "sin_definir").length;
    return [
      { label: "Tipo", value: "Acreditación", tone: "path" },
      { label: "Actores", value: componentes.length ? `${componentes.length} componentes` : "sin actores", tone: componentes.length ? "ready" : "working" },
      { label: "Canales", value: `${withChannel}/${componentes.length || 0} definidos`, tone: componentes.length > 0 && withChannel === componentes.length ? "ready" : "working" },
      { label: "Salida", value: hasResult ? "metas listas" : productText, tone: hasResult ? "ready" : "neutral" },
    ];
  }

  if (desk === "territorial_handoff") {
    return [
      { label: "Tipo", value: "Territorial", tone: "path" },
      { label: "Base", value: "zonas/manzanas", tone: "ready" },
      { label: "Mesa", value: "Hojas de Ruta", tone: "ready" },
      { label: "Salida", value: "rutas y viviendas", tone: "neutral" },
    ];
  }

  if (desk === "legacy") {
    return [
      { label: "Tipo", value: "Sesión anterior", tone: "path" },
      { label: "Compatibilidad", value: "solo lectura", tone: "working" },
      { label: "Componentes", value: `${componentes.length}`, tone: componentes.length ? "ready" : "neutral" },
      { label: "Salida", value: hasResult ? "conservada" : "migrar", tone: hasResult ? "ready" : "working" },
    ];
  }

  return [
    { label: "Tipo", value: "General", tone: "path" },
    { label: "Base", value: sourceReady ? "marco propio" : "por definir", tone: sourceReady ? "ready" : "working" },
    { label: "Método", value: firstComp ? compactTechniqueLabel(firstComp.tecnica) : "por elegir", tone: firstComp ? "ready" : "working" },
    { label: "Salida", value: hasResult ? "resultado listo" : productText, tone: hasResult ? "ready" : "neutral" },
  ];
}

function activeSectionMetaForDesk(desk: ActiveDesk, activeSection: string) {
  const sections = railSectionsForDesk(desk);
  return sections.find((item) => item.id === activeSection) ?? sections[0] ?? null;
}

function contextChecksForDesk({
  desk,
  activeSection,
  estudio,
  workspace,
  aulasState,
}: {
  desk: ActiveDesk;
  activeSection: string;
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}): CalcMuestraContextCheck[] {
  const componentes = estudio.componentes;
  const hasSource = Boolean(workspace.fuente_marco || workspace.marco_disponible);
  const marcoReady = componentes.some((comp) =>
    safeNumber(comp.marco.marco_validado, 0) > 0 ||
    (comp.marco.estratos ?? []).some((row) => safeNumber(row.N, 0) > 0) ||
    (comp.marco.matriz_operativa?.length ?? 0) > 0,
  );
  const hasResult = componentes.some(hasUsefulResult);
  const hasVariables = workspace.variables_control.some((variable) => variable.disponible) ||
    componentes.some((comp) => (comp.marco.estratos ?? []).length > 0);
  const totalComp = componentes.find((comp) => comp.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID) ?? componentes[0];
  const facultyComp = componentes.find((comp) => comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID) ?? componentes[1] ?? componentes[0];
  const totalEstratos = totalComp?.marco.estratos ?? [];
  const hasSexo = totalEstratos.some((row) => safeNumber(row.N_a, 0) > 0 || safeNumber(row.N_b, 0) > 0);
  const comparisonReady = classroomComparisonReady(aulasState);
  const selectionReady = classroomSelectionReady(aulasState);
  const replacementReady = classroomReplacementReady(aulasState);
  const totalTarget = safeNumber(totalComp?.resultado?.n_objetivo, 0);
  const facultyTarget = safeNumber(facultyComp?.resultado?.n_objetivo, 0);

  if (desk === "opinion_universitaria") {
    if (activeSection === "marco") {
      return [
        { label: "Fuente", value: workspace.fuente_marco || "pendiente", ready: hasSource, icon: Database },
        { label: "Facultades", value: totalEstratos.length ? `${fmtInt(totalEstratos.length)} dominios` : "sin dominios", ready: totalEstratos.length > 0, icon: Layers3 },
        { label: "Sexo", value: hasSexo ? "control disponible" : "pendiente", ready: hasSexo, icon: Users },
        { label: "Marco", value: totalComp ? fmtInt(totalComp.marco.marco_validado) : "sin marco", ready: marcoReady, icon: Table2 },
      ];
    }
    if (activeSection === "calculo") {
      return [
        { label: "Marco", value: marcoReady ? "validado" : "pendiente", ready: marcoReady, icon: Database },
        { label: "Universidad", value: totalTarget ? fmtInt(totalTarget) : "sin N", ready: totalTarget > 0, icon: Target },
        { label: "Facultad", value: facultyTarget ? fmtInt(facultyTarget) : "sin N", ready: facultyTarget > 0, icon: BarChart3 },
        { label: "Resultado", value: hasResult ? "calculado" : "por calcular", ready: hasResult, icon: Calculator },
      ];
    }
    if (activeSection === "aulas") {
      return [
        { label: "Cuotas", value: hasResult ? "calculadas" : "pendientes", ready: hasResult, icon: Target },
        { label: "Métodos", value: comparisonReady ? "comparados" : "por correr", ready: comparisonReady, icon: Settings2 },
        { label: "Aulas titulares", value: selectionReady ? "plan listo" : "pendiente", ready: selectionReady, icon: Grid3X3 },
        { label: "Reemplazos", value: replacementReady ? "probados" : "pendiente", ready: replacementReady, icon: RefreshCw },
      ];
    }
    if (activeSection === "salidas") {
      return [
        { label: "Cálculo", value: hasResult ? "listo" : "pendiente", ready: hasResult, icon: Calculator },
        { label: "Aulas", value: selectionReady ? "plan generado" : "sin plan", ready: selectionReady, icon: Grid3X3 },
        { label: "Seguimiento", value: selectionReady ? "listo para usar" : "requiere plan", ready: selectionReady, icon: Route },
        { label: "Privacidad", value: "datos protegidos", ready: true, icon: FileText },
      ];
    }
    return [
      { label: "Contrato", value: estudio.titulo || "sin título", ready: Boolean(estudio.titulo), icon: ClipboardList },
      { label: "Fuente", value: workspace.fuente_marco || "pendiente", ready: hasSource, icon: Database },
      { label: "Observación", value: "estudiante", ready: true, icon: Users },
      { label: "Selección", value: "curso y horario", ready: true, icon: Grid3X3 },
    ];
  }

  if (desk === "acreditacion") {
    const withChannel = componentes.filter((comp) => comp.canal_recojo !== "sin_definir").length;
    return [
      { label: "Actores", value: componentes.length ? `${componentes.length} componentes` : "sin actores", ready: componentes.length > 0, icon: ClipboardList },
      { label: "Canales", value: `${withChannel}/${componentes.length || 0} definidos`, ready: componentes.length > 0 && withChannel === componentes.length, icon: Users },
      { label: "Contexto", value: hasSource ? "documentado" : "pendiente", ready: hasSource, icon: Database },
      { label: "Metas", value: hasResult ? "calculadas" : "por calcular", ready: hasResult, icon: BarChart3 },
    ];
  }

  if (desk === "territorial_handoff") {
    return [
      { label: "Territorio", value: "Hojas de Ruta", ready: true, icon: MapPinned },
      { label: "Zonas", value: "fuera de este módulo", ready: true, icon: Route },
      { label: "Viviendas", value: "en Hojas de Ruta", ready: true, icon: Home },
      { label: "Campo", value: "listo para recorrido", ready: true, icon: CheckCircle2 },
    ];
  }

  if (desk === "legacy") {
    return [
      { label: "Sesión", value: "anterior", ready: false, icon: FileText },
      { label: "Migración", value: "recomendada", ready: false, icon: RefreshCw },
      { label: "Cálculo", value: hasResult ? "conservado" : "pendiente", ready: hasResult, icon: Calculator },
      { label: "Salida", value: "compatibilidad", ready: true, icon: CheckCircle2 },
    ];
  }

  return [
    { label: "Marco", value: marcoReady ? "declarado" : "pendiente", ready: marcoReady, icon: Database },
    { label: "Variables", value: hasVariables ? "configuradas" : "pendientes", ready: hasVariables, icon: Layers3 },
    { label: "Método", value: componentes[0] ? tecnicaLabel(componentes[0].tecnica) : "sin método", ready: componentes.length > 0, icon: Settings2 },
    { label: "Resultados", value: hasResult ? "calculados" : "por calcular", ready: hasResult, icon: BarChart3 },
  ];
}

function classroomLabStatusesForSidebar(estudio: CalcMuestraEstudio, aulasState: CalcMuestraAulasState | null): Record<ClassroomLabTab, GuideStatus> {
  const hasCalculatedQuota = estudio.componentes.some(hasUsefulResult);
  const frameReady = classroomFrameReady(aulasState);
  const comparisonReady = classroomComparisonReady(aulasState);
  const selectionReady = classroomSelectionReady(aulasState);
  const replacementReady = classroomReplacementReady(aulasState);
  return {
    marco: guideStatus(frameReady),
    objetivo: guideStatus(hasCalculatedQuota, frameReady),
    metodo: guideStatus(comparisonReady, hasCalculatedQuota),
    laboratorio: guideStatus(comparisonReady, hasCalculatedQuota),
    seleccion: guideStatus(selectionReady, comparisonReady),
    reemplazos: guideStatus(replacementReady, selectionReady),
    auditoria: guideStatus(selectionReady || comparisonReady, hasCalculatedQuota),
  };
}

function sidebarTabsForDeskSection({
  desk,
  activeSection,
  estudio,
  workspace,
  aulasState,
}: {
  desk: ActiveDesk;
  activeSection: string;
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}): CalcMuestraSidebarTab[] {
  const componentes = estudio.componentes;
  const totalComp = componentes.find((comp) => comp.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID) ?? componentes[0];
  const facultyComp = componentes.find((comp) => comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID) ?? componentes[1] ?? componentes[0];
  const marcoReady = componentes.some((comp) =>
    safeNumber(comp.marco.marco_validado, 0) > 0 ||
    (comp.marco.estratos ?? []).some((row) => safeNumber(row.N, 0) > 0),
  );
  const hasResult = componentes.some(hasUsefulResult);
  const hasSource = Boolean(workspace.fuente_marco || workspace.marco_disponible);
  const declaredSources = workspace.source_bindings ?? [];
  const declaredSourcesReady = declaredSources.some((source) =>
    Boolean(source.file_name || source.file_id || source.spreadsheet_id || source.status === "cargada" || source.status === "validada"),
  );
  const builtAulasFrameReady = Boolean(
    aulasState?.frame &&
    (
      rowsFrom(aulasState.frame.population).length > 0 ||
      rowsFrom(aulasState.frame.aula_frame).length > 0 ||
      frameAuditNumber(aulasState.frame, "population_n") > 0 ||
      frameAuditNumber(aulasState.frame, "classroom_n") > 0
    ),
  );
  const requiredMapped = UNIVERSITY_REQUIRED_VARIABLES
    .filter((row) => row.required)
    .every((required) => (workspace.variable_mappings ?? []).some((row) => row.role === required.role && row.column));
  const observedCategoryReady = Boolean(
    (workspace.category_mappings ?? []).some((mapping) => (mapping.values ?? []).length > 0) ||
    universityObservedCategoryRows(workspace, aulasState, 1).length > 0,
  );
  const hasDescriptiveFrame = Boolean(
    rowsFrom(aulasState?.frame?.population).length ||
    rowsFrom(aulasState?.frame?.aula_frame).length ||
    frameAuditNumber(aulasState?.frame, "population_n") > 0 ||
    frameAuditNumber(aulasState?.frame, "classroom_n") > 0 ||
    frameAuditNumber(aulasState?.frame, "input_rows") > 0 ||
    totalComp?.marco?.estratos?.length,
  );
  const publicationConfigured = Boolean(
    workspace.publication_config?.include_workbook ||
    workspace.publication_config?.google_sheets_enabled ||
    workspace.publication_config?.spreadsheet_id,
  );
  const comparisonReady = classroomComparisonReady(aulasState);
  const selectionReady = classroomSelectionReady(aulasState);
  const replacementReady = classroomReplacementReady(aulasState);
  const effectiveMarcoReady = marcoReady || builtAulasFrameReady;

  if (desk === "opinion_universitaria") {
    if (activeSection === "definicion") {
      const baseReady = declaredSourcesReady || hasDescriptiveFrame;
      const baseConfigured = baseReady && requiredMapped;
      const aulasConfig = normalizeUniversityAulasConfig(workspace.aulas_config);
      const eligibilityReady = Boolean(aulasConfig.accepted_conditions?.length) && safeNumber(aulasConfig.min_elegibles_aula, 0) > 0;
      return [
        { id: "def-estudio", label: "Estudio", detail: "nombre, cliente y alcance", icon: ClipboardList, status: guideStatus(Boolean(estudio.titulo)), targetId: "cmv2-local-def-estudio" },
        { id: "def-bases", label: "Bases", detail: "archivos, hojas y lectura", icon: Database, status: guideStatus(baseReady, hasSource), targetId: "cmv2-local-def-bases" },
        { id: "def-variables", label: "Variables", detail: "columnas del Excel", icon: Table2, status: guideStatus(baseConfigured, baseReady || hasSource), targetId: "cmv2-local-def-variables" },
        { id: "def-categorias", label: "Categorías", detail: "valores y elegibilidad", icon: SlidersHorizontal, status: guideStatus(observedCategoryReady || eligibilityReady, baseConfigured || hasDescriptiveFrame), targetId: "cmv2-local-def-categorias" },
      ];
    }
    if (activeSection === "marco") {
      return [
        { id: "marco-poblacion", label: "Población", detail: "solo estudiantes elegibles", icon: Users, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-marco-poblacion" },
        { id: "marco-aulas", label: "Aulas", detail: "solo curso-horario", icon: Grid3X3, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-marco-aulas" },
        { id: "marco-validacion", label: "Consistencia", detail: "bases relacionadas", icon: CheckCircle2, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-marco-validacion" },
        { id: "marco-cruces", label: "Cruces", detail: "facultad por controles", icon: BarChart3, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-marco-cruces" },
      ];
    }
    if (activeSection === "calculo") {
      return [
        { id: "calculo-guia", label: "Ruta", detail: "estado y próximo paso", icon: Route, status: guideStatus(effectiveMarcoReady || hasResult, declaredSourcesReady), targetId: "cmv2-local-calculo-guia" },
        { id: "calculo-propuestas", label: "Propuestas", detail: "N, cuotas y aulas", icon: Calculator, status: guideStatus(hasResult, effectiveMarcoReady), targetId: "cmv2-local-calculo-propuestas" },
        { id: "calculo-ajustes", label: "Supuestos", detail: "precisión, DEFF y campo", icon: SlidersHorizontal, status: guideStatus(Boolean(totalComp || facultyComp), effectiveMarcoReady), targetId: "cmv2-local-calculo-ajustes" },
      ];
    }
    if (activeSection === "aulas") {
      const statuses = classroomLabStatusesForSidebar(estudio, aulasState);
      return CLASSROOM_LAB_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        detail: tab.detail,
        icon: tab.icon,
        status: statuses[tab.id],
        classroomTab: tab.id,
      }));
    }
    if (activeSection === "salidas") {
      const deliverablesReady = hasResult && selectionReady && publicationConfigured;
      return [
        { id: "salidas-guia", label: "Checklist", detail: "cálculo, titulares y reemplazos", icon: Route, status: guideStatus(hasResult && selectionReady && replacementReady, effectiveMarcoReady), targetId: "cmv2-local-salidas-guia" },
        { id: "salidas-entregables", label: "Entregables", detail: "Excel, Sheets y privacidad", icon: FileText, status: guideStatus(deliverablesReady, hasResult && selectionReady), targetId: "cmv2-local-salidas-entregables" },
        { id: "salidas-resultados", label: "Excel y hojas", detail: "tablas de cierre", icon: BarChart3, status: guideStatus(hasResult), targetId: "cmv2-local-salidas-resultados" },
        { id: "salidas-monitoreo", label: "Seguimiento", detail: "aulas para campo", icon: Grid3X3, status: guideStatus(selectionReady, comparisonReady), targetId: "cmv2-local-salidas-monitoreo" },
        { id: "salidas-reservas", label: "Reemplazos", detail: "rutas auditables por aula", icon: RefreshCw, status: guideStatus(replacementReady, selectionReady), targetId: "cmv2-local-salidas-reservas" },
      ];
    }
  }

  const activeMeta = activeSectionMetaForDesk(desk, activeSection);
  return [
    {
      id: "resumen",
      label: activeMeta?.label ?? "Sección",
      detail: activeMeta?.detail ?? "trabajo de la sección",
      icon: activeMeta?.icon ?? Route,
      status: guideStatus(true),
      targetId: activeMeta?.targetId,
    },
    { id: "configuracion", label: "Configuración", detail: "entradas y criterios", icon: SlidersHorizontal, status: guideStatus(Boolean(componentes.length)), targetId: activeMeta?.targetId },
    { id: "resultado", label: "Resultado", detail: "salida verificable", icon: BarChart3, status: guideStatus(hasResult), targetId: activeMeta?.targetId },
  ];
}

function NumberCell({
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
}: {
  value: number | null | undefined;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="cmv2-number-cell">
      <input
        type="number"
        min={min}
        step={step}
        value={toInputNumber(value)}
        onChange={(e) => onChange(safeNumber(e.currentTarget.value, 0))}
      />
      {suffix && <span>{suffix}</span>}
    </label>
  );
}

export default function CalcMuestraPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    estudio,
    hydrated,
    calculando,
    reporteJobId,
    hydrate,
    replaceEstudio,
    patchEstudio,
    setWorkspace,
    setTitulo,
    setContexto,
    setComponentes,
    setCalculando,
    setReporteMeta,
  } = useCalcMuestraStore();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reporteEnCurso, setReporteEnCurso] = useState(false);
  const [activeRailSection, setActiveRailSection] = useState("pathways");
  const [activeClassroomLabTab, setActiveClassroomLabTab] = useState<ClassroomLabTab>("marco");
  const [activeLocalTabs, setActiveLocalTabs] = useState<Record<string, string>>({});
  const [choosingDesk, setChoosingDesk] = useState(false);
  const [deskOverride, setDeskOverride] = useState<ActiveDesk | null>(null);
  const [pendingDeskReset, setPendingDeskReset] = useState<ActiveDesk | null>(null);
  const [aulasState, setAulasState] = useState<CalcMuestraAulasState | null>(null);
  const [aulasStateChecked, setAulasStateChecked] = useState(false);
  const [uploadingSourceId, setUploadingSourceId] = useState<string | null>(null);
  const handleHydratedState = useCallback((state: CalcMuestraState) => {
    setAulasState(state.aulas ?? null);
    setAulasStateChecked(true);
  }, []);
  useCalcMuestraAutosave(handleHydratedState);
  const workspace = useMemo(() => normalizeWorkspace(estudio), [estudio]);
  const inferredDesk = inferDesk(estudio, workspace);
  const requestedDesk = useMemo(() => requestedDeskFromSearch(searchParams), [searchParams]);
  const hasAulasDeskState = useMemo(
    () => classroomFrameReady(aulasState) ||
      classroomComparisonReady(aulasState) ||
      classroomSelectionReady(aulasState) ||
      classroomReplacementReady(aulasState),
    [aulasState],
  );
  const recoveredAulasDesk = deskOverride === "opinion_universitaria" && hasAulasDeskState
    ? "opinion_universitaria"
    : null;
  const currentDesk = recoveredAulasDesk ?? inferredDesk;
  const desk: ActiveDesk = choosingDesk ? "sin_definir" : currentDesk;
  const resultados = estudio.componentes.filter(hasUsefulResult).length;
  const productos = Array.from(new Set(estudio.componentes.map(tecnicaProducto)));
  const hasExistingDesk = currentDesk !== "sin_definir" && (
    estudio.componentes.length > 0 ||
    resultados > 0 ||
    workspace.frame_mode !== "sin_definir" ||
    hasAulasDeskState
  );

  useEffect(() => {
    if (recoveredAulasDesk) return;
    setActiveRailSection(defaultRailSectionForDesk(desk));
  }, [desk, recoveredAulasDesk]);

  useEffect(() => {
    if (!hydrated || !requestedDesk) return;
    if (requestedDesk === "opinion_universitaria" && !aulasStateChecked) return;
    setSearchParams(clearDeskRequest(searchParams), { replace: true });
    if (requestedDesk === "opinion_universitaria" && (inferredDesk === "opinion_universitaria" || hasAulasDeskState)) {
      const recoveryTarget = classroomRecoveryTarget(aulasState);
      setDeskOverride("opinion_universitaria");
      setChoosingDesk(false);
      setPendingDeskReset(null);
      setActiveRailSection(recoveryTarget.section);
      setActiveClassroomLabTab(recoveryTarget.tab);
      return;
    }
    if (requestedDesk === "opinion_universitaria" && hasExistingDesk) {
      setChoosingDesk(true);
      setPendingDeskReset("opinion_universitaria");
      setActiveRailSection("pathways");
      return;
    }
    if (requestedDesk === "opinion_universitaria") {
      void iniciar("opinion_universitaria");
    }
  }, [aulasState, aulasStateChecked, hasAulasDeskState, hasExistingDesk, hydrated, inferredDesk, requestedDesk, searchParams, setSearchParams]);

  useEffect(() => {
    if (!choosingDesk) return;
    window.requestAnimationFrame(() => {
      document.querySelector(".cmv2-main")?.scrollTo({ top: 0, left: 0 });
    });
  }, [choosingDesk]);

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    apiCalcMuestraState()
      .then((state) => {
        if (alive) setAulasState(state.aulas ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setAulasStateChecked(true);
      });
    return () => {
      alive = false;
    };
  }, [hydrated]);

  async function persistCurrent(estudioOverride?: CalcMuestraEstudio) {
    await apiCalcMuestraEstudioPut(estudioOverride ?? estudio);
  }

  async function iniciar(mode: ActiveDesk, opts: { cargarModeloBase?: boolean } = {}) {
    setDeskOverride(null);
    setChoosingDesk(false);
    setPendingDeskReset(null);
    setMsg(null);
    if (mode === "territorial_handoff") {
      setWorkspace(workspaceFor("territorial_handoff"));
      return;
    }
    const tipo: CalcMuestraMacroFamilia =
      mode === "acreditacion"
        ? "acreditacion"
        : mode === "opinion_universitaria"
          ? "encuesta_estudiantes"
          : "estudio_propio";
    setBusy("Preparando mesa");
    try {
      const res = await apiCalcMuestraIniciarEstudio(
        tipo,
        opts.cargarModeloBase ? "plantilla_pucp" : "vacio",
      );
      setAulasState(res.state?.aulas ?? null);
      let componentes = res.estudio.componentes;
      if (mode === "marco_disponible" && componentes.length === 0) {
        componentes = [
          defaultComponente({
            actor: "Población objetivo",
            actor_id: "poblacion_objetivo",
            marco: { estado: "bruto" },
          }),
        ];
      }
      if (mode === "opinion_universitaria") {
        componentes = [...universityComponents(componentes)];
      }
      const nextWorkspace = workspaceFor(mode);
      const finalWorkspace = mode === "opinion_universitaria"
        ? universityWorkspace(nextWorkspace, componentes[0], componentes[1])
        : nextWorkspace;
      replaceEstudio({
        ...res.estudio,
        titulo: defaultTitleFor(mode),
        componentes,
        workspace: finalWorkspace,
      });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo iniciar la mesa." });
    } finally {
      setBusy(null);
    }
  }

  function elegirEstudio(mode: ActiveDesk) {
    if (hasExistingDesk && mode === currentDesk) {
      setPendingDeskReset(null);
      setChoosingDesk(false);
      return;
    }
    if (hasExistingDesk && mode !== currentDesk) {
      setPendingDeskReset(mode);
      return;
    }
    setDeskOverride(null);
    setChoosingDesk(false);
    if (mode === "territorial_handoff") {
      navigate("/hojas-ruta");
      return;
    }
    void iniciar(mode);
  }

  function confirmarCambioEstudio() {
    if (!pendingDeskReset) return;
    const nextMode = pendingDeskReset;
    setPendingDeskReset(null);
    setDeskOverride(null);
    setChoosingDesk(false);
    if (nextMode === "territorial_handoff") {
      navigate("/hojas-ruta");
      return;
    }
    void iniciar(nextMode);
  }

  function openStudyChooser() {
    setPendingDeskReset(null);
    setChoosingDesk(true);
    setActiveRailSection("pathways");
  }

  function navegarSeccion(item: CalcMuestraSectionNavItem) {
    if (item.route === "hojas-ruta") {
      navigate("/hojas-ruta");
      return;
    }
    setActiveRailSection(item.id);
    if (desk === "opinion_universitaria") return;
    if (!item.targetId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(item.targetId ?? "")?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }

  function navegarPestanaLocal(targetId?: string) {
    if (!targetId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }

  function seleccionarPestanaLocal(tab: CalcMuestraSidebarTab) {
    setActiveLocalTabs((prev) => ({ ...prev, [`${desk}:${activeRailSection}`]: tab.id }));
  }

  function updateComponente(id: string, patch: ComponentePatch) {
    setComponentes(
      estudio.componentes.map((c) =>
        c.id === id
          ? {
              ...c,
              ...patch,
              marco: patch.marco ? { ...c.marco, ...patch.marco } : c.marco,
              parametros: patch.parametros ? { ...c.parametros, ...patch.parametros } : c.parametros,
              meta: patch.meta ? { ...c.meta, ...patch.meta } : c.meta,
              resultado: patch.resultado === undefined ? null : patch.resultado,
            }
          : c,
      ),
    );
  }

  function replaceComponente(next: CalcMuestraComponente) {
    setComponentes(estudio.componentes.map((c) => (c.id === next.id ? next : c)));
  }

  function ensureOcasionalComponent(kind: MarcoOcasional) {
    const existing = estudio.componentes[0];
    const tecnica: CalcMuestraTecnica =
      kind === "conglomerados"
        ? "prob_conglomerado_multietapico"
        : kind === "cuotas_controladas"
          ? "no_prob_cuotas"
          : kind === "cobertura"
            ? "intencion_censal"
            : kind === "estratos"
              ? "prob_estratificado"
              : "prob_aleatorio_simple";
    const base = existing ?? defaultComponente();
    const next = setTecnica(
      {
        ...base,
        actor:
          kind === "servicios"
            ? "Usuarios / atenciones de servicios"
            : base.actor || "Población objetivo",
        marco: {
          ...base.marco,
          estado: base.marco.estado === "no_definido" ? "bruto" : base.marco.estado,
          matriz_operativa:
            kind === "servicios"
              ? base.marco.matriz_operativa?.length
                ? base.marco.matriz_operativa
                : matrizGizEjemplo()
              : [],
          estratos:
            kind === "estratos" || kind === "conglomerados"
              ? base.marco.estratos?.length
                ? base.marco.estratos
                : [
                    estrato("Estrato A", 500),
                    estrato("Estrato B", 500),
                  ]
              : base.marco.estratos ?? [],
        },
        parametros: {
          ...base.parametros,
          deff: kind === "conglomerados" ? 1.5 : 1,
          tasa_respuesta: kind === "servicios" ? 1 : base.parametros.tasa_respuesta,
          oversample_pct: kind === "servicios" ? 0 : base.parametros.oversample_pct,
          n_minimo_estrato: kind === "servicios" ? 30 : base.parametros.n_minimo_estrato,
        },
      },
      tecnica,
    );
    setComponentes([next, ...estudio.componentes.slice(1)]);
    setWorkspace({
      ...workspace,
      frame_mode: "marco_disponible",
      marco_disponible: labelMarcoOcasional(kind),
    });
  }

  async function calcular(estudioOverride?: CalcMuestraEstudio) {
    setMsg(null);
    setCalculando(true);
    try {
      const base = estudioOverride ?? estudio;
      const workingWorkspace = normalizeWorkspace(base);
      const prepared = inferDesk(base, workingWorkspace) === "opinion_universitaria"
        ? prepareUniversityStudyForCalculation(base, workingWorkspace)
        : base;
      await persistCurrent(prepared);
      const res = await apiCalcMuestraCalcular();
      hydrate(res.estudio);
      setMsg({
        kind: "info",
        text: `Cálculo completado: ${res.estudio.componentes.length} componente(s).`,
      });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo calcular." });
    } finally {
      setCalculando(false);
    }
  }

  async function generarReporte() {
    setReporteEnCurso(true);
    setMsg(null);
    try {
      await persistCurrent();
      const res = await apiCalcMuestraReporteIniciar("html");
      setReporteMeta({ disponible: false, jobId: res.job_id });
      const start = Date.now();
      const poll = window.setInterval(async () => {
        if (Date.now() - start > 120_000) {
          window.clearInterval(poll);
          setReporteEnCurso(false);
          setMsg({ kind: "warn", text: "El reporte está tomando más de lo esperado." });
          return;
        }
        try {
          const state = await apiCalcMuestraState();
          if (state.reporte.disponible) {
            window.clearInterval(poll);
            setReporteEnCurso(false);
            setReporteMeta({ disponible: true, jobId: res.job_id });
            setMsg({ kind: "info", text: "Reporte metodológico listo." });
          }
        } catch {
          // El job puede tardar: el siguiente polling vuelve a consultar.
        }
      }, 2000);
    } catch (e) {
      setReporteEnCurso(false);
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo generar el reporte." });
    }
  }

  async function enviarMonitoreo() {
    setMsg(null);
    try {
      await persistCurrent();
      await apiMonitoreoImportFromCalcMuestra(estudio);
      navigate("/monitoreo");
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo enviar a Monitoreo." });
    }
  }

  function universityWorkspaceMappingPayload(mappings: CalcMuestraWorkspaceVariableMapping[] | undefined) {
    const out: Record<string, string[]> = {};
    for (const row of mappings ?? []) {
      const column = row.column?.trim();
      if (!column) continue;
      const role = row.role === "course_schedule_id"
        ? "classroom_id"
        : row.role === "classroom"
          ? "classroom_label"
          : row.role === "eligible"
            ? "condition"
            : row.role;
      out[role] = [column];
    }
    return out;
  }

  function universityMarcoConfigPayload(nextWorkspace: CalcMuestraWorkspace) {
    const config = normalizeUniversityAulasConfig(nextWorkspace.aulas_config);
    return {
      ...config,
      mapping: universityWorkspaceMappingPayload(nextWorkspace.variable_mappings),
      selector_engine: config.selector_engine,
      filters: {
        require_undergraduate: config.require_undergraduate ?? true,
        require_adult: config.require_adult ?? true,
        min_age: config.min_age ?? 18,
        require_in_person: config.require_in_person ?? config.modalidad !== "online_controlado",
        accepted_conditions: config.accepted_conditions?.length ? config.accepted_conditions : ["regular"],
        min_eligible_per_class: config.min_elegibles_aula,
      },
    };
  }

  function canBuildUniversityFrame(nextWorkspace: CalcMuestraWorkspace) {
    const sourceMode = nextWorkspace.source_mode ?? "base_madre";
    const bindings = ensureUniversitySourceBindings(sourceMode, nextWorkspace.source_bindings);
    const byRole = (role: string) => bindings.find((item) => item.role === role);
    const compatible = (role: string) => {
      const binding = byRole(role);
      return Boolean(binding?.file_id) && Boolean(binding && sourceBindingCompatibleForBuild(binding));
    };
    if (sourceMode === "base_madre") return compatible("base_madre");
    if (sourceMode === "dos_bases") {
      const primary = byRole("estudiantes");
      if (!primary?.file_id || !sourceBindingCompatibleForBuild(primary)) return false;
      if (sourceBindingRole(primary) === "base_madre") return true;
      return compatible("inscripciones");
    }
    return false;
  }

  function universityMarcoPayload(nextWorkspace: CalcMuestraWorkspace): Parameters<typeof apiCalcMuestraMarcoConstruir>[0] {
    const sourceMode = nextWorkspace.source_mode ?? "base_madre";
    const bindings = ensureUniversitySourceBindings(sourceMode, nextWorkspace.source_bindings);
    const byRole = (role: string) => bindings.find((item) => item.role === role);
    const config = universityMarcoConfigPayload(nextWorkspace);
    const catalogo = byRole("catalogo_curso_horario");
    const catalogoPayload = catalogo?.file_id && sourceBindingCompatibleForBuild(catalogo)
      ? {
          catalogo_curso_horario_file_id: catalogo.file_id,
          catalogo_curso_horario_sheet: catalogo.sheet_name?.trim() || undefined,
        }
      : {};

    if (sourceMode === "base_madre") {
      const base = byRole("base_madre");
      if (!base?.file_id) throw new Error("Sube primero la base principal de matrícula.");
      if (!sourceBindingCompatibleForBuild(base)) throw new Error(sourceBindingBuildMessage(base));
      return {
        base_madre_file_id: base.file_id,
        base_madre_sheet: base.sheet_name?.trim() || undefined,
        ...catalogoPayload,
        config,
      };
    }

    if (sourceMode === "dos_bases") {
      const estudiantes = byRole("estudiantes");
      const inscripciones = byRole("inscripciones");
      if (!estudiantes?.file_id) {
        throw new Error("Sube primero la base principal de matrícula.");
      }
      if (!sourceBindingCompatibleForBuild(estudiantes)) throw new Error(sourceBindingBuildMessage(estudiantes));

      if (sourceBindingRole(estudiantes) === "base_madre") {
        return {
          base_madre_file_id: estudiantes.file_id,
          base_madre_sheet: estudiantes.sheet_name?.trim() || undefined,
          ...catalogoPayload,
          config,
        };
      }

      if (!inscripciones?.file_id) {
        throw new Error(
          catalogo?.file_id
            ? "La base principal no parece traer estudiante por curso y horario. Para construir el marco necesitas una hoja de matrícula por curso y horario o una hoja de inscripciones estudiante-curso."
            : "Sube la hoja de cursos y horarios o usa una base principal que ya tenga estudiante por curso y horario.",
        );
      }
      if (!sourceBindingCompatibleForBuild(inscripciones)) throw new Error(sourceBindingBuildMessage(inscripciones));
      return {
        estudiantes_file_id: estudiantes.file_id,
        estudiantes_sheet: estudiantes.sheet_name?.trim() || undefined,
        inscripciones_file_id: inscripciones.file_id,
        inscripciones_sheet: inscripciones.sheet_name?.trim() || undefined,
        ...catalogoPayload,
        config,
      };
    }

    throw new Error("La lectura histórica se importa como selección o agenda; no reconstruye el marco base.");
  }

  async function construirMarcoDesdeFuentes(nextWorkspace: CalcMuestraWorkspace = workspace) {
    setMsg(null);
    setBusy("Leyendo base institucional");
    try {
      const res = await apiCalcMuestraMarcoConstruir(universityMarcoPayload(nextWorkspace));
      setAulasState(res.state.aulas ?? null);
      const frame = res.frame ?? res.state.aulas?.frame ?? null;
      const populationN = Math.max(
        rowsFrom(frame?.population).length,
        safeNumber((frame as Record<string, unknown> | null)?.population_n, 0),
        safeNumber((frame as Record<string, unknown> | null)?.unique_students_n, 0),
      );
      const aulaN = rowsFrom(frame?.aula_frame).length;
      setMsg({
        kind: "info",
        text: `Base leída y marco construido: ${fmtInt(populationN)} estudiantes únicos y ${fmtInt(aulaN)} aulas.`,
      });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo construir el marco desde la base cargada." });
    } finally {
      setBusy(null);
    }
  }

  async function cargarFuenteUniversitaria(binding: CalcMuestraWorkspaceSourceBinding, file: File) {
    setMsg(null);
    setUploadingSourceId(binding.id);
    setBusy("Subiendo Excel");
    try {
      const sourceMode = workspace.source_mode ?? "base_madre";
      const bindings = ensureUniversitySourceBindings(sourceMode, workspace.source_bindings);
      const defaultSheet = binding.sheet_name?.trim() || "";
      const uploaded = await apiUpload(file, "data");
      const inspectionRes = await apiCalcMuestraMarcoInspeccionarArchivo(uploaded.file_id);
      const inspection = inspectionRes.inspection;
      const inspectedSheets = rowsFrom<CalcMuestraAulasSheetInspectionSheet>(inspection.sheets);
      const selectedSheet = chooseSourceSheet(binding, inspection) || defaultSheet;
      const selectedDiagnostic = inspectedSheets.find((sheet) => sheet.name === selectedSheet);
      const availableSheets = inspectedSheets.map((sheet) => sheet.name).filter(Boolean);
      const nextBindingPreview: CalcMuestraWorkspaceSourceBinding = {
        ...binding,
        file_id: uploaded.file_id,
        file_name: uploaded.original_name,
        sheet_name: selectedSheet,
        available_sheets: availableSheets,
        suggested_sheet: inspection.suggested_sheet ?? selectedSheet,
        detected_role: selectedDiagnostic?.role ?? inspection.suggested_role ?? "",
        sheet_diagnostics: inspectedSheets,
      };
      const isCompatible = sourceBindingCompatibleForBuild(nextBindingPreview);
      const nextBindings = bindings.map((item) =>
        item.id === binding.id
          ? {
              ...item,
              ...nextBindingPreview,
              status: isCompatible ? "cargada" : "revisar",
              compatibility_status: isCompatible ? "compatible" : "revisar",
            }
          : item,
      );
      const nextWorkspace: CalcMuestraWorkspace = {
        ...workspace,
        source_mode: sourceMode,
        source_bindings: nextBindings,
        variable_mappings: reconcileUniversityVariableMappingsForColumns(
          workspace.variable_mappings,
          universityInspectedColumnOptions({ ...workspace, source_bindings: nextBindings }),
        ),
        marco_disponible: workspace.marco_disponible || "Base institucional",
        fuente_marco: workspace.fuente_marco || "Base institucional",
      };
      setWorkspace(nextWorkspace);
      await apiCalcMuestraEstudioPut({ ...estudio, workspace: nextWorkspace });

      if (canBuildUniversityFrame(nextWorkspace)) {
        setBusy("Leyendo Excel y construyendo marco");
        const res = await apiCalcMuestraMarcoConstruir(universityMarcoPayload(nextWorkspace));
        setAulasState(res.state.aulas ?? null);
        const frame = res.frame ?? res.state.aulas?.frame ?? null;
        const populationN = Math.max(
          rowsFrom(frame?.population).length,
          safeNumber((frame as Record<string, unknown> | null)?.population_n, 0),
          safeNumber((frame as Record<string, unknown> | null)?.unique_students_n, 0),
        );
        const aulaN = rowsFrom(frame?.aula_frame).length;
        setMsg({
          kind: "info",
          text: `Excel cargado. Marco construido con ${fmtInt(populationN)} estudiantes únicos y ${fmtInt(aulaN)} aulas.`,
        });
      } else {
        const uploadedBinding = nextBindings.find((item) => item.id === binding.id) ?? nextBindingPreview;
        setMsg({
          kind: "warn",
          text: uploadedBinding.file_id
            ? sourceBindingBuildMessage(uploadedBinding)
            : "Excel cargado. Cuando estén listas las bases que se relacionan entre sí, Prosecnur podrá construir el marco.",
        });
      }
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo cargar el Excel de la base." });
    } finally {
      setUploadingSourceId(null);
      setBusy(null);
    }
  }

  async function compararMetodosAulas(config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) {
    setMsg(null);
    setBusy("Comparando métodos");
    try {
      const res = await apiCalcMuestraAulasCompararMetodos({
        config,
        objective_config: config.objective,
        methods: ["sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"],
        simulation_runs: simulationRuns,
      });
      setAulasState(res.state.aulas ?? null);
      setMsg({ kind: "info", text: "Comparación de métodos lista." });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo comparar métodos. Construye primero el marco de aulas." });
    } finally {
      setBusy(null);
    }
  }

  async function seleccionarAulasDesdeMetodo(config: CalcMuestraWorkspaceAulasConfig, methodId?: string) {
    setMsg(null);
    setBusy("Seleccionando aulas");
    try {
      const res = await apiCalcMuestraAulasSeleccionar(config, undefined, methodId, config.objective);
      setAulasState(res.state.aulas ?? null);
      setMsg({ kind: "info", text: "Selección de aulas generada." });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo seleccionar aulas. Construye primero el marco." });
    } finally {
      setBusy(null);
    }
  }

  async function simularReemplazosAulas(config: CalcMuestraWorkspaceAulasConfig) {
    setMsg(null);
    setBusy("Simulando reemplazos");
    try {
      const res = await apiCalcMuestraAulasSimularReemplazos({ config, objective_config: config.objective });
      setAulasState(res.state.aulas ?? null);
      setMsg({ kind: "info", text: "Simulación de reemplazos lista." });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo simular reemplazos. Genera primero una selección." });
    } finally {
      setBusy(null);
    }
  }

  const chromeStatus = chromeStatusForDesk({
    desk,
    componentes: estudio.componentes.length,
    resultados,
    calculando,
    reporteEnCurso,
    busy,
  });
  const ChromeStatusIcon = chromeStatus.icon;
  const chromeTokens = chromeTokensForDesk({ desk, estudio, workspace, productos, resultados, aulasState });
  const primaryChromeToken = chromeTokens[0] ?? null;
  const sidebarTabs = sidebarTabsForDeskSection({ desk, activeSection: activeRailSection, estudio, workspace, aulasState });
  const storedLocalTab = activeLocalTabs[`${desk}:${activeRailSection}`];
  const activeLocalTab = activeRailSection === "aulas"
    ? activeClassroomLabTab
    : storedLocalTab && sidebarTabs.some((tab) => tab.id === storedLocalTab)
      ? storedLocalTab
      : sidebarTabs[0]?.id ?? "";

  if (!hydrated) return <LoadingBlock label="Cargando mesa de muestra..." />;

  return (
    <PageFrame
      className="cmv2-frame"
      layout="workbench"
      bodyMode="fill"
      scrollOwner="panels"
      density="compact"
      headerMode="sr-only"
      title="Cálculo de muestra y marco muestral"
      toolbar={
        <div className={`cmv2-module-chrome ${desk === "sin_definir" ? "is-picker" : ""}`}>
          <div className={`cmv2-commandbar ${desk === "sin_definir" ? "is-picker" : ""}`} role="toolbar" aria-label="Comandos de cálculo de muestra">
            {desk === "sin_definir" ? (
              <div className="cmv2-toolbar-context" aria-label="Contexto del módulo">
                <span className="cmv2-toolbar-icon"><Calculator size={18} /></span>
                <span className="cmv2-toolbar-copy">
                  <strong>Cálculo de muestra</strong>
                  <small>{deskSubtitleForDesk(desk)}</small>
                </span>
              </div>
            ) : (
              <div className="cmv2-command-summary" aria-label="Resumen del recorrido muestral">
                {primaryChromeToken && (
                  <span className={`cmv2-command-trip is-${primaryChromeToken.tone ?? "path"}`}>
                    <span className="cmv2-command-trip-icon" aria-hidden="true"><Route size={14} /></span>
                    <span className="cmv2-command-trip-main">
                      <small>{primaryChromeToken.label}</small>
                      <strong>{primaryChromeToken.value}</strong>
                    </span>
                  </span>
                )}
              </div>
            )}

            {desk !== "sin_definir" && (
              <div className="cmv2-command-rail">
                <CalcMuestraSectionRail
                  desk={desk}
                  activeSection={activeRailSection}
                  onSection={navegarSeccion}
                />
              </div>
            )}

            {desk === "sin_definir" ? (
              <div className="cmv2-picker-status" aria-live="polite">
                <ChromeStatusIcon size={14} />
                <span>
                  <strong>{chromeStatus.label}</strong>
                  <small>{chromeStatus.detail}</small>
                </span>
              </div>
            ) : (
              <div className={`cmv2-toolbar-actions ${desk === "opinion_universitaria" ? "is-status-only" : ""}`}>
                <span className={`cmv2-action-status is-${chromeStatus.tone}`} aria-live="polite">
                  <ChromeStatusIcon size={13} className={ChromeStatusIcon === Loader2 ? "pulso-spin" : undefined} />
                  {chromeStatus.label}
                </span>
                {desk !== "opinion_universitaria" && (
                  <div className="cmv2-command-cluster" aria-label="Acciones del cálculo">
                    <button type="button" className="cmv2-ghost" onClick={openStudyChooser}>
                      <RefreshCw size={14} /> Cambiar tipo
                    </button>
                    <button type="button" className="cmv2-primary" onClick={() => void calcular()} disabled={calculando || estudio.componentes.length === 0}>
                      {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
                      Calcular
                    </button>
                    <button type="button" className="cmv2-ghost" onClick={generarReporte} disabled={reporteEnCurso || resultados === 0}>
                      {reporteEnCurso ? <Loader2 size={14} className="pulso-spin" /> : <FileText size={14} />}
                      Reporte
                    </button>
                    {reporteJobId && (
                      <a className="cmv2-link-button" href={calcMuestraReporteDescargarUrl({ inline: true })} target="_blank" rel="noreferrer">
                        Ver
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      }
      resetScrollKey={desk}
    >
      <span
        hidden
        data-audit-ready="calc-muestra"
        data-audit-desk={desk}
      />
      <div className={`cmv2-workbench ${desk === "sin_definir" ? "is-pathway-picker" : ""}`}>
        {desk !== "sin_definir" && (
          <CalcMuestraContextSidebar
            desk={desk}
            estudio={estudio}
            workspace={workspace}
            activeSection={activeRailSection}
            activeLocalTab={activeLocalTab}
            activeClassroomLabTab={activeClassroomLabTab}
            aulasState={aulasState}
            onClassroomLabTab={setActiveClassroomLabTab}
            onLocalTab={seleccionarPestanaLocal}
            onLocalTarget={navegarPestanaLocal}
          />
        )}

        <main className="cmv2-main">
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          {busy && (
            <div className="cmv2-busy">
              <Loader2 size={16} className="pulso-spin" />
              {busy}
            </div>
          )}

          {desk === "sin_definir" && (
            <FrameSelector
              currentDesk={currentDesk}
              hasExistingStudy={hasExistingDesk}
              pendingReset={pendingDeskReset}
              onSelect={elegirEstudio}
              onCancelReset={() => setPendingDeskReset(null)}
              onConfirmReset={confirmarCambioEstudio}
            />
          )}

          {desk === "legacy" && (
            <LegacyDesk
              onNew={() => void iniciar("marco_disponible")}
              onClear={() => replaceEstudio({ ...estudio, macro_familia: "estudio_propio", componentes: [], workspace: EMPTY_WORKSPACE })}
            />
          )}

          {desk === "territorial_handoff" && <TerritorialHandoff onOpen={() => navigate("/hojas-ruta")} onBack={() => setWorkspace(EMPTY_WORKSPACE)} />}

          {desk === "acreditacion" && (
            <AcreditacionDesk
              estudio={estudio}
              workspace={workspace}
              activeSection={activeRailSection}
              onTitulo={setTitulo}
              onContexto={setContexto}
              onWorkspace={setWorkspace}
              onComponente={updateComponente}
              onCalcular={calcular}
              calculando={calculando}
            />
          )}

          {desk === "opinion_universitaria" && (
            <OpinionUniversitariaDeskRevamp
              estudio={estudio}
              workspace={workspace}
              aulasState={aulasState}
              busy={busy}
              activeSection={activeRailSection}
              activeLocalTab={activeLocalTab}
              activeLabTab={activeClassroomLabTab}
              onTitulo={setTitulo}
              onContexto={setContexto}
              onWorkspace={setWorkspace}
              onComponente={updateComponente}
              onSetComponentes={setComponentes}
              onCargarModelo={() => void iniciar("opinion_universitaria", { cargarModeloBase: true })}
              onCalcular={calcular}
              onCompararAulas={compararMetodosAulas}
              onSeleccionarAulas={seleccionarAulasDesdeMetodo}
              onSimularReemplazos={simularReemplazosAulas}
              onSourceUpload={cargarFuenteUniversitaria}
              onSourceBuild={construirMarcoDesdeFuentes}
              uploadingSourceId={uploadingSourceId}
              calculando={calculando}
            />
          )}

          {desk === "marco_disponible" && (
            <MarcoDisponibleDesk
              estudio={estudio}
              workspace={workspace}
              activeSection={activeRailSection}
              onTitulo={setTitulo}
              onContexto={setContexto}
              onPatchEstudio={patchEstudio}
              onWorkspace={setWorkspace}
              onComponente={updateComponente}
              onReplaceComponente={replaceComponente}
              onEnsureKind={ensureOcasionalComponent}
              onCalcular={calcular}
              onMonitoreo={enviarMonitoreo}
              calculando={calculando}
              reporteListo={!!reporteJobId}
            />
          )}
        </main>
      </div>
    </PageFrame>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="cmv2-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CalcMuestraSectionRail({
  desk,
  activeSection,
  onSection,
}: {
  desk: ActiveDesk;
  activeSection: string;
  onSection: (item: CalcMuestraSectionNavItem) => void;
}) {
  const sections = railSectionsForDesk(desk);
  if (sections.length === 0) return null;
  return (
    <div className="cmv2-section-rail-wrap" aria-label={`${railTitleForDesk(desk)}: secciones`}>
      <nav className="pulso-phase-pillbar cmv2-section-rail" role="tablist" aria-label={`${railTitleForDesk(desk)}: secciones`}>
        <ol className="pulso-phase-pill-list">
          {sections.map((item, index) => {
            const active = activeSection === item.id;
            return (
              <li key={item.id} className="pulso-phase-pill-item">
                <button
                  type="button"
                  role="tab"
                  className={`pulso-phase-pill cmv2-section-pill ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  aria-selected={active}
                  title={`${item.label}: ${item.detail}`}
                  onClick={() => onSection(item)}
                >
                  <span className="pulso-phase-pill-circle" aria-hidden="true" />
                  <span className="pulso-phase-pill-stack">
                    <span className="pulso-phase-pill-label">
                      <span className="pulso-phase-pill-number">{index + 1}</span>
                      <span className="cmv2-section-pill-copy">
                        <strong>{item.shortLabel ?? item.label}</strong>
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

function CalcMuestraContextSidebar({
  desk,
  estudio,
  workspace,
  activeSection,
  activeLocalTab,
  activeClassroomLabTab,
  aulasState,
  onClassroomLabTab,
  onLocalTab,
  onLocalTarget,
}: {
  desk: ActiveDesk;
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  activeSection: string;
  activeLocalTab: string;
  activeClassroomLabTab: ClassroomLabTab;
  aulasState: CalcMuestraAulasState | null;
  onClassroomLabTab: (tab: ClassroomLabTab) => void;
  onLocalTab: (tab: CalcMuestraSidebarTab) => void;
  onLocalTarget: (targetId?: string) => void;
}) {
  const activeMeta = activeSectionMetaForDesk(desk, activeSection);
  const tabs = sidebarTabsForDeskSection({ desk, activeSection, estudio, workspace, aulasState });
  const firstTabId = tabs[0]?.id ?? "";
  const activeTabId = activeSection === "aulas" ? activeClassroomLabTab : activeLocalTab || firstTabId;

  function selectTab(tab: CalcMuestraSidebarTab) {
    if (tab.classroomTab) {
      onClassroomLabTab(tab.classroomTab);
      return;
    }
    onLocalTab(tab);
    onLocalTarget(tab.targetId);
  }

  return (
    <aside className="cmv2-rail cmv2-section-sidebar" aria-label="Pestañas de la sección activa">
      <div className="cmv2-section-sidebar-head">
        <span>{activeMeta?.label ?? railTitleForDesk(desk)}</span>
        <strong>{desk === "opinion_universitaria" && activeSection === "definicion" ? "Preparación" : "Pestañas"}</strong>
        <small>{activeMeta?.detail ?? deskSubtitleForDesk(desk)}</small>
      </div>

      <div className="cmv2-section-local-tabs" role="tablist" aria-label={`Pestañas de ${activeMeta?.label ?? "la sección"}`}>
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const active = activeTabId === (tab.classroomTab ?? tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`cmv2-section-local-tab is-${tab.status}${active ? " is-active" : ""}`}
              onClick={() => selectTab(tab)}
            >
              <span className="cmv2-section-local-index">{index + 1}</span>
              <span className="cmv2-section-local-copy">
                <strong><Icon size={13} /> {tab.label}</strong>
                <small>{tab.detail}</small>
              </span>
              <span className="cmv2-section-local-state" title={guidedStatusLabel(tab.status)}>
                <span className="pulso-sr-only">{guidedStatusLabel(tab.status)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function PathwayPrimer() {
  return (
    <div className="cmv2-pathway-primer" aria-label="Preguntas para escoger el tipo de muestra">
      {PATHWAY_PRIMER.map((item) => {
        const Icon = item.icon ?? CircleHelp;
        return (
          <article key={item.prompt}>
            <span><Icon size={14} /></span>
            <div>
              <small>{item.prompt}</small>
              <strong>{item.answer}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function FrameSelector({
  currentDesk,
  hasExistingStudy,
  pendingReset,
  onSelect,
  onCancelReset,
  onConfirmReset,
}: {
  currentDesk: ActiveDesk;
  hasExistingStudy: boolean;
  pendingReset: ActiveDesk | null;
  onSelect: (mode: ActiveDesk) => void;
  onCancelReset: () => void;
  onConfirmReset: () => void;
}) {
  const currentCard = FRAME_CARDS.find((card) => card.id === currentDesk);
  const pendingCard = FRAME_CARDS.find((card) => card.id === pendingReset);
  const currentTitle = currentCard?.title ?? (currentDesk === "legacy" ? "sesión anterior" : "mesa actual");

  return (
    <section className="cmv2-selector cmv2-route-hub" aria-label="Caminos de cálculo muestral">
      <div className="cmv2-selector-head cmv2-route-hub-head">
        <div>
          <span className="cmv2-eyebrow">Caminos de cálculo</span>
          <h2>Elige el tipo de muestra</h2>
          <p>Primero escoge el camino de trabajo. Esa decisión define la mesa del proyecto y evita mezclar avances de cálculos distintos.</p>
        </div>
        <div className="cmv2-route-hub-status" aria-label="Estado de rutas">
          <span><CheckCircle2 size={13} /> 4 caminos disponibles</span>
          <span><Route size={13} /> 1 mesa por proyecto</span>
        </div>
      </div>

      <PathwayPrimer />

      {hasExistingStudy && (
        <div className="cmv2-route-warning" role="note">
          <CheckCircle2 size={15} />
          <span>
            <strong>Esta mesa ya está usando: {currentTitle}.</strong>
            Puedes volver a ella o reiniciarla con otro camino si el proyecto cambió de tipo de muestra.
          </span>
        </div>
      )}

      {pendingCard && (
        <div className="cmv2-reset-confirm" role="alert">
          <span className="cmv2-reset-confirm-icon"><RefreshCw size={16} /></span>
          <div>
            <strong>Reiniciar mesa de muestra</strong>
            <p>
              Vas a pasar de {currentTitle} a {pendingCard.title}. La mesa actual se reiniciará y el proyecto quedará preparado para este nuevo tipo de muestra.
            </p>
          </div>
          <div className="cmv2-reset-confirm-actions">
            <button type="button" className="cmv2-ghost" onClick={onCancelReset}>Cancelar</button>
            <button type="button" className="cmv2-primary" onClick={onConfirmReset}>
              Reiniciar mesa
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="cmv2-frame-grid cmv2-frame-grid--routes">
        {FRAME_CARDS.map((card) => {
          const Icon = card.icon;
          const isCurrent = hasExistingStudy && card.id === currentDesk;
          const actionLabel = isCurrent
            ? "Seguir trabajando"
            : hasExistingStudy
              ? "Reiniciar con este camino"
              : card.action;
          return (
            <button
              key={card.id}
              type="button"
              className={`cmv2-frame-card cmv2-frame-card--${card.id} ${card.id === "territorial_handoff" ? "is-handoff" : ""} ${isCurrent ? "is-current" : ""}`}
              onClick={() => onSelect(card.id)}
              aria-pressed={isCurrent}
            >
              <span className="cmv2-card-icon"><Icon size={20} /></span>
              <small>{isCurrent ? "Camino actual" : card.eyebrow}</small>
              <strong>{card.title}</strong>
              <p>{card.copy}</p>
              <div className="cmv2-path-tags" aria-label={`Alcance ${card.title}`}>
                {card.details.map((detail) => <span key={detail}>{detail}</span>)}
              </div>
              <div className="cmv2-card-answers" aria-label={`Orientación para ${card.title}`}>
                {card.guidance.map((item) => {
                  const HelpIcon = item.icon ?? CircleHelp;
                  return (
                  <em key={item.prompt}>
                    <i><HelpIcon size={12} /></i>
                    <b>{item.prompt}</b>
                    <span>{item.answer}</span>
                    <small>{item.detail}</small>
                  </em>
                  );
                })}
              </div>
              <span className="cmv2-card-action">
                {actionLabel}
                <ArrowRight size={14} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ShellHeader({
  eyebrow,
  title,
  copy,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  icon: typeof Database;
  children?: ReactNode;
}) {
  return (
    <div className="cmv2-desk-head">
      <div className="cmv2-desk-title">
        <span className="cmv2-desk-icon"><Icon size={18} /></span>
        <div>
          <span className="cmv2-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>
      </div>
      {children && <div className="cmv2-desk-actions">{children}</div>}
    </div>
  );
}

function StudyBasics({
  estudio,
  workspace,
  onTitulo,
  onContexto,
  onWorkspace,
  mode = "general",
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  mode?: "general" | "universitario";
}) {
  const universitario = mode === "universitario";
  return (
    <section className="cmv2-panel cmv2-basics">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Ficha de propuesta</span>
        <strong>Contexto y marco</strong>
      </div>
      <div className="cmv2-form-grid">
        <label>
          <span>Título</span>
          <input
            value={estudio.titulo}
            placeholder="Nombre del estudio o propuesta"
            onChange={(e) => onTitulo(e.currentTarget.value)}
          />
        </label>
        <label>
          <span>Cliente</span>
          <input
            value={estudio.contexto.cliente}
            placeholder="Institución o área solicitante"
            onChange={(e) => onContexto("cliente", e.currentTarget.value)}
          />
        </label>
        <label>
          <span>Fuente del marco</span>
          <input
            value={workspace.fuente_marco}
            placeholder="Censo, padrón, listado externo..."
            onChange={(e) => onWorkspace({ ...workspace, fuente_marco: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>Marco disponible</span>
          <input
            value={workspace.marco_disponible}
            placeholder="Universo validado o cobertura estimada"
            onChange={(e) => onWorkspace({ ...workspace, marco_disponible: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>Unidad de observación</span>
          <input
            value={workspace.unidad_observacion}
            placeholder="Persona, hogar, aula, actor..."
            onChange={(e) => onWorkspace({ ...workspace, unidad_observacion: e.currentTarget.value })}
          />
        </label>
        {!universitario && (
          <label>
            <span>Unidad de muestreo</span>
              <input
                value={workspace.unidad_muestreo}
                placeholder="Unidad seleccionable del marco"
                onChange={(e) => onWorkspace({ ...workspace, unidad_muestreo: e.currentTarget.value })}
              />
          </label>
        )}
      </div>
    </section>
  );
}

function AcreditacionDesk({
  estudio,
  workspace,
  activeSection,
  onTitulo,
  onContexto,
  onWorkspace,
  onComponente,
  onCalcular,
  calculando,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  activeSection: string;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onCalcular: () => void;
  calculando: boolean;
}) {
  const selectedSection = ["actores", "contexto", "resultados"].includes(activeSection)
    ? activeSection
    : "actores";
  return (
    <div className="cmv2-desk">
      <ShellHeader
        eyebrow="Acreditación institucional"
        title="Actores y cuotas"
        copy="Actores, marco, meta mínima y salida."
        icon={ClipboardList}
      >
        <button type="button" className="cmv2-primary" onClick={() => void onCalcular()} disabled={calculando}>
          {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
          Calcular actores
        </button>
      </ShellHeader>
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection === "actores" && (
          <div id="cmv2-section-acreditacion-actores" className="cmv2-tab-panel" role="tabpanel" aria-label="Actores">
            <AcreditacionActorsTable componentes={estudio.componentes} onComponente={onComponente} />
          </div>
        )}
        {selectedSection === "contexto" && (
          <div id="cmv2-section-acreditacion-contexto" className="cmv2-tab-panel" role="tabpanel" aria-label="Contexto">
          <StudyBasics estudio={estudio} workspace={workspace} onTitulo={onTitulo} onContexto={onContexto} onWorkspace={onWorkspace} />
          </div>
        )}
        {selectedSection === "resultados" && (
          <div id="cmv2-section-acreditacion-resultados" className="cmv2-tab-panel" role="tabpanel" aria-label="Resultados">
            <ResultadoPanel componentes={estudio.componentes} />
          </div>
        )}
      </div>
    </div>
  );
}

function AcreditacionActorsTable({
  componentes,
  onComponente,
}: {
  componentes: CalcMuestraComponente[];
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  return (
    <section className="cmv2-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Marco por actor</span>
        <strong>Actores canónicos</strong>
      </div>
      <div className="cmv2-table-wrap">
        <table className="cmv2-table">
          <thead>
            <tr>
              <th>Actor</th>
              <th>Canal</th>
              <th>Marco</th>
              <th>Meta mínima</th>
              <th>Salida esperada</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {componentes.map((comp) => {
              const meta = actorVisual(comp);
              return (
                <tr key={comp.id} className={`cmv2-actor-row cmv2-actor-row--${meta.key}`}>
                  <td>
                    <div className="cmv2-actor-cell">
                      <span className="cmv2-actor-dot" />
                      <span>
                        <strong>{meta.label}</strong>
                        <small>{meta.copy}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <select
                      className="cmv2-channel-select"
                      value={comp.canal_recojo}
                      onChange={(e) => onComponente(comp.id, { canal_recojo: e.currentTarget.value as CalcMuestraCanalRecojo })}
                    >
                      {CANAL_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <NumberCell
                      value={comp.marco.marco_validado}
                      onChange={(v) => onComponente(comp.id, { marco: { marco_validado: v, universo_bruto: v, marco_contactable: v } })}
                    />
                  </td>
                  <td>
                    <AcreditacionTargetCell comp={comp} onComponente={onComponente} />
                  </td>
                  <td><ProductBadge producto={tecnicaProducto(comp)} /></td>
                  <td><strong>{primaryMetric(comp)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AcreditacionTargetCell({
  comp,
  onComponente,
}: {
  comp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  if (comp.tecnica === "no_prob_cuotas") {
    return (
      <NumberCell
        value={comp.meta.valor || comp.inferencia_acreditacion?.minimo_cuota || 150}
        onChange={(v) => onComponente(comp.id, { meta: { valor: Math.round(v), tipo: "cuota" } })}
      />
    );
  }
  if (comp.tecnica === "no_prob_conveniencia") {
    return (
      <div className="cmv2-target-stack">
        <PercentCell
          value={comp.parametros.cobertura_objetivo}
          onChange={(v) => onComponente(comp.id, { parametros: { cobertura_objetivo: v } })}
        />
        <small>Piso {comp.parametros.n_minimo_estrato} · tope {comp.parametros.tope_operativo}</small>
      </div>
    );
  }
  if (comp.tecnica === "prob_conglomerado_multietapico" || comp.tecnica === "prob_aleatorio_simple" || comp.tecnica === "prob_estratificado") {
    return (
      <div className="cmv2-target-stack">
        <PercentCell
          value={comp.parametros.oversample_pct}
          onChange={(v) => onComponente(comp.id, { parametros: { oversample_pct: v } })}
        />
        <small>Sobremuestra</small>
      </div>
    );
  }
  return (
    <PercentCell
      value={comp.parametros.cobertura_objetivo}
      onChange={(v) => onComponente(comp.id, { parametros: { cobertura_objetivo: v } })}
    />
  );
}

function PercentCell({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="cmv2-number-cell cmv2-percent-cell">
      <input
        type="number"
        min={0}
        max={100}
        step={5}
        value={Number.isFinite(value) ? String(Math.round(value * 100)) : ""}
        onChange={(e) => onChange(safeNumber(e.currentTarget.value, 0) / 100)}
      />
      <span>%</span>
    </label>
  );
}

function OpinionUniversitariaDeskRevamp({
  estudio,
  workspace,
  aulasState,
  busy,
  activeSection,
  activeLocalTab,
  activeLabTab,
  onTitulo,
  onContexto,
  onWorkspace,
  onComponente,
  onSetComponentes,
  onCargarModelo,
  onCalcular,
  onCompararAulas,
  onSeleccionarAulas,
  onSimularReemplazos,
  onSourceUpload,
  onSourceBuild,
  uploadingSourceId,
  calculando,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  busy: string | null;
  activeSection: string;
  activeLocalTab: string;
  activeLabTab: ClassroomLabTab;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onSetComponentes: (componentes: CalcMuestraComponente[]) => void;
  onCargarModelo: () => void;
  onCalcular: (estudioOverride?: CalcMuestraEstudio) => void | Promise<void>;
  onCompararAulas: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSeleccionarAulas: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onSimularReemplazos: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
  onSourceUpload: (binding: CalcMuestraWorkspaceSourceBinding, file: File) => void | Promise<void>;
  onSourceBuild: (workspace: CalcMuestraWorkspace) => void | Promise<void>;
  uploadingSourceId: string | null;
  calculando: boolean;
}) {
  const baseWorkspace = useMemo(
    () => workspace.frame_mode === "opinion_universitaria"
      ? workspace
      : { ...workspaceFor("opinion_universitaria"), ...workspace, frame_mode: "opinion_universitaria" as const },
    [workspace],
  );
  const [totalComp, facultyComp] = useMemo(() => universityComponents(estudio.componentes), [estudio.componentes]);
  const syncedWorkspace = useMemo(
    () => universityWorkspace(baseWorkspace, totalComp, facultyComp),
    [baseWorkspace, totalComp, facultyComp],
  );
  const [draftTargets, setDraftTargets] = useState<Record<string, number>>({});

  const currentTotal = estudio.componentes.find((c) => c.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID);
  const currentFaculty = estudio.componentes.find((c) => c.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID);
  const needsSync =
    estudio.componentes.length !== 2 ||
    !currentTotal ||
    !currentFaculty ||
    currentTotal.tecnica !== totalComp.tecnica ||
    currentFaculty.tecnica !== facultyComp.tecnica ||
    currentTotal.actor !== totalComp.actor ||
    currentFaculty.actor !== facultyComp.actor ||
    workspace.frame_mode !== "opinion_universitaria" ||
    workspace.escenarios.length !== syncedWorkspace.escenarios.length ||
    syncedWorkspace.escenarios.some((expected, i) => {
      const current = workspace.escenarios[i];
      return !current ||
        current.id !== expected.id ||
        current.component_id !== expected.component_id ||
        current.redondeo_multiplo !== expected.redondeo_multiplo;
    });

  useEffect(() => {
    if (!needsSync) return;
    onSetComponentes([totalComp, facultyComp]);
    onWorkspace(syncedWorkspace);
  }, [facultyComp, needsSync, onSetComponentes, onWorkspace, syncedWorkspace, totalComp]);

  function setDraftTarget(componentId: string, value: number) {
    setDraftTargets((prev) => ({ ...prev, [componentId]: Math.max(0, Math.round(value)) }));
  }

  function applyTarget(componentId: string, value: number) {
    const target = Math.round(value);
    const comp = componentId === totalComp.id ? totalComp : facultyComp;
    const formula = componentFormulaBase(comp);
    if (formula && target < formula) return;
    const nextComp: CalcMuestraComponente = {
      ...comp,
      meta: {
        ...comp.meta,
        tipo: "objetivo",
        valor: target,
        variable_control: "facultad_sexo",
      },
      resultado: null,
    };
    const nextTotal = componentId === totalComp.id ? nextComp : totalComp;
    const nextFaculty = componentId === facultyComp.id ? nextComp : facultyComp;
    const nextWorkspace = universityWorkspace(syncedWorkspace, nextTotal, nextFaculty);
    const nextEstudio = { ...estudio, componentes: [nextTotal, nextFaculty], workspace: nextWorkspace };
    onSetComponentes(nextEstudio.componentes);
    onWorkspace(nextWorkspace);
    setDraftTargets((prev) => {
      const next = { ...prev };
      delete next[componentId];
      return next;
    });
    void onCalcular(nextEstudio);
  }

  function calculateSample() {
    const nextEstudio = prepareUniversityStudyForCalculation(
      { ...estudio, componentes: [totalComp, facultyComp], workspace: syncedWorkspace },
      syncedWorkspace,
    );
    onSetComponentes(nextEstudio.componentes);
    if (nextEstudio.workspace) onWorkspace(nextEstudio.workspace);
    void onCalcular(nextEstudio);
  }

  const selectedSection = ["definicion", "marco", "aulas", "calculo", "salidas"].includes(activeSection)
    ? activeSection
    : "definicion";
  const localTabs = sidebarTabsForDeskSection({
    desk: "opinion_universitaria",
    activeSection: selectedSection,
    estudio,
    workspace: syncedWorkspace,
    aulasState,
  });
  const selectedLocalTab = localTabs.some((tab) => tab.id === activeLocalTab)
    ? activeLocalTab
    : localTabs[0]?.id ?? "";
  const showLocalTab = (tabId: string) => selectedLocalTab === tabId;
  const componentMarcoReady = safeNumber(totalComp.marco.marco_validado) > 0 && (totalComp.marco.estratos ?? []).some((e) => safeNumber(e.N) > 0);
  const aulasFrameReady = Boolean(
    aulasState?.frame &&
    (
      rowsFrom(aulasState.frame.population).length > 0 ||
      rowsFrom(aulasState.frame.aula_frame).length > 0 ||
      frameAuditNumber(aulasState.frame, "population_n") > 0 ||
      frameAuditNumber(aulasState.frame, "classroom_n") > 0
    ),
  );
  const marcoReady = componentMarcoReady || aulasFrameReady;
  const calculationReady = hasUsefulResult(totalComp) || hasUsefulResult(facultyComp);
  const comparisonReady = classroomComparisonReady(aulasState);
  const selectionReady = classroomSelectionReady(aulasState);
  const replacementReady = classroomReplacementReady(aulasState);

  return (
    <div className="cmv2-desk">
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection === "definicion" && (
          <div id="cmv2-section-university-setup" className="cmv2-tab-panel" role="tabpanel" aria-label="Definición">
            {showLocalTab("def-estudio") && <div id="cmv2-local-def-estudio">
              <UniversityStudySetupPanel
                estudio={estudio}
                workspace={syncedWorkspace}
                onTitulo={onTitulo}
                onContexto={onContexto}
                onWorkspace={onWorkspace}
                onCargarModelo={onCargarModelo}
              />
              <UniversityDefinitionReadinessPanel
                estudio={estudio}
                workspace={syncedWorkspace}
                totalComp={totalComp}
                facultyComp={facultyComp}
                aulasState={aulasState}
              />
            </div>}
            {showLocalTab("def-bases") && <div id="cmv2-local-def-bases" className="cmv2-definition-stack">
              <UniversityDefinitionBasesPanel
                workspace={syncedWorkspace}
                aulasState={aulasState}
                onWorkspace={onWorkspace}
                onSourceUpload={onSourceUpload}
                onSourceBuild={onSourceBuild}
                uploadingSourceId={uploadingSourceId}
              />
            </div>}
            {showLocalTab("def-variables") && <div id="cmv2-local-def-variables" className="cmv2-definition-stack">
              <UniversityVariableMappingPanel
                workspace={syncedWorkspace}
                aulasState={aulasState}
                onWorkspace={onWorkspace}
              />
            </div>}
            {showLocalTab("def-categorias") && <div id="cmv2-local-def-categorias" className="cmv2-definition-stack">
              <UniversityCategoryMappingPanel
                workspace={syncedWorkspace}
                aulasState={aulasState}
                onWorkspace={onWorkspace}
              />
              <UniversityEligibilityCriteriaPanel
                workspace={syncedWorkspace}
                aulasState={aulasState}
                onWorkspace={onWorkspace}
              />
            </div>}
          </div>
        )}

        {selectedSection === "marco" && (
          <div id="cmv2-section-university-marco" className="cmv2-tab-panel" role="tabpanel" aria-label="Marco institucional">
            {showLocalTab("marco-poblacion") && <div id="cmv2-local-marco-poblacion">
              <ClassroomFrameDashboard frame={aulasState?.frame ?? null} totalComp={totalComp} selection={aulasState?.selection ?? null} workspace={syncedWorkspace} lockedScope="poblacion" />
            </div>}
            {showLocalTab("marco-aulas") && <div id="cmv2-local-marco-aulas">
              <ClassroomFrameDashboard frame={aulasState?.frame ?? null} totalComp={totalComp} selection={aulasState?.selection ?? null} workspace={syncedWorkspace} lockedScope="aulas" />
            </div>}
            {showLocalTab("marco-validacion") && <div id="cmv2-local-marco-validacion">
              <UniversityFrameValidationPanel workspace={syncedWorkspace} aulasState={aulasState} />
            </div>}
            {showLocalTab("marco-estructura") && <div id="cmv2-local-marco-estructura">
              <UniversityFrameStructurePanel workspace={syncedWorkspace} totalComp={totalComp} aulasState={aulasState} />
            </div>}
            {showLocalTab("marco-cruces") && <div id="cmv2-local-marco-cruces">
              <UniversityFrameCrossesPanel workspace={syncedWorkspace} totalComp={totalComp} aulasState={aulasState} />
            </div>}
            {showLocalTab("marco-cadena") && <div id="cmv2-local-marco-cadena">
              <UniversityRevampBlueprint componentes={[totalComp, facultyComp]} workspace={syncedWorkspace} />
            </div>}
          </div>
        )}

        {selectedSection === "aulas" && (
          <div id="cmv2-section-university-aulas" className="cmv2-tab-panel" role="tabpanel" aria-label="Aulas y selección">
            <UniversityClassroomSelectionPanel
              workspace={syncedWorkspace}
              totalComp={totalComp}
              facultyComp={facultyComp}
              aulasState={aulasState}
              busy={busy}
              activeLabTab={activeLabTab}
              onWorkspace={onWorkspace}
              onCompare={onCompararAulas}
              onSelectMethod={onSeleccionarAulas}
              onSimulateReplacements={onSimularReemplazos}
            />
          </div>
        )}

        {selectedSection === "calculo" && (
          <div id="cmv2-section-university-calculo" className="cmv2-tab-panel" role="tabpanel" aria-label="Cálculo">
            {showLocalTab("calculo-guia") && <div id="cmv2-local-calculo-guia">
              <UniversityGuidedBrief
                section="calculo"
                workspace={syncedWorkspace}
                totalComp={totalComp}
                facultyComp={facultyComp}
                marcoReady={marcoReady}
                calculationReady={calculationReady}
                comparisonReady={comparisonReady}
                selectionReady={selectionReady}
                replacementReady={replacementReady}
              />
              <UniversityCalculationWorkflowPanel
                workspace={syncedWorkspace}
                totalComp={totalComp}
                facultyComp={facultyComp}
                aulasState={aulasState}
                marcoReady={marcoReady}
                calculationReady={calculationReady}
                comparisonReady={comparisonReady}
                selectionReady={selectionReady}
                onCalcular={calculateSample}
                calculando={calculando}
              />
            </div>}
            {showLocalTab("calculo-propuestas") && <div id="cmv2-local-calculo-propuestas">
              <UniversityCalculationScenarioPanel
                componentes={[totalComp, facultyComp]}
                workspace={syncedWorkspace}
                marcoReady={marcoReady}
                onCalcular={calculateSample}
                calculando={calculando}
              />
              <UniversityRevampCalculoPanel
                componentes={[totalComp, facultyComp]}
                workspace={syncedWorkspace}
                draftTargets={draftTargets}
                onDraftTarget={setDraftTarget}
                onApplyTarget={applyTarget}
                calculando={calculando}
              />
            </div>}
            {showLocalTab("calculo-ajustes") && <div id="cmv2-local-calculo-ajustes">
              <UniversityCalculationAssumptionGuide
                workspace={syncedWorkspace}
                totalComp={totalComp}
                facultyComp={facultyComp}
              />
              <UniversityCalculationAssumptionsPanel
                totalComp={totalComp}
                facultyComp={facultyComp}
                onComponente={onComponente}
              />
            </div>}
          </div>
        )}

        {selectedSection === "salidas" && (
          <div id="cmv2-section-university-salidas" className="cmv2-tab-panel" role="tabpanel" aria-label="Salidas">
            {showLocalTab("salidas-guia") && <div id="cmv2-local-salidas-guia">
              <UniversityGuidedBrief
                section="salidas"
                workspace={syncedWorkspace}
                totalComp={totalComp}
                facultyComp={facultyComp}
                marcoReady={marcoReady}
                calculationReady={calculationReady}
                comparisonReady={comparisonReady}
                selectionReady={selectionReady}
                replacementReady={replacementReady}
              />
              <UniversityOutputWorkflowPanel
                workspace={syncedWorkspace}
                totalComp={totalComp}
                facultyComp={facultyComp}
                aulasState={aulasState}
                marcoReady={marcoReady}
                calculationReady={calculationReady}
                comparisonReady={comparisonReady}
                selectionReady={selectionReady}
                replacementReady={replacementReady}
              />
            </div>}
            {showLocalTab("salidas-entregables") && <div id="cmv2-local-salidas-entregables">
              <UniversityPublicationConfigPanel
                workspace={syncedWorkspace}
                aulasState={aulasState}
                onWorkspace={onWorkspace}
              />
            </div>}
            {showLocalTab("salidas-resultados") && <div id="cmv2-local-salidas-resultados">
              <UniversityOutputReadinessPanel
                workspace={syncedWorkspace}
                totalComp={totalComp}
                facultyComp={facultyComp}
                aulasState={aulasState}
                calculationReady={calculationReady}
                selectionReady={selectionReady}
                replacementReady={replacementReady}
              />
              <UniversityRevampResultadosPanel
                componentes={[totalComp, facultyComp]}
                workspace={syncedWorkspace}
                onWorkspace={onWorkspace}
              />
            </div>}
            {showLocalTab("salidas-monitoreo") && <div id="cmv2-local-salidas-monitoreo">
              <UniversityMonitoringHandoffPanel aulasState={aulasState} />
            </div>}
            {showLocalTab("salidas-reservas") && <div id="cmv2-local-salidas-reservas">
              <UniversityReservesOutputPanel aulasState={aulasState} />
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}

type UniversityBlueprintTone = "ready" | "working" | "pending" | "neutral";

function UniversityRevampBlueprint({
  componentes,
  workspace,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  workspace: CalcMuestraWorkspace;
}) {
  const [totalComp, facultyComp] = componentes;
  const estratos = totalComp.marco.estratos ?? [];
  const marcoTotal = safeNumber(totalComp.marco.marco_validado);
  const facultades = estratos.filter((e) => safeNumber(e.N) > 0).length;
  const hasSexo = estratos.some((e) => safeNumber(e.N_a) > 0 || safeNumber(e.N_b) > 0);
  const marcoReady = marcoTotal > 0 && facultades > 0;
  const hasResultados = marcoReady && componentes.some((comp) => Boolean(comp.resultado));
  const aulasCalculadas = componentes.reduce((sum, comp) => sum + safeNumber(comp.resultado?.aulas_total), 0);
  const selectionReady = hasResultados && aulasCalculadas > 0;
  const aulasConfig = normalizeUniversityAulasConfig(workspace.aulas_config);
  const selectorLabel = UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((option) => option.id === aulasConfig.selector)?.label ?? "Balance por cuotas y tamaño";
  const flow: Array<{
    label: string;
    value: string;
    detail: string;
    tone: UniversityBlueprintTone;
    icon: typeof Database;
  }> = [
    {
      label: "Solicitud institucional",
      value: workspace.fuente_marco ? "Base institucional" : "Base principal o dos hojas",
      detail: "estudiante por curso y horario",
      tone: "neutral",
      icon: ClipboardList,
    },
    {
      label: "Marco madre",
      value: marcoReady ? fmtInt(marcoTotal) : "pendiente",
      detail: facultades ? `${facultades} facultades` : "sin facultades",
      tone: marcoReady ? "ready" : "pending",
      icon: Database,
    },
    {
      label: "Escenarios",
      value: hasResultados ? "calculados" : "por calcular",
      detail: "universidad + facultad",
      tone: hasResultados ? "ready" : marcoReady ? "working" : "pending",
      icon: BarChart3,
    },
    {
      label: "Aulas",
      value: selectionReady ? `${fmtInt(aulasCalculadas)} previstas` : `titulares + R1-R${aulasConfig.bolsas_reemplazo}`,
      detail: `${selectorLabel}, repetidos y tamaño`,
      tone: selectionReady ? "ready" : hasResultados ? "working" : "neutral",
      icon: Layers3,
    },
    {
      label: "Monitoreo",
      value: "Agenda de aulas",
      detail: "QR, avance y reemplazos",
      tone: "neutral",
      icon: Route,
    },
  ];
  const checks: Array<{ label: string; value: string; ready: boolean; icon: typeof Database }> = [
    { label: "Unidad", value: "estudiante por curso y horario", ready: marcoReady, icon: Table2 },
    { label: "Cuotas", value: hasSexo ? "facultad x sexo" : "sexo pendiente", ready: hasSexo, icon: Target },
    { label: "Aulas", value: selectionReady ? "titulares y reemplazos" : "curso y horario", ready: selectionReady, icon: Grid3X3 },
    { label: "Trazabilidad", value: "registro y bitácora", ready: hasResultados, icon: CheckCircle2 },
  ];

  return (
    <section className="cmv2-panel cmv2-university-blueprint">
      <div className="cmv2-university-blueprint-main">
        <div className="cmv2-panel-head">
          <span className="cmv2-eyebrow">Encuesta a estudiantes</span>
          <strong>Marco institucional, muestra y aulas</strong>
        </div>
        <div className="cmv2-university-flow" aria-label="Flujo operativo de muestra universitaria">
          {flow.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className={`cmv2-university-flow-step is-${step.tone}`}>
                <span className="cmv2-university-flow-index">{index + 1}</span>
                <span className="cmv2-university-flow-icon"><Icon size={15} /></span>
                <span className="cmv2-university-flow-copy">
                  <small>{step.label}</small>
                  <strong>{step.value}</strong>
                  <em>{step.detail}</em>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="cmv2-university-readiness">
        {checks.map((check) => {
          const Icon = check.icon;
          return (
            <div key={check.label} className={`cmv2-university-readiness-card ${check.ready ? "is-ready" : "is-pending"}`}>
              <span><Icon size={14} /></span>
              <div>
                <small>{check.label}</small>
                <strong>{check.value}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type UniversityGuidedSection = "definicion" | "marco" | "calculo" | "aulas" | "salidas";
type GuideItem = {
  label: string;
  title: string;
  detail: string;
  status: GuideStatus;
};
type GuideCheck = {
  label: string;
  value: string;
  status: GuideStatus;
};

function UniversityGuidedBrief({
  section,
  workspace,
  totalComp,
  facultyComp,
  marcoReady,
  calculationReady,
  comparisonReady,
  selectionReady,
  replacementReady,
}: {
  section: UniversityGuidedSection;
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  marcoReady: boolean;
  calculationReady: boolean;
  comparisonReady: boolean;
  selectionReady: boolean;
  replacementReady: boolean;
}) {
  const facultades = totalComp.marco.estratos ?? [];
  const marcoTotal = safeNumber(totalComp.marco.marco_validado);
  const facultyTarget = safeNumber(facultyComp.resultado?.n_objetivo, 0);
  const totalTarget = safeNumber(totalComp.resultado?.n_objetivo, 0);
  const quotaLabel = calculationReady
    ? `${fmtInt(Math.max(facultyTarget, totalTarget))} entrevistas objetivo`
    : marcoReady
      ? "listo para calcular"
      : "requiere marco";
  const definitionReady = Boolean(workspace.fuente_marco || workspace.marco_disponible);
  const selectionLabel = selectionReady
    ? replacementReady ? "titulares y reemplazos generados" : "titulares generados"
    : comparisonReady ? "método elegido, falta selección" : "requiere comparación";
  const replacementLabel = replacementReady ? "simulación lista" : selectionReady ? "lista para simular" : "requiere selección";
  const sourceLabel = workspace.fuente_marco || "registro académico o equivalente";
  const frameLabel = workspace.marco_disponible || "base principal o bases equivalentes";
  const config: Record<UniversityGuidedSection, {
    eyebrow: string;
    title: string;
    lead: string;
    status: GuideStatus;
    items: GuideItem[];
    checks: GuideCheck[];
  }> = {
    definicion: {
      eyebrow: "Guía de sección",
      title: "Primero se fija el contrato de datos",
      lead: "Esta pantalla traduce el pedido institucional a reglas simples: qué archivo entra, qué representa una fila y qué unidad se podrá seleccionar después.",
      status: guideStatus(definitionReady),
      items: [
        { label: "Entrada", title: "Base institucional", detail: "Puede llegar como una base principal o como estudiantes elegibles más catálogo de cursos y horarios.", status: guideStatus(Boolean(workspace.marco_disponible)) },
        { label: "Fila esperada", title: "estudiante por curso y horario", detail: "Un estudiante puede aparecer varias veces; eso se controla más adelante al seleccionar aulas.", status: "ready" },
        { label: "Salida", title: "contrato validable", detail: "Con esto Prosecnur sabe cómo pedir, leer y auditar la información antes de calcular.", status: guideStatus(definitionReady) },
      ],
      checks: [
        { label: "Fuente", value: sourceLabel, status: guideStatus(Boolean(workspace.fuente_marco)) },
        { label: "Marco disponible", value: frameLabel, status: guideStatus(Boolean(workspace.marco_disponible)) },
        { label: "Observación", value: "estudiante matriculado", status: "ready" },
        { label: "Selección final", value: "curso, horario y aula", status: "ready" },
      ],
    },
    marco: {
      eyebrow: "Guía de sección",
      title: "Luego se valida la población que realmente entra al estudio",
      lead: "Aquí se revisa que el marco tenga facultades, sexo y totales consistentes antes de convertirlo en cuotas o aulas.",
      status: guideStatus(marcoReady, definitionReady),
      items: [
        { label: "Entrada", title: "base ya entendida", detail: "La app espera población filtrada y elegible, no una lista operativa de aulas todavía.", status: guideStatus(definitionReady) },
        { label: "Validación", title: `${fmtInt(marcoTotal)} estudiantes`, detail: "Se confirma cobertura, exclusiones y distribución por dominios relevantes.", status: guideStatus(marcoReady, definitionReady) },
        { label: "Salida", title: "marco listo para cálculo", detail: "El N por facultad debe salir de este marco; la selección de aulas viene después.", status: guideStatus(marcoReady, definitionReady) },
      ],
      checks: [
        { label: "Facultades", value: facultades.length ? `${fmtInt(facultades.length)} dominios` : "sin dominios cargados", status: guideStatus(facultades.length > 0, definitionReady) },
        { label: "Sexo", value: facultades.some((e) => safeNumber(e.N_a) || safeNumber(e.N_b)) ? "control disponible" : "pendiente", status: guideStatus(facultades.some((e) => safeNumber(e.N_a) || safeNumber(e.N_b)), marcoReady) },
        { label: "Orden correcto", value: "marco antes que aulas", status: "ready" },
        { label: "Marco", value: frameLabel, status: guideStatus(marcoReady, definitionReady) },
      ],
    },
    calculo: {
      eyebrow: "Guía de sección",
      title: "Después el marco se convierte en N y cuotas",
      lead: "Esta parte decide cuántas respuestas necesita el estudio por universidad y por facultad. Todavía no sortea aulas.",
      status: guideStatus(calculationReady, marcoReady),
      items: [
        { label: "Entrada", title: "marco validado", detail: "Toma los totales por facultad y sexo desde la base institucional.", status: guideStatus(marcoReady, definitionReady) },
        { label: "Decisión", title: quotaLabel, detail: "Aplica error, confianza, deff, sobremuestra y rendimiento esperado.", status: guideStatus(calculationReady, marcoReady) },
        { label: "Salida", title: "N por facultad", detail: "Ese N se traduce luego a aulas titulares y reemplazos equivalentes.", status: guideStatus(calculationReady, marcoReady) },
      ],
      checks: [
        { label: "Marco", value: marcoReady ? "validado" : "pendiente", status: guideStatus(marcoReady, definitionReady) },
        { label: "Escenario universidad", value: totalComp.resultado ? "calculado" : "por calcular", status: guideStatus(Boolean(totalComp.resultado), marcoReady) },
        { label: "Escenario facultad", value: facultyComp.resultado ? "calculado" : "por calcular", status: guideStatus(Boolean(facultyComp.resultado), marcoReady) },
        { label: "Siguiente", value: "selección de aulas", status: guideStatus(calculationReady, marcoReady) },
      ],
    },
    aulas: {
      eyebrow: "Guía de sección",
      title: calculationReady ? "El N se traduce en aulas titulares y reemplazos" : "Primero calcula N antes de seleccionar aulas",
      lead: "El laboratorio compara métodos, evita concentración y repetidos, y deja una selección trazable para que Monitoreo solo ejecute el plan.",
      status: guideStatus(selectionReady, calculationReady),
      items: [
        { label: "Entrada", title: calculationReady ? "Tamaño y cuotas calculadas" : "Tamaño y cuotas pendientes", detail: "La selección de aulas parte del objetivo por facultad, no de una lista suelta.", status: guideStatus(calculationReady, marcoReady) },
        { label: "Decisión", title: comparisonReady ? "métodos comparados" : "comparar métodos", detail: "Los métodos sistemático, balanceado, disperso y optimizado se evalúan con el mismo objetivo.", status: guideStatus(comparisonReady, calculationReady) },
        { label: "Salida", title: selectionLabel, detail: "La muestra titular va primero; los reemplazos se activan sin rediseñar.", status: guideStatus(selectionReady, comparisonReady) },
      ],
      checks: [
        { label: "Marco de aulas", value: "curso, horario y aula", status: guideStatus(marcoReady, definitionReady) },
        { label: "Cuotas", value: calculationReady ? quotaLabel : "requiere cálculo", status: guideStatus(calculationReady, marcoReady) },
        { label: "Selección", value: selectionLabel, status: guideStatus(selectionReady, comparisonReady) },
        { label: "Reemplazos", value: replacementLabel, status: guideStatus(replacementReady, selectionReady) },
      ],
    },
    salidas: {
      eyebrow: "Guía de sección",
      title: selectionReady && calculationReady ? "Cierre con reporte, selección y seguimiento" : "Prepara lo que falta antes del cierre",
      lead: "La app debe dejar evidencia metodológica y un plan operativo claro, sin mostrar datos personales fuera del equipo ni rediseñar el marco durante campo.",
      status: guideStatus(selectionReady && calculationReady, marcoReady),
      items: [
        { label: "Entrada", title: calculationReady ? "cálculo listo" : "cálculo pendiente", detail: "Toma escenarios, cuotas, titulares, reemplazos y advertencias metodológicas.", status: guideStatus(calculationReady, marcoReady) },
        { label: "Entrega", title: calculationReady ? "reporte y anexos" : "reporte pendiente", detail: "Incluye perfil del marco, calidad de representatividad, probabilidades, pesos, riesgos y sustento.", status: guideStatus(calculationReady, marcoReady) },
        { label: "Seguimiento", title: "plan de aulas", detail: "Monitoreo agenda y activa reemplazos; no cambia silenciosamente el diseño.", status: guideStatus(selectionReady, calculationReady) },
      ],
      checks: [
        { label: "Reporte", value: calculationReady ? "preparable" : "requiere cálculo", status: guideStatus(calculationReady, marcoReady) },
        { label: "Plan de aulas", value: selectionReady ? "disponible" : "pendiente", status: guideStatus(selectionReady, calculationReady) },
        { label: "Reemplazos", value: replacementLabel, status: guideStatus(replacementReady, selectionReady) },
        { label: "Privacidad", value: "datos protegidos", status: "ready" },
      ],
    },
  };
  const current = config[section];
  return (
    <section className="cmv2-guide-brief" data-guide-section={section}>
      <div className="cmv2-guide-head">
        <div>
          <span className="cmv2-eyebrow">{current.eyebrow}</span>
          <strong>{current.title}</strong>
          <p>{current.lead}</p>
        </div>
        <span className={`cmv2-guide-status is-${current.status}`}>{guidedStatusLabel(current.status)}</span>
      </div>
      <div className="cmv2-guide-flow" aria-label="Entrada, decisión y salida de la sección">
        {current.items.map((item, index) => (
          <article key={item.label} className={`is-${item.status}`}>
            <span>{item.status === "ready" ? <CheckCircle2 size={13} /> : index + 1}</span>
            <div>
              <small>{item.label}</small>
              <strong>{item.title}</strong>
              <em>{item.detail}</em>
            </div>
            {index < current.items.length - 1 && <ArrowRight size={13} aria-hidden="true" />}
          </article>
        ))}
      </div>
      <div className="cmv2-guide-checks" aria-label="Estado de preparación">
        {current.checks.map((check) => (
          <span key={check.label} className={`is-${check.status}`}>
            {check.status === "ready" ? <CheckCircle2 size={12} /> : <CirclePendingIcon />}
            <b>{check.label}</b>
            <em>{check.value}</em>
          </span>
        ))}
      </div>
    </section>
  );
}

function UniversityStudySetupPanel({
  estudio,
  workspace,
  onTitulo,
  onContexto,
  onWorkspace,
  onCargarModelo,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onCargarModelo: () => void;
}) {
  const requiredFields = ["identificador", "curso y horario", "facultad", "sexo", "horario", "condición"];
  const processSteps: Array<{
    label: string;
    title: string;
    detail: string;
    icon: typeof Database;
  }> = [
    {
      label: "Insumo",
      title: "Alumno por curso-horario",
      detail: "La base puede traer varias filas por estudiante porque cada fila corresponde a un curso y horario.",
      icon: Database,
    },
    {
      label: "Población",
      title: "Estudiantes elegibles",
      detail: "Aquí se filtra quién entra al estudio y se deduplican estudiantes para calcular cuotas.",
      icon: Users,
    },
    {
      label: "Aulas",
      title: "Un aula por curso-horario",
      detail: "Antes de seleccionar se colapsa el marco para que las aulas grandes no se multipliquen por fila.",
      icon: Grid3X3,
    },
    {
      label: "Campo",
      title: "QR y reemplazos trazables",
      detail: "Monitoreo agenda titulares, activa reservas y registra qué ocurrió sin rediseñar la muestra.",
      icon: QrCode,
    },
  ];
  return (
    <section className="cmv2-panel cmv2-university-contract">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Características del estudio</span>
          <strong>Define el alcance antes de tocar el marco</strong>
        </div>
        <div className="cmv2-panel-head-actions">
          <button type="button" className="cmv2-ghost" onClick={onCargarModelo}>
            <Wand2 size={14} /> Cargar ejemplo
          </button>
          <span className="cmv2-pill-soft">paso 1</span>
        </div>
      </div>
      <div className="cmv2-university-contract-grid">
        <label className="cmv2-compact-field">
          <span>Título</span>
          <input
            value={estudio.titulo}
            placeholder="Encuesta a estudiantes"
            onChange={(e) => onTitulo(e.currentTarget.value)}
          />
        </label>
        <label className="cmv2-compact-field">
          <span>Cliente</span>
          <input
            value={estudio.contexto.cliente}
            placeholder="Institución o área solicitante"
            onChange={(e) => onContexto("cliente", e.currentTarget.value)}
          />
        </label>
        <label className="cmv2-compact-field cmv2-compact-field--wide">
          <span>Alcance o nota del estudio</span>
          <textarea
            value={estudio.contexto.descripcion_libre}
            placeholder="Qué población se busca representar, periodo académico, exclusiones acordadas o condiciones de campo."
            onChange={(e) => onContexto("descripcion_libre", e.currentTarget.value)}
          />
        </label>
        <label className="cmv2-compact-field">
          <span>Fuente institucional esperada</span>
          <input
            value={workspace.fuente_marco}
            placeholder="Registro académico, matrícula o sistema equivalente"
            onChange={(e) => onWorkspace({ ...workspace, fuente_marco: e.currentTarget.value })}
          />
        </label>
        <label className="cmv2-compact-field">
          <span>Base esperada</span>
          <input
            value={workspace.marco_disponible}
            placeholder="Base principal o bases institucionales equivalentes"
            onChange={(e) => onWorkspace({ ...workspace, marco_disponible: e.currentTarget.value })}
          />
        </label>
      </div>
      <div className="cmv2-university-contract-cards" aria-label="Recorrido operativo de base a campo">
        {processSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="cmv2-university-contract-step">
              <span className="cmv2-university-contract-step-index">{index + 1}</span>
              <i><Icon size={15} /></i>
              <small>{step.label}</small>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </div>
          );
        })}
      </div>
      <div className="cmv2-university-field-strip" aria-label="Variables mínimas esperadas">
        {requiredFields.map((field) => <span key={field}>{field}</span>)}
      </div>
    </section>
  );
}

function UniversityDefinitionReadinessPanel({
  estudio,
  workspace,
  totalComp,
  facultyComp,
  aulasState,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;
  const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
  const classroomRows = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
  const sourceMode = workspace.source_mode ?? "base_madre";
  const sourceBindings = ensureUniversitySourceBindings(sourceMode, workspace.source_bindings);
  const sourceModeLabel = UNIVERSITY_SOURCE_MODE_OPTIONS.find((option) => option.id === sourceMode)?.label ?? "Base institucional";
  const readySources = sourceBindings.filter((binding) => binding.file_id && sourceBindingCompatibleForBuild(binding)).length;
  const requiredVariables = UNIVERSITY_REQUIRED_VARIABLES.filter((row) => row.required);
  const mappedRequired = requiredVariables.filter((required) =>
    (workspace.variable_mappings ?? []).some((row) => row.role === required.role && row.column),
  ).length;
  const config = normalizeUniversityAulasConfig(workspace.aulas_config);
  const publication = workspace.publication_config ?? {};
  const populationN = Math.max(
    populationRows.length,
    frameAuditNumber(frame, "population_n"),
    safeNumber(totalComp.marco.marco_validado, 0),
  );
  const classroomN = Math.max(
    classroomRows.length,
    frameAuditNumber(frame, "classroom_included_n"),
    frameAuditNumber(frame, "classroom_n"),
  );
  const facultyN = Math.max(
    countDistinctByKeys(populationRows, ["faculty", "facultad", "unidad_academica", "escuela"]),
    countDistinctByKeys(classroomRows, ["faculty", "facultad", "unidad_academica", "escuela", "stratum"]),
    totalComp.marco.estratos?.filter((row) => safeNumber(row.N) > 0).length ?? 0,
  );
  const teacherN = countDistinctByKeys(classroomRows, ["teacher", "docente", "profesor", "contacto"]);
  const targetN = Math.max(
    safeNumber(totalComp.resultado?.n_objetivo, 0),
    safeNumber(facultyComp.resultado?.n_objetivo, 0),
  );
  const selectionRows = rowsFrom<Record<string, unknown>>(aulasState?.selection?.selection);
  const m1Rows = selectionRows.filter((row) => classroomRowText(row, ["wave"]) === "M1");
  const eligibilityReady = Boolean(config.accepted_conditions?.length) && safeNumber(config.min_elegibles_aula, 0) > 0;
  const sheetsReady = Boolean(publication.google_sheets_enabled || publication.spreadsheet_id || publication.spreadsheet_url);
  const workbookReady = publication.include_workbook !== false;
  const scopeReady = Boolean(estudio.titulo && workspace.fuente_marco && workspace.marco_disponible);
  const baseReady = readySources > 0 || Boolean(frame);
  const mappingsReady = mappedRequired === requiredVariables.length;
  const deliverablesConfigured = workbookReady || sheetsReady;
  const deliverablesReady = deliverablesConfigured && targetN > 0 && m1Rows.length > 0;
  const nextStep = !scopeReady
    ? "Completa nombre, cliente, fuente y base esperada."
    : !baseReady
      ? "Carga la base institucional o selecciona las hojas del Excel."
      : !mappingsReady
        ? "Revisa el mapeo de columnas antes de construir el marco."
        : !eligibilityReady
          ? "Confirma condición válida, presencialidad y mínimo de aula."
          : !frame
            ? "Construye el marco para ver población, aulas y exclusiones."
            : targetN <= 0
              ? "Pasa a Cálculo para fijar N, cuotas y aulas esperadas."
              : !m1Rows.length
                ? "Pasa a Aulas para comparar métodos y elegir aulas titulares."
                : "Configura salidas y deja listo el pase a Monitoreo.";
  const readiness: Array<{
    label: string;
    value: string;
    detail: string;
    ready: boolean;
    working?: boolean;
    icon: typeof Database;
  }> = [
    {
      label: "Estudio",
      value: estudio.contexto.cliente || estudio.titulo || "por nombrar",
      detail: "Alcance, periodo, cliente y fuente esperada.",
      ready: scopeReady,
      working: Boolean(estudio.titulo || workspace.fuente_marco || workspace.marco_disponible),
      icon: ClipboardList,
    },
    {
      label: "Base",
      value: `${readySources}/${sourceBindings.length} listas`,
      detail: `${sourceModeLabel}: archivo, hoja y rol detectado.`,
      ready: baseReady,
      working: sourceBindings.some((binding) => Boolean(binding.file_id || binding.file_name)),
      icon: Database,
    },
    {
      label: "Variables",
      value: `${mappedRequired}/${requiredVariables.length} necesarias`,
      detail: "Identificador, facultad, sexo, curso, horario y condición.",
      ready: mappingsReady,
      working: mappedRequired > 0,
      icon: SlidersHorizontal,
    },
    {
      label: "Elegibilidad",
      value: eligibilityReady ? "reglas activas" : "por confirmar",
      detail: "Define población objetivo antes de cualquier cálculo o sorteo.",
      ready: eligibilityReady,
      working: baseReady,
      icon: Target,
    },
    {
      label: "Salidas",
      value: sheetsReady ? "Sheets + Excel" : workbookReady ? "Excel local" : "por definir",
      detail: "Archivos de trabajo, hojas internas, versión cliente y rutas operativas.",
      ready: deliverablesReady,
      working: deliverablesConfigured || Boolean(publication.publication_mode),
      icon: FileText,
    },
  ];
  const detected = [
    { label: "Población objetivo", value: populationN ? fmtInt(populationN) : "pendiente", detail: "estudiantes únicos elegibles" },
    { label: "Aulas seleccionables", value: classroomN ? fmtInt(classroomN) : "pendiente", detail: "curso, horario y aula" },
    { label: "Facultades", value: facultyN ? fmtInt(facultyN) : "pendiente", detail: "dominios principales" },
    { label: "Docentes/contactos", value: teacherN ? fmtInt(teacherN) : "mapear", detail: "agenda y autorizaciones" },
  ];
  const flow = [
    { label: "Definir", value: "estudio + base", ready: scopeReady && baseReady },
    { label: "Entender", value: "variables + elegibilidad", ready: mappingsReady && eligibilityReady },
    { label: "Construir", value: "marco auditable", ready: Boolean(frame) },
    { label: "Calcular", value: "N y cuotas", ready: targetN > 0 },
    { label: "Seleccionar", value: "titulares y reemplazos", ready: m1Rows.length > 0 },
    { label: "Publicar", value: "Excel/Sheets", ready: deliverablesReady },
  ];

  return (
    <section className="cmv2-panel cmv2-definition-readiness">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Preparación de la mesa</span>
          <strong>Qué está listo antes de pasar al marco</strong>
        </div>
        <span className="cmv2-pill-soft">{sourceModeLabel}</span>
      </div>
      <div className="cmv2-definition-readiness-grid">
        {readiness.map((item, index) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={item.ready ? "is-ready" : item.working ? "is-working" : "is-pending"}>
              <span className="cmv2-definition-readiness-index">{index + 1}</span>
              <i><Icon size={15} /></i>
              <div>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="cmv2-definition-status-layout">
        <div className="cmv2-definition-flow-card">
          <div className="cmv2-subhead">
            <span className="cmv2-eyebrow">Recorrido visible</span>
            <strong>Orden esperado del usuario</strong>
          </div>
          <div className="cmv2-definition-flow">
            {flow.map((step, index) => (
              <div key={step.label} className={step.ready ? "is-ready" : "is-pending"}>
                <span>{step.ready ? <CheckCircle2 size={13} /> : index + 1}</span>
                <strong>{step.label}</strong>
                <em>{step.value}</em>
              </div>
            ))}
          </div>
          <div className="cmv2-next-step-card cmv2-next-step-card--compact">
            <span><ArrowRight size={15} /></span>
            <div>
              <small>Siguiente acción útil</small>
              <strong>{nextStep}</strong>
              <p>La preparación debe dejar claro qué archivo entra, qué representa una fila y qué se entrega al cierre.</p>
            </div>
          </div>
        </div>
        <aside className="cmv2-definition-detected-card">
          <div className="cmv2-subhead">
            <span className="cmv2-eyebrow">Detectado hasta ahora</span>
            <strong>Lectura compacta del caso</strong>
          </div>
          <div className="cmv2-classroom-stat-grid">
            {detected.map((item) => <Metric key={item.label} label={item.label} value={item.value} />)}
          </div>
          <div className="cmv2-definition-source-list">
            {sourceBindings.map((binding) => {
              const ready = Boolean(binding.file_id && sourceBindingCompatibleForBuild(binding));
              return (
                <div key={binding.id} className={ready ? "is-ready" : binding.file_id ? "is-working" : "is-pending"}>
                  <span>{ready ? <CheckCircle2 size={13} /> : <CirclePendingIcon />}</span>
                  <strong>{sourceRoleLabel(binding.role)}</strong>
                  <em>{binding.file_name ? sourceBindingSelectedSheet(binding) || "hoja pendiente" : "archivo pendiente"}</em>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function UniversityEligibilityCriteriaPanel({
  workspace,
  aulasState,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const config = normalizeUniversityAulasConfig(workspace.aulas_config);
  const frame = aulasState?.frame ?? null;
  const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
  const exclusionRows = rowsFrom<Record<string, unknown>>(frame?.exclusions);
  const inputRows = frameAuditNumber(frame, "input_rows");
  const eligibleRows = frameAuditNumber(frame, "eligible_student_rows");
  const populationN = Math.max(populationRows.length, frameAuditNumber(frame, "population_n"));
  const classroomN = frameAuditNumber(frame, "classroom_included_n") || rowsFrom(frame?.aula_frame).length;
  const excludedRows = frameAuditNumber(frame, "excluded_rows") || exclusionRows.length;
  const conditionsText = (config.accepted_conditions ?? ["regular"]).join(", ");
  const sourceMode = workspace.source_mode === "dos_bases" ? "base + catálogo" : workspace.source_mode === "seleccion_existente" ? "selección previa" : "base principal";

  function updateConfig(patch: Partial<CalcMuestraWorkspaceAulasConfig>) {
    onWorkspace({ ...workspace, aulas_config: normalizeUniversityAulasConfig({ ...config, ...patch }) });
  }

  function updateConditions(value: string) {
    const accepted = value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    updateConfig({ accepted_conditions: accepted.length ? accepted : ["regular"] });
  }

  const criteria = [
    {
      label: "Condición aceptada",
      value: (config.accepted_conditions ?? ["regular"]).join(" · "),
      detail: "Filtra la población objetivo desde la columna de condición o elegibilidad.",
      ready: Boolean(config.accepted_conditions?.length),
    },
    {
      label: "Nivel académico",
      value: config.require_undergraduate ? "solo pregrado" : "sin exclusión automática",
      detail: "Evita mezclar posgrado si el universo de estudio es estudiantil de pregrado.",
      ready: true,
    },
    {
      label: "Modalidad",
      value: config.require_in_person ? "excluir virtual/remoto" : "admitir modalidad declarada",
      detail: "El marco de aulas necesita sesiones aplicables en aula si el campo será presencial.",
      ready: true,
    },
    {
      label: "Aula mínima",
      value: `${fmtInt(config.min_elegibles_aula)} elegibles`,
      detail: "Aulas menores quedan auditadas, pero no entran como unidad seleccionable principal.",
      ready: config.min_elegibles_aula > 0,
    },
  ];

  return (
    <section className="cmv2-panel cmv2-eligibility-panel">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Criterios de elegibilidad</span>
          <strong>Define qué cuenta como población objetivo antes del marco</strong>
        </div>
        <span className="cmv2-pill-soft">{sourceMode}</span>
      </div>
      <div className="cmv2-classroom-stat-grid">
        <Metric label="Universo leído" value={inputRows ? fmtInt(inputRows) : "pendiente"} />
        <Metric label="Filas elegibles" value={eligibleRows ? fmtInt(eligibleRows) : "pendiente"} />
        <Metric label="Estudiantes únicos" value={populationN ? fmtInt(populationN) : "pendiente"} />
        <Metric label="Aulas válidas" value={classroomN ? fmtInt(classroomN) : "pendiente"} />
        <Metric label="Exclusiones" value={excludedRows ? fmtInt(excludedRows) : "pendiente"} />
      </div>
      <div className="cmv2-eligibility-layout">
        <div className="cmv2-eligibility-form">
          <label className="cmv2-compact-field">
            <span>Valores aceptados en condición/elegibilidad</span>
            <input
              value={conditionsText}
              placeholder="regular, elegible, válido"
              onChange={(e) => updateConditions(e.currentTarget.value)}
            />
            <em>Separar varios valores con coma. La app buscará coincidencias normalizadas.</em>
          </label>
          <label className="cmv2-compact-field">
            <span>Mínimo de estudiantes elegibles por aula</span>
            <input
              type="number"
              min={1}
              value={config.min_elegibles_aula}
              onChange={(e) => updateConfig({ min_elegibles_aula: Math.max(1, Math.round(safeNumber(e.currentTarget.value, config.min_elegibles_aula))) })}
            />
            <em>Evita seleccionar aulas demasiado pequeñas como titulares.</em>
          </label>
          <label className="cmv2-compact-field">
            <span>Edad mínima, si la base trae edad</span>
            <input
              type="number"
              min={0}
              value={config.min_age ?? 18}
              disabled={!config.require_adult}
              onChange={(e) => updateConfig({ min_age: Math.max(0, Math.round(safeNumber(e.currentTarget.value, config.min_age ?? 18))) })}
            />
            <em>Solo se aplica si la columna existe y el filtro de mayoría de edad está activo.</em>
          </label>
          <div className="cmv2-eligibility-toggles">
            <label className="cmv2-classroom-toggle">
              <input
                type="checkbox"
                checked={Boolean(config.require_undergraduate)}
                onChange={(e) => updateConfig({ require_undergraduate: e.currentTarget.checked })}
              />
              <span><strong>Restringir a pregrado</strong><em>Excluye posgrado cuando se detecta en nivel/ciclo.</em></span>
            </label>
            <label className="cmv2-classroom-toggle">
              <input
                type="checkbox"
                checked={Boolean(config.require_in_person)}
                onChange={(e) => updateConfig({ require_in_person: e.currentTarget.checked })}
              />
              <span><strong>Exigir aplicación presencial</strong><em>Excluye modalidades virtuales/remotas para selección de aulas.</em></span>
            </label>
            <label className="cmv2-classroom-toggle">
              <input
                type="checkbox"
                checked={Boolean(config.require_adult)}
                onChange={(e) => updateConfig({ require_adult: e.currentTarget.checked })}
              />
              <span><strong>Aplicar mayoría de edad si existe</strong><em>Útil cuando el protocolo exige filtrar por edad declarada.</em></span>
            </label>
          </div>
        </div>
        <div className="cmv2-eligibility-rules">
          {criteria.map((item) => (
            <article key={item.label} className={item.ready ? "is-ready" : "is-pending"}>
              <span>{item.ready ? <CheckCircle2 size={14} /> : <CirclePendingIcon />}</span>
              <div>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="cmv2-classroom-note">
        <Target size={15} />
        <span>Estos criterios no seleccionan aulas todavía. Solo definen quién pertenece al universo y qué filas pueden entrar al marco de aplicación.</span>
      </div>
    </section>
  );
}

function UniversityDefinitionBasesPanel({
  workspace,
  aulasState,
  onWorkspace,
  onSourceUpload,
  onSourceBuild,
  uploadingSourceId,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onSourceUpload: (binding: CalcMuestraWorkspaceSourceBinding, file: File) => void | Promise<void>;
  onSourceBuild: (workspace: CalcMuestraWorkspace) => void | Promise<void>;
  uploadingSourceId: string | null;
}) {
  const frame = aulasState?.frame ?? null;
  const frameRows = frame?.aula_frame ?? [];
  const populationRows = frame?.population ?? [];
  const uniqueStudents = Math.max(
    populationRows.length,
    safeNumber((frame as Record<string, unknown> | null)?.population_n, 0),
    safeNumber((frame as Record<string, unknown> | null)?.unique_students_n, 0),
  );
  const sourceMode = workspace.source_mode ?? "base_madre";
  const sourceBindings = ensureUniversitySourceBindings(sourceMode, workspace.source_bindings);
  const currentMode = UNIVERSITY_SOURCE_MODE_OPTIONS.find((option) => option.id === sourceMode) ?? UNIVERSITY_SOURCE_MODE_OPTIONS[0];
  const readyToBuild = sourceMode === "base_madre"
    ? Boolean(sourceBindings.find((item) => item.role === "base_madre" && sourceBindingCompatibleForBuild(item))?.file_id)
    : sourceMode === "dos_bases"
      ? canBuildUniversityDeskFrameFromBindings(sourceBindings)
      : false;

  function setSourceMode(next: CalcMuestraWorkspaceSourceMode) {
    onWorkspace({
      ...workspace,
      source_mode: next,
      source_bindings: ensureUniversitySourceBindings(next, workspace.source_bindings),
    });
  }

  function updateBinding(id: string, patch: Partial<CalcMuestraWorkspaceSourceBinding>) {
    const nextBindings = sourceBindings.map((item) => (item.id === id ? { ...item, ...patch } : item));
    const nextWorkspace: CalcMuestraWorkspace = {
      ...workspace,
      source_bindings: nextBindings,
    };
    if (patch.sheet_name !== undefined) {
      const inspectedColumns = universityInspectedColumnOptions(nextWorkspace);
      if (inspectedColumns.length) {
        nextWorkspace.variable_mappings = reconcileUniversityVariableMappingsForColumns(
          nextWorkspace.variable_mappings,
          inspectedColumns,
        );
      }
    }
    onWorkspace(nextWorkspace);
  }

  return (
    <section className="cmv2-panel cmv2-university-sources">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Bases de datos</span>
          <strong>Define qué insumos existen antes del marco</strong>
        </div>
        <span className="cmv2-pill-soft">{currentMode.label}</span>
      </div>
      <div className="cmv2-classroom-stat-grid">
        <Metric label="Filas válidas" value={uniqueStudents ? fmtInt(uniqueStudents) : "pendiente"} />
        <Metric label="Aulas leídas" value={frameRows.length ? fmtInt(frameRows.length) : "pendiente"} />
        <Metric label="Bases declaradas" value={fmtInt(sourceBindings.length)} />
        <Metric label="Modo de entrada" value={currentMode.label} />
      </div>
      <div className="cmv2-source-mode-grid" role="radiogroup" aria-label="Tipo de insumo institucional">
        {UNIVERSITY_SOURCE_MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`cmv2-source-mode-card ${option.id === sourceMode ? "is-active" : ""}`}
            onClick={() => setSourceMode(option.id)}
          >
            <small>{option.id === "base_madre" ? "Recomendado" : option.id === "dos_bases" ? "Equivalente" : "Lectura histórica"}</small>
            <strong>{option.label}</strong>
            <span>{option.detail}</span>
            <em>{option.cards.join(" · ")}</em>
          </button>
        ))}
      </div>
      {sourceMode === "dos_bases" && (
        <div className="cmv2-source-mode-note">
          <Database size={15} />
          <span>Con el archivo 2025 basta usar <strong>MATRICULADO</strong> como base principal y <strong>CURSO Y HORARIO</strong> como catálogo. La hoja de inscripciones solo es necesaria si la base principal no trae curso y horario por estudiante.</span>
        </div>
      )}
      <div className="cmv2-source-binding-list" aria-label="Bases declaradas">
        {sourceBindings.map((binding) => {
          const inputId = `cmv2-source-file-${binding.id}`;
          const isUploading = uploadingSourceId === binding.id;
          const sheetName = binding.sheet_name?.trim() || "";
          const availableSheets = binding.available_sheets ?? [];
          const selectedDiagnostic = sourceBindingSelectedDiagnostic(binding);
          const isCompatible = sourceBindingCompatibleForBuild(binding);
          const status = binding.file_id
            ? isCompatible ? "cargada" : "revisar"
            : binding.file_name ? "declarada" : "pendiente";
          return (
            <article key={binding.id} className="cmv2-source-binding-card">
              <div>
                <small>{sourceRoleLabel(binding.role)}</small>
                <strong>{binding.label}</strong>
                <span>{binding.notes || "Declara el archivo, pestaña o rango que entregará esta pieza del marco."}</span>
              </div>
              <div className="cmv2-source-upload">
                <span>Archivo Excel</span>
                <input
                  id={inputId}
                  className="cmv2-source-file-input"
                  type="file"
                  accept=".xlsx,.xls,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={isUploading}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (!file) return;
                    void onSourceUpload({ ...binding, sheet_name: sheetName || binding.sheet_name }, file);
                  }}
                />
                <label className={`cmv2-source-upload-button ${isUploading ? "is-loading" : ""}`} htmlFor={inputId}>
                  {isUploading ? <Loader2 size={14} className="pulso-spin" /> : <Upload size={14} />}
                  {binding.file_id ? "Cambiar Excel" : "Subir Excel"}
                </label>
                <strong className="cmv2-source-file-name">{binding.file_name || "Ningún archivo cargado"}</strong>
              </div>
              <label className="cmv2-compact-field">
                <span>Pestaña o tabla</span>
                {availableSheets.length > 0 ? (
                  <select
                    value={sourceBindingSelectedSheet(binding)}
                    onChange={(e) => updateBinding(binding.id, sourceBindingPatchForSheet(binding, e.currentTarget.value))}
                  >
                    {availableSheets.map((sheet) => (
                      <option key={sheet} value={sheet}>{sheet}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={binding.sheet_name ?? ""}
                    placeholder="MATRICULADO / CURSO Y HORARIO"
                    onChange={(e) => updateBinding(binding.id, { sheet_name: e.currentTarget.value })}
                  />
                )}
                {selectedDiagnostic?.role_label && (
                  <em>{selectedDiagnostic.role_label}</em>
                )}
              </label>
              <div className="cmv2-source-build">
                <span>Estado</span>
                <strong className={`cmv2-source-status is-${status}`}>
                  {status === "revisar" ? "revisar hoja" : status}
                </strong>
                {sourceMode !== "seleccion_existente" && (
                  <button
                    type="button"
                    className="cmv2-source-build-button"
                    onClick={() => void onSourceBuild({ ...workspace, source_mode: sourceMode, source_bindings: sourceBindings })}
                    disabled={!readyToBuild || Boolean(uploadingSourceId)}
                  >
                    Construir marco
                  </button>
                )}
              </div>
              {binding.file_id && !isCompatible && (
                <p className="cmv2-source-warning">{sourceBindingBuildMessage(binding)}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UniversityVariableMappingPanel({
  workspace,
  aulasState,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const detectedColumns = universityColumnOptions(workspace, aulasState).filter(isUniversityUserFacingColumnName);
  const inspectedColumns = universityInspectedColumnOptions(workspace);
  const suggestionColumns = inspectedColumns.length ? inspectedColumns : detectedColumns;
  const mappedColumns = (workspace.variable_mappings ?? [])
    .map((row) => row.column ?? "")
    .filter((column) => Boolean(column) && isUniversityUserFacingColumnName(column));
  const columns = Array.from(new Set([
    ...(suggestionColumns.length ? suggestionColumns : UNIVERSITY_FALLBACK_COLUMN_OPTIONS),
    ...mappedColumns,
  ]))
    .sort((a, b) => a.localeCompare(b, "es"));
  const mappings = ensureUniversityVariableMappings(workspace.variable_mappings, suggestionColumns);
  const requiredRows = mappings.filter((row) => row.required);
  const mappedRequired = requiredRows.filter((row) => row.column).length;

  function updateMapping(role: string, column: string) {
    onWorkspace({
      ...workspace,
      variable_mappings: mappings.map((item) => (item.role === role ? { ...item, column } : item)),
    });
  }

  return (
    <section className="cmv2-panel cmv2-university-variable-map">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Columnas del estudio</span>
          <strong>Indica qué columna cumple cada función</strong>
        </div>
        <span className="cmv2-pill-soft">{mappedRequired}/{requiredRows.length} necesarias</span>
      </div>
      <div className="cmv2-classroom-note">
        <SlidersHorizontal size={15} />
        <span>Selecciona los encabezados tal como vienen en el Excel. El identificador de estudiante solo sirve para controlar duplicados y cobertura; no aparece en salidas para cliente.</span>
      </div>
      <div className="cmv2-variable-map-table-wrap">
        <table className="cmv2-table cmv2-variable-map-table">
          <thead>
            <tr>
              <th>Dato que necesita el estudio</th>
              <th>Columna del Excel</th>
              <th>Para qué sirve</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((row) => (
              <UniversityVariableMappingRow
                key={row.role}
                row={row}
                columns={columns}
                detectedColumns={suggestionColumns}
                onChange={updateMapping}
              />
            ))}
          </tbody>
        </table>
      </div>
      {!detectedColumns.length && (
        <ClassroomEmptyState
          icon={Database}
          title="Sin columnas detectadas todavía"
          detail="Cuando cargues o construyas el marco, esta tabla podrá proponer columnas automáticamente. Mientras tanto puedes dejar preparado qué datos espera el estudio."
        />
      )}
    </section>
  );
}

function UniversityVariableMappingRow({
  row,
  columns,
  detectedColumns,
  onChange,
}: {
  row: CalcMuestraWorkspaceVariableMapping;
  columns: string[];
  detectedColumns: string[];
  onChange: (role: string, column: string) => void;
}) {
  const suggested = inferUniversityColumn(row.role, detectedColumns);
  const selected = row.column ?? "";
  const otherColumns = columns.filter((column) => column !== suggested);
  const hasSuggestion = Boolean(suggested);
  return (
    <tr>
      <td>
        <strong>{row.label}</strong>
        <small>{row.required ? "Necesaria" : "Opcional útil"}</small>
      </td>
      <td>
        <select value={selected} onChange={(e) => onChange(row.role, e.currentTarget.value)}>
          <option value="">Seleccionar columna</option>
          {hasSuggestion && (
            <optgroup label="Sugerencia">
              <option value={suggested}>{suggested}</option>
            </optgroup>
          )}
          <optgroup label="Todas las columnas">
            {otherColumns.map((column) => (
              <option key={`${row.role}-${column}`} value={column}>{column}</option>
            ))}
          </optgroup>
        </select>
        <span className={`cmv2-variable-suggestion ${hasSuggestion ? "is-ready" : ""}`}>
          {hasSuggestion ? `Coincide con ${suggested}` : "Elige una columna"}
        </span>
      </td>
      <td>{row.description}</td>
      <td><span className={`cmv2-map-status ${selected ? "is-ready" : row.required ? "is-required" : "is-pending"}`}>{selected ? "lista" : row.required ? "falta" : "opcional"}</span></td>
    </tr>
  );
}

function UniversityCategoryMappingPanel({
  workspace,
  aulasState,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const observedRows = universityObservedCategoryRows(workspace, aulasState);
  const groups = observedRows.reduce<Array<{ key: string; variableLabel: string; column: string; sourceRole?: string; unitLabel: string; rows: UniversityObservedCategory[] }>>((acc, row) => {
    const key = `${row.role}::${row.column}`;
    const existing = acc.find((item) => item.key === key);
    if (existing) {
      existing.rows.push(row);
      return acc;
    }
    acc.push({ key, variableLabel: row.variableLabel, column: row.column, sourceRole: row.sourceRole, unitLabel: categoryUnitLabel(row.role, row.unitLabel), rows: [row] });
    return acc;
  }, []);
  const [activeGroupKey, setActiveGroupKey] = useState("");
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null);
  const mappedCategoryVariables = ensureUniversityVariableMappings(workspace.variable_mappings, universityColumnOptions(workspace, aulasState).filter(isUniversityUserFacingColumnName))
    .filter((row) => isUniversityCategoryRole(row.role) && row.column).length;
  const frameReady = Boolean(
    rowsFrom(aulasState?.frame?.population).length ||
    rowsFrom(aulasState?.frame?.aula_frame).length
  );

  function updateCategory(row: UniversityObservedCategory, label: string) {
    onWorkspace({
      ...workspace,
      category_mappings: upsertWorkspaceCategoryValue(workspace.category_mappings, row, label),
    });
  }

  function categoryRowKey(row: UniversityObservedCategory) {
    return `${row.role}::${row.column}::${row.raw}`;
  }

  const effectiveActiveGroupKey = groups.some((group) => group.key === activeGroupKey)
    ? activeGroupKey
    : groups[0]?.key ?? "";
  const selectedGroup = groups.find((group) => group.key === effectiveActiveGroupKey) ?? groups[0] ?? null;
  const selectedRows = selectedGroup?.rows ?? [];
  const selectedEditedCount = selectedRows.filter((row) => row.saved).length;
  const selectedTotalRows = selectedRows.reduce((sum, row) => sum + row.count, 0);
  const selectedCountBase = selectedGroup ? categoryCountBaseLabel(selectedGroup.unitLabel) : "filas con valor";
  const selectedCountDetail = selectedGroup
    ? `Cuenta ${selectedCountBase} en la fuente leída; no es el total final de estudiantes únicos.`
    : "Cuenta valores observados antes de validar la población final.";

  return (
    <section className="cmv2-panel cmv2-university-category-map">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Categorías observadas</span>
          <strong>Revisa el significado de los valores encontrados</strong>
        </div>
        <span className="cmv2-pill-soft">{observedRows.length ? `${observedRows.length} valores` : frameReady ? "sin categorías" : "requiere lectura"}</span>
      </div>
      {observedRows.length ? (
        <div className="cmv2-category-browser">
          <aside className="cmv2-category-variable-pane" aria-label="Variables con categorías observadas">
            <div className="cmv2-category-pane-head">
              <span>Variables</span>
              <strong>{groups.length}</strong>
            </div>
            <div className="cmv2-category-variable-list" role="listbox" aria-label="Variables observadas">
              {groups.map((group) => {
                const active = group.key === effectiveActiveGroupKey;
                const editedCount = group.rows.filter((row) => row.saved).length;
                const totalRows = group.rows.reduce((sum, row) => sum + row.count, 0);
                const unitLabel = group.unitLabel;
                return (
                  <button
                    key={group.key}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`cmv2-category-variable-row ${active ? "is-active" : ""}`}
                    onClick={() => {
                      setActiveGroupKey(group.key);
                      setEditingCategoryKey(null);
                    }}
                  >
                    <span className="cmv2-category-variable-main">
                      <span>
                        <strong>{group.variableLabel}</strong>
                        <small>{sourceRoleLabel(group.sourceRole ?? "") || "Base"}</small>
                      </span>
                      <span className="cmv2-category-variable-meta">
                        <em>{group.rows.length} categorías</em>
                        <em>{fmtInt(totalRows)} {unitLabel}</em>
                        {editedCount > 0 && <em>{editedCount} editadas</em>}
                      </span>
                    </span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </aside>

          {selectedGroup && (
            <article className="cmv2-category-detail-card" aria-label={`Categorías de ${selectedGroup.variableLabel}`}>
              <header className="cmv2-category-detail-head">
                <div>
                  <small>{sourceRoleLabel(selectedGroup.sourceRole ?? "") || "Base"}</small>
                  <strong>{selectedGroup.variableLabel}</strong>
                  <span>{selectedCountDetail}</span>
                </div>
                <em>{selectedGroup.rows.length} categorías</em>
              </header>
              <div className="cmv2-category-detail-summary" aria-label="Resumen de la variable seleccionada">
                <span>
                  <small>Categorías</small>
                  <strong>{selectedGroup.rows.length}</strong>
                </span>
                <span>
                  <small>{categoryCountSummaryLabel(selectedGroup.unitLabel)}</small>
                  <strong>{fmtInt(selectedTotalRows)}</strong>
                </span>
                <span>
                  <small>Base del conteo</small>
                  <strong>{selectedCountBase}</strong>
                </span>
                <span>
                  <small>Editadas</small>
                  <strong>{selectedEditedCount}</strong>
                </span>
              </div>
              <div className="cmv2-category-detail-list">
                {selectedGroup.rows.map((row) => {
                  const rowKey = categoryRowKey(row);
                  const editing = editingCategoryKey === rowKey;
                  return (
                    <div key={rowKey} className={`cmv2-category-detail-row ${editing ? "is-editing" : ""}`}>
                      <span className="cmv2-category-raw">
                        <b>{row.raw}</b>
                        <small>{fmtInt(row.count)} {categoryUnitLabel(row.role, row.unitLabel)}</small>
                      </span>
                      <span className="cmv2-category-meaning">
                        <small>Se leerá como</small>
                        {editing ? (
                          <input
                            autoFocus
                            value={row.label}
                            onChange={(event) => updateCategory(row, event.currentTarget.value)}
                            onBlur={() => setEditingCategoryKey(null)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === "Escape") {
                                event.currentTarget.blur();
                              }
                            }}
                            aria-label={`Lectura para ${row.variableLabel}: ${row.raw}`}
                          />
                        ) : (
                          <strong>{row.label}</strong>
                        )}
                      </span>
                      <button
                        type="button"
                        className={`cmv2-icon-button cmv2-category-edit ${editing ? "is-active" : ""}`}
                        onClick={() => setEditingCategoryKey(editing ? null : rowKey)}
                        title={`Editar lectura de ${row.raw}`}
                        aria-label={`Editar lectura de ${row.raw}`}
                      >
                        <PencilLine size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </article>
          )}
        </div>
      ) : (
        <ClassroomEmptyState
          icon={Table2}
          title={mappedCategoryVariables ? "Lee la base para ver categorías" : "Selecciona columnas categóricas"}
          detail={mappedCategoryVariables
            ? "Cuando la base esté leída, esta pestaña mostrará los valores reales encontrados en sexo, facultad, ciclo, condición, horario o modalidad."
            : "Selecciona columnas para sexo, facultad, ciclo, condición, horario o modalidad. Después verás los valores observados para confirmar qué significa cada uno."}
        />
      )}
    </section>
  );
}

type DescriptiveEmptyState = {
  badge: string;
  title: string;
  detail: string;
  next?: string;
  chips?: string[];
  tone?: "missing" | "waiting" | "optional" | "neutral";
};

function workspaceHasMappedVariable(workspace: CalcMuestraWorkspace, role: string) {
  return (workspace.variable_mappings ?? []).some((row) => row.role === role && Boolean(String(row.column ?? "").trim()));
}

function descriptiveMissingState(
  workspace: CalcMuestraWorkspace,
  config: {
    role: string;
    variable: string;
    source: string;
    hasSource: boolean;
    impact: string;
    next: string;
    optional?: boolean;
  },
): DescriptiveEmptyState {
  const mapped = workspaceHasMappedVariable(workspace, config.role);
  if (!mapped) {
    return {
      badge: config.optional ? "Opcional" : "Falta columna",
      title: `Falta identificar ${config.variable.toLowerCase()}`,
      detail: config.impact,
      next: config.next,
      chips: [config.source, config.variable, config.optional ? "No bloquea" : "Necesario"],
      tone: config.optional ? "optional" : "missing",
    };
  }
  if (!config.hasSource) {
    return {
      badge: "Sin lectura",
      title: `La ${config.source} todavía no está leída`,
      detail: `La columna ${config.variable} está asignada, pero no hay filas procesadas para graficarla.`,
      next: "Construye o vuelve a construir el marco después de revisar la base.",
      chips: [config.source, "Marco pendiente"],
      tone: "waiting",
    };
  }
  return {
    badge: "Sin valores",
    title: `No llegaron valores de ${config.variable.toLowerCase()}`,
    detail: "La columna está asignada, pero quedó vacía o no tuvo valores válidos después de leer el marco.",
    next: "Revisa si la columna elegida corresponde a esa variable o si el filtro de elegibilidad la dejó sin casos.",
    chips: [config.source, "Revisar datos"],
    tone: "waiting",
  };
}

function UniversityDescriptiveDiagnosticsPanel({
  workspace,
  totalComp,
  aulasState,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;
  const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
  const classroomRows = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
  const facultyRows = universityFacultyDiagnosticRows(totalComp, populationRows);
  const sexRows = universityCategoryProfileRows(populationRows, ["sex", "sexo", "genero"], totalComp.marco.estratos ?? [], (value, key) => workspaceCategoryLabel(workspace, "sex", value, key));
  const levelRows = universityCategoryProfileRows(populationRows, ["level", "ciclo", "nivel", "anio"], [], (value, key) => workspaceCategoryLabel(workspace, "level", value, key));
  const sizeRows = universityClassroomSizeRows(classroomRows);
  const teacherRows = universityCategoryProfileRows(classroomRows, ["teacher", "docente", "profesor", "contacto"], []);
  const hasPopulationSource = populationRows.length > 0 || safeNumber(totalComp.marco.marco_validado, 0) > 0 || Boolean(totalComp.marco.estratos?.length);
  const hasClassroomSource = classroomRows.length > 0;
  const emptyStates = {
    faculty: descriptiveMissingState(workspace, {
      role: "faculty",
      variable: "Facultad",
      source: "base principal",
      hasSource: hasPopulationSource,
      impact: "Es necesaria para ordenar dominios, cuotas y cruces por facultad.",
      next: "Revisa Definición > Variables y vincula la columna Facultad.",
    }),
    sex: descriptiveMissingState(workspace, {
      role: "sex",
      variable: "Sexo o género",
      source: "base principal",
      hasSource: hasPopulationSource,
      impact: "Permite auditar cuotas esperadas y composición por facultad.",
      next: "Revisa Definición > Variables y vincula la columna Sexo o género.",
    }),
    level: descriptiveMissingState(workspace, {
      role: "level",
      variable: "Ciclo",
      source: "base principal",
      hasSource: hasPopulationSource,
      optional: true,
      impact: "No bloquea el cálculo, pero ayuda a leer composición académica.",
      next: "Si la base trae ciclo, asígnalo en Definición > Variables.",
    }),
    size: descriptiveMissingState(workspace, {
      role: "eligible_n",
      variable: "Elegibles por aula",
      source: "marco de aulas",
      hasSource: hasClassroomSource,
      impact: "Permite agrupar aulas por tamaño operativo.",
      next: "Construye el marco de aulas o revisa la columna de elegibles.",
    }),
    teacher: descriptiveMissingState(workspace, {
      role: "teacher",
      variable: "Docente o contacto",
      source: "catálogo de aulas",
      hasSource: hasClassroomSource,
      optional: true,
      impact: "No bloquea el cálculo; sirve para preparar agenda y permisos.",
      next: "Si el archivo trae docente o contacto, asígnalo en Definición > Variables.",
    }),
  };
  const facultyDomainCount = Math.max(
    countDistinctByKeys(populationRows, ["faculty", "facultad", "unidad_academica", "escuela"]),
    totalComp.marco.estratos?.length ?? 0,
  );
  const summaryRows = [
    { label: "Estudiantes", value: populationRows.length || safeNumber(totalComp.marco.marco_validado, 0), detail: "filas o marco validado" },
    { label: "Aulas", value: classroomRows.length, detail: "cursos y horarios disponibles" },
    { label: "Facultades", value: facultyDomainCount, detail: "dominios detectados" },
    { label: "Modo", value: workspace.source_mode === "dos_bases" ? "dos bases" : workspace.source_mode === "seleccion_existente" ? "selección previa" : "base principal", detail: "entrada declarada" },
  ];
  return (
    <section className="cmv2-panel cmv2-university-descriptives">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Análisis descriptivo inicial</span>
          <strong>Entiende la estructura antes de calcular</strong>
        </div>
        <span className="cmv2-pill-soft">base y aulas</span>
      </div>
      <div className="cmv2-classroom-stat-grid">
        {summaryRows.map((row) => <Metric key={row.label} label={row.label} value={typeof row.value === "number" ? fmtInt(row.value) : row.value} />)}
      </div>
      <ClassroomFrameDashboard frame={frame} totalComp={totalComp} selection={aulasState?.selection ?? null} workspace={workspace} compact />
      <div className="cmv2-descriptive-grid">
        <DescriptiveBarPanel title="Estudiantes por facultad" rows={facultyRows} empty="Carga la base para ver dominios por facultad." emptyState={emptyStates.faculty} />
        <DescriptiveBarPanel title="Sexo o género" rows={sexRows} empty="Selecciona la columna de sexo o género para ver distribución." emptyState={emptyStates.sex} />
        <DescriptiveBarPanel title="Ciclo" rows={levelRows} empty="Selecciona la columna de ciclo para ver avance académico." emptyState={emptyStates.level} />
        <DescriptiveBarPanel title="Tamaño de aulas" rows={sizeRows} empty="Construye el marco de aulas para ver tamaños." emptyState={emptyStates.size} />
        <DescriptiveBarPanel title="Docentes o contactos" rows={teacherRows} empty="Selecciona la columna de docente o contacto para preparar agenda." emptyState={emptyStates.teacher} />
      </div>
    </section>
  );
}

function UniversityFrameValidationPanel({
  workspace,
  aulasState,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;
  const relation = frameRelationAudit(frame);
  const relationUsed = Boolean(relation.used);
  const status = String(relation.status ?? (frame ? "ok" : "pendiente"));
  const issues = rowsFrom<Record<string, unknown>>(relation.issues);
  const warnings = rowsFrom<string>(frame?.warnings);
  const matchRate = recordNumber(relation, "match_rate_classrooms", Number.NaN);
  const sourceMode = workspace.source_mode ?? "base_madre";
  const sourceBindings = ensureUniversitySourceBindings(sourceMode, workspace.source_bindings);
  const sourceCards = sourceBindings.map((binding) => {
    const compatible = sourceBindingCompatibleForBuild(binding);
    const diagnostic = sourceBindingSelectedDiagnostic(binding);
    return {
      label: sourceRoleLabel(binding.role),
      value: binding.file_name ? sourceBindingSelectedSheet(binding) || "hoja sin elegir" : "archivo pendiente",
      detail: binding.file_name || diagnostic?.role_label || binding.notes || "Declara archivo y pestaña.",
      ready: Boolean(binding.file_id && compatible),
      review: Boolean(binding.file_id && !compatible),
    };
  });
  const relationCards = [
    {
      label: "Coincidencia base-catálogo",
      value: Number.isFinite(matchRate) ? fmtPct(matchRate) : relationUsed ? "sin llave" : "no aplica",
      detail: relationUsed ? "Porcentaje de aulas de la base principal encontradas en el catálogo." : "No se cargó catálogo adicional.",
      state: relationUsed ? status : "ok",
    },
    {
      label: "Aulas emparejadas",
      value: `${fmtInt(recordNumber(relation, "matched_classrooms"))} / ${fmtInt(recordNumber(relation, "base_classrooms"))}`,
      detail: "Aulas comunes entre la base principal y el catálogo de cursos y horarios.",
      state: status,
    },
    {
      label: "Aulas base sin catálogo",
      value: fmtInt(recordNumber(relation, "unmatched_base_classrooms")),
      detail: "Deben revisarse si falta docente, aula, horario o cupo operativo.",
      state: recordNumber(relation, "unmatched_base_classrooms") > 0 ? "revisar" : "ok",
    },
    {
      label: "Catálogo fuera de base",
      value: fmtInt(recordNumber(relation, "catalog_only_classrooms")),
      detail: "No entra al marco; se conserva como contexto si existe.",
      state: recordNumber(relation, "catalog_only_classrooms") > 0 ? "revisar" : "ok",
    },
  ];
  return (
    <section className="cmv2-panel cmv2-frame-validation-panel">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Validación del marco</span>
          <strong>Comprueba que las bases se puedan relacionar antes de calcular</strong>
        </div>
        <span className={`cmv2-frame-status-badge is-${status}`}>{frame ? frameStatusLabel(status) : "pendiente"}</span>
      </div>
      <div className="cmv2-frame-source-grid">
        {sourceCards.map((card) => (
          <article key={card.label} className={card.ready ? "is-ready" : card.review ? "is-review" : "is-pending"}>
            <span>{card.ready ? <CheckCircle2 size={14} /> : <CirclePendingIcon />}</span>
            <div>
              <small>{card.label}</small>
              <strong>{card.value}</strong>
              <em>{card.detail}</em>
            </div>
          </article>
        ))}
      </div>
      {frame ? (
        <>
          <div className="cmv2-classroom-stat-grid">
            <Metric label="Filas leídas" value={fmtInt(frameAuditNumber(frame, "input_rows"))} />
            <Metric label="Población elegible" value={fmtInt(frameAuditNumber(frame, "population_n"))} />
            <Metric label="Aulas detectadas" value={fmtInt(frameAuditNumber(frame, "classroom_n"))} />
            <Metric label="Aulas seleccionables" value={fmtInt(frameAuditNumber(frame, "classroom_included_n"))} />
            <Metric label="Filas excluidas" value={fmtInt(frameAuditNumber(frame, "excluded_rows"))} />
          </div>
          <div className="cmv2-frame-relation-grid">
            {relationCards.map((card) => (
              <article key={card.label} className={`is-${card.state}`}>
                <small>{card.label}</small>
                <strong>{card.value}</strong>
                <span>{card.detail}</span>
              </article>
            ))}
          </div>
          <div className="cmv2-frame-issue-layout">
            <div className="cmv2-frame-issue-list">
              <h4>Hallazgos de relación</h4>
              {issues.length ? issues.map((issue) => (
                <article key={`${classroomRowText(issue, ["code"])}-${classroomRowText(issue, ["title"])}`} className={`is-${classroomRowText(issue, ["severity"]) || "media"}`}>
                  <small>{classroomRowText(issue, ["severity"]) || "revisar"}</small>
                  <strong>{classroomRowText(issue, ["title"])}</strong>
                  <span>{classroomRowText(issue, ["detail"])}</span>
                </article>
              )) : (
                <article className="is-ok">
                  <small>ok</small>
                  <strong>Las bases están relacionadas</strong>
                  <span>No se detectaron problemas de relación o coincidencia en la revisión compacta.</span>
                </article>
              )}
            </div>
            <div className="cmv2-frame-preview-list">
              <h4>Ejemplos para revisar</h4>
              <FramePreviewChips label="Base sin catálogo" values={recordStringList(relation, "unmatched_base_preview")} />
              <FramePreviewChips label="Solo en catálogo" values={recordStringList(relation, "catalog_only_preview")} />
              <FramePreviewChips label="Códigos duplicados" values={recordStringList(relation, "duplicate_catalog_preview")} />
            </div>
          </div>
          {warnings.length > 0 && (
            <div className="cmv2-frame-warning-list">
              {warnings.map((warning) => <span key={warning}>{warning}</span>)}
            </div>
          )}
        </>
      ) : (
        <ClassroomEmptyState
          icon={Database}
          title="Construye el marco para validar relaciones"
          detail="En el paso Definición carga la base principal y, si existe, el catálogo de cursos y horarios. Luego esta vista mostrará coincidencias, exclusiones y alertas."
        />
      )}
    </section>
  );
}

function UniversityFrameStructurePanel({
  workspace,
  totalComp,
  aulasState,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;
  const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
  const classroomRows = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
  const includedClassrooms = classroomRows.filter((row) => classroomRowBoolean(row, "included"));
  const usableClassrooms = includedClassrooms.length ? includedClassrooms : classroomRows;
  const exclusionRows = rowsFrom<Record<string, unknown>>(frame?.exclusions);
  const inputRows = frameAuditNumber(frame, "input_rows");
  const eligibleRows = frameAuditNumber(frame, "eligible_student_rows");
  const populationN = Math.max(populationRows.length, frameAuditNumber(frame, "population_n"));
  const classroomN = classroomRows.length || frameAuditNumber(frame, "classroom_n");
  const classroomIncludedN = usableClassrooms.length || frameAuditNumber(frame, "classroom_included_n");
  const excludedN = exclusionRows.length || frameAuditNumber(frame, "excluded_rows");
  const eligibleShare = inputRows > 0 ? eligibleRows / inputRows : Number.NaN;
  const labelFor = (role: string): CategoryLabeler => (value, key) => workspaceCategoryLabel(workspace, role, value, key);
  const facultyRows = universityFacultyDiagnosticRows(totalComp, populationRows);
  const sexRows = universityCategoryProfileRows(populationRows, ["sex", "sexo", "genero"], totalComp.marco.estratos ?? [], labelFor("sex"));
  const levelRows = universityCategoryProfileRows(populationRows, ["level", "ciclo", "nivel", "anio"], [], labelFor("level"));
  const modalityRows = universityCategoryProfileRows(usableClassrooms, ["modality", "modalidad"], [], labelFor("modality"));
  const sizeRows = universityClassroomSizeRows(usableClassrooms);
  const teacherRows = universityCategoryProfileRows(usableClassrooms, ["teacher", "docente", "profesor", "contacto"], []);
  const exclusionProfile = summarizeRowsByKeys(exclusionRows, ["exclude_reason", "motivo", "reason"]);
  const hasPopulationSource = populationRows.length > 0 || safeNumber(totalComp.marco.marco_validado, 0) > 0 || Boolean(totalComp.marco.estratos?.length);
  const hasClassroomSource = usableClassrooms.length > 0 || classroomRows.length > 0;
  const emptyStates = {
    faculty: descriptiveMissingState(workspace, {
      role: "faculty",
      variable: "Facultad",
      source: "base principal",
      hasSource: hasPopulationSource,
      impact: "Es necesaria para leer distribución del universo y cuotas.",
      next: "Revisa Definición > Variables y vincula la columna Facultad.",
    }),
    sex: descriptiveMissingState(workspace, {
      role: "sex",
      variable: "Sexo o género",
      source: "base principal",
      hasSource: hasPopulationSource,
      impact: "Permite auditar cuotas y balance esperado.",
      next: "Revisa Definición > Variables y vincula la columna Sexo o género.",
    }),
    level: descriptiveMissingState(workspace, {
      role: "level",
      variable: "Ciclo",
      source: "base principal",
      hasSource: hasPopulationSource,
      optional: true,
      impact: "No bloquea el cálculo, pero mejora la lectura académica del marco.",
      next: "Si existe ciclo, asígnalo en Definición > Variables.",
    }),
    modality: descriptiveMissingState(workspace, {
      role: "modality",
      variable: "Modalidad",
      source: "catálogo de aulas",
      hasSource: hasClassroomSource,
      optional: true,
      impact: "Ayuda a distinguir aulas presenciales, virtuales o híbridas.",
      next: "Si existe modalidad, asígnala en Definición > Variables.",
    }),
    size: descriptiveMissingState(workspace, {
      role: "eligible_n",
      variable: "Elegibles por aula",
      source: "marco de aulas",
      hasSource: hasClassroomSource,
      impact: "Permite agrupar aulas por tamaño operativo.",
      next: "Construye el marco de aulas o revisa la columna de elegibles.",
    }),
    teacher: descriptiveMissingState(workspace, {
      role: "teacher",
      variable: "Docente o contacto",
      source: "catálogo de aulas",
      hasSource: hasClassroomSource,
      optional: true,
      impact: "No bloquea el cálculo; sirve para agenda, permisos y monitoreo.",
      next: "Si existe docente o contacto, asígnalo en Definición > Variables.",
    }),
    exclusions: {
      badge: "Sin exclusiones",
      title: "No hay exclusiones visibles",
      detail: "Puede estar bien: significa que no se aplicó un filtro de exclusión o que ninguna fila fue excluida.",
      chips: ["Auditoría", "No bloquea"],
      tone: "neutral" as const,
    },
  };

  return (
    <section className="cmv2-panel cmv2-frame-structure-panel">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Estructura del marco</span>
          <strong>Lee universo, población elegible y aulas de aplicación</strong>
        </div>
        <span className="cmv2-pill-soft">{workspace.source_mode === "dos_bases" ? "base + catálogo" : "base institucional"}</span>
      </div>
      {frame ? (
        <>
          <div className="cmv2-frame-universe-strip">
            <Metric label="Universo leído" value={fmtInt(inputRows)} />
            <Metric label="Filas elegibles" value={fmtInt(eligibleRows)} />
            <Metric label="Elegibilidad" value={Number.isFinite(eligibleShare) ? fmtPct(eligibleShare) : "pendiente"} />
            <Metric label="Estudiantes únicos" value={fmtInt(populationN)} />
            <Metric label="Aulas detectadas" value={fmtInt(classroomN)} />
            <Metric label="Aulas válidas" value={fmtInt(classroomIncludedN)} />
            <Metric label="Exclusiones" value={fmtInt(excludedN)} />
          </div>
          <div className="cmv2-frame-narrative-grid">
            <article>
              <small>Lectura de población</small>
              <strong>{fmtInt(populationN)} estudiantes únicos elegibles</strong>
              <span>El cálculo muestral representa estudiantes; el selector opera sobre aulas, cursos y horarios.</span>
            </article>
            <article>
              <small>Lectura de aulas</small>
              <strong>{fmtInt(classroomIncludedN)} aulas seleccionables</strong>
              <span>El mínimo de elegibles por aula y la modalidad definen qué aulas pasan al marco operativo.</span>
            </article>
            <article>
              <small>Elegibilidad aplicada</small>
              <strong>{(normalizeUniversityAulasConfig(workspace.aulas_config).accepted_conditions ?? ["regular"]).join(" · ")}</strong>
              <span>Las exclusiones quedan auditadas; no desaparecen del diagnóstico del universo.</span>
            </article>
          </div>
          <ClassroomFrameDashboard frame={frame} totalComp={totalComp} selection={aulasState?.selection ?? null} workspace={workspace} />
          <div className="cmv2-descriptive-grid cmv2-frame-descriptive-grid">
            <DescriptiveBarPanel title="Población por facultad" rows={facultyRows} empty="Selecciona la columna de facultad para ver la distribución del universo." emptyState={emptyStates.faculty} />
            <DescriptiveBarPanel title="Población por sexo" rows={sexRows} empty="Selecciona la columna de sexo o género para auditar cuotas." emptyState={emptyStates.sex} />
            <DescriptiveBarPanel title="Ciclo" rows={levelRows} empty="Selecciona la columna de ciclo para ver composición académica." emptyState={emptyStates.level} />
            <DescriptiveBarPanel title="Modalidad de aulas" rows={modalityRows} empty="Selecciona la columna de modalidad para revisar presencialidad." emptyState={emptyStates.modality} />
            <DescriptiveBarPanel title="Tamaño de aulas" rows={sizeRows} empty="Construye el marco de aulas para ver tamaños." emptyState={emptyStates.size} />
            <DescriptiveBarPanel title="Docentes o contactos" rows={teacherRows} empty="Selecciona la columna de docente o contacto para preparar agenda." emptyState={emptyStates.teacher} />
            <DescriptiveBarPanel title="Motivos de exclusión" rows={exclusionProfile} empty="Sin exclusiones visibles o filtro todavía no aplicado." emptyState={emptyStates.exclusions} />
          </div>
        </>
      ) : (
        <ClassroomEmptyState
          icon={BarChart3}
          title="El diagnóstico aparecerá después de construir el marco"
          detail="Primero carga la base y mapea variables. Luego Prosecnur mostrará universo total, elegibles, exclusiones, aulas y docentes detectados."
        />
      )}
    </section>
  );
}

function UniversityFrameCrossesPanel({
  workspace,
  totalComp,
  aulasState,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;
  const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
  const classroomRows = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
  const labelFor = (role: string): CategoryLabeler => (value, key) => workspaceCategoryLabel(workspace, role, value, key);
  const facultySex = universityFacultySexCross(totalComp, populationRows, workspace);
  const facultyLevel = buildCrossTable(populationRows, ["faculty", "facultad", "unidad_academica"], ["level", "nivel", "ciclo", "anio"], 10, 99, { primary: labelFor("faculty"), secondary: labelFor("level"), rowSort: "faculty", columnSort: "ordinal" });
  const facultySize = buildCrossTable(classroomRows, ["faculty", "facultad", "unidad_academica"], ["size_group"], 10, 6, { rowSort: "faculty", columnSort: "ordinal" });
  const crossCards = [
    {
      label: "Cuotas de población",
      value: facultySex.rows.length ? "sexo por facultad listo" : "falta sexo o facultad",
      detail: "Sirve para revisar si cada facultad tiene una composición esperada antes de calcular cuotas.",
      ready: facultySex.rows.length > 0,
    },
    {
      label: "Estructura académica",
      value: facultyLevel.rows.length ? "ciclo por facultad listo" : "falta ciclo o nivel",
      detail: "Ayuda a detectar concentraciones por ciclo cuando el marco trae esa columna.",
      ready: facultyLevel.rows.length > 0,
    },
    {
      label: "Capacidad de aulas",
      value: facultySize.rows.length ? "tamaño por facultad listo" : "requiere aulas válidas",
      detail: "Muestra si una facultad tiene aulas pequeñas, medianas o grandes para sostener reemplazos.",
      ready: facultySize.rows.length > 0,
    },
  ];
  return (
    <section className="cmv2-panel cmv2-frame-cross-panel">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Cruces del marco</span>
          <strong>Ubica brechas antes de fijar cuotas y seleccionar aulas</strong>
        </div>
        <span className="cmv2-pill-soft">tablas + mapa de calor</span>
      </div>
      {frame || totalComp.marco.estratos?.length ? (
        <>
          <div className="cmv2-cross-brief-grid" aria-label="Lectura guiada de cruces del marco">
            {crossCards.map((card) => (
              <article key={card.label} className={card.ready ? "is-ready" : "is-working"}>
                <small>{card.label}</small>
                <strong>{card.value}</strong>
                <span>{card.detail}</span>
              </article>
            ))}
          </div>
          <div className="cmv2-cross-grid">
            <CrossTablePanel title="Facultad por sexo" subtitle="estudiantes únicos elegibles" table={facultySex} />
            <CrossTablePanel title="Facultad por ciclo/nivel" subtitle="estructura académica" table={facultyLevel} />
            <CrossTablePanel title="Facultad por tamaño de aula" subtitle="aulas seleccionables" table={facultySize} />
          </div>
        </>
      ) : (
        <ClassroomEmptyState
          icon={Grid3X3}
          title="Los cruces necesitan marco o estratos"
          detail="Cuando exista una base leída, esta pestaña mostrará qué facultades concentran población, ciclos, horarios y tamaños de aula."
        />
      )}
    </section>
  );
}

function FramePreviewChips({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <small>{label}</small>
      <p>
        {values.length ? values.map((value) => <span key={value}>{value}</span>) : <em>Sin casos en la muestra de revisión</em>}
      </p>
    </div>
  );
}

type CrossTable = {
  columns: string[];
  rows: Array<{ label: string; total: number; values: Record<string, number> }>;
};

type ClassroomSexCompositionRow = {
  id: string;
  label: string;
  detail: string;
  total: number;
  segments: Array<{ label: string; value: number; kind: "male" | "female" | "other" | "missing" }>;
};

const UNIVERSITY_FACULTY_ROW_KEYS = ["faculty", "facultad", "unidad_academica", "escuela", "stratum"];
const UNIVERSITY_STUDENT_ROW_KEYS = [
  "student_id",
  "studentid",
  "codigo_pucp",
  "Código PUCP",
  "codigopucp",
  "codigoestudiante",
  "codigo_estudiante",
  "cod_alumno",
  "id_alumno",
  "codigo",
];

type CrossTableSortMode = "total" | "label" | "ordinal" | "faculty";
type ClassroomDashboardScope = "poblacion" | "aulas" | "seleccion";
type CrossTableOptions = {
  primary?: CategoryLabeler;
  secondary?: CategoryLabeler;
  rowSort?: CrossTableSortMode;
  columnSort?: CrossTableSortMode;
};

function compareLabels(a: string, b: string) {
  return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
}

function leadingOrdinal(value: string) {
  const match = String(value ?? "").trim().match(/^(\d+(?:[.,]\d+)?)/);
  if (!match) return Number.NaN;
  return Number(match[1].replace(",", "."));
}

function compareOrdinalLabels(a: string, b: string) {
  const aOrdinal = leadingOrdinal(a);
  const bOrdinal = leadingOrdinal(b);
  const aHasOrdinal = Number.isFinite(aOrdinal);
  const bHasOrdinal = Number.isFinite(bOrdinal);
  if (aHasOrdinal && bHasOrdinal && aOrdinal !== bOrdinal) return aOrdinal - bOrdinal;
  if (aHasOrdinal !== bHasOrdinal) return aHasOrdinal ? -1 : 1;
  return compareLabels(a, b);
}

function universityFacultyPriority(label: string) {
  const key = normalizeUniversityLabel(label).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const explicitOrdinal = leadingOrdinal(label);
  if (Number.isFinite(explicitOrdinal)) return explicitOrdinal;
  if (key.includes("estudiosgeneralesciencias")) return 0;
  if (key.includes("estudiosgeneralesletras")) return 1;
  if (key.includes("estudiosgenerales")) return 2;
  return 100;
}

function compareUniversityFacultyLabels(a: string, b: string) {
  const priority = universityFacultyPriority(a) - universityFacultyPriority(b);
  return priority || compareLabels(a, b);
}

function compareCrossTableRows(
  a: { label: string; total: number },
  b: { label: string; total: number },
  mode: CrossTableSortMode = "total",
) {
  if (mode === "faculty") return compareUniversityFacultyLabels(a.label, b.label);
  if (mode === "ordinal") return compareOrdinalLabels(a.label, b.label);
  if (mode === "label") return compareLabels(a.label, b.label);
  return b.total - a.total || compareLabels(a.label, b.label);
}

function compareCrossTableColumns(
  a: { column: string; total: number },
  b: { column: string; total: number },
  mode: CrossTableSortMode = "total",
) {
  if (mode === "faculty") return compareUniversityFacultyLabels(a.column, b.column);
  if (mode === "ordinal") return compareOrdinalLabels(a.column, b.column);
  if (mode === "label") return compareLabels(a.column, b.column);
  return b.total - a.total || compareLabels(a.column, b.column);
}

function compareDescriptiveRows(a: DescriptiveBarRow, b: DescriptiveBarRow, mode: CrossTableSortMode = "total") {
  return compareCrossTableRows(
    { label: a.label, total: a.value },
    { label: b.label, total: b.value },
    mode,
  );
}

function sexLabelKind(label: string): "male" | "female" | null {
  const key = normalizeUniversityLabel(label).toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!key) return null;
  if (["m", "male", "masculino", "h", "hombre", "hombres", "varon", "varones"].includes(key)) return "male";
  if (key.includes("hombre") || key.includes("masculino") || key.includes("varon")) return "male";
  if (["f", "female", "femenino", "mujer", "mujeres"].includes(key)) return "female";
  if (key.includes("mujer") || key.includes("femenino") || key.includes("female")) return "female";
  return null;
}

function sexColumnPriority(column: string) {
  const kind = sexLabelKind(column);
  if (kind === "male") return 0;
  if (kind === "female") return 1;
  return 2;
}

function sortedSexColumns(columns: string[]) {
  return [...columns].sort((a, b) => sexColumnPriority(a) - sexColumnPriority(b) || compareLabels(a, b));
}

function sexRowValue(row: CrossTable["rows"][number], kind: "male" | "female") {
  return Object.entries(row.values).reduce((sum, [column, value]) => (
    sexLabelKind(column) === kind ? sum + safeNumber(value, 0) : sum
  ), 0);
}

function sortSexTableByMaleSurplus(table: CrossTable): CrossTable {
  const columns = sortedSexColumns(table.columns);
  const rows = [...table.rows]
    .sort((a, b) => {
      const aMale = sexRowValue(a, "male");
      const bMale = sexRowValue(b, "male");
      const aFemale = sexRowValue(a, "female");
      const bFemale = sexRowValue(b, "female");
      const aTotal = Math.max(a.total, aMale + aFemale, 1);
      const bTotal = Math.max(b.total, bMale + bFemale, 1);
      const aScore = (aMale - aFemale) / aTotal;
      const bScore = (bMale - bFemale) / bTotal;
      return bScore - aScore || bMale - aMale || b.total - a.total || compareUniversityFacultyLabels(a.label, b.label);
    })
    .map((row) => ({
      ...row,
      values: Object.fromEntries(columns.map((column) => [column, row.values[column] ?? 0])),
    }));
  return { columns, rows };
}

function dashboardOptionKey(value: string) {
  return normalizeUniversityLabel(value);
}

function rowCategoryLabel(
  row: Record<string, unknown>,
  keys: string[],
  role: string,
  workspace?: CalcMuestraWorkspace,
) {
  const raw = firstRowValue(row, keys);
  return raw ? workspaceCategoryLabel(workspace, role, raw) : "";
}

function rowMatchesFaculty(row: Record<string, unknown>, faculty: string, workspace?: CalcMuestraWorkspace) {
  if (faculty === "general") return true;
  const label = rowCategoryLabel(row, UNIVERSITY_FACULTY_ROW_KEYS, "faculty", workspace);
  return label ? dashboardOptionKey(label) === dashboardOptionKey(faculty) : false;
}

function rowsForFaculty<T extends Record<string, unknown>>(
  rows: T[],
  faculty: string,
  workspace?: CalcMuestraWorkspace,
) {
  if (faculty === "general") return rows;
  return rows.filter((row) => rowMatchesFaculty(row, faculty, workspace));
}

function sumRowsByKeys(rows: Array<Record<string, unknown>>, keys: string[]) {
  return rows.reduce((sum, row) => sum + classroomRowNumber(row, keys), 0);
}

function facultyOptionsForDashboard(
  totalComp: CalcMuestraComponente,
  rowGroups: Array<Array<Record<string, unknown>>>,
  workspace?: CalcMuestraWorkspace,
) {
  const byKey = new Map<string, string>();
  (totalComp.marco.estratos ?? []).forEach((estrato) => {
    const label = workspaceCategoryLabel(workspace, "faculty", estrato.label);
    if (label) byKey.set(dashboardOptionKey(label), label);
  });
  rowGroups.flat().forEach((row) => {
    const label = rowCategoryLabel(row, UNIVERSITY_FACULTY_ROW_KEYS, "faculty", workspace);
    if (label) byKey.set(dashboardOptionKey(label), label);
  });
  return Array.from(byKey.values()).sort(compareUniversityFacultyLabels);
}

function CrossTablePanel({ title, subtitle, table }: { title: string; subtitle: string; table: CrossTable }) {
  const max = table.rows.reduce((peak, row) => Math.max(peak, ...table.columns.map((column) => row.values[column] ?? 0)), 0) || 1;
  return (
    <article className="cmv2-cross-panel">
      <header>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <em>{table.rows.length ? `${fmtInt(table.rows.reduce((sum, row) => sum + row.total, 0))} registros` : "pendiente"}</em>
      </header>
      {table.rows.length && table.columns.length ? (
        <div className="cmv2-cross-table-wrap">
          <table className="cmv2-cross-table">
            <thead>
              <tr>
                <th>Dominio</th>
                {table.columns.map((column) => <th key={column}>{column}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  {table.columns.map((column) => {
                    const value = row.values[column] ?? 0;
                    return (
                      <td key={`${row.label}-${column}`} style={{ ["--heat" as string]: value / max }}>
                        <span>{value ? fmtInt(value) : "—"}</span>
                      </td>
                    );
                  })}
                  <td><strong>{fmtInt(row.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Selecciona las columnas necesarias para ver este cruce.</p>
      )}
    </article>
  );
}

function classroomPlotLayout(extra: Record<string, unknown> = {}) {
  return {
    margin: { t: 12, r: 14, b: 40, l: 112 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { family: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", size: 11, color: "#475569" },
    xaxis: { fixedrange: true, zeroline: false, gridcolor: "#eef3f8", automargin: true },
    yaxis: { fixedrange: true, zeroline: false, gridcolor: "#f4f7fb", automargin: true },
    hoverlabel: { bgcolor: "#ffffff", bordercolor: "#dbe5ef", font: { color: "#1f2937" } },
    ...extra,
  };
}

function classroomPlotConfig() {
  return { displayModeBar: false, responsive: true };
}

function weightedDistributionRows(
  rows: Array<Record<string, unknown>>,
  keys: string[],
  weightKeys: string[] = [],
  maxRows = 12,
  labelFor?: CategoryLabeler,
  sortMode: CrossTableSortMode = "total",
): DescriptiveBarRow[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const rawLabel = firstRowValue(row, keys);
    const label = rawLabel ? (labelFor ? labelFor(rawLabel) : rawLabel) : "";
    if (!label) return;
    const weight = weightKeys.length ? classroomRowNumber(row, weightKeys) : 1;
    counts.set(label, (counts.get(label) ?? 0) + (Number.isFinite(weight) && weight > 0 ? weight : 1));
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => compareDescriptiveRows(a, b, sortMode))
    .slice(0, maxRows);
}

function classroomSexRowsFromAulas(rows: Array<Record<string, unknown>>, maxRows = 4, labelFor?: CategoryLabeler): DescriptiveBarRow[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const top1Raw = classroomRowText(row, ["sex_top_1", "sexo_top_1"]);
    const top1N = classroomRowNumber(row, ["sex_top_1_n", "sexo_top_1_n"]);
    const top2Raw = classroomRowText(row, ["sex_top_2", "sexo_top_2"]);
    const top2N = classroomRowNumber(row, ["sex_top_2_n", "sexo_top_2_n"]);
    const top1 = top1Raw ? (labelFor ? labelFor(top1Raw) : top1Raw) : "";
    const top2 = top2Raw ? (labelFor ? labelFor(top2Raw) : top2Raw) : "";
    if (top1 && top1N > 0) counts.set(top1, (counts.get(top1) ?? 0) + top1N);
    if (top2 && top2N > 0) counts.set(top2, (counts.get(top2) ?? 0) + top2N);
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, maxRows);
}

function classroomSexCompositionRowsFromAulas(
  rows: Array<Record<string, unknown>>,
  workspace?: CalcMuestraWorkspace,
  maxRows = 12,
): ClassroomSexCompositionRow[] {
  return rows
    .map((row, index) => {
      const counts = new Map<string, number>();
      [
        [classroomRowText(row, ["sex_top_1", "sexo_top_1"]), classroomRowNumber(row, ["sex_top_1_n", "sexo_top_1_n"])],
        [classroomRowText(row, ["sex_top_2", "sexo_top_2"]), classroomRowNumber(row, ["sex_top_2_n", "sexo_top_2_n"])],
      ].forEach(([rawLabel, rawValue]) => {
        const label = String(rawLabel ?? "").trim();
        const value = safeNumber(rawValue, 0);
        if (!label || value <= 0) return;
        const display = workspaceCategoryLabel(workspace, "sex", label);
        counts.set(display, (counts.get(display) ?? 0) + value);
      });
      const knownTotal = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
      const eligibleTotal = classroomRowNumber(row, ["eligible_n", "elegibles", "students_n", "matriculados_poblacion", "enrolled_total", "total"]);
      const total = Math.max(knownTotal, eligibleTotal);
      if (total > knownTotal) counts.set("Sin dato", total - knownTotal);
      const faculty = rowCategoryLabel(row, ["faculty", "facultad", "unidad_academica", "stratum"], "faculty", workspace);
      const program = rowCategoryLabel(row, ["program", "programa", "career", "carrera", "especialidad"], "program", workspace);
      const level = rowCategoryLabel(row, ["level", "nivel", "nivel_del_curso", "ciclo"], "level", workspace);
      const classroomId = classroomRowText(row, ["classroom_id", "course_schedule_id", "nrc", "codigo_aula"]);
      const label = classroomRowText(row, ["course_name", "curso", "label", "classroom_label", "aula", "classroom_id"]) || `Aula ${index + 1}`;
      const detail = [faculty, program, level ? `ciclo ${level}` : "", classroomId && classroomId !== label ? classroomId : ""].filter(Boolean).join(" · ");
      const segments = sortedSexColumns(Array.from(counts.keys()))
        .map((label) => {
          const kind: ClassroomSexCompositionRow["segments"][number]["kind"] = sexLabelKind(label) ?? (label === "Sin dato" ? "missing" : "other");
          return { label, value: counts.get(label) ?? 0, kind };
        })
        .filter((segment) => segment.value > 0);
      return {
        id: classroomId || `${label}-${index}`,
        label,
        detail,
        total,
        segments,
      };
    })
    .filter((row) => row.total > 0 && row.segments.length)
    .sort((a, b) => b.total - a.total || compareLabels(a.label, b.label))
    .slice(0, maxRows);
}

function buildWeightedCrossTable(
  rows: Array<Record<string, unknown>>,
  primaryKeys: string[],
  secondaryKeys: string[],
  weightKeys: string[] = [],
  maxRows = 10,
  maxColumns = 8,
  options?: CrossTableOptions,
): CrossTable {
  const counts = new Map<string, Map<string, number>>();
  rows.forEach((row) => {
    const primaryRaw = firstRowValue(row, primaryKeys);
    const secondaryRaw = firstRowValue(row, secondaryKeys);
    const primary = primaryRaw ? (options?.primary ? options.primary(primaryRaw) : primaryRaw) : "";
    const secondary = secondaryRaw ? (options?.secondary ? options.secondary(secondaryRaw) : secondaryRaw) : "";
    if (!primary || !secondary) return;
    const weight = weightKeys.length ? classroomRowNumber(row, weightKeys) : 1;
    const current = counts.get(primary) ?? new Map<string, number>();
    current.set(secondary, (current.get(secondary) ?? 0) + (Number.isFinite(weight) && weight > 0 ? weight : 1));
    counts.set(primary, current);
  });
  const rowsOut = Array.from(counts.entries())
    .map(([label, valuesMap]) => ({
      label,
      values: Object.fromEntries(valuesMap.entries()),
      total: Array.from(valuesMap.values()).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => compareCrossTableRows(a, b, options?.rowSort))
    .slice(0, maxRows);
  const columns = Array.from(new Set(rowsOut.flatMap((row) => Object.keys(row.values))))
    .map((column) => ({
      column,
      total: rowsOut.reduce((sum, row) => sum + (row.values[column] ?? 0), 0),
    }))
    .sort((a, b) => compareCrossTableColumns(a, b, options?.columnSort))
    .slice(0, maxColumns)
    .map((item) => item.column);
  return {
    columns,
    rows: rowsOut.map((row) => ({
      ...row,
      values: Object.fromEntries(columns.map((column) => [column, row.values[column] ?? 0])),
    })),
  };
}

function classroomFacultySexCross(
  totalComp: CalcMuestraComponente,
  populationRows: Array<Record<string, unknown>>,
  classroomRows: Array<Record<string, unknown>>,
  workspace?: CalcMuestraWorkspace,
): CrossTable {
  const fromPopulation = universityFacultySexCross(totalComp, populationRows, workspace);
  if (fromPopulation.rows.length) return fromPopulation;
  const counts = new Map<string, Map<string, number>>();
  classroomRows.forEach((row) => {
    const rawFaculty = firstRowValue(row, ["faculty", "facultad", "unidad_academica", "stratum"]);
    const faculty = rawFaculty ? workspaceCategoryLabel(workspace, "faculty", rawFaculty) : "";
    if (!faculty) return;
    const current = counts.get(faculty) ?? new Map<string, number>();
    [
      [classroomRowText(row, ["sex_top_1", "sexo_top_1"]), classroomRowNumber(row, ["sex_top_1_n", "sexo_top_1_n"])],
      [classroomRowText(row, ["sex_top_2", "sexo_top_2"]), classroomRowNumber(row, ["sex_top_2_n", "sexo_top_2_n"])],
    ].forEach(([label, value]) => {
      const rawKey = String(label ?? "").trim();
      const key = rawKey ? workspaceCategoryLabel(workspace, "sex", rawKey) : "";
      const n = safeNumber(value, 0);
      if (key && n > 0) current.set(key, (current.get(key) ?? 0) + n);
    });
    if (current.size) counts.set(faculty, current);
  });
  const rows = Array.from(counts.entries())
    .map(([label, valuesMap]) => ({
      label,
      values: Object.fromEntries(valuesMap.entries()),
      total: Array.from(valuesMap.values()).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => compareCrossTableRows(a, b, "faculty"))
    .slice(0, 12);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row.values)))).slice(0, 4);
  return {
    columns,
    rows: rows.map((row) => ({
      ...row,
      values: Object.fromEntries(columns.map((column) => [column, row.values[column] ?? 0])),
    })),
  };
}

function ClassroomPlotCard({
  title,
  subtitle,
  empty,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  empty?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={`cmv2-plot-card ${wide ? "is-wide" : ""}`}>
      <header>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </header>
      {children || <p>{empty ?? "Sin datos suficientes para graficar."}</p>}
    </article>
  );
}

type ClassroomFunnelStep = {
  label: string;
  value: number;
  detail: string;
  unit?: string;
  compareToBase?: boolean;
};

function ClassroomFunnelStrip({ title, steps }: { title: string; steps: ClassroomFunnelStep[] }) {
  const base = steps.find((step) => step.value > 0)?.value ?? 0;
  return (
    <section className="cmv2-dashboard-funnel" aria-label={title}>
      <header>
        <span className="cmv2-eyebrow">{title}</span>
        <strong>{steps.length ? steps[steps.length - 1].detail : "Marco pendiente"}</strong>
      </header>
      <div className="cmv2-dashboard-funnel-steps">
        {steps.map((step, index) => {
          const comparable = index === 0 || step.compareToBase;
          const pct = comparable ? (index === 0 ? 1 : safeShare(step.value, base)) : 1;
          return (
            <div key={step.label} className="cmv2-dashboard-funnel-step">
              <span>{step.label}</span>
              <strong>{Number.isFinite(step.value) && step.value > 0 ? fmtInt(step.value) : "pendiente"}</strong>
              <div aria-hidden="true"><i style={{ width: `${Math.max(5, (Number.isFinite(pct) ? Math.min(1, pct) : 0) * 100)}%` }} /></div>
              <small>{index === 0 ? step.unit ?? "base" : comparable && Number.isFinite(pct) ? `${fmtStackPct(pct)} de la base` : step.unit ?? "sin proporción"}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type ClassroomInsight = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "good" | "warn" | "info";
  icon?: typeof Database;
};

function ClassroomInsightGrid({ items }: { items: ClassroomInsight[] }) {
  return (
    <section className="cmv2-dashboard-insights" aria-label="Lecturas del marco">
      {items.map((item) => {
        const Icon = item.icon ?? Gauge;
        return (
          <article key={item.label} className={`is-${item.tone ?? "neutral"}`}>
            <span aria-hidden="true"><Icon size={15} /></span>
            <div>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <em>{item.detail}</em>
            </div>
          </article>
        );
      })}
    </section>
  );
}

type ClassroomDualShareRow = {
  label: string;
  primary: number;
  secondary: number;
};

function dualShareRows(
  primaryRows: DescriptiveBarRow[],
  secondaryRows: DescriptiveBarRow[],
  maxRows = 10,
): ClassroomDualShareRow[] {
  const byKey = new Map<string, ClassroomDualShareRow>();
  primaryRows.forEach((row) => {
    const key = dashboardOptionKey(row.label);
    byKey.set(key, { label: row.label, primary: row.value, secondary: 0 });
  });
  secondaryRows.forEach((row) => {
    const key = dashboardOptionKey(row.label);
    const current = byKey.get(key) ?? { label: row.label, primary: 0, secondary: 0 };
    current.secondary = row.value;
    byKey.set(key, current);
  });
  return Array.from(byKey.values())
    .filter((row) => row.primary > 0 || row.secondary > 0)
    .sort((a, b) => (b.primary + b.secondary) - (a.primary + a.secondary) || compareUniversityFacultyLabels(a.label, b.label))
    .slice(0, maxRows);
}

function ClassroomDualSharePlot({
  rows,
  primaryLabel,
  secondaryLabel,
  emptyState,
}: {
  rows: ClassroomDualShareRow[];
  primaryLabel: string;
  secondaryLabel: string;
  emptyState?: DescriptiveEmptyState;
}) {
  const visible = rows.slice(0, 10);
  if (!visible.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para comparar.</p>;
  const primaryTotal = visible.reduce((sum, row) => sum + row.primary, 0);
  const secondaryTotal = visible.reduce((sum, row) => sum + row.secondary, 0);
  return (
    <div className="cmv2-dual-share-plot" role="img" aria-label={`${primaryLabel} comparado con ${secondaryLabel}`}>
      <div className="cmv2-native-legend">
        <span><i style={{ background: "var(--cmv2-accent)" }} />{primaryLabel}</span>
        <span><i style={{ background: "#0f766e" }} />{secondaryLabel}</span>
      </div>
      <div className="cmv2-dual-share-rows">
        {visible.map((row) => {
          const primaryPct = safeShare(row.primary, primaryTotal);
          const secondaryPct = safeShare(row.secondary, secondaryTotal);
          const gap = Math.abs((Number.isFinite(primaryPct) ? primaryPct : 0) - (Number.isFinite(secondaryPct) ? secondaryPct : 0));
          return (
            <div key={row.label} className="cmv2-dual-share-row">
              <span>{row.label}</span>
              <div>
                <i style={{ width: `${Math.max(2, (Number.isFinite(primaryPct) ? primaryPct : 0) * 100)}%` }} />
                <b style={{ width: `${Math.max(2, (Number.isFinite(secondaryPct) ? secondaryPct : 0) * 100)}%` }} />
              </div>
              <strong>{fmtStackPct(gap)}</strong>
            </div>
          );
        })}
      </div>
      <footer>La cifra final muestra la brecha absoluta entre participación poblacional y exposición operativa.</footer>
    </div>
  );
}

function ClassroomHistogramPlot({
  rows,
  ariaLabel,
  unit = "aulas",
  emptyState,
}: {
  rows: DescriptiveBarRow[];
  ariaLabel: string;
  unit?: string;
  emptyState?: DescriptiveEmptyState;
}) {
  const visible = rows.filter((row) => row.value > 0);
  if (!visible.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  const max = visible.reduce((peak, row) => Math.max(peak, row.value), 0) || 1;
  const total = visible.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="cmv2-size-histogram" role="img" aria-label={ariaLabel}>
      {visible.map((row) => {
        const pct = safeShare(row.value, total);
        return (
          <div key={row.label} className="cmv2-size-histogram-bin">
            <div aria-hidden="true"><i style={{ height: `${Math.max(10, (row.value / max) * 100)}%` }} /></div>
            <span>{row.label}</span>
            <strong>{fmtInt(row.value)}</strong>
            <small>{Number.isFinite(pct) ? fmtStackPct(pct) : unit}</small>
          </div>
        );
      })}
    </div>
  );
}

function DescriptiveEmptyNotice({ state, compact = false }: { state: DescriptiveEmptyState; compact?: boolean }) {
  return (
    <div className={`cmv2-descriptive-empty-state is-${state.tone ?? "waiting"} ${compact ? "is-compact" : ""}`}>
      <span aria-hidden="true"><CircleHelp size={16} /></span>
      <div>
        <strong>{state.title}</strong>
        <p>{state.detail}</p>
        {state.next && <small>{state.next}</small>}
        {state.chips?.length ? (
          <div className="cmv2-descriptive-empty-tags" aria-label="Motivos del estado">
            {state.chips.map((chip) => <em key={chip}>{chip}</em>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ClassroomBarPlot({
  rows,
  ariaLabel,
  unit = "registros",
  height = 260,
  total,
  emptyState,
  selectedLabel,
  onRowClick,
}: {
  rows: DescriptiveBarRow[];
  ariaLabel: string;
  unit?: string;
  height?: number;
  total?: number;
  emptyState?: DescriptiveEmptyState;
  selectedLabel?: string;
  onRowClick?: (row: DescriptiveBarRow) => void;
}) {
  const visible = rows.filter((row) => row.value > 0).slice(0, 12);
  if (!visible.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  const max = visible.reduce((peak, row) => Math.max(peak, row.value), 0) || 1;
  return (
    <div className="cmv2-native-bars" role="img" aria-label={ariaLabel} style={{ minHeight: height }}>
      {visible.map((row) => {
        const selected = selectedLabel ? dashboardOptionKey(row.label) === dashboardOptionKey(selectedLabel) : false;
        const interactive = Boolean(onRowClick);
        return (
          <div
            key={row.label}
            className={`cmv2-native-bar-row ${interactive ? "is-interactive" : ""}${selected ? " is-selected" : ""}`}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? selected : undefined}
            onClick={interactive ? () => onRowClick?.(row) : undefined}
            onKeyDown={interactive ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onRowClick?.(row);
              }
            } : undefined}
          >
            <span>{row.label}</span>
            <div aria-hidden="true"><i style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }} /></div>
            <strong>
              {fmtInt(row.value)}{" "}
              <small>{Number.isFinite(total) && total && row.value > 0 ? `${fmtStackPct(row.value / total)} · ${unit}` : unit}</small>
            </strong>
          </div>
        );
      })}
    </div>
  );
}

function ClassroomStackedCrossPlot({
  table,
  ariaLabel,
  height = 270,
  emptyState,
  sortByMaleSurplus = false,
  showSegmentLabels = false,
}: {
  table: CrossTable;
  ariaLabel: string;
  height?: number;
  emptyState?: DescriptiveEmptyState;
  sortByMaleSurplus?: boolean;
  showSegmentLabels?: boolean;
}) {
  const displayTable = sortByMaleSurplus ? sortSexTableByMaleSurplus(table) : table;
  const rows = displayTable.rows.slice(0, 12);
  const colors = ["#7c3aed", "#0f766e", "#2563eb", "#64748b"];
  if (!rows.length || !displayTable.columns.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  const plotHeight = Math.max(118, Math.min(height, 42 + rows.length * 29));
  return (
    <div className="cmv2-native-stacked" role="img" aria-label={ariaLabel} style={{ minHeight: plotHeight }}>
      <div className="cmv2-native-legend">
        {displayTable.columns.map((column, index) => (
          <span key={column}><i style={{ background: colors[index % colors.length] }} />{column}</span>
        ))}
      </div>
      <div className="cmv2-native-stack-rows">
        {rows.map((row) => (
          <div key={row.label} className="cmv2-native-stack-row">
            <span>{row.label}</span>
            <div className="cmv2-native-stack-track" aria-hidden="true">
              {displayTable.columns.map((column, index) => {
                const value = row.values[column] ?? 0;
                const denominator = Math.max(row.total, displayTable.columns.reduce((sum, key) => sum + (row.values[key] ?? 0), 0), 1);
                const pct = value / denominator;
                const widthPct = Math.max(2, pct * 100);
                const segmentLabel = `${fmtInt(value)} (${fmtStackPct(pct)})`;
                return value > 0 ? (
                  <i
                    key={`${row.label}-${column}`}
                    className={showSegmentLabels && widthPct >= 30 ? "" : "is-label-hidden"}
                    title={`${column}: ${segmentLabel}`}
                    style={{
                      width: `${widthPct}%`,
                      background: colors[index % colors.length],
                    }}
                  >
                    {showSegmentLabels && <span>{segmentLabel}</span>}
                  </i>
                ) : null;
              })}
            </div>
            <strong>{fmtInt(row.total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function sexSegmentColor(kind: ClassroomSexCompositionRow["segments"][number]["kind"], index: number) {
  if (kind === "male") return "#7c3aed";
  if (kind === "female") return "#0f766e";
  if (kind === "missing") return "#cbd5e1";
  return ["#2563eb", "#64748b", "#a855f7"][index % 3];
}

function ClassroomSexCompositionPlot({
  rows,
  ariaLabel,
  height = 320,
  emptyState,
}: {
  rows: ClassroomSexCompositionRow[];
  ariaLabel: string;
  height?: number;
  emptyState?: DescriptiveEmptyState;
}) {
  const visible = rows.filter((row) => row.total > 0 && row.segments.length).slice(0, 12);
  if (!visible.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin composición por aula para graficar.</p>;
  const totalExpected = visible.reduce((sum, row) => sum + row.total, 0);
  const mixedCount = visible.filter((row) => row.segments.filter((segment) => segment.kind !== "missing" && segment.value > 0).length > 1).length;
  const dominantShare = visible.reduce((sum, row) => {
    const peak = row.segments.reduce((max, segment) => Math.max(max, segment.value), 0);
    return sum + safeShare(peak, row.total);
  }, 0) / visible.length;
  const legendSegments = sortedSexColumns(Array.from(new Set(visible.flatMap((row) => row.segments.map((segment) => segment.label)))))
    .map((label) => visible.flatMap((row) => row.segments).find((segment) => segment.label === label))
    .filter((segment): segment is ClassroomSexCompositionRow["segments"][number] => Boolean(segment));
  return (
    <div className="cmv2-classroom-sex-plot" role="img" aria-label={ariaLabel} style={{ minHeight: height }}>
      <div className="cmv2-classroom-sex-summary" aria-hidden="true">
        <span><small>Aulas visibles</small><strong>{fmtInt(visible.length)}</strong></span>
        <span><small>Aulas mixtas</small><strong>{fmtInt(mixedCount)}</strong></span>
        <span><small>Elegibles leídos</small><strong>{fmtInt(totalExpected)}</strong></span>
        <span><small>Dominancia media</small><strong>{fmtStackPct(dominantShare)}</strong></span>
      </div>
      <div className="cmv2-native-legend cmv2-classroom-sex-legend" aria-hidden="true">
        {legendSegments.map((segment, index) => (
          <span key={segment.label}><i style={{ background: sexSegmentColor(segment.kind, index) }} />{segment.label}</span>
        ))}
      </div>
      <div className="cmv2-classroom-sex-rows">
        {visible.map((row) => (
          <div key={row.id} className="cmv2-classroom-sex-row">
            <div className="cmv2-classroom-sex-label">
              <strong>{row.label}</strong>
              <span>{row.detail || "aula del marco"}</span>
            </div>
            <div className="cmv2-classroom-sex-track" aria-hidden="true">
              {row.segments.map((segment, index) => {
                const pct = safeShare(segment.value, row.total);
                const widthPct = Math.max(2, pct * 100);
                const segmentText = `${fmtInt(segment.value)} (${fmtStackPct(pct)})`;
                return (
                  <i
                    key={`${row.id}-${segment.label}`}
                    className={widthPct >= 18 ? "" : "is-label-hidden"}
                    title={`${segment.label}: ${segmentText}`}
                    style={{
                      width: `${widthPct}%`,
                      background: sexSegmentColor(segment.kind, index),
                    }}
                  >
                    <span>{segmentText}</span>
                  </i>
                );
              })}
            </div>
            <div className="cmv2-classroom-sex-total">
              <strong>{fmtInt(row.total)}</strong>
              <span>elegibles</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassroomHeatmapPlot({
  table,
  ariaLabel,
  height = 300,
  emptyState,
  minColumnWidth = 72,
}: {
  table: CrossTable;
  ariaLabel: string;
  height?: number;
  emptyState?: DescriptiveEmptyState;
  minColumnWidth?: number;
}) {
  const rows = table.rows.slice(0, 12);
  if (!rows.length || !table.columns.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  const max = rows.reduce((peak, row) => Math.max(peak, ...table.columns.map((column) => row.values[column] ?? 0)), 0) || 1;
  const minGridWidth = 180 + table.columns.length * minColumnWidth + table.columns.length * 4;
  return (
    <div className="cmv2-native-heatmap" role="img" aria-label={ariaLabel} style={{ minHeight: height }}>
      <div
        className="cmv2-native-heatmap-grid"
        style={{
          gridTemplateColumns: `minmax(180px, 1.15fr) repeat(${table.columns.length}, minmax(${minColumnWidth}px, .65fr))`,
          minWidth: `max(100%, ${minGridWidth}px)`,
        }}
      >
        <span className="cmv2-native-heatmap-corner" />
        {table.columns.map((column) => <strong key={column}>{column}</strong>)}
        {rows.flatMap((row) => [
          <b key={`${row.label}-label`}>{row.label}</b>,
          ...table.columns.map((column) => {
            const value = row.values[column] ?? 0;
            const heat = Math.min(1, value / max);
            return (
              <i
                key={`${row.label}-${column}`}
                style={{
                  background: value
                    ? `color-mix(in srgb, var(--cmv2-accent) ${Math.round(18 + heat * 52)}%, #f8fafc)`
                    : "#f8fafc",
                  color: heat > 0.58 ? "#fff" : "var(--pulso-text)",
                }}
              >
                {value ? fmtInt(value) : "—"}
              </i>
            );
          }),
        ])}
      </div>
    </div>
  );
}

function ClassroomFrameDashboard({
  frame,
  totalComp,
  selection,
  workspace,
  compact = false,
  lockedScope,
}: {
  frame: CalcMuestraAulasState["frame"] | null;
  totalComp: CalcMuestraComponente;
  selection?: CalcMuestraAulasSelection | null;
  workspace?: CalcMuestraWorkspace;
  compact?: boolean;
  lockedScope?: ClassroomDashboardScope;
}) {
  const [internalScope, setInternalScope] = useState<ClassroomDashboardScope>("poblacion");
  const scope = lockedScope ?? internalScope;
  const [selectedFaculty, setSelectedFaculty] = useState("general");
  const [programFocusFaculty, setProgramFocusFaculty] = useState("");
  const populationRowsRaw = rowsFrom<Record<string, unknown>>(frame?.population);
  const studentIdColumn = (workspace?.variable_mappings ?? []).find((row) => row.role === "student_id")?.column ?? "";
  const populationRows = uniqueRowsByKeys(populationRowsRaw, [studentIdColumn, ...UNIVERSITY_STUDENT_ROW_KEYS].filter(Boolean));
  const classroomRowsRaw = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
  const classroomRows = classroomRowsRaw.filter((row) => classroomRowBoolean(row, "included") || classroomRowsRaw.every((item) => item.included === undefined));
  const selectionRows = rowsFrom<Record<string, unknown>>(selection?.selection);
  const m1Rows = selectionRows.filter((row) => classroomRowText(row, ["wave"]) === "M1");
  const exclusionRows = rowsFrom<Record<string, unknown>>(frame?.exclusions);
  const marcoN = Math.max(safeNumber(totalComp.marco.marco_validado, 0), safeNumber(totalComp.marco.universo_bruto, 0));
  const labelFor = (role: string): CategoryLabeler => (value, key) => workspaceCategoryLabel(workspace, role, value, key);
  const facultyOptions = facultyOptionsForDashboard(totalComp, [populationRows, classroomRows, selectionRows], workspace);
  useEffect(() => {
    if (selectedFaculty !== "general" && !facultyOptions.includes(selectedFaculty)) setSelectedFaculty("general");
  }, [facultyOptions, selectedFaculty]);
  const isGeneral = selectedFaculty === "general";
  const selectedFacultyLabel = isGeneral ? "General" : selectedFaculty;
  const selectedMarcoRow = isGeneral
    ? null
    : (totalComp.marco.estratos ?? []).find((row) =>
        dashboardOptionKey(workspaceCategoryLabel(workspace, "faculty", row.label)) === dashboardOptionKey(selectedFaculty),
      ) ?? null;
  const filteredPopulationRows = rowsForFaculty(populationRows, selectedFaculty, workspace);
  const filteredClassroomRows = rowsForFaculty(classroomRows, selectedFaculty, workspace);
  const filteredM1Rows = rowsForFaculty(m1Rows, selectedFaculty, workspace);
  const filteredExclusionRows = rowsForFaculty(exclusionRows, selectedFaculty, workspace);
  const activeClassroomRows = scope === "seleccion" && filteredM1Rows.length ? filteredM1Rows : filteredClassroomRows;
  const weightedKeys = ["eligible_n", "elegibles", "n_elegibles", "students_n", "matriculados", "total"];
  const inputRows = isGeneral
    ? Math.max(frameAuditNumber(frame, "input_rows"), populationRows.length, marcoN)
    : Math.max(filteredPopulationRows.length, safeNumber(selectedMarcoRow?.N, 0), sumRowsByKeys(filteredClassroomRows, weightedKeys));
  const eligibleRows = isGeneral
    ? Math.max(frameAuditNumber(frame, "eligible_student_rows"), frameAuditNumber(frame, "population_n"), populationRows.length, marcoN)
    : Math.max(filteredPopulationRows.length, safeNumber(selectedMarcoRow?.N, 0), sumRowsByKeys(filteredClassroomRows, weightedKeys));
  const populationN = isGeneral
    ? Math.max(populationRows.length, frameAuditNumber(frame, "population_n"), safeNumber((frame as Record<string, unknown> | null)?.population_n, 0), marcoN)
    : Math.max(filteredPopulationRows.length, safeNumber(selectedMarcoRow?.N, 0), sumRowsByKeys(filteredClassroomRows, weightedKeys));
  const classroomN = isGeneral
    ? Math.max(classroomRows.length, frameAuditNumber(frame, "classroom_included_n"))
    : filteredClassroomRows.length;
  const excludedN = isGeneral
    ? Math.max(exclusionRows.length, frameAuditNumber(frame, "excluded_rows"))
    : filteredExclusionRows.length;
  const classroomEligibleTotal = sumRowsByKeys(activeClassroomRows, weightedKeys);
  const classroomAverageEligible = activeClassroomRows.length ? classroomEligibleTotal / activeClassroomRows.length : Number.NaN;
  const profileFacultyRows = frameCategoryProfileRows(frame, "faculty", labelFor("faculty"), 12, "total");
  const profileProgramRows = frameCategoryProfileRows(frame, "program", labelFor("program"), 12, "total");
  const profileSexRows = frameCategoryProfileRows(frame, "sex", labelFor("sex"), 4, "total");
  const profileLevelRows = frameCategoryProfileRows(frame, "level", labelFor("level"), 10, "ordinal");
  const populationCrossProfileRows = rowsFrom<Record<string, unknown>>((frame as Record<string, unknown> | null)?.population_cross_profiles);
  const legacyProgramFrame = Boolean(frame && classroomRows.length && !populationRows.length && !populationCrossProfileRows.length);
  const populationGraphUsesClassrooms = scope === "poblacion" && !populationRows.length && classroomRows.length > 0;
  const populationPlotUnit = populationGraphUsesClassrooms ? "elegibles" : "personas";
  const populationFacultyCount = isGeneral
    ? Math.max(
        countDistinctByKeys(populationRows, UNIVERSITY_FACULTY_ROW_KEYS),
        !populationRows.length ? countDistinctByKeys(classroomRows, UNIVERSITY_FACULTY_ROW_KEYS) : 0,
        profileFacultyRows.length,
        totalComp.marco.estratos?.filter((row) => safeNumber(row.N, 0) > 0).length ?? 0,
      )
    : 1;
  const populationProgramCount = Math.max(
    countDistinctByKeys(filteredPopulationRows, ["program", "programa", "career", "carrera", "especialidad"]),
    !populationRows.length ? countDistinctByKeys(filteredClassroomRows, ["program", "programa", "career", "carrera", "especialidad"]) : 0,
    isGeneral ? profileProgramRows.length : 0,
  );
  const populationSexCount = Math.max(
    countDistinctByKeys(filteredPopulationRows, ["sex", "sexo", "genero"]),
    !populationRows.length ? classroomSexRowsFromAulas(filteredClassroomRows, 8, labelFor("sex")).length : 0,
    isGeneral ? profileSexRows.length : 0,
  );
  const classroomFacultyCount = isGeneral ? countDistinctByKeys(activeClassroomRows, UNIVERSITY_FACULTY_ROW_KEYS) : 1;
  const classroomProgramCount = countDistinctByKeys(activeClassroomRows, ["program", "programa", "career", "carrera", "especialidad"]);
  const classroomTeacherCount = countDistinctByKeys(activeClassroomRows, ["teacher", "docente", "profesor", "contacto"]);
  const facultyFromAulas = weightedDistributionRows(classroomRows, ["faculty", "facultad", "unidad_academica", "stratum"], ["eligible_n", "matriculados_poblacion", "enrolled_total"], 12, labelFor("faculty"), "total");
  const facultyFromMarco = populationRows.length
    ? universityFacultyDiagnosticRows(totalComp, populationRows, { sortMode: "total", maxRows: 12 })
    : profileFacultyRows.length
      ? profileFacultyRows
      : universityFacultyDiagnosticRows(totalComp, [], { sortMode: "total", maxRows: 12 });
  const facultyPopulation = facultyFromMarco.length ? facultyFromMarco : facultyFromAulas;
  const facultyClassroomRows = weightedDistributionRows(activeClassroomRows, ["faculty", "facultad", "unidad_academica", "stratum"], [], 12, labelFor("faculty"), "total");
  const facultyRows = scope === "poblacion"
    ? facultyPopulation
    : (facultyClassroomRows.length ? facultyClassroomRows : facultyFromAulas);
  const defaultProgramFaculty = isGeneral ? facultyRows[0]?.label ?? "" : selectedFaculty;
  const programFocusAvailable = isGeneral
    ? facultyRows.some((row) => dashboardOptionKey(row.label) === dashboardOptionKey(programFocusFaculty))
    : false;
  const activeProgramFaculty = isGeneral
    ? (programFocusAvailable ? programFocusFaculty : defaultProgramFaculty)
    : selectedFaculty;
  useEffect(() => {
    if (!isGeneral) {
      if (programFocusFaculty !== selectedFaculty) setProgramFocusFaculty(selectedFaculty);
      return;
    }
    if (!defaultProgramFaculty) {
      if (programFocusFaculty) setProgramFocusFaculty("");
      return;
    }
    if (!programFocusAvailable) setProgramFocusFaculty(defaultProgramFaculty);
  }, [defaultProgramFaculty, isGeneral, programFocusAvailable, programFocusFaculty, selectedFaculty]);
  const selectedMarcoSexRows = selectedMarcoRow
    ? [
        { label: "Mujeres", value: safeNumber(selectedMarcoRow.N_a, 0) },
        { label: "Hombres", value: safeNumber(selectedMarcoRow.N_b, 0) },
      ].filter((row) => row.value > 0)
    : [];
  const sexRows = scope === "poblacion" && filteredPopulationRows.length
    ? universityCategoryProfileRows(filteredPopulationRows, ["sex", "sexo", "genero"], isGeneral ? totalComp.marco.estratos ?? [] : [], labelFor("sex"))
    : scope === "poblacion" && populationGraphUsesClassrooms
      ? classroomSexRowsFromAulas(filteredClassroomRows, 4, labelFor("sex"))
    : scope === "poblacion" && isGeneral && profileSexRows.length
      ? profileSexRows
      : scope !== "poblacion" && classroomSexRowsFromAulas(activeClassroomRows, 4, labelFor("sex")).length
      ? classroomSexRowsFromAulas(activeClassroomRows, 4, labelFor("sex"))
      : isGeneral
        ? universityCategoryProfileRows([], ["sex", "sexo", "genero"], totalComp.marco.estratos ?? [])
        : selectedMarcoSexRows;
  const populationSexTable = universityFacultySexCross(totalComp, populationRows, workspace, frameCrossProfileTable(frame, "faculty", "sex", workspace, 12, 4, "faculty", "label"));
  const classroomSexTable = classroomFacultySexCross(totalComp, [], scope === "seleccion" && m1Rows.length ? m1Rows : classroomRows, workspace);
  const populationSexTableTotal = populationSexTable.rows.reduce((sum, row) => sum + Object.values(row.values).reduce((inner, value) => inner + safeNumber(value, 0), 0), 0);
  const sexTable = scope === "poblacion"
    ? (populationSexTableTotal > 0 ? populationSexTable : classroomSexTable)
    : classroomSexTable;
  const classroomLevelTable = buildWeightedCrossTable(classroomRows, ["faculty", "facultad", "unidad_academica", "stratum"], ["level", "nivel", "nivel_del_curso", "ciclo"], ["eligible_n"], 10, 99, { primary: labelFor("faculty"), secondary: labelFor("level"), rowSort: "faculty", columnSort: "ordinal" });
  const populationLevelProfileTable = frameCrossProfileTable(frame, "faculty", "level", workspace, 10, 99, "faculty", "ordinal");
  const levelTable = scope === "poblacion" && populationRows.length
    ? buildCrossTable(populationRows, ["faculty", "facultad", "unidad_academica"], ["level", "nivel", "ciclo", "anio"], 10, 99, { primary: labelFor("faculty"), secondary: labelFor("level"), rowSort: "faculty", columnSort: "ordinal" })
    : scope === "poblacion"
      ? (populationLevelProfileTable.rows.length ? populationLevelProfileTable : classroomLevelTable)
      : classroomLevelTable;
  const levelRows = scope === "poblacion" && filteredPopulationRows.length
    ? universityCategoryProfileRows(filteredPopulationRows, ["level", "nivel", "ciclo", "anio"], [], labelFor("level"), "ordinal")
    : scope === "poblacion" && profileLevelRows.length
      ? profileLevelRows
      : scope === "poblacion" && populationGraphUsesClassrooms
        ? weightedDistributionRows(filteredClassroomRows, ["level", "nivel", "nivel_del_curso", "ciclo"], weightedKeys, 10, labelFor("level"), "ordinal")
    : weightedDistributionRows(activeClassroomRows, ["level", "nivel", "nivel_del_curso", "ciclo"], [], 10, labelFor("level"), "ordinal");
  const programPopulationRows = activeProgramFaculty
    ? rowsForFaculty(populationRows, activeProgramFaculty, workspace)
    : filteredPopulationRows;
  const programSelectionRows = activeProgramFaculty
    ? rowsForFaculty(m1Rows, activeProgramFaculty, workspace)
    : filteredM1Rows;
  const programClassroomRows = scope === "seleccion" && programSelectionRows.length
    ? programSelectionRows
    : activeProgramFaculty
      ? rowsForFaculty(classroomRows, activeProgramFaculty, workspace)
      : filteredClassroomRows;
  const programRowsFromPopulation = programPopulationRows.length
    ? weightedDistributionRows(programPopulationRows, ["program", "programa", "career", "carrera", "especialidad"], [], 10, labelFor("program"))
    : [];
  const programRowsFromPopulationProfile = activeProgramFaculty
    ? frameCrossSecondaryRows(frame, "faculty", "program", activeProgramFaculty, workspace, 10)
    : [];
  const programRowsFromFrame = scope === "poblacion"
    ? (programRowsFromPopulation.length
        ? programRowsFromPopulation
        : programRowsFromPopulationProfile.length
          ? programRowsFromPopulationProfile
          : isGeneral && !activeProgramFaculty
            ? profileProgramRows.slice(0, 10)
            : [])
    : weightedDistributionRows(programClassroomRows, ["program", "programa", "career", "carrera", "especialidad"], [], 10, labelFor("program"));
  const programRows = legacyProgramFrame ? [] : programRowsFromFrame;
  const populationProgramSubtitle = activeProgramFaculty
    ? `carreras del alumnado en ${activeProgramFaculty}`
    : "selecciona una facultad para ver carreras";
  const classroomProgramSubtitle = activeProgramFaculty
    ? `carrera con mayor presencia en aulas de ${activeProgramFaculty}`
    : "selecciona una facultad para ver la carrera principal del aula";
  const modalityRows = weightedDistributionRows(activeClassroomRows, ["modality", "modalidad"], [], 8, labelFor("modality"));
  const sizeRows = universityClassroomSizeRows(activeClassroomRows);
  const teacherRows = weightedDistributionRows(activeClassroomRows, ["teacher", "docente", "profesor", "contacto"], [], 10);
  const classroomSexCompositionRows = classroomSexCompositionRowsFromAulas(activeClassroomRows, workspace, 12);
  const diagnosticWorkspace = workspace ?? EMPTY_WORKSPACE;
  const graphSource = scope === "poblacion" ? (populationGraphUsesClassrooms ? "marco de aulas" : "base principal") : "catálogo de aulas";
  const hasPopulationSource = populationRows.length > 0 || marcoN > 0 || classroomRows.length > 0;
  const hasClassroomSource = activeClassroomRows.length > 0 || classroomRows.length > 0;
  const graphHasSource = scope === "poblacion" ? hasPopulationSource : hasClassroomSource;
  const missingAdministrativeProgramCross = scope === "poblacion" &&
    Boolean(activeProgramFaculty) &&
    !programRowsFromPopulation.length &&
    !programRowsFromPopulationProfile.length;
  const dashboardEmptyStates = {
    faculty: descriptiveMissingState(diagnosticWorkspace, {
      role: "faculty",
      variable: "Facultad",
      source: graphSource,
      hasSource: graphHasSource,
      impact: "Este gráfico necesita saber a qué facultad pertenece cada registro.",
      next: "Revisa Definición > Variables y vincula la columna Facultad.",
    }),
    sex: descriptiveMissingState(diagnosticWorkspace, {
      role: "sex",
      variable: "Sexo o género",
      source: graphSource,
      hasSource: graphHasSource,
      impact: "Permite leer la composición esperada y auditar cuotas.",
      next: "Revisa Definición > Variables y vincula la columna Sexo o género.",
    }),
    level: descriptiveMissingState(diagnosticWorkspace, {
      role: "level",
      variable: "Ciclo",
      source: graphSource,
      hasSource: graphHasSource,
      optional: true,
      impact: "No bloquea el cálculo, pero explica la composición académica.",
      next: "Si existe ciclo, asígnalo en Definición > Variables.",
    }),
    program: legacyProgramFrame ? {
      badge: "Recalcular",
      title: "Reconstruye el marco para leer carreras",
      detail: "El marco guardado no permite confirmar la relación facultad-carrera.",
      next: "Vuelve a construirlo desde Definición > Bases.",
      chips: ["Marco guardado", "Recalcular"],
      tone: "waiting" as const,
    } : missingAdministrativeProgramCross ? {
      badge: "Revisar",
      title: "Falta relación facultad-carrera",
      detail: "Este gráfico usa la carrera administrativa del estudiante. No se completa con aulas para evitar mezclar cursos de otra facultad.",
      next: "Revisa Definición > Variables y confirma que Facultad y Carrera vienen de la base de estudiantes.",
      chips: ["Población", "No mezcla aulas"],
      tone: "waiting" as const,
    } : descriptiveMissingState(diagnosticWorkspace, {
      role: "program",
      variable: "Programa o carrera",
      source: graphSource,
      hasSource: graphHasSource,
      optional: true,
      impact: "Ayuda a leer concentraciones dentro de cada facultad.",
      next: "Si el archivo trae programa o carrera, asígnalo en Definición > Variables.",
    }),
    size: descriptiveMissingState(diagnosticWorkspace, {
      role: "eligible_n",
      variable: "Elegibles por aula",
      source: "marco de aulas",
      hasSource: hasClassroomSource,
      impact: "Permite agrupar aulas por tamaño operativo.",
      next: "Construye el marco de aulas o revisa la columna de elegibles.",
    }),
    teacher: descriptiveMissingState(diagnosticWorkspace, {
      role: "teacher",
      variable: "Docente o contacto",
      source: "catálogo de aulas",
      hasSource: hasClassroomSource,
      optional: true,
      impact: "No bloquea el cálculo; sirve para agenda, permisos y monitoreo.",
      next: "Si existe docente o contacto, asígnalo en Definición > Variables.",
    }),
  };
  const hasAnyGraph = facultyRows.length || sexRows.length || classroomSexCompositionRows.length || levelTable.rows.length || levelRows.length || sizeRows.length || programRows.length || teacherRows.length || modalityRows.length;
  const scopeOptions: Array<{ id: ClassroomDashboardScope; label: string; disabled?: boolean }> = [
    { id: "poblacion", label: "Población" },
    { id: "aulas", label: "Aulas elegibles", disabled: !classroomRows.length },
    { id: "seleccion", label: "Aulas titulares", disabled: !m1Rows.length },
  ];
  const scopeLabel = scopeOptions.find((item) => item.id === scope)?.label ?? "Población";
  const graphedRows = scope === "poblacion"
    ? (filteredPopulationRows.length || (populationGraphUsesClassrooms ? Math.max(sumRowsByKeys(filteredClassroomRows, weightedKeys), filteredClassroomRows.length) : populationN))
    : activeClassroomRows.length;
  const visibleRowsLabel = scope === "poblacion"
    ? (populationGraphUsesClassrooms ? "Elegibles acumulados" : "Estudiantes visibles")
    : scope === "seleccion"
      ? "Aulas titulares visibles"
      : "Aulas visibles";
  const dashboardTitle = scope === "aulas"
    ? "Aulas y elegibles del marco de aplicación"
    : scope === "seleccion"
      ? "Aulas titulares y reemplazos operativos"
      : "Población, composición académica y elegibilidad";
  const dashboardKpis = scope === "poblacion"
    ? [
        { label: "Universo leído", value: inputRows ? fmtInt(inputRows) : "pendiente" },
        { label: "Población objetivo", value: populationN ? fmtInt(populationN) : "pendiente" },
        { label: "Facultades", value: populationFacultyCount ? fmtInt(populationFacultyCount) : "pendiente" },
        { label: "Carreras", value: populationProgramCount ? fmtInt(populationProgramCount) : "mapear" },
        { label: "Sexo/género", value: populationSexCount ? fmtInt(populationSexCount) : "mapear" },
        { label: "Exclusiones", value: excludedN ? fmtInt(excludedN) : "0" },
      ]
    : scope === "seleccion"
      ? [
          { label: "Aulas titulares", value: (isGeneral ? m1Rows.length : filteredM1Rows.length) ? fmtInt(isGeneral ? m1Rows.length : filteredM1Rows.length) : "pendiente" },
          { label: "Elegibles esperados", value: classroomEligibleTotal ? fmtInt(classroomEligibleTotal) : "pendiente" },
          { label: "Promedio por aula", value: Number.isFinite(classroomAverageEligible) ? classroomAverageEligible.toFixed(1).replace(".", ",") : "pendiente" },
          { label: "Facultades cubiertas", value: classroomFacultyCount ? fmtInt(classroomFacultyCount) : "pendiente" },
          { label: "Carreras cubiertas", value: classroomProgramCount ? fmtInt(classroomProgramCount) : "mapear" },
          { label: "Docentes/contactos", value: classroomTeacherCount ? fmtInt(classroomTeacherCount) : "mapear" },
        ]
      : [
          { label: "Aulas válidas", value: classroomN ? fmtInt(classroomN) : "pendiente" },
          { label: "Elegibles en aulas", value: classroomEligibleTotal ? fmtInt(classroomEligibleTotal) : "pendiente" },
          { label: "Promedio por aula", value: Number.isFinite(classroomAverageEligible) ? classroomAverageEligible.toFixed(1).replace(".", ",") : "pendiente" },
          { label: "Facultades con aulas", value: classroomFacultyCount ? fmtInt(classroomFacultyCount) : "pendiente" },
          { label: "Carreras con aulas", value: classroomProgramCount ? fmtInt(classroomProgramCount) : "mapear" },
          { label: "Docentes/contactos", value: classroomTeacherCount ? fmtInt(classroomTeacherCount) : "mapear" },
        ];
  const frameRecord = frame as Record<string, unknown> | null;
  const frameConfig = frameRecord?.config && typeof frameRecord.config === "object"
    ? frameRecord.config as Record<string, unknown>
    : {};
  const selectorConfig = frameConfig.selector && typeof frameConfig.selector === "object"
    ? frameConfig.selector as Record<string, unknown>
    : {};
  const requestedClassrooms = safeNumber(selectorConfig.n_aulas, 0);
  const facultyPopulationTotal = facultyPopulation.reduce((sum, row) => sum + row.value, 0) || populationN;
  const facultyAulasTotal = facultyRows.reduce((sum, row) => sum + row.value, 0) || activeClassroomRows.length;
  const programRowsTotal = programRows.reduce((sum, row) => sum + row.value, 0);
  const levelRowsTotal = levelRows.reduce((sum, row) => sum + row.value, 0);
  const largestFaculty = facultyPopulation[0];
  const largestFacultyShare = largestFaculty ? safeShare(largestFaculty.value, facultyPopulationTotal) : Number.NaN;
  const sexTotal = sexRows.reduce((sum, row) => sum + row.value, 0);
  const dominantSex = sexRows.slice().sort((a, b) => b.value - a.value)[0];
  const dominantSexShare = dominantSex ? safeShare(dominantSex.value, sexTotal) : Number.NaN;
  const eligibilityRate = safeShare(eligibleRows, inputRows);
  const dedupeLoad = eligibleRows > 0 && populationN > 0 ? 1 - safeShare(populationN, eligibleRows) : Number.NaN;
  const validClassroomShare = safeShare(classroomN, classroomRowsRaw.length);
  const smallClassrooms = activeClassroomRows.filter((row) => classroomRowNumber(row, weightedKeys) <= 20).length;
  const smallClassroomShare = safeShare(smallClassrooms, activeClassroomRows.length);
  const contactRows = activeClassroomRows.filter((row) =>
    firstRowValue(row, ["teacher", "docente", "profesor", "contacto", "teacher_email", "correo_docente", "correo_pucp"]),
  ).length;
  const contactCoverage = safeShare(contactRows, activeClassroomRows.length);
  const reserveDepth = requestedClassrooms > 0 ? classroomN / requestedClassrooms : Number.NaN;
  const intelligenceSteps: ClassroomFunnelStep[] = scope === "poblacion"
    ? [
        { label: "Base leída", value: inputRows, detail: "filas institucionales", unit: "insumo" },
        { label: "Filas elegibles", value: eligibleRows, detail: "después de filtros", unit: "elegibles", compareToBase: true },
        { label: "Estudiantes únicos", value: populationN, detail: "población objetivo", unit: "población", compareToBase: true },
      ]
    : [
        { label: "Aulas leídas", value: classroomRowsRaw.length, detail: "curso-horario detectado", unit: "aulas" },
        { label: "Aulas válidas", value: classroomN, detail: "seleccionables", unit: "aulas", compareToBase: true },
        { label: "Elegibles", value: classroomEligibleTotal, detail: "dentro de aulas", unit: "elegibles" },
      ];
  const intelligenceItems: ClassroomInsight[] = scope === "poblacion"
    ? [
        {
          label: "Elegibilidad",
          value: Number.isFinite(eligibilityRate) ? fmtPct(eligibilityRate) : "pendiente",
          detail: "filas que superan filtros de población",
          tone: Number.isFinite(eligibilityRate) && eligibilityRate >= 0.75 ? "good" : "warn",
          icon: CheckCircle2,
        },
        {
          label: "Repetición",
          value: Number.isFinite(dedupeLoad) ? fmtPct(dedupeLoad) : "pendiente",
          detail: "filas repetidas que se consolidan en estudiantes únicos",
          tone: "info",
          icon: Layers3,
        },
        {
          label: "Dominio mayor",
          value: largestFaculty?.label ?? "pendiente",
          detail: Number.isFinite(largestFacultyShare) ? `${fmtPct(largestFacultyShare)} de la población` : "requiere facultad",
          tone: Number.isFinite(largestFacultyShare) && largestFacultyShare > 0.25 ? "warn" : "neutral",
          icon: Target,
        },
        {
          label: "Cuotas sexo",
          value: dominantSex?.label ?? "pendiente",
          detail: Number.isFinite(dominantSexShare) ? `${fmtPct(dominantSexShare)} categoría dominante` : "requiere variable",
          tone: "neutral",
          icon: Users,
        },
      ]
    : [
        {
          label: "Profundidad",
          value: Number.isFinite(reserveDepth) ? `${reserveDepth.toFixed(1).replace(".", ",")}x` : classroomN ? fmtInt(classroomN) : "pendiente",
          detail: requestedClassrooms ? `aulas válidas / ${fmtInt(requestedClassrooms)} titulares` : "aulas disponibles antes de seleccionar",
          tone: Number.isFinite(reserveDepth) && reserveDepth >= 3 ? "good" : "info",
          icon: Grid3X3,
        },
        {
          label: "Aulas válidas",
          value: Number.isFinite(validClassroomShare) ? fmtPct(validClassroomShare) : "pendiente",
          detail: "curso-horario que pasa al marco de aplicación",
          tone: Number.isFinite(validClassroomShare) && validClassroomShare >= 0.9 ? "good" : "warn",
          icon: CheckCircle2,
        },
        {
          label: "Aulas pequeñas",
          value: Number.isFinite(smallClassroomShare) ? fmtPct(smallClassroomShare) : "pendiente",
          detail: "aulas con 20 o menos elegibles",
          tone: Number.isFinite(smallClassroomShare) && smallClassroomShare > 0.35 ? "warn" : "neutral",
          icon: Gauge,
        },
        {
          label: "Contacto",
          value: Number.isFinite(contactCoverage) ? fmtPct(contactCoverage) : "pendiente",
          detail: "aulas con docente, contacto o correo operativo",
          tone: Number.isFinite(contactCoverage) && contactCoverage >= 0.8 ? "good" : "warn",
          icon: ClipboardList,
        },
      ];

  if (!hasAnyGraph && !frame && !(totalComp.marco.estratos ?? []).length) {
    return (
      <ClassroomEmptyState
        icon={BarChart3}
        title="Dashboard pendiente"
        detail="Carga la base, mapea variables y construye el marco para ver población objetivo, aulas, cruces y concentración."
      />
    );
  }

  return (
    <div className={`cmv2-frame-dashboard ${compact ? "is-compact" : ""}`}>
      <div className="cmv2-frame-dashboard-head">
        <div>
          <span className="cmv2-eyebrow">Marco del estudio</span>
          <strong>{dashboardTitle}</strong>
        </div>
        <div className="cmv2-dashboard-controls">
          <label className="cmv2-dashboard-faculty-control">
            <span>Facultad</span>
            <select value={selectedFaculty} onChange={(event) => setSelectedFaculty(event.currentTarget.value)}>
              <option value="general">General</option>
              {facultyOptions.map((faculty) => (
                <option key={faculty} value={faculty}>{faculty}</option>
              ))}
            </select>
          </label>
          {!lockedScope && <div className="cmv2-dashboard-scope-control">
            <span>Ver</span>
            <div className="cmv2-segmented-mini" role="tablist" aria-label="Alcance del marco">
              {scopeOptions.map(({ id, label, disabled }) => (
                <button key={id} type="button" disabled={disabled} className={scope === id ? "is-active" : ""} onClick={() => setInternalScope(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>}
        </div>
      </div>
      <div className="cmv2-frame-dashboard-kpis">
        {dashboardKpis.map((metric) => <Metric key={metric.label} label={metric.label} value={metric.value} />)}
      </div>
      <div className="cmv2-dashboard-filter-strip" aria-label="Filtro aplicado al marco">
        <span><small>Lectura</small><strong>{selectedFacultyLabel}</strong></span>
        <span><small>Base de gráficos</small><strong>{scopeLabel}</strong></span>
        <span>
          <small>{visibleRowsLabel}</small>
          <strong>{graphedRows ? fmtInt(graphedRows) : populationN ? fmtInt(populationN) : "pendiente"}</strong>
        </span>
      </div>
      <div className="cmv2-dashboard-intelligence">
        <ClassroomFunnelStrip title={scope === "poblacion" ? "Embudo de población" : "Capacidad del marco"} steps={intelligenceSteps} />
        <ClassroomInsightGrid items={intelligenceItems} />
      </div>
      <div className="cmv2-dashboard-chart-grid">
        {scope === "poblacion" ? (
          <>
            <ClassroomPlotCard
              title={populationGraphUsesClassrooms ? "Elegibles representados por facultad" : "Población por facultad"}
              subtitle={populationGraphUsesClassrooms ? "alumnos elegibles acumulados en aulas válidas" : "estudiantes únicos elegibles del universo"}
            >
              <ClassroomBarPlot
                rows={facultyPopulation}
                ariaLabel="Distribución de población por facultad"
                unit={populationPlotUnit}
                total={facultyPopulationTotal}
                emptyState={dashboardEmptyStates.faculty}
                selectedLabel={activeProgramFaculty}
                onRowClick={(row) => setProgramFocusFaculty(row.label)}
              />
            </ClassroomPlotCard>
            <ClassroomPlotCard title="Carreras por facultad" subtitle={populationProgramSubtitle}>
              <ClassroomBarPlot rows={programRows} ariaLabel="Carreras o programas de la población" unit={populationPlotUnit} height={260} total={programRowsTotal} emptyState={dashboardEmptyStates.program} />
            </ClassroomPlotCard>
            <ClassroomPlotCard title={isGeneral ? "Sexo por facultad" : "Sexo o género"} subtitle={populationGraphUsesClassrooms ? "composición esperada según aulas válidas" : "estudiantes únicos por facultad"} wide>
              {isGeneral && sexTable.rows.length ? (
                <ClassroomStackedCrossPlot table={sexTable} ariaLabel="Sexo por facultad ordenado por predominio masculino" emptyState={dashboardEmptyStates.sex} sortByMaleSurplus showSegmentLabels />
              ) : (
                <ClassroomBarPlot rows={sexRows} ariaLabel={`Sexo o género en ${selectedFacultyLabel}`} unit={populationPlotUnit} emptyState={dashboardEmptyStates.sex} />
              )}
            </ClassroomPlotCard>
            <ClassroomPlotCard title={isGeneral ? "Facultad por ciclo" : "Ciclo"} subtitle={populationGraphUsesClassrooms ? "ciclos acumulados desde aulas válidas" : "composición de estudiantes elegibles por ciclo"} wide>
              {isGeneral ? (
                <ClassroomHeatmapPlot table={levelTable} ariaLabel="Mapa de calor facultad por ciclo" minColumnWidth={56} emptyState={dashboardEmptyStates.level} />
              ) : (
                <ClassroomBarPlot rows={levelRows} ariaLabel={`Ciclo en ${selectedFacultyLabel}`} unit={populationPlotUnit} emptyState={dashboardEmptyStates.level} />
              )}
            </ClassroomPlotCard>
          </>
        ) : (
          <>
            <ClassroomPlotCard title={scope === "seleccion" ? "Aulas titulares por facultad" : "Aulas disponibles por facultad"} subtitle="curso-horario como unidad de intervención">
              <ClassroomBarPlot
                rows={facultyRows}
                ariaLabel="Aulas disponibles por facultad"
                unit="aulas"
                total={facultyAulasTotal}
                emptyState={dashboardEmptyStates.faculty}
                selectedLabel={activeProgramFaculty}
                onRowClick={(row) => setProgramFocusFaculty(row.label)}
              />
            </ClassroomPlotCard>
            <ClassroomPlotCard title={scope === "seleccion" ? "Aulas titulares por carrera principal" : "Aulas por carrera principal"} subtitle={classroomProgramSubtitle}>
              <ClassroomBarPlot rows={programRows} ariaLabel={`Aulas por carrera principal en ${selectedFacultyLabel}`} unit="aulas" total={programRowsTotal} emptyState={dashboardEmptyStates.program} />
            </ClassroomPlotCard>
            <ClassroomPlotCard title="Sexo por aula" subtitle="aporte esperado de hombres y mujeres en cada aula">
              <ClassroomSexCompositionPlot
                rows={classroomSexCompositionRows}
                ariaLabel={`Sexo esperado por aula en ${selectedFacultyLabel}`}
                emptyState={dashboardEmptyStates.sex}
              />
            </ClassroomPlotCard>
            <ClassroomPlotCard title="Aulas por ciclo" subtitle="curso-horario disponible según ciclo declarado">
              <ClassroomBarPlot rows={levelRows} ariaLabel={`Aulas por ciclo en ${selectedFacultyLabel}`} unit="aulas" total={levelRowsTotal} emptyState={dashboardEmptyStates.level} />
            </ClassroomPlotCard>
            <ClassroomPlotCard title="Tamaño de aulas" subtitle="rangos de estudiantes elegibles por aula">
              <ClassroomHistogramPlot rows={sizeRows} ariaLabel={`Tamaño de aulas en ${selectedFacultyLabel}`} emptyState={dashboardEmptyStates.size} />
            </ClassroomPlotCard>
            <ClassroomPlotCard title="Docentes o contactos" subtitle="primeras concentraciones para agenda">
              <ClassroomBarPlot rows={teacherRows.length ? teacherRows : modalityRows} ariaLabel={`Docentes o modalidad en ${selectedFacultyLabel}`} unit="aulas" height={235} emptyState={dashboardEmptyStates.teacher} />
            </ClassroomPlotCard>
          </>
        )}
      </div>
    </div>
  );
}

function UniversityPublicationConfigPanel({
  workspace,
  aulasState,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const config = { ...DEFAULT_UNIVERSITY_PUBLICATION_CONFIG, ...(workspace.publication_config ?? {}) };
  const selectionReady = classroomSelectionReady(aulasState);
  const replacementReady = classroomReplacementReady(aulasState);

  function updateConfig(patch: Partial<CalcMuestraWorkspacePublicationConfig>) {
    onWorkspace({ ...workspace, publication_config: { ...config, ...patch } });
  }

  return (
    <section className="cmv2-panel cmv2-university-publication">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Publicación y entregables</span>
          <strong>Prepara salidas de trabajo y versión para compartir</strong>
        </div>
        <span className="cmv2-pill-soft">{config.google_sheets_enabled ? "Sheets activado" : "Excel local"}</span>
      </div>
      <div className="cmv2-publication-layout">
        <div className="cmv2-publication-main">
          <label className="cmv2-classroom-toggle">
            <input
              type="checkbox"
              checked={Boolean(config.google_sheets_enabled)}
              onChange={(e) => updateConfig({ google_sheets_enabled: e.currentTarget.checked })}
            />
            <span>
              <strong>Preparar publicación en Google Sheets</strong>
              <em>Útil para compartir avance interno, cálculo muestral, selección de aulas y cierre sin depender solo del PDF.</em>
            </span>
          </label>
          <div className="cmv2-university-contract-grid">
            <label className="cmv2-compact-field">
              <span>Modo de publicación</span>
              <select value={config.publication_mode ?? "single_spreadsheet_multi_sheet"} onChange={(e) => updateConfig({ publication_mode: e.currentTarget.value })}>
                <option value="single_spreadsheet_multi_sheet">Un Google Sheets con varias hojas</option>
                <option value="separate_outputs">Entregables separados</option>
              </select>
            </label>
            <label className="cmv2-compact-field">
              <span>Enlace de Google Sheets</span>
              <input value={config.spreadsheet_id || config.spreadsheet_url || ""} placeholder="Pega el enlace o ID de Sheets" onChange={(e) => updateConfig({ spreadsheet_id: e.currentTarget.value, spreadsheet_url: e.currentTarget.value })} />
            </label>
            <label className="cmv2-compact-field">
              <span>Hoja interna</span>
              <input value={config.internal_sheet_name ?? ""} placeholder="Calculo muestra - interno" onChange={(e) => updateConfig({ internal_sheet_name: e.currentTarget.value })} />
            </label>
            <label className="cmv2-compact-field">
              <span>Hoja cliente</span>
              <input value={config.client_sheet_name ?? ""} placeholder="Calculo muestra - cliente" onChange={(e) => updateConfig({ client_sheet_name: e.currentTarget.value })} />
            </label>
            <label className="cmv2-compact-field">
              <span>Privacidad</span>
              <select value={config.pii_policy ?? "sin_pii_cliente"} onChange={(e) => updateConfig({ pii_policy: e.currentTarget.value })}>
                <option value="sin_pii_cliente">Cliente sin identificadores</option>
                <option value="interno_trazabilidad">Interno con trazabilidad operativa</option>
              </select>
            </label>
          </div>
          <div className="cmv2-output-sheet-grid" aria-label="Hojas de salida">
            {[
              ["frame_sheet_name", "Marco muestral", "base leída, exclusiones y marco operativo"],
              ["sample_calculation_sheet_name", "Cálculo muestral", "N, cuotas y supuestos de cálculo"],
              ["classroom_selection_sheet_name", "Selección de aulas", "aulas titulares, probabilidades y pesos"],
              ["replacement_sheet_name", "Aulas de reemplazo", "reemplazos por titular e impacto"],
              ["operational_routes_sheet_name", "Rutas operativas", "titular y cadena Rn.1, Rn.2... para campo"],
              ["agenda_sheet_name", "Agenda de aulas", "hoja preparada para coordinación de campo"],
              ["monitoring_handoff_sheet_name", "Plan para Monitoreo", "estado, enlace, QR y reemplazo usado"],
              ["methodology_sheet_name", "Sustento", "fuentes, advertencias y bitácora"],
            ].map(([key, label, detail]) => (
              <label key={key} className="cmv2-compact-field">
                <span>{label}</span>
                <input
                  value={String(config[key as keyof CalcMuestraWorkspacePublicationConfig] ?? "")}
                  placeholder={label}
                  onChange={(e) => updateConfig({ [key]: e.currentTarget.value } as Partial<CalcMuestraWorkspacePublicationConfig>)}
                />
                <em>{detail}</em>
              </label>
            ))}
          </div>
        </div>
        <aside className="cmv2-publication-checklist">
          {[
            ["include_workbook", "Excel de trabajo", "auditoría completa y tablas exportables"],
            ["include_methodology", "Reporte metodológico", "decisiones, fuentes y advertencias"],
            ["include_frame_audit", "Auditoría del marco", "exclusiones, columnas y consistencia"],
            ["include_sample_calculation", "Cálculo muestral", "N, cuotas, escenarios y supuestos"],
            ["include_classroom_selection", "Selección de aulas", selectionReady ? "titulares y probabilidades listas" : "pendiente de selección"],
            ["include_replacements", "Reemplazos por aula", replacementReady ? "impacto disponible" : "pendiente de simulación"],
          ].map(([key, label, detail]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(config[key as keyof CalcMuestraWorkspacePublicationConfig])}
                onChange={(e) => updateConfig({ [key]: e.currentTarget.checked } as Partial<CalcMuestraWorkspacePublicationConfig>)}
              />
              <span><strong>{label}</strong><em>{detail}</em></span>
            </label>
          ))}
        </aside>
      </div>
    </section>
  );
}

function ensureUniversitySourceBindings(
  mode: CalcMuestraWorkspaceSourceMode,
  current: CalcMuestraWorkspaceSourceBinding[] | undefined,
) {
  const defaults = UNIVERSITY_SOURCE_BINDING_DEFAULTS[mode] ?? UNIVERSITY_SOURCE_BINDING_DEFAULTS.base_madre;
  const byRole = new Map((current ?? []).map((item) => [item.role, item]));
  return defaults.map((item) => ({ ...item, ...(byRole.get(item.role) ?? {}) }));
}

function sourceRoleLabel(role: string) {
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

function expectedSheetRolesForSource(role: string) {
  if (role === "base_madre") return ["base_madre"];
  if (role === "estudiantes") return ["estudiantes", "base_madre"];
  if (role === "catalogo_curso_horario") return ["catalogo_curso_horario", "base_madre"];
  if (role === "inscripciones") return ["inscripciones", "base_madre"];
  if (role === "muestra_previa") return ["muestra_previa"];
  if (role === "agenda") return ["agenda"];
  return [];
}

function sourceBindingDiagnostics(binding: CalcMuestraWorkspaceSourceBinding) {
  return rowsFrom<CalcMuestraAulasSheetInspectionSheet>(binding.sheet_diagnostics);
}

function sourceBindingSelectedSheet(binding: CalcMuestraWorkspaceSourceBinding) {
  return binding.sheet_name?.trim() || binding.suggested_sheet?.trim() || binding.available_sheets?.[0] || "";
}

function sourceBindingSelectedDiagnostic(binding: CalcMuestraWorkspaceSourceBinding) {
  const selected = sourceBindingSelectedSheet(binding);
  return sourceBindingDiagnostics(binding).find((sheet) => sheet.name === selected);
}

function sourceBindingRole(binding: CalcMuestraWorkspaceSourceBinding) {
  return sourceBindingSelectedDiagnostic(binding)?.role ?? binding.detected_role ?? "";
}

function canBuildUniversityDeskFrameFromBindings(bindings: CalcMuestraWorkspaceSourceBinding[]) {
  const byRole = (role: string) => bindings.find((item) => item.role === role);
  const primary = byRole("estudiantes");
  if (!primary?.file_id || !sourceBindingCompatibleForBuild(primary)) return false;
  if (sourceBindingRole(primary) === "base_madre") return true;
  const inscripciones = byRole("inscripciones");
  return Boolean(inscripciones?.file_id && sourceBindingCompatibleForBuild(inscripciones));
}

function sourceBindingCompatibleForBuild(binding: CalcMuestraWorkspaceSourceBinding) {
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

function sourceBindingBuildMessage(binding: CalcMuestraWorkspaceSourceBinding) {
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

function chooseSourceSheet(binding: CalcMuestraWorkspaceSourceBinding, inspection: { sheets?: CalcMuestraAulasSheetInspectionSheet[]; suggested_sheet?: string; suggested_role?: string }) {
  const sheets = rowsFrom<CalcMuestraAulasSheetInspectionSheet>(inspection.sheets);
  if (!sheets.length) return binding.sheet_name ?? "";
  const current = binding.sheet_name?.trim();
  if (current && sheets.some((sheet) => sheet.name === current && expectedSheetRolesForSource(binding.role).includes(sheet.role ?? ""))) return current;
  const expected = expectedSheetRolesForSource(binding.role);
  const compatible = sheets
    .filter((sheet) => expected.includes(sheet.role ?? ""))
    .sort((a, b) => safeNumber(b.confidence, 0) - safeNumber(a.confidence, 0));
  if (compatible[0]?.name) return compatible[0].name;
  if (inspection.suggested_sheet && sheets.some((sheet) => sheet.name === inspection.suggested_sheet)) return inspection.suggested_sheet;
  if (current && sheets.some((sheet) => sheet.name === current)) return current;
  return sheets[0]?.name ?? "";
}

function sourceBindingPatchForSheet(binding: CalcMuestraWorkspaceSourceBinding, sheetName: string): Partial<CalcMuestraWorkspaceSourceBinding> {
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

function universityInspectedColumnOptions(workspace: CalcMuestraWorkspace) {
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

function universityColumnOptions(workspace: CalcMuestraWorkspace, aulasState: CalcMuestraAulasState | null) {
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

function ensureUniversityVariableMappings(
  current: CalcMuestraWorkspaceVariableMapping[] | undefined,
  detectedColumns: string[],
) {
  const byRole = new Map((current ?? []).map((item) => [item.role, item]));
  return UNIVERSITY_REQUIRED_VARIABLES.map((base) => {
    const existing = byRole.get(base.role);
    const inferredColumn = existing?.column ?? inferUniversityColumn(base.role, detectedColumns);
    return { ...base, column: inferredColumn };
  });
}

function reconcileUniversityVariableMappingsForColumns(
  current: CalcMuestraWorkspaceVariableMapping[] | undefined,
  detectedColumns: string[],
) {
  if (!detectedColumns.length) return ensureUniversityVariableMappings(current, detectedColumns);
  const columnSet = new Set(detectedColumns);
  return ensureUniversityVariableMappings(current, detectedColumns).map((row) => {
    const selected = row.column?.trim() ?? "";
    const suggested = inferUniversityColumn(row.role, detectedColumns);
    const shouldReplace = Boolean(suggested) && (!selected || !columnSet.has(selected) || isUniversityInternalColumnName(selected));
    if (shouldReplace) return { ...row, column: suggested };
    if (selected && !columnSet.has(selected)) return { ...row, column: "" };
    return row;
  });
}

function isUniversityInternalColumnName(value: string) {
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

function isUniversityUserFacingColumnName(value: string) {
  const normalized = normalizeColumnName(value);
  if (!normalized) return false;
  if (isUniversityInternalColumnName(value)) return false;
  if (/^(sex|gender)(top|n|share)\d+$/.test(normalized)) return false;
  if (/^(m|n|w)\d+$/.test(normalized)) return false;
  if (normalized.endsWith("hash") || normalized.endsWith("idinternal")) return false;
  return true;
}

function inferUniversityColumn(role: string, columns: string[]) {
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
    level: ["level", "nivelseguncreditos", "nivelseguncredito", "nivelporcreditos", "nivelcreditos", "nivelcurricular", "ciclo", "nivel", "anio", "ano", "semestre"],
    course_id: ["courseid", "cursoid", "codigocurso", "codcurso", "curso"],
    course_schedule_id: ["coursescheduleid", "cursohorario", "codigocursohorario", "idcursohorario", "seccionhorario", "nrc"],
    course_name: ["coursename", "nombredelcurso", "nombrecurso", "asignatura", "curso"],
    classroom: ["classroom", "aula", "seccion", "salon"],
    teacher: ["teacher", "docente", "profesor", "contacto"],
    schedule: ["schedule", "horario", "turno", "bloque"],
    modality: ["modality", "modalidad", "tipo"],
    condition: ["condition", "condicion", "condiciondelcurso", "condicionmatricula", "elegible", "habilitado", "valido", "regular"],
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
  for (const synonym of synonyms[role] ?? []) {
    const partial = normalized.find((item) => item.normalized.includes(synonym) || synonym.includes(item.normalized));
    if (partial) return partial.column;
  }
  return "";
}

function normalizeColumnName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function rowValueIsPresent(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function rowKeyForCandidate(row: Record<string, unknown>, candidate: string, requireValue = true) {
  const exact = row[candidate];
  if (exact !== undefined && (!requireValue || rowValueIsPresent(exact))) return candidate;
  const normalizedCandidate = normalizeColumnName(candidate);
  return Object.keys(row).find((key) =>
    normalizeColumnName(key) === normalizedCandidate && (!requireValue || rowValueIsPresent(row[key]))
  ) ?? "";
}

function rowKeyForCandidates(row: Record<string, unknown>, keys: string[], requireValue = true) {
  for (const key of keys) {
    const found = rowKeyForCandidate(row, key, requireValue);
    if (found) return found;
  }
  return "";
}

function rowValueForCandidate(row: Record<string, unknown>, candidate: string) {
  const key = rowKeyForCandidate(row, candidate);
  return key ? row[key] : undefined;
}

function rowValueForCandidates(row: Record<string, unknown>, keys: string[]) {
  const key = rowKeyForCandidates(row, keys);
  return key ? row[key] : undefined;
}

type UniversityObservedCategory = {
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

type CategoryLabeler = (raw: string, selectedKey?: string) => string;

const UNIVERSITY_CATEGORY_ROLES = new Set([
  "faculty",
  "program",
  "sex",
  "level",
  "condition",
  "schedule",
  "modality",
]);

const UNIVERSITY_CLASSROOM_CATEGORY_ROLES = new Set(["schedule", "modality"]);

const UNIVERSITY_ROLE_VALUE_KEYS: Record<string, string[]> = {
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

function isUniversityCategoryRole(role: string) {
  return UNIVERSITY_CATEGORY_ROLES.has(role);
}

function normalizeObservedCategoryKey(value: string) {
  return normalizeColumnName(String(value ?? "").trim());
}

function suggestUniversityCategoryLabel(role: string, raw: string) {
  const text = String(raw ?? "").trim();
  const key = normalizeObservedCategoryKey(text);
  if (!key) return "Sin dato";
  if (role === "sex") {
    if (["1", "h", "hom", "hombre", "masculino", "male", "m", "varon"].includes(key)) return "Hombre";
    if (["2", "mujer", "femenino", "female", "f", "fem"].includes(key)) return "Mujer";
    if (["o", "otro", "otra", "otros", "nonbinary", "nobinario", "nobinaria"].includes(key)) return "Otro";
    if (["na", "nd", "sindato", "noreporta", "prefieronodecir"].includes(key)) return "Sin dato";
  }
  if (role === "condition") {
    if (["1", "si", "s", "true", "regular", "valido", "valida", "elegible", "apto", "activa", "activo"].includes(key)) return "Elegible";
    if (["0", "no", "false", "irregular", "retirado", "retirada", "anulado", "anulada", "noelegible"].includes(key)) return "No elegible";
  }
  if (role === "modality") {
    if (["p", "presencial", "inaula"].includes(key)) return "Presencial";
    if (["v", "virtual", "online", "remoto", "remota"].includes(key)) return "Virtual";
    if (["m", "mixto", "mixta", "hibrido", "hibrida"].includes(key)) return "Mixta";
  }
  return text;
}

function findWorkspaceCategoryMapping(
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

function workspaceCategoryLabel(workspace: CalcMuestraWorkspace | undefined, role: string, raw: string, column?: string) {
  if (!workspace) return suggestUniversityCategoryLabel(role, raw);
  const saved = findWorkspaceCategoryMapping(workspace, role, raw, column);
  return saved?.label ?? suggestUniversityCategoryLabel(role, raw);
}

function universityCategoryKeysForMapping(row: CalcMuestraWorkspaceVariableMapping) {
  return Array.from(new Set([
    row.column ?? "",
    row.role,
    ...(UNIVERSITY_ROLE_VALUE_KEYS[row.role] ?? []),
  ].filter(Boolean)));
}

function categoryUnitLabel(role: string, fallback?: string) {
  const cleaned = String(fallback ?? "").trim().toLowerCase();
  if (cleaned.includes("elegible")) return "elegibles";
  if (cleaned.includes("aula")) return "aulas";
  if (cleaned.includes("fila")) return "filas";
  if (cleaned.includes("registro")) return "registros";
  if (UNIVERSITY_CLASSROOM_CATEGORY_ROLES.has(role)) return "aulas";
  return "filas";
}

function categoryCountSummaryLabel(unitLabel: string) {
  const normalized = categoryCountBaseLabel(unitLabel);
  if (normalized === "elegibles") return "Elegibles con valor";
  if (normalized === "aulas") return "Aulas con valor";
  if (normalized === "registros") return "Registros con valor";
  return "Filas con valor";
}

function categoryCountBaseLabel(unitLabel: string) {
  const normalized = String(unitLabel ?? "").trim().toLowerCase();
  if (normalized.includes("elegible")) return "elegibles";
  if (normalized.includes("aula")) return "aulas";
  if (normalized.includes("registro")) return "registros";
  return "filas con valor";
}

function observedCategoryCounts(rows: Array<Record<string, unknown>>, keys: string[]) {
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

function observedClassroomSexCategoryCounts(rows: Array<Record<string, unknown>>) {
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
    .map(([raw, count]) => ({ raw, count, observedColumn: "Sexo estimado en aulas" }))
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw, "es"));
}

function universityObservedCategoryRows(
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
        unitLabel: mapping.role === "sex" && useClassroomRows ? "elegibles" : useClassroomRows ? "aulas" : categoryUnitLabel(mapping.role),
        saved: Boolean(saved),
      };
    });
  });
}

function upsertWorkspaceCategoryValue(
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

type DescriptiveBarRow = {
  label: string;
  value: number;
  detail?: string;
};

function universityFacultyDiagnosticRows(
  totalComp: CalcMuestraComponente,
  populationRows: Array<Record<string, unknown>>,
  options: { sortMode?: CrossTableSortMode; maxRows?: number } = {},
): DescriptiveBarRow[] {
  const sortMode = options.sortMode ?? "faculty";
  const maxRows = options.maxRows ?? 10;
  const fromPopulation = summarizeRowsByKeys(populationRows, ["faculty", "facultad", "unidad_academica", "escuela"], undefined, sortMode, maxRows);
  if (fromPopulation.length) return fromPopulation;
  return (totalComp.marco.estratos ?? [])
    .map((row) => ({ label: row.label, value: safeNumber(row.N, 0), detail: "marco validado" }))
    .filter((row) => row.value > 0)
    .sort((a, b) => compareDescriptiveRows(a, b, sortMode))
    .slice(0, maxRows);
}

function universityCategoryProfileRows(
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

function frameCategoryProfileRows(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  role: string,
  labelFor?: CategoryLabeler,
  maxRows = 12,
  sortMode: CrossTableSortMode = "total",
): DescriptiveBarRow[] {
  const profiles = rowsFrom<Record<string, unknown>>((frame as Record<string, unknown> | null | undefined)?.category_profiles);
  return profiles
    .filter((row) => classroomRowText(row, ["role"]) === role)
    .map((row) => {
      const raw = classroomRowText(row, ["raw", "value", "category"]);
      const label = raw ? (labelFor ? labelFor(raw, classroomRowText(row, ["column"])) : raw) : "";
      return { label, value: classroomRowNumber(row, ["count"]), detail: classroomRowText(row, ["unit_label"]) };
    })
    .filter((row) => row.label && row.value > 0)
    .sort((a, b) => compareDescriptiveRows(a, b, sortMode))
    .slice(0, maxRows);
}

function frameCrossProfileTable(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  primaryRole: string,
  secondaryRole: string,
  workspace?: CalcMuestraWorkspace,
  maxRows = 12,
  maxColumns = 8,
  rowSort: CrossTableSortMode = "faculty",
  columnSort: CrossTableSortMode = "label",
): CrossTable {
  const profiles = rowsFrom<Record<string, unknown>>((frame as Record<string, unknown> | null | undefined)?.population_cross_profiles);
  const counts = new Map<string, Map<string, number>>();
  profiles.forEach((row) => {
    if (classroomRowText(row, ["primary_role"]) !== primaryRole) return;
    if (classroomRowText(row, ["secondary_role"]) !== secondaryRole) return;
    const primaryRaw = classroomRowText(row, ["primary_raw"]);
    const secondaryRaw = classroomRowText(row, ["secondary_raw"]);
    const primary = primaryRaw ? workspaceCategoryLabel(workspace, primaryRole, primaryRaw) : "";
    const secondary = secondaryRaw ? workspaceCategoryLabel(workspace, secondaryRole, secondaryRaw) : "";
    const count = classroomRowNumber(row, ["count"]);
    if (!primary || !secondary || count <= 0) return;
    const current = counts.get(primary) ?? new Map<string, number>();
    current.set(secondary, (current.get(secondary) ?? 0) + count);
    counts.set(primary, current);
  });
  const rowsOut = Array.from(counts.entries())
    .map(([label, valuesMap]) => ({
      label,
      values: Object.fromEntries(valuesMap.entries()),
      total: Array.from(valuesMap.values()).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => compareCrossTableRows(a, b, rowSort))
    .slice(0, maxRows);
  const columns = Array.from(new Set(rowsOut.flatMap((row) => Object.keys(row.values))))
    .map((column) => ({
      column,
      total: rowsOut.reduce((sum, row) => sum + (row.values[column] ?? 0), 0),
    }))
    .sort((a, b) => compareCrossTableColumns(a, b, columnSort))
    .slice(0, maxColumns)
    .map((item) => item.column);
  return {
    columns,
    rows: rowsOut.map((row) => ({
      ...row,
      values: Object.fromEntries(columns.map((column) => [column, row.values[column] ?? 0])),
    })),
  };
}

function frameCrossSecondaryRows(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  primaryRole: string,
  secondaryRole: string,
  primaryValue: string,
  workspace?: CalcMuestraWorkspace,
  maxRows = 10,
): DescriptiveBarRow[] {
  const table = frameCrossProfileTable(frame, primaryRole, secondaryRole, workspace, 99, 99, "faculty", "total");
  const targetKey = dashboardOptionKey(primaryValue);
  const rows = primaryValue
    ? table.rows.filter((row) => dashboardOptionKey(row.label) === targetKey)
    : table.rows;
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    Object.entries(row.values).forEach(([label, value]) => {
      const n = safeNumber(value, 0);
      if (n > 0) counts.set(label, (counts.get(label) ?? 0) + n);
    });
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => compareDescriptiveRows(a, b, "total"))
    .slice(0, maxRows);
}

function summarizeRowsByKeys(
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

function countDistinctByKeys(rows: Array<Record<string, unknown>>, keys: string[]) {
  const selectedKey = rows.reduce<string>((found, row) => found || rowKeyForCandidates(row, keys), "");
  if (!selectedKey) return 0;
  const values = new Set<string>();
  rows.forEach((row) => {
    const label = String(row[selectedKey] ?? "").trim();
    if (label) values.add(label);
  });
  return values.size;
}

function uniqueRowsByKeys<T extends Record<string, unknown>>(rows: T[], keys: string[]) {
  const selectedKey = rows.reduce<string>((found, row) => found || rowKeyForCandidates(row, keys), "");
  if (!selectedKey) return rows;
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = String(row[selectedKey] ?? "").trim();
    if (!value) return true;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function frameAuditValue(frame: CalcMuestraAulasState["frame"] | null | undefined, metric: string) {
  const auditRows = rowsFrom<Record<string, unknown>>(frame?.audit);
  const row = auditRows.find((item) => classroomRowText(item, ["metric"]) === metric);
  return row ? classroomRowText(row, ["value"]) : "";
}

function frameAuditNumber(frame: CalcMuestraAulasState["frame"] | null | undefined, metric: string) {
  return safeNumber(frameAuditValue(frame, metric), 0);
}

type ClassroomAuditCard = {
  label: string;
  value: string;
  detail: string;
};

function classroomInputModeLabel(value: string) {
  if (value === "dos_bases") return "Base + catálogo";
  if (value === "seleccion_existente") return "Selección previa";
  if (value === "base_madre") return "Base principal";
  if (!value) return "Base pendiente";
  const label = value.replace(/_/g, " ").trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Base pendiente";
}

function frameAuditCards(frame: CalcMuestraAulasState["frame"] | null | undefined): ClassroomAuditCard[] {
  if (!frame) return [];
  const inputMode = frameAuditValue(frame, "input_mode");
  const inputRows = frameAuditNumber(frame, "input_rows");
  const eligibleRows = frameAuditNumber(frame, "eligible_student_rows");
  const populationN = frameAuditNumber(frame, "population_n");
  const classroomRows = frameAuditNumber(frame, "classroom_included_n") || frameAuditNumber(frame, "classroom_n");
  const excludedRows = frameAuditNumber(frame, "excluded_rows");
  const uniqueDetail = eligibleRows && populationN && eligibleRows !== populationN
    ? `${fmtInt(eligibleRows)} filas elegibles se consolidan en estudiantes únicos.`
    : "Base que alimenta cuotas, balance y monitoreo.";
  return [
    {
      label: "Base recibida",
      value: classroomInputModeLabel(inputMode),
      detail: inputMode === "dos_bases"
        ? "Estudiantes vinculados con catálogo de cursos y horarios."
        : "La lectura parte del archivo institucional cargado.",
    },
    {
      label: "Filas del archivo",
      value: inputRows ? fmtInt(inputRows) : "pendiente",
      detail: "Filas originales antes de filtros y deduplicación.",
    },
    {
      label: "Estudiantes elegibles",
      value: populationN ? fmtInt(populationN) : eligibleRows ? fmtInt(eligibleRows) : "pendiente",
      detail: uniqueDetail,
    },
    {
      label: "Aulas seleccionables",
      value: classroomRows ? fmtInt(classroomRows) : "pendiente",
      detail: excludedRows ? `${fmtInt(excludedRows)} filas quedan fuera y auditadas.` : "Curso-horario/aula listo para selección.",
    },
  ];
}

function frameRelationAudit(frame: CalcMuestraAulasState["frame"] | null | undefined): Record<string, unknown> {
  const value = frame?.relation_audit ?? frame?.catalog_audit ?? {};
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function frameStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ok: "validado",
    revisar: "revisar",
    critico: "crítico",
    pendiente: "pendiente",
    sin_catalogo: "sin catálogo",
  };
  return labels[status] ?? status;
}

function recordNumber(record: Record<string, unknown>, key: string, fallback = 0) {
  const value = record[key];
  if (Array.isArray(value)) return safeNumber(value[0], fallback);
  return safeNumber(value, fallback);
}

function recordStringList(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  const text = String(value ?? "").trim();
  return text ? [text] : [];
}

function classroomRowBoolean(row: Record<string, unknown> | undefined, key: string) {
  const value = row?.[key];
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return ["true", "t", "1", "si", "sí", "yes", "y"].includes(text);
}

function firstRowValue(row: Record<string, unknown>, keys: string[]) {
  const value = rowValueForCandidates(row, keys);
  return rowValueIsPresent(value) ? String(value).trim() : "";
}

function buildCrossTable(
  rows: Array<Record<string, unknown>>,
  primaryKeys: string[],
  secondaryKeys: string[],
  maxRows = 10,
  maxColumns = 8,
  options?: CrossTableOptions,
): CrossTable {
  const counts = new Map<string, Map<string, number>>();
  rows.forEach((row) => {
    const primaryRaw = firstRowValue(row, primaryKeys);
    const secondaryRaw = firstRowValue(row, secondaryKeys);
    const primary = primaryRaw ? (options?.primary ? options.primary(primaryRaw) : primaryRaw) : "";
    const secondary = secondaryRaw ? (options?.secondary ? options.secondary(secondaryRaw) : secondaryRaw) : "";
    if (!primary || !secondary) return;
    const current = counts.get(primary) ?? new Map<string, number>();
    current.set(secondary, (current.get(secondary) ?? 0) + 1);
    counts.set(primary, current);
  });
  const rowsOut = Array.from(counts.entries())
    .map(([label, valuesMap]) => ({
      label,
      values: Object.fromEntries(valuesMap.entries()),
      total: Array.from(valuesMap.values()).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => compareCrossTableRows(a, b, options?.rowSort))
    .slice(0, maxRows);
  const columns = Array.from(new Set(rowsOut.flatMap((row) => Object.keys(row.values))))
    .map((column) => ({
      column,
      total: rowsOut.reduce((sum, row) => sum + (row.values[column] ?? 0), 0),
    }))
    .sort((a, b) => compareCrossTableColumns(a, b, options?.columnSort))
    .slice(0, maxColumns)
    .map((item) => item.column);
  return {
    columns,
    rows: rowsOut.map((row) => ({
      ...row,
      values: Object.fromEntries(columns.map((column) => [column, row.values[column] ?? 0])),
    })),
  };
}

function universityFacultySexCross(
  totalComp: CalcMuestraComponente,
  populationRows: Array<Record<string, unknown>>,
  workspace?: CalcMuestraWorkspace,
  profileTable?: CrossTable,
): CrossTable {
  const fromPopulation = buildCrossTable(
    populationRows,
    ["faculty", "facultad", "unidad_academica"],
    ["sex", "sexo", "genero"],
    12,
    4,
    {
      primary: (value) => workspaceCategoryLabel(workspace, "faculty", value),
      secondary: (value) => workspaceCategoryLabel(workspace, "sex", value),
      rowSort: "faculty",
      columnSort: "label",
    },
  );
  if (fromPopulation.rows.length) return fromPopulation;
  if (profileTable?.rows.length && profileTable.columns.length) return profileTable;
  const rows = (totalComp.marco.estratos ?? [])
    .map((estrato) => {
      const mujeres = safeNumber(estrato.N_a, 0);
      const hombres = safeNumber(estrato.N_b, 0);
      return {
        label: estrato.label,
        values: {
          Mujeres: mujeres,
          Hombres: hombres,
        },
        total: safeNumber(estrato.N, mujeres + hombres),
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => compareCrossTableRows(a, b, "faculty"))
    .slice(0, 12);
  return {
    columns: ["Mujeres", "Hombres"],
    rows,
  };
}

function universityClassroomSizeRows(rows: Array<Record<string, unknown>>): DescriptiveBarRow[] {
  if (!rows.length) return [];
  const bins = [
    { label: "Hasta 20", min: 0, max: 20, value: 0 },
    { label: "21 a 35", min: 21, max: 35, value: 0 },
    { label: "36 a 50", min: 36, max: 50, value: 0 },
    { label: "51 o más", min: 51, max: Infinity, value: 0 },
  ];
  rows.forEach((row) => {
    const size = classroomRowNumber(row, ["eligible_n", "elegibles", "n_elegibles", "students_n", "matriculados", "total"]);
    const bin = bins.find((item) => size >= item.min && size <= item.max);
    if (bin) bin.value += 1;
  });
  return bins.filter((row) => row.value > 0);
}

function DescriptiveBarPanel({
  title,
  rows,
  empty,
  emptyState,
}: {
  title: string;
  rows: DescriptiveBarRow[];
  empty: string;
  emptyState?: DescriptiveEmptyState;
}) {
  const visible = rows.filter((row) => row.value > 0).slice(0, 8);
  const max = visible.reduce((peak, row) => Math.max(peak, row.value), 0) || 1;
  const state = emptyState ?? {
    badge: "Pendiente",
    title: empty,
    detail: "Todavía no hay datos suficientes para construir este gráfico.",
    tone: "waiting" as const,
  };
  return (
    <article className={`cmv2-descriptive-panel ${visible.length ? "" : `is-empty is-${state.tone ?? "waiting"}`}`}>
      <header>
        <strong>{title}</strong>
        <span>{visible.length ? `${fmtInt(visible.reduce((sum, row) => sum + row.value, 0))} registros` : state.badge}</span>
      </header>
      {visible.length ? (
        <div className="cmv2-descriptive-bars">
          {visible.map((row) => (
            <div key={row.label} className="cmv2-descriptive-row">
              <span>{row.label}</span>
              <div><i style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} /></div>
              <strong>{fmtInt(row.value)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <DescriptiveEmptyNotice state={state} />
      )}
    </article>
  );
}

type UniversityCalculationSummary = {
  id: string;
  label: string;
  actor: string;
  marco: number;
  formula: number | null;
  rounded: number | null;
  finalN: number;
  operative: number;
  oversample: number;
  aulasBase: number | null;
  aulasTotal: number | null;
  precision: number | null;
  hasResult: boolean;
  interpretation: string;
};

function universityCalculationSummaries(
  componentes: [CalcMuestraComponente, CalcMuestraComponente],
  workspace: CalcMuestraWorkspace,
): UniversityCalculationSummary[] {
  const scenarios = workspace.escenarios.length ? workspace.escenarios : ESCENARIOS_OPINION;
  const aulasConfig = normalizeUniversityAulasConfig(workspace.aulas_config);
  return componentes.map((comp) => {
    const scenario = scenarios.find((e) => e.component_id === comp.id);
    const formula = comp.resultado?.n_teorico ?? componentFormulaBase(comp);
    const rounded = roundUpTo(formula, scenario?.redondeo_multiplo ?? 100);
    const finalN = safeNumber(comp.resultado?.n_objetivo, 0) ||
      safeNumber(comp.meta.valor, 0) ||
      safeNumber(rounded, 0);
    const oversample = comp.resultado?.sobremuestra ??
      (finalN > 0 ? Math.ceil(finalN * safeNumber(comp.parametros.oversample_pct, 0)) : 0);
    const operative = safeNumber(comp.resultado?.n_operativo, 0) ||
      (finalN > 0 ? finalN + oversample : 0);
    const aulasBaseEstimated = estimateClassroomBase(comp);
    const aulasBase = safeNumber(comp.resultado?.aulas_base_total, Number.NaN);
    const extra = safeNumber(comp.resultado?.aulas_extra_total, Number.NaN);
    const aulasBaseFinal = Number.isFinite(aulasBase) ? aulasBase : aulasBaseEstimated;
    const aulasTotal = safeNumber(comp.resultado?.aulas_total, Number.NaN);
    const aulasTotalFinal = Number.isFinite(aulasTotal)
      ? aulasTotal
      : aulasBaseFinal == null
        ? null
        : aulasBaseFinal + (Number.isFinite(extra) ? extra : estimateOperationalExtra(comp.marco.estratos ?? [], aulasConfig));
    const precision = comp.tecnica === "prob_estratificado_independiente"
      ? null
      : comp.resultado?.precision_alcanzada ?? calcEPreview(finalN, comp.marco.marco_validado, comp.parametros.p, comp.parametros.z, comp.parametros.deff);
    return {
      id: comp.id,
      label: proposalShortLabel(comp),
      actor: comp.actor,
      marco: safeNumber(comp.marco.marco_validado),
      formula,
      rounded,
      finalN,
      operative,
      oversample,
      aulasBase: aulasBaseFinal,
      aulasTotal: aulasTotalFinal,
      precision,
      hasResult: Boolean(comp.resultado),
      interpretation: comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID
        ? "Sirve para defender cuotas mínimas por facultad y evitar que facultades pequeñas queden absorbidas por el total."
        : "Sirve como lectura global del error esperado y del tamaño total que se necesita alcanzar.",
    };
  });
}

function UniversityCalculationWorkflowPanel({
  workspace,
  totalComp,
  facultyComp,
  aulasState,
  marcoReady,
  calculationReady,
  comparisonReady,
  selectionReady,
  onCalcular,
  calculando,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
  marcoReady: boolean;
  calculationReady: boolean;
  comparisonReady: boolean;
  selectionReady: boolean;
  onCalcular: () => void;
  calculando: boolean;
}) {
  const frame = aulasState?.frame ?? null;
  const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
  const classroomRows = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
  const summaries = universityCalculationSummaries([totalComp, facultyComp], workspace);
  const requiredVariables = UNIVERSITY_REQUIRED_VARIABLES.filter((row) => row.required);
  const mappedRequired = requiredVariables.filter((required) =>
    (workspace.variable_mappings ?? []).some((row) => row.role === required.role && row.column),
  ).length;
  const aulasConfig = normalizeUniversityAulasConfig(workspace.aulas_config);
  const populationN = populationRows.length ||
    frameAuditNumber(frame, "population_n") ||
    frameAuditNumber(frame, "students_n") ||
    safeNumber(totalComp.marco.marco_validado);
  const classroomN = classroomRows.length ||
    frameAuditNumber(frame, "classroom_n") ||
    frameAuditNumber(frame, "aulas_n");
  const faculties = (totalComp.marco.estratos ?? []).filter((row) => safeNumber(row.N) > 0).length ||
    countDistinctByKeys(populationRows, ["faculty", "facultad"]);
  const targetN = Math.max(...summaries.map((row) => row.finalN), 0);
  const targetAulas = Math.max(...summaries.map((row) => safeNumber(row.aulasTotal, 0)), 0);
  const eligibilityReady = Boolean(aulasConfig.accepted_conditions?.length) &&
    safeNumber(aulasConfig.min_elegibles_aula, 0) > 0;
  const nextStep = !marcoReady
    ? {
        label: "Construir y validar marco",
        detail: "Vuelve a Marco para confirmar relación entre bases, elegibilidad y distribución antes de calcular.",
      }
    : !eligibilityReady
      ? {
          label: "Completar elegibilidad",
          detail: "Define condición válida, pregrado/adultez y mínimo de elegibles por aula en Definición.",
        }
      : !calculationReady
        ? {
            label: "Calcular muestra",
            detail: "Usa Calcular muestra para obtener tamaño total, distribución por facultad y aulas esperadas.",
          }
        : !comparisonReady
          ? {
              label: "Pasar a Aulas",
              detail: "Con tamaño y cuotas listas, compara métodos para decidir aulas titulares y reemplazos.",
            }
          : !selectionReady
            ? {
                label: "Elegir selección",
                detail: "La comparación ya existe; falta fijar aulas titulares y sus rutas de reemplazo.",
              }
            : {
                label: "Preparar salidas",
                detail: "La muestra tiene selección; revisa Excel, agenda y pase a Monitoreo.",
              };
  const steps: Array<{
    label: string;
    value: string;
    detail: string;
    ready: boolean;
    working?: boolean;
    icon: typeof Database;
  }> = [
    {
      label: "Marco leído",
      value: `${populationN ? fmtInt(populationN) : "pendiente"} estudiantes · ${classroomN ? fmtInt(classroomN) : "pendiente"} aulas`,
      detail: "Debe venir de la base institucional ya colapsada o de bases conectables validadas.",
      ready: marcoReady,
      working: Boolean(populationN || classroomN),
      icon: Database,
    },
    {
      label: "Variables listas",
      value: `${mappedRequired}/${requiredVariables.length} necesarias`,
      detail: "Identificador, facultad, curso, horario, sexo y condición alimentan cuotas y aulas.",
      ready: mappedRequired === requiredVariables.length,
      working: mappedRequired > 0,
      icon: SlidersHorizontal,
    },
    {
      label: "Elegibilidad",
      value: eligibilityReady ? "reglas activas" : "por definir",
      detail: "Estas reglas definen población objetivo; no deben corregirse al final en la selección de aulas.",
      ready: eligibilityReady,
      working: marcoReady,
      icon: Target,
    },
    {
      label: "Propuestas",
      value: targetN ? `${fmtInt(targetN)} casos · ${targetAulas ? fmtInt(targetAulas) : "—"} aulas` : "pendiente",
      detail: "Aquí se fija el N y la traducción a aulas antes de elegir titulares y reemplazos.",
      ready: calculationReady,
      working: marcoReady,
      icon: Calculator,
    },
    {
      label: "Selección posterior",
      value: selectionReady ? "titulares y reemplazos listos" : comparisonReady ? "métodos comparados" : "pendiente",
      detail: "La pestaña Aulas usa este tamaño como objetivo; no recalcula la muestra.",
      ready: selectionReady,
      working: comparisonReady,
      icon: Grid3X3,
    },
  ];
  return (
    <section className="cmv2-panel cmv2-guided-workspace-panel">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Ruta del cálculo</span>
          <strong>Qué debería ver y decidir en esta etapa</strong>
        </div>
        <span className="cmv2-pill-soft">{faculties ? `${fmtInt(faculties)} facultades detectadas` : "facultades pendientes"}</span>
      </div>
      <div className="cmv2-calculation-dashboard">
        <Metric label="Población objetivo" value={populationN ? fmtInt(populationN) : "pendiente"} />
        <Metric label="Aulas del marco" value={classroomN ? fmtInt(classroomN) : "pendiente"} />
        <Metric label="N por calcular" value={targetN ? fmtInt(targetN) : "pendiente"} />
        <Metric label="Aulas estimadas" value={targetAulas ? fmtInt(targetAulas) : "pendiente"} />
      </div>
      <div className="cmv2-next-step-card">
        <span><ArrowRight size={16} /></span>
        <div>
          <small>Próximo paso recomendado</small>
          <strong>{nextStep.label}</strong>
          <p>{nextStep.detail}</p>
        </div>
        {nextStep.label === "Calcular muestra" && (
          <div className="cmv2-next-step-card-actions">
            <button type="button" className="cmv2-primary" onClick={onCalcular} disabled={!marcoReady || !eligibilityReady || calculando}>
              {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
              Calcular muestra
            </button>
          </div>
        )}
      </div>
      <div className="cmv2-workflow-grid">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article key={step.label} className={`cmv2-workflow-card ${step.ready ? "is-ready" : step.working ? "is-working" : "is-pending"}`}>
              <span className="cmv2-workflow-index">{index + 1}</span>
              <div className="cmv2-workflow-icon"><Icon size={16} /></div>
              <div>
                <small>{step.label}</small>
                <strong>{step.value}</strong>
                <p>{step.detail}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UniversityCalculationScenarioPanel({
  componentes,
  workspace,
  marcoReady,
  onCalcular,
  calculando,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  workspace: CalcMuestraWorkspace;
  marcoReady: boolean;
  onCalcular: () => void;
  calculando: boolean;
}) {
  const summaries = universityCalculationSummaries(componentes, workspace);
  const facultyRows = universityDistributionRows(componentes[1]);
  const classroomRows = componentes[1].resultado?.aulas_por_estrato ?? componentes[0].resultado?.aulas_por_estrato ?? [];
  const maxFacultyN = Math.max(...facultyRows.map((row) => row.n), 1);
  const hasCalculation = summaries.some((row) => row.hasResult || row.finalN > 0);
  return (
    <section className="cmv2-panel cmv2-calc-scenario-panel">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Lectura del cálculo</span>
          <strong>De N calculado a cuotas y aulas esperadas</strong>
        </div>
        <div className="cmv2-panel-head-actions">
          <button type="button" className="cmv2-primary" onClick={onCalcular} disabled={!marcoReady || calculando}>
            {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
            {hasCalculation ? "Recalcular muestra" : "Calcular muestra"}
          </button>
          <span className="cmv2-pill-soft">{hasCalculation ? "cálculo legible" : marcoReady ? "lista para calcular" : "requiere marco"}</span>
        </div>
      </div>
      {!hasCalculation ? (
        <ClassroomEmptyState
          icon={Calculator}
          title={marcoReady ? "Todavía no hay cálculo de muestra" : "Primero falta validar el marco"}
          detail={marcoReady
            ? "Cuando ejecutes Calcular muestra, esta pestaña mostrará tamaño total, distribución por facultad y aulas esperadas."
            : "Carga y valida la base institucional para que el cálculo no dependa de números escritos a mano."}
        />
      ) : (
        <>
          <div className="cmv2-calc-scenario-grid">
            {summaries.map((summary) => (
              <article key={summary.id} className="cmv2-calc-scenario-card">
                <div>
                  <span className="cmv2-eyebrow">{summary.label}</span>
                  <h3>{summary.actor}</h3>
                  <p>{summary.interpretation}</p>
                </div>
                <div className="cmv2-calc-scenario-metrics">
                  <Metric label="Marco" value={summary.marco ? fmtInt(summary.marco) : "pendiente"} />
                  <Metric label="n fórmula" value={fmtInt(summary.formula)} />
                  <Metric label="n final" value={summary.finalN ? fmtInt(summary.finalN) : "pendiente"} />
                  <Metric label="Con sobremuestra" value={summary.operative ? fmtInt(summary.operative) : "pendiente"} />
                  <Metric label="Aulas base" value={summary.aulasBase ? fmtInt(summary.aulasBase) : "pendiente"} />
                  <Metric label="Aulas con reemplazos" value={summary.aulasTotal ? fmtInt(summary.aulasTotal) : "pendiente"} />
                </div>
              </article>
            ))}
          </div>
          <div className="cmv2-calc-reading-grid">
            <article className="cmv2-calc-reading-card">
              <span className="cmv2-eyebrow">Cuotas por facultad</span>
              <strong>Qué tamaño debería aportar cada dominio</strong>
              {facultyRows.length ? (
                <div className="cmv2-calc-distribution">
                  {facultyRows.slice(0, 10).map((row) => (
                    <div key={row.facultad}>
                      <span>{row.facultad}</span>
                      <i><b style={{ width: `${Math.max(4, (row.n / maxFacultyN) * 100)}%` }} /></i>
                      <strong>{fmtInt(row.n)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Después de calcular se mostrará el N por facultad, no solo el total global.</p>
              )}
            </article>
            <article className="cmv2-calc-reading-card">
              <span className="cmv2-eyebrow">Traducción a aulas</span>
              <strong>Cuántas aulas requiere cada dominio</strong>
              {classroomRows.length ? (
                <div className="cmv2-table-wrap cmv2-compact-table-wrap">
                  <table className="cmv2-table cmv2-table--university">
                    <thead>
                      <tr>
                        <th>Facultad</th>
                        <th>Cuota</th>
                        <th>Aulas base</th>
                        <th>Reemplazos</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classroomRows.slice(0, 8).map((row) => (
                        <tr key={row.estrato}>
                          <td><strong>{row.estrato}</strong></td>
                          <td>{fmtInt(row.cuota)}</td>
                          <td>{fmtInt(row.aulas_base)}</td>
                          <td>{fmtInt(row.aulas_reemplazo + safeNumber(row.aulas_extra_operativas, 0))}</td>
                          <td><strong>{fmtInt(row.aulas_total)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>La conversión a aulas aparece cuando el cálculo ya conoce cuota, rendimiento esperado y reemplazos operativos.</p>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  );
}

function UniversityCalculationAssumptionGuide({
  workspace,
  totalComp,
  facultyComp,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
}) {
  const aulasConfig = normalizeUniversityAulasConfig(workspace.aulas_config);
  const blocks = [
    {
      label: "Precisión",
      value: `error global ${fmtPct(totalComp.parametros.e)} · facultades ${facultyComp.tecnica === "prob_estratificado_independiente" ? "por fila" : fmtPct(facultyComp.parametros.e)}`,
      detail: "Baja el error solo si necesitas más precisión y aceptas un N mayor.",
      icon: Target,
    },
    {
      label: "Variabilidad",
      value: `p=${totalComp.parametros.p} · DEFF=${totalComp.parametros.deff}`,
      detail: "p y DEFF protegen incertidumbre y similitud dentro de aulas; subirlos incrementa N.",
      icon: Gauge,
    },
    {
      label: "Campo",
      value: `sobremuestra ${fmtPct(totalComp.parametros.oversample_pct)} · respuesta ${fmtPct(totalComp.parametros.tasa_respuesta)}`,
      detail: "La sobremuestra cubre no respuesta esperada; no reemplaza las rutas de reemplazo por aula.",
      icon: Users,
    },
    {
      label: "Rendimiento por aula",
      value: `${totalComp.parametros.promedio_conglomerado} por aula · tau ${totalComp.parametros.tau}`,
      detail: "Define cuántos estudiantes efectivos esperamos captar por curso y horario.",
      icon: Grid3X3,
    },
    {
      label: "Reemplazos",
      value: `${aulasConfig.bolsas_reemplazo} niveles · +${aulasConfig.aulas_extra_operativas_default} extra por dominio`,
      detail: "Son aulas equivalentes para campo; Monitoreo las activa sin rediseñar el marco.",
      icon: RefreshCw,
    },
    {
      label: "Selector posterior",
      value: classroomMethodLabel(aulasConfig.selector_engine ?? aulasConfig.selector),
      detail: "El método de aulas se decide después de fijar N y cuotas, no antes.",
      icon: SlidersHorizontal,
    },
  ];
  return (
    <section className="cmv2-panel cmv2-assumption-guide-panel">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Guía de supuestos</span>
          <strong>Qué mueve el tamaño de muestra y qué mueve aulas</strong>
        </div>
        <span className="cmv2-pill-soft">editar con intención</span>
      </div>
      <div className="cmv2-assumption-guide-grid">
        {blocks.map((block) => {
          const Icon = block.icon;
          return (
            <article key={block.label} className="cmv2-assumption-guide-card">
              <span><Icon size={15} /></span>
              <div>
                <small>{block.label}</small>
                <strong>{block.value}</strong>
                <p>{block.detail}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UniversityCalculationAssumptionsPanel({
  totalComp,
  facultyComp,
  onComponente,
}: {
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const totalTarget = safeNumber(totalComp.resultado?.n_objetivo, 0);
  const facultyTarget = safeNumber(facultyComp.resultado?.n_objetivo, 0);
  const aulasBase = Math.max(
    safeNumber(totalComp.resultado?.aulas_base_total, 0),
    safeNumber(facultyComp.resultado?.aulas_base_total, 0),
  );
  const aulasTotal = Math.max(
    safeNumber(totalComp.resultado?.aulas_total, 0),
    safeNumber(facultyComp.resultado?.aulas_total, 0),
  );
  return (
    <section className="cmv2-panel cmv2-university-edit-panel">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Ajustes del cálculo</span>
          <strong>Supuestos que mueven N y aulas</strong>
        </div>
        <span className="cmv2-pill-soft">antes de elegir aulas titulares</span>
      </div>
      <div className="cmv2-classroom-stat-grid">
        <Metric label="N universidad" value={totalTarget ? fmtInt(totalTarget) : "pendiente"} />
        <Metric label="N facultades" value={facultyTarget ? fmtInt(facultyTarget) : "pendiente"} />
        <Metric label="Aulas base" value={aulasBase ? fmtInt(aulasBase) : "pendiente"} />
        <Metric label="Aulas con reemplazos" value={aulasTotal ? fmtInt(aulasTotal) : "pendiente"} />
      </div>
      <div className="cmv2-university-edit-layout">
        <UniversityRevampParametrosPanel
          totalComp={totalComp}
          facultyComp={facultyComp}
          onComponente={onComponente}
        />
        <div className="cmv2-classroom-risk-list">
          <div className="is-ok">
            <small>Orden correcto</small>
            <strong>primero cuotas, luego aulas</strong>
            <span>El tamaño por facultad se fija aquí; la pestaña Aulas convierte ese objetivo en cursos, horarios y reemplazos.</span>
          </div>
          <div className="is-media">
            <small>Impacto operativo</small>
            <strong>sobremuestra no es reserva</strong>
            <span>La sobremuestra protege respuesta esperada; las rutas Rn.1, Rn.2... son reemplazos trazables para campo.</span>
          </div>
          <div className="is-media">
            <small>Supuestos sensibles</small>
            <strong>error, DEFF y p esperada</strong>
            <span>Al cambiar estos valores se debe recalcular antes de comparar métodos o generar selección.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function UniversityOutputWorkflowPanel({
  workspace,
  totalComp,
  facultyComp,
  aulasState,
  marcoReady,
  calculationReady,
  comparisonReady,
  selectionReady,
  replacementReady,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
  marcoReady: boolean;
  calculationReady: boolean;
  comparisonReady: boolean;
  selectionReady: boolean;
  replacementReady: boolean;
}) {
  const publication = workspace.publication_config ?? {};
  const selectionRows = rowsFrom<Record<string, unknown>>(aulasState?.selection?.selection);
  const m1Rows = selectionRows.filter((row) => classroomRowText(row, ["wave"]) === "M1");
  const reserveRows = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "chain_reserve" || (classroomRowText(row, ["wave"]) !== "M1" && classroomRowText(row, ["sample_role"]) !== "extra_reserve_pool"));
  const extraReserveRows = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "extra_reserve_pool");
  const totalN = Math.max(safeNumber(totalComp.resultado?.n_objetivo, 0), safeNumber(facultyComp.resultado?.n_objetivo, 0));
  const workbookConfigured = publication.include_workbook !== false;
  const sheetsConfigured = Boolean(publication.google_sheets_enabled || publication.spreadsheet_id || publication.spreadsheet_url);
  const workbookReady = workbookConfigured && calculationReady && selectionReady;
  const sheetsReady = sheetsConfigured && calculationReady && selectionReady;
  const nextStep = !calculationReady
    ? "Calcular muestra para habilitar tablas de N y cuotas."
    : !selectionReady
      ? comparisonReady
        ? "Fijar aulas titulares desde el método recomendado."
        : "Ir a Aulas y comparar métodos antes de exportar selección."
      : !sheetsReady
        ? "Configurar si los entregables saldrán a Excel local, Sheets interno o Sheets cliente."
        : "Revisar privacidad de identificadores y dejar listo el pase a Monitoreo.";
  const deliverables: Array<{
    label: string;
    value: string;
    detail: string;
    ready: boolean;
    working?: boolean;
    icon: typeof Database;
  }> = [
    {
      label: "Auditoría del marco",
      value: marcoReady ? "lista" : "pendiente",
      detail: "Incluye exclusiones, relación entre bases, columnas usadas y firma del marco.",
      ready: marcoReady,
      icon: Database,
    },
    {
      label: "Cálculo muestral",
      value: totalN ? `${fmtInt(totalN)} casos` : "pendiente",
      detail: "Produce N universidad, cuotas por facultad y conversión a aulas.",
      ready: calculationReady,
      working: marcoReady,
      icon: Calculator,
    },
    {
      label: "Selección de aulas",
      value: m1Rows.length ? `${fmtInt(m1Rows.length)} titulares` : comparisonReady ? "método comparado" : "pendiente",
      detail: "Titulares, probabilidades, pesos, balance y advertencias metodológicas.",
      ready: selectionReady,
      working: comparisonReady,
      icon: Grid3X3,
    },
    {
      label: "Reemplazos por titular",
      value: reserveRows.length ? `${fmtInt(reserveRows.length)} reemplazos` : "pendiente",
      detail: extraReserveRows.length ? `Rutas Rn.1, Rn.2... y ${fmtInt(extraReserveRows.length)} aulas en reserva extra separada.` : "Rutas Rn.1, Rn.2... y simulación de impacto antes/después de reemplazar.",
      ready: replacementReady,
      working: selectionReady,
      icon: RefreshCw,
    },
    {
      label: "Publicación",
      value: sheetsReady ? "Sheets listo" : workbookReady ? "Excel listo" : sheetsConfigured ? "Sheets configurado" : workbookConfigured ? "Excel configurado" : "pendiente",
      detail: "Define Excel de trabajo, hoja interna, hoja cliente y qué tablas se publican.",
      ready: sheetsReady || workbookReady,
      working: (workbookConfigured || sheetsConfigured) && (calculationReady || selectionReady),
      icon: FileText,
    },
    {
      label: "Privacidad",
      value: publication.pii_policy === "interno_trazabilidad" ? "trazabilidad interna" : "cliente sin identificadores",
      detail: "El cliente recibe agregados; los identificadores solo ayudan a controlar duplicados y cobertura.",
      ready: Boolean(publication.pii_policy) && selectionReady,
      working: marcoReady,
      icon: CheckCircle2,
    },
  ];
  return (
    <section className="cmv2-panel cmv2-output-workflow-panel">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Checklist de salidas</span>
          <strong>Qué debe quedar exportable al cerrar el diseño</strong>
        </div>
        <span className="cmv2-pill-soft">{sheetsReady ? "Sheets listo" : sheetsConfigured ? "Sheets configurado" : workbookConfigured ? "Excel configurado" : "Excel/Sheets por definir"}</span>
      </div>
      <div className="cmv2-calculation-dashboard">
        <Metric label="Excel de trabajo" value={workbookReady ? "preparado" : workbookConfigured ? "configurado" : "pendiente"} />
        <Metric label="Sheets" value={sheetsReady ? "preparado" : sheetsConfigured ? "configurado" : "opcional"} />
        <Metric label="Aulas titulares" value={m1Rows.length ? fmtInt(m1Rows.length) : "pendiente"} />
        <Metric label="Reemplazos" value={reserveRows.length ? fmtInt(reserveRows.length) : "pendiente"} />
      </div>
      <div className="cmv2-next-step-card">
        <span><ArrowRight size={16} /></span>
        <div>
          <small>Antes de exportar</small>
          <strong>{nextStep}</strong>
          <p>La salida no debería mezclar cálculo, selección y monitoreo: cada tabla conserva su origen.</p>
        </div>
      </div>
      <div className="cmv2-workflow-grid cmv2-workflow-grid--outputs">
        {deliverables.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={`cmv2-workflow-card ${item.ready ? "is-ready" : item.working ? "is-working" : "is-pending"}`}>
              <div className="cmv2-workflow-icon"><Icon size={16} /></div>
              <div>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UniversityOutputReadinessPanel({
  workspace,
  totalComp,
  facultyComp,
  aulasState,
  calculationReady,
  selectionReady,
  replacementReady,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
  calculationReady: boolean;
  selectionReady: boolean;
  replacementReady: boolean;
}) {
  const publication = workspace.publication_config ?? {};
  const frameReady = classroomFrameReady(aulasState);
  const comparisonReady = classroomComparisonReady(aulasState);
  const methodologyReady = Boolean(aulasState?.selection?.methodological_sources?.length || aulasState?.selection?.methodology);
  const sheets = [
    {
      label: "Perfil del marco",
      sheet: publication.frame_sheet_name || "Perfil del marco",
      ready: frameReady,
      detail: "Universo, aulas, exclusiones, elegibilidad y validación entre bases.",
    },
    {
      label: "Cálculo muestral",
      sheet: publication.sample_calculation_sheet_name || "Cálculo muestral",
      ready: calculationReady,
      detail: "N fórmula, N final, sobremuestra, cuotas por facultad y aulas esperadas.",
    },
    {
      label: "Comparador de métodos",
      sheet: "Comparador de métodos",
      ready: comparisonReady,
      detail: "Calidad de representatividad, repetidos, cobertura, balance y recomendación.",
    },
    {
      label: "Aulas titulares",
      sheet: publication.classroom_selection_sheet_name || "Selección de aulas",
      ready: selectionReady,
      detail: "Aulas que se intentan primero, probabilidades, pesos, semilla y firma del marco.",
    },
    {
      label: "Reemplazos por titular",
      sheet: publication.replacement_sheet_name || "Reemplazos sugeridos",
      ready: replacementReady,
      detail: "Rutas Rn.1, Rn.2... e impacto antes/después de activar un reemplazo.",
    },
    {
      label: "Sustento metodológico",
      sheet: publication.methodology_sheet_name || "Sustento metodológico",
      ready: methodologyReady || comparisonReady || selectionReady,
      detail: "Fuentes oficiales, académicas y técnicas para cada decisión activa.",
    },
  ];
  const selectedRows = rowsFrom<Record<string, unknown>>(aulasState?.selection?.selection);
  const nTarget = Math.max(safeNumber(totalComp.resultado?.n_objetivo, 0), safeNumber(facultyComp.resultado?.n_objetivo, 0));
  return (
    <section className="cmv2-panel cmv2-output-readiness-panel">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Excel y hojas</span>
          <strong>Qué tabla sale, de dónde viene y cuándo está lista</strong>
        </div>
        <span className="cmv2-pill-soft">{publication.publication_mode === "separate_outputs" ? "salidas separadas" : "un archivo, varias hojas"}</span>
      </div>
      <div className="cmv2-calculation-dashboard">
        <Metric label="N final" value={nTarget ? fmtInt(nTarget) : "pendiente"} />
        <Metric label="Aulas seleccionadas" value={selectedRows.length ? fmtInt(selectedRows.length) : "pendiente"} />
        <Metric label="Cliente" value={publication.pii_policy === "interno_trazabilidad" ? "revisar identificadores" : "sin identificadores"} />
        <Metric label="Modo" value={publication.google_sheets_enabled ? "Sheets" : "Excel local"} />
      </div>
      <div className="cmv2-output-sheet-grid">
        {sheets.map((sheet) => (
          <article key={sheet.label} className={`cmv2-output-sheet-card ${sheet.ready ? "is-ready" : "is-pending"}`}>
            <span>{sheet.ready ? <CheckCircle2 size={15} /> : <CirclePendingIcon />}</span>
            <div>
              <small>{sheet.label}</small>
              <strong>{sheet.sheet}</strong>
              <p>{sheet.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function UniversityMonitoringHandoffPanel({ aulasState }: { aulasState: CalcMuestraAulasState | null }) {
  const selection = classroomSelectionForState(aulasState);
  const selectionReady = classroomSelectionReady(aulasState);
  const comparisonReady = classroomComparisonReady(aulasState);
  const replacementReady = classroomReplacementReady(aulasState);
  const comparison = classroomComparisonForState(aulasState);
  const replacementSimulation = classroomReplacementSimulationForState(aulasState);
  const m1Rows = classroomM1RowsForState(aulasState);
  const reserveRows = classroomReserveRowsForState(aulasState);
  const methodLabel = selectionReady && selection
    ? classroomMethodLabel(selection.selector_engine_used ?? selection.selector_engine ?? "")
    : comparisonReady
      ? "comparado, faltan titulares"
      : comparison?.recommendation?.method_label ?? "pendiente";
  return (
    <section className="cmv2-panel cmv2-university-results">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Seguimiento</span>
          <strong>Qué pasa de Calc-Muestra a Monitoreo</strong>
        </div>
        <span className="cmv2-pill-soft">Monitoreo no rediseña la muestra</span>
      </div>
      <div className="cmv2-classroom-stat-grid">
        <Metric label="Aulas titulares" value={m1Rows.length ? fmtInt(m1Rows.length) : "pendiente"} />
        <Metric label="Aulas reemplazo" value={reserveRows.length ? fmtInt(reserveRows.length) : "pendiente"} />
        <Metric label="Método" value={methodLabel} />
        <Metric label="Simulación" value={replacementReady ? "disponible" : replacementSimulation ? "sin sugerencias" : "pendiente"} />
      </div>
      <AulasApplicationFlow
        tone="calc-muestra"
        current="muestra"
        compact
        showEngineOutputs
        title={selectionReady ? "Plan listo para fichas QR" : "Completa la selección antes de emitir fichas"}
        summary="Esta salida entrega una agenda de aulas para hostigamiento: cada fila conserva aula, curso, horario, selección y trazabilidad para que el motor QR/PDF prepare fichas y Monitoreo lea el avance."
        metrics={[
          { label: "Agenda", value: selectionReady ? `${fmtInt(m1Rows.length + reserveRows.length)} aulas` : "pendiente", tone: selectionReady ? "ready" : "warning" },
          { label: "Titulares", value: m1Rows.length ? fmtInt(m1Rows.length) : "pendiente", tone: m1Rows.length ? "ready" : "warning" },
          { label: "Reservas", value: reserveRows.length ? fmtInt(reserveRows.length) : "sin reservas", tone: reserveRows.length ? "ready" : "neutral" },
          { label: "Siguiente", value: selectionReady ? "Fichas QR" : "seleccionar aulas", tone: selectionReady ? "current" : "warning" },
        ]}
        secondaryAction={{ to: "/monitoreo", label: "Ver monitoreo" }}
        action={{ to: "/recopiladores", label: "Preparar fichas QR", disabled: !selectionReady }}
      />
      <div className="cmv2-classroom-handoff-bridge" aria-label="Continuidad operativa hacia fichas QR y monitoreo">
        <article>
          <span>1</span>
          <div>
            <small>Sale del cálculo</small>
            <strong>Agenda de aulas</strong>
            <em>Titulares y reemplazos con curso, aula, horario, facultad y peso de selección.</em>
          </div>
        </article>
        <article>
          <span>2</span>
          <div>
            <small>Prepara campo</small>
            <strong>Ficha QR por aula</strong>
            <em>Kobo recibe un enlace por curso-horario; el PDF queda listo para imprimir y distribuir.</em>
          </div>
        </article>
        <article>
          <span>3</span>
          <div>
            <small>Vuelve a Monitoreo</small>
            <strong>Seguimiento sin rediseño</strong>
            <em>Monitoreo guarda enlaces, marca caídas y activa reservas equivalentes.</em>
          </div>
        </article>
      </div>
      <div className="cmv2-classroom-flow">
        {[
          { label: "Diseño cerrado", value: "titulares + reemplazos", detail: "Calc-Muestra entrega selección, semilla, hash, probabilidades y advertencias." },
          { label: "Agenda operativa", value: "docente, horario y responsable", detail: "Monitoreo completa contacto, fecha, enlace/QR, aplicador y estado del aula." },
          { label: "Campo", value: "estados y no respuesta", detail: "Se registra aplicada, parcial, caída o reemplazada sin alterar el diseño base." },
          { label: "Cierre", value: "muestra efectiva vs marco", detail: "El tablero reporta pérdida o recuperación de representatividad por reemplazos usados." },
        ].map((step, index) => (
          <div key={step.label} className="cmv2-classroom-step">
            <span>{index + 1}</span>
            <div>
              <small>{step.label}</small>
              <strong>{step.value}</strong>
              <em>{step.detail}</em>
            </div>
          </div>
        ))}
      </div>
      {selectionReady ? (
        <ClassroomSelectionTable rows={m1Rows.slice(0, 16)} />
      ) : (
        <ClassroomEmptyState
          icon={Grid3X3}
          title="Plan de aulas pendiente"
          detail="Genera selección en Aulas para que Monitoreo reciba titulares, reemplazos y trazabilidad metodológica."
        />
      )}
    </section>
  );
}

function UniversityReservesOutputPanel({ aulasState }: { aulasState: CalcMuestraAulasState | null }) {
  const replacementSimulation = classroomReplacementSimulationForState(aulasState);
  const replacementReady = classroomReplacementReady(aulasState);
  const reserveRows = classroomReserveRowsForState(aulasState);
  const waves = Array.from(new Set(reserveRows.map((row) => classroomRowText(row, ["wave"])).filter(Boolean)));
  return (
    <section className="cmv2-panel cmv2-university-results">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Reemplazos por aula</span>
          <strong>{replacementReady ? "Rutas Rn.1, Rn.2... listas para campo" : "Rutas de reemplazo pendientes de simulación"}</strong>
        </div>
        <span className="cmv2-pill-soft">reemplazos equivalentes, no rediseño</span>
      </div>
      <div className="cmv2-classroom-stat-grid">
        <Metric label="Aulas reemplazo" value={reserveRows.length ? fmtInt(reserveRows.length) : "pendiente"} />
        <Metric label="Rutas internas" value={waves.length ? waves.join(", ") : "pendiente"} />
        <Metric label="Simulación" value={replacementReady ? "disponible" : replacementSimulation ? "sin sugerencias" : "pendiente"} />
        <Metric label="Uso en campo" value="Monitoreo activa" />
      </div>
      {replacementReady && replacementSimulation ? (
        <ClassroomReplacementTables simulation={replacementSimulation} />
      ) : reserveRows.length ? (
        <ClassroomSelectionTable rows={reserveRows.slice(0, 24)} />
      ) : (
        <ClassroomEmptyState
          icon={RefreshCw}
          title="Reemplazos pendientes"
          detail="Genera selección y simula reemplazos para ver qué aula conviene activar si una titular cae."
        />
      )}
    </section>
  );
}

function UniversityRevampMarcoPanel({ comp }: { comp: CalcMuestraComponente }) {
  const facultades = comp.marco.estratos ?? [];
  const totalMujeres = facultades.reduce((sum, e) => sum + safeNumber(e.N_a), 0);
  const totalHombres = facultades.reduce((sum, e) => sum + safeNumber(e.N_b), 0);
  return (
    <section className="cmv2-panel cmv2-university-summary">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Marco operativo</span>
        <strong>Facultades y sexo</strong>
      </div>
      <div className="cmv2-university-metrics">
        <Metric label="Estudiantes" value={fmtInt(comp.marco.marco_validado)} />
        <Metric label="Facultades" value={facultades.length} />
        <Metric label="Mujeres" value={fmtInt(totalMujeres)} />
        <Metric label="Hombres" value={fmtInt(totalHombres)} />
      </div>
      <div className="cmv2-university-chips">
        <span>Observación: estudiante</span>
        <span>Marco: matrícula</span>
        <span>Cuota: facultad x sexo</span>
      </div>
    </section>
  );
}

function UniversityFrameReadinessPanel({
  comp,
  workspace,
}: {
  comp: CalcMuestraComponente;
  workspace: CalcMuestraWorkspace;
}) {
  const facultades = comp.marco.estratos ?? [];
  const marcoTotal = safeNumber(comp.marco.marco_validado);
  const hasFacultades = facultades.some((e) => safeNumber(e.N) > 0);
  const hasSexo = facultades.some((e) => safeNumber(e.N_a) > 0 || safeNumber(e.N_b) > 0);
  const items = [
    {
      label: "Fuente",
      value: workspace.fuente_marco || "Registro académico pendiente",
      ready: Boolean(workspace.fuente_marco),
    },
    {
      label: "Unidad de fila",
      value: "estudiante por curso y horario",
      ready: true,
    },
    {
      label: "Facultades",
      value: hasFacultades ? `${fmtInt(facultades.length)} estratos` : "sin marco cargado",
      ready: hasFacultades,
    },
    {
      label: "Control de cuotas",
      value: hasSexo ? "facultad x sexo" : "sexo pendiente",
      ready: hasSexo,
    },
  ];
  return (
    <section className="cmv2-panel cmv2-university-readiness-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Preparación del marco</span>
        <strong>Base principal y validación</strong>
      </div>
      <div className="cmv2-university-frame-status">
        <Metric label="Marco validado" value={fmtInt(marcoTotal)} />
        <Metric label="Facultades" value={facultades.length} />
      </div>
      <div className="cmv2-frame-checklist">
        {items.map((item) => (
          <div key={item.label} className={item.ready ? "is-ready" : "is-pending"}>
            <span>{item.ready ? <CheckCircle2 size={14} /> : <CirclePendingIcon />}</span>
            <div>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClassroomLabGuide({
  activeTab,
  frameReady,
  quotaReady,
  comparisonReady,
  selectionReady,
  replacementReady,
  frameAulas,
  uniqueStudents,
  quotaLabel,
  recommendedMethodLabel,
  m1Count,
  reserveCount,
}: {
  activeTab: ClassroomLabTab;
  frameReady: boolean;
  quotaReady: boolean;
  comparisonReady: boolean;
  selectionReady: boolean;
  replacementReady: boolean;
  frameAulas: number;
  uniqueStudents: number;
  quotaLabel: string;
  recommendedMethodLabel: string;
  m1Count: number;
  reserveCount: number;
}) {
  const guides: Record<ClassroomLabTab, {
    title: string;
    lead: string;
    decision: string;
    input: string;
    output: string;
    status: GuideStatus;
  }> = {
    marco: {
      title: "Verifica que la base ya pueda convertirse en aulas",
      lead: "La idea es mirar la cadena real: base institucional, cursos y horarios, estudiantes únicos y exclusiones.",
      input: frameReady ? `${fmtInt(frameAulas)} aulas y ${fmtInt(uniqueStudents)} estudiantes únicos` : "base institucional pendiente",
      decision: "qué filas son válidas y qué aula representa cada curso y horario",
      output: "marco de aplicación auditable",
      status: guideStatus(frameReady),
    },
    objetivo: {
      title: "Traduce la cuota calculada en criterios de selección",
      lead: "Aquí se define cómo convertir cuotas por facultad en aulas, reemplazos y restricciones operativas sin cambiar el diseño base.",
      input: quotaLabel,
      decision: "cuánto peso dar a balance, repetidos, tamaño de aula y reemplazos",
      output: "objetivo listo para comparar métodos",
      status: guideStatus(quotaReady, frameReady),
    },
    metodo: {
      title: "Compara métodos con el mismo objetivo",
      lead: "La app debe poder explicar por qué un método gana: mejor balance, menos concentración, menos repetidos o mejor profundidad de reemplazos.",
      input: quotaReady ? "base de aulas y cuota calculada" : "requiere cuota calculada",
      decision: `usar ${recommendedMethodLabel || "un método comparable"}`,
      output: "recomendación defendible",
      status: guideStatus(comparisonReady, quotaReady),
    },
    laboratorio: {
      title: "Revisa estabilidad antes de aceptar la selección",
      lead: "La simulación muestra si el resultado recomendado es consistente o si depende demasiado de una corrida particular.",
      input: comparisonReady ? "métodos comparados" : "comparación pendiente",
      decision: "si el puntaje, los pesos y los repetidos son estables",
      output: "riesgos y advertencias antes de seleccionar",
      status: guideStatus(comparisonReady, quotaReady),
    },
    seleccion: {
      title: "Convierte el método elegido en titulares y reemplazos",
      lead: "Esta pestaña muestra la propuesta que realmente pasará a campo: titulares, reemplazos, brechas y trazabilidad aula por aula.",
      input: comparisonReady ? "método recomendado o elegido" : "requiere comparación",
      decision: selectionReady ? `${fmtInt(m1Count)} titulares y ${fmtInt(reserveCount)} reemplazos` : "generar selección",
      output: "plan de aulas para seguimiento",
      status: guideStatus(selectionReady, comparisonReady),
    },
    reemplazos: {
      title: "Prepara reemplazos equivalentes antes de campo",
      lead: "Los reemplazos se ordenan por equivalencia, balance, repetidos y riesgo para que Monitoreo no rediseñe sobre la marcha.",
      input: selectionReady ? "titulares y reemplazos" : "requiere selección",
      decision: replacementReady ? "impacto antes/después disponible" : "simular reemplazos",
      output: "reemplazos sugeridos por aula no aplicada",
      status: guideStatus(replacementReady, selectionReady),
    },
    auditoria: {
      title: "Consulta el sustento cuando haga falta defender el diseño",
      lead: "Fuentes, fórmulas, probabilidades, pesos, simulaciones y alternativas quedan visibles sin saturar la operación diaria.",
      input: selectionReady || comparisonReady ? "diseño evaluado" : "requiere comparación o selección",
      decision: "qué probabilidad y peso se reporta como final",
      output: "bitácora metodológica defendible",
      status: guideStatus(selectionReady || comparisonReady, quotaReady),
    },
  };
  const guide = guides[activeTab];
  return (
    <div className="cmv2-classroom-lab-guide">
      <div>
        <span className="cmv2-eyebrow">Guía del paso</span>
        <strong>{guide.title}</strong>
        <p>{guide.lead}</p>
      </div>
      <div className="cmv2-classroom-lab-guide-steps">
        <span className={`is-${guide.status}`}>{guidedStatusLabel(guide.status)}</span>
        <em><b>Necesita:</b> {guide.input}</em>
        <em><b>Define:</b> {guide.decision}</em>
        <em><b>Deja listo:</b> {guide.output}</em>
      </div>
    </div>
  );
}

function ClassroomFrameSelectionSummaryPanel({
  frameReady,
  frameRows,
  uniqueStudents,
  targetForDisplay,
  m1ForDisplay,
  config,
  objectiveVariables,
  selectorFields,
  frameHash,
}: {
  frameReady: boolean;
  frameRows: Array<Record<string, unknown>>;
  uniqueStudents: number;
  targetForDisplay: number;
  m1ForDisplay: number;
  config: CalcMuestraWorkspaceAulasConfig;
  objectiveVariables: Array<Record<string, unknown>>;
  selectorFields: string[];
  frameHash?: string | null;
}) {
  const activeVariables = objectiveVariables
    .filter((row) => row.active !== false)
    .map((row) => classroomRowText(row, ["label", "dimension", "metric_id"]))
    .filter(Boolean)
    .slice(0, 6);
  const activeFields = selectorFields.length ? selectorFields : config.estratos_selector.map(selectorFieldLabel);
  return (
    <>
      <div className="cmv2-classroom-tab-note">
        <span><Database size={15} /></span>
        <div>
          <strong>Esta pestaña no vuelve a explorar el universo.</strong>
          <em>Resume qué parte del marco entra al selector. Los gráficos de población y aulas quedan en Marco; aquí se revisa si el marco ya está listo para decidir aulas titulares.</em>
        </div>
      </div>
      <div className="cmv2-classroom-readiness-map" aria-label="Preparación del selector de aulas">
        <article className={frameReady ? "is-ready" : "is-pending"}>
          <small>Marco para seleccionar</small>
          <strong>{frameRows.length ? `${fmtInt(frameRows.length)} aulas` : "pendiente"}</strong>
          <span>{frameReady ? "Base colapsada a curso-horario/aula." : "Primero construye o importa el marco de aplicación."}</span>
        </article>
        <article className={uniqueStudents ? "is-ready" : "is-pending"}>
          <small>Población que representa</small>
          <strong>{uniqueStudents ? `${fmtInt(uniqueStudents)} estudiantes` : "pendiente"}</strong>
          <span>La calidad se mide sobre estudiantes únicos elegibles, no sobre filas repetidas.</span>
        </article>
        <article className={targetForDisplay ? "is-ready" : "is-working"}>
          <small>Objetivo calculado</small>
          <strong>{targetForDisplay ? `${fmtInt(targetForDisplay)} encuestas` : "falta cálculo"}</strong>
          <span>El N por dominio se define en Cálculo y luego se traduce a aulas.</span>
        </article>
        <article className={m1ForDisplay ? "is-ready" : "is-working"}>
          <small>Aulas titulares estimadas</small>
          <strong>{m1ForDisplay ? fmtInt(m1ForDisplay) : "pendiente"}</strong>
          <span>Será la primera cadena que Monitoreo intentará aplicar.</span>
        </article>
      </div>
      <div className="cmv2-classroom-readiness-columns">
        <article>
          <small>Variables que cuidará el selector</small>
          <div className="cmv2-classroom-chip-list">
            {(activeVariables.length ? activeVariables : ["facultad", "sexo esperado", "tamaño de aula"]).map((field) => <span key={field}>{field}</span>)}
          </div>
        </article>
        <article>
          <small>Criterios operativos activos</small>
          <div className="cmv2-classroom-chip-list">
            {(activeFields.length ? activeFields : ["facultad", "sexo esperado"]).slice(0, 7).map((field) => <span key={field}>{field}</span>)}
            <span>{config.min_elegibles_aula}+ elegibles por aula</span>
            <span>R1-R{config.bolsas_reemplazo}</span>
          </div>
        </article>
        <article>
          <small>Trazabilidad</small>
          <strong>{frameHash ? String(frameHash).slice(0, 10) : "firma pendiente"}</strong>
          <span>La selección conserva semilla, firma del marco y reglas usadas para poder replicarse.</span>
        </article>
      </div>
    </>
  );
}

function ClassroomObjectiveTranslationPanel({
  facultades,
  objectiveVariables,
  targetForDisplay,
  m1ForDisplay,
  extraOperativo,
  config,
}: {
  facultades: CalcMuestraEstrato[];
  objectiveVariables: Array<Record<string, unknown>>;
  targetForDisplay: number;
  m1ForDisplay: number;
  extraOperativo: number;
  config: CalcMuestraWorkspaceAulasConfig;
}) {
  const activeVariables = objectiveVariables.filter((row) => row.active !== false);
  const quotaRows = facultades
    .filter((row) => {
      const record = row as unknown as Record<string, unknown>;
      return safeNumber(row.N, 0) > 0 || safeNumber(record.n_total, 0) > 0 || safeNumber(row.cuota_fija, 0) > 0;
    })
    .slice(0, 5);
  const expectedYield = targetForDisplay > 0 && m1ForDisplay > 0 ? targetForDisplay / m1ForDisplay : 0;
  return (
    <div className="cmv2-classroom-objective-panel">
      <div className="cmv2-classroom-objective-strip" aria-label="Traducción del objetivo a aulas">
        <article>
          <small>Objetivo de entrevistas</small>
          <strong>{targetForDisplay ? fmtInt(targetForDisplay) : "pendiente"}</strong>
          <span>Viene de Cálculo y sus cuotas.</span>
        </article>
        <article>
          <small>Aulas titulares necesarias</small>
          <strong>{m1ForDisplay ? fmtInt(m1ForDisplay) : "pendiente"}</strong>
          <span>{expectedYield ? `Rinde aprox. ${fmtInt(expectedYield)} estudiantes por aula.` : "Se estima cuando exista N y rendimiento."}</span>
        </article>
        <article>
          <small>Reemplazos por titular</small>
          <strong>R1-R{config.bolsas_reemplazo}</strong>
          <span>Alternativas parecidas asociadas a cada aula titular.</span>
        </article>
        <article>
          <small>Reserva extra</small>
          <strong>{fmtInt(extraOperativo)}</strong>
          <span>Refuerzo operativo separado de la muestra titular.</span>
        </article>
      </div>
      <div className="cmv2-classroom-objective-columns">
        <article>
          <small>Dominios con cuota</small>
          {quotaRows.length ? quotaRows.map((row) => {
            const record = row as unknown as Record<string, unknown>;
            const label = classroomRowText(record, ["label", "nombre", "id"]) || "Dominio";
            const quota = safeNumber(record.n_total, 0) || safeNumber(row.cuota_fija, 0) || safeNumber(row.N, 0);
            return (
              <span key={row.id ?? label}>
                <b>{label}</b>
                <em>{fmtInt(quota)}</em>
              </span>
            );
          }) : <p>Cuando calcules el tamaño por facultad, aquí aparecerán los principales dominios que deben sostener la muestra.</p>}
        </article>
        <article>
          <small>Pesos del objetivo</small>
          {(activeVariables.length ? activeVariables : [{ label: "facultad", weight: 0.18 }, { label: "sexo esperado", weight: 0.1 }, { label: "cobertura única", weight: 0.1 }]).slice(0, 6).map((row) => (
            <span key={classroomRowText(row, ["label", "dimension"])}>
              <b>{classroomRowText(row, ["label", "dimension"]) || "variable"}</b>
              <em>{fmtPct(classroomRowNumber(row, ["weight"]))}</em>
            </span>
          ))}
        </article>
      </div>
    </div>
  );
}

function ClassroomSelectionPreparationPanel({
  frameReady,
  comparisonReady,
  recommendedMethodLabel,
  frameCount,
  targetForDisplay,
  m1ForDisplay,
}: {
  frameReady: boolean;
  comparisonReady: boolean;
  recommendedMethodLabel: string;
  frameCount: number;
  targetForDisplay: number;
  m1ForDisplay: number;
}) {
  return (
    <div className="cmv2-classroom-preparation-panel">
      <div className="cmv2-classroom-tab-note">
        <span><Table2 size={15} /></span>
        <div>
          <strong>Esta pestaña se llena recién cuando existe una selección.</strong>
          <em>Antes de seleccionar, muestra el estado de preparación sin repetir los gráficos de Marco. La revisión descriptiva vive en Marco; aquí se decide qué aulas serán titulares.</em>
        </div>
      </div>
      <div className="cmv2-classroom-readiness-map">
        <article className={frameReady ? "is-ready" : "is-pending"}>
          <small>1. Marco listo</small>
          <strong>{frameCount ? `${fmtInt(frameCount)} aulas` : "pendiente"}</strong>
          <span>Una fila por aula o curso-horario seleccionable.</span>
        </article>
        <article className={targetForDisplay ? "is-ready" : "is-working"}>
          <small>2. Tamaño definido</small>
          <strong>{targetForDisplay ? `${fmtInt(targetForDisplay)} entrevistas` : "pendiente"}</strong>
          <span>El cálculo fija cuánto se necesita representar.</span>
        </article>
        <article className={comparisonReady ? "is-ready" : "is-working"}>
          <small>3. Método comparado</small>
          <strong>{comparisonReady ? recommendedMethodLabel : "por comparar"}</strong>
          <span>La app elige la opción con mejor balance y menos repetidos.</span>
        </article>
        <article className={m1ForDisplay ? "is-ready" : "is-working"}>
          <small>4. Aulas titulares</small>
          <strong>{m1ForDisplay ? fmtInt(m1ForDisplay) : "pendiente"}</strong>
          <span>Después aparecerán códigos AULA n y sus razones de selección.</span>
        </article>
      </div>
    </div>
  );
}

function ClassroomReplacementBlueprintPanel({
  depth,
  titularCount,
  reserveCount,
  extraReserveCount,
}: {
  depth: number;
  titularCount: number;
  reserveCount: number;
  extraReserveCount: number;
}) {
  const routeDepth = Math.max(1, Math.min(5, depth || 3));
  const replacementCodes = Array.from({ length: routeDepth }, (_, index) => `R5.${index + 1}`);
  return (
    <div className="cmv2-classroom-replacement-blueprint">
      <div className="cmv2-classroom-route-preview" aria-label="Ejemplo de cadena de reemplazos">
        <span className="is-primary">AULA 5</span>
        {replacementCodes.map((code) => (
          <span key={code}>
            <ArrowRight size={13} />
            <b>{code}</b>
          </span>
        ))}
        <span>
          <ArrowRight size={13} />
          <b>Reserva extra</b>
        </span>
      </div>
      <div className="cmv2-classroom-readiness-map">
        <article className={titularCount ? "is-ready" : "is-working"}>
          <small>Aulas titulares</small>
          <strong>{titularCount ? fmtInt(titularCount) : "pendiente"}</strong>
          <span>Cada titular tendrá su propia ruta de reemplazos.</span>
        </article>
        <article className={reserveCount ? "is-ready" : "is-working"}>
          <small>Reemplazos asociados</small>
          <strong>{reserveCount ? fmtInt(reserveCount) : "pendiente"}</strong>
          <span>No son una bolsa suelta: pertenecen a una titular específica.</span>
        </article>
        <article className={extraReserveCount ? "is-ready" : "is-working"}>
          <small>Reserva extra</small>
          <strong>{extraReserveCount ? fmtInt(extraReserveCount) : "pendiente"}</strong>
          <span>Solo se usa cuando la cadena no alcanza o la celda queda frágil.</span>
        </article>
      </div>
    </div>
  );
}

function UniversityClassroomSelectionPanel({
  workspace,
  totalComp,
  facultyComp,
  aulasState,
  busy,
  activeLabTab,
  onWorkspace,
  onCompare,
  onSelectMethod,
  onSimulateReplacements,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
  busy: string | null;
  activeLabTab: ClassroomLabTab;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onCompare: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSelectMethod: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onSimulateReplacements: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
}) {
  const [showMethodExplanation, setShowMethodExplanation] = useState(true);
  const [tableQuery, setTableQuery] = useState("");
  const frame = aulasState?.frame ?? null;
  const comparison = classroomComparisonForState(aulasState);
  const selection = classroomSelectionForState(aulasState);
  const replacementSimulation = classroomReplacementSimulationForState(aulasState);
  const frameRows = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
  const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
  const frameReady = classroomFrameReady(aulasState);
  const comparisonReady = classroomComparisonReady(aulasState);
  const selectionReady = classroomSelectionReady(aulasState);
  const replacementReady = classroomReplacementReady(aulasState);
  const framePopulationCount = Math.max(
    populationRows.length,
    safeNumber((frame as Record<string, unknown> | null)?.population_n, 0),
    safeNumber((frame as Record<string, unknown> | null)?.unique_students_n, 0),
    frameAuditNumber(frame, "population_n"),
    frameAuditNumber(frame, "unique_students_n"),
  );
  const selectionRows = classroomSelectionRowsForState(aulasState);
  const config = normalizeUniversityAulasConfig((aulasState?.config as CalcMuestraWorkspaceAulasConfig | undefined) ?? workspace.aulas_config);
  const objective = comparison?.objective_config ?? selection?.objective_config ?? config.objective ?? DEFAULT_UNIVERSITY_AULAS_OBJECTIVE;
  const objectiveVariables = rowsFrom<CalcMuestraAulasObjectiveConfig["variables"][number]>(objective.variables);
  const representativity = selection?.representativity ?? null;
  const comparisonMethods = rowsFrom<CalcMuestraAulasMethodSummary>(comparison?.methods);
  const representativityMetrics = rowsFrom<CalcMuestraAulasRepresentativityMetric>(representativity?.metrics ?? selection?.diagnostics?.representativity_metrics);
  const comparisonMetrics = rowsFrom<CalcMuestraAulasRepresentativityMetric>(comparison?.representativity_metrics);
  const simulationRows = rowsFrom<CalcMuestraAulasSimulationSummary>(comparison?.simulation_summary);
  const profileRows = rowsFrom<CalcMuestraAulasProfileDistribution>(
    representativity?.profile_distributions ?? selection?.diagnostics?.profile_distributions ?? comparison?.method_profiles,
  );
  const recommendedProfileRows = profileRows.filter((row) => !row.method_id || row.method_id === (comparison?.recommendation?.method_id ?? ""));
  const visibleProfiles = (recommendedProfileRows.length ? recommendedProfileRows : profileRows).slice(0, 36);
  const coverageRows = rowsFrom<Record<string, unknown>>(representativity?.coverage_overlap ?? selection?.diagnostics?.coverage_overlap);
  const currentRepresentativityScore = safeNumber(selection?.representativity_score ?? representativity?.representativity_score ?? comparison?.recommendation?.representativity_score, Number.NaN);
  const engineOption = UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((option) => option.id === config.selector_engine) ?? UNIVERSITY_AULAS_SELECTOR_OPTIONS[0];
  const modalidad = UNIVERSITY_AULAS_MODALIDAD_OPTIONS.find((option) => option.id === config.modalidad) ?? UNIVERSITY_AULAS_MODALIDAD_OPTIONS[0];
  const m1Rows = classroomM1RowsForState(aulasState);
  const reserveRows = classroomReserveRowsForState(aulasState);
  const recommendedMethodId = comparison?.recommendation?.method_id ?? String(config.selector_engine ?? config.selector);
  const recommendedMethod = comparisonMethods.find((method) => method.method_id === recommendedMethodId) ?? null;
  const filteredSelectionRows = selectionRows.filter((row) => classroomRowSearch(row, tableQuery));
  const totalBase = estimateClassroomBase(totalComp);
  const facultyBase = estimateClassroomBase(facultyComp);
  const referenciaBase = Math.max(totalBase ?? 0, facultyBase ?? 0);
  const facultades = totalComp.marco.estratos ?? [];
  const extraOperativo = estimateOperationalExtra(facultades, config);
  const planTotal = selectionReady ? selectionRows.length : frameRows.length;
  const sobremuestraPct = Math.max(totalComp.parametros.oversample_pct, facultyComp.parametros.oversample_pct);
  const selectorFields = config.estratos_selector.map(selectorFieldLabel);
  const facultyTarget = safeNumber(facultyComp.resultado?.n_objetivo, 0);
  const totalTarget = safeNumber(totalComp.resultado?.n_objetivo, 0);
  const frameTarget = safeNumber((frame as Record<string, unknown> | null)?.target_n, 0);
  const targetForDisplay = Math.max(facultyTarget, totalTarget, frameTarget);
  const calculatedQuotaEstimate = targetForDisplay > 0 ? Math.max(referenciaBase, safeNumber((frame as Record<string, unknown> | null)?.planned_m1, 0)) : 0;
  const m1ForDisplay = selectionReady ? m1Rows.length : calculatedQuotaEstimate;
  const hasCalculatedQuota = targetForDisplay > 0 || selectionReady;
  const quotaStatusLabel = targetForDisplay > 0 ? "calculadas" : selectionReady ? "precargadas" : "pendiente";
  const labQuotaLabel = targetForDisplay > 0 ? `${fmtInt(targetForDisplay)} entrevistas objetivo` : selectionReady ? `${fmtInt(m1Rows.length)} aulas titulares precargadas` : "tamaño y cuotas pendientes";
  const steps = [
    { label: "Base institucional", value: "estudiante por curso y horario", detail: "un estudiante puede aparecer en varios cursos" },
    { label: "Marco de aulas", value: frameRows.length ? `${fmtInt(frameRows.length)} aulas` : "curso y horario", detail: "una fila por aula seleccionable" },
    { label: "N por facultad", value: facultyTarget ? fmtInt(facultyTarget) : frameTarget ? `${fmtInt(frameTarget)} precargado` : "pendiente", detail: facultyTarget ? "viene de la pestaña Cálculo" : "requiere calcular antes de seleccionar" },
    { label: "Aulas por facultad", value: m1ForDisplay ? `${fmtInt(m1ForDisplay)} titulares` : "pendiente", detail: "cuota / rendimiento esperado" },
    { label: "Comparador", value: comparisonReady ? "métodos evaluados" : "por correr", detail: "sistemático, balanceado, dispersión y optimización" },
    { label: "Selección", value: selectionReady ? `${fmtInt(m1Rows.length)} titulares` : comparisonReady ? engineOption.label : "pendiente", detail: "balance, cobertura y repetidos" },
    { label: "Reemplazos", value: `R1-R${config.bolsas_reemplazo}`, detail: "rutas equivalentes por aula titular" },
  ];
  const auditRows = [
    { label: "Diseño probabilístico", value: engineOption.label, detail: "Aulas con probabilidad conocida y balance por variables auxiliares." },
    { label: "Optimización operativa", value: config.selector_engine === "pool_controlado" ? `${fmtInt(config.candidate_pool_size)} candidatas` : "sin post-selección", detail: "Si se elige entre candidatas, las probabilidades finales salen de simulación." },
    { label: "Probabilidades y pesos", value: `${fmtInt(config.simulation_runs)} corridas`, detail: "Produce la probabilidad usada para pesos de aulas y estudiantes agregados." },
    { label: "Fuentes", value: "oficiales + académicas", detail: "PISA/NAEP/UN/Eurostat/AAPOR, cube method y paquetes R documentados." },
    { label: "Reemplazos", value: `R1-R${config.bolsas_reemplazo}`, detail: "Reemplazos trazables; no se mezclan con sobremuestra ni rediseño del marco." },
  ];
  const frameAuditCardsForDisplay = frameAuditCards(frame);
  const topGaps = visibleProfiles
    .filter((row) => Number.isFinite(safeNumber(row.abs_error, Number.NaN)))
    .sort((a, b) => safeNumber(b.abs_error, 0) - safeNumber(a.abs_error, 0))
    .slice(0, 6);

  function updateConfig(patch: Partial<CalcMuestraWorkspaceAulasConfig>) {
    onWorkspace({
      ...workspace,
      aulas_config: normalizeUniversityAulasConfig({ ...config, ...patch }),
    });
  }

  function setSelector(next: CalcMuestraWorkspaceAulasSelector | string) {
    const nextEngine = normalizeAulasSelectorEngine(next);
    updateConfig({
      selector: nextEngine,
      selector_engine: nextEngine,
      method_family: nextEngine === "pool_controlado" ? "probability_with_operational_optimization" : "balanced_probability",
    });
  }

  function setUseSizeGroups(value: boolean) {
    const base = ["faculty", "sex_top_1"];
    updateConfig({
      usar_grupos_tamano: value,
      estratos_selector: value ? [...base, "size_group"] : base,
    });
  }

  function runComparison() {
    void onCompare(config, config.simulation_runs ?? config.monte_carlo_n ?? 500);
  }

  function runSelection(methodId = recommendedMethodId) {
    void onSelectMethod(config, methodId);
  }

  function runReplacementSimulation() {
    void onSimulateReplacements(config);
  }

  return (
    <section className="cmv2-panel cmv2-classroom-selector">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Selección de aulas</span>
          <strong>Del objetivo de muestra a aulas titulares y reemplazos trazables</strong>
        </div>
        <div className="cmv2-classroom-badges" aria-label="Trazabilidad del selector">
          <span className={frame?.frame_hash ? "is-ready" : "is-pending"}>{frame?.frame_hash ? "Reproducible" : "Sin firma"}</span>
          <span className={frameReady ? "is-ready" : "is-pending"}>{frameReady ? "Marco auditado" : "Marco pendiente"}</span>
          <span className={selectionReady && replacementReady ? "is-ready" : "is-pending"}>
            {selectionReady && replacementReady ? "Listo para monitoreo" : "Monitoreo pendiente"}
          </span>
        </div>
      </div>

      <div className="cmv2-classroom-kpis">
        <Metric label="Tamaño y cuotas" value={quotaStatusLabel} />
        <Metric label="Aulas titulares" value={m1ForDisplay ? fmtInt(m1ForDisplay) : "pendiente"} />
        <Metric label="Calidad representativa" value={Number.isFinite(currentRepresentativityScore) ? classroomScore(currentRepresentativityScore) : "pendiente"} />
        <Metric label="Reemplazos por aula" value={`R1-R${config.bolsas_reemplazo}`} />
        <Metric label={selectionReady ? "Aulas en lista" : "Aulas del marco"} value={planTotal ? fmtInt(planTotal) : "sin marco"} />
        <Metric label="Aulas extra" value={fmtInt(extraOperativo)} />
      </div>

      <div className="cmv2-classroom-commandbar" aria-label="Acciones del laboratorio de aulas">
        <button type="button" className="cmv2-ghost" onClick={runComparison} disabled={Boolean(busy) || !frameReady || !hasCalculatedQuota}>
          {busy === "Comparando métodos" ? <Loader2 size={14} className="pulso-spin" /> : <BarChart3 size={14} />}
          Comparar métodos
        </button>
        <button type="button" className="cmv2-primary" onClick={() => runSelection()} disabled={Boolean(busy) || !comparisonReady}>
          {busy === "Seleccionando aulas" ? <Loader2 size={14} className="pulso-spin" /> : <Table2 size={14} />}
          Seleccionar aulas titulares
        </button>
        <button type="button" className="cmv2-ghost" onClick={runReplacementSimulation} disabled={Boolean(busy) || !selectionReady}>
          {busy === "Simulando reemplazos" ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
          Probar reemplazos
        </button>
        {comparison?.recommendation && (
          <span className="cmv2-classroom-recommendation">
            Recomendado: <strong>{comparison.recommendation.method_label ?? classroomMethodLabel(recommendedMethodId)}</strong>
          </span>
        )}
      </div>

      <div className="cmv2-classroom-content">
          <ClassroomLabGuide
            activeTab={activeLabTab}
            frameReady={frameReady}
            quotaReady={hasCalculatedQuota}
            comparisonReady={comparisonReady}
            selectionReady={selectionReady}
            replacementReady={replacementReady}
            frameAulas={frameRows.length}
            uniqueStudents={framePopulationCount}
            quotaLabel={labQuotaLabel}
            recommendedMethodLabel={comparison?.recommendation?.method_label ?? classroomMethodLabel(recommendedMethodId)}
            m1Count={m1Rows.length}
            reserveCount={reserveRows.length}
          />

          <div className="cmv2-classroom-lab-body" role="tabpanel" aria-label={CLASSROOM_LAB_TABS.find((tab) => tab.id === activeLabTab)?.label}>
        {activeLabTab === "marco" && (
          <div className="cmv2-classroom-lab-grid">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Cadena metodológica</span>
                <strong>De base institucional a agenda</strong>
              </div>
              <div className="cmv2-classroom-flow">
                {steps.map((step, index) => (
                  <div key={step.label} className="cmv2-classroom-step">
                    <span>{index + 1}</span>
                    <div>
                      <small>{step.label}</small>
                      <strong>{step.value}</strong>
                      <em>{step.detail}</em>
                    </div>
                  </div>
                ))}
              </div>
              <ClassroomFrameSelectionSummaryPanel
                frameReady={frameReady}
                frameRows={frameRows}
                uniqueStudents={framePopulationCount}
                targetForDisplay={targetForDisplay}
                m1ForDisplay={m1ForDisplay}
                config={config}
                objectiveVariables={objectiveVariables as Array<Record<string, unknown>>}
                selectorFields={selectorFields}
                frameHash={frame?.frame_hash ? String(frame.frame_hash) : null}
              />
              <div className="cmv2-classroom-methods">
                <article>
                  <small>Unidad seleccionable</small>
                  <strong>curso, horario y aula</strong>
                  <span>No se sortean filas alumno-curso como unidad final; se colapsa primero el marco.</span>
                </article>
                <article>
                  <small>Repetidos</small>
                  <strong>Evitar estudiantes repetidos</strong>
                  <span>Si un estudiante aparece en varios cursos, el selector lo controla desde el marco institucional.</span>
                </article>
                <article>
                  <small>Reemplazos</small>
                  <strong>No son encuestas extra</strong>
                  <span>Son reemplazos equivalentes; el extra operativo se presupuesta y se mapea por separado.</span>
                </article>
                <article>
                  <small>Campo anónimo</small>
                  <strong>No exige identificación personal</strong>
                  <span>La trazabilidad de campo cruza collector, link, aula, fecha y estado operativo.</span>
                </article>
              </div>
            </div>
            <aside className="cmv2-classroom-lab-side">
              <div className="cmv2-classroom-stat-grid">
                <Metric label="Aulas del marco" value={frameRows.length ? fmtInt(frameRows.length) : "pendiente"} />
                <Metric label="Estudiantes únicos" value={framePopulationCount ? fmtInt(framePopulationCount) : "pendiente"} />
                <Metric label="Exclusiones" value={frame?.exclusions?.length ? fmtInt(frame.exclusions.length) : "0"} />
                <Metric label="Firma del marco" value={frame?.frame_hash ? String(frame.frame_hash).slice(0, 8) : "pendiente"} />
              </div>
              <div className="cmv2-classroom-audit-grid">
                {frameAuditCardsForDisplay.map((row) => (
                  <div key={row.label}>
                    <small>{row.label}</small>
                    <strong>{row.value}</strong>
                    <span>{row.detail}</span>
                  </div>
                ))}
                {!frameAuditCardsForDisplay.length && (
                  <div>
                    <small>Marco pendiente</small>
                    <strong>Carga o construye el marco</strong>
                    <span>Cuando exista una base principal o dos bases equivalentes, esta sección mostrará auditoría real.</span>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {activeLabTab === "objetivo" && (
          <div className="cmv2-classroom-lab-grid">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Objetivo</span>
                <strong>Del N por facultad a aulas titulares y reemplazos</strong>
              </div>
              <ClassroomObjectiveTranslationPanel
                facultades={facultades}
                objectiveVariables={objectiveVariables as Array<Record<string, unknown>>}
                targetForDisplay={targetForDisplay}
                m1ForDisplay={m1ForDisplay}
                extraOperativo={extraOperativo}
                config={config}
              />
              <div className="cmv2-classroom-control-grid">
                <label className="cmv2-compact-field cmv2-classroom-field-wide">
                  <span>Modalidad</span>
                  <select
                    value={config.modalidad}
                    onChange={(e) => {
                      const nextModalidad = e.currentTarget.value as CalcMuestraWorkspaceAulasModalidad;
                      updateConfig({
                        modalidad: nextModalidad,
                        require_in_person: nextModalidad !== "online_controlado",
                      });
                    }}
                  >
                    {UNIVERSITY_AULAS_MODALIDAD_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  <em>{modalidad.detail}</em>
                </label>
                <div className="cmv2-compact-field">
                  <span>Mínimo por aula</span>
                  <NumberCell value={config.min_elegibles_aula} min={1} step={1} onChange={(v) => updateConfig({ min_elegibles_aula: Math.round(v) })} />
                  <em>Descarta cursos demasiado pequeños para sostener una aplicación presencial.</em>
                </div>
                <div className="cmv2-compact-field">
                  <span>Reemplazos por aula</span>
                  <NumberCell value={config.bolsas_reemplazo} min={0} step={1} onChange={(v) => updateConfig({ bolsas_reemplazo: Math.round(v) })} />
                  <em>Crea Rn.1, Rn.2... como alternativas equivalentes para cada aula titular.</em>
                </div>
                <div className="cmv2-compact-field">
                  <span>Extra operativo por estrato</span>
                  <NumberCell value={config.aulas_extra_operativas_default} min={0} step={1} onChange={(v) => updateConfig({ aulas_extra_operativas_default: Math.round(v) })} />
                  <em>Refuerzo de agenda; no cambia el N estadístico ni la muestra titular.</em>
                </div>
                <div className="cmv2-compact-field">
                  <span>Evitar repetidos</span>
                  <NumberCell value={config.penalizacion_repetidos} min={0} step={0.05} onChange={(v) => updateConfig({ penalizacion_repetidos: v })} />
                  <em>Más alto prioriza estudiantes únicos cuando aparecen en varios cursos.</em>
                </div>
                <div className="cmv2-compact-field">
                  <span>Candidatas a comparar</span>
                  <NumberCell value={config.candidate_pool_size ?? 500} min={1} step={25} onChange={(v) => updateConfig({ candidate_pool_size: Math.round(v) })} />
                  <em>Solo afecta el pool controlado; obliga a auditar probabilidades por simulación.</em>
                </div>
                <div className="cmv2-compact-field">
                  <span>Corridas de auditoría</span>
                  <NumberCell value={config.simulation_runs ?? config.monte_carlo_n} min={0} step={50} onChange={(v) => updateConfig({ simulation_runs: Math.round(v), monte_carlo_n: Math.round(v) })} />
                  <em>Estima estabilidad, pesos y probabilidades cuando hay optimización.</em>
                </div>
                <div className="cmv2-compact-field">
                  <span>Semilla</span>
                  <NumberCell value={config.semilla} min={1} step={1} onChange={(v) => updateConfig({ semilla: Math.round(v) })} />
                  <em>Permite reproducir la misma selección en auditoría.</em>
                </div>
              </div>
              <label className="cmv2-classroom-toggle">
                <input
                  type="checkbox"
                  checked={config.usar_grupos_tamano}
                  onChange={(e) => setUseSizeGroups(e.currentTarget.checked)}
                />
                <span>
                  <strong>Usar grupos de tamaño de aula</strong>
                  <em>Recomendado cuando la selección puede sesgarse hacia cursos grandes.</em>
                </span>
              </label>
              <div className="cmv2-classroom-groups" aria-label="Grupos de tamaño de aula">
                {config.grupos_tamano.map((group) => (
                  <span key={group.id}>
                    <strong>{group.label}</strong>
                    {group.min}{group.max == null ? "+" : `-${group.max}`} elegibles
                  </span>
                ))}
              </div>
              <div className="cmv2-classroom-groups" aria-label="Criterios activos del selector">
                <strong>Criterios activos</strong>
                {selectorFields.map((field) => <span key={field}>{field}</span>)}
              </div>
              <ObjectiveWeightsPanel variables={objectiveVariables as Array<Record<string, unknown>>} />
            </div>
            <aside className="cmv2-classroom-lab-side">
              <div className="cmv2-classroom-operational-grid" aria-label="Criterios operativos del plan de aulas">
                <span><strong>{fmtPct(sobremuestraPct)}</strong> margen estadístico</span>
                <span><strong>{fmtInt(config.min_elegibles_aula)}</strong> mínimo por aula</span>
                <span><strong>{fmtInt(extraOperativo)}</strong> refuerzos operativos</span>
              </div>
              <div className="cmv2-classroom-note">
                <CheckCircle2 size={15} />
                <span>Primero se calcula el tamaño necesario por facultad; después se traduce ese objetivo a aulas titulares y reemplazos suficientes para monitoreo.</span>
              </div>
              <RepresentativityMetricGrid metrics={representativityMetrics} />
            </aside>
          </div>
        )}

        {activeLabTab === "metodo" && (
          <div className="cmv2-classroom-lab-grid">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Comparación</span>
                <strong>Métodos lado a lado y decisión recomendada</strong>
              </div>
              <div className="cmv2-classroom-method-grid">
                {["sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"].map((methodId) => {
                  const option = UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((item) => item.id === methodId);
                  const compared = comparisonMethods.find((method) => method.method_id === methodId);
                  const active = String(config.selector_engine) === methodId;
                  return (
                    <button
                      key={methodId}
                      type="button"
                      className={`cmv2-classroom-method-card ${active ? "is-active" : ""}`}
                      onClick={() => setSelector(methodId)}
                    >
                      <small>{methodId === "cube_balanceado" ? "Recomendado" : methodId === "sistematico_pps" ? "Benchmark" : methodId === "pool_controlado" ? "Optimización" : "Avanzado"}</small>
                      <strong>{option?.label ?? classroomMethodLabel(methodId)}</strong>
                      <span>{option?.detail ?? classroomMethodReason(methodId)}</span>
                  {compared && <em>Calidad {classroomScore(compared.representativity_score ?? compared.overall_score)} · repetidos {fmtPct(compared.duplicate_loss ?? 0)}</em>}
                    </button>
                  );
                })}
              </div>
              <label className="cmv2-classroom-toggle">
                <input
                  type="checkbox"
                  checked={showMethodExplanation}
                  onChange={(e) => setShowMethodExplanation(e.currentTarget.checked)}
                />
                <span>
                  <strong>Mostrar explicación metodológica</strong>
                  <em>Usa lenguaje de decisión: proporcional al tamaño, balance por cuotas, dispersión y control de repetidos.</em>
                </span>
              </label>
              {!comparison || !comparisonMethods.length ? (
                <ClassroomEmptyState
                  icon={BarChart3}
                  title="Comparación pendiente"
                  detail="Corre el comparador para evaluar representatividad, balance, cobertura, repetidos y riesgos de cada motor."
                  actionLabel="Comparar métodos"
                  onAction={runComparison}
                  disabled={Boolean(busy) || !frameReady || !hasCalculatedQuota}
                />
              ) : (
                <>
                  <div className="cmv2-classroom-quality-grid">
                    {comparisonMethods.map((method) => (
                      <MethodSummaryCard
                        key={method.method_id}
                        method={method}
                        active={method.method_id === recommendedMethodId}
                        onSelect={() => runSelection(method.method_id)}
                      />
                    ))}
                  </div>
                  <ClassroomBalanceTable rows={comparison.balance ?? []} methodId={recommendedMethodId} />
                </>
              )}
              {showMethodExplanation && (
                <div className="cmv2-classroom-audit-grid">
                  {auditRows.slice(0, 4).map((row) => (
                    <div key={row.label}>
                      <small>{row.label}</small>
                      <strong>{row.value}</strong>
                      <span>{row.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <aside className="cmv2-classroom-lab-side">
              <ClassroomRecommendation comparison={comparison} fallbackMethod={engineOption.label} />
              <ClassroomRiskList risks={comparison?.risk_flags ?? []} />
              <div className="cmv2-classroom-note">
                <Settings2 size={15} />
                <span>El PPS queda como base auditable. El método balanceado es el motor recomendado cuando hay variables auxiliares; el pool controlado reduce estudiantes repetidos pero obliga a estimar probabilidades finales por simulación.</span>
              </div>
            </aside>
          </div>
        )}

        {activeLabTab === "laboratorio" && (
          <div className="cmv2-classroom-lab-grid">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Simulación</span>
                <strong>Estabilidad, cobertura y estudiantes repetidos</strong>
              </div>
              {!comparison || !comparisonMethods.length ? (
                <ClassroomEmptyState
                  icon={BarChart3}
                  title="Simulación pendiente"
                  detail="Corre el comparador para generar corridas presupuestadas y observar variabilidad del diseño antes de seleccionar."
                  actionLabel="Comparar métodos"
                  onAction={runComparison}
                  disabled={Boolean(busy) || !frameReady || !hasCalculatedQuota}
                />
              ) : (
                <>
                  <SimulationSummaryPanel rows={simulationRows} />
                  <RepresentativityMetricGrid metrics={comparisonMetrics.filter((metric) => metric.method_id === recommendedMethodId)} />
                </>
              )}
            </div>
            <aside className="cmv2-classroom-lab-side">
              <ClassroomRecommendation comparison={comparison} fallbackMethod={engineOption.label} />
              <ClassroomRiskList risks={comparison?.risk_flags ?? []} />
            </aside>
          </div>
        )}

        {activeLabTab === "seleccion" && (
          <div className="cmv2-classroom-lab-grid">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Selección propuesta</span>
                  <strong>Aulas titulares, reemplazos y trazabilidad</strong>
              </div>
              {!selectionReady ? (
                <>
                  <ClassroomSelectionPreparationPanel
                    frameReady={frameReady}
                    comparisonReady={comparisonReady}
                    recommendedMethodLabel={comparison?.recommendation?.method_label ?? classroomMethodLabel(recommendedMethodId)}
                    frameCount={frameRows.length}
                    targetForDisplay={targetForDisplay}
                    m1ForDisplay={m1ForDisplay}
                  />
                  <ClassroomEmptyState
                    icon={Table2}
                    title="Todavía no hay selección"
                    detail="Genera una selección desde el método recomendado o desde una tarjeta del comparador. Aquí aparecerán titulares, brechas, razones de selección y estudiantes repetidos."
                    actionLabel="Generar selección"
                    onAction={() => runSelection()}
                    disabled={Boolean(busy) || !comparisonReady}
                  />
                </>
              ) : (
                <>
                  <div className="cmv2-classroom-stat-grid">
                    <Metric label="Aulas titulares" value={fmtInt(m1Rows.length)} />
                    <Metric label="Reemplazos" value={fmtInt(reserveRows.length)} />
                    <Metric label="Calidad representativa" value={classroomScore(selection?.representativity_score)} />
                    <Metric label="Método usado" value={classroomMethodLabel(selection?.selector_engine_used ?? selection?.selector_engine ?? engineOption.label)} />
                    <Metric label="Probabilidad usada" value={classroomProbabilitySourceLabel(selection?.probability_source)} />
                  </div>
                  <CoverageOverlapPanel rows={coverageRows} selectionRows={m1Rows} framePopulation={framePopulationCount} />
                  <ClassroomSelectionRationaleDashboard rows={m1Rows} workspace={workspace} />
                  <ProfileBalanceChart rows={visibleProfiles} />
                  <label className="cmv2-compact-field cmv2-classroom-table-filter">
                    <span>Filtrar aulas</span>
                    <input
                      value={tableQuery}
                      placeholder="facultad, curso, horario, estado..."
                      onChange={(e) => setTableQuery(e.currentTarget.value)}
                    />
                  </label>
                  <ClassroomSelectionTable rows={filteredSelectionRows.slice(0, 80)} />
                </>
              )}
            </div>
            <aside className="cmv2-classroom-lab-side">
              <ClassroomOverlapGraph rows={m1Rows} />
              <RepresentativityMetricGrid metrics={representativityMetrics} />
            </aside>
          </div>
        )}

        {activeLabTab === "reemplazos" && (
          <div className="cmv2-classroom-lab-grid cmv2-classroom-lab-grid--routes">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Reemplazos</span>
                <strong>Reemplazos equivalentes y efecto esperado</strong>
              </div>
              {selectionReady && (
                <ClassroomReplacementChainPanel
                  selectionRows={selectionRows}
                  simulation={replacementSimulation}
                  depth={Math.min(6, Math.max(1, config.bolsas_reemplazo || 6))}
                />
              )}
              {(!selectionReady || !m1Rows.length) && (
                <ClassroomReplacementBlueprintPanel
                  depth={config.bolsas_reemplazo}
                  titularCount={m1Rows.length}
                  reserveCount={reserveRows.length}
                  extraReserveCount={classroomExtraReserveRowsForState(aulasState).length}
                />
              )}
              {!replacementReady || !replacementSimulation ? (
                <ClassroomEmptyState
                  icon={RefreshCw}
                  title="Simulación pendiente"
                  detail="Después de generar una selección, simula reemplazos sugeridos por celda, balance, repetidos y tamaño efectivo."
                  actionLabel="Simular reemplazos"
                  onAction={runReplacementSimulation}
                  disabled={Boolean(busy) || !selectionReady}
                />
              ) : (
                <ClassroomReplacementTables simulation={replacementSimulation} />
              )}
            </div>
            <aside className="cmv2-classroom-lab-side">
              <div className="cmv2-classroom-note">
                <Route size={15} />
                <span>Calc-Muestra propone titulares y reemplazos; Monitoreo solo activa reemplazos, registra motivos y recalcula brechas sin rediseñar silenciosamente el marco base.</span>
              </div>
              <ClassroomOperationalHandoffPanel selection={selection} replacementSimulation={replacementSimulation} />
            </aside>
          </div>
        )}

        {activeLabTab === "auditoria" && (
          <div className="cmv2-classroom-lab-grid">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Auditoría técnica</span>
                <strong>Fuentes, probabilidades, pesos y advertencias</strong>
              </div>
              <div className="cmv2-classroom-audit-grid">
                {auditRows.map((row) => (
                  <div key={row.label}>
                    <small>{row.label}</small>
                    <strong>{row.value}</strong>
                    <span>{row.detail}</span>
                  </div>
                ))}
              </div>
              <div className="cmv2-classroom-formula-grid">
                <div className="cmv2-classroom-formula">
                  <small>Error de balance</small>
                  <code className="cmv2-classroom-formula-code">brecha(c) = % muestra - % marco</code>
                  <span>La app calcula brechas por cada categoría activa.</span>
                </div>
                <div className="cmv2-classroom-formula">
                  <small>Peso de aula</small>
                  <code className="cmv2-classroom-formula-code">peso = 1 / probabilidad final</code>
                  <span>El peso final usa la probabilidad de selección ya auditada.</span>
                </div>
                <div className="cmv2-classroom-formula">
                  <small>Probabilidad estudiantil interna</small>
                  <code className="cmv2-classroom-formula-code">prob. estudiante = 1 - producto(1 - prob. aula)</code>
                  <span>Se estima desde las aulas del marco; no se exportan datos personales al cliente.</span>
                </div>
                <div className="cmv2-classroom-formula">
                  <small>N efectivo aproximado</small>
                  <code className="cmv2-classroom-formula-code">n_eff ~= (sum w_i)^2 / sum(w_i^2)</code>
                  <span>Advierte cuando pesos muy desiguales reducen precisión.</span>
                </div>
              </div>
              <RepresentativityMetricGrid metrics={representativityMetrics} />
              <ClassroomMethodSources selection={selection} comparison={comparison} />
            </div>
            <aside className="cmv2-classroom-lab-side">
              <ClassroomRiskList risks={comparison?.risk_flags ?? []} />
              <ProfileBalanceChart rows={topGaps} />
              <ClassroomOperationalHandoffPanel selection={selection} replacementSimulation={replacementSimulation} />
            </aside>
          </div>
        )}
        </div>
      </div>

      <div className="cmv2-classroom-note">
        {selectionReady && replacementReady ? <CheckCircle2 size={15} /> : <CirclePendingIcon />}
        <span>
          {selectionReady && replacementReady
            ? "El cálculo de muestra define cuota y sobremuestra; la selección de aulas arma titulares y reemplazos equivalentes. Prosecnur conserva internamente versión del marco, código de reproducción y bitácora para Monitoreo."
            : "Para cerrar esta mesa faltan artefactos operativos: calcula tamaño, compara métodos, selecciona aulas titulares y prueba reemplazos antes de entregar a Monitoreo."}
        </span>
      </div>
    </section>
  );
}

function ClassroomEmptyState({
  icon: Icon,
  title,
  detail,
  actionLabel,
  onAction,
  disabled,
}: {
  icon: typeof Database;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="cmv2-classroom-empty">
      <span><Icon size={18} /></span>
      <div>
        <strong>{title}</strong>
        <em>{detail}</em>
        {actionLabel && onAction && (
          <button type="button" className="cmv2-ghost" onClick={onAction} disabled={disabled}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ObjectiveWeightsPanel({ variables }: { variables?: Array<Record<string, unknown>> | unknown }) {
  const rows = rowsFrom<Record<string, unknown>>(variables);
  const total = rows.reduce((sum, row) => sum + Math.max(0, classroomRowNumber(row, ["weight"])), 0) || 1;
  return (
    <div className="cmv2-representativity-panel">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Objetivo matemático</span>
        <strong>Pesos y tolerancias activas</strong>
      </div>
      <div className="cmv2-objective-bars">
        {rows.map((row) => {
          const weight = Math.max(0, classroomRowNumber(row, ["weight"]));
          const tolerance = classroomRowNumber(row, ["tolerance"]);
          return (
            <div key={classroomRowText(row, ["dimension", "label"])} className="cmv2-objective-row">
              <span>{classroomRowText(row, ["label", "dimension"])}</span>
              <div aria-hidden="true"><i style={{ width: `${Math.max(4, (weight / total) * 100)}%` }} /></div>
              <strong>{fmtPct(weight)}</strong>
              <em>tol. {fmtPct(tolerance)}</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RepresentativityMetricGrid({ metrics }: { metrics?: CalcMuestraAulasRepresentativityMetric[] | unknown }) {
  const visible = rowsFrom<CalcMuestraAulasRepresentativityMetric>(metrics)
    .filter((metric) => metric.active !== false && Number.isFinite(safeNumber(metric.score, Number.NaN)))
    .slice(0, 8);
  if (!visible.length) return null;
  return (
    <div className="cmv2-representativity-metric-grid">
      {visible.map((metric) => (
        <article key={metric.metric_id}>
          <small>{metric.metric_group}</small>
          <strong>{classroomScore(metric.score)}</strong>
          <span>{metric.label}</span>
          <div aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, safeNumber(metric.score, 0)))}%` }} /></div>
        </article>
      ))}
    </div>
  );
}

function ProfileBalanceChart({ rows }: { rows?: CalcMuestraAulasProfileDistribution[] | unknown }) {
  const visible = rowsFrom<CalcMuestraAulasProfileDistribution>(rows)
    .filter((row) => Number.isFinite(safeNumber(row.frame_prop, Number.NaN)) || Number.isFinite(safeNumber(row.selected_prop, Number.NaN)))
    .slice(0, 12);
  if (!visible.length) {
    return (
      <div className="cmv2-classroom-empty is-compact">
        <span><BarChart3 size={16} /></span>
        <div>
          <strong>Sin perfil calculado</strong>
          <em>Construye el marco y corre comparación o selección para ver el ajuste frente al marco.</em>
        </div>
      </div>
    );
  }
  return (
    <div className="cmv2-profile-bars">
      {visible.map((row, index) => {
        const frame = Math.max(0, Math.min(1, safeNumber(row.frame_prop, 0)));
        const selected = Math.max(0, Math.min(1, safeNumber(row.selected_prop, 0)));
        const gap = Math.abs(selected - frame);
        return (
          <div key={`${row.dimension}-${row.category}-${index}`} className={gap > safeNumber(row.tolerance, 1) ? "is-alert" : ""}>
            <div>
              <strong>{row.label || row.dimension}</strong>
              <span>{row.category}</span>
              <em>{fmtPct(gap)} brecha</em>
            </div>
            <div className="cmv2-profile-track" aria-label={`${row.category}: marco ${fmtPct(frame)}, seleccionado ${fmtPct(selected)}`}>
              <i className="is-frame" style={{ width: `${frame * 100}%` }} />
              <i className="is-selected" style={{ width: `${selected * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function classroomExpectedSexLabel(row: Record<string, unknown>, workspace?: CalcMuestraWorkspace) {
  const parts = [
    [classroomRowText(row, ["sex_top_1", "sexo_top_1"]), classroomRowNumber(row, ["sex_top_1_n", "sexo_top_1_n"])],
    [classroomRowText(row, ["sex_top_2", "sexo_top_2"]), classroomRowNumber(row, ["sex_top_2_n", "sexo_top_2_n"])],
  ]
    .filter(([label, value]) => String(label ?? "").trim() && safeNumber(value, 0) > 0)
    .map(([label, value]) => `${workspaceCategoryLabel(workspace, "sex", String(label ?? ""))}: ${fmtInt(safeNumber(value, 0))}`);
  return parts.length ? parts.join(" · ") : "sexo esperado pendiente";
}

function classroomSelectionReason(row: Record<string, unknown>) {
  const explicit = classroomRowText(row, ["selection_reason", "reason", "motivo"]);
  if (explicit) return explicit;
  const faculty = classroomRowText(row, ["faculty", "stratum"]);
  const eligible = classroomRowNumber(row, ["eligible_n"]);
  const pi = classroomRowNumber(row, ["pi_final"]);
  const parts = [
    faculty ? `aporta a ${faculty}` : "",
    eligible > 0 ? `${fmtInt(eligible)} elegibles esperados` : "",
    pi > 0 ? `prob. final ${fmtPct(pi)}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : "aula incluida por el método seleccionado";
}

function ClassroomSelectionRationaleDashboard({ rows, workspace }: { rows?: Array<Record<string, unknown>> | unknown; workspace?: CalcMuestraWorkspace }) {
  const m1Rows = rowsFrom<Record<string, unknown>>(rows).filter((row) => classroomRowText(row, ["wave"]) === "M1" || !classroomRowText(row, ["wave"]));
  if (!m1Rows.length) return null;
  const facultyRows = weightedDistributionRows(m1Rows, ["faculty", "facultad", "stratum"], ["eligible_n"], 12, (value) => workspaceCategoryLabel(workspace, "faculty", value), "faculty");
  const classroomSexRows = classroomSexCompositionRowsFromAulas(m1Rows, workspace, 10);
  const topRows = m1Rows
    .slice()
    .sort((a, b) => classroomRowNumber(b, ["eligible_n"]) - classroomRowNumber(a, ["eligible_n"]))
    .slice(0, 10);
  return (
    <div className="cmv2-selection-rationale">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Por qué estas aulas</span>
        <strong>Lectura operativa de las aulas titulares antes de monitoreo</strong>
      </div>
      <div className="cmv2-selection-rationale-grid">
        <ClassroomPlotCard title="Titulares por facultad" subtitle="elegibles esperados en titulares">
          <ClassroomBarPlot rows={facultyRows} ariaLabel="Aulas titulares por facultad" unit="elegibles" height={235} />
        </ClassroomPlotCard>
        <ClassroomPlotCard title="Sexo esperado por aula titular" subtitle="aporte esperado de titulares">
          <ClassroomSexCompositionPlot rows={classroomSexRows} ariaLabel="Sexo esperado por aula titular" height={260} />
        </ClassroomPlotCard>
      </div>
      <div className="cmv2-classroom-table-wrap">
        <table className="cmv2-table cmv2-classroom-table">
          <thead>
            <tr>
              <th>Aula titular</th>
              <th>Facultad / programa</th>
              <th>Esperado</th>
              <th>Razón operativa</th>
            </tr>
          </thead>
          <tbody>
            {topRows.map((row, index) => (
              <tr key={`${classroomRowText(row, ["classroom_id"])}-${index}`}>
                <td>
                  <span className="cmv2-table-code">{classroomOperationalCode(row, `AULA ${index + 1}`)}</span>
                  <strong>{classroomRowText(row, ["course_name", "label", "classroom_id"])}</strong>
                  <small>{classroomRowText(row, ["classroom_id", "schedule"])}</small>
                </td>
                <td>
                  {classroomRowText(row, ["faculty", "stratum"])}
                  <small>{classroomRowText(row, ["program", "level"])}</small>
                </td>
                <td>
                  {fmtInt(classroomRowNumber(row, ["eligible_n"]))} elegibles
                  <small>{classroomExpectedSexLabel(row, workspace)}</small>
                </td>
                <td>{classroomSelectionReason(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ClassroomReplacementSlot = {
  id: string;
  code: string;
  titularCode: string;
  label: string;
  wave: string;
  order: number;
  match: string;
  scoreDelta: number;
  warning: string;
};

type ClassroomReplacementChain = {
  titularId: string;
  code: string;
  titularLabel: string;
  faculty: string;
  stratum: string;
  eligible: number;
  slots: ClassroomReplacementSlot[];
};

function classroomWaveNumber(wave: string) {
  const match = String(wave ?? "").match(/(\d+)/);
  return match ? Number(match[1]) : 99;
}

function classroomPlanLabel(row: Record<string, unknown>) {
  const role = classroomRowText(row, ["sample_role"]);
  const wave = classroomRowText(row, ["wave"]);
  if (role === "titular" || wave === "M1") return "Titular";
  if (role === "extra_reserve_pool") return "Extra";
  const order = classroomRowNumber(row, ["replacement_order"]);
  if (order > 0) return `Reemplazo ${fmtInt(order)}`;
  const waveNumber = classroomWaveNumber(wave);
  if (waveNumber > 1 && waveNumber < 99) return `Reemplazo ${fmtInt(waveNumber - 1)}`;
  return wave || "Plan";
}

function classroomReplacementRouteLabel(wave: string | undefined, rank?: number) {
  const numericRank = safeNumber(rank, 0);
  if (numericRank > 0) return `Reemplazo ${fmtInt(numericRank)}`;
  const waveNumber = classroomWaveNumber(String(wave ?? ""));
  if (waveNumber > 1 && waveNumber < 99) return `Reemplazo ${fmtInt(waveNumber - 1)}`;
  return String(wave ?? "Ruta");
}

function classroomSlotNumber(slotId: string, fallback: number) {
  const match = String(slotId ?? "").match(/(\d+)/);
  const parsed = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function classroomOperationalCode(row: Record<string, unknown>, fallback: string) {
  return classroomRowText(row, ["operational_code", "codigo_operativo", "codigo_aula_operativa"]) || fallback;
}

function classroomReplacementMatchLabel(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    misma_celda: "Mantiene la celda",
    celda_cercana: "Celda cercana",
    misma_facultad: "Misma facultad",
    mismo_dominio: "Mismo dominio",
    mismo_programa: "Mismo programa",
    cambia_programa: "Cambia programa",
    cambia_carrera: "Cambia carrera",
    cambia_nivel: "Cambia nivel",
    baja_equivalencia: "Baja equivalencia",
    sin_reserva: "Sin reemplazo viable",
  };
  const fallback = normalized.replace(/_/g, " ");
  return labels[normalized] ?? (fallback || "equivalencia pendiente");
}

function classroomReplacementSlotTone(value: string, warning?: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (warning) return "is-warning";
  if (["misma_celda", "mismo_programa", "mismo_dominio"].includes(normalized)) return "is-strong";
  if (["celda_cercana", "misma_facultad"].includes(normalized)) return "is-good";
  return "is-soft";
}

function classroomReplacementWarningText(value: string, status: string, match: string) {
  const warning = String(value ?? "").trim();
  if (!warning) return "";
  const normalizedStatus = String(status ?? "").trim().toLowerCase();
  const normalizedMatch = String(match ?? "").trim().toLowerCase();
  const isExpectedReserve = normalizedStatus === "reserve_conditional";
  const isMethodologicallyClose = ["misma_celda", "mismo_programa", "mismo_dominio", "celda_cercana", "misma_facultad"].includes(normalizedMatch);
  return isExpectedReserve && isMethodologicallyClose ? "" : warning;
}

function classroomReplacementChains(
  selectionRows: Array<Record<string, unknown>>,
  simulation?: CalcMuestraAulasReplacementSimulation | null,
  depth = 6,
): ClassroomReplacementChain[] {
  const titulars = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "titular" || classroomRowText(row, ["wave"]) === "M1");
  const reserves = selectionRows
    .filter((row) => classroomRowText(row, ["sample_role"]) === "chain_reserve" || (classroomRowText(row, ["wave"]) !== "M1" && classroomRowText(row, ["sample_role"]) !== "extra_reserve_pool"))
    .sort((a, b) => safeNumber(a.replacement_order, classroomWaveNumber(classroomRowText(a, ["wave"]))) - safeNumber(b.replacement_order, classroomWaveNumber(classroomRowText(b, ["wave"]))));
  const suggestions = rowsFrom<CalcMuestraAulasReplacementSuggestion>(simulation?.suggestions);
  return titulars.slice(0, 24).map((titular, titularIndex) => {
    const titularId = classroomRowText(titular, ["classroom_id"]);
    const slotId = classroomRowText(titular, ["selection_slot_id"]);
    const slotNumber = classroomSlotNumber(slotId, titularIndex + 1);
    const titularCode = classroomOperationalCode(titular, `AULA ${slotNumber}`);
    const faculty = classroomRowText(titular, ["faculty", "stratum"]);
    const stratum = classroomRowText(titular, ["stratum", "faculty"]);
    const suggestionByReserveId = new Map(suggestions
      .filter((item) => item.titular_classroom_id === titularId)
      .sort((a, b) => safeNumber(a.rank, 99) - safeNumber(b.rank, 99))
      .map((item) => [item.reserve_classroom_id, item] as const));
    const tiedReserves = reserves.filter((reserve) => {
      const reserveId = classroomRowText(reserve, ["classroom_id"]);
      if (!reserveId) return false;
      return Boolean((slotId && classroomRowText(reserve, ["selection_slot_id"]) === slotId) || classroomRowText(reserve, ["replacement_for"]) === titularId);
    });
    const fallbackSource = tiedReserves.length ? tiedReserves : reserves;
    const slotsFromPlan = fallbackSource
      .filter((reserve) => {
        const reserveId = classroomRowText(reserve, ["classroom_id"]);
        if (!reserveId) return false;
        if (tiedReserves.length) return true;
        const sameStratum = stratum && classroomRowText(reserve, ["stratum", "faculty"]) === stratum;
        const sameFaculty = faculty && classroomRowText(reserve, ["faculty", "stratum"]) === faculty;
        return sameStratum || sameFaculty;
      })
      .slice(0, depth)
      .map((reserve) => {
        const reserveId = classroomRowText(reserve, ["classroom_id"]);
        const suggestion = suggestionByReserveId.get(reserveId);
        const match = classroomRowText(reserve, ["equivalence_level"]) || (classroomRowText(reserve, ["stratum"]) === stratum ? "misma_celda" : "misma_facultad");
        return {
          id: reserveId,
          code: classroomOperationalCode(reserve, `R${slotNumber}.${classroomRowNumber(reserve, ["replacement_order"]) || Math.max(1, classroomWaveNumber(classroomRowText(reserve, ["wave"])) - 1)}`),
          titularCode: classroomRowText(reserve, ["titular_operational_code"]) || titularCode,
          label: classroomRowText(reserve, ["course_name", "label", "classroom_id"]),
          wave: classroomRowText(reserve, ["wave"]),
          order: classroomRowNumber(reserve, ["replacement_order"]) || classroomWaveNumber(classroomRowText(reserve, ["wave"])),
          match: suggestion?.match_level || match,
          scoreDelta: safeNumber(suggestion?.score_delta, classroomRowNumber(reserve, ["replacement_impact_score", "chain_score"])),
          warning: suggestion?.warning || classroomReplacementWarningText(
            classroomRowText(reserve, ["analysis_weight_warning"]),
            classroomRowText(reserve, ["activation_weight_status"]),
            match,
          ),
        };
      });
    return {
      titularId,
      code: titularCode,
      titularLabel: classroomRowText(titular, ["course_name", "label", "classroom_id"]),
      faculty,
      stratum,
      eligible: classroomRowNumber(titular, ["eligible_n"]),
      slots: slotsFromPlan.slice(0, depth),
    };
  });
}

function ClassroomReplacementChainPanel({
  selectionRows,
  simulation,
  depth = 6,
}: {
  selectionRows?: Array<Record<string, unknown>> | unknown;
  simulation?: CalcMuestraAulasReplacementSimulation | null;
  depth?: number;
}) {
  const rows = rowsFrom<Record<string, unknown>>(selectionRows);
  const chains = classroomReplacementChains(rows, simulation, depth);
  const extraPool = rows.filter((row) => classroomRowText(row, ["sample_role"]) === "extra_reserve_pool").length;
  const maxDepth = Math.max(1, Math.min(depth, 6));
  if (!chains.length) {
    return (
      <ClassroomEmptyState
        icon={Route}
        title="Cadena de reemplazos pendiente"
        detail="Genera la selección para ver cada aula titular y sus reemplazos Rn.1, Rn.2 y siguientes."
      />
    );
  }
  return (
    <div className="cmv2-replacement-chain-panel">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Rutas operativas</span>
        <strong>Códigos de aula titular y reemplazos asociados</strong>
        <small>Estos códigos viajan a agenda, Excel/Sheets y Monitoreo para activar reemplazos sin cambiar el diseño.</small>
      </div>
      <div className="cmv2-replacement-chain-summary">
        <Metric label="Titulares con ruta" value={fmtInt(chains.length)} />
        <Metric label="Código operativo" value="AULA n / Rn.k" />
        <Metric label="Reemplazos por ruta" value={`R1-R${maxDepth}`} />
        <Metric label="Aulas extra" value={extraPool ? fmtInt(extraPool) : "sin extra"} />
      </div>
      <div className="cmv2-backend-field-strip" aria-label="Datos visibles usados en rutas de reemplazo">
        <span>Código visible de aula</span>
        <span>Titular asociada</span>
        <span>Orden de reemplazo</span>
      </div>
      <div className="cmv2-chain-route-list">
        {chains.map((chain) => (
          <article key={chain.titularId} className="cmv2-chain-route-card">
            <div className="cmv2-chain-route-head">
              <div className="cmv2-chain-titular">
                <span className="cmv2-chain-code">{chain.code}</span>
                <strong>{chain.titularLabel}</strong>
                <small>{chain.faculty} · {fmtInt(chain.eligible)} elegibles</small>
              </div>
              <div className="cmv2-chain-monitoring-note">
                <strong>Activación ordenada</strong>
                <small>Si cae {chain.code}, Monitoreo toma el primer reemplazo viable y registra el motivo.</small>
              </div>
            </div>
            <div className="cmv2-chain-route-slots" aria-label={`Reemplazos para ${chain.titularLabel}`}>
              {Array.from({ length: maxDepth }, (_, index) => {
                const slot = chain.slots[index];
                if (!slot) {
                  return (
                    <span key={index} className="cmv2-chain-empty-slot">
                      <b>M{index + 2}</b>
                      sin reemplazo
                    </span>
                  );
                }
                return (
                  <div key={slot.id || index} className={`cmv2-chain-slot ${classroomReplacementSlotTone(slot.match, slot.warning)}`}>
                    <span>
                      <strong>{slot.label}</strong>
                      <b>{slot.code || (slot.order ? `R${slot.order}` : slot.wave)}</b>
                    </span>
                    <small>{classroomReplacementMatchLabel(slot.match)} · reemplaza {slot.titularCode}{slot.scoreDelta ? ` · impacto ${classroomNumberText({ value: slot.scoreDelta }, ["value"])}` : ""}</small>
                    {slot.warning && <em>{slot.warning}</em>}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ClassroomOperationalHandoffPanel({
  selection,
  replacementSimulation,
}: {
  selection: CalcMuestraAulasSelection | null;
  replacementSimulation?: CalcMuestraAulasReplacementSimulation | null;
}) {
  const selectionRows = rowsFrom<Record<string, unknown>>(selection?.selection);
  const titulares = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "titular" || classroomRowText(row, ["wave"]) === "M1").length;
  const reservas = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "chain_reserve" || (classroomRowText(row, ["wave"]) !== "M1" && classroomRowText(row, ["sample_role"]) !== "extra_reserve_pool")).length;
  const reservaExtra = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "extra_reserve_pool").length;
  const sugerencias = rowsFrom<CalcMuestraAulasReplacementSuggestion>(replacementSimulation?.suggestions).length;
  const hasSelection = selectionRows.length > 0;
  return (
    <div className="cmv2-handoff-map">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Aplicación en aulas</span>
        <strong>Cómo pasa esta muestra al estudio de hostigamiento</strong>
      </div>
      <AulasApplicationFlow
        tone="calc-muestra"
        current="muestra"
        compact
        title="Del diseño de aulas al campo de hostigamiento"
        summary="El cálculo de muestra de aulas produce titulares, reservas, pesos y códigos. El motor QR/PDF convierte esa agenda en fichas y Monitoreo de aulas registra aplicación, caídas y reemplazos."
        metrics={[
          { label: "Titulares", value: fmtInt(titulares), tone: titulares ? "ready" : "warning" },
          { label: "Reservas", value: fmtInt(reservas + reservaExtra), tone: reservas || reservaExtra ? "ready" : "neutral" },
          { label: "Sugerencias", value: fmtInt(sugerencias), tone: sugerencias ? "current" : "neutral" },
        ]}
        secondaryAction={{ to: "/monitoreo", label: "Ver monitoreo de aulas" }}
        action={{ to: "/recopiladores", label: "Abrir fichas QR", disabled: !hasSelection }}
      />
    </div>
  );
}

function sumClassroomMetric(rows: Array<Record<string, unknown>>, keys: string[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, classroomRowNumber(row, keys)), 0);
}

function CoverageOverlapPanel({
  rows,
  selectionRows,
  framePopulation,
}: {
  rows?: Array<Record<string, unknown>> | unknown;
  selectionRows?: Array<Record<string, unknown>> | unknown;
  framePopulation?: number;
}) {
  const metricRows = rowsFrom<Record<string, unknown>>(rows);
  const selectedRows = rowsFrom<Record<string, unknown>>(selectionRows);
  const covered = classroomMetricValue(metricRows, "selected_unique_students");
  const exposure = classroomMetricValue(metricRows, "selected_student_course_exposure");
  const coverage = classroomMetricValue(metricRows, "coverage_population_pct");
  const efficiency = classroomMetricValue(metricRows, "coverage_efficiency");
  const duplicateLoss = classroomMetricValue(metricRows, "duplicate_loss");
  const estimatedExposure = sumClassroomMetric(selectedRows, ["eligible_n", "expected_valid", "enrolled_total"]);
  const duplicateOverlap = sumClassroomMetric(selectedRows, ["duplicate_overlap", "overlap_n", "repeated_students"]);
  const exactCoverage = Number.isFinite(covered);
  const exactExposure = Number.isFinite(exposure);
  const exactDuplicateLoss = Number.isFinite(duplicateLoss);
  const frameN = safeNumber(framePopulation, 0);
  const coverageDetail = Number.isFinite(coverage)
    ? `${fmtPct(coverage)} del marco`
    : frameN && estimatedExposure
      ? `${fmtInt(frameN)} estudiantes en el marco`
      : selectedRows.length
        ? `${fmtInt(selectedRows.length)} aulas titulares`
        : "genera una selección";
  const exposureDetail = Number.isFinite(efficiency)
    ? `${fmtPct(efficiency)} eficiencia única`
    : exactExposure
      ? "exposición reportada por el motor"
      : selectedRows.length
        ? "estimación desde aulas seleccionadas"
        : "sin selección";
  const duplicateValue = exactDuplicateLoss
    ? fmtPct(duplicateLoss)
    : duplicateOverlap
      ? `${fmtInt(duplicateOverlap)} repetidos`
      : selectedRows.length
        ? "sin métrica exacta"
        : "pendiente";
  const duplicateDetail = exactDuplicateLoss
    ? "calculado con llaves estudiante-aula"
    : duplicateOverlap
      ? "suma observada en aulas titulares"
      : selectedRows.length
        ? "requiere llave estudiante-aula para medir repetidos"
        : "se calcula después de seleccionar aulas";
  return (
    <div className="cmv2-coverage-panel">
      <article>
        <Users size={16} />
        <small>{exactCoverage ? "Estudiantes únicos cubiertos" : "Elegibles esperados en titulares"}</small>
        <strong>{exactCoverage ? fmtInt(covered) : estimatedExposure ? fmtInt(estimatedExposure) : "sin estimación"}</strong>
        <span>{coverageDetail}</span>
      </article>
      <article>
        <Layers3 size={16} />
        <small>Exposición alumno-curso</small>
        <strong>{exactExposure ? fmtInt(exposure) : estimatedExposure ? fmtInt(estimatedExposure) : "sin estimación"}</strong>
        <span>{exposureDetail}</span>
      </article>
      <article>
        <Gauge size={16} />
        <small>Pérdida por repetidos</small>
        <strong>{duplicateValue}</strong>
        <span>{duplicateDetail}</span>
      </article>
    </div>
  );
}

function SimulationSummaryPanel({ rows }: { rows?: CalcMuestraAulasSimulationSummary[] | unknown }) {
  const summaryRows = rowsFrom<CalcMuestraAulasSimulationSummary>(rows);
  if (!summaryRows.length) {
    return (
      <div className="cmv2-classroom-empty is-compact">
        <span><BarChart3 size={16} /></span>
        <div>
          <strong>Simulación pendiente</strong>
          <em>Corre el comparador para estimar estabilidad, cobertura y pérdida por estudiantes repetidos.</em>
        </div>
      </div>
    );
  }
  return (
    <div className="cmv2-simulation-grid">
      {summaryRows.map((row) => (
        <article key={row.method_id}>
          <small>{classroomMethodLabel(row.method_id)}</small>
          <strong>{classroomScore(row.score_mean)}</strong>
          <span>{fmtInt(safeNumber(row.executed_runs, 0))}/{fmtInt(safeNumber(row.requested_runs, 0))} corridas</span>
          <div className="cmv2-simulation-range" aria-label={`Rango ${classroomScore(row.score_p10)} a ${classroomScore(row.score_p90)}`}>
            <i style={{
              left: `${Math.max(0, Math.min(100, safeNumber(row.score_p10, 0)))}%`,
              width: `${Math.max(2, Math.min(100, safeNumber(row.score_p90, 0)) - Math.max(0, safeNumber(row.score_p10, 0)))}%`,
            }} />
          </div>
          <em>{row.note}</em>
        </article>
      ))}
    </div>
  );
}

function MethodSummaryCard({
  method,
  active,
  onSelect,
}: {
  method: CalcMuestraAulasMethodSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`cmv2-classroom-quality-card ${active ? "is-recommended" : ""}`}>
      <div>
        <small>{active ? "Recomendado" : method.method_id}</small>
        <strong>{method.method_label}</strong>
        <span>{method.operational_reason ?? classroomMethodReason(String(method.method_id))}</span>
      </div>
      <div className="cmv2-classroom-quality-metrics">
        <span><strong>{classroomScore(method.representativity_score ?? method.overall_score)}</strong> representatividad</span>
        <span><strong>{classroomScore(method.balance_score)}</strong> balance</span>
        <span><strong>{fmtPct(method.duplicate_loss ?? 0)}</strong> repetidos</span>
        <span><strong>{fmtPct(method.coverage_unique_pct ?? 0)}</strong> cobertura</span>
      </div>
      <button type="button" className={active ? "cmv2-primary" : "cmv2-ghost"} onClick={onSelect}>
        Usar método <ArrowRight size={13} />
      </button>
    </article>
  );
}

function ClassroomRecommendation({
  comparison,
  fallbackMethod,
}: {
  comparison: CalcMuestraAulasMethodComparison | null;
  fallbackMethod: string;
}) {
  if (!comparison?.recommendation) {
    return (
      <div className="cmv2-classroom-reco-panel">
        <small>Recomendación</small>
        <strong>{fallbackMethod}</strong>
        <span>Corre el comparador para que Prosecnur recomiende un método con métricas reales del marco.</span>
      </div>
    );
  }
  return (
    <div className="cmv2-classroom-reco-panel is-ready">
      <small>Recomendación del laboratorio</small>
      <strong>{comparison.recommendation.method_label ?? classroomMethodLabel(comparison.recommendation.method_id ?? "")}</strong>
      <span>{comparison.recommendation.operational_reason}</span>
      <b>Calidad {classroomScore(comparison.recommendation.representativity_score ?? comparison.recommendation.overall_score)} · distancia {classroomNumberText(comparison.recommendation as Record<string, unknown>, ["representativity_distance"])}</b>
      <em>{comparison.recommendation.methodological_reason}</em>
    </div>
  );
}

function ClassroomRiskList({ risks }: { risks?: NonNullable<CalcMuestraAulasMethodComparison["risk_flags"]> | unknown }) {
  const riskRows = rowsFrom<Record<string, unknown>>(risks);
  const visible = riskRows.length ? riskRows.slice(0, 8) : [{
    code: "sin_alertas",
    severity: "ok",
    title: "Sin alertas críticas",
    detail: "La auditoría interna no reporta riesgos activos para el último cálculo.",
  }];
  return (
    <div className="cmv2-classroom-risk-list">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Riesgos</span>
        <strong>Alertas interpretables</strong>
      </div>
      {visible.map((risk, index) => (
        <div key={`${String(risk.code ?? "riesgo")}-${index}`} className={`is-${String(risk.severity ?? "media")}`}>
          <small>{String(risk.severity ?? "media")}</small>
          <strong>{String(risk.title ?? "Alerta metodológica")}</strong>
          <span>{String(risk.detail ?? "Revisa la auditoría técnica del selector.")}</span>
        </div>
      ))}
    </div>
  );
}

function ClassroomBalanceTable({ rows, methodId }: { rows?: Array<Record<string, unknown>> | unknown; methodId: string }) {
  const visible = rowsFrom<Record<string, unknown>>(rows)
    .filter((row) => !methodId || classroomRowText(row, ["method_id"]) === methodId)
    .slice(0, 10);
  if (!visible.length) {
    return (
      <div className="cmv2-classroom-empty is-compact">
        <span><BarChart3 size={16} /></span>
        <div>
          <strong>Sin diagnóstico de balance visible</strong>
          <em>El comparador no devolvió filas de balance para este método.</em>
        </div>
      </div>
    );
  }
  return (
    <div className="cmv2-classroom-table-wrap">
      <table className="cmv2-table cmv2-classroom-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Categoría</th>
            <th>Marco</th>
            <th>Seleccionado</th>
            <th>Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={index}>
              <td>{classroomRowText(row, ["variable"])}</td>
              <td>{classroomRowText(row, ["categoria", "category"])}</td>
              <td>{fmtPct(classroomRowNumber(row, ["marco_prop", "frame_share"]))}</td>
              <td>{fmtPct(classroomRowNumber(row, ["seleccion_m1_prop", "selected_share"]))}</td>
              <td>{fmtPct(classroomRowNumber(row, ["diferencia_abs", "delta"]))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassroomSelectionTable({ rows }: { rows?: Array<Record<string, unknown>> | unknown }) {
  const tableRows = rowsFrom<Record<string, unknown>>(rows);
  if (!tableRows.length) {
    return (
      <div className="cmv2-classroom-empty is-compact">
        <span><Table2 size={16} /></span>
        <div>
          <strong>Sin filas para mostrar</strong>
          <em>Ajusta el filtro o genera una selección.</em>
        </div>
      </div>
    );
  }
  return (
    <div className="cmv2-classroom-table-wrap">
      <table className="cmv2-table cmv2-classroom-table">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Código y aula</th>
            <th>Facultad / programa</th>
            <th>Horario</th>
            <th>Elegibles</th>
            <th>Prob. usada</th>
            <th>Peso</th>
            <th>Repetidos</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, index) => (
            <tr key={`${classroomRowText(row, ["classroom_id"])}-${index}`}>
              <td>{classroomPlanLabel(row)}<small>{classroomRowText(row, ["wave"])}</small></td>
              <td>
                <span className="cmv2-table-code">{classroomOperationalCode(row, classroomRowText(row, ["wave"]) === "M1" ? `AULA ${index + 1}` : classroomRowText(row, ["wave"]))}</span>
                <strong>{classroomRowText(row, ["course_name", "label", "classroom_id"])}</strong>
                <small>{classroomRowText(row, ["field_status", "operation_status", "estado", "classroom_id"])}</small>
              </td>
              <td>
                {classroomRowText(row, ["faculty", "stratum"])}
                <small>{classroomRowText(row, ["program", "level"])}</small>
              </td>
              <td>{classroomRowText(row, ["schedule", "modality"])}</td>
              <td>{fmtInt(classroomRowNumber(row, ["eligible_n"]))}</td>
              <td>{fmtPct(classroomRowNumber(row, ["pi_final"]))}</td>
              <td>{classroomNumberText(row, ["weight_classroom"])}</td>
              <td>{fmtInt(classroomRowNumber(row, ["duplicate_overlap"]))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassroomOverlapGraph({ rows }: { rows?: Array<Record<string, unknown>> | unknown }) {
  const visible = rowsFrom<Record<string, unknown>>(rows)
    .slice(0, 8)
    .map((row, index) => ({
      id: classroomRowText(row, ["classroom_id"]) || `aula-${index}`,
      label: classroomOperationalCode(row, `AULA ${index + 1}`),
      overlap: classroomRowNumber(row, ["duplicate_overlap"]),
      x: 36 + (index % 2) * 128,
      y: 36 + Math.floor(index / 2) * 54,
    }));
  const maxOverlap = Math.max(1, ...visible.map((item) => item.overlap));
  return (
    <div className="cmv2-classroom-overlap-graph">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Repetidos</span>
        <strong>Aulas titulares</strong>
      </div>
      {!visible.length ? (
        <span className="cmv2-classroom-muted">Genera selección para ver si las aulas comparten muchos estudiantes.</span>
      ) : (
        <svg viewBox="0 0 230 250" role="img" aria-label="Grafo simple de estudiantes repetidos entre aulas">
          {visible.slice(1).map((item, index) => (
            <line
              key={`line-${item.id}`}
              x1={visible[index].x}
              y1={visible[index].y}
              x2={item.x}
              y2={item.y}
              stroke="#d8e1ec"
              strokeWidth={1}
            />
          ))}
          {visible.map((item) => {
            const radius = 11 + Math.min(14, (item.overlap / maxOverlap) * 14);
            return (
              <g key={item.id}>
                <circle cx={item.x} cy={item.y} r={radius} fill="rgba(15, 118, 110, 0.12)" stroke="#0f766e" strokeWidth={1.2} />
                <text x={item.x} y={item.y + 3} textAnchor="middle">{fmtInt(item.overlap)}</text>
                <text x={item.x} y={item.y + radius + 13} textAnchor="middle">{String(item.label).slice(0, 16)}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function ClassroomReplacementTables({ simulation }: { simulation: CalcMuestraAulasReplacementSimulation }) {
  const suggestions = rowsFrom<CalcMuestraAulasReplacementSuggestion>(simulation?.suggestions).slice(0, 18);
  if (!suggestions.length) {
    return (
      <ClassroomEmptyState
        icon={RefreshCw}
        title="Sin reemplazos sugeridos"
        detail="La simulación existe, pero no trae sugerencias compatibles con este estado. Vuelve a simular reemplazos con la selección actual."
      />
    );
  }
  return (
    <div className="cmv2-classroom-replacement-stack">
      <div className="cmv2-classroom-table-wrap">
        <table className="cmv2-table cmv2-classroom-table">
          <thead>
            <tr>
              <th>Si cae</th>
              <th>Usar reemplazo</th>
              <th>Ruta</th>
              <th>Equivalencia</th>
              <th>Representatividad</th>
              <th>Cambio</th>
              <th>Repetidos</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((item) => (
              <tr key={`${item.titular_classroom_id}-${item.reserve_classroom_id}-${item.rank}`}>
                <td>
                  <span className="cmv2-table-code">{item.titular_operational_code || "AULA"}</span>
                  {item.titular_label || item.titular_classroom_id}
                  <small>{item.titular_classroom_id}</small>
                </td>
                <td>
                  <span className="cmv2-table-code">{item.reserve_operational_code || item.replacement_chain_code || `R${item.rank}`}</span>
                  {item.reserve_label || item.reserve_classroom_id}
                  <small>{item.reserve_classroom_id}</small>
                </td>
                <td>{classroomReplacementRouteLabel(item.wave, item.rank)}<small>{item.wave}</small></td>
                <td>{item.match_level}</td>
                <td>{classroomScore(item.after_score ?? item.score)}</td>
                <td>{classroomNumberText(item as unknown as Record<string, unknown>, ["score_delta"])}</td>
                <td>{fmtInt(item.overlap_delta ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ClassroomImpactTable rows={simulation?.impact ?? []} />
    </div>
  );
}

function ClassroomImpactTable({ rows }: { rows?: Array<Record<string, unknown>> | unknown }) {
  const visible = rowsFrom<Record<string, unknown>>(rows).slice(0, 12);
  if (!visible.length) return null;
  return (
    <div className="cmv2-classroom-table-wrap">
      <table className="cmv2-table cmv2-classroom-table">
        <thead>
          <tr>
            <th>Titular</th>
            <th>Reemplazo</th>
            <th>Representatividad</th>
            <th>Efecto en cuotas</th>
            <th>Cambio de elegibles</th>
            <th>Advertencia</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={index}>
              <td>
                <span className="cmv2-table-code">{classroomRowText(row, ["titular_operational_code"]) || "AULA"}</span>
                {classroomRowText(row, ["titular_classroom_id"])}
              </td>
              <td>
                <span className="cmv2-table-code">{classroomRowText(row, ["replacement_operational_code"]) || "R"}</span>
                {classroomRowText(row, ["suggested_replacement_id"])}
              </td>
              <td>{classroomScore(classroomRowNumber(row, ["after_score"]))}<small>{classroomNumberText(row, ["score_delta"])}</small></td>
              <td>{classroomRowText(row, ["balance_effect"])}</td>
              <td>{classroomNumberText(row, ["eligible_delta"])}</td>
              <td>{classroomRowText(row, ["warning"]) || "sin alerta"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassroomMethodSources({
  selection,
  comparison,
}: {
  selection: CalcMuestraAulasSelection | null;
  comparison: CalcMuestraAulasMethodComparison | null;
}) {
  const sourceRows = [
    { label: "Fuente oficial", value: selection?.official_reference ?? "OECD/PISA, NCES/NAEP, UN, Eurostat, AAPOR" },
    { label: "Fuente académica", value: selection?.academic_reference ?? "Deville & Tillé; Statistics Canada; Groves & Heeringa" },
    { label: "Implementación", value: selection?.implementation_reference ?? "sampling::samplecube(); BalancedSampling::lcube/lpm2" },
    { label: "Probabilidades", value: selection ? classroomProbabilitySourceLabel(selection.probability_source) : classroomMethodLabel(comparison?.recommendation?.method_id ?? "") || "pendiente" },
    { label: "Pesos", value: selection?.weight_source ?? "peso de aula = 1 / probabilidad final; probabilidad estudiantil agregada" },
    { label: "No respuesta", value: selection?.nonresponse_policy ?? "códigos de disposición y ajuste posterior por dominio" },
  ];
  return (
    <div className="cmv2-classroom-source-grid">
      {sourceRows.map((row) => (
        <div key={row.label}>
          <small>{row.label}</small>
          <span>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function classroomRowText(row: Record<string, unknown> | undefined, keys: string[]) {
  if (!row) return "";
  const value = rowValueForCandidates(row, keys);
  return rowValueIsPresent(value) ? String(value) : "";
}

function rowsFrom<T = Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const arrayKeys = Object.keys(record).filter((key) => Array.isArray(record[key]));
  if (!arrayKeys.length) return [];
  const rowCount = Math.max(...arrayKeys.map((key) => (record[key] as unknown[]).length));
  if (!Number.isFinite(rowCount) || rowCount <= 0) return [];
  return Array.from({ length: rowCount }, (_, index) => {
    const row: Record<string, unknown> = {};
    arrayKeys.forEach((key) => {
      row[key] = (record[key] as unknown[])[index];
    });
    return row as T;
  });
}

function classroomRowNumber(row: Record<string, unknown> | undefined, keys: string[]) {
  if (!row) return 0;
  for (const key of keys) {
    const value = rowValueForCandidate(row, key);
    const n = safeNumber(value, Number.NaN);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function classroomMetricValue(rows: Array<Record<string, unknown>>, metric: string) {
  const row = rows.find((item) => classroomRowText(item, ["metric"]) === metric);
  return row ? classroomRowNumber(row, ["value"]) : Number.NaN;
}

function classroomNumberText(row: Record<string, unknown>, keys: string[]) {
  const n = classroomRowNumber(row, keys);
  if (!Number.isFinite(n)) return "—";
  return Math.abs(n) >= 100 ? fmtInt(n) : n.toFixed(3).replace(/\.?0+$/, "");
}

function classroomRowSearch(row: Record<string, unknown>, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(q));
}

function classroomMethodLabel(methodId: string) {
  return UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((option) => option.id === methodId)?.label ?? methodId;
}

function classroomMethodReason(methodId: string) {
  return UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((option) => option.id === methodId)?.detail ??
    "Método auditable registrado en la bitácora metodológica.";
}

function classroomProbabilitySourceLabel(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Diseño probabilístico base";
  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    prescribed_design: "Diseño definido por el cálculo",
    design: "Diseño probabilístico base",
    base_design: "Diseño probabilístico base",
    pps: "PPS sistemático",
    pps_systematic: "PPS sistemático",
    balanced_probability: "Balance probabilístico",
    probability_with_operational_optimization: "Optimización con probabilidad auditada",
    simulation: "Simulación de probabilidades",
    simulated: "Simulación de probabilidades",
    monte_carlo: "Simulación Monte Carlo",
  };
  return labels[key] ?? raw.replace(/_/g, " ");
}

function classroomScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value <= 1) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}/100`;
}

function selectorFieldLabel(field: string) {
  const labels: Record<string, string> = {
    faculty: "facultad",
    sex_top_1: "sexo esperado",
    size_group: "tamaño de aula",
  };
  return labels[field] ?? field;
}

function estimateClassroomBase(comp: CalcMuestraComponente) {
  const fromResult = safeNumber(comp.resultado?.aulas_base_total, 0);
  if (fromResult > 0) return fromResult;
  const fixed = (comp.marco.estratos ?? []).reduce((sum, e) => sum + safeNumber(e.aulas_base_fijas, 0), 0);
  if (fixed > 0) return fixed;
  const target = safeNumber(comp.meta.valor, 0);
  if (target <= 0) return null;
  const operative = target * (1 + safeNumber(comp.parametros.oversample_pct, 0));
  const effectiveClassroom = Math.max(1, safeNumber(comp.parametros.promedio_conglomerado, 25) * safeNumber(comp.parametros.tau, 0.7));
  return Math.ceil(operative / effectiveClassroom);
}

function estimateOperationalExtra(estratos: CalcMuestraEstrato[], config: CalcMuestraWorkspaceAulasConfig) {
  const fromEstratos = estratos.reduce((sum, e) => sum + safeNumber(e.aulas_extra_operativas, 0), 0);
  if (fromEstratos > 0) return fromEstratos;
  const cells = Math.max(1, estratos.filter((e) => safeNumber(e.N) > 0).length);
  return cells * config.aulas_extra_operativas_default;
}

function CirclePendingIcon() {
  return <span className="cmv2-pending-dot" aria-hidden="true" />;
}

function UniversityRevampFacultadesTable({
  estratos,
  onEstratos,
}: {
  estratos: CalcMuestraEstrato[];
  onEstratos: (estratos: CalcMuestraEstrato[]) => void;
}) {
  function update(index: number, patch: Partial<CalcMuestraEstrato>) {
    onEstratos(estratos.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  const totals = estratos.reduce(
    (acc, e) => ({
      N: acc.N + safeNumber(e.N),
      mujeres: acc.mujeres + safeNumber(e.N_a),
      hombres: acc.hombres + safeNumber(e.N_b),
    }),
    { N: 0, mujeres: 0, hombres: 0 },
  );
  const hasRows = estratos.length > 0;
  return (
    <div className="cmv2-university-table-block">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Tabla editable</span>
        <strong>Facultades del marco</strong>
      </div>
      <div className={`cmv2-table-wrap cmv2-university-table-scroll ${hasRows ? "" : "cmv2-university-table-empty"}`}>
        {hasRows ? (
          <table className="cmv2-table cmv2-table--university-edit">
            <thead>
              <tr>
                <th>Facultad</th>
                <th>Total</th>
                <th>Mujeres</th>
                <th>Hombres</th>
                <th>Error facultad</th>
                <th>Confianza</th>
                <th>p éxito</th>
                <th>+ aulas</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {estratos.map((e, i) => (
                <tr key={e.id}>
                  <td><input className="cmv2-table-input" value={e.label} onChange={(ev) => update(i, { label: ev.currentTarget.value })} /></td>
                  <td><NumberCell value={e.N} onChange={(v) => {
                    const N = Math.round(v);
                    update(i, { N, e_facultad: universityFacultyError(N), confianza_facultad: universityFacultyConfidence(N) });
                  }} /></td>
                  <td><NumberCell value={e.N_a} onChange={(v) => update(i, { N_a: Math.round(v) })} /></td>
                  <td><NumberCell value={e.N_b} onChange={(v) => update(i, { N_b: Math.round(v) })} /></td>
                  <td><NumberCell value={e.e_facultad} step={0.005} suffix="prop." onChange={(v) => update(i, { e_facultad: v })} /></td>
                  <td><NumberCell value={e.confianza_facultad} step={0.01} suffix="prop." onChange={(v) => update(i, { confianza_facultad: v, z_facultad: undefined })} /></td>
                  <td><NumberCell value={e.p_facultad} step={0.01} suffix="prop." onChange={(v) => update(i, { p_facultad: v })} /></td>
                  <td><NumberCell value={e.aulas_extra_operativas} step={1} onChange={(v) => update(i, { aulas_extra_operativas: Math.max(0, Math.round(v)) })} /></td>
                  <td>
                    <button
                      type="button"
                      className="cmv2-icon-button"
                      onClick={() => onEstratos(estratos.filter((_, idx) => idx !== i))}
                      aria-label="Eliminar facultad"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="cmv2-total-row">
                <td><strong>Total</strong></td>
                <td>{fmtInt(totals.N)}</td>
                <td>{fmtInt(totals.mujeres)}</td>
                <td>{fmtInt(totals.hombres)}</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td />
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="cmv2-university-empty-frame">
            <span className="cmv2-card-icon"><Database size={18} /></span>
            <div>
              <span className="cmv2-eyebrow">Marco sin facultades</span>
              <strong>Base institucional pendiente</strong>
              <div className="cmv2-university-empty-tags">
                <span>facultad</span>
                <span>sexo</span>
                <span>curso y horario</span>
                <span>elegibles</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="cmv2-inline-actions">
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => onEstratos([
            ...estratos,
            estrato(`Facultad ${estratos.length + 1}`, 0, {
              sub_a_label: "Mujeres",
              sub_b_label: "Hombres",
              e_facultad: universityFacultyError(0),
              confianza_facultad: universityFacultyConfidence(0),
              p_facultad: 0.5,
              aulas_extra_operativas: 1,
            }),
          ])}
        >
          <Plus size={14} /> Agregar facultad
        </button>
      </div>
    </div>
  );
}

function UniversityRevampParametrosPanel({
  totalComp,
  facultyComp,
  onComponente,
}: {
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const total = totalComp.parametros;
  const faculty = facultyComp.parametros;
  return (
    <div className="cmv2-university-param-panel">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Parámetros</span>
        <strong>Cálculo de muestra</strong>
      </div>
      <div className="cmv2-proposal-param-block">
        <h4>Representatividad a nivel universidad</h4>
        <div className="cmv2-proposal-param-grid">
          <Param label="Confianza z" value={total.z} step={0.01} onChange={(v) => onComponente(totalComp.id, { parametros: { z: v } })} />
          <Param label="p esperada" value={total.p} step={0.01} onChange={(v) => onComponente(totalComp.id, { parametros: { p: v } })} />
          <Param label="Error global" value={total.e} step={0.005} suffix="prop." onChange={(v) => onComponente(totalComp.id, { parametros: { e: v } })} />
          <Param label="Deff" value={total.deff} step={0.1} onChange={(v) => onComponente(totalComp.id, { parametros: { deff: v } })} />
          <Param label="Sobremuestra" value={total.oversample_pct} step={0.05} suffix="prop." onChange={(v) => onComponente(totalComp.id, { parametros: { oversample_pct: v } })} />
        </div>
      </div>
      <div className="cmv2-proposal-param-block">
        <h4>Representatividad a nivel facultad</h4>
        <div className="cmv2-proposal-param-grid">
          <Param label="Confianza z" value={faculty.z} step={0.01} onChange={(v) => onComponente(facultyComp.id, { parametros: { z: v } })} />
          <Param label="p esperada" value={faculty.p} step={0.01} onChange={(v) => onComponente(facultyComp.id, { parametros: { p: v } })} />
          <Param label="Deff" value={faculty.deff} step={0.1} onChange={(v) => onComponente(facultyComp.id, { parametros: { deff: v } })} />
          <Param label="Sobremuestra" value={faculty.oversample_pct} step={0.05} suffix="prop." onChange={(v) => onComponente(facultyComp.id, { parametros: { oversample_pct: v } })} />
        </div>
      </div>
    </div>
  );
}

function UniversityRevampCalculoPanel({
  componentes,
  workspace,
  draftTargets,
  onDraftTarget,
  onApplyTarget,
  calculando,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  workspace: CalcMuestraWorkspace;
  draftTargets: Record<string, number>;
  onDraftTarget: (componentId: string, value: number) => void;
  onApplyTarget: (componentId: string, value: number) => void;
  calculando: boolean;
}) {
  const scenarios = workspace.escenarios.length ? workspace.escenarios : ESCENARIOS_OPINION;
  return (
    <section className="cmv2-panel cmv2-university-calc-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Cálculo</span>
        <strong>Fórmula, n final y ajuste</strong>
      </div>
      <div className="cmv2-university-calc-grid">
        {componentes.map((comp) => {
          const scenario = scenarios.find((e) => e.component_id === comp.id);
          const formula = comp.resultado?.n_teorico ?? componentFormulaBase(comp);
          const rounded = roundUpTo(formula, scenario?.redondeo_multiplo ?? 100);
          const applied = safeNumber(comp.meta.valor) > 0 ? Math.round(comp.meta.valor) : rounded;
          const draft = draftTargets[comp.id] ?? applied ?? 0;
          const belowMinimum = formula != null && draft > 0 && draft < formula;
          const extra = formula != null && draft > 0 ? draft - formula : null;
          const precision = comp.tecnica === "prob_estratificado_independiente"
            ? null
            : comp.resultado?.precision_alcanzada ?? calcEPreview(draft, comp.marco.marco_validado, comp.parametros.p, comp.parametros.z, comp.parametros.deff);
          const sobremuestra = draft > 0 ? Math.ceil(draft * safeNumber(comp.parametros.oversample_pct)) : null;
          const operativo = comp.resultado?.n_operativo ?? (sobremuestra == null ? null : draft + sobremuestra);
          return (
            <article key={comp.id} className={`cmv2-calc-card ${belowMinimum ? "is-warning" : ""}`}>
              <div className="cmv2-calc-card-head">
                <span>{proposalShortLabel(comp)}</span>
                <ProductBadge producto="muestra_probabilistica" />
              </div>
              <h3>{comp.actor}</h3>
              <div className="cmv2-formula-inline">
                <LatexMath
                  display={false}
                  expression={String.raw`n=\frac{N Z^2 p(1-p) DEFF}{(N-1)e^2+Z^2p(1-p)DEFF}`}
                />
              </div>
              <p className="cmv2-calc-params">
                N={fmtInt(comp.marco.marco_validado)} · Z={comp.parametros.z} · deff={comp.parametros.deff}
                {comp.tecnica === "prob_estratificado_independiente"
                  ? " · e y p por facultad"
                  : ` · p=${comp.parametros.p} · e=${comp.parametros.e}`}
              </p>
              <div className="cmv2-calc-card-grid">
                <Metric label="n fórmula" value={fmtInt(formula)} />
                <Metric label={`Redondeo ${fmtInt(scenario?.redondeo_multiplo ?? 100)}`} value={fmtInt(rounded)} />
                <Metric label="Ajuste n" value={fmtSignedInt(extra)} />
                <Metric label="Con sobremuestra" value={fmtInt(operativo)} />
                <Metric label="Aulas base" value={fmtInt(comp.resultado?.aulas_base_total)} />
                <Metric label="Aulas + bolsa" value={fmtInt(comp.resultado?.aulas_total)} />
              </div>
              <label className="cmv2-target-input">
                <span>n final propuesto</span>
                <NumberCell value={draft} min={1} step={50} onChange={(v) => onDraftTarget(comp.id, v)} />
              </label>
              <div className="cmv2-inline-actions">
                <button
                  type="button"
                  className="cmv2-ghost"
                  onClick={() => rounded && onDraftTarget(comp.id, rounded)}
                  disabled={!rounded || calculando}
                >
                  Usar redondeo
                </button>
                <button
                  type="button"
                  className="cmv2-primary"
                  onClick={() => onApplyTarget(comp.id, draft)}
                  disabled={!draft || belowMinimum || calculando}
                >
                  Aplicar ajuste
                </button>
              </div>
              <div className="cmv2-calc-foot">
                {belowMinimum
                  ? "El n final no puede ser menor al mínimo calculado."
                  : comp.tecnica === "prob_estratificado_independiente"
                    ? "Cada facultad conserva su propio margen de error y p esperada."
                    : `Precisión estimada: ${fmtPct(precision)}`}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UniversityRevampResultadosPanel({
  componentes,
  workspace,
  onWorkspace,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  workspace: CalcMuestraWorkspace;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const scenarios = workspace.escenarios.length ? workspace.escenarios : ESCENARIOS_OPINION;
  function toggleReporte(componentId: string, incluir: boolean) {
    onWorkspace({
      ...workspace,
      escenarios: scenarios.map((e) => (e.component_id === componentId ? { ...e, incluir_reporte: incluir } : e)),
    });
  }
  return (
    <section className="cmv2-panel cmv2-university-results">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Resultados</span>
        <strong>Tablas de salida para reporte</strong>
      </div>
      <div className="cmv2-results-stack">
        {componentes.map((comp) => {
          const scenario = scenarios.find((e) => e.component_id === comp.id);
          const rows = universityDistributionRows(comp);
          const totals = rows.reduce(
            (acc, row) => ({
              N: acc.N + row.N,
              mujeres: acc.mujeres + row.mujeres,
              hombres: acc.hombres + row.hombres,
              n: acc.n + row.n,
            }),
            { N: 0, mujeres: 0, hombres: 0, n: 0 },
          );
          return (
            <article key={comp.id} className="cmv2-result-card">
              <div className="cmv2-result-head">
                <div>
                  <span className="cmv2-eyebrow">{proposalShortLabel(comp)}</span>
                  <h3>{comp.actor}</h3>
                </div>
                <label className="cmv2-report-check">
                  <input
                    type="checkbox"
                    checked={scenario?.incluir_reporte ?? false}
                    onChange={(e) => toggleReporte(comp.id, e.currentTarget.checked)}
                  />
                  Incluir en reporte
                </label>
              </div>
              {rows.length === 0 ? (
                <div className="cmv2-result-empty">Pendiente de cálculo</div>
              ) : (
                <div className="cmv2-table-wrap">
                  <table className="cmv2-table cmv2-table--university">
                    <thead>
                      <tr>
                        <th>Facultad</th>
                        <th>Marco</th>
                        <th>Error usado</th>
                        <th>p usada</th>
                        <th>Mujeres</th>
                        <th>Hombres</th>
                        <th>Cuota total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.facultad}>
                          <td><strong>{row.facultad}</strong></td>
                          <td>{fmtInt(row.N)}</td>
                          <td>{fmtPct(row.error)}</td>
                          <td>{fmtPct(row.p)}</td>
                          <td>{fmtInt(row.mujeres)}</td>
                          <td>{fmtInt(row.hombres)}</td>
                          <td><strong>{fmtInt(row.n)}</strong></td>
                        </tr>
                      ))}
                      <tr className="cmv2-total-row">
                        <td><strong>Total</strong></td>
                        <td>{fmtInt(totals.N)}</td>
                        <td>—</td>
                        <td>—</td>
                        <td>{fmtInt(totals.mujeres)}</td>
                        <td>{fmtInt(totals.hombres)}</td>
                        <td><strong>{fmtInt(totals.n)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function proposalShortLabel(comp: CalcMuestraComponente) {
  return comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID ? "Nivel facultad" : "Nivel universidad";
}

function universityDistributionRows(comp: CalcMuestraComponente) {
  const estratos = comp.marco.estratos ?? [];
  const subs = comp.resultado?.distribucion_sub ?? [];
  return (comp.resultado?.distribucion_estratos ?? []).map((row) => {
    const marcoRow = estratos.find((e) => e.label === row.estrato);
    const subA = subs.find((s) => s.estrato === row.estrato && s.sub === (marcoRow?.sub_a_label ?? "Mujeres")) ??
      subs.find((s) => s.estrato === row.estrato && s.sub.toLowerCase().includes("mujer"));
    const subB = subs.find((s) => s.estrato === row.estrato && s.sub === (marcoRow?.sub_b_label ?? "Hombres")) ??
      subs.find((s) => s.estrato === row.estrato && s.sub.toLowerCase().includes("hombre"));
    return {
      facultad: row.estrato,
      N: safeNumber(row.N),
      error: comp.tecnica === "prob_estratificado_independiente"
        ? safeNumber(marcoRow?.e_facultad, row.precision_e ?? comp.parametros.e)
        : comp.parametros.e,
      p: comp.tecnica === "prob_estratificado_independiente"
        ? safeNumber(row.p_e ?? marcoRow?.p_facultad, comp.parametros.p)
        : comp.parametros.p,
      mujeres: safeNumber(subA?.n),
      hombres: safeNumber(subB?.n),
      n: safeNumber(row.n),
    };
  });
}

function OpinionUniversitariaDesk({
  estudio,
  workspace,
  onTitulo,
  onContexto,
  onWorkspace,
  onComponente,
  onReplaceComponente,
  onCargarModelo,
  onCalcular,
  calculando,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onReplaceComponente: (comp: CalcMuestraComponente) => void;
  onCargarModelo: () => void;
  onCalcular: () => void;
  calculando: boolean;
}) {
  const comp = estudio.componentes[0] ?? defaultComponente({
    actor: "Estudiantes pregrado",
    actor_categoria: "estudiantes",
    canal_recojo: "aula_qr",
    tecnica: "prob_conglomerado_multietapico",
  });
  const escenarios = workspace.escenarios.length ? workspace.escenarios : ESCENARIOS_OPINION;
  const escenarioActivo = escenarios.find((e) => e.activo) ?? escenarios[0];

  function aplicarEscenario(escenario: CalcMuestraWorkspaceEscenario) {
    const objetivo = scenarioTarget(escenario);
    onWorkspace({
      ...workspace,
      escenarios: escenarios.map((e) => ({ ...e, activo: e.id === escenario.id })),
    });
    onReplaceComponente({
      ...setTecnica(comp, escenario.tecnica),
      parametros: { ...comp.parametros, ...escenario.parametros },
      meta: {
        ...comp.meta,
        tipo: "objetivo",
        valor: objetivo || comp.meta.valor,
        variable_control: "facultad_sexo",
      },
      resultado: null,
    });
  }

  return (
    <div className="cmv2-desk">
      <ShellHeader
        eyebrow="Encuesta a estudiantes"
        title="Estudiantes universitarios"
        copy="Mesa por facultades y sexo; calcula tamaño muestral y distribución de cuotas."
        icon={Grid3X3}
      >
        <button type="button" className="cmv2-ghost" onClick={onCargarModelo}>
          <Wand2 size={14} /> Cargar ejemplo
        </button>
        <button type="button" className="cmv2-primary" onClick={() => void onCalcular()} disabled={calculando}>
          {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
          Calcular muestra
        </button>
      </ShellHeader>
      <div className="cmv2-desk-grid">
        <div className="cmv2-stack">
          <ResultadoPanel componentes={[comp]} showNested={false} />
          <UniversitarioCalculoPanel comp={comp} escenario={escenarioActivo} onComponente={onComponente} />
          <UniversitarioDistribucionPanel comp={comp} />
          <ScenarioStrip escenarios={escenarios} onApply={aplicarEscenario} />
          <EstratosTable comp={comp} onComponente={onComponente} variant="facultades" />
        </div>
        <aside className="cmv2-side">
          <StudyBasics
            estudio={estudio}
            workspace={workspace}
            onTitulo={onTitulo}
            onContexto={onContexto}
            onWorkspace={onWorkspace}
            mode="universitario"
          />
          <UniversitarioMarcoPanel comp={comp} />
          <ParametrosPanel comp={comp} onComponente={onComponente} mode="universitario" />
        </aside>
      </div>
    </div>
  );
}

function UniversitarioMarcoPanel({ comp }: { comp: CalcMuestraComponente }) {
  const facultades = comp.marco.estratos ?? [];
  const totalMujeres = facultades.reduce((sum, e) => sum + safeNumber(e.N_a), 0);
  const totalHombres = facultades.reduce((sum, e) => sum + safeNumber(e.N_b), 0);
  return (
    <section className="cmv2-panel cmv2-university-summary">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Marco operativo</span>
        <strong>Facultades y sexo</strong>
      </div>
      <div className="cmv2-university-metrics">
        <Metric label="Estudiantes" value={fmtInt(comp.marco.marco_validado)} />
        <Metric label="Facultades" value={facultades.length} />
        <Metric label="Mujeres" value={fmtInt(totalMujeres)} />
        <Metric label="Hombres" value={fmtInt(totalHombres)} />
      </div>
      <div className="cmv2-university-chips">
        <span>Observación: estudiante</span>
        <span>Marco: matrícula</span>
        <span>Distribución: facultad x sexo</span>
      </div>
    </section>
  );
}

function UniversitarioCalculoPanel({
  comp,
  escenario,
  onComponente,
}: {
  comp: CalcMuestraComponente;
  escenario: CalcMuestraWorkspaceEscenario;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const N = safeNumber(comp.marco.marco_validado);
  const p = comp.parametros;
  const nFormula = comp.resultado?.n_teorico ?? calcNFormulaPreview(N, p.p, p.z, p.e, p.deff);
  const targetEscenario = scenarioTarget(escenario);
  const metaValor = safeNumber(comp.meta.valor);
  const nFinal = metaValor > 0 ? Math.round(metaValor) : targetEscenario;
  const precision = comp.resultado?.precision_alcanzada ?? calcEPreview(nFinal, N, p.p, p.z, p.deff);
  const ajuste = nFormula && nFinal ? nFinal - nFormula : null;
  const sobremuestra = nFinal > 0 ? Math.ceil(nFinal * safeNumber(p.oversample_pct)) : null;
  const operativo = sobremuestra == null ? null : nFinal + sobremuestra;
  const cuotasAsignadas = comp.resultado?.distribucion_estratos?.reduce((sum, row) => sum + safeNumber(row.n), 0) ?? null;
  const residuoTabla = cuotasAsignadas == null || !comp.resultado ? null : nFinal - cuotasAsignadas;

  function setNFinal(value: number) {
    onComponente(comp.id, {
      meta: {
        tipo: "objetivo",
        valor: Math.max(0, Math.round(value)),
        variable_control: "facultad_sexo",
      },
    });
  }

  return (
    <section className="cmv2-panel cmv2-formula-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Cálculo</span>
        <strong>Fórmula, n final y ajuste</strong>
      </div>
      <div className="cmv2-formula-layout">
        <div className="cmv2-formula-box">
          <span>Fórmula base</span>
          <LatexMath
            display
            expression={String.raw`n=\frac{N \cdot Z^2 \cdot p(1-p) \cdot DEFF}{(N-1)e^2 + Z^2 \cdot p(1-p) \cdot DEFF}`}
          />
          <p>
            N={fmtInt(N)} · Z={p.z} · p={p.p} · e={p.e} · deff={p.deff}
          </p>
        </div>
        <div className="cmv2-target-box">
          <label className="cmv2-target-input">
            <span>n final propuesto</span>
            <NumberCell value={nFinal} min={1} step={50} onChange={setNFinal} />
          </label>
          <div className="cmv2-inline-actions">
            <button type="button" className="cmv2-ghost" onClick={() => nFormula && setNFinal(nFormula)} disabled={!nFormula}>
              Usar fórmula
            </button>
            <button
              type="button"
              className="cmv2-ghost"
              onClick={() => nFormula && setNFinal(Math.ceil(nFormula / 100) * 100)}
              disabled={!nFormula}
            >
              Redondear a 100
            </button>
            <button type="button" className="cmv2-ghost" onClick={() => setNFinal(targetEscenario)} disabled={!targetEscenario}>
              Aplicar propuesta
            </button>
          </div>
        </div>
      </div>
      <div className="cmv2-formula-metrics">
        <Metric label="n fórmula" value={fmtInt(nFormula)} />
        <Metric label="Ajuste operativo" value={fmtSignedInt(ajuste)} />
        <Metric label="Precisión real" value={fmtPct(precision)} />
        <Metric label="Con sobremuestra" value={fmtInt(operativo)} />
      </div>
      <div className="cmv2-rounding-note">
        <strong>Distribución:</strong> el n final se reparte proporcionalmente por facultad y luego por sexo. La cuadratura cierra la suma exacta; el residuo actual de la tabla es {fmtSignedInt(residuoTabla)}.
      </div>
    </section>
  );
}

function UniversitarioDistribucionPanel({ comp }: { comp: CalcMuestraComponente }) {
  const r = comp.resultado;
  if (!r?.distribucion_estratos?.length) return null;
  const sub = r.distribucion_sub ?? [];
  const rows = r.distribucion_estratos.map((row) => {
    const mujeres = sub.find((s) => s.estrato === row.estrato && s.sub.toLowerCase().includes("mujer"));
    const hombres = sub.find((s) => s.estrato === row.estrato && s.sub.toLowerCase().includes("hombre"));
    return { row, mujeres, hombres };
  });
  const totals = rows.reduce(
    (acc, item) => ({
      N: acc.N + safeNumber(item.row.N),
      mujeres: acc.mujeres + safeNumber(item.mujeres?.n),
      hombres: acc.hombres + safeNumber(item.hombres?.n),
      n: acc.n + safeNumber(item.row.n),
    }),
    { N: 0, mujeres: 0, hombres: 0, n: 0 },
  );
  return (
    <section className="cmv2-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Salida por facultad</span>
        <strong>Distribución de la muestra</strong>
      </div>
      <div className="cmv2-table-wrap">
        <table className="cmv2-table cmv2-table--university">
          <thead>
            <tr>
              <th>Facultad</th>
              <th>Marco</th>
              <th>Mujeres</th>
              <th>Hombres</th>
              <th>Cuota total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, mujeres, hombres }) => (
              <tr key={row.estrato}>
                <td><strong>{row.estrato}</strong></td>
                <td>{fmtInt(row.N)}</td>
                <td>{fmtInt(mujeres?.n)}</td>
                <td>{fmtInt(hombres?.n)}</td>
                <td><strong>{fmtInt(row.n)}</strong></td>
              </tr>
            ))}
            <tr className="cmv2-total-row">
              <td><strong>Total</strong></td>
              <td>{fmtInt(totals.N)}</td>
              <td>{fmtInt(totals.mujeres)}</td>
              <td>{fmtInt(totals.hombres)}</td>
              <td><strong>{fmtInt(totals.n)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScenarioStrip({
  escenarios,
  onApply,
}: {
  escenarios: CalcMuestraWorkspaceEscenario[];
  onApply: (escenario: CalcMuestraWorkspaceEscenario) => void;
}) {
  return (
    <section className="cmv2-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Propuestas</span>
        <strong>Dos propuestas comparables</strong>
      </div>
      <div className="cmv2-scenario-grid">
        {escenarios.map((escenario) => (
          <button
            type="button"
            key={escenario.id}
            className={`cmv2-scenario ${escenario.activo ? "is-active" : ""}`}
            onClick={() => onApply(escenario)}
          >
            <span>{escenario.activo ? <CheckCircle2 size={14} /> : <Target size={14} />}{productoLabel(escenario.producto)}</span>
            <strong>{escenario.label}</strong>
            <p>{escenario.descripcion}</p>
            <small>
              n={fmtInt(scenarioTarget(escenario))} · e={fmtPct(escenario.parametros.e)} · deff={escenario.parametros.deff ?? 1} · sobre={fmtPct(escenario.parametros.oversample_pct)}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}

function MarcoDisponibleDesk({
  estudio,
  workspace,
  activeSection,
  onTitulo,
  onContexto,
  onPatchEstudio,
  onWorkspace,
  onComponente,
  onReplaceComponente,
  onEnsureKind,
  onCalcular,
  onMonitoreo,
  calculando,
  reporteListo,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  activeSection: string;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onPatchEstudio: (patch: Partial<CalcMuestraEstudio>) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onReplaceComponente: (comp: CalcMuestraComponente) => void;
  onEnsureKind: (kind: MarcoOcasional) => void;
  onCalcular: () => void;
  onMonitoreo: () => void;
  calculando: boolean;
  reporteListo: boolean;
}) {
  const comp = estudio.componentes[0] ?? defaultComponente();
  const matrizMode = (comp.marco.matriz_operativa?.length ?? 0) > 0;
  const estratosMode = (comp.marco.estratos?.length ?? 0) > 0 && !matrizMode;
  const selectedSection = ["marco", "metodo", "resultados"].includes(activeSection)
    ? activeSection
    : "marco";

  return (
    <div className="cmv2-desk">
      <ShellHeader
        eyebrow="Cálculo de muestra general"
        title="Marco propio"
        copy="Define unidad, variables de control y forma del marco. Luego eliges el cálculo y ajustas parámetros."
        icon={SlidersHorizontal}
      >
        <button type="button" className="cmv2-primary" onClick={() => void onCalcular()} disabled={calculando}>
          {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
          Calcular mesa
        </button>
      </ShellHeader>
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection === "marco" && (
          <div id="cmv2-section-general-marco" className="cmv2-tab-panel" role="tabpanel" aria-label="Marco">
            <div className="cmv2-desk-grid">
              <div className="cmv2-stack">
          <MarcoShapeSelector selected={workspace.marco_disponible} onSelect={onEnsureKind} />
                <VariablesControl workspace={workspace} onWorkspace={onWorkspace} />
              </div>
              <aside className="cmv2-side">
                <StudyBasics estudio={estudio} workspace={workspace} onTitulo={onTitulo} onContexto={onContexto} onWorkspace={onWorkspace} />
              </aside>
            </div>
          </div>
        )}

        {selectedSection === "metodo" && (
          <div id="cmv2-section-general-metodo" className="cmv2-tab-panel" role="tabpanel" aria-label="Método">
          <section className="cmv2-panel">
            <div className="cmv2-panel-head">
              <span className="cmv2-eyebrow">Cálculo</span>
              <strong>Tipo de cálculo y parámetros</strong>
            </div>
            <MetodoSelector comp={comp} onReplace={onReplaceComponente} />
            <ParametrosPanel comp={comp} onComponente={onComponente} />
          </section>
          {matrizMode && <MatrizServiciosTable comp={comp} onComponente={onComponente} />}
          {estratosMode && <EstratosTable comp={comp} onComponente={onComponente} />}
        </div>
        )}

        {selectedSection === "resultados" && (
          <div id="cmv2-section-general-resultados" className="cmv2-tab-panel" role="tabpanel" aria-label="Resultados">
          <ResultadoPanel componentes={estudio.componentes} />
          <section className="cmv2-panel">
            <div className="cmv2-panel-head">
              <span className="cmv2-eyebrow">Salida</span>
              <strong>Propuesta y traspaso</strong>
            </div>
            <textarea
              value={workspace.notas_diseno}
              onChange={(e) => onWorkspace({ ...workspace, notas_diseno: e.currentTarget.value })}
              rows={5}
            />
            <div className="cmv2-inline-actions">
              <button type="button" className="cmv2-ghost" onClick={() => onPatchEstudio({ modo_trabajo: "diseno_validado" })}>
                <CheckCircle2 size={14} /> Marcar propuesta cerrada
              </button>
              <button type="button" className="cmv2-ghost" onClick={onMonitoreo} disabled={!reporteListo && estudio.componentes.every((c) => !c.resultado)}>
                <Route size={14} /> Enviar a Monitoreo
              </button>
            </div>
          </section>
          </div>
        )}
      </div>
    </div>
  );
}

function MarcoShapeSelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (kind: MarcoOcasional) => void;
}) {
  const shapes: Array<{ id: MarcoOcasional; label: string; copy: string; icon: typeof Table2 }> = [
    { id: "marco_total", label: "Marco total", copy: "Tengo un N enumerable de la población objetivo.", icon: Database },
    { id: "estratos", label: "Capas / variables de control", copy: "Tengo N por estrato, actor, sexo, edad, distrito u otra capa.", icon: Layers3 },
    { id: "conglomerados", label: "Conglomerados", copy: "Seleccionaré aulas, sedes, servicios, instituciones u otras unidades agrupadas.", icon: Grid3X3 },
    { id: "servicios", label: "Atenciones por servicio y municipalidad", copy: "Patrón GIZ: volumen por celda, n por territorio y cuotas proporcionales.", icon: Table2 },
    { id: "cuotas_controladas", label: "Control no probabilístico", copy: "No hay selección probabilística final, pero sí variables de control.", icon: Target },
    { id: "cobertura", label: "Cobertura de marco", copy: "Quiero saber cuánto del marco corresponde cubrir o contactar.", icon: BarChart3 },
  ];
  return (
    <section className="cmv2-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Forma del marco</span>
        <strong>Qué elementos contiene</strong>
      </div>
      <div className="cmv2-shape-grid">
        {shapes.map((shape) => {
          const Icon = shape.icon;
          const active = selected === labelMarcoOcasional(shape.id);
          return (
            <button key={shape.id} type="button" className={`cmv2-shape ${active ? "is-active" : ""}`} onClick={() => onSelect(shape.id)}>
              <Icon size={16} />
              <strong>{shape.label}</strong>
              <span>{shape.copy}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MetodoSelector({
  comp,
  onReplace,
}: {
  comp: CalcMuestraComponente;
  onReplace: (comp: CalcMuestraComponente) => void;
}) {
  return (
    <div className="cmv2-method-grid">
      {METODOS_CLASICOS.map((metodo) => (
        <button
          key={metodo.id}
          type="button"
          className={`cmv2-method ${comp.tecnica === metodo.id ? "is-active" : ""}`}
          onClick={() => onReplace(setTecnica(comp, metodo.id))}
        >
          <span><Settings2 size={14} /> {productoLabel(metodo.producto)}</span>
          <strong>{metodo.label}</strong>
          <small>{metodo.marco}</small>
        </button>
      ))}
    </div>
  );
}

function ParametrosPanel({
  comp,
  onComponente,
  mode = "general",
}: {
  comp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
  mode?: "general" | "universitario";
}) {
  const p = comp.parametros;
  const universitario = mode === "universitario";
  return (
    <section className={universitario ? "cmv2-panel cmv2-param-panel" : "cmv2-param-panel"}>
      {universitario && (
        <div className="cmv2-panel-head">
          <span className="cmv2-eyebrow">Parámetros</span>
          <strong>Cálculo de muestra</strong>
        </div>
      )}
      <div className="cmv2-param-grid">
        <Param label="Confianza z" value={p.z} step={0.01} onChange={(v) => onComponente(comp.id, { parametros: { z: v } })} />
        <Param label="p esperada" value={p.p} step={0.01} onChange={(v) => onComponente(comp.id, { parametros: { p: v } })} />
        <Param label="Error" value={p.e} step={0.005} suffix="prop." onChange={(v) => onComponente(comp.id, { parametros: { e: v } })} />
        <Param label="Deff" value={p.deff} step={0.1} onChange={(v) => onComponente(comp.id, { parametros: { deff: v } })} />
        <Param label="Sobremuestra" value={p.oversample_pct} step={0.05} suffix="prop." onChange={(v) => onComponente(comp.id, { parametros: { oversample_pct: v } })} />
        {universitario ? (
          null
        ) : (
          <>
            <Param label="Respuesta" value={p.tasa_respuesta} step={0.05} suffix="prop." onChange={(v) => onComponente(comp.id, { parametros: { tasa_respuesta: v } })} />
            <Param label="Cobertura" value={p.cobertura_objetivo} step={0.05} suffix="prop." onChange={(v) => onComponente(comp.id, { parametros: { cobertura_objetivo: v } })} />
            <Param label="Piso por celda" value={p.n_minimo_estrato} step={1} onChange={(v) => onComponente(comp.id, { parametros: { n_minimo_estrato: Math.round(v) } })} />
          </>
        )}
      </div>
    </section>
  );
}

function Param({
  label,
  value,
  onChange,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="cmv2-param">
      <span>{label}</span>
      <NumberCell value={value} onChange={onChange} step={step} suffix={suffix} />
    </label>
  );
}

function ResultadoPanel({
  componentes,
  showNested = true,
}: {
  componentes: CalcMuestraComponente[];
  showNested?: boolean;
}) {
  const hasRows = componentes.length > 0;
  const productos = Array.from(new Set(componentes.map(tecnicaProducto)));
  return (
    <section className="cmv2-panel cmv2-output">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Tabla de salida</span>
        <strong>{productos.length > 1 ? "Componentes mixtos calculables" : productoLabel(productos[0] ?? "muestra_probabilistica")}</strong>
      </div>
      {!hasRows ? (
        <div className="cmv2-empty">Elige un marco para construir la primera matriz.</div>
      ) : (
        <div className="cmv2-table-wrap">
          <table className="cmv2-table">
            <thead>
              <tr>
                <th>Componente</th>
                <th>Producto</th>
                <th>Marco</th>
                <th>n objetivo</th>
              <th>Operativo</th>
              <th>Precisión</th>
                <th>Ajuste</th>
              </tr>
            </thead>
            <tbody>
              {componentes.map((comp) => {
                const r = comp.resultado;
                return (
                  <tr key={comp.id}>
                    <td>
                      <strong>{comp.actor}</strong>
                      <small>{tecnicaLabel(comp.tecnica)}</small>
                    </td>
                    <td><ProductBadge producto={tecnicaProducto(comp)} /></td>
                    <td>{fmtInt(comp.marco.marco_validado)}</td>
                    <td>{fmtInt(r?.n_objetivo)}</td>
                    <td>{fmtInt(r?.n_operativo)}</td>
                    <td>{r?.precision_alcanzada ? fmtPct(r.precision_alcanzada) : r?.cobertura_objetivo ? fmtPct(r.cobertura_objetivo) : "—"}</td>
                    <td className="cmv2-note-cell">{criterioSalida(comp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {showNested && <NestedOutputs componentes={componentes} />}
    </section>
  );
}

function ProductBadge({ producto }: { producto: CalcMuestraWorkspaceProducto }) {
  return <span className={`cmv2-product cmv2-product--${producto}`}>{productoLabel(producto)}</span>;
}

function NestedOutputs({ componentes }: { componentes: CalcMuestraComponente[] }) {
  const rows = componentes.flatMap((comp) => (comp.resultado?.cuotas_matriz ?? []).map((row) => ({ comp, row })));
  const estratos = componentes.flatMap((comp) => (comp.resultado?.distribucion_estratos ?? []).map((row) => ({ comp, row })));
  if (rows.length === 0 && estratos.length === 0) return null;
  const estratosTitle = estratos.some(({ comp }) => comp.actor_categoria === "estudiantes" && comp.canal_recojo === "aula_qr")
    ? "Distribución por facultad"
    : "Distribución por estrato";
  return (
    <div className="cmv2-nested-output">
      {estratos.length > 0 && (
        <div>
          <h4>{estratosTitle}</h4>
          <div className="cmv2-mini-table">
            {estratos.map(({ comp, row }, i) => (
              <span key={`${comp.id}-estrato-${i}`}>
                <strong>{row.estrato}</strong>
                <em>N {fmtInt(row.N)} · n {fmtInt(row.n)}</em>
              </span>
            ))}
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <div>
          <h4>Matriz de cuotas</h4>
          <div className="cmv2-mini-table">
            {rows.map(({ comp, row }, i) => (
              <span key={`${comp.id}-cuota-${i}`}>
                <strong>{row.territorio} · {row.servicio}</strong>
                <em>N {fmtInt(row.N)} · n {fmtInt(row.n)}</em>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EstratosTable({
  comp,
  onComponente,
  variant = "estratos",
}: {
  comp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
  variant?: "estratos" | "facultades";
}) {
  const estratos = comp.marco.estratos ?? [];
  const facultades = variant === "facultades";
  const title = facultades ? "Facultades del marco" : "Estratos del marco";
  const primaryLabel = facultades ? "Facultad" : "Estrato";
  const subALabel = facultades ? "Mujeres" : "Sub A";
  const subBLabel = facultades ? "Hombres" : "Sub B";
  const avgLabel = "Promedio unidad";
  const tauLabel = "Rendimiento";
  const addLabel = facultades ? "Agregar facultad" : "Agregar estrato";
  function update(index: number, patch: Partial<CalcMuestraEstrato>) {
    const next = estratos.map((e, i) => (i === index ? { ...e, ...patch } : e));
    const total = next.reduce((sum, e) => sum + safeNumber(e.N), 0);
    onComponente(comp.id, { marco: { estratos: next, marco_validado: total, universo_bruto: total, marco_contactable: total } });
  }
  return (
    <section className="cmv2-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Tabla editable</span>
        <strong>{title}</strong>
      </div>
      <div className="cmv2-table-wrap">
        <table className="cmv2-table">
          <thead>
            <tr>
              <th>{primaryLabel}</th>
              <th>Total</th>
              <th>{subALabel}</th>
              <th>{subBLabel}</th>
              {facultades && <th>Error facultad</th>}
              {facultades && <th>Confianza</th>}
              {facultades && <th>p éxito</th>}
              {facultades && <th>+ aulas</th>}
              {!facultades && <th>{avgLabel}</th>}
              {!facultades && <th>{tauLabel}</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {estratos.map((e, i) => (
              <tr key={e.id}>
                <td><input className="cmv2-table-input" value={e.label} onChange={(ev) => update(i, { label: ev.currentTarget.value })} /></td>
                <td><NumberCell value={e.N} onChange={(v) => {
                  const N = Math.round(v);
                  update(i, facultades ? { N, e_facultad: universityFacultyError(N), confianza_facultad: universityFacultyConfidence(N) } : { N });
                }} /></td>
                <td><NumberCell value={e.N_a} onChange={(v) => update(i, { N_a: Math.round(v) })} /></td>
                <td><NumberCell value={e.N_b} onChange={(v) => update(i, { N_b: Math.round(v) })} /></td>
                {facultades && <td><NumberCell value={e.e_facultad} step={0.005} suffix="prop." onChange={(v) => update(i, { e_facultad: v })} /></td>}
                {facultades && <td><NumberCell value={e.confianza_facultad} step={0.01} suffix="prop." onChange={(v) => update(i, { confianza_facultad: v, z_facultad: undefined })} /></td>}
                {facultades && <td><NumberCell value={e.p_facultad} step={0.01} suffix="prop." onChange={(v) => update(i, { p_facultad: v })} /></td>}
                {facultades && <td><NumberCell value={e.aulas_extra_operativas} step={1} onChange={(v) => update(i, { aulas_extra_operativas: Math.max(0, Math.round(v)) })} /></td>}
                {!facultades && <td><NumberCell value={e.promedio_conglomerado} onChange={(v) => update(i, { promedio_conglomerado: v })} /></td>}
                {!facultades && <td><NumberCell value={e.tau} step={0.05} onChange={(v) => update(i, { tau: v })} /></td>}
                <td>
                  <button
                    type="button"
                    className="cmv2-icon-button"
                    onClick={() => {
                      const next = estratos.filter((_, idx) => idx !== i);
                      const total = next.reduce((sum, item) => sum + safeNumber(item.N), 0);
                      onComponente(comp.id, { marco: { estratos: next, marco_validado: total, universo_bruto: total, marco_contactable: total } });
                    }}
                    aria-label={facultades ? "Eliminar facultad" : "Eliminar estrato"}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cmv2-inline-actions">
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => {
            const next = [
              ...estratos,
              estrato(facultades ? `Facultad ${estratos.length + 1}` : `Estrato ${estratos.length + 1}`, 0, {
                sub_a_label: facultades ? "Mujeres" : "Sub A",
                sub_b_label: facultades ? "Hombres" : "Sub B",
                e_facultad: facultades ? universityFacultyError(0) : undefined,
                confianza_facultad: facultades ? universityFacultyConfidence(0) : undefined,
                p_facultad: facultades ? 0.5 : undefined,
                aulas_extra_operativas: facultades ? 1 : undefined,
              }),
            ];
            onComponente(comp.id, { marco: { estratos: next } });
          }}
        >
          <Plus size={14} /> {addLabel}
        </button>
      </div>
    </section>
  );
}

function MatrizServiciosTable({
  comp,
  onComponente,
}: {
  comp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const matriz = comp.marco.matriz_operativa ?? [];
  function update(index: number, patch: Partial<CalcMuestraMatrizOperativaCelda>) {
    const next = matriz.map((m, i) => (i === index ? { ...m, ...patch } : m));
    const total = next.reduce((sum, item) => sum + safeNumber(item.N), 0);
    onComponente(comp.id, { marco: { matriz_operativa: next, marco_validado: total, universo_bruto: total, marco_contactable: total } });
  }
  return (
    <section className="cmv2-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Tabla editable</span>
        <strong>Atenciones por servicio y municipalidad</strong>
      </div>
      <div className="cmv2-table-wrap">
        <table className="cmv2-table">
          <thead>
            <tr>
              <th>Municipalidad / territorio</th>
              <th>Servicio</th>
              <th>Volumen del marco</th>
              <th>Notas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {matriz.map((row, i) => (
              <tr key={row.id}>
                <td><input className="cmv2-table-input" value={row.territorio} onChange={(e) => update(i, { territorio: e.currentTarget.value })} /></td>
                <td><input className="cmv2-table-input" value={row.servicio} onChange={(e) => update(i, { servicio: e.currentTarget.value })} /></td>
                <td><NumberCell value={row.N} onChange={(v) => update(i, { N: Math.round(v) })} /></td>
                <td><input className="cmv2-table-input" value={row.notas} onChange={(e) => update(i, { notas: e.currentTarget.value })} /></td>
                <td>
                  <button
                    type="button"
                    className="cmv2-icon-button"
                    onClick={() => {
                      const next = matriz.filter((_, idx) => idx !== i);
                      const total = next.reduce((sum, item) => sum + safeNumber(item.N), 0);
                      onComponente(comp.id, { marco: { matriz_operativa: next, marco_validado: total, universo_bruto: total, marco_contactable: total } });
                    }}
                    aria-label="Eliminar fila"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cmv2-inline-actions">
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => onComponente(comp.id, { marco: { matriz_operativa: [...matriz, matrizCell()] } })}
        >
          <Plus size={14} /> Agregar celda
        </button>
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => {
            const next = matrizGizEjemplo();
            const total = next.reduce((sum, item) => sum + item.N, 0);
            onComponente(comp.id, { marco: { matriz_operativa: next, marco_validado: total, universo_bruto: total, marco_contactable: total } });
          }}
        >
          <Wand2 size={14} /> Cargar ejemplo GIZ
        </button>
      </div>
    </section>
  );
}

function VariablesControl({
  workspace,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const variables = workspace.variables_control;
  function update(index: number, patch: Partial<CalcMuestraWorkspaceVariableControl>) {
    onWorkspace({
      ...workspace,
      variables_control: variables.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    });
  }
  return (
    <section className="cmv2-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Control</span>
        <strong>Variables disponibles</strong>
      </div>
      <div className="cmv2-variable-list">
        {variables.map((v, i) => (
          <div className="cmv2-variable" key={v.id}>
            <input value={v.label} onChange={(e) => update(i, { label: e.currentTarget.value })} />
            <select value={v.tipo} onChange={(e) => update(i, { tipo: e.currentTarget.value as CalcMuestraWorkspaceVariableControl["tipo"] })}>
              <option value="estrato">Estrato</option>
              <option value="cuota">Cuota</option>
              <option value="filtro">Filtro</option>
              <option value="segmento">Segmento</option>
              <option value="otro">Otro</option>
            </select>
            <label className="cmv2-check">
              <input type="checkbox" checked={v.disponible} onChange={(e) => update(i, { disponible: e.currentTarget.checked })} />
              Disponible
            </label>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="cmv2-ghost"
        onClick={() => onWorkspace({ ...workspace, variables_control: [...variables, variableControl(uid("var"), "Nueva variable", "estrato")] })}
      >
        <Plus size={14} /> Agregar variable
      </button>
    </section>
  );
}

function TerritorialHandoff({ onOpen, onBack }: { onOpen: () => void; onBack: () => void }) {
  return (
    <section className="cmv2-handoff">
      <div className="cmv2-handoff-icon"><MapPinned size={26} /></div>
      <span className="cmv2-eyebrow">Territorial / hogares</span>
      <h2>Este marco se diseña mejor en Hojas de Ruta</h2>
      <p>
        Si el estudio depende de territorio, zonas, manzanas, viviendas o rutas de campo, el cálculo necesita cartografía, selección de zonas, reemplazos y salida operativa. Esa mesa ya existe en Hojas de Ruta.
      </p>
      <div className="cmv2-inline-actions">
        <button type="button" className="cmv2-primary" onClick={onOpen}>
          <Home size={14} /> Abrir Hojas de Ruta
        </button>
        <button type="button" className="cmv2-ghost" onClick={onBack}>
          Volver a marcos
        </button>
      </div>
    </section>
  );
}

function LegacyDesk({ onNew, onClear }: { onNew: () => void; onClear: () => void }) {
  return (
    <section className="cmv2-handoff">
      <div className="cmv2-handoff-icon"><FileText size={26} /></div>
      <span className="cmv2-eyebrow">Sesión antigua</span>
      <h2>Este flujo queda solo como compatibilidad</h2>
      <div className="cmv2-inline-actions">
        <button type="button" className="cmv2-primary" onClick={onNew}>
          <SlidersHorizontal size={14} /> Diseñar desde marco
        </button>
        <button type="button" className="cmv2-ghost" onClick={onClear}>
          Reiniciar selección
        </button>
      </div>
    </section>
  );
}

function estrato(
  label: string,
  N: number,
  overrides: Partial<CalcMuestraEstrato> = {},
): CalcMuestraEstrato {
  const a = Math.floor(N / 2);
  return {
    id: uid("est"),
    label,
    N,
    N_a: a,
    N_b: N - a,
    sub_a_label: overrides.sub_a_label ?? "Sub A",
    sub_b_label: overrides.sub_b_label ?? "Sub B",
    e_facultad: overrides.e_facultad,
    p_facultad: overrides.p_facultad,
    confianza_facultad: overrides.confianza_facultad,
    z_facultad: overrides.z_facultad,
    cuota_fija: overrides.cuota_fija,
    sobremuestra_fija: overrides.sobremuestra_fija,
    aulas_base_fijas: overrides.aulas_base_fijas,
    aulas_extra_operativas: overrides.aulas_extra_operativas,
    promedio_conglomerado: overrides.promedio_conglomerado ?? 25,
    tau: overrides.tau ?? 0.7,
  };
}

function matrizCell(): CalcMuestraMatrizOperativaCelda {
  return {
    id: uid("cell"),
    territorio: "Territorio",
    servicio: "Servicio",
    N: 0,
    notas: "",
  };
}

function matrizGizEjemplo(): CalcMuestraMatrizOperativaCelda[] {
  return [
    ["Villa El Salvador", "ULE", 280],
    ["Villa El Salvador", "CIAM", 210],
    ["Villa El Salvador", "OMAPED", 110],
    ["Villa El Salvador", "DEMUNA", 213],
    ["San Juan de Lurigancho", "ULE", 90],
    ["San Juan de Lurigancho", "CIAM", 460],
    ["San Juan de Lurigancho", "OMAPED", 230],
    ["San Juan de Lurigancho", "DEMUNA", 131],
    ["Ate", "ULE", 165],
    ["Ate", "CIAM", 135],
    ["Ate", "OMAPED", 145],
    ["Ate", "DEMUNA", 271],
  ].map(([territorio, servicio, N]) => ({
    id: uid("cell"),
    territorio: String(territorio),
    servicio: String(servicio),
    N: Number(N),
    notas: "",
  }));
}

function labelMarcoOcasional(kind: MarcoOcasional) {
  const labels: Record<MarcoOcasional, string> = {
    marco_total: "Marco total enumerable",
    estratos: "Marco por capas o variables de control",
    conglomerados: "Marco con unidades agrupadas",
    servicios: "Atenciones por servicio y municipalidad",
    cuotas_controladas: "Control no probabilístico con variables disponibles",
    cobertura: "Marco a cubrir o contactar",
  };
  return labels[kind];
}
