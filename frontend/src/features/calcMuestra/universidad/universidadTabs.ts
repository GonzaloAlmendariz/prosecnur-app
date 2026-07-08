import {
  BarChart3,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Database,
  FileCheck2,
  FileText,
  Gauge,
  Grid3X3,
  Send,
  SlidersHorizontal,
  Table2,
  Users,
} from "lucide-react";
import {
  type CalcMuestraAulasState,
  type CalcMuestraEstudio,
  type CalcMuestraWorkspace,
} from "../../../api/client";
import { guideStatus, rowsFrom, safeNumber, type GuideStatus } from "../sharedCore";
import { universityObservedCategoryRows } from "./shared/categorias";
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
import { hasUsefulResult, normalizeUniversityAulasConfig } from "./shared/study";

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
      { id: "marco-poblacion", label: "Población", detail: "elegibles y estructura", icon: Users, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-marco-poblacion" },
      { id: "marco-aulas", label: "Aulas", detail: "solo curso-horario", icon: Grid3X3, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-marco-aulas" },
      { id: "marco-validacion", label: "Consistencia", detail: "bases relacionadas", icon: CheckCircle2, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource), targetId: "cmv2-local-marco-validacion" },
    ];
  }
  if (activeSection === "calculo") {
    return [
      { id: "calculo-guia", label: "Parámetros", detail: "precisión, confianza y n", icon: SlidersHorizontal, status: guideStatus(effectiveMarcoReady || hasResult, declaredSourcesReady), targetId: "cmv2-local-calculo-guia" },
      { id: "calculo-propuestas", label: "Propuestas", detail: "N, cuotas y aulas", icon: Calculator, status: guideStatus(hasResult, effectiveMarcoReady), targetId: "cmv2-local-calculo-propuestas" },
      { id: "calculo-ajustes", label: "Supuestos", detail: "deff, rendimiento y campo", icon: Gauge, status: guideStatus(Boolean(totalComp || facultyComp), effectiveMarcoReady), targetId: "cmv2-local-calculo-ajustes" },
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
