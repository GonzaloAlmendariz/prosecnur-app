import {
  BarChart3,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Compass,
  Database,
  FileCheck2,
  FileText,
  Gauge,
  Grid3X3,
  GraduationCap,
  PieChart,
  Send,
  Sigma,
  Table2,
  Users,
} from "lucide-react";
import {
  normalizeCriteriosCatalogo,
  type CalcMuestraAulasState,
  type CalcMuestraEstudio,
  type CalcMuestraWorkspace,
} from "../../../api/client";
import { guideStatus, rowsFrom, safeNumber, type GuideStatus } from "../sharedCore";
import {
  CLASSROOM_LAB_TABS,
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_REQUIRED_VARIABLES,
  UNIVERSITY_TOTAL_COMPONENT_ID,
  type ClassroomLabTab,
} from "./shared/constants";
import {
  classroomComparisonReady,
  classroomFrameReady,
  classroomReplacementReady,
  classroomSelectionReady,
  frameAuditNumber,
} from "./shared/frame";
import { hasUsefulResult } from "./shared/study";

export type CalcMuestraSidebarTab = {
  id: string;
  label: string;
  detail: string;
  icon: typeof Database;
  status: GuideStatus;
  targetId?: string;
  classroomTab?: ClassroomLabTab;
};

/**
 * Pestañas retiradas en la reconstrucción → pestaña que absorbió su contenido.
 * Se aplica al restaurar la pestaña activa guardada para no caer en un id muerto.
 */
export const UNIVERSITY_LOCAL_TAB_ALIASES: Record<string, string> = {
  "marco-cruces": "marco-poblacion",
  "marco-estructura": "marco-poblacion",
  "marco-cadena": "marco-poblacion",
  "salidas-reservas": "salidas-monitoreo",
  // Consolidación del Motor en la tubería única (2026-07): la guía de
  // parámetros quedó absorbida por el diseño reactivo.
  "calculo-guia": "calculo-diseno",
  // Supuestos se fusionó en Diseño (§5.1.2); su slot lo ocupa la nueva pestaña
  // Cursos-horario por facultad. Un tab guardado de Supuestos va a Diseño.
  "calculo-ajustes": "calculo-diseno",
  // Split de Marco (2026-07-15): "Criterios de inclusión" (marco-categorias,
  // que renderizaba ambos bloques) se partió en dos pestañas por el orden
  // metodológico — primero el estudiante (elegibilidad), luego el aula con la
  // radiografía integrada. El Explorador se absorbió en la segunda. Tabs
  // guardados de los ids viejos aterrizan en su reemplazo.
  "marco-criterios": "marco-criterios-alumno",
  "marco-categorias": "marco-criterios-alumno",
  "marco-explorador": "marco-ch-radiografia",
  // Consistencia se reubicó de Marco a Datos (§3.2): un tab guardado aterriza
  // en su nuevo hogar dentro de Datos.
  "marco-validacion": "def-consistencia",
  // Un solo hogar de criterios (2026-07): Datos deja de decidir elegibilidad
  // (vive en Marco → Criterios) y de adelantar resultados del marco. Un tab
  // guardado de Elegibilidad/Institución aterriza en el mapeo de Variables.
  "def-categorias": "def-variables",
  "def-institucion": "def-variables",
};

export function resolveUniversityLocalTab(id: string | null | undefined) {
  if (!id) return "";
  return UNIVERSITY_LOCAL_TAB_ALIASES[id] ?? id;
}

/**
 * Estado de avance por sección del rail (Definición → Marco → Cálculo →
 * Aulas → Salida) para el desk universitario. Reutiliza las mismas señales
 * que las pestañas del sidebar: una sección queda "ready" cuando su producto
 * central existe; la primera sección no lista es "working" (el siguiente
 * paso del recorrido) y las posteriores quedan "pending".
 */
