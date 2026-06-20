import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Gauge,
  Grid3X3,
  Home,
  Layers3,
  Loader2,
  MapPinned,
  Plus,
  RefreshCw,
  Route,
  Settings2,
  SlidersHorizontal,
  Table2,
  Target,
  Trash2,
  Users,
  Wand2,
} from "lucide-react";
import { PageFrame } from "../../components/PageFrame";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
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
  apiCalcMuestraReporteIniciar,
  apiCalcMuestraState,
  apiMonitoreoImportFromCalcMuestra,
  calcMuestraReporteDescargarUrl,
  type CalcMuestraCanalRecojo,
  type CalcMuestraAulasMethodComparison,
  type CalcMuestraAulasMethodSummary,
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
  type CalcMuestraTecnica,
  type CalcMuestraWorkspace,
  type CalcMuestraWorkspaceAulasConfig,
  type CalcMuestraWorkspaceAulasModalidad,
  type CalcMuestraWorkspaceAulasSelector,
  type CalcMuestraWorkspaceEscenario,
  type CalcMuestraWorkspaceFrameMode,
  type CalcMuestraWorkspaceProducto,
  type CalcMuestraWorkspaceVariableControl,
} from "../../api/client";
import "./calcMuestra.css";

type Msg = { kind: "info" | "warn" | "error"; text: string } | null;
type ActiveDesk = CalcMuestraWorkspaceFrameMode;
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
  detail: string;
  icon: typeof Database;
  targetId?: string;
  route?: "hojas-ruta";
};

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
  usar_grupos_tamano: true,
  grupos_tamano: UNIVERSITY_AULAS_SIZE_GROUPS,
  estratos_selector: ["faculty", "sex_top_1", "size_group"],
  balance_vars: ["faculty", "sex_top_1", "size_group", "program", "level"],
  spread_vars: ["program", "level", "schedule", "size_group"],
  candidate_pool_size: 500,
  simulation_runs: 500,
  mos_strategy: "eligible_yield_winsorized",
  coordination_mode: "permanent_random_number",
  bolsas_reemplazo: 11,
  aulas_extra_operativas_default: 1,
  penalizacion_repetidos: 1.35,
  pps_weight: 0.25,
  coverage_weight: 1,
  monte_carlo_n: 500,
  semilla: 20260619,
  objective: DEFAULT_UNIVERSITY_AULAS_OBJECTIVE,
  notas_metodologicas:
    "Selector reproducible sobre marco colapsado por curso-horario: balancea cuotas, tamano de aula y cobertura unica, controla estudiantes repetidos y conserva auditoria interna del proceso.",
};

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
    detail: "Elige entre muestras candidatas para reducir solape; exige simulación para probabilidades finales.",
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
  icon: typeof Database;
}> = [
  {
    id: "opinion_universitaria",
    title: "Encuesta a estudiantes",
    eyebrow: "Universidad / aulas",
    copy: "Diseña muestra de estudiantes desde una base institucional, dos bases equivalentes o un marco de curso-horario.",
    action: "Configurar estudio",
    details: ["Base madre", "Cuotas", "Aulas", "Monitoreo"],
    sourceRoles: [
      { label: "Marco", detail: "estudiante x curso-horario" },
      { label: "Cálculo", detail: "universidad, facultad y cuotas" },
      { label: "Selección", detail: "aulas titulares y reservas" },
      { label: "Campo", detail: "agenda, QR y reemplazos" },
    ],
    icon: Grid3X3,
  },
  {
    id: "marco_disponible",
    title: "Cálculo de muestra general",
    eyebrow: "Marco propio",
    copy: "Para estudios con universo total, estratos, conglomerados, servicios, cuotas o coberturas operativas.",
    action: "Diseñar muestra",
    details: ["Marco total", "Estratos", "Conglomerados", "Cuotas"],
    sourceRoles: [
      { label: "Unidad", detail: "persona, atención, actor o institución" },
      { label: "Marco", detail: "total, estratos o matriz operativa" },
      { label: "Método", detail: "probabilístico, cobertura o cuotas" },
      { label: "Salida", detail: "n, distribución y reporte" },
    ],
    icon: SlidersHorizontal,
  },
  {
    id: "acreditacion",
    title: "Acreditación institucional",
    eyebrow: "Actores y cuotas",
    copy: "Calcula metas por actor, programa o canal cuando el estudio se organiza por componentes institucionales.",
    action: "Configurar actores",
    details: ["Actores", "Programas", "Canales", "Brechas"],
    sourceRoles: [
      { label: "Universo", detail: "actores y segmentos" },
      { label: "Regla", detail: "meta, cobertura o cuota" },
      { label: "Cálculo", detail: "mínimos por componente" },
      { label: "Reporte", detail: "metas y brechas" },
    ],
    icon: ClipboardList,
  },
  {
    id: "territorial_handoff",
    title: "Territorial / hogares",
    eyebrow: "Hojas de ruta",
    copy: "Cuando la selección depende de zonas, manzanas, viviendas o rutas, el diseño vive en Hojas de Ruta.",
    action: "Abrir Hojas de Ruta",
    details: ["Zonas", "Manzanas", "Viviendas", "Reemplazos"],
    sourceRoles: [
      { label: "Territorio", detail: "distritos, zonas y cartografía" },
      { label: "Ruta", detail: "manzanas y viviendas titulares" },
      { label: "Campo", detail: "reemplazos y ocurrencias" },
      { label: "Cierre", detail: "avance territorial" },
    ],
    icon: MapPinned,
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
  return {
    ...EMPTY_WORKSPACE,
    ...(estudio.workspace ?? {}),
    variables_control: estudio.workspace?.variables_control ?? [],
    escenarios: estudio.workspace?.escenarios ?? [],
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

function defaultRailSectionForDesk(desk: ActiveDesk) {
  if (desk === "opinion_universitaria") return "definicion";
  if (desk === "marco_disponible") return "marco";
  if (desk === "acreditacion") return "actores";
  if (desk === "territorial_handoff") return "hojas-ruta";
  return "pathways";
}

function railTitleForDesk(desk: ActiveDesk) {
  if (desk === "opinion_universitaria") return "Encuesta a estudiantes";
  if (desk === "marco_disponible") return "Muestra general";
  if (desk === "acreditacion") return "Acreditación";
  if (desk === "territorial_handoff") return "Territorial";
  if (desk === "legacy") return "Sesión anterior";
  return "Tipo de estudio";
}

function railSectionsForDesk(desk: ActiveDesk): CalcMuestraSectionNavItem[] {
  if (desk === "opinion_universitaria") {
    return [
      { id: "definicion", label: "Definición", detail: "estudio y contrato de datos", icon: ClipboardList, targetId: "cmv2-section-university-setup" },
      { id: "marco", label: "Marco institucional", detail: "base madre o dos bases", icon: Database, targetId: "cmv2-section-university-marco" },
      { id: "calculo", label: "Cálculo", detail: "n final y ajustes", icon: Calculator, targetId: "cmv2-section-university-calculo" },
      { id: "aulas", label: "Aulas y selección", detail: "selector, reservas y cuotas", icon: Grid3X3, targetId: "cmv2-section-university-aulas" },
      { id: "salidas", label: "Salidas", detail: "reporte y monitoreo", icon: Route, targetId: "cmv2-section-university-salidas" },
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

function normalizeUniversityAulasConfig(config?: CalcMuestraWorkspace["aulas_config"] | null): CalcMuestraWorkspaceAulasConfig {
  const raw: Partial<CalcMuestraWorkspaceAulasConfig> = config ?? {};
  const selector = raw.selector ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.selector;
  const selectorEngine = normalizeAulasSelectorEngine(raw.selector_engine ?? selector);
  return {
    ...DEFAULT_UNIVERSITY_AULAS_CONFIG,
    ...raw,
    modalidad: raw.modalidad ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.modalidad,
    selector,
    selector_engine: selectorEngine,
    method_family: raw.method_family ?? (selectorEngine === "pool_controlado" ? "probability_with_operational_optimization" : "balanced_probability"),
    min_elegibles_aula: Math.max(1, Math.round(safeNumber(raw.min_elegibles_aula, DEFAULT_UNIVERSITY_AULAS_CONFIG.min_elegibles_aula))),
    usar_grupos_tamano: raw.usar_grupos_tamano ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.usar_grupos_tamano,
    grupos_tamano: raw.grupos_tamano?.length ? raw.grupos_tamano : DEFAULT_UNIVERSITY_AULAS_CONFIG.grupos_tamano,
    estratos_selector: raw.estratos_selector?.length ? raw.estratos_selector : DEFAULT_UNIVERSITY_AULAS_CONFIG.estratos_selector,
    balance_vars: raw.balance_vars?.length ? raw.balance_vars : DEFAULT_UNIVERSITY_AULAS_CONFIG.balance_vars,
    spread_vars: raw.spread_vars?.length ? raw.spread_vars : DEFAULT_UNIVERSITY_AULAS_CONFIG.spread_vars,
    candidate_pool_size: Math.max(1, Math.round(safeNumber(raw.candidate_pool_size, DEFAULT_UNIVERSITY_AULAS_CONFIG.candidate_pool_size))),
    simulation_runs: Math.max(0, Math.round(safeNumber(raw.simulation_runs, DEFAULT_UNIVERSITY_AULAS_CONFIG.simulation_runs))),
    mos_strategy: raw.mos_strategy ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.mos_strategy,
    coordination_mode: raw.coordination_mode ?? DEFAULT_UNIVERSITY_AULAS_CONFIG.coordination_mode,
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
  if (mode === "opinion_universitaria") return "Encuesta a estudiantes";
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
  useCalcMuestraAutosave();
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
  const [aulasState, setAulasState] = useState<CalcMuestraAulasState | null>(null);
  const workspace = useMemo(() => normalizeWorkspace(estudio), [estudio]);
  const desk = inferDesk(estudio, workspace);
  const resultados = estudio.componentes.filter(hasUsefulResult).length;
  const productos = Array.from(new Set(estudio.componentes.map(tecnicaProducto)));

  useEffect(() => {
    setActiveRailSection(defaultRailSectionForDesk(desk));
  }, [desk]);

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    apiCalcMuestraState()
      .then((state) => {
        if (alive) setAulasState(state.aulas ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [hydrated]);

  async function persistCurrent(estudioOverride?: CalcMuestraEstudio) {
    await apiCalcMuestraEstudioPut(estudioOverride ?? estudio);
  }

  async function iniciar(mode: ActiveDesk, opts: { cargarModeloBase?: boolean } = {}) {
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
    if (mode === "territorial_handoff") {
      navigate("/hojas-ruta");
      return;
    }
    void iniciar(mode);
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

  if (!hydrated) return <LoadingBlock label="Cargando mesa de muestra..." />;

  return (
    <PageFrame
      className="cmv2-frame"
      bodyMode="fill"
      title="Cálculo de muestra y marco muestral"
      lead="Construye marcos, calcula escenarios y selecciona unidades para campo: aulas, manzanas, actores o muestras generales."
      meta={
        <div className="cmv2-header-metrics">
          <Metric label="Componentes" value={estudio.componentes.length} />
          <Metric label="Calculados" value={resultados} />
          <Metric label="Producto" value={productos.length > 1 ? "Mixto" : productoLabel(productos[0] ?? "muestra_probabilistica")} />
        </div>
      }
      toolbar={
        <div className="cmv2-toolbar">
          <button type="button" className="cmv2-ghost" onClick={() => setWorkspace(EMPTY_WORKSPACE)}>
            <RefreshCw size={14} /> Cambiar estudio
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
              Ver reporte
            </a>
          )}
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
          <CalcMuestraRail
            desk={desk}
            activeSection={activeRailSection}
            onChooseStudy={elegirEstudio}
            onBackToStudies={() => setWorkspace(EMPTY_WORKSPACE)}
            onSection={navegarSeccion}
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

          {desk === "sin_definir" && <FrameSelector onSelect={elegirEstudio} onTerritorial={() => navigate("/hojas-ruta")} />}

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

function CalcMuestraRail({
  desk,
  activeSection,
  onChooseStudy,
  onBackToStudies,
  onSection,
}: {
  desk: ActiveDesk;
  activeSection: string;
  onChooseStudy: (mode: ActiveDesk) => void;
  onBackToStudies: () => void;
  onSection: (item: CalcMuestraSectionNavItem) => void;
}) {
  const choosing = desk === "sin_definir";
  const sections = railSectionsForDesk(desk);
  return (
    <aside className={`cmv2-rail ${choosing ? "is-choosing" : "is-contextual"}`}>
      <div className="cmv2-rail-title">
        {choosing ? <Database size={16} /> : <Route size={16} />}
        <span>{railTitleForDesk(desk)}</span>
      </div>
      {!choosing && (
        <button type="button" className="cmv2-rail-switch" onClick={onBackToStudies}>
          <Home size={14} />
          Elegir otro estudio
        </button>
      )}
      <nav className="cmv2-rail-nav" aria-label={choosing ? "Tipo de estudio" : "Secciones del estudio"}>
        {choosing ? (
          FRAME_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                className="cmv2-rail-item"
                onClick={() => onChooseStudy(card.id)}
              >
                <Icon size={16} />
                <span>
                  <strong>{card.title}</strong>
                  <small>{card.eyebrow}</small>
                </span>
              </button>
            );
          })
        ) : (
          sections.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`cmv2-rail-item ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => onSection(item)}
              >
                <Icon size={16} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              </button>
            );
          })
        )}
      </nav>
    </aside>
  );
}

function FrameSelector({
  onSelect,
  onTerritorial,
}: {
  onSelect: (mode: ActiveDesk) => void;
  onTerritorial: () => void;
}) {
  return (
    <section className="cmv2-selector">
      <div className="cmv2-selector-head">
        <div>
          <span className="cmv2-eyebrow">Marco muestral y selección</span>
          <h2>Elige la ruta de diseño</h2>
        </div>
        <p>Primero defines el tipo de marco; luego Prosecnur abre una mesa específica con sus insumos, criterios, selección y salidas de campo.</p>
      </div>
      <div className="cmv2-frame-grid">
        {FRAME_CARDS.map((card) => {
          const Icon = card.icon;
          const territorial = card.id === "territorial_handoff";
          return (
            <button
              key={card.id}
              type="button"
              className={`cmv2-frame-card cmv2-frame-card--${card.id} ${territorial ? "is-handoff" : ""}`}
              onClick={() => (territorial ? onTerritorial() : onSelect(card.id))}
            >
              <span className="cmv2-card-icon"><Icon size={20} /></span>
              <small>{card.eyebrow}</small>
              <strong>{card.title}</strong>
              <p>{card.copy}</p>
              <div className="cmv2-path-tags" aria-label={`Alcance ${card.title}`}>
                {card.details.map((detail) => <span key={detail}>{detail}</span>)}
              </div>
              <div className="cmv2-path-flow">
                {card.sourceRoles.map((role, index) => (
                  <em key={role.label}>
                    <i>{String(index + 1).padStart(2, "0")}</i>
                    <span>{role.label}</span>
                    <small>{role.detail}</small>
                  </em>
                ))}
              </div>
              <span className="cmv2-card-action">
                <span>{card.action}</span>
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
  calculando,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  busy: string | null;
  activeSection: string;
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

  function setUniversityPair(nextTotal: CalcMuestraComponente, nextFaculty: CalcMuestraComponente) {
    const nextWorkspace = universityWorkspace(syncedWorkspace, nextTotal, nextFaculty);
    onSetComponentes([nextTotal, nextFaculty]);
    onWorkspace(nextWorkspace);
  }

  function updateSharedEstratos(estratos: CalcMuestraEstrato[]) {
    const nextTotalEstratos = withUniversityEstratoDefaults(estratos, "universidad");
    const nextFacultyEstratos = withUniversityEstratoDefaults(estratos, "facultad");
    const totalMarco = nextTotalEstratos.reduce((sum, e) => sum + safeNumber(e.N), 0);
    const marcoTotal = {
      ...totalComp.marco,
      estratos: nextTotalEstratos,
      universo_bruto: totalMarco,
      marco_validado: totalMarco,
      marco_contactable: totalMarco,
      estado: "validado" as const,
    };
    const marcoFaculty = {
      ...facultyComp.marco,
      estratos: nextFacultyEstratos,
      universo_bruto: totalMarco,
      marco_validado: totalMarco,
      marco_contactable: totalMarco,
      estado: "validado" as const,
    };
    setUniversityPair(
      { ...totalComp, marco: marcoTotal, resultado: null },
      { ...facultyComp, marco: marcoFaculty, resultado: null },
    );
  }

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

  function calculateProposals() {
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
  const marcoReady = safeNumber(totalComp.marco.marco_validado) > 0 && (totalComp.marco.estratos ?? []).some((e) => safeNumber(e.N) > 0);
  const calculationReady = Boolean(totalComp.resultado || facultyComp.resultado);
  const comparisonReady = Boolean(aulasState?.method_comparison || aulasState?.selection?.method_comparison);
  const selectionReady = Boolean(aulasState?.selection);
  const replacementReady = Boolean(aulasState?.replacement_simulation || aulasState?.selection?.replacement_simulation);

  return (
    <div className="cmv2-desk">
      <ShellHeader
        eyebrow="Encuesta a estudiantes"
        title="Estudiantes universitarios"
        copy="Mesa por marco institucional, escenarios de muestra y selección de aulas."
        icon={Grid3X3}
      >
        <button type="button" className="cmv2-ghost" onClick={onCargarModelo}>
          <Wand2 size={14} /> Cargar modelo
        </button>
        <button type="button" className="cmv2-primary" onClick={calculateProposals} disabled={calculando}>
          {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
          Calcular propuestas
        </button>
      </ShellHeader>
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection === "definicion" && (
          <div id="cmv2-section-university-setup" className="cmv2-tab-panel" role="tabpanel" aria-label="Definición">
            <UniversityGuidedBrief
              section="definicion"
              workspace={syncedWorkspace}
              totalComp={totalComp}
              facultyComp={facultyComp}
              marcoReady={marcoReady}
              calculationReady={calculationReady}
              comparisonReady={comparisonReady}
              selectionReady={selectionReady}
              replacementReady={replacementReady}
            />
            <UniversityStudySetupPanel
              estudio={estudio}
              workspace={syncedWorkspace}
              onTitulo={onTitulo}
              onContexto={onContexto}
              onWorkspace={onWorkspace}
            />
          </div>
        )}

        {selectedSection === "marco" && (
          <div id="cmv2-section-university-marco" className="cmv2-tab-panel" role="tabpanel" aria-label="Marco institucional">
            <UniversityGuidedBrief
              section="marco"
              workspace={syncedWorkspace}
              totalComp={totalComp}
              facultyComp={facultyComp}
              marcoReady={marcoReady}
              calculationReady={calculationReady}
              comparisonReady={comparisonReady}
              selectionReady={selectionReady}
              replacementReady={replacementReady}
            />
            <UniversityRevampBlueprint componentes={[totalComp, facultyComp]} workspace={syncedWorkspace} />
            <div className="cmv2-university-top">
              <UniversityRevampMarcoPanel comp={totalComp} />
              <UniversityFrameReadinessPanel comp={totalComp} workspace={syncedWorkspace} />
            </div>
          </div>
        )}

        {selectedSection === "aulas" && (
          <div id="cmv2-section-university-aulas" className="cmv2-tab-panel" role="tabpanel" aria-label="Aulas y selección">
            <UniversityGuidedBrief
              section="aulas"
              workspace={syncedWorkspace}
              totalComp={totalComp}
              facultyComp={facultyComp}
              marcoReady={marcoReady}
              calculationReady={calculationReady}
              comparisonReady={comparisonReady}
              selectionReady={selectionReady}
              replacementReady={replacementReady}
            />
            <UniversityClassroomSelectionPanel
              workspace={syncedWorkspace}
              totalComp={totalComp}
              facultyComp={facultyComp}
              aulasState={aulasState}
              busy={busy}
              onWorkspace={onWorkspace}
              onCompare={onCompararAulas}
              onSelectMethod={onSeleccionarAulas}
              onSimulateReplacements={onSimularReemplazos}
            />
            <section className="cmv2-panel cmv2-university-edit-panel">
              <div className="cmv2-panel-head">
                <span className="cmv2-eyebrow">Cuotas de cálculo</span>
                <strong>Facultades, sexo y supuestos estadísticos</strong>
              </div>
              <div className="cmv2-university-edit-layout">
                <UniversityRevampFacultadesTable
                  estratos={totalComp.marco.estratos ?? []}
                  onEstratos={updateSharedEstratos}
                />
                <UniversityRevampParametrosPanel
                  totalComp={totalComp}
                  facultyComp={facultyComp}
                  onComponente={onComponente}
                />
              </div>
            </section>
          </div>
        )}

        {selectedSection === "calculo" && (
          <div id="cmv2-section-university-calculo" className="cmv2-tab-panel" role="tabpanel" aria-label="Cálculo">
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
            <UniversityRevampCalculoPanel
              componentes={[totalComp, facultyComp]}
              workspace={syncedWorkspace}
              draftTargets={draftTargets}
              onDraftTarget={setDraftTarget}
              onApplyTarget={applyTarget}
              calculando={calculando}
            />
          </div>
        )}

        {selectedSection === "salidas" && (
          <div id="cmv2-section-university-salidas" className="cmv2-tab-panel" role="tabpanel" aria-label="Salidas">
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
            <UniversityRevampResultadosPanel
              componentes={[totalComp, facultyComp]}
              workspace={syncedWorkspace}
              onWorkspace={onWorkspace}
            />
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
      value: workspace.fuente_marco ? "Base institucional" : "Base madre / dos bases",
      detail: "estudiante x curso-horario",
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
      value: selectionReady ? `${fmtInt(aulasCalculadas)} previstas` : `M1 + M2-M${aulasConfig.bolsas_reemplazo + 1}`,
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
    { label: "Unidad", value: "estudiante x curso-horario", ready: marcoReady, icon: Table2 },
    { label: "Cuotas", value: hasSexo ? "facultad x sexo" : "sexo pendiente", ready: hasSexo, icon: Target },
    { label: "Aulas", value: selectionReady ? "titulares y bolsa" : "curso-horario", ready: selectionReady, icon: Grid3X3 },
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
type GuideStatus = "ready" | "working" | "pending";
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

function guidedStatusLabel(status: GuideStatus) {
  if (status === "ready") return "Listo";
  if (status === "working") return "Siguiente paso";
  return "Pendiente";
}

function guideStatus(done: boolean, enabled = true): GuideStatus {
  if (done) return "ready";
  return enabled ? "working" : "pending";
}

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
  const facultyTarget = safeNumber(facultyComp.resultado?.n_objetivo ?? facultyComp.meta.valor, 0);
  const totalTarget = safeNumber(totalComp.resultado?.n_objetivo ?? totalComp.meta.valor, 0);
  const quotaLabel = calculationReady
    ? `${fmtInt(Math.max(facultyTarget, totalTarget))} entrevistas objetivo`
    : marcoReady
      ? "listo para calcular"
      : "requiere marco";
  const definitionReady = Boolean(workspace.fuente_marco || workspace.marco_disponible);
  const selectionLabel = selectionReady ? "M1 y reservas generadas" : comparisonReady ? "método elegido, falta selección" : "requiere comparación";
  const replacementLabel = replacementReady ? "simulación lista" : selectionReady ? "lista para simular" : "requiere selección";
  const sourceLabel = workspace.fuente_marco || "registro académico o equivalente";
  const frameLabel = workspace.marco_disponible || "base madre o bases equivalentes";
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
        { label: "Entrada", title: "Base institucional", detail: "Puede llegar como base madre o como estudiantes elegibles más catálogo curso-horario.", status: guideStatus(Boolean(workspace.marco_disponible)) },
        { label: "Fila esperada", title: "estudiante x curso-horario", detail: "Un estudiante puede aparecer varias veces; eso se controla más adelante al seleccionar aulas.", status: "ready" },
        { label: "Salida", title: "contrato validable", detail: "Con esto Prosecnur sabe cómo pedir, leer y auditar la información antes de calcular.", status: guideStatus(definitionReady) },
      ],
      checks: [
        { label: "Fuente", value: sourceLabel, status: guideStatus(Boolean(workspace.fuente_marco)) },
        { label: "Marco disponible", value: frameLabel, status: guideStatus(Boolean(workspace.marco_disponible)) },
        { label: "Observación", value: "estudiante matriculado", status: "ready" },
        { label: "Selección final", value: "curso-horario / aula", status: "ready" },
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
        { label: "Salida", title: "N por facultad", detail: "Ese N se traduce luego a aulas M1 y reservas equivalentes.", status: guideStatus(calculationReady, marcoReady) },
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
      title: "Finalmente el N se traduce en aulas titulares y reservas",
      lead: "El laboratorio compara métodos, evita concentración y repetidos, y deja una selección trazable para que Monitoreo solo ejecute el plan.",
      status: guideStatus(selectionReady, calculationReady),
      items: [
        { label: "Entrada", title: "N/cuotas calculadas", detail: "La selección de aulas parte del objetivo por facultad, no de una lista suelta.", status: guideStatus(calculationReady, marcoReady) },
        { label: "Decisión", title: comparisonReady ? "métodos comparados" : "comparar métodos", detail: "PPS, balanceado, local pivotal y pool controlado se evalúan con el mismo objetivo.", status: guideStatus(comparisonReady, calculationReady) },
        { label: "Salida", title: selectionLabel, detail: "M1 es la muestra titular; M2...Mk son reservas, no un nuevo diseño.", status: guideStatus(selectionReady, comparisonReady) },
      ],
      checks: [
        { label: "Marco colapsado", value: "curso-horario / aula", status: guideStatus(marcoReady, definitionReady) },
        { label: "Cuotas", value: quotaLabel, status: guideStatus(calculationReady, marcoReady) },
        { label: "Selección", value: selectionLabel, status: guideStatus(selectionReady, comparisonReady) },
        { label: "Reservas", value: replacementLabel, status: guideStatus(replacementReady, selectionReady) },
      ],
    },
    salidas: {
      eyebrow: "Guía de sección",
      title: "El cierre separa reporte, workbook y monitoreo",
      lead: "La app debe dejar evidencia metodológica y un plan operativo claro, sin exponer PII ni rediseñar el marco durante campo.",
      status: guideStatus(selectionReady || calculationReady, marcoReady),
      items: [
        { label: "Entrada", title: "cálculo y selección", detail: "Toma escenarios, cuotas, titulares, reservas y advertencias metodológicas.", status: guideStatus(calculationReady, marcoReady) },
        { label: "Entrega", title: "reporte y workbook", detail: "Incluye perfil del marco, score, probabilidades, pesos, riesgos y sustento.", status: guideStatus(calculationReady, marcoReady) },
        { label: "Handoff", title: "monitoreo de aulas", detail: "Monitoreo agenda y activa reservas; no cambia silenciosamente el diseño.", status: guideStatus(selectionReady, calculationReady) },
      ],
      checks: [
        { label: "Reporte", value: calculationReady ? "preparable" : "requiere cálculo", status: guideStatus(calculationReady, marcoReady) },
        { label: "Plan de aulas", value: selectionReady ? "disponible" : "pendiente", status: guideStatus(selectionReady, calculationReady) },
        { label: "Reservas", value: replacementLabel, status: guideStatus(replacementReady, selectionReady) },
        { label: "PII", value: "solo interno si existe", status: "ready" },
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
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const requiredFields = ["student_key", "curso_horario", "facultad", "sexo", "horario", "elegible"];
  return (
    <section className="cmv2-panel cmv2-university-contract">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Definición del estudio</span>
        <strong>Contrato de datos</strong>
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
        <label className="cmv2-compact-field">
          <span>Fuente institucional</span>
          <input
            value={workspace.fuente_marco}
            placeholder="Registro académico, matrícula o sistema equivalente"
            onChange={(e) => onWorkspace({ ...workspace, fuente_marco: e.currentTarget.value })}
          />
        </label>
        <label className="cmv2-compact-field">
          <span>Marco disponible</span>
          <input
            value={workspace.marco_disponible}
            placeholder="Base madre o bases institucionales equivalentes"
            onChange={(e) => onWorkspace({ ...workspace, marco_disponible: e.currentTarget.value })}
          />
        </label>
      </div>
      <div className="cmv2-university-contract-cards">
        <div>
          <small>Cada fila del insumo</small>
          <strong>estudiante x curso-horario</strong>
          <span>Un estudiante puede aparecer en más de un curso; el selector controla repetidos desde el marco.</span>
        </div>
        <div>
          <small>Unidad de observación</small>
          <strong>estudiante matriculado</strong>
          <span>La encuesta puede ser anónima; no se exige identificador personal en respuestas.</span>
        </div>
        <div>
          <small>Unidad de selección</small>
          <strong>curso-horario / aula</strong>
          <span>Las aulas titulares y reservas se derivan del marco colapsado por curso-horario.</span>
        </div>
      </div>
      <div className="cmv2-university-field-strip" aria-label="Variables mínimas esperadas">
        {requiredFields.map((field) => <span key={field}>{field}</span>)}
      </div>
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
      value: "estudiante x curso-horario",
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
        <strong>Base madre y validación</strong>
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

type ClassroomLabTab = "marco" | "objetivo" | "metodo" | "laboratorio" | "seleccion" | "reemplazos" | "auditoria";

const CLASSROOM_LAB_TABS: Array<{ id: ClassroomLabTab; label: string; icon: typeof Database }> = [
  { id: "marco", label: "Marco de aplicación", icon: Database },
  { id: "objetivo", label: "N y objetivos", icon: Target },
  { id: "metodo", label: "Métodos", icon: Settings2 },
  { id: "laboratorio", label: "Simulación", icon: BarChart3 },
  { id: "seleccion", label: "Selección M1", icon: Table2 },
  { id: "reemplazos", label: "Reservas", icon: RefreshCw },
  { id: "auditoria", label: "Auditoría", icon: FileText },
];

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
      lead: "La idea es mirar la cadena real: base institucional, marco colapsado por curso-horario, estudiantes únicos y exclusiones.",
      input: frameReady ? `${fmtInt(frameAulas)} aulas y ${fmtInt(uniqueStudents)} estudiantes únicos` : "base institucional pendiente",
      decision: "qué filas son válidas y qué aula representa cada curso-horario",
      output: "marco de aplicación auditable",
      status: guideStatus(frameReady),
    },
    objetivo: {
      title: "Traduce el N calculado en criterios de selección",
      lead: "Aquí se define cómo convertir cuotas por facultad en aulas, reservas y restricciones operativas sin cambiar el diseño base.",
      input: quotaLabel,
      decision: "cuánto peso dar a balance, repetidos, tamaño de aula y reservas",
      output: "objetivo listo para comparar métodos",
      status: guideStatus(quotaReady, frameReady),
    },
    metodo: {
      title: "Compara métodos con el mismo objetivo",
      lead: "La app debe poder explicar por qué un método gana: mejor balance, menos concentración, menos repetidos o mejor profundidad de reservas.",
      input: quotaReady ? "marco + N/cuotas" : "requiere N/cuotas",
      decision: `usar ${recommendedMethodLabel || "un método comparable"}`,
      output: "recomendación defendible",
      status: guideStatus(comparisonReady, quotaReady),
    },
    laboratorio: {
      title: "Revisa estabilidad antes de aceptar la selección",
      lead: "La simulación muestra si el resultado recomendado es consistente o si depende demasiado de una corrida particular.",
      input: comparisonReady ? "métodos comparados" : "comparación pendiente",
      decision: "si el score, los pesos y la duplicación son estables",
      output: "riesgos y advertencias antes de seleccionar",
      status: guideStatus(comparisonReady, quotaReady),
    },
    seleccion: {
      title: "Convierte el método elegido en M1 y reservas",
      lead: "Esta pestaña muestra la propuesta que realmente pasará a campo: titulares, reservas, brechas y trazabilidad aula por aula.",
      input: comparisonReady ? "método recomendado o elegido" : "requiere comparación",
      decision: selectionReady ? `${fmtInt(m1Count)} titulares y ${fmtInt(reserveCount)} reservas` : "generar selección",
      output: "plan de aulas para monitoreo",
      status: guideStatus(selectionReady, comparisonReady),
    },
    reemplazos: {
      title: "Prepara reemplazos equivalentes antes de campo",
      lead: "Las reservas se ordenan por equivalencia de celda, balance, solape y riesgo para que Monitoreo no rediseñe sobre la marcha.",
      input: selectionReady ? "M1 + reservas" : "requiere selección",
      decision: replacementReady ? "impacto antes/después disponible" : "simular reemplazos",
      output: "reservas sugeridas por aula caída",
      status: guideStatus(replacementReady, selectionReady),
    },
    auditoria: {
      title: "Abre la capa técnica solo cuando hace falta defender el diseño",
      lead: "Fuentes, fórmulas, probabilidades, pesos, Monte Carlo y fallbacks quedan visibles sin saturar la operación diaria.",
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
        <span className="cmv2-eyebrow">Cómo leer esta pestaña</span>
        <strong>{guide.title}</strong>
        <p>{guide.lead}</p>
      </div>
      <div className="cmv2-classroom-lab-guide-steps">
        <span className={`is-${guide.status}`}>{guidedStatusLabel(guide.status)}</span>
        <em><b>Entra:</b> {guide.input}</em>
        <em><b>Decide:</b> {guide.decision}</em>
        <em><b>Sale:</b> {guide.output}</em>
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
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onCompare: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSelectMethod: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onSimulateReplacements: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
}) {
  const [activeLabTab, setActiveLabTab] = useState<ClassroomLabTab>("marco");
  const [showMethodExplanation, setShowMethodExplanation] = useState(true);
  const [tableQuery, setTableQuery] = useState("");
  const frame = aulasState?.frame ?? null;
  const comparison = aulasState?.method_comparison ?? aulasState?.selection?.method_comparison ?? null;
  const selection = aulasState?.selection ?? null;
  const replacementSimulation = aulasState?.replacement_simulation ?? aulasState?.selection?.replacement_simulation ?? null;
  const frameRows = frame?.aula_frame ?? [];
  const populationRows = frame?.population ?? [];
  const selectionRows = selection?.selection ?? [];
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
  const m1Rows = selectionRows.filter((row) => classroomRowText(row, ["wave"]) === "M1");
  const reserveRows = selectionRows.filter((row) => classroomRowText(row, ["wave"]) !== "M1");
  const recommendedMethodId = comparison?.recommendation?.method_id ?? String(config.selector_engine ?? config.selector);
  const recommendedMethod = comparisonMethods.find((method) => method.method_id === recommendedMethodId) ?? null;
  const filteredSelectionRows = selectionRows.filter((row) => classroomRowSearch(row, tableQuery));
  const totalBase = estimateClassroomBase(totalComp);
  const facultyBase = estimateClassroomBase(facultyComp);
  const referenciaBase = Math.max(totalBase ?? 0, facultyBase ?? 0);
  const facultades = totalComp.marco.estratos ?? [];
  const extraOperativo = estimateOperationalExtra(facultades, config);
  const planTotal = selectionRows.length || frameRows.length || (referenciaBase > 0 ? referenciaBase * (config.bolsas_reemplazo + 1) : 0);
  const sobremuestraPct = Math.max(totalComp.parametros.oversample_pct, facultyComp.parametros.oversample_pct);
  const selectorFields = config.estratos_selector.map(selectorFieldLabel);
  const facultyTarget = safeNumber(facultyComp.resultado?.n_objetivo ?? facultyComp.meta.valor, 0);
  const hasCalculatedQuota = facultyTarget > 0 || safeNumber(totalComp.resultado?.n_objetivo ?? totalComp.meta.valor, 0) > 0;
  const labQuotaLabel = hasCalculatedQuota ? `${fmtInt(Math.max(facultyTarget, safeNumber(totalComp.resultado?.n_objetivo ?? totalComp.meta.valor, 0)))} entrevistas objetivo` : "N/cuotas pendientes";
  const steps = [
    { label: "Base institucional", value: "estudiante x curso-horario", detail: "un estudiante puede aparecer en varios cursos" },
    { label: "Marco colapsado", value: frameRows.length ? `${fmtInt(frameRows.length)} aulas` : "curso-horario", detail: "una fila por aula seleccionable" },
    { label: "N por facultad", value: facultyTarget ? fmtInt(facultyTarget) : "pendiente", detail: "viene de la pestaña Cálculo" },
    { label: "Aulas por facultad", value: referenciaBase ? `${fmtInt(referenciaBase)} M1` : "pendiente", detail: "cuota / rendimiento esperado" },
    { label: "Comparador", value: comparison ? "métodos evaluados" : "por correr", detail: "PPS, cube, local pivotal y pool controlado" },
    { label: "Selección", value: selection ? `${fmtInt(m1Rows.length)} titulares` : engineOption.label, detail: "balance, cobertura y repetidos" },
    { label: "Reservas", value: `M2-M${config.bolsas_reemplazo + 1}`, detail: "bolsas equivalentes priorizadas" },
  ];
  const auditRows = [
    { label: "Diseño probabilístico", value: engineOption.label, detail: "Aulas/curso-horario con probabilidad conocida y balance por variables auxiliares." },
    { label: "Optimización operativa", value: config.selector_engine === "pool_controlado" ? `${fmtInt(config.candidate_pool_size)} candidatas` : "sin post-selección", detail: "Si se elige entre candidatas, las probabilidades finales salen de simulación." },
    { label: "Probabilidades y pesos", value: `${fmtInt(config.simulation_runs)} corridas`, detail: "Produce pi_base, pi_design, pi_mc, pi_final y pesos de aula/estudiante agregado." },
    { label: "Fuentes", value: "oficiales + académicas", detail: "PISA/NAEP/UN/Eurostat/AAPOR, cube method y paquetes R documentados." },
    { label: "Reservas", value: `M2-M${config.bolsas_reemplazo + 1}`, detail: "Reemplazos trazables; no se mezclan con sobremuestra ni rediseño del marco." },
  ];
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
          <strong>Laboratorio guiado: marco, método, simulación y reservas</strong>
        </div>
        <div className="cmv2-classroom-badges" aria-label="Trazabilidad del selector">
          <span>Reproducible</span>
          <span>Marco auditado</span>
          <span>Listo para monitoreo</span>
        </div>
      </div>

      <div className="cmv2-classroom-kpis">
        <Metric label="N/cuotas" value={hasCalculatedQuota ? "calculadas" : "pendiente"} />
        <Metric label="M1 desde cuotas" value={referenciaBase ? fmtInt(referenciaBase) : "pendiente"} />
        <Metric label="Representatividad" value={Number.isFinite(currentRepresentativityScore) ? classroomScore(currentRepresentativityScore) : "pendiente"} />
        <Metric label="Bolsas reserva" value={`M2-M${config.bolsas_reemplazo + 1}`} />
        <Metric label="Aulas en lista" value={planTotal ? fmtInt(planTotal) : "sin marco"} />
        <Metric label="+ aulas operativas" value={fmtInt(extraOperativo)} />
      </div>

      <div className="cmv2-classroom-commandbar" aria-label="Acciones del laboratorio de aulas">
        <button type="button" className="cmv2-ghost" onClick={runComparison} disabled={Boolean(busy)}>
          {busy === "Comparando métodos" ? <Loader2 size={14} className="pulso-spin" /> : <BarChart3 size={14} />}
          Comparar métodos
        </button>
        <button type="button" className="cmv2-primary" onClick={() => runSelection()} disabled={Boolean(busy)}>
          {busy === "Seleccionando aulas" ? <Loader2 size={14} className="pulso-spin" /> : <Table2 size={14} />}
          Generar selección
        </button>
        <button type="button" className="cmv2-ghost" onClick={runReplacementSimulation} disabled={Boolean(busy) || !selection}>
          {busy === "Simulando reemplazos" ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
          Simular reemplazos
        </button>
        {comparison?.recommendation && (
          <span className="cmv2-classroom-recommendation">
            Recomendado: <strong>{comparison.recommendation.method_label ?? classroomMethodLabel(recommendedMethodId)}</strong>
          </span>
        )}
      </div>

      <div className="cmv2-classroom-lab-tabs" role="tablist" aria-label="Secciones del laboratorio de selección de aulas">
        {CLASSROOM_LAB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeLabTab === tab.id}
              className={`cmv2-classroom-lab-tab ${activeLabTab === tab.id ? "is-active" : ""}`}
              onClick={() => setActiveLabTab(tab.id)}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <ClassroomLabGuide
        activeTab={activeLabTab}
        frameReady={frameRows.length > 0}
        quotaReady={hasCalculatedQuota}
        comparisonReady={Boolean(comparison)}
        selectionReady={Boolean(selection)}
        replacementReady={Boolean(replacementSimulation)}
        frameAulas={frameRows.length}
        uniqueStudents={populationRows.length}
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
              <div className="cmv2-classroom-methods">
                <article>
                  <small>Unidad seleccionable</small>
                  <strong>curso-horario / aula</strong>
                  <span>No se sortean filas alumno-curso como unidad final; se colapsa primero el marco.</span>
                </article>
                <article>
                  <small>Repetidos</small>
                  <strong>Control de solape</strong>
                  <span>Si un estudiante aparece en varios cursos, el selector lo controla desde el marco institucional.</span>
                </article>
                <article>
                  <small>Reservas</small>
                  <strong>M2...Mk no son encuestas extra</strong>
                  <span>Son reemplazos equivalentes; el extra operativo se presupuesta y se mapea por separado.</span>
                </article>
                <article>
                  <small>Campo anónimo</small>
                  <strong>No exige identificación personal</strong>
                  <span>La trazabilidad de campo cruza collector, link, aula, fecha y estado operativo.</span>
                </article>
              </div>
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Perfil marco vs muestra</span>
                <strong>Distribuciones que gobernarán la selección</strong>
              </div>
              <ProfileBalanceChart rows={visibleProfiles} />
              <div className="cmv2-classroom-insumo-grid" aria-label="Formatos de insumo esperados">
                <article>
                  <small>Entrada institucional</small>
                  <strong>Estudiantes matriculados</strong>
                  <span>Puede venir como estudiante x curso-horario con código interno, facultad, carrera, sexo, condición, curso, horario y modalidad.</span>
                </article>
                <article>
                  <small>Catálogo operativo</small>
                  <strong>Curso-horario</strong>
                  <span>Puede venir separado con curso-horario, sesiones y aula, docente, contacto, matriculados totales y población elegible.</span>
                </article>
                <article>
                  <small>Selección previa</small>
                  <strong>Muestra + agenda</strong>
                  <span>Si ya existe selección, Prosecnur debe leer titulares, reservas, envío de correos y agenda sin recalcular silenciosamente.</span>
                </article>
                <article>
                  <small>Campo</small>
                  <strong>Aulas agendadas y adicionales</strong>
                  <span>Monitoreo recibe estados, llamadas, fechas, aplicadores, QR/collector y reemplazos usados.</span>
                </article>
              </div>
            </div>
            <aside className="cmv2-classroom-lab-side">
              <div className="cmv2-classroom-stat-grid">
                <Metric label="Aulas del marco" value={frameRows.length ? fmtInt(frameRows.length) : "pendiente"} />
                <Metric label="Estudiantes únicos" value={populationRows.length ? fmtInt(populationRows.length) : "pendiente"} />
                <Metric label="Exclusiones" value={frame?.exclusions?.length ? fmtInt(frame.exclusions.length) : "0"} />
                <Metric label="Hash del marco" value={frame?.frame_hash ? String(frame.frame_hash).slice(0, 8) : "sin hash"} />
              </div>
              <div className="cmv2-classroom-audit-grid">
                {(frame?.audit ?? []).slice(0, 4).map((row, index) => (
                  <div key={index}>
                    <small>{classroomRowText(row, ["metric", "indicador", "name"]) || `Auditoría ${index + 1}`}</small>
                    <strong>{classroomRowText(row, ["value", "valor", "n"]) || "registrado"}</strong>
                    <span>{classroomRowText(row, ["detail", "detalle", "note"]) || "Control del marco construido."}</span>
                  </div>
                ))}
                {!frame?.audit?.length && (
                  <div>
                    <small>Marco pendiente</small>
                    <strong>Carga o construye el marco</strong>
                    <span>Cuando exista base madre o dos bases equivalentes, esta sección mostrará auditoría real.</span>
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
                <strong>Del N por facultad a aulas titulares y reservas</strong>
              </div>
              <div className="cmv2-classroom-control-grid">
                <label className="cmv2-compact-field cmv2-classroom-field-wide">
                  <span>Modalidad</span>
                  <select
                    value={config.modalidad}
                    onChange={(e) => updateConfig({ modalidad: e.currentTarget.value as CalcMuestraWorkspaceAulasModalidad })}
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
                  <span>Bolsas de reemplazo</span>
                  <NumberCell value={config.bolsas_reemplazo} min={0} step={1} onChange={(v) => updateConfig({ bolsas_reemplazo: Math.round(v) })} />
                  <em>Crea M2, M3... como alternativas equivalentes para campo.</em>
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
                <span>Primero se calcula el N necesario por facultad; después se traduce ese objetivo a aulas titulares M1 y reservas M2...Mk con profundidad suficiente para el monitoreo.</span>
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
                      {compared && <em>Representatividad {classroomScore(compared.representativity_score ?? compared.overall_score)} · pérdida {fmtPct(compared.duplicate_loss ?? 0)}</em>}
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
                  disabled={Boolean(busy)}
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
                <span>El PPS queda como base auditable. El método balanceado es el motor recomendado cuando hay variables auxiliares; el pool controlado mejora solape pero obliga a estimar probabilidades finales por simulación.</span>
              </div>
            </aside>
          </div>
        )}

        {activeLabTab === "laboratorio" && (
          <div className="cmv2-classroom-lab-grid">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Simulación</span>
                <strong>Estabilidad del score, cobertura y duplicación</strong>
              </div>
              {!comparison || !comparisonMethods.length ? (
                <ClassroomEmptyState
                  icon={BarChart3}
                  title="Simulación pendiente"
                  detail="Corre el comparador para generar corridas presupuestadas y observar variabilidad del diseño antes de seleccionar."
                  actionLabel="Comparar métodos"
                  onAction={runComparison}
                  disabled={Boolean(busy)}
                />
              ) : (
                <>
                  <SimulationSummaryPanel rows={simulationRows} />
                  <RepresentativityMetricGrid metrics={comparisonMetrics.filter((metric) => metric.method_id === recommendedMethodId)} />
                  <ProfileBalanceChart rows={visibleProfiles} />
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
                <strong>Titulares M1, reservas y trazabilidad</strong>
              </div>
              {!selection ? (
                <ClassroomEmptyState
                  icon={Table2}
                  title="Todavía no hay selección"
                  detail="Genera una selección desde el método recomendado o desde una tarjeta del comparador."
                  actionLabel="Generar selección"
                  onAction={() => runSelection()}
                  disabled={Boolean(busy)}
                />
              ) : (
                <>
                  <div className="cmv2-classroom-stat-grid">
                    <Metric label="Titulares M1" value={fmtInt(m1Rows.length)} />
                    <Metric label="Reservas" value={fmtInt(reserveRows.length)} />
                    <Metric label="Score representativo" value={classroomScore(selection.representativity_score)} />
                    <Metric label="Motor usado" value={selection.selector_engine_used ?? selection.selector_engine ?? engineOption.label} />
                    <Metric label="Probabilidad" value={selection.probability_source ?? "diseño"} />
                  </div>
                  <CoverageOverlapPanel rows={coverageRows} />
                  <ProfileBalanceChart rows={visibleProfiles} />
                  <label className="cmv2-compact-field cmv2-classroom-table-filter">
                    <span>Filtrar aulas</span>
                    <input
                      value={tableQuery}
                      placeholder="facultad, curso, horario, docente..."
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
          <div className="cmv2-classroom-lab-grid">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Reemplazos</span>
                <strong>Reservas equivalentes y efecto esperado</strong>
              </div>
              {!replacementSimulation ? (
                <ClassroomEmptyState
                  icon={RefreshCw}
                  title="Simulación pendiente"
                  detail="Después de generar una selección, simula reservas sugeridas por celda, balance, solape y tamaño efectivo."
                  actionLabel="Simular reemplazos"
                  onAction={runReplacementSimulation}
                  disabled={Boolean(busy) || !selection}
                />
              ) : (
                <ClassroomReplacementTables simulation={replacementSimulation} />
              )}
            </div>
            <aside className="cmv2-classroom-lab-side">
              <div className="cmv2-classroom-note">
                <Route size={15} />
                <span>Calc-Muestra propone titulares y reservas; Monitoreo solo activa reservas, registra motivos y recalcula brechas sin rediseñar silenciosamente el marco base.</span>
              </div>
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
                  <code className="cmv2-classroom-formula-code">error_balance[c] = p_sample[c] - p_frame[c]</code>
                  <span>La app calcula brechas por cada categoría activa.</span>
                </div>
                <div className="cmv2-classroom-formula">
                  <small>Peso de aula</small>
                  <code className="cmv2-classroom-formula-code">w_i = 1 / pi_i</code>
                  <span>El peso final usa `pi_final`, no una probabilidad intermedia.</span>
                </div>
                <div className="cmv2-classroom-formula">
                  <small>Probabilidad estudiantil interna</small>
                  <code className="cmv2-classroom-formula-code">pi_student = 1 - prod(1 - pi_classroom_j)</code>
                  <span>Se estima desde las aulas del marco; no se exporta PII al cliente.</span>
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
            </aside>
          </div>
        )}
      </div>

      <div className="cmv2-classroom-note">
        <CheckCircle2 size={15} />
        <span>
          El cálculo de muestra define cuota y sobremuestra; la selección de aulas arma M1 y reservas equivalentes. Prosecnur conserva internamente versión del marco, código de reproducción y bitácora; la pantalla muestra decisiones operativas listas para Monitoreo de aulas universitarias.
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

function CoverageOverlapPanel({ rows }: { rows?: Array<Record<string, unknown>> | unknown }) {
  const metricRows = rowsFrom<Record<string, unknown>>(rows);
  const covered = classroomMetricValue(metricRows, "selected_unique_students");
  const exposure = classroomMetricValue(metricRows, "selected_student_course_exposure");
  const coverage = classroomMetricValue(metricRows, "coverage_population_pct");
  const efficiency = classroomMetricValue(metricRows, "coverage_efficiency");
  const duplicateLoss = classroomMetricValue(metricRows, "duplicate_loss");
  return (
    <div className="cmv2-coverage-panel">
      <article>
        <Users size={16} />
        <small>Estudiantes únicos cubiertos</small>
        <strong>{Number.isFinite(covered) ? fmtInt(covered) : "pendiente"}</strong>
        <span>{Number.isFinite(coverage) ? `${fmtPct(coverage)} del marco` : "requiere selección"}</span>
      </article>
      <article>
        <Layers3 size={16} />
        <small>Exposición alumno-curso</small>
        <strong>{Number.isFinite(exposure) ? fmtInt(exposure) : "pendiente"}</strong>
        <span>{Number.isFinite(efficiency) ? `${fmtPct(efficiency)} eficiencia única` : "sin cálculo"}</span>
      </article>
      <article>
        <Gauge size={16} />
        <small>Pérdida por repetidos</small>
        <strong>{Number.isFinite(duplicateLoss) ? fmtPct(duplicateLoss) : "pendiente"}</strong>
        <span>se controla desde el marco, no desde respuestas anónimas</span>
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
          <em>Corre el comparador para estimar estabilidad de score, cobertura y pérdida por repetidos.</em>
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
        <span><strong>{fmtPct(method.duplicate_loss ?? 0)}</strong> pérdida rep.</span>
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
      <b>Score {classroomScore(comparison.recommendation.representativity_score ?? comparison.recommendation.overall_score)} · distancia {classroomNumberText(comparison.recommendation as Record<string, unknown>, ["representativity_distance"])}</b>
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
            <th>Ola</th>
            <th>Aula</th>
            <th>Facultad / programa</th>
            <th>Horario</th>
            <th>Elegibles</th>
            <th>pi final</th>
            <th>Peso</th>
            <th>Solape</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, index) => (
            <tr key={`${classroomRowText(row, ["classroom_id"])}-${index}`}>
              <td>{classroomRowText(row, ["wave"])}</td>
              <td>
                <strong>{classroomRowText(row, ["course_name", "label", "classroom_id"])}</strong>
                <small>{classroomRowText(row, ["teacher", "classroom_id"])}</small>
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
      label: classroomRowText(row, ["course_name", "label", "classroom_id"]) || `Aula ${index + 1}`,
      overlap: classroomRowNumber(row, ["duplicate_overlap"]),
      x: 36 + (index % 2) * 128,
      y: 36 + Math.floor(index / 2) * 54,
    }));
  const maxOverlap = Math.max(1, ...visible.map((item) => item.overlap));
  return (
    <div className="cmv2-classroom-overlap-graph">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Solape</span>
        <strong>Aulas titulares</strong>
      </div>
      {!visible.length ? (
        <span className="cmv2-classroom-muted">Genera selección para ver concentración de repetidos.</span>
      ) : (
        <svg viewBox="0 0 230 250" role="img" aria-label="Grafo simple de solape entre aulas">
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
        title="Sin reservas sugeridas"
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
              <th>Aula caída</th>
              <th>Reserva sugerida</th>
              <th>Ola</th>
              <th>Equivalencia</th>
              <th>Score repr.</th>
              <th>Delta</th>
              <th>Solape</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((item) => (
              <tr key={`${item.titular_classroom_id}-${item.reserve_classroom_id}-${item.rank}`}>
                <td>
                  {item.titular_label || item.titular_classroom_id}
                  <small>{item.titular_classroom_id}</small>
                </td>
                <td>
                  {item.reserve_label || item.reserve_classroom_id}
                  <small>{item.reserve_classroom_id}</small>
                </td>
                <td>{item.wave}</td>
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
            <th>Reserva</th>
            <th>Score</th>
            <th>Balance</th>
            <th>Elegibles</th>
            <th>Advertencia</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={index}>
              <td>{classroomRowText(row, ["titular_classroom_id"])}</td>
              <td>{classroomRowText(row, ["suggested_replacement_id"])}</td>
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
    { label: "Probabilidades", value: selection?.probability_source ?? comparison?.recommendation?.method_id ?? "pendiente" },
    { label: "Pesos", value: selection?.weight_source ?? "weight_classroom = 1/pi_final; pi_student interno agregado" },
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
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "";
}

function rowsFrom<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function classroomRowNumber(row: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
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
                <span>curso-horario</span>
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
          <Wand2 size={14} /> Cargar modelo
        </button>
        <button type="button" className="cmv2-primary" onClick={() => void onCalcular()} disabled={calculando}>
          {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
          Calcular propuesta
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
