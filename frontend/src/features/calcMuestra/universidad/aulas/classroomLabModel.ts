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
import { tieneComparacionAlmacenada, tieneSeleccionAlmacenada, tieneSimulacionAlmacenada } from "./evidenciaAlmacenada";
import { resolveClassroomArtifactStatus } from "./classroomHandoff";
import { selectorFieldLabel } from "./classroomLabels";

export type ClassroomLabModel = ReturnType<typeof buildClassroomLabModel>;

/**
 * Con qué método se sortea: manda el configurado, la recomendación es sugerencia.
 *
 * Se valida contra la lista canónica en vez de confiar en el valor, porque un id
 * que no esté en las opciones resuelve a un label vacío y deja el botón diciendo
 * «Sortear con» a secas, sin nombre.
 *
 * Vive fuera de `buildClassroomLabModel` a propósito: probarlo a través del
 * modelo exige acreditar la firma completa de la comparación, y en el primer
 * intento el fixture no la acreditaba, así que `comparison` quedaba en null,
 * ambos caminos coincidían y el mutante que devolvía el recomendado pasaba los
 * tres tests. Una decisión que se puede aislar, se aísla.
 */
export function resolverMetodoParaSortear(configuradoId: string, recomendadoId: string) {
  return UNIVERSITY_AULAS_SELECTOR_OPTIONS.some((o) => o.id === configuradoId)
    ? configuradoId
    : recomendadoId;
}

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
    comparisonConfigDiff,
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
  /**
   * Con qué método se sortea de verdad.
   *
   * Era `recommendedMethodId`, que da prioridad a lo que recomienda el
   * comparador y sólo cae a la configuración cuando NO hay comparación — que es
   * justo el caso en que el botón estaba deshabilitado. Resultado medido en
   * HSVG2026 el 2026-08-22: método configurado «Balance por cuotas y tamaño»,
   * recomendado «Optimizar repetidos», y el botón decía «Sortear con Optimizar
   * repetidos». El usuario elegía un método y la app sorteaba con otro.
   *
   * Gonzalo, 2026-08-22: «¿por qué te fuerza a compararlos siempre? ¿Por qué no
   * sólo seleccionar uno e ir con ese?». Manda la configuración; la
   * recomendación es una sugerencia y se avisa cuando difieren.
   */
  const metodoParaSortear = resolverMetodoParaSortear(String(config.selector_engine ?? ""), recommendedMethodId);
  const recomendacionDifiere = Boolean(
    comparison?.recommendation?.method_id
    && metodoParaSortear
    && comparison.recommendation.method_id !== metodoParaSortear,
  );
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
  // Las aulas que de verdad se pueden seleccionar. `frameRows` es el
  // aula_frame COMPLETO —incluidas y excluidas por criterios— y su nombre no
  // lo dice, así que cada consumidor que contaba `frameRows.length` anunciaba
  // 5.269 donde hay 3.373 seleccionables. Se cuenta una vez, acá, y se expone
  // ya contado: reparar cada consumidor por separado es lo que hace que el
  // defecto sobreviva en el que se olvidó.
  const frameIncludedRows = frameRows.filter((fila) => fila.included === true);
  const frameIncludedCount = frameIncludedRows.length;
  const auditedFrameCount = frameAuditValue(frame, "classroom_included_n");
  const frameCapacityKnown = auditedFrameCount !== "" || frameRows.length > 0;
  const selectableFrameCount = auditedFrameCount !== ""
    ? frameAuditNumber(frame, "classroom_included_n")
    // Fallback: si la auditoría no publica el conteo, se cuentan las incluidas,
    // no todas. Con `frameRows.length` este camino sobreestimaba en silencio.
    : frameIncludedCount;
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
    // Contenido, no existencia: el estado trae estas claves como objetos
    // vacíos y `Boolean({})` es true, así que un proyecto recién creado
    // afirmaba tener una corrida previa que nunca ocurrió (evidenciaAlmacenada.ts).
    hasStoredComparison: tieneComparacionAlmacenada(rawComparison),
    hasStoredSelection: tieneSeleccionAlmacenada(rawSelection),
    hasStoredReplacementSimulation: tieneSimulacionAlmacenada(rawReplacementSimulation),
    comparison,
    selection,
    replacementSimulation,
    frameRows,
    frameIncludedRows,
    frameIncludedCount,
    frameReady,
    marcoDesactualizado: artifactMarcoDesactualizado,
    comparisonReady,
    comparisonConfigDiff,
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
    metodoParaSortear,
    recomendacionDifiere,
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