export function universitySectionStates({
  estudio,
  workspace,
  aulasState,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}): Record<string, GuideStatus> {
  const componentes = estudio.componentes;
  const marcoReady = componentes.some((comp) =>
    safeNumber(comp.marco.marco_validado, 0) > 0 ||
    (comp.marco.estratos ?? []).some((row) => safeNumber(row.N, 0) > 0),
  );
  const hasResult = componentes.some(hasUsefulResult);
  const declaredSourcesReady = (workspace.source_bindings ?? []).some((source) =>
    Boolean(source.file_name || source.file_id || source.spreadsheet_id || source.status === "cargada" || source.status === "validada"),
  );
  const requiredMapped = UNIVERSITY_REQUIRED_VARIABLES
    .filter((row) => row.required)
    .every((required) => (workspace.variable_mappings ?? []).some((row) => row.role === required.role && row.column));
  const frameReady = classroomFrameReady(aulasState);
  const selectionReady = classroomSelectionReady(aulasState);
  const replacementReady = classroomReplacementReady(aulasState);

  const sections: Array<[string, boolean]> = [
    ["definicion", Boolean(estudio.titulo) && (declaredSourcesReady || frameReady) && requiredMapped],
    ["marco", marcoReady || frameReady],
    ["calculo", hasResult],
    ["aulas", selectionReady],
    ["salidas", hasResult && selectionReady && replacementReady],
  ];

  const states: Record<string, GuideStatus> = {};
  let nextAssigned = false;
  for (const [id, done] of sections) {
    if (done) {
      states[id] = "ready";
      continue;
    }
    states[id] = nextAssigned ? "pending" : "working";
    nextAssigned = true;
  }
  return states;
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

export function universitySidebarTabs({
  activeSection,
  estudio,
  workspace,
  aulasState,
}: {
  activeSection: string;
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}): CalcMuestraSidebarTab[] | null {
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

  if (activeSection === "definicion") {
    const baseReady = declaredSourcesReady || hasDescriptiveFrame;
    const baseConfigured = baseReady && requiredMapped;
    // Datos solo declara el insumo: identidad, fuentes y mapeo. Los criterios de
    // inclusión viven en Marco → Criterios (un solo hogar); Datos no muestra
    // resultados del marco (la antigua pestaña Institución los adelantaba).
    return [
      { id: "def-estudio", label: "Estudio", detail: "nombre, cliente y alcance", icon: ClipboardList, status: guideStatus(Boolean(estudio.titulo)), targetId: "cmv2-local-def-estudio" },
      { id: "def-bases", label: "Fuentes", detail: "archivos, hojas y lectura", icon: Database, status: guideStatus(baseReady, hasSource), targetId: "cmv2-local-def-bases" },
      // Consistencia vive en Datos (§3.2): la calidad del enlace entre bases se
      // evalúa AL CARGAR los datos, no al armar el marco.
      { id: "def-consistencia", label: "Consistencia", detail: "enlace entre bases (base única o dos bases)", icon: CheckCircle2, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-def-consistencia" },
      { id: "def-variables", label: "Variables", detail: "columnas de la base", icon: Table2, status: guideStatus(baseConfigured, baseReady || hasSource), targetId: "cmv2-local-def-variables" },
    ];
  }
  if (activeSection === "marco") {
    const criteriosCatalogoReady = normalizeCriteriosCatalogo(aulasState?.frame?.criterios_catalogo ?? null).variables.length > 0;
    // Orden metodológico (reunión del diseño muestral 2026-07-15): primero
    // definimos quién es elegible (criterios del estudiante → N elegibles),
    // luego perfilamos dónde están esos elegibles por curso-horario decidiendo
    // los criterios de aula CON la radiografía del marco a la vista.
    return [
      { id: "marco-criterios-alumno", label: "Criterios del estudiante", detail: "quién es elegible: formación, condición, edad, facultades y nivel", icon: GraduationCap, status: guideStatus(criteriosCatalogoReady, hasDescriptiveFrame), targetId: "cmv2-local-marco-criterios-alumno" },
      // La radiografía es el contenido dominante de esta pestaña integrada, así
      // que gatea con el marco descriptivo (igual que marco-aulas): sin frame no
      // hay dónde perfilar los criterios de aula.
      { id: "marco-ch-radiografia", label: "Cursos-horario: criterios + radiografía", detail: "define los criterios de aula viendo dónde están los elegibles por facultad", icon: Compass, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-marco-ch-radiografia" },
      { id: "marco-poblacion", label: "Población", detail: "elegibles y estructura (base real)", icon: Users, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-marco-poblacion" },
      { id: "marco-aulas", label: "Cursos-horario", detail: "unidades del marco (base real)", icon: Grid3X3, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-marco-aulas" },
      { id: "marco-cobertura", label: "Cobertura", detail: "elegibles vs. no elegibles por facultad", icon: BarChart3, status: guideStatus(effectiveMarcoReady), targetId: "cmv2-local-marco-cobertura" },
    ];
  }
  if (activeSection === "calculo") {
    return [
      // Diseño absorbe los supuestos de la fórmula (§5.1.2): fórmula, significado
      // y regulación de cada parámetro (global y por facultad).
      { id: "calculo-diseno", label: "Diseño", detail: "fórmula, parámetros y supuestos", icon: Sigma, status: guideStatus(true), targetId: "cmv2-local-calculo-diseno" },
      { id: "calculo-propuestas", label: "Propuestas", detail: "N y cuotas por facultad (motor R)", icon: Calculator, status: guideStatus(hasResult, effectiveMarcoReady), targetId: "cmv2-local-calculo-propuestas" },
      // Nueva pestaña (§5.3) en el slot que dejó Supuestos: alumnos por CH y CH
      // definitivos por facultad.
      { id: "calculo-ch-facultad", label: "Cursos-horario por facultad", detail: "alumnos por CH y CH definitivos", icon: Grid3X3, status: guideStatus(hasResult, effectiveMarcoReady), targetId: "cmv2-local-calculo-ch-facultad" },
      { id: "calculo-distribucion", label: "Distribución", detail: "población y muestra por unidad × sexo", icon: PieChart, status: guideStatus(true), targetId: "cmv2-local-calculo-distribucion" },
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
      { id: "salidas-guia", label: "Cierre", detail: "ficha ejecutiva del diseño", icon: FileCheck2, status: guideStatus(hasResult && selectionReady && replacementReady, effectiveMarcoReady), targetId: "cmv2-local-salidas-guia" },
      { id: "salidas-entregables", label: "Entregables", detail: "Excel, Sheets y privacidad", icon: FileText, status: guideStatus(deliverablesReady, hasResult && selectionReady), targetId: "cmv2-local-salidas-entregables" },
      { id: "salidas-resultados", label: "Tablas", detail: "cuotas finales por facultad y sexo", icon: BarChart3, status: guideStatus(hasResult), targetId: "cmv2-local-salidas-resultados" },
      { id: "salidas-monitoreo", label: "Pase a Monitoreo", detail: "handoff operativo y reservas", icon: Send, status: guideStatus(selectionReady && replacementReady, comparisonReady), targetId: "cmv2-local-salidas-monitoreo" },
    ];
  }
  return null;
}
