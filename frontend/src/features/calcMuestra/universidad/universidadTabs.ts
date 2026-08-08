import type { LucideIcon } from "lucide-react";
import {
  normalizeCalcMuestraAlumnosPorCh,
  normalizeCalcMuestraAlumnosPorChDecision,
  normalizeCalcMuestraAulasCriteriosRadiografia,
  normalizeCriteriosCatalogo,
  type CalcMuestraAulasState,
  type CalcMuestraEstudio,
  type CalcMuestraWorkspace,
} from "../../../api/client";
import { guideStatus, rowsFrom, safeNumber, type GuideStatus } from "../sharedCore";
import { CALC_MUESTRA_UNIVERSIDAD_PESTANAS } from "../../../lib/navegacion/catalogos/calcMuestra";
import {
  CLASSROOM_LAB_TABS,
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_REQUIRED_VARIABLES,
  UNIVERSITY_TOTAL_COMPONENT_ID,
  type ClassroomLabTab,
} from "./shared/constants";
import {
  classroomFrameReady,
  evaluarConsistenciaMarco,
  frameAuditNumber,
} from "./shared/frame";
import { hasUsefulResult } from "./shared/study";
import { universityFrameSourceBindings } from "./shared/categorias";
import { resolveClassroomArtifactStatus } from "./aulas/classroomHandoff";
import { alumnosPorChDecisionIsCurrent } from "./marco/alumnosPorChDecisionModel";

