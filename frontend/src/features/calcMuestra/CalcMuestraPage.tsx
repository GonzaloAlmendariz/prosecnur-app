import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Database,
  FileText,
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
  X,
} from "lucide-react";
import { PageFrame } from "../../components/PageFrame";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import { GlidingTabList } from "../../components/GlidingTabList";
import { useCalcMuestraAutosave } from "./hooks/useCalcMuestraAutosave";
import { useCalcMuestraStore } from "./store/calcMuestraStore";
import { useMotorPersistencia } from "./motor/useMotorPersistencia";
import { useMotorStore } from "./motor/store";
import { ResumenDiseno } from "./motor/ResumenDiseno";
import { usePerfilEfectivo } from "./motor/usePerfilEfectivo";
import { EMPTY_WORKSPACE } from "./workspaceDefaults";
import {
  apiCalcMuestraAulasCompararMetodos,
  apiCalcMuestraAulasExportar,
  apiCalcMuestraAulasSeleccionar,
  apiCalcMuestraAulasSimularReemplazos,
  apiCalcMuestraCalcular,
  apiCalcMuestraEstudioPut,
  apiCalcMuestraIniciarEstudio,
  apiCalcMuestraMarcoConstruir,
  apiCalcMuestraMarcoInspeccionarArchivo,
  apiCalcMuestraReporteIniciar,
  apiCalcMuestraState,
  apiJobCancel,
  apiJobStatus,
  apiMonitoreoImportFromCalcMuestra,
  apiUpload,
  calcMuestraReporteDescargarUrl,
  downloadUrl,
  type CalcMuestraCanalRecojo,
  type CalcMuestraAulasSheetInspectionSheet,
  type CalcMuestraAulasState,
  type CalcMuestraComponente,
  type CalcMuestraEstrato,
  type CalcMuestraEstudio,
  type CalcMuestraMacroFamilia,
  type CalcMuestraMatrizOperativaCelda,
  type CalcMuestraState,
  type CalcMuestraTecnica,
  type CalcMuestraWorkspace,
  type CalcMuestraWorkspaceAulasConfig,
  type CalcMuestraWorkspaceProducto,
  type CalcMuestraWorkspaceSourceBinding,
  type CalcMuestraWorkspaceVariableMapping,
  type CalcMuestraWorkspaceVariableControl,
  type JobSnapshot,
} from "../../api/client";
import {
  defaultComponente,
  fmtInt,
  fmtPct,
  guideStatus,
  rowsFrom,
  safeNumber,
  setTecnica,
  uid,
  type ActiveDesk,
  type ComponentePatch,
  type GuideStatus,
} from "./sharedCore";
import {
  DEFAULT_UNIVERSITY_PUBLICATION_CONFIG,
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
  type ClassroomLabTab,
} from "./universidad/shared/constants";
import { normalizeUniversityLabel } from "./universidad/shared/format";
import {
  classroomComparisonReady,
  classroomFrameReady,
  classroomReplacementReady,
  classroomSelectionReady,
  frameAuditNumber,
} from "./universidad/shared/frame";
import {
  defaultTitleFor,
  hasUsefulResult,
  normalizeUniversityAulasConfig,
  prepareUniversityStudyForCalculation,
  estratosDesdeFrame,
  universityComponents,
  universityDefaultWorkspace,
  universityFacultyConfidence,
  universityFacultyError,
  universityWorkspace,
} from "./universidad/shared/study";
import {
  ensureUniversitySourceBindings,
  expectedSheetRolesForSource,
  reconcileUniversityVariableMappingsForColumns,
  sourceBindingBuildMessage,
  sourceBindingCompatibleForBuild,
  sourceBindingRole,
  universityInspectedColumnOptions,
} from "./universidad/shared/categorias";
import { NumberCell } from "./universidad/aulas";
import {
  corridaDeCalculo,
  corridaDeSeleccion,
  historialCorridas,
  jsonIgual,
  registrarCorrida,
} from "./corridas";
import type { PaqueteDefensaPaso, PaqueteDefensaPasoId } from "./universidad/salidas";
import { UniversidadDesk } from "./universidad/UniversidadDesk";
import { JobProgressBanner } from "./JobProgressBanner";
import { resolveUniversityLocalTab, universitySectionStates, universitySidebarTabs, type CalcMuestraSidebarTab } from "./universidad/universidadTabs";
import "./universidad/universidad-base.css";
import "./calcMuestra.css";

