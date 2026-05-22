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
  Wand2,
} from "lucide-react";
import { PageFrame } from "../../components/PageFrame";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { Math as LatexMath } from "../enciclopedia/shared/components/Math";
import { useCalcMuestraAutosave } from "./hooks/useCalcMuestraAutosave";
import { useCalcMuestraStore } from "./store/calcMuestraStore";
import {
  apiCalcMuestraCalcular,
  apiCalcMuestraEstudioPut,
  apiCalcMuestraIniciarEstudio,
  apiCalcMuestraReporteIniciar,
  apiCalcMuestraState,
  apiMonitoreoImportFromCalcMuestra,
  calcMuestraReporteDescargarUrl,
  type CalcMuestraCanalRecojo,
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

const P_EXITO_HSVG_2025_OPERATIVA: Record<string, number> = {
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

const PUCP_ESCENARIO_A_AUDIT: Record<string, UniversityAuditDefaults> = {
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

const PUCP_ESCENARIO_B_AUDIT: Record<string, UniversityAuditDefaults> = {
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
  icon: typeof Database;
}> = [
  {
    id: "acreditacion",
    title: "Acreditación",
    eyebrow: "Plantilla conocida",
    copy: "Actores por programa, reglas por tamaño de marco y salidas por cobertura, muestra o cuotas.",
    icon: ClipboardList,
  },
  {
    id: "opinion_universitaria",
    title: "Estudiantes universitarios",
    eyebrow: "Plantilla conocida",
    copy: "Marco por facultad y sexo; PUCP puede cargarse como punto de partida editable.",
    icon: Grid3X3,
  },
  {
    id: "marco_disponible",
    title: "Diseñar desde marco disponible",
    eyebrow: "Estudio ocasional",
    copy: "Para GIZ, OPS, RET u otros estudios con marco propio: total, estratos, conglomerados, servicios o cuotas.",
    icon: SlidersHorizontal,
  },
  {
    id: "territorial_handoff",
    title: "Territorial / hogares",
    eyebrow: "Handoff",
    copy: "Cuando la unidad natural es zona, manzana o ruta domiciliaria, el diseño se arma en Hojas de Ruta.",
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
  if (estudio.macro_familia === "hsvg_universitario" && estudio.componentes.length > 0) return "opinion_universitaria";
  if (estudio.componentes.length > 0) return "marco_disponible";
  return "sin_definir";
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

function fmtInt(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString("es-PE");
}

function fmtPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
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
  if (mode === "opinion_universitaria") return "Estudiantes universitarios";
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
  const auditMap = kind === "facultad" ? PUCP_ESCENARIO_B_AUDIT : PUCP_ESCENARIO_A_AUDIT;
  return estratos.map((e) => ({
    ...e,
    sub_a_label: e.sub_a_label || "Mujeres",
    sub_b_label: e.sub_b_label || "Hombres",
    e_facultad: safeNumber(e.e_facultad, universityFacultyError(safeNumber(e.N))),
    confianza_facultad: safeNumber(e.confianza_facultad, universityFacultyConfidence(safeNumber(e.N))),
    p_facultad: e.p_facultad == null
      ? P_EXITO_HSVG_2025_OPERATIVA[e.label.toUpperCase()] ?? P_EXITO_HSVG_2025_OPERATIVA[normalizeUniversityLabel(e.label)] ?? 0.5
      : safeNumber(e.p_facultad, P_EXITO_HSVG_2025_OPERATIVA[e.label.toUpperCase()] ?? P_EXITO_HSVG_2025_OPERATIVA[normalizeUniversityLabel(e.label)] ?? 0.5),
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
  const workspace = useMemo(() => normalizeWorkspace(estudio), [estudio]);
  const desk = inferDesk(estudio, workspace);
  const resultados = estudio.componentes.filter(hasUsefulResult).length;
  const productos = Array.from(new Set(estudio.componentes.map(tecnicaProducto)));

  async function persistCurrent(estudioOverride?: CalcMuestraEstudio) {
    await apiCalcMuestraEstudioPut(estudioOverride ?? estudio);
  }

  async function iniciar(mode: ActiveDesk, opts: { variantePucp?: boolean } = {}) {
    setMsg(null);
    if (mode === "territorial_handoff") {
      setWorkspace(workspaceFor("territorial_handoff"));
      return;
    }
    const tipo: CalcMuestraMacroFamilia =
      mode === "acreditacion"
        ? "acreditacion"
        : mode === "opinion_universitaria"
          ? "hsvg_universitario"
          : "estudio_propio";
    setBusy("Preparando mesa");
    try {
      const res = await apiCalcMuestraIniciarEstudio(
        tipo,
        opts.variantePucp ? "plantilla_pucp" : "vacio",
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

  if (!hydrated) return <LoadingBlock label="Cargando mesa de muestra..." />;

  return (
    <PageFrame
      className="cmv2-frame"
      bodyMode="fill"
      title="Calculador de muestra"
      lead="Mesa de trabajo para proponer un diseño muestral nuevo desde el marco disponible."
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
            <RefreshCw size={14} /> Cambiar marco
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
      <div className="cmv2-workbench">
        <aside className="cmv2-rail">
          <div className="cmv2-rail-title">
            <Database size={16} />
            <span>Marco primero</span>
          </div>
          <nav className="cmv2-rail-nav" aria-label="Tipo de marco">
            {FRAME_CARDS.map((card) => {
              const Icon = card.icon;
              const active = desk === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`cmv2-rail-item ${active ? "is-active" : ""}`}
                  onClick={() => {
                    if (card.id === "territorial_handoff") setWorkspace(workspaceFor("territorial_handoff"));
                    else void iniciar(card.id);
                  }}
                >
                  <Icon size={16} />
                  <span>
                    <strong>{card.title}</strong>
                    <small>{card.eyebrow}</small>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="cmv2-main">
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          {busy && (
            <div className="cmv2-busy">
              <Loader2 size={16} className="pulso-spin" />
              {busy}
            </div>
          )}

          {desk === "sin_definir" && <FrameSelector onSelect={(mode) => void iniciar(mode)} onTerritorial={() => setWorkspace(workspaceFor("territorial_handoff"))} />}

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
              onTitulo={setTitulo}
              onContexto={setContexto}
              onWorkspace={setWorkspace}
              onComponente={updateComponente}
              onSetComponentes={setComponentes}
              onCargarPucp={() => void iniciar("opinion_universitaria", { variantePucp: true })}
              onCalcular={calcular}
              calculando={calculando}
            />
          )}

          {desk === "marco_disponible" && (
            <MarcoDisponibleDesk
              estudio={estudio}
              workspace={workspace}
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
          <span className="cmv2-eyebrow">Punto de partida</span>
          <h2>Qué marco tienes disponible</h2>
        </div>
        <p>Marcos conocidos y marcos nuevos.</p>
      </div>
      <div className="cmv2-frame-grid">
        {FRAME_CARDS.map((card) => {
          const Icon = card.icon;
          const territorial = card.id === "territorial_handoff";
          return (
            <button
              key={card.id}
              type="button"
              className={`cmv2-frame-card ${territorial ? "is-handoff" : ""}`}
              onClick={() => (territorial ? onTerritorial() : onSelect(card.id))}
            >
              <span className="cmv2-card-icon"><Icon size={20} /></span>
              <small>{card.eyebrow}</small>
              <strong>{card.title}</strong>
              <p>{card.copy}</p>
              <span className="cmv2-card-action">
                {territorial ? "Ver explicación" : "Abrir mesa"} <ArrowRight size={14} />
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
          <input value={estudio.titulo} onChange={(e) => onTitulo(e.currentTarget.value)} />
        </label>
        <label>
          <span>Cliente</span>
          <input value={estudio.contexto.cliente} onChange={(e) => onContexto("cliente", e.currentTarget.value)} />
        </label>
        <label>
          <span>Fuente del marco</span>
          <input
            value={workspace.fuente_marco}
            onChange={(e) => onWorkspace({ ...workspace, fuente_marco: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>Marco disponible</span>
          <input
            value={workspace.marco_disponible}
            onChange={(e) => onWorkspace({ ...workspace, marco_disponible: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>Unidad de observación</span>
          <input
            value={workspace.unidad_observacion}
            onChange={(e) => onWorkspace({ ...workspace, unidad_observacion: e.currentTarget.value })}
          />
        </label>
        {!universitario && (
          <label>
            <span>Unidad de muestreo</span>
            <input
              value={workspace.unidad_muestreo}
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
  onTitulo,
  onContexto,
  onWorkspace,
  onComponente,
  onCalcular,
  calculando,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onCalcular: () => void;
  calculando: boolean;
}) {
  return (
    <div className="cmv2-desk">
      <ShellHeader
        eyebrow="Plantilla conocida"
        title="Acreditación"
        copy="Actores, marco, meta mínima y salida."
        icon={ClipboardList}
      >
        <button type="button" className="cmv2-primary" onClick={() => void onCalcular()} disabled={calculando}>
          {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
          Calcular actores
        </button>
      </ShellHeader>
      <div className="cmv2-desk-grid">
        <div className="cmv2-stack">
          <ResultadoPanel componentes={estudio.componentes} />
          <AcreditacionActorsTable componentes={estudio.componentes} onComponente={onComponente} />
        </div>
        <aside className="cmv2-side">
          <StudyBasics estudio={estudio} workspace={workspace} onTitulo={onTitulo} onContexto={onContexto} onWorkspace={onWorkspace} />
        </aside>
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
  onTitulo,
  onContexto,
  onWorkspace,
  onComponente,
  onSetComponentes,
  onCargarPucp,
  onCalcular,
  calculando,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onSetComponentes: (componentes: CalcMuestraComponente[]) => void;
  onCargarPucp: () => void;
  onCalcular: (estudioOverride?: CalcMuestraEstudio) => void | Promise<void>;
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

  return (
    <div className="cmv2-desk">
      <ShellHeader
        eyebrow="Plantilla conocida"
        title="Estudiantes universitarios"
        copy="Mesa por facultades y sexo para estimar una propuesta global, una propuesta por facultad o ambas."
        icon={Grid3X3}
      >
        <button type="button" className="cmv2-ghost" onClick={onCargarPucp}>
          <Wand2 size={14} /> Cargar PUCP
        </button>
        <button type="button" className="cmv2-primary" onClick={calculateProposals} disabled={calculando}>
          {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
          Calcular propuestas
        </button>
      </ShellHeader>
      <div className="cmv2-university-workbench">
        <div className="cmv2-university-top">
          <StudyBasics
            estudio={estudio}
            workspace={syncedWorkspace}
            onTitulo={onTitulo}
            onContexto={onContexto}
            onWorkspace={onWorkspace}
            mode="universitario"
          />
          <UniversityRevampMarcoPanel comp={totalComp} />
        </div>

        <section className="cmv2-panel cmv2-university-edit-panel">
          <div className="cmv2-panel-head">
            <span className="cmv2-eyebrow">Marco y parámetros</span>
            <strong>Facultades, sexo y supuestos de cálculo</strong>
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

        <UniversityRevampCalculoPanel
          componentes={[totalComp, facultyComp]}
          workspace={syncedWorkspace}
          draftTargets={draftTargets}
          onDraftTarget={setDraftTarget}
          onApplyTarget={applyTarget}
          calculando={calculando}
        />

        <UniversityRevampResultadosPanel
          componentes={[totalComp, facultyComp]}
          workspace={syncedWorkspace}
          onWorkspace={onWorkspace}
        />
      </div>
    </div>
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
  return (
    <div className="cmv2-university-table-block">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Tabla editable</span>
        <strong>Facultades del marco</strong>
      </div>
      <div className="cmv2-table-wrap cmv2-university-table-scroll">
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
  onCargarPucp,
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
  onCargarPucp: () => void;
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
        eyebrow="Plantilla conocida"
        title="Estudiantes universitarios"
        copy="Mesa por facultades y sexo; calcula tamaño muestral y distribución de cuotas."
        icon={Grid3X3}
      >
        <button type="button" className="cmv2-ghost" onClick={onCargarPucp}>
          <Wand2 size={14} /> Cargar PUCP
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

  return (
    <div className="cmv2-desk">
      <ShellHeader
        eyebrow="Estudio ocasional"
        title="Diseñar desde marco disponible"
        copy="Define unidad, variables de control y forma del marco. Luego eliges el cálculo y ajustas parámetros."
        icon={SlidersHorizontal}
      >
        <button type="button" className="cmv2-primary" onClick={() => void onCalcular()} disabled={calculando}>
          {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
          Calcular mesa
        </button>
      </ShellHeader>
      <div className="cmv2-desk-grid">
        <div className="cmv2-stack">
          <ResultadoPanel componentes={estudio.componentes} />
          <MarcoShapeSelector selected={workspace.marco_disponible} onSelect={onEnsureKind} />
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
        <aside className="cmv2-side">
          <StudyBasics estudio={estudio} workspace={workspace} onTitulo={onTitulo} onContexto={onContexto} onWorkspace={onWorkspace} />
          <VariablesControl workspace={workspace} onWorkspace={onWorkspace} />
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
        </aside>
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
