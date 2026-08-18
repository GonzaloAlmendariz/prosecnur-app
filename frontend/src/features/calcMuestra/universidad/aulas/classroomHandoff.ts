import type {
  CalcMuestraAulasMethodComparison,
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { normalizeCalcMuestraAlumnosPorChDecision } from "../../../../api/client";
import { safeNumber } from "../../sharedCore";
import {
  classroomComparisonForState,
  classroomComparisonReady,
  classroomFrameReady,
  marcoCriteriosDesactualizado,
  classroomReplacementReady,
  classroomReplacementSimulationForState,
  classroomSelectionForState,
  classroomSelectionReady,
} from "../shared/frame";
import {
  hasUsefulResult,
  normalizeUniversityAulasConfig,
  universityAulasScenario,
  universityComponentForScenario,
} from "../shared/study";

export function classroomSelectorTarget(raw: unknown): number {
  if (raw == null || typeof raw !== "object") return 0;
  const record = raw as Record<string, unknown>;
  const selector = record.selector;
  const nestedTarget = selector && typeof selector === "object"
    ? (selector as Record<string, unknown>).n_aulas
    : undefined;
  return safeNumber(record.n_aulas ?? nestedTarget, 0);
}

export const CLASSROOM_COMPARISON_SELECTOR_SCHEMA =
  "calc_muestra_aulas_method_comparison_selector_v1";

function comparisonRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function comparisonScalar(value: unknown, fallback: string): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate == null ? fallback : String(candidate).trim();
}

function comparisonNumber(value: unknown, fallback: number): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate == null || (typeof candidate === "string" && candidate.trim() === "")) return fallback;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Espejo de `.cm_aulas_normalize_objective`: R firma el objetivo ya completo. */
function classroomComparisonObjectiveSnapshot(rawObjective: unknown): Record<string, unknown> {
  const defaultObjective = comparisonRecord(normalizeUniversityAulasConfig().objective);
  const objective = Object.keys(comparisonRecord(rawObjective)).length
    ? comparisonRecord(rawObjective)
    : defaultObjective;
  const rawVariables = objective.variables ?? objective.variables_balance;
  const defaultVariables = Array.isArray(defaultObjective.variables)
    ? defaultObjective.variables.map(comparisonRecord)
    : [];
  const variablesInput = Array.isArray(rawVariables) && rawVariables.length
    ? rawVariables.map(comparisonRecord)
    : defaultVariables;
  const variableColumns = new Set(variablesInput.flatMap((variable) => Object.keys(variable)));
  const defaultsByDimension = new Map(defaultVariables.map((variable) => [
    comparisonScalar(variable.dimension, ""),
    variable,
  ]));
  const variableText = (
    variable: Record<string, unknown>,
    key: string,
    fallback: string,
  ) => variableColumns.has(key) ? comparisonScalar(variable[key], "") : fallback;
  const variables = variablesInput.flatMap((variable) => {
    const dimension = variableText(variable, "dimension", "");
    const defaults = defaultsByDimension.get(dimension) ?? {};
    const defaultWeight = comparisonNumber(defaults.weight, 0.03);
    const defaultTolerance = comparisonNumber(defaults.tolerance, 0.05);
    const parsedWeight = comparisonNumber(variable.weight, defaultWeight);
    const parsedTolerance = comparisonNumber(variable.tolerance, defaultTolerance);
    const weight = parsedWeight < 0 ? defaultWeight : parsedWeight;
    const tolerance = parsedTolerance <= 0 ? defaultTolerance : parsedTolerance;
    if (!dimension || weight <= 0) return [];
    return [{
      dimension,
      label: variableText(variable, "label", comparisonScalar(defaults.label, dimension)),
      aula_col: variableText(variable, "aula_col", comparisonScalar(defaults.aula_col, dimension)),
      student_col: variableText(variable, "student_col", comparisonScalar(defaults.student_col, "")),
      weight,
      tolerance,
      source_preference: variableText(
        variable,
        "source_preference",
        comparisonScalar(defaults.source_preference, "aula"),
      ),
    }];
  });
  const defaultWeights = comparisonRecord(defaultObjective.component_weights);
  const inputWeights = comparisonRecord(objective.component_weights ?? objective.pesos_componentes);
  const componentWeights = Object.fromEntries(Object.entries(defaultWeights).map(([key, value]) => [
    key,
    Math.max(0, comparisonNumber(inputWeights[key], comparisonNumber(value, 0))),
  ]));
  const normalizedAtLeast = (value: unknown, fallback: unknown) =>
    Math.max(0.01, comparisonNumber(value, comparisonNumber(fallback, 0.01)));

  return {
    schema: "calc_muestra_aulas_representativity_objective_v1",
    primary_unit: comparisonScalar(
      objective.primary_unit ?? objective.unidad_primaria,
      comparisonScalar(defaultObjective.primary_unit, ""),
    ),
    variables,
    component_weights: componentWeights,
    duplicate_loss_tolerance: normalizedAtLeast(
      objective.duplicate_loss_tolerance ?? objective.tolerancia_repetidos,
      defaultObjective.duplicate_loss_tolerance,
    ),
    dispersion_tolerance: normalizedAtLeast(
      objective.dispersion_tolerance ?? objective.tolerancia_dispersion,
      defaultObjective.dispersion_tolerance,
    ),
    weight_cv_warn: normalizedAtLeast(
      objective.weight_cv_warn ?? objective.alerta_cv_pesos,
      defaultObjective.weight_cv_warn,
    ),
    weight_cv_critical: normalizedAtLeast(
      objective.weight_cv_critical ?? objective.critico_cv_pesos,
      defaultObjective.weight_cv_critical,
    ),
    reserve_depth_target: normalizedAtLeast(
      objective.reserve_depth_target ?? objective.profundidad_reserva_objetivo,
      defaultObjective.reserve_depth_target,
    ),
    missing_policy: comparisonScalar(
      objective.missing_policy ?? objective.politica_faltantes,
      comparisonScalar(defaultObjective.missing_policy, ""),
    ),
  };
}

