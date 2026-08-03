import type {
  CalcMuestraAulasMethodSummary,
  CalcMuestraAulasObjectiveConfig,
  CalcMuestraAulasProfileDistribution,
  CalcMuestraAulasRepresentativityMetric,
  CalcMuestraAulasSimulationSummary,
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { rowsFrom, safeNumber } from "../../sharedCore";
import {
  DEFAULT_UNIVERSITY_AULAS_OBJECTIVE,
  UNIVERSITY_AULAS_MODALIDAD_OPTIONS,
  UNIVERSITY_AULAS_SELECTOR_OPTIONS,
} from "../shared/constants";
import {
  classroomComparisonForState,
  classroomExtraReserveRowsForState,
  classroomM1RowsForState,
  classroomReplacementSimulationForState,
  classroomReserveRowsForState,
  classroomSelectionForState,
  classroomSelectionRowsForState,
  frameAuditCards,
  frameAuditNumber,
  frameAuditValue,
} from "../shared/frame";
import { estimateOperationalExtra } from "../shared/study";
import { normalizeStaleJobAviso } from "./descuentoRepetidosModel";
import { resolveClassroomArtifactStatus } from "./classroomHandoff";
import { selectorFieldLabel } from "./classroomLabels";

export type ClassroomLabModel = ReturnType<typeof buildClassroomLabModel>;

export function buildClassroomLabModel({
  workspace,
  totalComp,
  facultyComp,
  aulasState,
  marcoDesactualizado = false,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
  marcoDesactualizado?: boolean;
}) {
  const frame = aulasState?.frame ?? null;
  const rawComparison = classroomComparisonForState(aulasState);
  const rawSelection = classroomSelectionForState(aulasState);
  const rawReplacementSimulation = classroomReplacementSimulationForState(aulasState);
  const frameRows = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
  const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
  const framePopulationCount = Math.max(
    populationRows.length,
    safeNumber((frame as Record<string, unknown> | null)?.population_n, 0),
    safeNumber((frame as Record<string, unknown> | null)?.unique_students_n, 0),
    frameAuditNumber(frame, "population_n"),
    frameAuditNumber(frame, "unique_students_n"),
  );
  // El workspace manda sobre el eco stale en descuento y objetivo titular R.
  const {
    aulasScenario,
    selectedComp,
    selectedResultReady,
    config,
    currentAulasTarget,
    frameReady,
    marcoDesactualizado: artifactMarcoDesactualizado,
    comparisonReady,
    selectionReady,
    replacementReady,
  } = resolveClassroomArtifactStatus({
    workspace,
    totalComp,
    facultyComp,
    aulasState,
    marcoDesactualizado,
  });
  const comparison = comparisonReady ? rawComparison : null;
  const selection = selectionReady ? rawSelection : null;
  const replacementSimulation = replacementReady ? rawReplacementSimulation : null;
  const selectionRows = selectionReady ? classroomSelectionRowsForState(aulasState) : [];
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
  const recommendedMethodId = comparison?.recommendation?.method_id ?? String(config.selector_engine ?? config.selector);
  const recommendedProfileRows = profileRows.filter((row) => !row.method_id || row.method_id === (comparison?.recommendation?.method_id ?? ""));
  const visibleProfiles = (recommendedProfileRows.length ? recommendedProfileRows : profileRows).slice(0, 36);
  const coverageRows = rowsFrom<Record<string, unknown>>(representativity?.coverage_overlap ?? selection?.diagnostics?.coverage_overlap);
  const currentRepresentativityScore = safeNumber(selection?.representativity_score ?? representativity?.representativity_score ?? comparison?.recommendation?.representativity_score, Number.NaN);
  const engineOption = UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((option) => option.id === config.selector_engine) ?? UNIVERSITY_AULAS_SELECTOR_OPTIONS[0];
  const modalidad = UNIVERSITY_AULAS_MODALIDAD_OPTIONS.find((option) => option.id === config.modalidad) ?? UNIVERSITY_AULAS_MODALIDAD_OPTIONS[0];
  const m1Rows = selectionReady ? classroomM1RowsForState(aulasState) : [];
  const reserveRows = selectionReady ? classroomReserveRowsForState(aulasState) : [];
  const extraReserveRows = selectionReady ? classroomExtraReserveRowsForState(aulasState) : [];
  const recommendedMethod = comparisonMethods.find((method) => method.method_id === recommendedMethodId) ?? null;
  const facultades = selectedComp.marco.estratos ?? [];
  const extraOperativo = estimateOperationalExtra(facultades, config);
  const sobremuestraPct = selectedComp.parametros.oversample_pct;
  const selectorFields = config.estratos_selector.map(selectorFieldLabel);
  const targetForDisplay = safeNumber(selectedComp.resultado?.n_objetivo, 0);
  const auditedFrameCount = frameAuditValue(frame, "classroom_included_n");
  const frameCapacityKnown = auditedFrameCount !== "" || frameRows.length > 0;
  const selectableFrameCount = auditedFrameCount !== ""
    ? frameAuditNumber(frame, "classroom_included_n")
    : frameRows.length;
  const m1ForDisplay = selectionReady
    ? m1Rows.length
    : frameCapacityKnown ? Math.min(currentAulasTarget, selectableFrameCount) : currentAulasTarget;
  const hasCalculatedQuota = currentAulasTarget > 0 && !artifactMarcoDesactualizado &&
    (!frameCapacityKnown || selectableFrameCount > 0);
  const frameAuditCardsForDisplay = frameAuditCards(frame);
  const topGaps = visibleProfiles
    .filter((row) => Number.isFinite(safeNumber(row.abs_error, Number.NaN)))
    .sort((a, b) => safeNumber(b.abs_error, 0) - safeNumber(a.abs_error, 0))
    .slice(0, 6);
  // Diagnósticos del motor usados por Simulación, Reemplazos y Auditoría.
  const diagnostics = selection?.diagnostics ?? {};
  const weightStability = rowsFrom<Record<string, unknown>>(diagnostics.weight_stability ?? representativity?.weight_stability)[0] ?? null;
  const reserveDepthRows = rowsFrom<Record<string, unknown>>(diagnostics.reserve_depth ?? representativity?.reserve_depth ?? comparison?.reserve_depth);
  const waveRows = rowsFrom<Record<string, unknown>>(diagnostics.waves);
  const probabilityRows = rowsFrom<Record<string, unknown>>(diagnostics.probabilities);
  // Traducción validada del motor: cuota → aulas por facultad (si existe).
  const aulasPorEstrato = selectedComp.resultado?.aulas_por_estrato ?? [];
  // F4: resultado de job NO aplicado por marco desactualizado (guard del
  // backend). Se muestra junto a las acciones de la mesa para pedir re-ejecutar.
  const staleJobAviso = normalizeStaleJobAviso(aulasState?.stale_job_result ?? null);

  return {
    totalComp,
    facultyComp,
    aulasScenario,
    selectedComp,
    selectedResultReady,
    currentAulasTarget,
    frame,
    // Evidencia almacenada, separada deliberadamente de los artefactos
    // acreditados de abajo. Sirve para explicar un estado incompleto sin
    // publicar como vigente una comparación, selección o simulación stale.
    storedComparison: rawComparison,
    storedSelection: rawSelection,
    storedReplacementSimulation: rawReplacementSimulation,
    hasStoredComparison: Boolean(rawComparison),
    hasStoredSelection: Boolean(rawSelection),
    hasStoredReplacementSimulation: Boolean(rawReplacementSimulation),
    comparison,
    selection,
    replacementSimulation,
    frameRows,
    frameReady,
    marcoDesactualizado: artifactMarcoDesactualizado,
    comparisonReady,
    selectionReady,
    replacementReady,
    framePopulationCount,
    selectionRows,
    config,
    objective,
    objectiveVariables,
    representativity,
    comparisonMethods,
    representativityMetrics,
    comparisonMetrics,
    simulationRows,
    visibleProfiles,
    coverageRows,
    currentRepresentativityScore,
    engineOption,
    modalidad,
    m1Rows,
    reserveRows,
    extraReserveRows,
    recommendedMethodId,
    recommendedMethod,
    facultades,
    extraOperativo,
    sobremuestraPct,
    selectorFields,
    targetForDisplay,
    m1ForDisplay,
    hasCalculatedQuota,
    frameAuditCardsForDisplay,
    topGaps,
    weightStability,
    reserveDepthRows,
    waveRows,
    probabilityRows,
    aulasPorEstrato,
    staleJobAviso,
  };
}