export type CalcMuestraSidebarTab = {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
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
  // Cursos-horario requeridos. Un tab guardado de Supuestos va a Diseño.
  "calculo-ajustes": "calculo-diseno",
  // Split de Marco (2026-07-15): "Criterios de inclusión" (marco-categorias,
  // que renderizaba ambos bloques) se partió en dos pestañas por el orden
  // metodológico — primero el estudiante (elegibilidad), después la evidencia
  // de alumnos por CH y finalmente el aula con la radiografía integrada. El
  // Explorador se absorbió en la tercera. Tabs guardados de los ids viejos
  // aterrizan en su reemplazo.
  "marco-criterios": "marco-criterios-alumno",
  "marco-categorias": "marco-criterios-alumno",
  /*
   * G42 · El explorador de bases reabrió en Datos (`def-explorador`), no aquí.
   *
   * Este alias se queda: lo que aquel split absorbió dentro de la radiografía
   * —el explorador POR FACULTAD del marco— sigue absorbido, y un tab guardado
   * con el id viejo tiene que aterrizar donde está su contenido. El explorador
   * nuevo responde otra pregunta (cómo son las bases leídas) y por eso vive en
   * otra sección con id propio.
   *
   * De paso, la trampa: este alias existía cuando se reabrió la pestaña con el
   * mismo id, así que la dirección era correcta, el rail la pintaba y el desk
   * montaba la radiografía. Resucitar un id exige mirar esta tabla primero.
   */
  "marco-explorador": "marco-ch-radiografia",
  // D10 ejecutada: Consistencia es pestaña propia de Datos, inmediatamente
  // después de Fuentes. El alias histórico apunta ahora a su hogar real; la
  // integración provisional dentro de Fuentes queda retirada.
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

/** Resuelve únicamente pestañas vivas de Selección; todo legado cae en Objetivo. */
export function resolveUniversityClassroomTab(id: string | null | undefined): ClassroomLabTab {
  const resolved = resolveUniversityLocalTab(id);
  return CLASSROOM_LAB_TABS.find((tab) => tab.id === resolved)?.id ?? "objetivo";
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
  const totalComp = componentes.find((comp) => comp.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID);
  const facultyComp = componentes.find((comp) => comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID);
  const artifactStatus = totalComp && facultyComp
    ? resolveClassroomArtifactStatus({ workspace, totalComp, facultyComp, aulasState })
    : null;
  const selectedResultReady = artifactStatus?.selectedResultReady ?? false;
  const declaredSourcesReady = universityFrameSourceBindings(workspace.source_bindings).some((source) =>
    Boolean(source.file_name || source.file_id || source.spreadsheet_id || source.status === "cargada" || source.status === "validada"),
  );
  const requiredMapped = UNIVERSITY_REQUIRED_VARIABLES
    .filter((row) => row.required)
    .every((required) => (workspace.variable_mappings ?? []).some((row) => row.role === required.role && row.column));
  const frameReady = classroomFrameReady(aulasState);
  const selectionReady = artifactStatus?.selectionReady ?? false;
  const replacementReady = artifactStatus?.replacementReady ?? false;

  const sections: Array<[string, boolean]> = [
    ["definicion", Boolean(estudio.titulo) && (declaredSourcesReady || frameReady) && requiredMapped],
    ["marco", marcoReady || frameReady],
    ["calculo", selectedResultReady],
    ["aulas", selectionReady],
    ["salidas", selectedResultReady && selectionReady && replacementReady],
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

function classroomLabStatusesForSidebar(
  estudio: CalcMuestraEstudio,
  workspace: CalcMuestraWorkspace,
  aulasState: CalcMuestraAulasState | null,
): Record<ClassroomLabTab, GuideStatus> {
  const totalComp = estudio.componentes.find((comp) => comp.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID);
  const facultyComp = estudio.componentes.find((comp) => comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID);
  const status = totalComp && facultyComp
    ? resolveClassroomArtifactStatus({ workspace, totalComp, facultyComp, aulasState })
    : null;
  const hasCalculatedQuota = status?.selectedResultReady ?? false;
  const frameReady = classroomFrameReady(aulasState);
  const comparisonReady = status?.comparisonReady ?? false;
  const selectionReady = status?.selectionReady ?? false;
  const replacementReady = status?.replacementReady ?? false;
  return {
    objetivo: guideStatus(hasCalculatedQuota, frameReady),
    metodo: guideStatus(comparisonReady, hasCalculatedQuota),
    laboratorio: guideStatus(comparisonReady, hasCalculatedQuota),
    seleccion: guideStatus(selectionReady, comparisonReady),
    // El perfil describe la selección: existe en cuanto ella existe.
    perfil: guideStatus(selectionReady, selectionReady),
    reemplazos: guideStatus(replacementReady, selectionReady),
    // ADR 0067: el relato narra la corrida persistida — mismo gate que Perfil.
    "aulas-relato": guideStatus(selectionReady, selectionReady),
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
  const exactTotalComp = componentes.find((comp) => comp.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID);
  const exactFacultyComp = componentes.find((comp) => comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID);
  const totalComp = exactTotalComp ?? componentes[0];
  const marcoReady = componentes.some((comp) =>
    safeNumber(comp.marco.marco_validado, 0) > 0 ||
    (comp.marco.estratos ?? []).some((row) => safeNumber(row.N, 0) > 0),
  );
  const hasResult = componentes.some(hasUsefulResult);
  const hasSource = Boolean(workspace.fuente_marco || workspace.marco_disponible);
  const declaredSources = universityFrameSourceBindings(workspace.source_bindings);
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
  const artifactStatus = exactTotalComp && exactFacultyComp
    ? resolveClassroomArtifactStatus({ workspace, totalComp: exactTotalComp, facultyComp: exactFacultyComp, aulasState })
    : null;
  const comparisonReady = artifactStatus?.comparisonReady ?? false;
  const selectionReady = artifactStatus?.selectionReady ?? false;
  const replacementReady = artifactStatus?.replacementReady ?? false;
  const selectedResultReady = artifactStatus?.selectedResultReady ?? false;
  const effectiveMarcoReady = marcoReady || builtAulasFrameReady;

  if (activeSection === "definicion") {
    const baseReady = declaredSourcesReady || hasDescriptiveFrame;
    const baseConfigured = baseReady && requiredMapped;
    const [estudioTab, basesTab, consistenciaTab, exploradorTab, variablesTab, historicoTab] =
      CALC_MUESTRA_UNIVERSIDAD_PESTANAS.definicion;
    // G42 · La base histórica es OPCIONAL: su pestaña acredita cuando el motor
    // publicó la referencia, y hasta entonces no bloquea nada —el marco se
    // construye sin ella—, así que no puede pintarse como un paso pendiente.
    const referenciaLista = Boolean(
      (workspace.source_bindings ?? []).find(
        (binding) => binding.role === "referencia_asistencia",
      )?.file_id,
    );
    const consistencyStatus = evaluarConsistenciaMarco(workspace.source_mode, aulasState?.frame);
    return [
      { ...estudioTab, status: guideStatus(Boolean(estudio.titulo)) },
      // D10: Fuentes acredita que las bases están declaradas; la consistencia
      // entre ellas es su propia pestaña y su propio estado.
      { ...basesTab, status: guideStatus(baseReady, hasSource) },
      { ...consistenciaTab, status: baseReady ? consistencyStatus : guideStatus(false, baseReady || hasSource) },
      // G42 · El explorador describe lo que ya hay: listo en cuanto el motor
      // publicó filas, sin exigir criterios ni cascada.
      { ...exploradorTab, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource) },
      { ...variablesTab, status: guideStatus(baseConfigured, baseReady || hasSource) },
      { ...historicoTab, status: guideStatus(referenciaLista, true) },
    ];
  }
  if (activeSection === "marco") {
    const criteriosCatalogoReady = normalizeCriteriosCatalogo(aulasState?.frame?.criterios_catalogo ?? null).variables.length > 0;
    const criteriosRadiografia = normalizeCalcMuestraAulasCriteriosRadiografia(
      aulasState?.frame?.criterios_radiografia ?? null,
    );
    const criteriosRadiografiaReady = Boolean(
      criteriosRadiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v2" &&
      criteriosRadiografia.frame_hash === aulasState?.frame?.frame_hash,
    );
    const alumnosPorChRaw = aulasState?.frame?.alumnos_por_ch ?? null;
    const alumnosPorChNormalizado = normalizeCalcMuestraAlumnosPorCh(alumnosPorChRaw);
    const alumnosPorCh = alumnosPorChNormalizado?.frame_hash === aulasState?.frame?.frame_hash
      ? alumnosPorChNormalizado
      : null;
    const alumnosDecision = normalizeCalcMuestraAlumnosPorChDecision(workspace.aulas_config?.alumnos_por_ch_decision);
    const alumnosDecisionReady = alumnosPorChDecisionIsCurrent(alumnosPorCh, alumnosDecision);
    const [criteriosTab, alumnosTab, radiografiaTab, poblacionTab, aulasTab, coberturaTab] =
      CALC_MUESTRA_UNIVERSIDAD_PESTANAS.marco;
    return [
      { ...criteriosTab, status: guideStatus(criteriosCatalogoReady && criteriosRadiografiaReady, hasDescriptiveFrame) },
      { ...alumnosTab, status: guideStatus(alumnosDecisionReady, Boolean(alumnosPorCh || alumnosPorChRaw)) },
      // La radiografía es el contenido dominante de esta pestaña integrada, así
      // que solo queda lista cuando el contrato F1 v2 corresponde al frame. Un
      // frame descriptivo legacy habilita su recuperación, pero no la acredita.
      { ...radiografiaTab, status: guideStatus(criteriosRadiografiaReady, hasDescriptiveFrame || declaredSourcesReady || hasSource) },
      { ...poblacionTab, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource) },
      { ...aulasTab, status: guideStatus(hasDescriptiveFrame, declaredSourcesReady || hasSource) },
      { ...coberturaTab, status: guideStatus(effectiveMarcoReady) },
    ];
  }
  if (activeSection === "calculo") {
    const [disenoTab, propuestasTab, chFacultadTab, distribucionTab] = CALC_MUESTRA_UNIVERSIDAD_PESTANAS.calculo;
    return [
      // Diseño absorbe los supuestos de la fórmula (§5.1.2): fórmula, significado
      // y regulación de cada parámetro (global y por facultad).
      { ...disenoTab, status: guideStatus(true) },
      { ...propuestasTab, status: guideStatus(hasResult, effectiveMarcoReady) },
      // Nueva pestaña (§5.3) en el slot que dejó Supuestos: alumnos por CH y CH
      // definitivos por facultad.
      { ...chFacultadTab, status: guideStatus(hasResult, effectiveMarcoReady) },
      { ...distribucionTab, status: guideStatus(true) },
    ];
  }
  if (activeSection === "aulas") {
    const statuses = classroomLabStatusesForSidebar(estudio, workspace, aulasState);
    return CLASSROOM_LAB_TABS.map((tab) => ({
      ...tab,
      status: statuses[tab.id],
    }));
  }
  if (activeSection === "salidas") {
    const deliverablesReady = selectedResultReady && selectionReady && publicationConfigured;
    const [guiaTab, resultadosTab, entregablesTab, monitoreoTab] = CALC_MUESTRA_UNIVERSIDAD_PESTANAS.salidas;
    return [
      { ...guiaTab, status: guideStatus(selectedResultReady && selectionReady && replacementReady, effectiveMarcoReady) },
      { ...resultadosTab, status: guideStatus(selectedResultReady) },
      { ...entregablesTab, status: guideStatus(deliverablesReady, selectedResultReady && selectionReady) },
      { ...monitoreoTab, status: guideStatus(selectionReady && replacementReady, comparisonReady) },
    ];
  }
  return null;
}