/**
 * Espejo sin el método elegido: el comparador corre todos los métodos, pero
 * estas decisiones sí cambian sus sorteos o diagnósticos. La forma coincide
 * con el snapshot que emite R y permite fallar cerrado sin recalcular en React.
 */
export function classroomComparisonSelectorSnapshot(
  rawConfig?: CalcMuestraWorkspaceAulasConfig,
): Record<string, unknown> {
  const config = normalizeUniversityAulasConfig(rawConfig);
  const simulationRuns = Math.max(0, Math.round(safeNumber(config.simulation_runs, 0)));
  return {
    schema: CLASSROOM_COMPARISON_SELECTOR_SCHEMA,
    seed: Math.round(safeNumber(config.semilla, 20260619)),
    n_aulas: Math.max(1, Math.round(safeNumber(config.n_aulas, 30))),
    replacement_waves: Math.max(0, Math.round(safeNumber(config.bolsas_reemplazo, 0))),
    strata_cols: config.estratos_selector,
    balance_vars: config.balance_vars ?? [],
    spread_vars: config.spread_vars ?? [],
    candidate_pool_size: Math.max(1, Math.round(safeNumber(config.candidate_pool_size, 1))),
    simulation_runs: simulationRuns,
    mos_strategy: String(config.mos_strategy ?? ""),
    coordination_mode: String(config.coordination_mode ?? ""),
    replacement_depth_strategy: String(config.replacement_depth_strategy ?? ""),
    min_replacements_per_titular: Math.max(0, Math.round(safeNumber(config.min_replacements_per_titular, 0))),
    max_replacements_per_titular: Math.max(0, Math.round(safeNumber(config.max_replacements_per_titular, 0))),
    extra_pool_policy: String(config.extra_pool_policy ?? ""),
    replacement_equivalence_vars: config.replacement_equivalence_vars ?? [],
    replacement_score_weights: config.replacement_score_weights ?? {},
    duplicate_penalty: Math.max(0, safeNumber(config.penalizacion_repetidos, 0)),
    sequential_discount: config.sequential_discount ?? true,
    pps_weight: Math.max(0, safeNumber(config.pps_weight, 0)),
    coverage_weight: Math.max(0, safeNumber(config.coverage_weight, 0)),
    // La acción Comparar usa simulation_runs como presupuesto efectivo y R
    // lo copia a monte_carlo_n antes de producir el snapshot.
    monte_carlo_n: simulationRuns,
    objective: classroomComparisonObjectiveSnapshot(config.objective),
  };
}

function stableComparisonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableComparisonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableComparisonValue(entry)]),
    );
  }
  return value;
}

/**
 * Una corrida de Aulas pertenece a la decisión de alumnos/CH que produjo su
 * objetivo. R conserva esa firma en `aulas.config`; React solo compara la
 * firma normalizada y falla cerrado. Ausente↔ausente mantiene proyectos legacy.
 */
export function classroomRunMatchesAlumnosPorChDecision(
  workspaceConfig: CalcMuestraWorkspaceAulasConfig | undefined,
  runConfig: Record<string, unknown> | undefined,
): boolean {
  const currentRaw = workspaceConfig?.alumnos_por_ch_decision;
  const runRaw = runConfig?.alumnos_por_ch_decision;
  if (currentRaw == null && runRaw == null) return true;
  const current = normalizeCalcMuestraAlumnosPorChDecision(
    currentRaw,
  );
  const run = normalizeCalcMuestraAlumnosPorChDecision(
    runRaw,
  );
  if (!current || !run) return false;
  return JSON.stringify(stableComparisonValue(current)) ===
    JSON.stringify(stableComparisonValue(run));
}

export function classroomComparisonMatchesConfig(
  comparison: CalcMuestraAulasMethodComparison | null | undefined,
  config: CalcMuestraWorkspaceAulasConfig,
): boolean {
  const selector = comparison?.selector;
  if (!selector || selector.schema !== CLASSROOM_COMPARISON_SELECTOR_SCHEMA) return false;
  return JSON.stringify(stableComparisonValue(selector)) ===
    JSON.stringify(stableComparisonValue(classroomComparisonSelectorSnapshot(config)));
}

/**
 * Los campos en los que la corrida guardada difiere de la firma vigente, con
 * ambos valores. El match booleano decide; esto EXPLICA. La quinta mordida de
 * la familia de copias (workspace n_aulas 202 / MC 500 contra la corrida
 * 203 / 0) fue indiagnosticable desde la UI porque el aviso decía «vuelve a
 * comparar» sin decir qué campo — y re-comparar no reparaba el workspace.
 */
export function classroomComparisonConfigDiff(
  comparison: CalcMuestraAulasMethodComparison | null | undefined,
  config: CalcMuestraWorkspaceAulasConfig,
): string[] {
  const selector = comparison?.selector;
  if (!selector) return [];
  if (selector.schema !== CLASSROOM_COMPARISON_SELECTOR_SCHEMA) {
    return [`schema (corrida ${String(selector.schema ?? "—")} · vigente ${CLASSROOM_COMPARISON_SELECTOR_SCHEMA})`];
  }
  const esperado = classroomComparisonSelectorSnapshot(config);
  const corrida = selector as unknown as Record<string, unknown>;
  const compacto = (value: unknown): string => {
    const stable = stableComparisonValue(value);
    if (stable === undefined || stable === null || stable === "") return "—";
    const texto = typeof stable === "object" ? JSON.stringify(stable) : String(stable);
    return texto.length > 48 ? `${texto.slice(0, 45)}…` : texto;
  };
  const claves = [...new Set([...Object.keys(esperado), ...Object.keys(corrida)])].sort();
  const diferencias: string[] = [];
  for (const clave of claves) {
    const enCorrida = JSON.stringify(stableComparisonValue(corrida[clave]));
    const vigente = JSON.stringify(stableComparisonValue(esperado[clave]));
    if (enCorrida !== vigente) {
      diferencias.push(`${clave} (corrida ${compacto(corrida[clave])} · vigente ${compacto(esperado[clave])})`);
    }
  }
  return diferencias;
}