type Msg = { kind: "info" | "warn" | "error"; text: string } | null;
type GuidancePoint = {
  prompt: string;
  answer: string;
  detail: string;
  icon?: typeof Database;
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

function guidedStatusLabel(status: GuideStatus) {
  if (status === "ready") return "Listo";
  if (status === "working") return "Siguiente paso";
  return "Pendiente";
}

const CANAL_OPTIONS: Array<{ id: CalcMuestraCanalRecojo; label: string }> = [
  { id: "aula_qr", label: "Cursos-horario / QR" },
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
    marco: "Unidades agrupadas: cursos-horario, sedes, servicios, manzanas",
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
    marco: "Marco operativo a cubrir por rutas, cursos-horario o servicios",
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
    title: "Muestra de cursos-horario",
    eyebrow: "Base institucional",
    copy: "Para intervenciones universitarias cuya muestra se aplica por cursos-horario y parte de matrícula, facultades, sexo y unidades disponibles.",
    action: "Empezar este camino",
    details: ["Matrícula", "Cuotas", "Cursos-horario", "Seguimiento"],
    sourceRoles: [
      { label: "Base", detail: "estudiantes por facultad y sexo" },
      { label: "Muestra", detail: "tamaño final y cuotas" },
      { label: "Cursos-horario", detail: "titulares y reemplazos" },
      { label: "Campo", detail: "queda listo para seguimiento" },
    ],
    guidance: [
      { prompt: "¿A quién representa?", answer: "Estudiantes matriculados", detail: "La base se ordena por facultad, sexo y cursos-horario disponibles.", icon: Users },
      { prompt: "¿Qué se calcula?", answer: "Entrevistas y cuotas", detail: "Define metas por universidad y por facultad antes de seleccionar cursos-horario.", icon: SlidersHorizontal },
      { prompt: "¿Qué queda listo?", answer: "Cursos-horario titulares y reemplazos", detail: "El plan queda trazable para seguimiento de campo.", icon: FileText },
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
    return universityDefaultWorkspace();
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
  if (desk === "opinion_universitaria") return "Muestra de cursos-horario";
  if (desk === "marco_disponible") return "Muestra general";
  if (desk === "acreditacion") return "Acreditación";
  if (desk === "territorial_handoff") return "Territorial";
  if (desk === "legacy") return "Sesión anterior";
  return "Tipo de estudio";
}

function deskSubtitleForDesk(desk: ActiveDesk) {
  if (desk === "opinion_universitaria") return "Base institucional, cuotas, cursos-horario y seguimiento de aplicación.";
  if (desk === "marco_disponible") return "Unidad, forma del marco, método y resultados.";
  if (desk === "acreditacion") return "Actores, canales, mínimos y reporte metodológico.";
  if (desk === "territorial_handoff") return "Territorio, rutas y viviendas se resuelven en Hojas de Ruta.";
  if (desk === "legacy") return "Sesión antigua conservada para compatibilidad.";
  return "Elige el tipo de muestra para abrir la mesa de trabajo.";
}

function railSectionsForDesk(desk: ActiveDesk): CalcMuestraSectionNavItem[] {
  if (desk === "opinion_universitaria") {
    return [
      { id: "definicion", label: "Datos", detail: "bases, variables y unidades", icon: Database, targetId: "cmv2-section-university-setup" },
      { id: "marco", label: "Marco", detail: "criterios, embudos y cobertura", icon: ClipboardList, targetId: "cmv2-section-university-marco" },
      { id: "calculo", label: "Cálculo", detail: "parámetros, escenarios y reparto", icon: Calculator, targetId: "cmv2-section-university-calculo" },
      { id: "aulas", label: "Selección", detail: "método, sorteo y reemplazos", icon: Grid3X3, targetId: "cmv2-section-university-aulas" },
      { id: "salidas", label: "Entrega", detail: "tablas, reportes y monitoreo", icon: Route, targetId: "cmv2-section-university-salidas" },
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
      copy: "Cobertura o cursos-horario según el marco disponible",
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

function calculatedTargetForComponents(componentes: CalcMuestraComponente[]) {
  return componentes.reduce((peak, comp) => Math.max(peak, safeNumber(comp.resultado?.n_objetivo, 0)), 0);
}

function classroomRecoveryTarget(aulasState: CalcMuestraAulasState | null): { section: string; tab: ClassroomLabTab } {
  if (classroomSelectionReady(aulasState)) return { section: "aulas", tab: "seleccion" };
  if (classroomComparisonReady(aulasState)) return { section: "aulas", tab: "metodo" };
  if (classroomFrameReady(aulasState)) return { section: "marco", tab: "marco" };
  return { section: "definicion", tab: "marco" };
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
      { label: "Mesa", value: "Muestra de cursos-horario", tone: "path" },
      { label: "Base", value: marcoTotal ? `${fmtInt(marcoTotal)} est.` : estratos.length ? `${fmtInt(estratos.length)} dominios` : "por validar", tone: marcoTotal ? "ready" : "working" },
      { label: "Cálculo", value: target ? `${fmtInt(target)} objetivo` : hasResult ? "calculado" : "pendiente", tone: target || hasResult ? "ready" : "working" },
      { label: "Cursos-horario", value: selectionReady ? "titulares + reemplazos" : comparisonReady ? "métodos listos" : "por seleccionar", tone: selectionReady ? "ready" : comparisonReady ? "working" : "neutral" },
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
        { label: "Cursos-horario titulares", value: selectionReady ? "plan listo" : "pendiente", ready: selectionReady, icon: Grid3X3 },
        { label: "Reemplazos", value: replacementReady ? "probados" : "pendiente", ready: replacementReady, icon: RefreshCw },
      ];
    }
    if (activeSection === "salidas") {
      return [
        { label: "Cálculo", value: hasResult ? "listo" : "pendiente", ready: hasResult, icon: Calculator },
        { label: "Cursos-horario", value: selectionReady ? "plan generado" : "sin plan", ready: selectionReady, icon: Grid3X3 },
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
  if (desk === "opinion_universitaria") {
    const universityTabs = universitySidebarTabs({ activeSection, estudio, workspace, aulasState });
    if (universityTabs) return universityTabs;
  }
  const componentes = estudio.componentes;
  const hasResult = componentes.some(hasUsefulResult);
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

// --- Jobs asíncronos de aulas (marcos grandes) ------------------------------
// Con marcos >= umbral del backend, comparar-métodos y seleccionar responden
// { mode: "job", job_id }: se pollea GET /api/jobs/<id> mostrando la etapa
// del worker y el tiempo transcurrido en el busy del shell.
const CM_JOB_POLL_INTERVAL_MS = 1500;
const CM_JOB_POLL_TIMEOUT_MS = 30 * 60_000;

function cmFormatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function cmJobStageMessage(snap: JobSnapshot): string | null {
  const progress = snap.progress;
  if (progress && typeof progress === "object" && "message" in progress && typeof progress.message === "string" && progress.message) {
    return progress.message;
  }
  return null;
}

function cmJobErrorText(snap: JobSnapshot): string {
  return typeof snap.error === "string" && snap.error
    ? snap.error
    : "el proceso terminó con error en el worker.";
}

// Error de control: el usuario canceló el job deliberadamente (no es un fallo
// del worker). Se distingue para mostrar un estado limpio "Cancelado" en vez
// del banner rojo de error.
class JobCancelledError extends Error {
  constructor(label: string) {
    super(`${label}: cancelado por el usuario.`);
    this.name = "JobCancelledError";
  }
}

// Traduce el error de una operación de job en el aviso de la mesa: cancelación
// deliberada → nota limpia (info); cualquier otro fallo → banner de error.
function msgDeFallo(e: unknown, fallback: string): Msg {
  if (e instanceof JobCancelledError) {
    return { kind: "info", text: "Proceso cancelado. No se aplicaron cambios." };
  }
  return { kind: "error", text: e instanceof Error ? e.message : fallback };
}

export default function CalcMuestraPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    estudio,
    hydrated,
    dirty,
    calculando,
    reporteJobId,
    reporteDisponible,
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
  // Job largo en curso (comparar métodos / sorteo de cursos-horario). Cuando es
  // distinto de null el banner de progreso ofrece cancelar. `cancelling` marca
  // el intervalo entre el click y la confirmación del backend; el ref comunica
  // la cancelación al loop de polling sin re-render.
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [cancellingJob, setCancellingJob] = useState(false);
  const cancelRequestedRef = useRef(false);
  const [reporteEnCurso, setReporteEnCurso] = useState(false);
  const [exportandoAulas, setExportandoAulas] = useState(false);
  const [activeRailSection, setActiveRailSection] = useState("pathways");
  const [activeClassroomLabTab, setActiveClassroomLabTab] = useState<ClassroomLabTab>("marco");
  const [activeLocalTabs, setActiveLocalTabs] = useState<Record<string, string>>({});
  const [choosingDesk, setChoosingDesk] = useState(false);
  const [deskOverride, setDeskOverride] = useState<ActiveDesk | null>(null);
  const [pendingDeskReset, setPendingDeskReset] = useState<ActiveDesk | null>(null);
  const [aulasState, setAulasState] = useState<CalcMuestraAulasState | null>(null);
  const [aulasStateChecked, setAulasStateChecked] = useState(false);
  const [uploadingSourceId, setUploadingSourceId] = useState<string | null>(null);
  const [paqueteEnCurso, setPaqueteEnCurso] = useState(false);
  const [paquetePasos, setPaquetePasos] = useState<PaqueteDefensaPaso[] | null>(null);
  const handleHydratedState = useCallback((state: CalcMuestraState) => {
    setAulasState(state.aulas ?? null);
    setAulasStateChecked(true);
  }, []);
  useCalcMuestraAutosave(handleHydratedState);
  // Sincroniza el Motor/Recorrido con estudio.workspace.motor_recorrido
  // (hidratación + write-back); el PUT lo sigue haciendo el autosave de arriba.
  useMotorPersistencia();
  // Setters con guardia de no-op: los efectos de auto-reparación/hidratación
  // del desk (sync Marco → Cálculo, normalizaciones al montar pestañas)
  // re-emiten el estado tal cual; si el patch es deep-equal al actual no se
  // llama al store, así el header no queda "sin guardar" sin cambios reales.
  // Si el patch sí cambia algo, el autosave existente (debounce 2 s) persiste
  // y devuelve el estado a "Guardado" solo.
  const setWorkspaceSiCambia = useCallback(
    (next: CalcMuestraWorkspace) => {
      const current = useCalcMuestraStore.getState().estudio.workspace;
      if (current && jsonIgual(current, next)) return;
      setWorkspace(next);
    },
    [setWorkspace],
  );
  const setComponentesSiCambian = useCallback(
    (next: CalcMuestraComponente[]) => {
      const current = useCalcMuestraStore.getState().estudio.componentes;
      if (jsonIgual(current, next)) return;
      setComponentes(next);
    },
    [setComponentes],
  );
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

  // Los avisos transitorios (error/cancelado/info) no deben sobrevivir a la
  // navegación: al cambiar de sección o de pestaña del laboratorio se limpian,
  // así un error viejo no queda pegado sin poder cerrarse.
  useEffect(() => {
    setMsg(null);
  }, [activeRailSection, activeClassroomLabTab]);

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

  async function iniciar(mode: ActiveDesk) {
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
      // La UI siempre inicia estudios genéricos vacíos; el preset legacy con
      // estratos pre-poblados quedó solo como fixture de tests del backend.
      const res = await apiCalcMuestraIniciarEstudio(tipo, "vacio");
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
    if (desk === "opinion_universitaria") {
      window.requestAnimationFrame(() => {
        document.querySelector(".cmv2-main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
      return;
    }
    if (!item.targetId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(item.targetId ?? "")?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }

  function navegarPestanaLocal(targetId?: string) {
    if (desk === "opinion_universitaria") {
      window.requestAnimationFrame(() => {
        document.querySelector(".cmv2-main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
      return;
    }
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

  // Navegación interna del Recorrido: entre capítulos (pestañas de su sección)
  // y hacia las secciones operativas ("hazlo con tu base").
  function navegarDesdeRecorrido(section: string, tab?: string) {
    setActiveRailSection(section);
    if (tab) setActiveLocalTabs((prev) => ({ ...prev, [`${desk}:${section}`]: tab }));
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
      registrarCorridaDeCalculo(res.estudio);
      const nComponentes = res.estudio.componentes.length;
      setMsg({
        kind: "info",
        text: `Cálculo completado: ${nComponentes} ${nComponentes === 1 ? "componente" : "componentes"}.`,
      });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo calcular." });
    } finally {
      setCalculando(false);
    }
  }

  // --- Mini-historial de corridas ------------------------------------------
  // Cada corrida exitosa (cálculo o selección de aulas) queda registrada en
  // workspace.run_history (cap 12, FIFO) y se persiste con el autosave normal.
  function registrarCorridaDeCalculo(estudioCalculado: CalcMuestraEstudio) {
    const totalComp =
      estudioCalculado.componentes.find((comp) => comp.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID) ??
      estudioCalculado.componentes[0];
    const nextWorkspace = normalizeWorkspace(estudioCalculado);
    const corrida = corridaDeCalculo({ totalComp, workspace: nextWorkspace });
    if (corrida) setWorkspace(registrarCorrida(nextWorkspace, corrida));
  }

  function registrarCorridaDeSeleccion(nextAulasState: CalcMuestraAulasState | null) {
    const nextWorkspace = normalizeWorkspace(useCalcMuestraStore.getState().estudio);
    const corrida = corridaDeSeleccion({ aulasState: nextAulasState, workspace: nextWorkspace });
    if (corrida) setWorkspace(registrarCorrida(nextWorkspace, corrida));
  }

  async function generarReporte(formato: "html" | "pdf" = "html") {
    setReporteEnCurso(true);
    setMsg(null);
    try {
      await persistCurrent();
      const res = await apiCalcMuestraReporteIniciar(formato);
      setReporteMeta({ disponible: false, jobId: res.job_id });
      const start = Date.now();
      const poll = window.setInterval(async () => {
        if (Date.now() - start > CM_JOB_POLL_TIMEOUT_MS) {
          window.clearInterval(poll);
          setReporteEnCurso(false);
          setMsg({ kind: "error", text: "El reporte superó los 30 minutos de espera. Revisa el estado del backend y reintenta." });
          return;
        }
        try {
          // Pollear el JOB (no solo el state): si el worker falla, el error
          // real llega aquí en vez de dejar la UI esperando para siempre.
          const snap = await apiJobStatus(res.job_id);
          if (snap.status === "error" || snap.status === "cancelled") {
            window.clearInterval(poll);
            setReporteEnCurso(false);
            setMsg({ kind: "error", text: `No se pudo generar el reporte: ${cmJobErrorText(snap)}` });
            return;
          }
          if (snap.status === "done") {
            window.clearInterval(poll);
            setReporteEnCurso(false);
            setReporteMeta({ disponible: true, jobId: res.job_id });
            setMsg({ kind: "info", text: "Reporte metodológico listo." });
          }
        } catch {
          // Error transitorio: el siguiente polling vuelve a consultar.
        }
      }, 2000);
    } catch (e) {
      setReporteEnCurso(false);
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo generar el reporte." });
    }
  }

  async function exportarAulasAnexo() {
    setMsg(null);
    setExportandoAulas(true);
    try {
      const res = await apiCalcMuestraAulasExportar();
      setAulasState(res.state.aulas ?? null);
      if (res.export?.file_id) {
        window.open(downloadUrl(res.export.file_id), "_blank", "noreferrer");
      }
      setMsg({ kind: "info", text: `Anexo de cursos-horario exportado: ${res.export?.filename ?? "workbook xlsx"}.` });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "No se pudo exportar la selección de cursos-horario." });
    } finally {
      setExportandoAulas(false);
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
    // Los opcionales c7/c8 los gobierna la decisión del Motor/Recorrido, no un
    // flag suelto del config: la activación real del build sale del store.
    const opcionales = useMotorStore.getState().decisiones.opcionalesActivos;
    return {
      ...config,
      mapping: universityWorkspaceMappingPayload(nextWorkspace.variable_mappings),
      selector_engine: config.selector_engine,
      filters: {
        // Criterios DESACTIVADOS por defecto (§4.1.1): un marco recién
        // construido, sin que el usuario haya definido criterios, no restringe
        // — entra todo el universo único de la base (§4.1.3: todos los
        // criterios "incluidos" ⇒ N = alumnos únicos totales). El usuario opta
        // por cada restricción en Marco → Criterios (suite `criterios_seleccion`,
        // que al activarse gobierna y neutraliza estos flags legacy).
        require_undergraduate: config.require_undergraduate ?? false,
        require_adult: config.require_adult ?? false,
        min_age: config.min_age ?? 18,
        require_in_person: config.require_in_person ?? false,
        accepted_conditions: config.accepted_conditions?.length ? config.accepted_conditions : [],
        min_eligible_per_class: config.min_elegibles_aula,
        exclude_session_patterns: config.exclude_session_patterns ?? [],
        exclude_modality_patterns: config.exclude_modality_patterns,
        exclude_level_patterns: config.exclude_level_patterns,
        // H9: excepciones de tipo de sesión por unidad (viaja junto a los patrones que exime).
        session_type_excepciones: config.session_type_excepciones ?? {},
        require_stable_teacher: config.require_stable_teacher ?? false,
        accepted_teacher_type_patterns: config.accepted_teacher_type_patterns ?? ["contratado", "ordinario"],
        // H7: criterio de pregrado sobre la columna de formación real de la base.
        accepted_formation_patterns: config.accepted_formation_patterns ?? ["pregrado"],
        nivel_por_unidad: config.nivel_por_unidad ?? {},
        accepted_campuses: config.accepted_campuses ?? [],
        require_min_prevalence: opcionales.includes("c7"),
        min_prevalence_pct: config.min_prevalence_pct ?? 0.8,
        require_cycle_homogeneity: opcionales.includes("c8"),
        min_cycle_homogeneity_pct: config.min_cycle_homogeneity_pct ?? 0.8,
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
      const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
      const populationN = Math.max(
        populationRows.length,
        safeNumber((frame as Record<string, unknown> | null)?.population_n, 0),
        safeNumber((frame as Record<string, unknown> | null)?.unique_students_n, 0),
      );
      const aulaN = rowsFrom(frame?.aula_frame).length;

      // Cifras parejas para el banner: universo y elegibles tanto de estudiantes
      // como de cursos-horario (mismas fuentes que la franja "Diseño vigente":
      // frame.perfil con fallback al audit). El universo es la base completa;
      // los elegibles, el marco depurado.
      const frameProfile = frame?.perfil ?? null;
      const universoEstudiantes = Math.max(
        safeNumber(frameProfile?.universo, 0),
        safeNumber((frame as Record<string, unknown> | null)?.unique_students_n, 0),
      );
      const universoCursosHorario = Math.max(
        aulaN,
        safeNumber(frameProfile?.aulas_totales, 0),
        frameAuditNumber(frame, "classroom_n"),
      );
      const cursosHorarioElegibles = Math.max(
        safeNumber(frameProfile?.marco_aulas, 0),
        frameAuditNumber(frame, "classroom_included_n"),
      );

      // Handoff Marco → Cálculo: el estudio absorbe N y los estratos
      // facultad×sexo del marco recién construido. Sin esto el cálculo se
      // queda en N = 0 aunque la base ya esté depurada.
      const sync = estratosDesdeFrame(populationRows);
      if (sync) {
        const [totalComp, facultyComp] = universityComponents(estudio.componentes);
        const marcoPatch = {
          universo_bruto: sync.total,
          marco_validado: sync.total,
          marco_contactable: sync.total,
          estado: "validado" as const,
          estratos: sync.estratos,
        };
        setComponentes([
          { ...totalComp, marco: { ...totalComp.marco, ...marcoPatch }, resultado: null },
          { ...facultyComp, marco: { ...facultyComp.marco, ...marcoPatch }, resultado: null },
        ]);
      }
      // Reporta universo Y elegibles parejo para estudiantes y cursos-horario.
      // El "de N" se muestra solo cuando el universo supera a los elegibles
      // (frames retro-compat sin perfil degradan a solo elegibles).
      const eligEst = populationN;
      const univEst = Math.max(universoEstudiantes, eligEst);
      const eligCH = cursosHorarioElegibles || aulaN;
      const univCH = Math.max(universoCursosHorario, eligCH);
      const estFrag =
        univEst > eligEst
          ? `${fmtInt(eligEst)} de ${fmtInt(univEst)} estudiantes únicos elegibles`
          : `${fmtInt(eligEst)} estudiantes únicos elegibles`;
      const chFrag =
        univCH > eligCH
          ? `${fmtInt(eligCH)} de ${fmtInt(univCH)} cursos-horario elegibles`
          : `${fmtInt(eligCH)} cursos-horario elegibles`;
      setMsg({
        kind: "info",
        text: sync
          ? `Base leída y marco construido: ${estFrag} en ${fmtInt(sync.estratos.length)} facultades y ${chFrag}. El cálculo ya tiene N y estratos listos.`
          : `Base leída y marco construido: ${estFrag} y ${chFrag}.`,
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
          text: `Excel cargado. Marco construido con ${fmtInt(populationN)} estudiantes únicos y ${fmtInt(aulaN)} cursos-horario.`,
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

  // Espera un job del backend actualizando el busy con etapa + tiempo
  // transcurrido. Resuelve con el snapshot "done"; lanza Error con el mensaje
  // real del worker si el job falla, se cancela o supera el timeout.
  async function esperarJobAulas(jobId: string, label: string): Promise<JobSnapshot> {
    const start = Date.now();
    cancelRequestedRef.current = false;
    setActiveJobId(jobId);
    try {
      for (;;) {
        // El usuario pidió cancelar: cortamos el polling de inmediato (el backend
        // sigue abortando el worker en su tiempo) y señalamos cancelación limpia.
        if (cancelRequestedRef.current) throw new JobCancelledError(label);
        if (Date.now() - start > CM_JOB_POLL_TIMEOUT_MS) {
          throw new Error(`${label}: superó los 30 minutos de espera. Revisa el estado del backend y reintenta.`);
        }
        let snap: JobSnapshot | null = null;
        try {
          snap = await apiJobStatus(jobId);
        } catch {
          // Error transitorio de red/backend: se reintenta en el próximo tick.
        }
        if (snap) {
          if (snap.status === "done") return snap;
          if (snap.status === "cancelled") throw new JobCancelledError(label);
          if (snap.status === "error") {
            throw new Error(`${label}: ${cmJobErrorText(snap)}`);
          }
          const stage = cmJobStageMessage(snap);
          setBusy(`${label}${stage ? ` — ${stage}` : ""} · ${cmFormatElapsed(Date.now() - start)}`);
        }
        await new Promise((resolve) => window.setTimeout(resolve, CM_JOB_POLL_INTERVAL_MS));
      }
    } finally {
      setActiveJobId(null);
      setCancellingJob(false);
    }
  }

  // Cancela el job activo: dispara POST /api/jobs/<id>/cancel (best-effort) y
  // marca el ref para que esperarJobAulas corte el polling en el próximo tick.
  async function cancelarJobActivo() {
    const id = activeJobId;
    if (!id || cancelRequestedRef.current) return;
    cancelRequestedRef.current = true;
    setCancellingJob(true);
    try {
      await apiJobCancel(id);
    } catch {
      // Si el cancel no llega, el loop igual corta por cancelRequestedRef y el
      // job termina solo; no bloqueamos al usuario por un fallo de red aquí.
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
      if (res.mode === "job" && res.job_id) {
        const snap = await esperarJobAulas(res.job_id, "Comparando métodos");
        const state = await apiCalcMuestraState();
        setAulasState(state.aulas ?? null);
        const rd = (snap.result_data ?? {}) as { simulation_runs?: number; simulation_runs_executed?: number };
        const executed = rd.simulation_runs_executed;
        const requested = rd.simulation_runs;
        setMsg({
          kind: "info",
          text: typeof executed === "number" && typeof requested === "number" && executed < requested
            ? `Comparación de métodos lista. Marco grande: se ejecutaron ${executed} de ${requested} corridas por método (queda registrado en el resultado).`
            : "Comparación de métodos lista.",
        });
      } else {
        setAulasState(res.state?.aulas ?? null);
        setMsg({ kind: "info", text: "Comparación de métodos lista." });
      }
    } catch (e) {
      setMsg(msgDeFallo(e, "No se pudo comparar métodos. Construye primero el marco de cursos-horario."));
    } finally {
      setBusy(null);
    }
  }

  async function seleccionarAulasDesdeMetodo(config: CalcMuestraWorkspaceAulasConfig, methodId?: string) {
    setMsg(null);
    setBusy("Seleccionando cursos-horario");
    try {
      const res = await apiCalcMuestraAulasSeleccionar(config, undefined, methodId, config.objective);
      let nextAulasState: CalcMuestraAulasState | null;
      if (res.mode === "job" && res.job_id) {
        await esperarJobAulas(res.job_id, "Seleccionando cursos-horario");
        const state = await apiCalcMuestraState();
        nextAulasState = state.aulas ?? null;
      } else {
        nextAulasState = res.state?.aulas ?? null;
      }
      setAulasState(nextAulasState);
      registrarCorridaDeSeleccion(nextAulasState);
      setMsg({ kind: "info", text: "Selección de cursos-horario generada." });
    } catch (e) {
      setMsg(msgDeFallo(e, "No se pudo seleccionar cursos-horario. Construye primero el marco."));
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

  // --- Paquete de defensa de un clic ----------------------------------------
  // Encadena secuencialmente lo que ya existe: (a) reporte metodológico (job
  // Quarto), (b) anexo xlsx de la selección de aulas y (c) memoria JSON de
  // reproducibilidad generada en el frontend. Cada pieza reporta ok/error por
  // separado en el checklist; un fallo no corta las piezas siguientes.
  const memoriaUrlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (memoriaUrlRef.current) URL.revokeObjectURL(memoriaUrlRef.current);
  }, []);

  function actualizarPasoPaquete(id: PaqueteDefensaPasoId, patch: Partial<PaqueteDefensaPaso>) {
    setPaquetePasos((prev) => (prev ? prev.map((paso) => (paso.id === id ? { ...paso, ...patch } : paso)) : prev));
  }

  async function generarPaqueteDefensa(formato: "html" | "pdf" = "html") {
    if (paqueteEnCurso) return;
    setMsg(null);
    setPaqueteEnCurso(true);
    setPaquetePasos([
      { id: "reporte", label: "Reporte metodológico", status: "pendiente" },
      { id: "aulas", label: "Anexo de selección de cursos-horario (xlsx)", status: "pendiente" },
      { id: "memoria", label: "Memoria JSON de reproducibilidad", status: "pendiente" },
    ]);
    let piezasOk = 0;

    // (a) Reporte metodológico: mismo flujo que el botón actual (job Quarto).
    try {
      actualizarPasoPaquete("reporte", { status: "curso" });
      setReporteEnCurso(true);
      await persistCurrent();
      const res = await apiCalcMuestraReporteIniciar(formato);
      setReporteMeta({ disponible: false, jobId: res.job_id });
      await esperarJobAulas(res.job_id, "Paquete de defensa — reporte metodológico");
      setReporteMeta({ disponible: true, jobId: res.job_id });
      actualizarPasoPaquete("reporte", {
        status: "ok",
        detalle: `reporte ${formato.toUpperCase()} generado`,
        url: calcMuestraReporteDescargarUrl({ inline: true }),
      });
      piezasOk += 1;
    } catch (e) {
      actualizarPasoPaquete("reporte", {
        status: "error",
        detalle: e instanceof Error ? e.message : "No se pudo generar el reporte.",
      });
    } finally {
      setReporteEnCurso(false);
    }

    // (b) Anexo xlsx de la selección (mismo export que "Exportar selección").
    try {
      actualizarPasoPaquete("aulas", { status: "curso" });
      setBusy("Paquete de defensa — exportando anexo de cursos-horario");
      const res = await apiCalcMuestraAulasExportar();
      setAulasState(res.state.aulas ?? null);
      actualizarPasoPaquete("aulas", {
        status: "ok",
        detalle: res.export?.filename ?? "workbook xlsx",
        url: res.export?.file_id ? downloadUrl(res.export.file_id) : undefined,
      });
      piezasOk += 1;
    } catch (e) {
      actualizarPasoPaquete("aulas", {
        status: "error",
        detalle: e instanceof Error ? e.message : "No se pudo exportar la selección de cursos-horario.",
      });
    }

    // (c) Memoria JSON generada en el frontend (semilla, firma, decision log).
    try {
      actualizarPasoPaquete("memoria", { status: "curso" });
      setBusy("Paquete de defensa — armando memoria JSON");
      const estudioActual = useCalcMuestraStore.getState().estudio;
      const workspaceActual = normalizeWorkspace(estudioActual);
      let aulasActual = aulasState;
      try {
        const state = await apiCalcMuestraState();
        aulasActual = state.aulas ?? aulasActual;
      } catch {
        // Sin estado fresco se usa el último conocido en memoria.
      }
      const totalComp =
        estudioActual.componentes.find((comp) => comp.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID) ??
        estudioActual.componentes[0];
      const selection = aulasActual?.selection ?? null;
      const memoria = {
        schema: "prosecnur_paquete_defensa_v1",
        proyecto: estudioActual.titulo,
        cliente: estudioActual.contexto.cliente || null,
        timestamp: new Date().toISOString(),
        semilla: selection
          ? safeNumber(selection.seed, safeNumber(workspaceActual.aulas_config?.semilla))
          : workspaceActual.aulas_config?.semilla ?? null,
        firma_marco: selection?.frame_hash ?? aulasActual?.frame?.frame_hash ?? null,
        metodo: selection
          ? String(selection.selector_engine_used ?? selection.selector_engine ?? "")
          : null,
        parametros_calculo: totalComp
          ? {
              z: totalComp.parametros.z,
              p: totalComp.parametros.p,
              e: totalComp.parametros.e,
              deff: totalComp.parametros.deff,
              sobremuestra: totalComp.parametros.oversample_pct,
            }
          : null,
        n_objetivo: safeNumber(totalComp?.resultado?.n_objetivo, 0) || null,
        decision_log: estudioActual.decision_log ?? null,
        historial_corridas: historialCorridas(workspaceActual),
      };
      const blob = new Blob([JSON.stringify(memoria, null, 2)], { type: "application/json" });
      if (memoriaUrlRef.current) URL.revokeObjectURL(memoriaUrlRef.current);
      const url = URL.createObjectURL(blob);
      memoriaUrlRef.current = url;
      actualizarPasoPaquete("memoria", {
        status: "ok",
        detalle: "semilla, firma del marco y decision log",
        url,
        downloadName: `memoria-defensa-${new Date().toISOString().slice(0, 10)}.json`,
      });
      piezasOk += 1;
    } catch (e) {
      actualizarPasoPaquete("memoria", {
        status: "error",
        detalle: e instanceof Error ? e.message : "No se pudo armar la memoria JSON.",
      });
    } finally {
      setBusy(null);
      setPaqueteEnCurso(false);
    }

    const piezasConError = 3 - piezasOk;
    setMsg(
      piezasConError === 0
        ? { kind: "info", text: "Paquete de defensa listo: reporte, anexo de cursos-horario y memoria JSON." }
        : {
            kind: "warn",
            text: `Paquete de defensa con ${piezasConError} ${piezasConError === 1 ? "pieza" : "piezas"} con error: revisa el checklist.`,
          },
    );
  }

  const chromeStatus = chromeStatusForDesk({
    desk,
    componentes: estudio.componentes.length,
    resultados,
    calculando,
    reporteEnCurso,
    busy,
  });
  const universityMotor = usePerfilEfectivo(estudio, aulasState);
  const ChromeStatusIcon = chromeStatus.icon;
  const chromeTokens = chromeTokensForDesk({ desk, estudio, workspace, productos, resultados, aulasState });
  const primaryChromeToken = chromeTokens[0] ?? null;
  const sidebarTabs = sidebarTabsForDeskSection({ desk, activeSection: activeRailSection, estudio, workspace, aulasState });
  const railSectionStates = desk === "opinion_universitaria"
    ? universitySectionStates({ estudio, workspace, aulasState })
    : undefined;
  const storedLocalTab = resolveUniversityLocalTab(activeLocalTabs[`${desk}:${activeRailSection}`]);
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
                {desk === "opinion_universitaria" && (
                  <span className="cmv2-pill-soft cmv2-command-etapa" title="Etapa del estudio · se define en Datos → Estudio">
                    {(workspace.etapa ?? "propuesta") === "campo" ? "Campo · DTI" : "Propuesta"}
                  </span>
                )}
              </div>
            )}

            {desk !== "sin_definir" && (
              <div className="cmv2-command-rail">
                <CalcMuestraSectionRail
                  desk={desk}
                  activeSection={activeRailSection}
                  sectionStates={railSectionStates}
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
                {desk === "opinion_universitaria" && (
                  <span className="cmv2-save-status">
                    <SaveStatusIndicator state={dirty ? "saving" : "saved"} variant="badge" />
                  </span>
                )}
                {desk !== "opinion_universitaria" && (
                  <div className="cmv2-command-cluster" aria-label="Acciones del cálculo">
                    <button type="button" className="cmv2-ghost" onClick={openStudyChooser}>
                      <RefreshCw size={14} /> Cambiar tipo
                    </button>
                    <button type="button" className="cmv2-primary" onClick={() => void calcular()} disabled={calculando || estudio.componentes.length === 0}>
                      {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
                      Calcular
                    </button>
                    <button type="button" className="cmv2-ghost" onClick={() => void generarReporte()} disabled={reporteEnCurso || resultados === 0}>
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
          {desk === "opinion_universitaria" && (
            <ResumenDiseno motor={universityMotor} estudio={estudio} workspace={workspace} aulasState={aulasState} />
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
          {msg && (
            <Alert kind={msg.kind}>
              <span className="cmv2-msg-text">{msg.text}</span>
              <button
                type="button"
                className="cmv2-msg-dismiss"
                onClick={() => setMsg(null)}
                aria-label="Descartar aviso"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </Alert>
          )}
          {busy && (
            <JobProgressBanner
              label={busy}
              jobId={activeJobId}
              cancelling={cancellingJob}
              onCancel={() => void cancelarJobActivo()}
            />
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
            <UniversidadDesk
              estudio={estudio}
              workspace={workspace}
              aulasState={aulasState}
              motor={universityMotor}
              busy={busy}
              activeSection={activeRailSection}
              activeLocalTab={activeLocalTab}
              activeLabTab={activeClassroomLabTab}
              onTitulo={setTitulo}
              onContexto={setContexto}
              onWorkspace={setWorkspaceSiCambia}
              onComponente={updateComponente}
              onSetComponentes={setComponentesSiCambian}
              onCalcular={calcular}
              onCompararAulas={compararMetodosAulas}
              onSeleccionarAulas={seleccionarAulasDesdeMetodo}
              onSimularReemplazos={simularReemplazosAulas}
              onSourceUpload={cargarFuenteUniversitaria}
              onSourceBuild={construirMarcoDesdeFuentes}
              uploadingSourceId={uploadingSourceId}
              calculando={calculando}
              onGenerarReporte={(formato) => void generarReporte(formato)}
              reporteEnCurso={reporteEnCurso}
              reporteDisponible={reporteDisponible}
              reporteDescargarUrl={reporteJobId ? calcMuestraReporteDescargarUrl({ inline: true }) : null}
              onExportarAulas={() => void exportarAulasAnexo()}
              exportandoAulas={exportandoAulas}
              onGenerarPaqueteDefensa={(formato) => void generarPaqueteDefensa(formato)}
              paqueteEnCurso={paqueteEnCurso}
              paquetePasos={paquetePasos}
              onNavigate={navegarDesdeRecorrido}
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

function CalcMuestraSectionRail({
  desk,
  activeSection,
  sectionStates,
  onSection,
}: {
  desk: ActiveDesk;
  activeSection: string;
  /** Avance del recorrido por sección (solo desk universitario): tiñe el
   *  número de las secciones listas y pulsa el siguiente paso. No altera
   *  el click ni la navegación. */
  sectionStates?: Record<string, GuideStatus>;
  onSection: (item: CalcMuestraSectionNavItem) => void;
}) {
  const sections = railSectionsForDesk(desk);
  if (sections.length === 0) return null;
  return (
    <div className="cmv2-section-rail-wrap" aria-label={`${railTitleForDesk(desk)}: secciones`}>
      <GlidingTabList as="nav" activeKey={activeSection} className="pulso-phase-pillbar cmv2-section-rail" role="tablist" aria-label={`${railTitleForDesk(desk)}: secciones`}>
        <ol className="pulso-phase-pill-list">
          {sections.map((item, index) => {
            const active = activeSection === item.id;
            const state = sectionStates?.[item.id];
            const stateClass = state === "ready" ? " is-done" : state === "working" ? " is-next" : "";
            return (
              <li key={item.id} className="pulso-phase-pill-item">
                <button
                  type="button"
                  role="tab"
                  data-gliding-key={item.id}
                  className={`pulso-phase-pill cmv2-section-pill ${active ? "is-active" : ""}${stateClass}`}
                  aria-current={active ? "page" : undefined}
                  aria-selected={active}
                  title={`${item.label}: ${item.detail}${state ? ` · ${guidedStatusLabel(state)}` : ""}`}
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
      </GlidingTabList>
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
    // Rail de tercer nivel (jerarquía canónica módulo → sección → pestaña):
    // colapsado icon-only por defecto, se expande a --pulso-rail-width al
    // hover/focus como overlay (sin reflujo del canvas). El shell absoluto
    // carga el panel visual y la transición de ancho; el aside solo reserva
    // el carril angosto en el grid del workbench.
    <aside className="cmv2-rail cmv2-section-sidebar" aria-label="Pestañas de la sección activa">
      <div className="cmv2-section-sidebar-shell">
        <div className="cmv2-section-sidebar-head">
          <span>{activeMeta?.label ?? railTitleForDesk(desk)}</span>
          <strong>{desk === "opinion_universitaria" && activeSection === "definicion" ? "Preparación" : "Pestañas"}</strong>
          <small>{activeMeta?.detail ?? deskSubtitleForDesk(desk)}</small>
        </div>

        <GlidingTabList
          activeKey={activeTabId}
          orientation="vertical"
          className={`cmv2-section-local-tabs${desk === "opinion_universitaria" ? " is-guided" : ""}`}
          role="tablist"
          aria-label={`Pestañas de ${activeMeta?.label ?? "la sección"}`}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTabId === (tab.classroomTab ?? tab.id);
            // Recorrido guiado (desk universitario): badge de texto visible en
            // vez del punto — "Siguiente" para el paso en curso y "Después"
            // para lo aún pendiente. La pestaña sigue navegable siempre; el
            // porqué del estado viaja en el title.
            const guided = desk === "opinion_universitaria";
            const showFlag = guided && tab.status !== "ready";
            const statusLabel = guidedStatusLabel(tab.status);
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-gliding-key={tab.classroomTab ?? tab.id}
                aria-selected={active}
                className={`cmv2-section-local-tab is-${tab.status}${active ? " is-active" : ""}`}
                // Rail de íconos persistente: el detalle aparece como tooltip
                // flotante ESTILIZADO en hover (patrón de los sidebars de
                // Procesamiento vía data-rail-tooltip), no expandiendo el carril.
                // NO usamos `title` nativo: dispararía el tooltip feo del browser
                // encima del estilizado. La accesibilidad viaja en aria-label.
                aria-label={`${tab.label}. ${tab.detail}`}
                data-rail-tooltip={guided ? `${tab.label}\n${tab.detail} · ${statusLabel}` : `${tab.label}\n${tab.detail}`}
                onClick={() => selectTab(tab)}
              >
                <span className="cmv2-section-local-icon" aria-hidden="true">
                  <Icon size={16} />
                  <span className={`cmv2-section-local-dot is-${tab.status}`} />
                </span>
                <span className="cmv2-section-local-copy">
                  <strong>{tab.label}</strong>
                  <small>{tab.detail}</small>
                </span>
                {showFlag ? (
                  <span className={`cmv2-section-local-flag is-${tab.status}`}>
                    {tab.status === "working" ? "Siguiente" : "Después"}
                  </span>
                ) : (
                  <span className="cmv2-section-local-state" title={statusLabel}>
                    <span className="pulso-sr-only">{statusLabel}</span>
                  </span>
                )}
              </button>
            );
          })}
        </GlidingTabList>
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
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
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
            placeholder="Persona, hogar, curso-horario, actor..."
            onChange={(e) => onWorkspace({ ...workspace, unidad_observacion: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>Unidad de muestreo</span>
            <input
              value={workspace.unidad_muestreo}
              placeholder="Unidad seleccionable del marco"
              onChange={(e) => onWorkspace({ ...workspace, unidad_muestreo: e.currentTarget.value })}
            />
        </label>
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
    { id: "conglomerados", label: "Conglomerados", copy: "Seleccionaré cursos-horario, sedes, servicios, instituciones u otras unidades agrupadas.", icon: Grid3X3 },
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
}: {
  comp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const p = comp.parametros;
  return (
    <section className="cmv2-param-panel">
      <div className="cmv2-param-grid">
        <Param label="Confianza z" value={p.z} step={0.01} onChange={(v) => onComponente(comp.id, { parametros: { z: v } })} />
        <Param label="p esperada" value={p.p} step={0.01} onChange={(v) => onComponente(comp.id, { parametros: { p: v } })} />
        <Param label="Error" value={p.e} step={0.005} suffix="prop." onChange={(v) => onComponente(comp.id, { parametros: { e: v } })} />
        <Param label="Deff" value={p.deff} step={0.1} onChange={(v) => onComponente(comp.id, { parametros: { deff: v } })} />
        <Param label="Sobremuestra" value={p.oversample_pct} step={0.05} suffix="prop." onChange={(v) => onComponente(comp.id, { parametros: { oversample_pct: v } })} />
        <Param label="Respuesta" value={p.tasa_respuesta} step={0.05} suffix="prop." onChange={(v) => onComponente(comp.id, { parametros: { tasa_respuesta: v } })} />
        <Param label="Cobertura" value={p.cobertura_objetivo} step={0.05} suffix="prop." onChange={(v) => onComponente(comp.id, { parametros: { cobertura_objetivo: v } })} />
        <Param label="Piso por celda" value={p.n_minimo_estrato} step={1} onChange={(v) => onComponente(comp.id, { parametros: { n_minimo_estrato: Math.round(v) } })} />
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