export function resolveClassroomHandoff({
  workspaceConfig,
  runConfig,
  expectedTarget,
  marcoDesactualizado,
}: {
  workspaceConfig?: CalcMuestraWorkspaceAulasConfig;
  runConfig?: Record<string, unknown>;
  expectedTarget: number;
  marcoDesactualizado: boolean;
}) {
  const persistedTarget = safeNumber(workspaceConfig?.n_aulas, 0);
  const currentAulasTarget = persistedTarget > 0 && persistedTarget === expectedTarget
    ? persistedTarget
    : 0;
  const config = normalizeUniversityAulasConfig({
    ...normalizeUniversityAulasConfig(workspaceConfig),
    n_aulas: currentAulasTarget || undefined,
  });
  const runMatchesTarget = currentAulasTarget > 0 &&
    classroomSelectorTarget(runConfig) === currentAulasTarget &&
    classroomRunMatchesAlumnosPorChDecision(workspaceConfig, runConfig);
  return { config, currentAulasTarget, runIsCurrent: runMatchesTarget && !marcoDesactualizado };
}

export function resolveClassroomArtifactStatus({
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
  const aulasScenario = universityAulasScenario(workspace);
  const selectedComp = universityComponentForScenario([totalComp, facultyComp], workspace) ??
    (aulasScenario === "e2" ? facultyComp : totalComp);
  const selectedResultReady = hasUsefulResult(selectedComp);
  const workspaceConfig = normalizeUniversityAulasConfig(workspace.aulas_config);
  const decisiones = workspace.motor_recorrido?.decisiones as Record<string, unknown> | undefined;
  const rawOpcionales = decisiones?.opcionalesActivos;
  const opcionalesActivos = Array.isArray(rawOpcionales)
    ? rawOpcionales.filter((item): item is string => typeof item === "string")
    : [];
  const artifactMarcoDesactualizado = marcoDesactualizado || marcoCriteriosDesactualizado(
    aulasState?.frame ?? null,
    workspaceConfig.criterios_seleccion,
    workspaceConfig.teacher_type_orden,
    { config: workspaceConfig, opcionalesActivos },
  );
  const handoff = resolveClassroomHandoff({
    workspaceConfig,
    runConfig: aulasState?.config,
    expectedTarget: selectedResultReady ? safeNumber(selectedComp.resultado?.aulas_base_total, 0) : 0,
    marcoDesactualizado: artifactMarcoDesactualizado,
  });
  const selection = classroomSelectionForState(aulasState);
  const comparison = classroomComparisonForState(aulasState);
  const replacement = classroomReplacementSimulationForState(aulasState);
  const frameHash = String(aulasState?.frame?.frame_hash ?? "");
  const frameReady = classroomFrameReady(aulasState) && !artifactMarcoDesactualizado;
  const matchesFrame = (artifact: { frame_hash?: string } | null | undefined) =>
    Boolean(frameHash && artifact?.frame_hash === frameHash);
  const comparisonReady = classroomComparisonReady(aulasState) && frameReady && handoff.runIsCurrent &&
    classroomSelectorTarget(comparison) === handoff.currentAulasTarget && matchesFrame(comparison) &&
    classroomComparisonMatchesConfig(comparison, handoff.config);
  const selectionRunId = String(selection?.selection_run_id ?? "").trim();
  const replacementSelectionRunId = String(replacement?.selection_run_id ?? "").trim();
  const selectionReady = classroomSelectionReady(aulasState) && handoff.currentAulasTarget > 0 &&
    frameReady && handoff.runIsCurrent && Boolean(selectionRunId) &&
    classroomSelectorTarget(selection) === handoff.currentAulasTarget && matchesFrame(selection);
  const replacementReady = classroomReplacementReady(aulasState) && selectionReady &&
    Boolean(selectionRunId) && replacementSelectionRunId === selectionRunId && matchesFrame(replacement);
  return {
    aulasScenario,
    selectedComp,
    selectedResultReady,
    frameReady,
    marcoDesactualizado: artifactMarcoDesactualizado,
    ...handoff,
    comparisonReady,
    // Vacío cuando la comparación acredita (o no existe): con contenido, el
    // aviso de la superficie puede decir QUÉ campo difiere en vez de mandar
    // a re-comparar a ciegas.
    comparisonConfigDiff: comparisonReady
      ? []
      : classroomComparisonConfigDiff(comparison, handoff.config),
    selectionReady,
    replacementReady,
  };
}
